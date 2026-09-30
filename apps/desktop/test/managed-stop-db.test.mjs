// Trusted-host SQL contract, not proof of native process containment.
import assert from 'node:assert/strict'
import {execFileSync,spawn} from 'node:child_process'
const url=process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if(!url) {console.error('NOT_RUN: use run-managed-stop-db.mjs');process.exit(2)}
assert.match(new URL(url).pathname,/^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql=input=>execFileSync('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8'}).trim()
assert.equal(sql("select count(*) from supabase_migrations.schema_migrations where version='20260927000062'"),'1')
const parallel=input=>new Promise((resolve,reject)=>{const p=spawn('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1']);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('close',c=>c?reject(Error(err)):resolve(JSON.parse(out)));p.stdin.end(input)})
const uuid=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const E=uuid(1),P=uuid(2),actor=`'{"kind":"system","id":"owned-host-fixture"}'`;let n=10
const call=q=>JSON.parse(sql(q))
sql(`select append_event('${E}','project.created@1',${actor},'{"id":"${P}","name":"Stop fixture"}','1','${P}')`)
function run(bind=true) {
 const task=uuid(n++),session=uuid(n++),command=uuid(n++)
 sql(`select append_event('${E}','task.created@1',${actor},'{"id":"${task}","title":"Work"}','1','${P}')`)
 const {task_run_id:id}=call(`select admit_task_launch('${E}','${task}',${actor},'${session}')`)
 assert.ok(id);assert.equal(call(`select begin_task_run_launch('${E}','${id}','${session}',${actor})`).granted,true)
 if(bind) assert.equal(call(`select bind_task_run('${E}','${id}','${session}',${actor})`).bound,true)
 return {task,session,command,id}
}
const requestSQL=(r,command=r.command,a=actor,authority='')=>`select request_task_run_stop('${E}','${r.id}','${r.session}','${command}',${a}${authority})`
const request=(...args)=>call(requestSQL(...args))
const state=r=>sql(`select state from task_runs where task_run_id='${r.id}'`)
const owner=r=>sql(`select owner_session from leases where work_id='${r.task}'`)
const closed=(r,a=actor)=>sql(`select append_event('${E}','terminal.closed@1',${a},'{"session_id":"${r.session}","exit_code":0}','1','${P}')`)
const evidence={rootExited:true,processTreeQuiescent:true,providerQuiescent:true,authorityRevoked:true,transcriptCommitted:true,
 hostInstanceId:'host-fixture',bootId:'boot-fixture',processIdentityRef:'process:fixture',providerObservationRef:'provider:fixture',
 authorityRevocationRef:'revoke:fixture',transcriptRef:'sha256:fixture',outcome:'cancelled'}
