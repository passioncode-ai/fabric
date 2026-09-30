import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTranscriptStore } from '../src/main/transcripts.ts'
import { redact } from '../src/shared/redact.ts'
import { createTranscriptRecovery } from '../src/main/transcriptRecovery.ts'

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const stamp='2026-09-27T12:00:00.000Z'
const hash=body=>createHash('sha256').update(body).digest('hex')
const item=(session=3)=>({sessionId:id(session),context:{projectId:id(2),taskId:null,optionId:'claude-code',startedAt:stamp},meta:null,
  result:{state:'captured',record:{sha256:hash('hello\n'),bytes:6,lines:2,truncated:true,annotation:'exit unknown',excerpt:'hello\n',body:'hello\n'}}})
function receipt(args){const c=args.p_capture;return {recorded:true,repeated:false,estate_id:args.p_estate_id,project_id:args.p_project_id,
  session_id:args.p_session_id,command_id:args.p_command_id,receipt_seq:42,event_type:'transcript.captured@2',payload_digest:'a'.repeat(64),
  captured_at:'2026-09-27T12:01:00+00:00',...Object.fromEntries(['task_id','option_id','sha256','bytes','lines','truncated','capture_state','ending_provenance','started_at','ended_at','exit_code','annotation','excerpt'].map(k=>[k,c[k]]))}}
