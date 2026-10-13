// #region resource-pool-accounting-db — docs: docs/execution/harness-waves/resource-pool-accounting.md#verification
// Owned PostgreSQL fixture only. RPC calls use service_role; explicitly labelled
// owner mutations below manufacture corruption/race boundaries, not admission proof.
import assert from 'node:assert/strict'
import {createResourcePoolAccountingReader} from '../src/main/resourcePoolAccounting.ts'
import {readResourceHostPolicy,resourceDigest} from '../src/main/resourceHostPolicy.ts'
import {runPsqlAsync} from './bounded-psql.mjs'
const url=process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if(!url){console.error('NOT_RUN: owned run-resource-reservation-db.mjs only');process.exit(2)}
const u=new URL(url);assert.match(u.pathname,/^\/fabric_dispatch_test_[a-z0-9_]+$/);assert.ok(u.searchParams.get('host')?.startsWith('/'))
const q=x=>`'${String(x).replaceAll("'","''")}'`,j=x=>`${q(JSON.stringify(x))}::jsonb`
async function sql(text,role='service_role'){
 const r=await runPsqlAsync('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],`${role?`set role ${role};`:''}\n${text}`,{label:'resource accounting fixture',timeoutMs:10000})
 if(r.code)throw Error(`accounting fixture SQL failed: ${r.stderr}`);return r.stdout.trim()
}
const call=async(text,role)=>JSON.parse(await sql(text,role))
const v=(n=0)=>({workerSlots:n,memoryBytes:n,diskBytes:n,cpuMilliCores:n})
const policy={hostId:'accounting-host',poolId:'accounting-pool',localPolicyRevision:'human',capacity:v(100),demandProfiles:{builder:v(1),reviewer:v(1),test:v(1)},diskPath:'/fixture',diskDeviceId:'1',maxAgeMs:60000,sampleWindowMs:5,timeoutMs:100}
const rev=`policy-sha256-v1:${resourceDigest(readResourceHostPolicy(policy,policy.hostId))}`
const rpcArgs={p_host:policy.hostId,p_pool:policy.poolId,p_revision:rev,p_configuration_generation:1,p_max_roots:10}
const raw=async(args={})=>{const a={...rpcArgs,...args};return call(`select read_resource_pool_accounting(${a.p_host===null?'null':q(a.p_host)},${a.p_pool===null?'null':q(a.p_pool)},${a.p_revision===null?'null':q(a.p_revision)},${a.p_configuration_generation??'null'},${a.p_max_roots??'null'})`)}
const db={async rpc(name,args){assert.equal(name,'read_resource_pool_accounting');assert.deepEqual(Object.keys(args).sort(),Object.keys(rpcArgs).sort());return {data:await raw(args),error:null}}}
const reader=createResourcePoolAccountingReader({db,rawPolicy:policy,trustedHostId:policy.hostId,expectedGeneration:1,maxRoots:10,timeoutMs:10000})
assert.equal((await raw()).reason,'pool_missing')
assert.equal(await sql(`select configure_resource_pool(${q(policy.hostId)},${q(policy.poolId)},${q(rev)},${j(policy.capacity)},60000)`),'t')
assert.equal((await raw()).reason,'observation_missing')
assert.equal(await sql(`select observe_resource_pool(${q(policy.hostId)},${q(policy.poolId)},${q(rev)},${j(v(1))},clock_timestamp(),1)`),'t')
let actual=await reader.read();assert.equal(actual.state,'observed',JSON.stringify(actual));assert.deepEqual(actual.snapshot.reserved,v());assert.equal(actual.snapshot.rootCount,0);assert.equal(actual.executionAuthorized,false)
// Produce roots in two Estates and a nested allocation through real admission.
const uuid=n=>`79000000-0027-4000-8000-${String(n).padStart(12,'0')}`
const estates=[uuid(1),uuid(2)],projects=[uuid(3),uuid(4)],actor={kind:'system',id:'accounting-fixture'}
for(let i=0;i<2;i++)await sql(`select append_event('${estates[i]}','project.created@1',${j(actor)},${j({id:projects[i],name:'Accounting fixture'})},'1','${projects[i]}')`)
let seq=20
async function task(estateIndex=0){const id=uuid(seq++),session=uuid(seq++),binding={reservationId:`accounting-${seq}`,attemptId:`accounting-attempt-${seq}`,fence:1,ownerId:'accounting-owner',role:'builder',inputDigest:'a'.repeat(64),scopeDigest:'b'.repeat(64),localPolicyRevision:rev}
 await sql(`select append_event('${estates[estateIndex]}','task.created@1',${j(actor)},${j({id,title:'Accounting',instruction:'Fixture',option_id:'claude-code',preset:'guided',preset_edited:true,origin:{kind:'operator',ref:'fixture'}})},'1','${projects[estateIndex]}')`)
 return {estate:estates[estateIndex],id,session,binding}}
async function admit(t,demand,own=demand,parent=null){const r=await call(`select admit_resource_task_launch('${t.estate}','${t.id}',${j(actor)},'${t.session}',${q(policy.hostId)},${q(policy.poolId)},${j(t.binding)},${j(demand)},${j(own)},${parent?q(parent):'null'})`);assert.equal(r.admitted,true,JSON.stringify(r));return r}
async function cancel(t,r){const result=await call(`select cancel_resource_admission('${t.estate}',${q(t.binding.reservationId)},'${r.task_run_id}','${t.session}','1')`);assert.equal(result.released,true,JSON.stringify(result))}
const parent=await task(),parentRun=await admit(parent,v(2),v(1)),child=await task(),childRun=await admit(child,v(1),v(1),parent.binding.reservationId)
const other=await task(1),otherRun=await admit(other,v(3))
actual=await reader.read();assert.equal(actual.state,'observed',JSON.stringify(actual));assert.deepEqual(actual.snapshot.reserved,v(5));assert.equal(actual.snapshot.rootCount,2)
assert.equal((await raw({p_max_roots:1})).reason,'root_bound_exceeded')
await cancel(child,childRun);assert.deepEqual((await reader.read()).snapshot.reserved,v(5),'child release leaves allocated parent envelope charged once')
await cancel(parent,parentRun);assert.deepEqual((await reader.read()).snapshot.reserved,v(3),'released root excluded')
await cancel(other,otherRun);assert.equal((await reader.read()).snapshot.rootCount,0)
for(const args of [{p_host:null},{p_pool:null},{p_revision:null},{p_configuration_generation:null},{p_max_roots:null},{p_max_roots:0},{p_max_roots:1025},{p_host:'bad/host'}])assert.equal((await raw(args)).reason,'invalid_request')
assert.equal((await raw({p_configuration_generation:2})).reason,'policy_changed');assert.equal((await raw({p_revision:'human'})).reason,'policy_changed')
assert.equal((await raw({p_host:'foreign'})).reason,'pool_missing')
// Precision is floored by SQL, independent of PostgreSQL session time zone.
await sql(`update resource_pools set observed_at=date_trunc('milliseconds',clock_timestamp()-interval '2 seconds')+interval '999 microseconds' where host_id=${q(policy.hostId)} and pool_id=${q(policy.poolId)}`,'')
const precision=await raw();const storedFloor=Number(await sql(`select floor(extract(epoch from observed_at)*1000) from resource_pools where host_id=${q(policy.hostId)} and pool_id=${q(policy.poolId)}`))
assert.equal(precision.observedAtMs,storedFloor);assert.ok(Number.isSafeInteger(precision.observedAtMs));assert.equal((await reader.read()).state,'observed')
await sql(`update resource_pools set observed_at=clock_timestamp()-interval '2 minutes' where host_id=${q(policy.hostId)} and pool_id=${q(policy.poolId)}`,'');assert.equal((await raw()).reason,'observation_stale')
await sql(`update resource_pools set observed_at=clock_timestamp()+interval '1 minute' where host_id=${q(policy.hostId)} and pool_id=${q(policy.poolId)}`,'');assert.equal((await raw()).reason,'observation_stale')
await sql(`update resource_pools set observed_at=clock_timestamp(),observed=${j(v(101))} where host_id=${q(policy.hostId)} and pool_id=${q(policy.poolId)}`,'');assert.equal((await raw()).reason,'capacity_exceeded')
// Owner-only corruption fixture: accepted admission cannot normally overfill.
// Restore two released root rows as held to exercise numeric SUM beyond bigint-safe JS export.
await sql(`update resource_pools set observed=${j(v())},capacity=${j(v(Number.MAX_SAFE_INTEGER))} where host_id=${q(policy.hostId)} and pool_id=${q(policy.poolId)};
 update resource_reservations set state='held',released_seq=null,demand=${j(v(Number.MAX_SAFE_INTEGER))} where reservation_id in (${q(parent.binding.reservationId)},${q(other.binding.reservationId)})`,'')
assert.equal((await raw()).reason,'reserved_overflow')
// Atomic owner transaction toggles two valid aggregate states. A coherent read can
// observe either pair, never an observed-vector/root-demand mixture across commits.
await sql(`update resource_pools set capacity=${j(policy.capacity)},observed=${j(v(1))},observed_at=clock_timestamp() where host_id=${q(policy.hostId)} and pool_id=${q(policy.poolId)};
 update resource_reservations set demand=${j(v(2))} where reservation_id=${q(parent.binding.reservationId)};
 update resource_reservations set state='released',released_seq=1 where reservation_id=${q(other.binding.reservationId)}`,'')
const writer=sql(`begin;
 update resource_pools set observed=${j(v(3))} where host_id=${q(policy.hostId)} and pool_id=${q(policy.poolId)};
 select pg_sleep(0.05);
 update resource_reservations set demand=${j(v(4))} where reservation_id=${q(parent.binding.reservationId)};
 commit;`,'')
const concurrent=[];for(let i=0;i<8;i++)concurrent.push(await raw());await writer;concurrent.push(await raw())
for(const during of concurrent)assert.ok([[1,2],[3,4]].some(([o,r])=>during.observed.workerSlots===o&&during.reserved.workerSlots===r),JSON.stringify(during))
// Both client roles must be denied by PostgreSQL, not just hidden by a TS wrapper.
const signature='read_resource_pool_accounting(text,text,text,bigint,bigint)'
assert.equal(await sql(`select has_function_privilege('service_role',${q(signature)},'EXECUTE')`),'t')
for(const role of ['anon','authenticated']){
 assert.equal(await sql(`select has_function_privilege('${role}',${q(signature)},'EXECUTE')`),'f')
 const denied=await runPsqlAsync('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],`set role ${role};select read_resource_pool_accounting('accounting-host','accounting-pool',${q(rev)},1,10);`,{label:'accounting role denial',timeoutMs:10000})
 assert.notEqual(denied.code,0);assert.match(denied.stderr,/permission denied for function read_resource_pool_accounting/)
}
console.log('PASS resource accounting: real admissions, nested/released/root bound, safe numeric sums, epoch floor, coherent snapshot, exact scope and actual role denials')
// #endregion resource-pool-accounting-db
