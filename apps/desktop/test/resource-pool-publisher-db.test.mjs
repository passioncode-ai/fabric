// #region resource-pool-publisher-db — docs: docs/execution/harness-waves/resource-pool-publisher.md#verification-and-remaining-boundaries
// Same owned PostgreSQL cluster as pending107/108. Production publisher + sampler;
// the service-role psql bridge is a transport fixture, not native PostgREST or host acceptance.
import assert from 'node:assert/strict'
import {createResourcePoolPublisher} from '../src/main/resourcePoolPublisher.ts'
import {readResourceHostPolicy,resourceDigest} from '../src/main/resourceHostPolicy.ts'
import {runPsqlAsync} from './bounded-psql.mjs'

const url=process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if(!url){console.error('NOT_RUN: use owned run-resource-reservation-db.mjs');process.exit(2)}
const parsed=new URL(url)
assert.match(parsed.pathname,/^\/fabric_dispatch_test_[a-z0-9_]+$/)
assert.ok(parsed.searchParams.get('host')?.startsWith('/'),'owned Unix-socket fixture only')
const q=value=>`'${String(value).replaceAll("'","''")}'`
const j=value=>`${q(JSON.stringify(value))}::jsonb`
async function sql(statement){
 const r=await runPsqlAsync('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],`set role service_role;\n${statement}`,{label:'resource pool publisher fixture',timeoutMs:10000})
 if(r.code!==0)throw Error(`resource pool publisher SQL failed: ${r.stderr}`)
 return r.stdout.trim()
}
const call=async statement=>JSON.parse(await sql(statement))
const columns='host_id,pool_id,policy_revision,configuration_generation,capacity,max_age_ms,observed,observed_at'
const axes=['workerSlots','memoryBytes','diskBytes','cpuMilliCores']
const vector=(slots=10)=>({workerSlots:slots,memoryBytes:1000,diskBytes:1000,cpuMilliCores:1000})
const config=pool=>({hostId:'publisher-fixture-host',poolId:pool,localPolicyRevision:'human-A',capacity:vector(),
 demandProfiles:{builder:vector(1),reviewer:vector(1),test:vector(1)},diskPath:'/publisher-fixture',diskDeviceId:'1',
 maxAgeMs:60000,sampleWindowMs:5,timeoutMs:10000})
const expectedVector={workerSlots:1,memoryBytes:300,diskBytes:200,cpuMilliCores:250}
const boundRevision=policy=>'policy-sha256-v1:'+resourceDigest(readResourceHostPolicy(policy,policy.hostId))
const argsFor=(name,args)=>{
 const types=name==='read_resource_pool' ? {p_host:'text',p_pool:'text'} : name==='configure_resource_pool'
  ? {p_host:'text',p_pool:'text',p_revision:'text',p_capacity:'jsonb',p_max_age_ms:'bigint',p_expected_revision:'text',p_expected_generation:'bigint'}
  : {p_host:'text',p_pool:'text',p_revision:'text',p_observed:'jsonb',p_at:'timestamptz',p_configuration_generation:'bigint'}
 assert.deepEqual(Object.keys(args).sort(),Object.keys(types).sort())
 return Object.entries(types).map(([key,type])=>{
  const v=args[key]
  if(type==='bigint'&&v!==null)assert.ok(Number.isSafeInteger(v))
  return `${key}=>${v===null?'null':type==='jsonb'?j(v):q(v)}::${type}`
 }).join(',')
}
function make(policy,options={}){
 const f={policy,writes:[],reads:0,wall:Date.now()-2000,mono:0,systemReads:0,afterRpc:null,sampleHook:null}
 const db={async rpc(name,args){
  assert.ok(['read_resource_pool','configure_resource_pool','observe_resource_pool'].includes(name))
  if(name==='read_resource_pool'){
   assert.deepEqual(args,{p_host:policy.hostId,p_pool:policy.poolId});f.reads++
   const data=await call(`select coalesce(read_resource_pool(${argsFor(name,args)}),'null'::jsonb)`)
   return {data,error:null}
  }
  f.writes.push({name,args:structuredClone(args)})
  // Database boolean is converted with to_json; psql's textual t/f is not PostgREST data.
  const data=await call(`select to_json(${name}(${argsFor(name,args)}))`)
  if(f.afterRpc)await f.afterRpc(name,args,data)
  return {data,error:null}
 }}
 const samplerDeps={identity:()=>({hostId:policy.hostId,bootId:'publisher-boot'}),now:()=>f.wall,monotonic:()=>f.mono,
  system:()=>{const n=f.systemReads++;return {totalMemory:1000,freeMemory:700,cpus:[{model:'fixture-cpu',times:{user:100+n*100,nice:0,sys:0,idle:300+n*300,irq:0}}]}},
  disk:()=>({path:policy.diskPath,deviceId:policy.diskDeviceId,blockSize:10n,blocks:100n,availableBlocks:80n}),
  workers:()=>({hostId:policy.hostId,bootId:'publisher-boot',poolId:policy.poolId,localPolicyRevision:policy.localPolicyRevision,atMs:f.wall,complete:true,workers:['owned-worker']}),
  pause:async ms=>{f.mono+=ms;f.wall+=ms;await f.sampleHook?.()}}
 f.publisher=createResourcePoolPublisher({db,rawPolicy:policy,trustedHostId:policy.hostId,samplerDeps,timeoutMs:30000,now:()=>f.wall,...options})
 assert.equal(f.publisher.bindingRevision,boundRevision(policy),'full validated policy identity must reach SQL')
 return Object.assign(f,{db,samplerDeps})
}
const read=policy=>call(`select to_jsonb(p) from resource_pools p where host_id=${q(policy.hostId)} and pool_id=${q(policy.poolId)}`)
const outcome=(r,state)=>{assert.equal(r.state,state,JSON.stringify(r));assert.equal(r.executionAuthorized,false);return r}

// Real production sampler numbers are written under service role and read back from actual SQL.
const positive=make(config('publisher-positive'))
assert.equal(outcome(await positive.publisher.configure(),'configured').generation,1)
assert.equal(positive.systemReads,0)
// Execute the actual service-only read RPC, with exact projection and both scope keys.
// service_role is trusted across pools; a foreign key must not fall back to another row.
const rpcRead=(host,pool)=>call(`select coalesce(read_resource_pool(${host===null?'null':q(host)},${pool===null?'null':q(pool)}),'null'::jsonb)`)
const firstRead=await rpcRead(positive.policy.hostId,positive.policy.poolId)
assert.deepEqual(Object.keys(firstRead).sort(),columns.split(',').sort())
assert.equal(firstRead.host_id,positive.policy.hostId);assert.equal(firstRead.pool_id,positive.policy.poolId)
assert.equal(firstRead.observed,null);assert.equal(firstRead.observed_at,null)
assert.equal(await sql("select has_function_privilege('service_role','read_resource_pool(text,text)','EXECUTE')"),'t')
for(const role of ['anon','authenticated']){
 assert.equal(await sql(`select has_function_privilege('${role}','read_resource_pool(text,text)','EXECUTE')`),'f')
 const denied=await runPsqlAsync('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],
  `set role ${role}; select read_resource_pool(${q(positive.policy.hostId)},${q(positive.policy.poolId)});`,
  {label:'resource pool read RPC role denial',timeoutMs:10000})
 assert.notEqual(denied.code,0,`${role} cannot execute the read RPC`)
 assert.match(denied.stderr,/permission denied for function read_resource_pool/)
}
for(const [host,pool] of [
 [null,positive.policy.poolId],[positive.policy.hostId,null],['',positive.policy.poolId],
 ['x'.repeat(129),positive.policy.poolId],[positive.policy.hostId,'x'.repeat(129)],
 ['bad/host',positive.policy.poolId],[positive.policy.hostId,'bad/pool'],
 ['publisher-foreign-host',positive.policy.poolId],[positive.policy.hostId,'publisher-missing-pool']
])assert.equal(await rpcRead(host,pool),null,'invalid or missing exact scope cannot return another pool')
const decoyPolicy={...config(positive.policy.poolId),hostId:'publisher-decoy-host'},decoy=make(decoyPolicy)
outcome(await decoy.publisher.configure(),'configured')
const decoyRow=await rpcRead(decoyPolicy.hostId,decoyPolicy.poolId)
assert.equal(decoyRow.host_id,decoyPolicy.hostId)
assert.deepEqual(await rpcRead(positive.policy.hostId,positive.policy.poolId),firstRead,'same pool on another host cannot replace exact read')
assert.equal(await rpcRead(decoyPolicy.hostId,'publisher-missing-pool'),null)
assert.deepEqual(await read(positive.policy),firstRead,'read RPC has no configuration or observation effect')

assert.equal((await read(positive.policy)).observed,null,'configuration never fabricates observation')
const firstPublication=await positive.publisher.publish()
if(firstPublication.state!=='published') console.error(JSON.stringify({diagnostic:'positive publication',result:firstPublication,writes:positive.writes,row:await read(positive.policy)},null,2))
const publication=outcome(firstPublication,'published')
assert.match(publication.snapshotId,/^[a-f0-9]{64}$/)
const stored=await read(positive.policy)
assert.equal(stored.configuration_generation,1);assert.equal(stored.policy_revision,positive.publisher.bindingRevision)
assert.deepEqual(stored.observed,expectedVector)
assert.equal(Date.parse(stored.observed_at),positive.writes[1].args.p_at?Date.parse(positive.writes[1].args.p_at):NaN)
assert.equal(stored.policy_revision===positive.policy.localPolicyRevision,false,'human label alone is not full-policy SQL identity')
assert.equal(positive.systemReads,2)
for(const axis of axes)assert.equal(stored.observed[axis],expectedVector[axis])
const beforeRetry=await read(positive.policy),retryWrites=positive.writes.length
outcome(await positive.publisher.configure(),'configured')
assert.deepEqual(await read(positive.policy),beforeRetry);assert.equal(positive.writes.length,retryWrites)

// Actual SQL commits; only the transport reply is lost. Recovery reads the exact intent;
// repeated operation is forbidden and no second write occurs during reconciliation.
for(const method of ['configure','publish']){
 const f=make(config('publisher-lost-'+method))
 if(method==='publish')outcome(await f.publisher.configure(),'configured')
 const writesBefore=f.writes.length
 f.afterRpc=async(name,_args,data)=>{
  assert.equal(data,true);assert.equal(name,method==='configure'?'configure_resource_pool':'observe_resource_pool')
  f.afterRpc=null;throw Error('synthetic lost SQL reply after commit')
 }
 outcome(await f.publisher[method](),'unknown')
 assert.equal(f.writes.length,writesBefore+1)
 const committed=await read(f.policy)
 assert.equal(committed.configuration_generation,1)
 if(method==='publish')assert.deepEqual(committed.observed,expectedVector)
 const again=await f.publisher[method]()
 assert.equal(again.reason,'reconcile_required');assert.equal(f.writes.length,writesBefore+1)
 outcome(await f.publisher.reconcile(),method==='configure'?'configured':'published')
 assert.deepEqual(await read(f.policy),committed);assert.equal(f.writes.length,writesBefore+1)
}

// SQL generation survives independent publishers and actual A1 -> B2 -> A3 transitions.
const aPolicy=config('publisher-aba'),bPolicy={...aPolicy,localPolicyRevision:'human-B'}
const a=make(aPolicy),b=make(bPolicy)
outcome(await a.publisher.configure(),'configured')
for(const expected of [undefined,{revision:a.publisher.bindingRevision,generation:2},{revision:'foreign',generation:1}])
 outcome(await b.publisher.configure(expected),'refused')
assert.equal(b.writes.length,0)
assert.equal(outcome(await b.publisher.configure({revision:a.publisher.bindingRevision,generation:1}),'configured').generation,2)
const aFresh=make(aPolicy)
assert.equal(outcome(await aFresh.publisher.configure({revision:b.publisher.bindingRevision,generation:2}),'configured').generation,3)
const abaRow=await read(aPolicy)
assert.equal(abaRow.policy_revision,a.publisher.bindingRevision);assert.equal(abaRow.configuration_generation,3)
assert.equal((await a.publisher.publish()).reason,'generation_changed')
assert.equal((await a.publisher.configure()).reason,'generation_changed')
assert.equal(a.writes.length,1,'stale publisher never refreshes its generation automatically')
const staleObserve={p_host:aPolicy.hostId,p_pool:aPolicy.poolId,p_revision:a.publisher.bindingRevision,
 p_observed:expectedVector,p_at:new Date(Date.now()-1000).toISOString(),p_configuration_generation:1}
assert.equal((await a.db.rpc('observe_resource_pool',staleObserve)).data,false,'actual SQL refuses ABA stale sampler')
assert.deepEqual(await read(aPolicy),abaRow)
outcome(await aFresh.publisher.publish(),'published')

// Same human label and SQL capacity/max-age projection, different complete policy.
// These writers must not silently attach to one another's policy row.
for(const field of ['demand-profile','disk-path','disk-device','sample-window','sampler-timeout']){
 const policy=config('publisher-full-'+field),first=make(policy)
 outcome(await first.publisher.configure(),'configured')
 const other=structuredClone(policy)
 if(field==='demand-profile')other.demandProfiles.builder.memoryBytes--
 if(field==='disk-path')other.diskPath='/other-publisher-fixture'
 if(field==='disk-device')other.diskDeviceId='2'
 if(field==='sample-window')other.sampleWindowMs++
 if(field==='sampler-timeout')other.timeoutMs++
 const second=make(other)
 assert.notEqual(second.publisher.bindingRevision,first.publisher.bindingRevision)
 assert.equal(other.localPolicyRevision,policy.localPolicyRevision);assert.deepEqual(other.capacity,policy.capacity)
 outcome(await second.publisher.configure(),'refused');assert.equal(second.writes.length,0)
 assert.equal((await read(policy)).configuration_generation,1)
 assert.equal(outcome(await second.publisher.configure({revision:first.publisher.bindingRevision,generation:1}),'configured').generation,2)
 assert.equal((await first.publisher.publish()).reason,'generation_changed')
}

// A lost observation followed by real configuration ABA cannot reconcile against
// identical vector/time at a different generation, even though human labels repeat.
const uncertainPolicy=config('publisher-uncertain-aba'),uncertain=make(uncertainPolicy)
outcome(await uncertain.publisher.configure(),'configured')
uncertain.afterRpc=async(_name,_args,data)=>{assert.equal(data,true);uncertain.afterRpc=null;throw Error('lost observation reply')}
outcome(await uncertain.publisher.publish(),'unknown')
const oldObservation=await read(uncertainPolicy)
const middle=make({...uncertainPolicy,localPolicyRevision:'middle'})
outcome(await middle.publisher.configure({revision:uncertain.publisher.bindingRevision,generation:1}),'configured')
const final=make(uncertainPolicy)
outcome(await final.publisher.configure({revision:middle.publisher.bindingRevision,generation:2}),'configured')
assert.equal((await final.db.rpc('observe_resource_pool',{p_host:uncertainPolicy.hostId,p_pool:uncertainPolicy.poolId,
 p_revision:final.publisher.bindingRevision,p_observed:oldObservation.observed,p_at:oldObservation.observed_at,p_configuration_generation:3})).data,true)
const writeCount=uncertain.writes.length
assert.equal((await uncertain.publisher.reconcile()).reason,'write_superseded_or_unobserved')
assert.equal(uncertain.writes.length,writeCount)
assert.equal((await read(uncertainPolicy)).configuration_generation,3)

console.log('PASS production resource pool publisher with actual pending107 SQL: service-only bounded read RPC, full-policy binding, CAS generation, measured sampler/readback, exact retry, lost reply reconciliation, ABA refusal; service-role psql transport fixture only')
// #endregion resource-pool-publisher-db
