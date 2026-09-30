// SQL-only lifecycle proof. Runner owns the isolated DB and applies all migrations.
import assert from 'node:assert/strict'
import {execFileSync, spawn} from 'node:child_process'
const url=process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if(!url) {console.error('NOT_RUN: use run-managed-launch-db.mjs');process.exit(2)}
assert.match(new URL(url).pathname,/^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql=input=>execFileSync('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8'}).trim()
assert.equal(sql("select count(*) from supabase_migrations.schema_migrations where version='20260927000061'"),'1')
const parallel=input=>new Promise((resolve,reject)=>{const p=spawn('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1']);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('close',c=>c?reject(Error(err)):resolve(JSON.parse(out)));p.stdin.end(input)})
const uuid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const E=uuid(1),P=uuid(2),actor=`'{"kind":"system","id":"launch-fixture"}'`
const call=q=>JSON.parse(sql(q))
let cursor=10
function task(){const T=uuid(cursor++);sql(`select append_event('${E}','task.created@1',${actor},'{"id":"${T}","title":"Work","instruction":"Original instruction","option_id":"claude-code","preset":"guided","preset_edited":true,"origin":{"kind":"operator","ref":"fixture"}}','1','${P}')`);return T}
const admitSQL=(T,S,a=actor,authority='')=>`select admit_task_launch('${E}','${T}',${a},'${S}','operator'${authority})`
const admit=(...args)=>call(admitSQL(...args))
const beginSQL=(R,S,a=actor,authority='')=>`select begin_task_run_launch('${E}','${R}','${S}',${a}${authority})`
const begin=(...args)=>call(beginSQL(...args))
const validate=(...args)=>call(beginSQL(...args).replace('begin_task_run_launch','validate_task_run_launch'))
const bind=(R,S)=>call(`select bind_task_run('${E}','${R}','${S}',${actor})`)
const fail=(R,S,started)=>call(`select fail_task_launch('${E}','${R}','${S}',${actor},${started})`)
const state=R=>sql(`select state from task_runs where task_run_id='${R}'`)
const owner=T=>sql(`select owner_session from leases where work_id='${T}'`)
sql(`select append_event('${E}','project.created@1',${actor},'{"id":"${P}","name":"Launch fixture"}','1','${P}')`)
// Concurrent different identities have only one admission, even after lease expiry.
const T=task(),S=uuid(cursor++),S2=uuid(cursor++)
const admissions=await Promise.all([parallel(admitSQL(T,S)),parallel(admitSQL(T,S2))])
assert.equal(admissions.filter(x=>x.admitted).length,1)
const won=admissions.find(x=>x.admitted),session=won.session_id,R=won.task_run_id
assert.equal(won.repeated,false);assert.equal(won.state,'admitted')
assert.equal(bind(R,session).reason_code,'launch_not_begun','managed admission cannot bypass spawn gate')
assert.equal(admit(T,session).task_run_id,R);assert.equal(admit(T,session).repeated,true)
sql(`update project_tasks set instruction='Changed after admission',option_id='codex' where id='${T}'`)
assert.equal(admit(T,session).instruction,'Original instruction','lost receipt returns frozen instruction')
assert.equal(admit(T,session).option_id,'claude-code')
assert.equal(admit(task(),session).reason_code,'identity_conflict')
sql(`update leases set expires_at=clock_timestamp()-interval '1 day' where work_id='${T}'`)
assert.equal(admit(T,uuid(cursor++)).reason_code,'run_unresolved')
const starts=await Promise.all([parallel(beginSQL(R,session)),parallel(beginSQL(R,session))])
assert.equal(starts.filter(x=>x.granted).length,1,'one-shot spawn gate')
assert.equal(state(R),'launching');assert.equal(begin(R,session).reason_code,'spawn_consumed')
assert.equal(sql(`select count(*) from journal where type='run.launching@1' and run_id='${R}'`),'1')
assert.equal(bind(R,uuid(cursor++)).reason_code,'session_conflict')
assert.equal(validate(R,session).valid,true);assert.equal(validate(R,session).valid,true)
assert.equal(sql(`select count(*) from journal where type='run.launching@1' and run_id='${R}'`),'1','validation cannot grant another spawn')
assert.equal(bind(R,session).bound,true);
assert.equal(sql(`select session_id from project_tasks where id='${T}'`),session)
assert.equal(sql(`select preset from project_tasks where id='${T}'`),'guided')
assert.equal(validate(R,session).valid,false,'binding closes pre-spawn validation');assert.equal(bind(R,session).repeated,true)
assert.equal(sql(`select count(*) from journal where type='run.bound@1' and run_id='${R}'`),'1')
assert.equal(fail(R,session,false).reason_code,'process_evidence')
// Pre-spawn compensation is permitted only after this generation consumed begin.
const T3=task(),S3=uuid(cursor++),R3=admit(T3,S3).task_run_id
assert.equal(fail(R3,S3,false).reason_code,'process_evidence')
assert.equal(begin(R3,S3).granted,true)
assert.equal(fail(R3,S3,false).outcome,'failed_known');assert.equal(owner(T3),'')
assert.equal(fail(R3,S3,false).repeated,true)
assert.equal(bind(R3,S3).reason_code,'ended')
assert.equal(admit(T3,uuid(cursor++)).admitted,true,'proved no-process failure can start a new generation')
assert.equal(fail(R3,S3,false).reason_code,'generation_changed','late failure cannot affect newer lease')
// Opened evidence forbids claiming pre-spawn failure; post-spawn ownership persists.
const T4=task(),S4=uuid(cursor++),R4=admit(T4,S4).task_run_id
begin(R4,S4)
sql(`select append_event('${E}','terminal.opened@1',${actor},'{"session_id":"${S4}"}','1','${P}')`)
assert.equal(fail(R4,S4,false).reason_code,'process_evidence')
assert.equal(fail(R4,S4,true).state,'ending');assert.equal(owner(T4),S4)
assert.equal(fail(R4,S4,true).repeated,true);assert.equal(bind(R4,S4).reason_code,'ending')
sql(`update leases set expires_at=clock_timestamp()-interval '1 day' where work_id='${T4}'`)
assert.equal(admit(T4,uuid(cursor++)).reason_code,'run_unresolved')
// A terminal exit may arrive before bind; immutable ended record wins.
const T5=task(),S5=uuid(cursor++),R5=admit(T5,S5).task_run_id
begin(R5,S5)
sql(`select end_task_run('${E}','${R5}','completed',${actor})`)
assert.equal(bind(R5,S5).reason_code,'ended');assert.equal(state(R5),'ended')
// Unknown is not proof of stopped and remains admission-blocking even ended.
const T6=task(),S6=uuid(cursor++),R6=admit(T6,S6).task_run_id
begin(R6,S6)
sql(`select end_task_run('${E}','${R6}','outcome_unknown',${actor}); update leases set expires_at=clock_timestamp()-interval '1 day' where work_id='${T6}'`)
assert.equal(admit(T6,uuid(cursor++)).reason_code,'run_unresolved')
// Old admitted runs can move only their own original lease atomically.
const T7=task(),S7=uuid(cursor++),R7=uuid(cursor++),N7=uuid(cursor++)
sql(`select append_event('${E}','run.started@1',${actor},'{"task_run_id":"${R7}","task_id":"${T7}","run_ordinal":1,"session_id":"${S7}"}','1','${P}'); select append_event('${E}','task.admitted@1',${actor},'{"task_run_id":"${R7}","task_id":"${T7}","session_id":"${S7}"}','1','${P}','${R7}'); insert into leases(estate_id,project_id,work_id,owner_session,idempotency_key,expires_at,write_scopes,claimed_seq) values('${E}','${P}','${T7}','${S7}','${S7}',now()+interval '10 minutes',array['task'],1)`)
assert.equal(bind(R7,N7).bound,true);assert.equal(owner(T7),N7)
assert.equal(sql(`select session_id from task_runs where task_run_id='${R7}'`),N7)
assert.equal(admit(T7,S7).task_run_id,R7,'old idempotency identity survives rebinding')
const T8=task(),S8=uuid(cursor++),R8=admit(T8,S8).task_run_id
sql(`update leases set owner_session='${uuid(cursor++)}' where work_id='${T8}'`)
assert.equal(bind(R8,uuid(cursor++)).reason_code,'lease_changed')
assert.equal(begin(R8,S8).reason_code,'lease_changed')
assert.equal(fail(R8,S8,true).reason_code,'lease_changed')
// Stale run generation must not bind or begin even with a matching old lease.
const T9=task(),S9=uuid(cursor++),R9=admit(T9,S9).task_run_id
sql(`select append_event('${E}','run.started@1',${actor},'{"task_run_id":"${uuid(cursor++)}","task_id":"${T9}","run_ordinal":2,"session_id":"${uuid(cursor++)}"}','1','${P}')`)
assert.equal(begin(R9,S9).reason_code,'generation_changed');assert.equal(bind(R9,S9).reason_code,'generation_changed')
// An expired orphan lease without a Run cannot prove the old writer stopped.
const orphan=task(),orphanSession=uuid(cursor++)
sql(`insert into leases(estate_id,project_id,work_id,owner_session,idempotency_key,expires_at,write_scopes,claimed_seq) values('${E}','${P}','${orphan}','${orphanSession}','${orphanSession}',now()-interval '1 day',array['task'],1)`)
assert.equal(admit(orphan,uuid(cursor++)).reason_code,'lease_held')
// Person identity is a held grant, not the human-readable audit actor id.
const person=uuid(cursor++),other=uuid(cursor++),pa=`'{"kind":"person","id":"operator"}'`
sql(`insert into estates(id,name) values('${E}','Launch') on conflict do nothing; insert into persons(id) values('${person}'),('${other}'); insert into memberships(estate_id,person_id,role) values('${E}','${other}','owner'),('${E}','${person}','member')`)
const T10=task(),S10=uuid(cursor++)
assert.equal(admit(T10,S10,pa).reason_code,'authority_changed')
const R10=admit(T10,S10,pa,`, '${person}', 1`).task_run_id
sql(`update memberships set changed_by='changed' where person_id='${person}' and estate_id='${E}'`)
assert.equal(begin(R10,S10,pa,`, '${person}', 1`).reason_code,'authority_changed')
sql(`delete from memberships where person_id='${person}' and estate_id='${E}'`)
assert.equal(begin(R10,S10,pa,`, '${person}', 2`).reason_code,'authority_changed')
// Same request raced/retried returns one durable Run and original receipt.
const sameTask=task(),sameSession=uuid(cursor++)
const same=await Promise.all([parallel(admitSQL(sameTask,sameSession)),parallel(admitSQL(sameTask,sameSession))])
assert.equal(same.filter(x=>x.repeated===false).length,1)
assert.equal(same[0].task_run_id,same[1].task_run_id)
assert.equal(same[0].receipt_seq,same[1].receipt_seq)
// State/blocker changes after admission are rechecked at spawn boundary.
const blockedTask=task(),blockedSession=uuid(cursor++),blockedRun=admit(blockedTask,blockedSession).task_run_id,Q=uuid(cursor++)
sql(`select append_event('${E}','question.asked@1','{"kind":"person","id":"fixture"}','{"id":"${Q}","project_id":"${P}","text":"Choose first","blocks":["${blockedTask}"]}','1','${P}')`)
assert.equal(begin(blockedRun,blockedSession).reason_code,'blocked')
const closedTask=task(),closedSession=uuid(cursor++),closedRun=admit(closedTask,closedSession).task_run_id
sql(`select append_event('${E}','task.moved@1',${actor},'{"task_id":"${closedTask}","to":"cancelled"}','1','${P}')`)
assert.equal(begin(closedRun,closedSession).reason_code,'task_changed')
// The actual service role can execute commands without direct table writes.
const serviceTask=task(),serviceSession=uuid(cursor++)
assert.equal(call(`set role service_role; ${admitSQL(serviceTask,serviceSession)}`).admitted,true)
// Agent claim/release shares the Run fence, including raw journal append callers.
const guardedClaims=[]
function claim(T,S) {
 return sql(`select append_event('${E}','work.claimed@1','{"kind":"agent","id":"${S}"}',
  '{"work":"${T}","owner":"${S}","idempotency_key":"${S}:${T}","expires_at":"2099-01-01T00:00:00Z","write_scopes":["task"],"force":true,"process_stopped":true}', '1','${P}')`)
}
for (const phase of ['admitted','launching','active','ending','outcome_unknown']) {
 const taskId=task(),sessionId=uuid(cursor++),otherSession=uuid(cursor++),runId=admit(taskId,sessionId).task_run_id
 if(phase!=='admitted') begin(runId,sessionId)
 if(phase==='active') bind(runId,sessionId)
 if(phase==='ending') fail(runId,sessionId,true)
 if(phase==='outcome_unknown') sql(`select end_task_run('${E}','${runId}','outcome_unknown',${actor})`)
 sql(`update leases set expires_at=now()-interval '1 day' where work_id='${taskId}'`)
 claim(taskId,otherSession)
 assert.equal(owner(taskId),sessionId,`${phase}: expired lease is not transferable`)
 claim(taskId,sessionId)
 assert.equal(owner(taskId),sessionId,`${phase}: same generation can retain claim`)
 sql(`select append_event('${E}','work.released@1','{"kind":"agent","id":"${sessionId}"}','{"work":"${taskId}","owner":"${sessionId}","process_stopped":true}','1','${P}')`)
 assert.equal(owner(taskId),sessionId,`${phase}: release is not observed Stop`)
 guardedClaims.push({taskId,sessionId})
}
const missingTask=task(),missingSession=uuid(cursor++),missingRun=admit(missingTask,missingSession).task_run_id
begin(missingRun,missingSession)
sql(`delete from leases where work_id='${missingTask}'`)
claim(missingTask,uuid(cursor++))
assert.equal(owner(missingTask),'','missing lease does not erase unresolved Run ownership')
// A known root-process ending is insufficient once managed Stop owns clearance (62).
const finishedTask=task(),finishedSession=uuid(cursor++),finishedRun=admit(finishedTask,finishedSession).task_run_id
begin(finishedRun,finishedSession);bind(finishedRun,finishedSession)
sql(`select end_task_run('${E}','${finishedRun}','completed',${actor})`)
assert.equal(admit(finishedTask,uuid(cursor++)).reason_code,'run_unresolved','migration62 requires observed quiescence even for root-only known ending')
// Global session identity remains unique when different Estates race.
const otherEstate=uuid(cursor++),otherProject=uuid(cursor++),otherTask=uuid(cursor++),globalSession=uuid(cursor++),localTask=task()
sql(`select append_event('${otherEstate}','project.created@1',${actor},'{"id":"${otherProject}","name":"Other Estate"}','1','${otherProject}'); select append_event('${otherEstate}','task.created@1',${actor},'{"id":"${otherTask}","title":"Other task"}','1','${otherProject}')`)
const cross=await Promise.all([parallel(admitSQL(localTask,globalSession)),parallel(`select admit_task_launch('${otherEstate}','${otherTask}',${actor},'${globalSession}')`)])
assert.equal(cross.filter(x=>x.admitted).length,1,'cross-Estate session race admits one Run')
assert.equal(cross.find(x=>!x.admitted).reason_code,'identity_conflict')
// A raw claim in a different Estate cannot mutate this Estate's expired lease.
sql(`update leases set expires_at=now()-interval '1 day' where work_id='${T}'; select append_event('${otherEstate}','work.claimed@1',${actor},'{"work":"${T}","owner":"${uuid(cursor++)}","idempotency_key":"wrong-scope","expires_at":"2099-01-01T00:00:00Z"}','1','${otherProject}')`)
assert.equal(owner(T),session,'wrong Estate cannot bypass unresolved owner check')
// Last pre-spawn validation catches changes occurring after successful begin.
const validateTask=task(),validateSession=uuid(cursor++),validateRun=admit(validateTask,validateSession).task_run_id
begin(validateRun,validateSession)
assert.equal(validate(validateRun,validateSession).valid,true)
sql(`select append_event('${E}','question.asked@1','{"kind":"person","id":"fixture"}','{"id":"${uuid(cursor++)}","project_id":"${P}","text":"Changed while preparing","blocks":["${validateTask}"]}','1','${P}')`)
assert.equal(validate(validateRun,validateSession).reason_code,'blocked')
const changedTask=task(),changedSession=uuid(cursor++),changedRun=admit(changedTask,changedSession).task_run_id
begin(changedRun,changedSession)
sql(`select append_event('${E}','task.moved@1',${actor},'{"task_id":"${changedTask}","to":"cancelled"}','1','${P}')`)
assert.equal(validate(changedRun,changedSession).reason_code,'task_changed');assert.equal(bind(changedRun,changedSession).reason_code,'task_changed')
const endedTask=task(),endedSession=uuid(cursor++),endedRun=admit(endedTask,endedSession).task_run_id
begin(endedRun,endedSession);sql(`select end_task_run('${E}','${endedRun}','completed',${actor})`)
assert.equal(validate(endedRun,endedSession).valid,false)
const validatingPerson=uuid(cursor++)
sql(`insert into persons(id) values('${validatingPerson}'); insert into memberships(estate_id,person_id,role) values('${E}','${validatingPerson}','member')`)
const grantTask=task(),grantSession=uuid(cursor++),grantArgs=`, '${validatingPerson}', 1`,grantRun=admit(grantTask,grantSession,pa,grantArgs).task_run_id
assert.equal(begin(grantRun,grantSession,pa,grantArgs).granted,true)
assert.equal(validate(grantRun,grantSession,pa,grantArgs).valid,true)
sql(`update memberships set changed_by='revised after preparation' where person_id='${validatingPerson}' and estate_id='${E}'`)
assert.equal(validate(grantRun,grantSession,pa,grantArgs).reason_code,'authority_changed')
sql(`delete from memberships where person_id='${validatingPerson}' and estate_id='${E}'`)
assert.equal(validate(grantRun,grantSession,pa,`, '${validatingPerson}', 2`).reason_code,'authority_changed')
// Receipt-backed ACK advances only the exact current eligible task.
function delivery(T,R,S) {
 const D=uuid(cursor++),C=uuid(cursor++),digest='c'.repeat(32)
 for(const action of ['claim','begin','written']) call(`select continuation_dispatch('${E}',${actor},'${D}','${T}','${R}','${S}','${digest}','${C}','${action}')`)
 return ()=>call(`select acknowledge_delivery('${E}','${S}','${D}','${digest}')`)
}
const ackTask=task(),ackSession=uuid(cursor++),ackRun=admit(ackTask,ackSession).task_run_id
begin(ackRun,ackSession);bind(ackRun,ackSession);const acknowledge=delivery(ackTask,ackRun,ackSession)
assert.equal(sql(`select status from project_tasks where id='${ackTask}'`),'backlog')
assert.equal(acknowledge().accepted,true);assert.equal(acknowledge().repeated,true)
assert.equal(sql(`select status from project_tasks where id='${ackTask}'`),'running')
assert.equal(sql(`select count(*) from journal where type='task.moved@1' and run_id='${ackRun}'`),'1')
const ackClosedTask=task(),ackClosedSession=uuid(cursor++),ackClosedRun=admit(ackClosedTask,ackClosedSession).task_run_id
begin(ackClosedRun,ackClosedSession);bind(ackClosedRun,ackClosedSession);const ackClosed=delivery(ackClosedTask,ackClosedRun,ackClosedSession)
sql(`select append_event('${E}','task.moved@1',${actor},'{"task_id":"${ackClosedTask}","to":"cancelled"}','1','${P}')`)
assert.equal(ackClosed().accepted,true,'delivery fact remains recordable after cancellation')
assert.equal(sql(`select status from project_tasks where id='${ackClosedTask}'`),'cancelled','late ACK cannot reopen task')
const ackBlockedTask=task(),ackBlockedSession=uuid(cursor++),ackBlockedRun=admit(ackBlockedTask,ackBlockedSession).task_run_id
begin(ackBlockedRun,ackBlockedSession);bind(ackBlockedRun,ackBlockedSession);const ackBlocked=delivery(ackBlockedTask,ackBlockedRun,ackBlockedSession)
sql(`select append_event('${E}','question.asked@1','{"kind":"person","id":"fixture"}','{"id":"${uuid(cursor++)}","project_id":"${P}","text":"Need decision","blocks":["${ackBlockedTask}"]}','1','${P}')`)
assert.equal(ackBlocked().accepted,true)
assert.equal(sql(`select status from project_tasks where id='${ackBlockedTask}'`),'backlog','blocked task is not advanced')
const ackStaleTask=task(),ackStaleSession=uuid(cursor++),ackStaleRun=admit(ackStaleTask,ackStaleSession).task_run_id
begin(ackStaleRun,ackStaleSession);bind(ackStaleRun,ackStaleSession);const ackStale=delivery(ackStaleTask,ackStaleRun,ackStaleSession)
sql(`select end_task_run('${E}','${ackStaleRun}','completed',${actor})`)
assert.equal(admit(ackStaleTask,uuid(cursor++)).reason_code,'run_unresolved')
// Inject a newer historical generation only to exercise stale-ACK rejection.
sql(`select append_event('${E}','run.started@1',${actor},'{"task_run_id":"${uuid(cursor++)}","task_id":"${ackStaleTask}","run_ordinal":2,"session_id":"${uuid(cursor++)}"}','1','${P}')`)
assert.equal(ackStale().accepted,true)
assert.equal(sql(`select status from project_tasks where id='${ackStaleTask}'`),'backlog','old generation ACK cannot start newer task attempt')
// Replaying a rejected claim after a later known ending must not grant it.
const historicalTask=task(),historicalSession=uuid(cursor++),historicalOther=uuid(cursor++),historicalRun=admit(historicalTask,historicalSession).task_run_id
begin(historicalRun,historicalSession);bind(historicalRun,historicalSession)
sql(`update leases set expires_at=now()-interval '1 day' where work_id='${historicalTask}'`);claim(historicalTask,historicalSession)
sql(`update leases set expires_at=now()-interval '1 day' where work_id='${historicalTask}'`);claim(historicalTask,historicalOther)
assert.equal(owner(historicalTask),historicalSession)
sql(`select append_event('${E}','work.released@1',${actor},'{"work":"${historicalTask}","owner":"${historicalSession}"}','1','${P}')`)
assert.equal(owner(historicalTask),historicalSession)
sql(`select end_task_run('${E}','${historicalRun}','completed',${actor})`)
// Full journal replay recreates launching/ending and immutable outcomes.
const T11=task(),S11=uuid(cursor++),R11=admit(T11,S11).task_run_id
begin(R11,S11)
sql(`select rebuild_estate_projections('${E}')`)
assert.equal(state(R),'active');assert.equal(state(R4),'ending');assert.equal(state(R11),'launching');assert.equal(state(R3),'ended')
assert.equal(begin(R11,S11).granted,false,'projection replay cannot grant another spawn')
for (const item of guardedClaims) assert.equal(owner(item.taskId),item.sessionId,'replay preserves rightful unresolved owner and skips unsafe claims/releases')
assert.equal(owner(missingTask),'','replay does not resurrect an invalid claim')
assert.equal(owner(historicalTask),historicalSession,'later known ending cannot authorise earlier rejected claim')
assert.equal(sql(`select session_id from project_tasks where id='${ackTask}'`),ackSession,'replay preserves bound task-session association')
assert.equal(sql(`select status from project_tasks where id='${ackTask}'`),'running','replay preserves eligible ACK task move')
assert.equal(sql(`select preset from project_tasks where id='${ackTask}'`),'guided','task-created preset is projected')
for(const signature of ['admit_task_launch(uuid,uuid,jsonb,uuid,text,uuid,bigint)','begin_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint)','validate_task_run_launch(uuid,uuid,uuid,jsonb,uuid,bigint)','bind_task_run(uuid,uuid,uuid,jsonb)','fail_task_launch(uuid,uuid,uuid,jsonb,boolean)']) {
 for(const role of ['anon','authenticated']) assert.equal(sql(`select has_function_privilege('${role}','${signature}','execute')`),'f')
 assert.equal(sql(`select has_function_privilege('service_role','${signature}','execute')`),'t')
}
assert.equal(sql("select to_regprocedure('admit_task_launch(uuid,uuid,jsonb,uuid,text)') is null"),'t','no bypass overload')
for(const table of ['task_runs','leases']) for(const role of ['anon','authenticated','service_role']) assert.equal(sql(`select has_table_privilege('${role}','${table}','update')`),'f')
console.log('PASS managed launch SQL: concurrency, one-shot begin, idempotency, authority, legacy atomic bind, compensation, unknown ownership, replay, privileges')