function fixture(items=[item()],custom={}) {
  const calls=[],settled=[],reports=[]
  const ports={estateId:id(1),recover:page=>{const eligible=items.filter(i=>!page.after||i.sessionId>page.after);const selected=eligible.slice(0,page.limit);return {state:'listed',items:selected,nextCursor:eligible.length>selected.length?selected.at(-1).sessionId:null,remaining:Math.max(0,eligible.length-selected.length)}},
    db:{rpc:async(name,args)=>{calls.push({name,args});return {data:receipt(args),error:null}}},
    settle:session=>settled.push(session),report:(session,reason)=>reports.push({session,reason}),...custom}
  return {run:createTranscriptRecovery(ports),ports,calls,settled,reports}
}
let passed=0
async function test(name,fn){await fn();passed++;console.log('ok   '+name)}
await test('unknown ending remains null; actual body and metadata match before settlement',async()=>{
  const f=fixture();const r=await f.run();assert.equal(r.recorded,1);assert.deepEqual(f.settled,[id(3)])
  assert.equal(f.calls[0].name,'recover_transcript');const c=f.calls[0].args.p_capture
  assert.equal(c.ended_at,null);assert.equal(c.exit_code,null);assert.equal(c.ending_provenance,'unknown');assert.equal(c.truncated,true)
  assert.equal(c.sha256,hash(c.body));assert.equal(Object.hasOwn(c,'captured_at'),false)
})
await test('sealed and genuinely empty captures preserve observed metadata',async()=>{
  for(const empty of [false,true]){
    const i=item();i.meta={optionId:'claude-code',startedAt:stamp,endedAt:'2026-09-27T12:02:00.000Z',exitCode:0}
    if(empty)i.result={state:'empty'}
    const f=fixture([i]);await f.run();const c=f.calls[0].args.p_capture
    assert.equal(c.ending_provenance,'observed');assert.equal(c.ended_at,i.meta.endedAt);assert.equal(c.exit_code,0)
    if(empty){assert.equal(c.body,'');assert.equal(c.sha256,hash(''));assert.equal(c.lines,0)}
    assert.equal(f.settled.length,1)
  }
})
await test('lost response retains source; retry sends identical command and bytes',async()=>{
  const calls=[];let fail=true
  const f=fixture(undefined,{db:{rpc:async(name,args)=>{calls.push(structuredClone(args));if(fail)throw Error('private backend text');return {data:{...receipt(args),repeated:true},error:null}}}})
  assert.equal((await f.run()).retained,1);assert.equal(f.settled.length,0)
  fail=false;assert.equal((await f.run()).recorded,1);assert.deepEqual(calls[0],calls[1]);assert.ok(!JSON.stringify(f.reports).includes('private'))
})
await test('foreign/mismatched/incomplete receipt never removes source',async()=>{
  for(const mutate of [r=>{r.estate_id=id(99)},r=>{r.project_id=id(99)},r=>{r.session_id=id(99)},r=>{r.command_id=id(99)},
    r=>{r.event_type='transcript.captured@1'},r=>{r.receipt_seq=0},r=>{r.sha256='b'.repeat(64)},r=>{r.truncated=false},
    r=>{r.task_id=id(99)},r=>{r.option_id='codex'},r=>{r.ended_at=stamp},r=>{r.capture_state='empty'},r=>{r.ending_provenance='observed'},
    r=>{r.captured_at='not-a-date'},r=>{r.started_at=null},r=>{delete r.payload_digest},r=>{r.annotation='different'},r=>{r.excerpt='different'},r=>{r.body='unrecognized field'}]){
    const f=fixture(undefined,{db:{rpc:async(_name,args)=>{const r=receipt(args);mutate(r);return {data:r,error:null}}}})
    assert.equal((await f.run()).retained,1);assert.equal(f.settled.length,0)
  }
})
await test('same-intent repeated canonical command may retain its original ID',async()=>{
  const f=fixture(undefined,{db:{rpc:async(_name,args)=>({data:{...receipt(args),repeated:true,command_id:id(80)},error:null})}})
  assert.equal((await f.run()).recorded,1);assert.equal(f.settled.length,1)
})
await test('invalid or incomplete source never makes an RPC',async()=>{
  for(const change of [i=>{i.context=null},i=>{i.sessionId='invalid'},i=>{i.context.startedAt='2026-02-31T12:00:00.000Z'},
    i=>{i.result={state:'unavailable',reason:'spool-missing'}},i=>{i.result={state:'empty'}},i=>{i.result.record.sha256='c'.repeat(64)},
    i=>{i.result.record.bytes=7},i=>{i.result.record.lines=1},i=>{i.result.record.truncated=false},
    i=>{i.meta={optionId:'claude-code',startedAt:stamp,endedAt:'',exitCode:null}}]){
    const i=item();change(i);const f=fixture([i]);assert.equal((await f.run()).retained,1);assert.equal(f.calls.length,0);assert.equal(f.settled.length,0)
  }
})
await test('overlapping invocations join; no concurrent duplicate RPC',async()=>{
  let release;const calls=[]
  const f=fixture(undefined,{db:{rpc:(_name,args)=>{calls.push(args);return new Promise(r=>{release=()=>r({data:receipt(args),error:null})})}}})
  const first=f.run(),second=f.run();assert.equal(first,second);await Promise.resolve();assert.equal(calls.length,1);release();await first;assert.equal(f.settled.length,1)
})
await test('cleanup error cannot revoke durable recording and retains retry source',async()=>{
  const f=fixture(undefined,{settle:()=>{throw Error('synthetic')}});const r=await f.run()
  assert.equal(r.recorded,1);assert.equal(r.retained,1);assert.equal(f.reports[0].reason,'capture_cleanup_pending')
})
await test('batch bounds RPCs; unavailable directory is distinct from empty history',async()=>{
  const f=fixture(Array.from({length:10},(_,i)=>item(i+3)));const r=await f.run();assert.equal(f.calls.length,8);assert.equal(r.remaining,2)
  const empty=fixture([]);assert.deepEqual(await empty.run(),{recorded:0,retained:0,remaining:0,availability:'listed'})
  for(const recover of [()=>({state:'unavailable',reason:'directory-unreadable',items:[]}),()=>{throw Error('synthetic')}]){
    const f=fixture([],{recover});assert.equal((await f.run()).availability,'unavailable');assert.equal(f.calls.length,0)
  }
})
await test('retained first page does not starve later valid capture',async()=>{
  const bad=Array.from({length:8},(_,i)=>({...item(i+3),result:{state:'unavailable',reason:'spool-unreadable'}}))
  const f=fixture([...bad,item(20)]);assert.equal((await f.run()).retained,8)
  assert.equal((await f.run()).recorded,1);assert.deepEqual(f.settled,[id(20)])
})
await test('hung RPC expires without late settlement; later retry keeps canonical identity',async()=>{
  let late;const calls=[]
  const f=fixture(undefined,{timeoutMs:10,db:{rpc:async(_name,args)=>{calls.push(args);return calls.length===1?await new Promise(resolve=>{late=()=>resolve({data:receipt(args),error:null})}):{data:{...receipt(args),repeated:true},error:null}}}})
  assert.equal((await f.run()).retained,1);assert.equal(f.settled.length,0);late();await Promise.resolve();assert.equal(f.settled.length,0)
  assert.equal((await f.run()).recorded,1);assert.deepEqual(calls[0],calls[1])
})
await test('corrupt sealed start never falls back to sidecar',async()=>{
  const i=item();i.meta={optionId:'claude-code',startedAt:'',endedAt:stamp,exitCode:0}
  const f=fixture([i]);assert.equal((await f.run()).retained,1);assert.equal(f.calls.length,0)
})
await test('expired synchronous RPC cannot beat deadline timer through microtasks',async()=>{
  const f=fixture(undefined,{timeoutMs:5,db:{rpc:(_name,args)=>{const until=performance.now()+25;while(performance.now()<until){};return Promise.resolve({data:receipt(args),error:null})}}})
  assert.equal((await f.run()).retained,1);assert.equal(f.settled.length,0);assert.equal(f.reports[0].reason,'capture_deadline')
})
await test('legacy recognizable credential is retained without sending or rewriting its identity',async()=>{
  const i=item();const body='API_TOKEN=private-test-credential\n';i.result.record={...i.result.record,body,excerpt:body,bytes:Buffer.byteLength(body),sha256:hash(body)}
  const f=fixture([i]);assert.equal((await f.run()).retained,1);assert.equal(f.calls.length,0);assert.equal(f.settled.length,0)
  assert.equal(i.result.record.body,body);assert.equal(f.reports[0].reason,'capture_privacy_review_required');assert.ok(!JSON.stringify(f.reports).includes('private-test'))
})
await test('actual clean spool with clipped redaction marker recovers unchanged; unrelated excerpts still refuse',async()=>{
  const root=mkdtempSync(join(tmpdir(),'fabric-recovery-marker-'))
  try {
    const store=createTranscriptStore({root}), i=item()
    store.open(i.sessionId,i.context)
    store.write(i.sessionId,'a'.repeat(1485)+' API_TOKEN=synthetic-private-fixture\n'+'b'.repeat(4000)+'\n')
    const final=store.finalize(i.sessionId,{optionId:'claude-code',startedAt:stamp,endedAt:'2026-09-27T12:02:00.000Z',exitCode:0})
    assert.equal(final.state,'captured');assert.equal(redact(final.record.body).text,final.record.body)
    assert.notEqual(redact(final.record.excerpt).text,final.record.excerpt)
    const recovered=createTranscriptStore({root}).recoverFinalizations().items
    const f=fixture(recovered);assert.equal((await f.run()).recorded,1)
    assert.deepEqual(f.calls[0].args.p_capture.excerpt,final.record.excerpt)
    assert.equal(f.calls[0].args.p_capture.sha256,final.record.sha256)
    for(const field of ['excerpt','annotation']){
      const forged=structuredClone(recovered);forged[0].result.record[field]='API_TOKEN=synthetic-unrelated-private'
      const rejected=fixture(forged);assert.equal((await rejected.run()).retained,1)
      assert.equal(rejected.calls.length,0);assert.equal(rejected.reports[0].reason,'capture_privacy_review_required')
    }
  } finally { rmSync(root,{recursive:true,force:true}) }
})
console.log(`${passed} transcript recovery boundary scenarios passed`)
