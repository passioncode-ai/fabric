import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
const repoRoot=resolve(process.env.FABRIC_REVIEW_ROOT||process.cwd())
const testRoot=pathToFileURL(repoRoot+'/apps/desktop/test/run-resource-reservation-db.mjs')
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
const {runPsqlAsync}=await import(new URL('./bounded-psql.mjs',testRoot))
const url=process.env.FABRIC_DISPATCH_TEST_DATABASE_URL;assert.match(new URL(url).pathname,/^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql=s=>execFileSync('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim()
const q=x=>"'"+String(x).replaceAll("'","''")+"'",j=x=>q(JSON.stringify(x))+'::jsonb',v=(slots=1,memory=1,disk=1,cpu=1)=>({workerSlots:slots,memoryBytes:memory,diskBytes:disk,cpuMilliCores:cpu}),zero=v(0,0,0,0)
const uuid=n=>`73000000-0000-4000-8000-${String(n).padStart(12,'0')}`,E=uuid(1),E2=uuid(2),P=uuid(3),P2=uuid(4),actor={kind:'system',id:'independent-resource-review'};let serial=20
for(const [e,p]of [[E,P],[E2,P2]])sql(`select append_event('${e}','project.created@1',${j(actor)},${j({id:p,name:'Independent fixture'})},'1','${p}')`)
function task(estate=E){const taskId=uuid(serial++),session=uuid(serial++),n=serial;sql(`select append_event('${estate}','task.created@1',${j(actor)},${j({id:taskId,title:'Independent',instruction:'No external work',option_id:'claude-code',preset:'guided',preset_edited:true,origin:{kind:'operator',ref:'fixture'}})},'1','${estate===E?P:P2}')`);return{estate,taskId,session,binding:{reservationId:'independent-res-'+n,attemptId:'attempt-'+n,fence:1,ownerId:'owner',role:'test',inputDigest:'a'.repeat(64),scopeDigest:'b'.repeat(64),localPolicyRevision:'revision'}}}
function pool(name,capacity=v(4,100,100,100)){assert.equal(sql(`set role service_role;select configure_resource_pool('independent',${q(name)},'revision',${j(capacity)},60000);reset role`),'t');assert.equal(sql(`select observe_resource_pool('independent',${q(name)},'revision',${j(zero)},clock_timestamp())`),'t')}
const stmt=(t,p,d=v(),own=v(),parent=null,binding=j(t.binding))=>`select admit_resource_task_launch('${t.estate}','${t.taskId}',${j(actor)},'${t.session}','independent',${q(p)},${binding},${j(d)},${j(own)},${parent?q(parent):'null'})`
const call=s=>JSON.parse(sql(s)),admit=(...a)=>call(stmt(...a))
const asyncSql=s=>runPsqlAsync('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],s).then(r=>{assert.equal(r.code,0,r.stderr);return JSON.parse(r.stdout)})
const cancel=(t,r,fence='1')=>call(`select cancel_resource_admission('${t.estate}',${q(t.binding.reservationId)},'${r.task_run_id}','${t.session}',${q(fence)})`)
const out=[]
pool('atomic');const rolled=task();const admitted=call(`begin;${stmt(rolled,'atomic')};rollback;`);assert.equal(admitted.admitted,true);assert.equal(sql(`select count(*) from resource_reservations where reservation_id=${q(rolled.binding.reservationId)}`),'0');assert.equal(sql(`select count(*) from task_runs where task_id='${rolled.taskId}'`),'0');out.push('transaction rollback conserves reservation/run authority')
pool('id-a');pool('id-b');const ta=task(),tb=task(E2);tb.binding.reservationId=ta.binding.reservationId
const sameId=await Promise.all([asyncSql(stmt(ta,'id-a')),asyncSql(stmt(tb,'id-b'))]);assert.equal(sameId.filter(x=>x.admitted).length,1);assert.equal(sameId.find(x=>!x.admitted).reason_code,'resource_identity_conflict');out.push('cross-estate global reservation identity admits once')
const sa=task(),sb=task(E2);sb.session=sa.session;const sameSession=await Promise.all([asyncSql(stmt(sa,'id-a')),asyncSql(stmt(sb,'id-b'))]);assert.equal(sameSession.filter(x=>x.admitted).length,1);assert.equal(sameSession.find(x=>!x.admitted).reason_code,'resource_identity_conflict');out.push('cross-estate global session identity admits once')
pool('identity');const bound=task(),br=admit(bound,'identity');assert.equal(br.admitted,true)
for(const key of ['reservationId','attemptId','ownerId','role','inputDigest','scopeDigest','localPolicyRevision','fence']){const changed={...bound,binding:{...bound.binding,[key]:key==='fence'?2:key==='role'?'builder':key.endsWith('Digest')?'c'.repeat(64):'different'}};assert.equal(admit(changed,'identity').admitted,false,key)}
for(const badEstate of [E2,uuid(999)])assert.equal(call(`select cancel_resource_admission('${badEstate}',${q(bound.binding.reservationId)},'${br.task_run_id}','${bound.session}','1')`).released,false)
assert.equal(call(`select begin_task_run_launch('${E}','${br.task_run_id}','${uuid(998)}',${j(actor)})`).granted,false);out.push('all8 binding changes, estate and session mismatches refuse')
pool('nested',v(4,100,100,100));const parent=task(),pr=admit(parent,'nested',v(4,100,100,100));assert.equal(pr.admitted,true)
const child=task();child.binding.ownerId='other';assert.equal(admit(child,'nested',v(),v(),parent.binding.reservationId).reason_code,'resource_parent_invalid')
assert.equal(cancel(parent,pr).released,true);assert.equal(admit(task(),'nested',v(),v(),parent.binding.reservationId).reason_code,'resource_parent_invalid');out.push('foreign-owner and released-parent nesting refuse')
pool('safe',v(2,9007199254740991,100,100));const big=task(),bigR=admit(big,'safe',v(1,9007199254740991));assert.equal(bigR.admitted,true);assert.equal(admit(task(),'safe',v(1,1)).reason_code,'resource_capacity');assert.equal(cancel(big,bigR).released,true);out.push('numeric safe maximum plus one refuses without overflow')
const stamp='2026-01-01T00:00:00Z';pool('observation');assert.equal(sql(`select observe_resource_pool('independent','observation','revision',${j(zero)},${q(stamp)}::timestamptz)`),'f');sql(`update resource_pools set observed=null,observed_at=null where host_id='independent' and pool_id='observation'`)
assert.equal(sql(`select observe_resource_pool('independent','observation','revision',${j(zero)},${q(stamp)}::timestamptz)`),'t');assert.equal(sql(`select observe_resource_pool('independent','observation','revision',${j(v())},${q(stamp)}::timestamptz)`),'f');assert.equal(admit(task(),'observation').reason_code,'resource_reading_unknown');out.push('old/equal-changing/stale observations cannot manufacture fresh capacity')
// Noncanonical numeric representation accepted by JSONB has an observable release spelling boundary.
pool('decimal-fence');const decimal=task(),binding=q(JSON.stringify(decimal.binding).replace('"fence":1','"fence":1.0'))+'::jsonb';const dr=call(stmt(decimal,'decimal-fence',v(),v(),null,binding));assert.equal(dr.admitted,true)
const numericRelease=cancel(decimal,dr,'1'),literalRelease=cancel(decimal,dr,'1.0');out.push({case:'decimal-fence',canonicalNumber:numericRelease,literalSpelling:literalRelease})
console.log(JSON.stringify({checks:out,scope:'owned PostgreSQL only; real pending production functions; no active migration/native/provider acceptance'},null,2))
