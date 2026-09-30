// Run only against an EMPTY disposable database named fabric_dispatch_test_*.
// This exercises the real migration under concurrent PostgreSQL connections.
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
const url=process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if(!url) {console.error('NOT_RUN: FABRIC_DISPATCH_TEST_DATABASE_URL must point to an empty isolated PostgreSQL database');process.exit(2)}
assert.match(new URL(url).pathname,/^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql=(input)=>execFileSync('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],{input,encoding:'utf8'}).trim()
assert.equal(sql("select count(*) from pg_tables where schemaname='public'"),'0','refuse to modify a populated database')
const full = process.env.FABRIC_DISPATCH_TEST_FULL_SCHEMA === '1'
sql(`
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role service_role; exception when duplicate_object then null; end $$;
create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
`)
if (full) {
  sql('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text)')
  for (const file of readdirSync(new URL('../../../supabase/migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort()) {
    sql(readFileSync(new URL('../../../supabase/migrations/'+file,import.meta.url),'utf8'))
    sql(`insert into supabase_migrations.schema_migrations values ('${file.split('_')[0]}')`)
  }
} else {
sql(`
create table memberships(estate_id uuid,person_id uuid,revision bigint);
create table event_types(type text primary key,projects boolean,note text);
create table journal(seq bigserial primary key,estate_id uuid,project_id uuid,type text,payload jsonb);
create table task_runs(task_run_id uuid primary key,estate_id uuid,project_id uuid,task_id uuid,session_id uuid,state text,run_ordinal integer);
create function append_event(e uuid,t text,a jsonb,p jsonb,v text,pr uuid,r uuid) returns journal language plpgsql as $$
declare j journal;begin insert into journal(estate_id,project_id,type,payload) values(e,pr,t,p) returning * into j;perform apply_deliveries(j);return j;end $$;
`)
sql(readFileSync(new URL('../../../supabase/migrations/20260909000045_delivery_acknowledgement.sql',import.meta.url),'utf8'))
sql(readFileSync(new URL('../../../supabase/migrations/20260927000060_continuation_dispatch.sql',import.meta.url),'utf8'))
}
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const E=uuid(1),T=uuid(2),R=uuid(3),S=uuid(4),P=uuid(5),D=uuid(6),A=uuid(7),B=uuid(8)
if(full) {
  sql(`select append_event('${E}','project.created@1','{"kind":"system","id":"fixture"}','{"id":"${P}","name":"dispatch fixture"}','1','${P}')`)
  sql(`insert into task_runs(task_run_id,estate_id,project_id,task_id,session_id,state,run_ordinal,admitted_seq) values('${R}','${E}','${P}','${T}','${S}','active',1,1)`)
} else sql(`insert into task_runs values('${R}','${E}','${P}','${T}','${S}','active',1)`)
const call=(action,claim=A,delivery=D,estate=E,digest='a'.repeat(32))=>`select continuation_dispatch('${estate}','{"kind":"system","id":"test"}','${delivery}','${T}','${R}','${S}','${digest}','${claim}','${action}')`
const run=(...args)=>JSON.parse(sql(call(...args)))
const parallel=input=>new Promise((resolve,reject)=>{const p=spawn('psql',[url,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1']);let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('close',c=>c?reject(Error(err)):resolve(JSON.parse(out)));p.stdin.end(input)})
const race=await Promise.all([parallel(call('claim',A)),parallel(call('claim',B))])
assert.equal(race.filter(x=>x.granted).length,1)
const winner=race[0].granted?A:B, loser=winner===A?B:A
assert.equal(run('begin',loser).granted,false)
assert.equal(run('claim',A,D,uuid(99)).state,'identity_conflict')
assert.equal(run('claim',A,D,E,'b'.repeat(32)).state,'identity_conflict')
// Crash before begin: lease expires, new generation may acquire; stale owner cannot write.
sql(`update continuation_dispatches set lease_until=clock_timestamp()-interval '1 second' where delivery_id='${D}'`)
assert.equal(run('claim',loser).granted,true)
assert.equal(run('begin',winner).granted,false)
assert.equal(run('begin',loser).granted,true)
// Crash after begin: expiry can never authorize another write.
sql(`update continuation_dispatches set lease_until=clock_timestamp()-interval '1 hour' where delivery_id='${D}'`)
assert.equal(run('claim',winner).state,'outcome_unknown')
assert.equal(run('written',loser).state,'written')
assert.equal(run('claim',winner).state,'written')
assert.equal(sql(`select count(*) from journal where type='delivery.written@1'`),'1')
assert.equal(sql(`select state from deliveries where delivery_id='${D}'`),'written_unconfirmed')
// Proof of no write permits retry, including after a readiness timeout.
const D2=uuid(20);assert.equal(run('claim',A,D2).granted,true)
assert.equal(run('failed_before_write',A,D2).state,'failed_before_write')
assert.equal(run('claim',B,D2).granted,true)
assert.equal(run('begin',B,D2).granted,true)
assert.equal(run('outcome_unknown',B,D2).state,'outcome_unknown')
assert.equal(run('claim',A,D2).granted,false)
// Legacy queued rows may be post-write crashes; never call them delivered/replayable.
const D3=uuid(30)
sql(`select append_event('${E}','delivery.queued@1','{}','{"delivery_id":"${D3}","task_id":"${T}","session_id":"${S}","input_digest":"${'a'.repeat(32)}"}','1','${P}','${R}')`)
assert.equal(run('claim',A,D3).state,'outcome_unknown')
assert.equal(sql(`select state from deliveries where delivery_id='${D3}'`),'outcome_unknown','uncertainty reaches read models')
assert.equal(run('claim',B,D3).state,'outcome_unknown')
assert.equal(sql(`select count(*) from journal where type='delivery.unknown@1' and payload->>'delivery_id'='${D3}'`),'1','legacy recovery is idempotent')
// An authenticated session can ACK between native write and completion commit.
const D5=uuid(50)
assert.equal(run('claim',A,D5).granted,true)
const ack=(delivery,session=S,digest='a'.repeat(32))=>JSON.parse(sql(`select acknowledge_delivery('${E}','${session}','${delivery}','${digest}')`))
assert.equal(ack(D5).accepted,false,'queued but not begun is not accepted')
assert.equal(run('begin',A,D5).granted,true)
assert.equal(ack(D5,uuid(999)).accepted,false,'another session cannot acknowledge')
assert.equal(ack(D5,S,'b'.repeat(32)).accepted,false,'wrong digest cannot acknowledge')
assert.equal(ack(D5).accepted,true,'early ACK is not lost')
assert.equal(run('written',A,D5).state,'accepted','late write cannot downgrade ACK')
assert.equal(ack(D5).repeated,true,'ACK retry is idempotent')
assert.equal(sql(`select count(*) from journal where type='delivery.accepted@1' and payload->>'delivery_id'='${D5}'`),'1')
if(full) {
 const before=sql(`select row_to_json(c) from continuation_dispatches c where delivery_id='${D}'`)
 sql(`select rebuild_estate_projections('${E}')`)
 assert.equal(sql(`select row_to_json(c) from continuation_dispatches c where delivery_id='${D}'`),before,'replay preserves operational fences')
 assert.equal(sql(`select state from deliveries where delivery_id='${D5}'`),'accepted','early ACK survives projection replay')
}
if(full) {
 const person=uuid(71), owner=uuid(73), D6=uuid(72)
 sql(`insert into estates(id,name) values('${E}','dispatch fixture') on conflict do nothing; insert into persons(id) values('${person}'),('${owner}'); insert into memberships(person_id,estate_id,role) values('${owner}','${E}','owner'),('${person}','${E}','member')`)
 const personCall=(action,revision=1)=>call(action,A,D6).replace('{"kind":"system","id":"test"}',JSON.stringify({kind:'person',id:'operator'})).replace(/\)$/,`, '${person}', ${revision})`)
 assert.equal(JSON.parse(sql(personCall('claim'))).granted,true)
 sql(`update memberships set changed_by='test' where estate_id='${E}' and person_id='${person}'`)
 assert.equal(JSON.parse(sql(personCall('begin'))).state,'authority_changed','changed revision refuses even before removal')
 sql(`delete from memberships where estate_id='${E}' and person_id='${person}'`)
 assert.equal(JSON.parse(sql(personCall('begin'))).state,'authority_changed','revocation before write refuses')
 assert.equal(sql("select has_table_privilege('service_role','continuation_dispatches','update')"),'f','only RPC changes fences')
}
// A run changed while readiness was awaited: refuse begin.
const D4=uuid(40);assert.equal(run('claim',A,D4).granted,true)
sql(`update task_runs set state='ended'${full ? ", outcome='cancelled', ended_seq=1" : ''} where task_run_id='${R}'`)
assert.equal(run('begin',A,D4).state,'target_changed')
assert.equal(sql("select has_function_privilege('authenticated','continuation_dispatch(uuid,jsonb,uuid,uuid,uuid,uuid,text,uuid,text,uuid,bigint)','execute')"),'f')
assert.equal(sql("select has_table_privilege('authenticated','continuation_dispatches','update')"),'f')
console.log('PASS PostgreSQL dispatch migration: concurrent claim, stale generation, pre/post-boundary crash, completion, safe retry, unknown fence, identity/scope, ended run, privileges')