const observeSQL=(r,patch={},command=r.command)=>`select record_task_run_stop_observation('${E}','${r.id}','${r.session}','${command}','${JSON.stringify({...evidence,...patch})}')`
const observe=(...args)=>call(observeSQL(...args))
const admitAgain=r=>call(`select admit_task_launch('${E}','${r.task}',${actor},'${uuid(n++)}')`)
function accept(r) {
 const D=uuid(n++),C=uuid(n++),digest='d'.repeat(32)
 for(const action of ['claim','begin','written']) call(`select continuation_dispatch('${E}',${actor},'${D}','${r.task}','${r.id}','${r.session}','${digest}','${C}','${action}')`)
 assert.equal(call(`select acknowledge_delivery('${E}','${r.session}','${D}','${digest}')`).accepted,true)
 assert.equal(sql(`select status from project_tasks where id='${r.task}'`),'running')
}
// Stop won the race after begin but before OS spawn. Only trusted exact host
// attestation compensates this path; there is deliberately no PTY exit receipt.
const unspawned=run(false)
assert.equal(request(unspawned).reason,'operator_stop')
assert.equal(call(`select validate_task_run_launch('${E}','${unspawned.id}','${unspawned.session}',${actor})`).valid,false)
const fail=(r,a=actor)=>call(`select fail_task_launch('${E}','${r.id}','${r.session}',${a},false)`)
assert.equal(fail(unspawned,`'{"kind":"agent","id":"${unspawned.session}"}'`).reason_code,'untrusted_actor')
assert.equal(fail(unspawned).compensated,true)
assert.equal(fail(unspawned).repeated,true)
const unspawnedStop=request(unspawned)
assert.equal(unspawnedStop.receipt_seq,Number(sql(`select verified_seq from run_stop_commands where command_id='${unspawned.command}'`)),'repeat returns the proof sequence, not the request sequence');
assert.equal(unspawnedStop.state,'stopped');assert.equal(unspawnedStop.basis,'never_spawned')
assert.equal(unspawnedStop.outcome,'failed_known');assert.equal(unspawnedStop.reason,'operator_stop')
assert.equal(observe(unspawned).basis,'never_spawned','later observer cannot manufacture process evidence')
assert.equal(state(unspawned),'ended');assert.equal(owner(unspawned),'')
assert.equal(sql(`select count(*) from journal where type in ('terminal.opened@1','terminal.closed@1') and payload->>'session_id'='${unspawned.session}'`),'0')
assert.equal(sql(`select count(*) from journal where type='run.ended@1' and run_id='${unspawned.id}'`),'1')
assert.equal(sql(`select count(*) from journal where type='run.stop_observed@1' and run_id='${unspawned.id}'`),'1')
const compensationSnapshot=sql(`select row_to_json(s) from run_stop_commands s where command_id='${unspawned.command}'`)
sql(`select rebuild_estate_projections('${E}')`)
assert.equal(owner(unspawned),'');assert.equal(state(unspawned),'ended')
assert.equal(sql(`select row_to_json(s) from run_stop_commands s where command_id='${unspawned.command}'`),compensationSnapshot)
assert.equal(admitAgain(unspawned).admitted,true)
assert.equal(request(unspawned).basis,'never_spawned','old compensated receipt survives newer generation')
for(const kind of ['bound','opened','closed','process_started','process_after_stop']) {
 const started=run(kind==='bound')
 if(kind==='opened') sql(`select append_event('${E}','terminal.opened@1',${actor},'{"session_id":"${started.session}"}','1','${P}')`)
 if(kind==='closed') closed(started)
 if(kind==='process_started') call(`select fail_task_launch('${E}','${started.id}','${started.session}',${actor},true)`)
 request(started)
 if(kind==='process_after_stop') call(`select fail_task_launch('${E}','${started.id}','${started.session}',${actor},true)`)
 assert.equal(fail(started).reason_code,'process_evidence',kind+' cannot be relabelled never-spawned')
 assert.equal(owner(started),started.session)
}
// A later exit callback cannot replace the first durable Stop intent.
for(const [reason,outcome] of [['operator_stop','cancelled'],['app_shutdown','cancelled'],['launch_failure','failed_known'],['natural_exit','completed']]) {
 const intent=run()
 const first=request(intent,intent.command,actor,`, null, null, '${reason}'`)
 const retry=request(intent,uuid(n++),actor,`, null, null, 'natural_exit'`)
 assert.equal(retry.command_id,first.command_id);assert.equal(retry.reason,reason)
 closed(intent)
 const receipt=observe(intent,{outcome:'completed'})
 assert.equal(receipt.outcome,outcome);assert.equal(receipt.reason,reason);assert.equal(receipt.basis,'observed')
 assert.equal(sql(`select outcome from task_runs where task_run_id='${intent.id}'`),outcome)
}
// Concurrent stop intents return one canonical command; no duplicate signal permission.
const a=run(),other=uuid(n++);accept(a)
const requests=await Promise.all([parallel(requestSQL(a)),parallel(requestSQL(a,other))])
assert.equal(requests.filter(x=>!x.repeated).length,1)
a.command=requests[0].command_id;assert.equal(requests[1].command_id,a.command)
assert.equal(state(a),'ending');assert.equal(owner(a),a.session)
assert.equal(sql(`select count(*) from journal where type='run.stop_requested@1' and run_id='${a.id}'`),'1')
assert.equal(admitAgain(a).reason_code,'run_unresolved')
assert.equal(call(`select begin_task_run_launch('${E}','${a.id}','${a.session}',${actor})`).granted,false)
assert.equal(observe(a,{credential:'not-real-secret'}).state,'outcome_unknown','typed booleans alone cannot invent terminal exit')
assert.equal(sql(`select observation ? 'credential' from run_stop_commands where command_id='${a.command}'`),'f','extra raw fields are not persisted')
assert.equal(observe(a).repeated,true,'lost unknown reply is idempotent')
closed(a,`'{"kind":"agent","id":"${a.session}"}'`)
assert.equal(observe(a).state,'outcome_unknown','agent exit claim is not a trusted receipt')
closed(a)
assert.equal(observe(a,{processTreeQuiescent:false}).state,'outcome_unknown','surviving descendant retains owner')
assert.equal(owner(a),a.session)
assert.equal(observe(a,{providerQuiescent:false}).state,'outcome_unknown','TUI exit does not prove provider stopped')
assert.equal(observe(a,{authorityRevoked:false}).state,'outcome_unknown')
assert.equal(observe(a,{transcriptCommitted:false}).state,'outcome_unknown')
assert.equal(observe(a,{processIdentityRef:''}).recorded,false)
assert.equal(observe(a,{rootExited:'true'}).reason_code,'invalid_observation')
assert.equal(observe(a,{outcome:'outcome_unknown'}).reason_code,'invalid_outcome')
// Completion is atomic, ends exactly once and removes only the old lease.
const observed=await Promise.all([parallel(observeSQL(a)),parallel(observeSQL(a))])
assert.equal(request(a).receipt_seq,observed[0].receipt_seq,'stopped retry links the observed receipt');
assert.equal(observed.filter(x=>!x.repeated).length,1);assert.ok(observed.every(x=>x.state==='stopped'))
assert.equal(state(a),'ended');assert.equal(owner(a),'')
assert.equal(sql(`select count(*) from journal where type='run.ended@1' and run_id='${a.id}'`),'1')
assert.equal(observe(a,{rootExited:false}).state,'stopped','late partial observation cannot downgrade proof')
assert.equal(sql(`select status from project_tasks where id='${a.task}'`),'backlog','verified stop makes acknowledged work continuable without claiming done')
assert.equal(sql(`select count(*) from journal where type='task.moved@1' and payload->>'stop_command_id'='${a.command}'`),'1')
const again=admitAgain(a);assert.equal(again.admitted,true)
const newer={task:a.task,id:again.task_run_id,session:again.session_id}
assert.equal(call(`select begin_task_run_launch('${E}','${newer.id}','${newer.session}',${actor})`).granted,true)
assert.equal(call(`select bind_task_run('${E}','${newer.id}','${newer.session}',${actor})`).bound,true);accept(newer)
assert.equal(request(a).state,'stopped','old command receipt is readable after new generation without signal authority')
assert.equal(observe(a).repeated,true,'old completed observation cannot touch newer lease')
assert.equal(owner(a),again.session_id)
assert.equal(sql(`select status from project_tasks where id='${a.task}'`),'running','late old Stop does not change newer work')
assert.equal(sql(`select session_id from project_tasks where id='${a.task}'`),newer.session)
// Cross-host delivery admission obeys durable Stop even if another PTY queue is open.
const delivering=run(),D=uuid(n++),C=uuid(n++),digest='f'.repeat(32)
const dispatch=(action,delivery=D)=>call(`select continuation_dispatch('${E}',${actor},'${delivery}','${delivering.task}','${delivering.id}','${delivering.session}','${digest}','${C}','${action}')`)
assert.equal(dispatch('claim').granted,true)
request(delivering)
assert.equal(dispatch('begin').state,'target_changed')
assert.equal(dispatch('claim',uuid(n++)).state,'target_changed')
// Allow the honest completion of bytes already written before stop intent.
const written=run(),WD=uuid(n++),WC=uuid(n++)
const write=(action)=>call(`select continuation_dispatch('${E}',${actor},'${WD}','${written.task}','${written.id}','${written.session}','${digest}','${WC}','${action}')`)
assert.equal(write('claim').granted,true);assert.equal(write('begin').granted,true);request(written)
assert.equal(write('written').state,'written')
assert.equal(call(`select acknowledge_delivery('${E}','${written.session}','${WD}','${digest}')`).accepted,true)
assert.equal(state(written),'ending','late ACK cannot undo Stop')
// A root-only known ending is not quiescence; later proof links without rewriting it.
const known=run();sql(`select end_task_run('${E}','${known.id}','completed',${actor})`)
assert.equal(admitAgain(known).reason_code,'run_unresolved')
assert.equal(request(known).state,'requested');assert.equal(state(known),'ended')
closed(known);assert.equal(observe(known).state,'stopped')
assert.equal(sql(`select outcome from task_runs where task_run_id='${known.id}'`),'completed')
assert.equal(sql(`select count(*) from journal where type='run.ended@1' and run_id='${known.id}'`),'1')
assert.equal(admitAgain(known).admitted,true)
// Earlier ended-unknown remains immutable; stop proof permits a NEW Run only.
const unknown=run();sql(`select end_task_run('${E}','${unknown.id}','outcome_unknown',${actor})`)
request(unknown);closed(unknown);assert.equal(observe(unknown).state,'stopped')
assert.equal(sql(`select outcome from task_runs where task_run_id='${unknown.id}'`),'outcome_unknown')
assert.equal(call(`select begin_task_run_launch('${E}','${unknown.id}','${unknown.session}',${actor})`).granted,false)
assert.equal(call(`select validate_task_run_launch('${E}','${unknown.id}','${unknown.session}',${actor})`).valid,false)
assert.equal(admitAgain(unknown).admitted,true)
for(const status of ['review','done','cancelled']) {
 const preserved=run();accept(preserved)
 sql(`select append_event('${E}','task.moved@1',${actor},'{"task_id":"${preserved.task}","to":"${status}"}','1','${P}')`)
 request(preserved);closed(preserved);assert.equal(observe(preserved,{outcome:'completed'}).state,'stopped')
 assert.equal(sql(`select status from project_tasks where id='${preserved.task}'`),status,'Stop preserves independent result state')
}
// Raw journal events cannot construct operational proof.
const forged=run();closed(forged)
sql(`select end_task_run('${E}','${forged.id}','completed',${actor}); select append_event('${E}','run.stop_observed@1',${actor},'{"task_run_id":"${forged.id}","task_id":"${forged.task}","session_id":"${forged.session}","command_id":"${forged.command}","verified":true}','1','${P}','${forged.id}')`)
assert.equal(admitAgain(forged).reason_code,'run_unresolved')
assert.equal(observe(forged).reason_code,'unknown_command')
const forgedPre=run()
sql(`select append_event('${E}','run.ended@1',${actor},'{"task_run_id":"${forgedPre.id}","task_id":"${forgedPre.task}","outcome":"failed_known","launch_failure":true}','1','${P}','${forgedPre.id}')`)
assert.equal(admitAgain(forgedPre).reason_code,'run_unresolved','raw launch_failure boolean is not no-process evidence')
assert.equal(call(`select fail_task_launch('${E}','${forgedPre.id}','${forgedPre.session}',${actor},false)`).compensated,false,'RPC cannot launder previously forged compensation')
// Stale identity, revoked person authority and changed owner are refused.
const denied=run(),person=uuid(n++),keeper=uuid(n++),pa=`'{"kind":"person","id":"operator"}'`
sql(`insert into estates(id,name) values('${E}','Stop fixture') on conflict do nothing; insert into persons(id) values('${person}'),('${keeper}'); insert into memberships(estate_id,person_id,role) values('${E}','${keeper}','owner'),('${E}','${person}','member')`)
assert.equal(request(denied,denied.command,pa).reason_code,'authority_changed')
assert.equal(request(denied,denied.command,`'{"kind":"agent","id":"${denied.session}"}'`).reason_code,'untrusted_actor')
sql(`update memberships set changed_by='changed' where estate_id='${E}' and person_id='${person}'`)
assert.equal(request(denied,denied.command,pa,`, '${person}', 1`).reason_code,'authority_changed')
sql(`delete from memberships where estate_id='${E}' and person_id='${person}'`)
assert.equal(request(denied,denied.command,pa,`, '${person}', 2`).reason_code,'authority_changed')
const valid=run();request(valid);closed(valid)
assert.equal(observe(valid,{},uuid(n++)).reason_code,'unknown_command')
sql(`update leases set owner_session='${uuid(n++)}' where work_id='${valid.task}'`)
assert.equal(observe(valid).reason_code,'lease_changed')
assert.equal(state(valid),'ending')
const stale=run();request(stale);closed(stale)
sql(`select append_event('${E}','run.started@1',${actor},'{"task_run_id":"${uuid(n++)}","task_id":"${stale.task}","session_id":"${uuid(n++)}","run_ordinal":2}','1','${P}')`)
assert.equal(observe(stale).reason_code,'generation_changed')
// A future stop proof never makes an old rejected claim valid during replay.
const history=run(),invader=uuid(n++)
function claim(r,session){sql(`select append_event('${E}','work.claimed@1',${actor},'{"work":"${r.task}","owner":"${session}","idempotency_key":"history:${session}","expires_at":"2099-01-01T00:00:00Z"}','1','${P}')`)}
sql(`update leases set expires_at=now()-interval '1 day' where work_id='${history.task}'`);claim(history,history.session)
sql(`update leases set expires_at=now()-interval '1 day' where work_id='${history.task}'`);claim(history,invader)
assert.equal(owner(history),history.session)
request(history);closed(history);observe(history)
assert.equal(owner(history),'')
const snapshot=sql(`select row_to_json(s) from run_stop_commands s where command_id='${history.command}'`)
sql(`select rebuild_estate_projections('${E}')`)
assert.equal(owner(history),'','replay applies proven stop release and cannot promote the old rejected claim')
assert.equal(sql(`select row_to_json(s) from run_stop_commands s where command_id='${history.command}'`),snapshot,'replay preserves operational proof')
assert.equal(state(history),'ended');assert.equal(state(denied),'active')
assert.equal(sql(`select status from project_tasks where id='${a.task}'`),'running','replay restores newer ACK after earlier Stop')
assert.equal(sql(`select session_id from project_tasks where id='${a.task}'`),newer.session,'replay preserves current session')
assert.equal(sql(`select count(*) from journal where type='task.moved@1' and payload->>'stop_command_id'='${a.command}'`),'1','replay and late proof create no duplicate transition')
claim(history,invader)
assert.equal(owner(history),invader,'new post-proof claim can take ownership')
// All mutation entry points belong only to the trusted host service.
for(const role of ['anon','authenticated','service_role']) for(const table of ['run_stop_commands','run_launch_compensations']) for(const privilege of ['insert','update','delete','truncate'])
 assert.equal(sql(`select has_table_privilege('${role}','${table}','${privilege}')`),'f')
for(const signature of ['request_task_run_stop(uuid,uuid,uuid,uuid,jsonb,uuid,bigint,text)','record_task_run_stop_observation(uuid,uuid,uuid,uuid,jsonb)']) {
 for(const role of ['anon','authenticated']) assert.equal(sql(`select has_function_privilege('${role}','${signature}','execute')`),'f')
 assert.equal(sql(`select has_function_privilege('service_role','${signature}','execute')`),'t')
}
console.log('PASS managed Stop SQL: concurrent intent, typed trusted observations, independent exit receipt, retained uncertainty, exact generation, immutable endings, proof-gated readmission, replay, privileges')
