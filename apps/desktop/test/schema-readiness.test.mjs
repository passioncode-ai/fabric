import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withSchemaReadiness, readBuildManifestCandidates } from '../src/main/schemaReadiness.ts'
import { readManifest } from '../src/shared/buildManifest.ts'
import { classifyStartupFailure, startupDialog } from '../src/shared/startupFailure.ts'
// The admitted window comes from the compiled contract the readiness check compares against, so
// admitting a new schema does not leave this fixture describing the previous one.
const admitted=JSON.parse(readFileSync(new URL('../src/shared/schemaContract.json',import.meta.url),'utf8'))
const N=admitted.maximum

const fixture = (over = {}) => ({ schema: 'BuildManifest@2', buildId: 'build', commitSha: 'a'.repeat(40), sourceDirty:false,
  builtAtUtc:'2026-09-27T12:00:00Z',appVersion:'0.1.0',lockfileSha256:'b'.repeat(64),artifactDigest:'c'.repeat(64),
  schemaMin:admitted.minimum,schemaMax:admitted.maximum,journalReadVersions:[1],adapterContractRevision:'fac-0.1.0',toolchainDigest:null,files:[],...over })
function input(...values) { const data=values.length?values[0]:N; return {packaged:true,manifest:readManifest(fixture()),readSchema:async()=>({data,error:null})} }
const effects=[]
const start=()=>{effects.push('estate.append','identity','surface','recovery','IPC'); return 'started'}
let count=0
async function test(name,run){effects.length=0;await run();count++;console.log(`PASS ${name}`)}
await test('only exact current schema reaches domain startup',async()=>{
  assert.equal(await withSchemaReadiness(input(),start),'started')
  assert.deepEqual(effects,['estate.append','identity','surface','recovery','IPC'])
})
await test('old, new, unknown and malformed schemas have zero domain effects',async()=>{
  for(const value of [53,N-1,N+1,0,-1,null,undefined,NaN,Infinity,-Infinity,64.1,'64','',true,[],{},Number.MAX_SAFE_INTEGER+1]){
    await assert.rejects(withSchemaReadiness(input(value),start),{code:'FABRIC_SCHEMA_NOT_READY'})
    assert.deepEqual(effects,[])
  }
})
await test('missing packaged, malformed and stale present manifests never query or start',async()=>{
  for(const manifest of [readManifest(null),readManifest({}),readManifest(fixture({schemaMin:53})),
    ...[NaN,'64',null,-1,0,Infinity,{},[]].flatMap(v=>[readManifest(fixture({schemaMin:v})),readManifest(fixture({schemaMax:v}))])]){
    let queried=0
    await assert.rejects(withSchemaReadiness({...input(),manifest,readSchema:async()=>{queried++;return {data:N,error:null}}},start))
    assert.equal(queried,0);assert.deepEqual(effects,[])
  }
})
await test('dev-only absent manifest uses compiled contract; present broken or stale never does',async()=>{
  assert.equal(await withSchemaReadiness({...input(),packaged:false,manifest:readManifest(null)},start),'started')
  effects.length=0
  for(const manifest of [readManifest({}),readManifest(fixture({schemaMin:53}))])
    await assert.rejects(withSchemaReadiness({...input(),packaged:false,manifest},start))
  assert.deepEqual(effects,[])
})
await test('failure remains before retry point; same startup callback queries again then succeeds',async()=>{
  let attempts=0
  const request={...input(),readSchema:async()=>({data:++attempts===1?N-1:N,error:null})}
  let failure
  try{await withSchemaReadiness(request,start)}catch(error){failure=classifyStartupFailure(error)}
  assert.equal(failure.cause,'schema-not-ready')
  assert.ok(startupDialog(failure,{retryable:true,logPath:'/owned/startup.log'}).buttons.includes('Retry'))
  assert.deepEqual(effects,[])
  assert.equal(await withSchemaReadiness(request,start),'started');assert.equal(attempts,2)
})
await test('backend rejection/error bodies never enter safe startup error or effects',async()=>{
  for(const readSchema of [async()=>{throw new Error('synthetic-private-backend-canary')},
    async()=>({data:N,error:{message:'synthetic-private-backend-canary'}}),async()=>null]){
    await assert.rejects(withSchemaReadiness({...input(),readSchema},start),error=>{
      assert.equal(error.code,'FABRIC_SCHEMA_NOT_READY');assert.ok(!String(error).includes('canary'));return true
    })
  }
  assert.deepEqual(effects,[])
})
await test('hung and late replies never start, deadline aborts, retry is fresh',async()=>{
  let finish,signal
  const p=withSchemaReadiness({...input(),timeoutMs:5,readSchema:s=>{signal=s;return new Promise(resolve=>{finish=resolve})}},start)
  await assert.rejects(p);assert.equal(signal.aborted,true)
  finish({data:N,error:null});await new Promise(r=>setTimeout(r,10));assert.deepEqual(effects,[])
  assert.equal(await withSchemaReadiness(input(),start),'started')
})
await test('timer-starving synchronous reply is refused by monotonic fence',async()=>{
  await assert.rejects(withSchemaReadiness({...input(),timeoutMs:5,readSchema:async()=>{
    const end=performance.now()+25;while(performance.now()<end){};return {data:N,error:null}
  }},start));assert.deepEqual(effects,[])
})
await test('manifest filesystem lookup distinguishes absent from present broken and never borrows fallback',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'fabric-schema-manifest-'))
  try{
    const first=join(dir,'first.json'),second=join(dir,'second.json')
    writeFileSync(second,JSON.stringify(fixture()))
    assert.equal(readBuildManifestCandidates([first,second]).ok,true)
    for(const bytes of ['null','{not-json',JSON.stringify({}),JSON.stringify(fixture({schemaMin:'64'}))]){
      writeFileSync(first,bytes);assert.equal(readBuildManifestCandidates([first,second]).ok,false)
      assert.notEqual(readBuildManifestCandidates([first,second]).why,'absent')
      let queries=0
      await assert.rejects(withSchemaReadiness({...input(),packaged:false,manifest:readBuildManifestCandidates([first,second]),
        readSchema:async()=>{queries++;return {data:N,error:null}}},start))
      assert.equal(queries,0);assert.deepEqual(effects,[])
    }
    assert.equal(readBuildManifestCandidates([join(dir,'absent')]).why,'absent')
    assert.equal(readBuildManifestCandidates([dir,second]).why,'unreadable')
  }finally{rmSync(dir,{recursive:true,force:true})}
})
await test('actual bootstrap places every domain effect behind composed guard and retry before domain point',async()=>{
  const source=readFileSync(new URL('../src/main/index.ts',import.meta.url),'utf8')
  const preparation=source.slice(source.indexOf('async function bootstrap()'),source.indexOf('async function bootstrapReady()'))
  assert.match(preparation,/return withSchemaReadiness\(/)
  assert.match(preparation,/readSchema: \(signal\) => db\.rpc\('schema_version'\)\.abortSignal\(signal\)/)
  assert.match(preparation, /}, bootstrapReady\)/)
  for(const forbidden of ['journal =','store =','identity =','pastRetryPoint = true','surface =','startTranscriptRecovery'])
    assert.ok(!preparation.includes(forbidden),forbidden)
  assert.match(source.slice(source.indexOf('async function bootstrapReady()')),/pastRetryPoint = true/)
})
console.log(`${count} schema-readiness scenarios PASS; no live database or Electron process used`)
