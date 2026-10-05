// Actual PostgreSQL full-chain acceptance. No live server, provider, or HTTP invoked.
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createTranscriptStore } from '../src/main/transcripts.ts'
import { createTranscriptRecovery } from '../src/main/transcriptRecovery.ts'
import { execFile, execFileSync } from 'node:child_process'
import { runPsqlAsync } from './bounded-psql.mjs'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'

const dir = process.env.FABRIC_TRANSCRIPT_RECOVERY_DB_DIR, nonce = process.env.FABRIC_TRANSCRIPT_RECOVERY_DB_NONCE
if (!dir || !nonce || !process.env.FABRIC_TRANSCRIPT_RECOVERY_PG_BIN) {
  console.error('NOT_RUN: use run-transcript-recovery-db.mjs to create an owned disposable cluster')
  process.exit(2)
}
assert.match(path.basename(dir), /^fabric-transcript-recovery-[a-zA-Z0-9]+$/)
assert.equal(readFileSync(path.join(dir, 'owner'), 'utf8'), nonce)
const sql = input => execFileSync(path.join(process.env.FABRIC_TRANSCRIPT_RECOVERY_PG_BIN, 'psql'), [
  '-h', dir, '-p', '58440', '-U', 'postgres', '-d', 'fabric_transcript_recovery_test_owned',
  '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'
], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
assert.equal(realpathSync(sql('show data_directory')), realpathSync(path.join(dir, 'data')))
assert.equal(sql('show listen_addresses'), '', 'the owned server must have no TCP listener')
assert.equal(sql("select count(*) from pg_tables where schemaname='public'"), '0', 'never modify a populated DB')
sql(`create role anon; create role authenticated; create role service_role;
  create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';
  create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text);`)
// SQL literals are UTF-8 bytes decoded by PostgreSQL, never caller text in SQL syntax.
const text = value => {
  assert.equal(typeof value, 'string'); assert.ok(!value.includes('\0'))
  return `convert_from(decode('${Buffer.from(value, 'utf8').toString('hex')}','hex'),'UTF8')`
}
const migrations = readdirSync(new URL('../../../supabase/migrations/', import.meta.url)).filter(x => x.endsWith('.sql')).sort()
let legacyBefore
for (const file of migrations) {
  if (file.startsWith('20260927000063')) {
    sql(`insert into estates(id,name) values ('00000000-0000-4000-8000-000000000001','Recovery fixture');
      select append_event('00000000-0000-4000-8000-000000000001','project.created@1','{"kind":"system","id":"fixture"}',
        '{"id":"00000000-0000-4000-8000-000000000002","name":"Recovery project"}','1','00000000-0000-4000-8000-000000000002');
      select append_event('00000000-0000-4000-8000-000000000001','transcript.captured@1','{"kind":"system","id":"fixture"}',
        '{"session_id":"00000000-0000-4000-8000-000000000101","sha256":"legacy-original-hash","body":"legacy body","started_at":"2025-01-01T00:00:00Z","ended_at":"2025-01-01T00:04:00Z","exit_code":0}',
        '1','00000000-0000-4000-8000-000000000002');
      select append_event('00000000-0000-4000-8000-000000000001','transcript.captured@1','{"kind":"system","id":"fixture"}',
        '{"session_id":"00000000-0000-4000-8000-000000000102","sha256":"legacy-fallback-hash","body":"legacy unknown body"}',
        '1','00000000-0000-4000-8000-000000000002');`)
    legacyBefore=JSON.parse(sql('select jsonb_agg(to_jsonb(s) order by session_id) from session_transcripts s'))
  }
  sql(readFileSync(new URL('../../../supabase/migrations/' + file, import.meta.url), 'utf8'))
  sql(`insert into supabase_migrations.schema_migrations values (${text(file.split('_')[0])})`)
}
assert.equal(Number(sql('select count(*) from supabase_migrations.schema_migrations')), migrations.length)

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const estate=uuid(1), project=uuid(2), actor={kind:'system',id:'fixture'}
const lit=(value,type='jsonb')=>value===null?`null::${type}`:`${text(type==='jsonb'?JSON.stringify(value):String(value))}::${type}`
const rows=query=>JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(q)),'[]') from (${query}) q`))
const append=(type,payload,{e=estate,p=project}={})=>JSON.parse(sql(`set role service_role; select to_jsonb(append_event(${lit(e,'uuid')},${lit(type,'text')},${lit(actor)},${lit(payload)},'1',${lit(p,'uuid')}));`))
const count=()=>Number(sql('select count(*) from journal'))
const query=(session,command,capture,{e=estate,p=project}={})=>`set role service_role; select recover_transcript(p_estate_id=>${lit(e,'uuid')},p_project_id=>${lit(p,'uuid')},p_session_id=>${lit(session,'uuid')},p_command_id=>${lit(command,'uuid')},p_capture=>${lit(capture)});`
const recover=(...args)=>JSON.parse(sql(query(...args)))
const capture=(body='Recovered partial output\n',{task=null,observed=false,empty=false,...changes}={})=>({
  task_id:task,option_id:'claude-code',sha256:createHash('sha256').update(body).digest('hex'),
  bytes:Buffer.byteLength(body),lines:empty?0:body.split('\n').length,truncated:!observed,
  annotation:empty?'':observed?'Observed capture':'Recovered partial · duration unknown · exit unknown',
  excerpt:body,body,capture_state:empty?'empty':'captured',started_at:'2026-09-27T00:00:00.000Z',
  ended_at:observed?'2026-09-27T00:01:00.000Z':null,exit_code:null,
  ending_provenance:observed?'observed':'unknown',...changes
})
const open=(n,opts={})=>{const id=uuid(n);append('terminal.opened@1',{session_id:id,option_id:'claude-code',program:'fixture'},opts);return id}
const row=session=>rows(`select * from session_transcripts where session_id=${lit(session,'uuid')}`)[0]
const runtimeSnapshot=()=>JSON.stringify({runs:rows('select * from task_runs order by task_run_id'),tasks:rows('select * from project_tasks order by id'),leases:rows('select * from leases order by work_id'),stops:rows('select * from run_stop_commands order by command_id')})
let passed=0
async function test(name,fn){await fn();passed++;console.log('PASS '+name)}

await test('migration preserves every legacy field; provenance is legacy even with explicit old endpoints',()=>{
  for(const before of legacyBefore){const after=row(before.session_id);assert.equal(after.ending_provenance,'legacy');assert.ok(after.captured_at)
    const {captured_at,ending_provenance,...existing}=after;assert.deepEqual(existing,before)
    assert.equal(Date.parse(captured_at),Date.parse(rows(`select occurred_at from journal where estate_id=${lit(estate,'uuid')} and seq=${before.seq}`)[0].occurred_at))
  }
  assert.equal(row(uuid(101)).exit_code,0)
})

let firstReceipt,firstCapture,firstSession
await test('unknown recovery stores nullable ending and Unicode byte/hash/line truth without altering any runtime state',()=>{
  firstSession=open(110)
  const task=uuid(111)
  append('task.created@1',{id:task,instruction:'Recovery owns no task lifecycle',option_id:'claude-code',session_id:firstSession})
  append('run.started@1',{task_id:task,task_run_id:uuid(112),run_ordinal:1,session_id:firstSession})
  append('work.claimed@1',{work_id:task,owner_session:firstSession,ttl_seconds:3600})
  firstCapture=capture('Recovered 日本語\n',{task})
  const before=runtimeSnapshot(),events=count()
  firstReceipt=recover(firstSession,uuid(113),firstCapture)
  assert.equal(firstReceipt.recorded,true);assert.equal(firstReceipt.repeated,false);assert.equal(count(),events+1)
  assert.equal(firstReceipt.event_type,'transcript.captured@2');assert.equal(firstReceipt.ending_provenance,'unknown')
  assert.equal(firstReceipt.ended_at,null);assert.equal(firstReceipt.exit_code,null)
  assert.equal(firstReceipt.task_id,task);assert.equal(firstReceipt.option_id,'claude-code')
  assert.equal(firstReceipt.annotation,firstCapture.annotation);assert.equal(firstReceipt.excerpt,firstCapture.excerpt)
  assert.equal(firstReceipt.bytes,Buffer.byteLength(firstCapture.body));assert.equal(firstReceipt.lines,2)
  const actual=row(firstSession)
  assert.equal(actual.body,firstCapture.body);assert.equal(actual.ended_at,null);assert.equal(actual.exit_code,null)
  assert.equal(actual.truncated,true);assert.equal(actual.sha256,firstCapture.sha256)
  assert.equal(Date.parse(actual.captured_at),Date.parse(firstReceipt.captured_at))
  assert.equal(runtimeSnapshot(),before)
  assert.equal(sql('select count(*) from transcript_recovery_authorizations'),'0')
})

await test('lost reply and fresh-command retry return original canonical receipt; changed command/session intent is refused',()=>{
  const before=count()
  assert.deepEqual(recover(firstSession,uuid(113),firstCapture),{...firstReceipt,repeated:true})
  assert.deepEqual(recover(firstSession,uuid(114),firstCapture),{...firstReceipt,repeated:true})
  assert.deepEqual(recover(firstSession,uuid(113),capture('Changed body',{task:uuid(111)})),{recorded:false,reason_code:'command_conflict'})
  assert.deepEqual(recover(firstSession,uuid(114),capture('Changed body',{task:uuid(111)})),{recorded:false,reason_code:'session_conflict'})
  assert.equal(count(),before)
})

await test('observed ending, absent start and proven empty are distinct; no invented timestamps or exit code',()=>{
  for(const [n,c] of [[120,capture('Ended, code unavailable',{observed:true,started_at:null})],
    [121,capture('',{observed:true,empty:true})],[122,capture('No start or end',{started_at:null})]]){
    const s=open(n),r=recover(s,uuid(n+1000),c);assert.equal(r.recorded,true)
    assert.equal(row(s).started_at===null,c.started_at===null)
    assert.equal(row(s).ended_at===null,c.ended_at===null);assert.equal(row(s).exit_code,null)
    assert.equal(row(s).lines,c.lines);assert.equal(row(s).bytes,c.bytes)
  }
})

await test('historical task binding survives a newer session; omission and foreign task do not',()=>{
  const s=open(130),task=uuid(131),newer=uuid(132)
  append('task.created@1',{id:task,instruction:'Historical binding',session_id:s,option_id:'claude-code'})
  append('task.session.attached@1',{id:task,session_id:newer})
  const before=count()
  assert.equal(recover(s,uuid(133),capture()).reason_code,'task_conflict')
  assert.equal(recover(s,uuid(134),capture('x',{task:uuid(111)})).reason_code,'task_conflict')
  assert.equal(count(),before)
  assert.equal(recover(s,uuid(135),capture('historical body',{task})).recorded,true)
  assert.equal(rows(`select session_id from project_tasks where id=${lit(task,'uuid')}`)[0].session_id,newer)
})

await test('missing session, wrong provider, cross-project/Estate identity and reused command refuse without effects',()=>{
  const otherEstate=uuid(140),otherProject=uuid(141),otherTask=uuid(142),s=open(143)
  sql(`insert into estates(id,name) values (${lit(otherEstate,'uuid')},'other')`)
  append('project.created@1',{id:otherProject,name:'Other'},{e:otherEstate,p:otherProject})
  append('task.created@1',{id:otherTask,instruction:'Other',option_id:'claude-code'},{e:otherEstate,p:otherProject})
  const before=count()
  for(const [ss,cc,cap,scope,reason] of [
    [uuid(144),uuid(145),capture(),{},'session_not_found'],
    [s,uuid(145),capture('x',{option_id:'codex'}),{},'session_not_found'],
    [s,uuid(145),capture(),{p:otherProject},'project_not_found'],
    [s,uuid(145),capture(),{e:otherEstate,p:otherProject},'session_not_found'],
    [s,uuid(145),capture('x',{task:otherTask}),{},'task_not_bound'],
    [s,uuid(113),capture(),{},'command_conflict']])
    assert.deepEqual(recover(ss,cc,cap,scope),{recorded:false,reason_code:reason})
  assert.equal(count(),before)
  // Even a duplicated historical open cannot relocate a global session.
  append('terminal.opened@1',{session_id:s,option_id:'claude-code'},{e:otherEstate,p:otherProject})
  assert.equal(recover(s,uuid(146),capture()).reason_code,'session_conflict')
})

await test('payload schema, bounds, hashes, byte/line counts and dates are strictly checked',()=>{
  const s=open(150),good=capture(),before=count()
  const bad=[null,[],{}, {...good,extra:'not permitted'}, {...good,bytes:good.bytes+1},
    {...good,sha256:'0'.repeat(64)},{...good,lines:1}, {...good,bytes:1.1},{...good,lines:'2'},
    {...good,truncated:1},{...good,task_id:7},{...good,task_id:'not-a-uuid'},
    {...good,option_id:''},{...good,option_id:[]},{...good,annotation:'x'.repeat(8193)},
    {...good,excerpt:'x'.repeat(32769)},capture('x'.repeat(8000001),{excerpt:''}),
    {...good,ending_provenance:'observed'}, {...good,ended_at:'2026-09-27T00:01:00.000Z'},
    {...good,exit_code:0},{...good,capture_state:'empty'},{...good,started_at:''},
    {...good,started_at:'now'},{...good,started_at:'2026-02-30T00:00:00Z'},
    {...good,started_at:'2026-09-27T24:00:00Z'}, {...good,started_at:'infinity'},
    {...good,started_at:7},capture('ended',{observed:true,ended_at:'2026-09-26T00:01:00Z'}),
    capture('ended',{observed:true,exit_code:2**31}),capture('ended',{observed:true,exit_code:0.5}),
    capture('',{empty:true}),capture(' \n'),capture('',{observed:true,empty:true,annotation:'not empty'})]
  for(const [i,c] of bad.entries()){const reply=recover(s,uuid(1500+i),c);assert.equal(reply.recorded,false,`negative ${i}`)}
  assert.equal(count(),before);assert.equal(row(s),undefined)
})

await test('ordinary writer cannot forge @2 and private authorization/projector doors stay closed',()=>{
  const payload=rows(`select payload from journal where type='transcript.captured@2' and payload->>'session_id'=${lit(firstSession,'text')}`)[0].payload
  const before=count()
  assert.throws(()=>append('transcript.captured@2',payload))
  for(const role of ['anon','authenticated']) assert.throws(()=>sql(query(firstSession,uuid(113),firstCapture).replace('role service_role',`role ${role}`)))
  assert.throws(()=>sql('set role service_role; insert into transcript_recovery_authorizations values (txid_current(),null,null,null)'))
  assert.throws(()=>sql('set role service_role; select apply_transcript_capture(null::journal)'))
  assert.equal(count(),before);assert.equal(sql('select count(*) from transcript_recovery_authorizations'),'0')
})

await test('owner projection, dispatcher replay and archive restore reject malformed recovery identity and schema',()=>{
  const original=rows(`select * from journal where type='transcript.captured@2' and payload->>'session_id'=${lit(firstSession,'text')}`)[0]
  const malformed=[]
  for(const field of ['session_id','command_id']){
    for(const value of [null,7,[],{},'',true])
      malformed.push({...original,payload:{...original.payload,[field]:value}})
    const payload={...original.payload};delete payload[field]
    malformed.push({...original,payload})
  }
  for(const schema_rev of ['1',null,'',7]) malformed.push({...original,schema_rev})
  const withoutSchema={...original};delete withoutSchema.schema_rev;malformed.push(withoutSchema)
  const before=rows('select * from session_transcripts order by session_id'),events=count(),runtime=runtimeSnapshot()
  const rejected=fn=>assert.throws(fn,error=>
    /Invalid recovered transcript event/.test(String(error.stderr)),
    'the projector must refuse the invalid event itself, not rely on an unrelated constraint')
  for(const [i,event] of malformed.entries()){
    const composite=`jsonb_populate_record(null::journal,${lit(event)})`
    rejected(()=>sql(`select apply_transcript_capture(${composite})`))
    // Older dispatcher members parse session UUIDs before this projector runs.
    // Both rejection paths must roll back; the direct call above proves the
    // recovery guard itself does not depend on those unrelated parsers.
    const replayRejected=fn=>assert.throws(fn,error=>
      /Invalid recovered transcript event|invalid input syntax for type uuid/.test(String(error.stderr)))
    replayRejected(()=>sql(`select apply_projections(${composite})`))
    // Restore must enforce the same predicate even without an authorization row.
    // This one-event archive isolates recovery validation from project collisions.
    const target=uuid(3000+i)
    replayRejected(()=>sql(`set role service_role;select restore_estate(${lit(target,'uuid')},${lit(estate,'uuid')},'invalid archive',${lit([event])})`))
    assert.equal(sql(`select count(*) from estates where id=${lit(target,'uuid')}`),'0')
  }
  assert.deepEqual(rows('select * from session_transcripts order by session_id'),before)
  assert.equal(count(),events);assert.equal(runtimeSnapshot(),runtime)
  assert.equal(sql('select count(*) from transcript_recovery_authorizations'),'0')
})

await test('legacy and already sealed rows cannot be replaced by weaker recovery',()=>{
  const before=count(),legacy=row(uuid(101)),sealed=row(uuid(120))
  assert.equal(recover(uuid(101),uuid(160),capture()).reason_code,'existing_capture')
  assert.equal(recover(uuid(120),uuid(161),capture()).reason_code,'session_conflict')
  assert.deepEqual(row(uuid(101)),legacy);assert.deepEqual(row(uuid(120)),sealed);assert.equal(count(),before)
})

await test('projection failure rolls back journal, authorization and receipt; explicit rollback leaves no partial capture',()=>{
  const s=open(170),cap=capture(),before=count()
  sql(`create function fixture_refuse_capture() returns trigger language plpgsql as $$ begin raise exception 'fixture'; end $$;
    create trigger fixture_refuse before insert on session_transcripts for each row execute function fixture_refuse_capture();`)
  assert.throws(()=>recover(s,uuid(171),cap))
  assert.equal(count(),before);assert.equal(row(s),undefined);assert.equal(sql('select count(*) from transcript_recovery_authorizations'),'0')
  sql('drop trigger fixture_refuse on session_transcripts; drop function fixture_refuse_capture()')
  sql('begin;'+query(s,uuid(171),cap)+'rollback;')
  assert.equal(count(),before);assert.equal(row(s),undefined)
  assert.equal(recover(s,uuid(171),cap).repeated,false)
})

await test('full dispatcher and upsert replay preserve new and legacy captures without touching runtime outcomes',()=>{
  const before=rows('select * from session_transcripts order by session_id')
  const runtime=runtimeSnapshot()
  sql(`set role service_role; select rebuild_estate_projections(${lit(estate,'uuid')})`)
  assert.deepEqual(rows('select * from session_transcripts order by session_id'),before)
  // Existing rebuild semantics may reconstruct operational leases; this packet
  // does not claim to change that. Exact Run outcomes and Task state stay intact.
  const runs=JSON.parse(runtime).runs,tasks=JSON.parse(runtime).tasks,stops=JSON.parse(runtime).stops
  assert.deepEqual(rows('select * from task_runs order by task_run_id'),runs)
  assert.deepEqual(rows('select * from project_tasks order by id'),tasks)
  assert.deepEqual(rows('select * from run_stop_commands order by command_id'),stops)
  // Remove only transcript projections, as an actual empty-projection replay.
  sql(`delete from session_transcripts where estate_id=${lit(estate,'uuid')};set role service_role;select rebuild_estate_projections(${lit(estate,'uuid')})`)
  assert.deepEqual(rows('select * from session_transcripts order by session_id'),before)
})

await test('later @1 known capture keeps its original semantics across replay',()=>{
  const s=open(180),cap=capture('partial');assert.equal(recover(s,uuid(181),cap).recorded,true)
  append('transcript.captured@1',{session_id:s,sha256:'legacy-later-exact',body:'later known',started_at:'2026-01-01T00:00:00Z',ended_at:'2026-01-01T00:02:00Z',exit_code:0})
  const before=row(s);assert.equal(before.ending_provenance,'legacy');assert.equal(before.body,'later known')
  sql(`set role service_role;select rebuild_estate_projections(${lit(estate,'uuid')})`)
  assert.deepEqual(row(s),before)
})

const asyncSql=input=>runPsqlAsync(path.join(process.env.FABRIC_TRANSCRIPT_RECOVERY_PG_BIN,'psql'),[
  '-h',dir,'-p','58440','-U','postgres','-d','fabric_transcript_recovery_test_owned',
  '-X','-q','-t','-A','-v','ON_ERROR_STOP=1'
],input,{label:'Owned concurrent SQL fixture'}).then(r=>{if(r.code)throw new Error('Owned concurrent SQL fixture failed');return r.stdout.trim()})
await test('concurrent same-command and same-session requests return one durable receipt',async()=>{
  const session=open(190),cap=capture('concurrent'),before=count()
  const result=await Promise.all([
    asyncSql('begin;'+query(session,uuid(191),cap)+'select pg_sleep(0.15);commit;'),
    asyncSql(query(session,uuid(191),cap)),
    asyncSql(query(session,uuid(192),cap))
  ])
  const replies=result.map(JSON.parse)
  assert.equal(replies.filter(r=>r.repeated===false).length,1)
  assert.ok(replies.every(r=>r.recorded===true))
  for(const r of replies)assert.deepEqual({...r,repeated:false},{...replies[0],repeated:false})
  assert.equal(count(),before+1)
  assert.equal(sql('select count(*) from transcript_recovery_authorizations'),'0')
  // Distinct sessions in distinct Estates also serialize one shared command.
  const foreignEstate=uuid(195),foreignProject=uuid(196)
  sql(`insert into estates(id,name) values (${lit(foreignEstate,'uuid')},'concurrent foreign')`)
  append('project.created@1',{id:foreignProject,name:'concurrent foreign'},{e:foreignEstate,p:foreignProject})
  const a=open(197),b=open(198,{e:foreignEstate,p:foreignProject}),n=count()
  const race=(await Promise.all([
    asyncSql('begin;'+query(a,uuid(199),cap)+'select pg_sleep(0.15);commit;'),
    asyncSql(query(b,uuid(199),cap,{e:foreignEstate,p:foreignProject}))
  ])).map(JSON.parse)
  assert.equal(race.filter(r=>r.recorded===true).length,1)
  assert.equal(race.find(r=>!r.recorded).reason_code,'command_conflict')
  assert.equal(count(),n+1)
})

await test('journal-only restore preserves unknown metadata and legacy facts without operational authorization rows',()=>{
  const source=uuid(200),target=uuid(201),p=uuid(202)
  sql(`insert into estates(id,name) values (${lit(source,'uuid')},'archive source')`)
  append('project.created@1',{id:p,name:'archive project'},{e:source,p})
  const session=open(203,{e:source,p}),cap=capture('archived unknown',{started_at:null})
  assert.equal(recover(session,uuid(204),cap,{e:source,p}).recorded,true)
  append('transcript.captured@1',{session_id:uuid(205),sha256:'original-legacy',body:'old',ended_at:'2025-02-01T00:00:00Z'},{e:source,p})
  const before=rows(`select * from session_transcripts where estate_id=${lit(source,'uuid')} order by session_id`)
  const archive=rows(`select * from journal where estate_id=${lit(source,'uuid')} order by seq`)
  // Existing restore requires non-colliding globally keyed projections. Remove
  // these fixture projections, never source history, to model a fresh target DB.
  sql(`delete from session_transcripts where estate_id=${lit(source,'uuid')};delete from projects where estate_id=${lit(source,'uuid')}`)
  const reply=JSON.parse(sql(`set role service_role;select restore_estate(${lit(target,'uuid')},${lit(source,'uuid')},'restored',${lit(archive)})`))
  assert.equal(reply.restored,true)
  const expected=before.map(r=>({...r,estate_id:target}))
  assert.deepEqual(rows(`select * from session_transcripts where estate_id=${lit(target,'uuid')} order by session_id`),expected)
  sql(`set role service_role;select rebuild_estate_projections(${lit(target,'uuid')})`)
  assert.deepEqual(rows(`select * from session_transcripts where estate_id=${lit(target,'uuid')} order by session_id`),expected)
  assert.equal(sql('select count(*) from transcript_recovery_authorizations'),'0')
})

await test('actual disk recovery coordinator validates SQL receipt after lost response and preserves unknown ending',async()=>{
  const session=open(9501), captureRoot=path.join(dir,'capture-fixture')
  const writer=createTranscriptStore({root:captureRoot})
  writer.open(session,{projectId:project,taskId:null,optionId:'claude-code',startedAt:'2026-09-27T00:00:00.000Z'})
  writer.write(session,'Actual saved output before restart.\n')
  const restarted=createTranscriptStore({root:captureRoot});let first=true;const calls=[]
  const attempt=createTranscriptRecovery({estateId:estate,recover:page=>restarted.recoverFinalizations(page),settle:id=>restarted.settle(id),
    db:{rpc:async(name,args)=>{assert.equal(name,'recover_transcript');calls.push(structuredClone(args));const receipt=recover(args.p_session_id,args.p_command_id,args.p_capture,{e:args.p_estate_id,p:args.p_project_id});if(first){first=false;throw Error('synthetic lost reply')}return {data:receipt,error:null}}}})
  assert.equal((await attempt()).retained,1)
  assert.equal(restarted.recoverFinalizations().items.length,1)
  assert.equal((await attempt()).recorded,1)
  assert.deepEqual(calls[0],calls[1]);assert.equal(restarted.recoverFinalizations().items.length,0)
  assert.equal(row(session).ended_at,null);assert.equal(row(session).ending_provenance,'unknown')
  assert.equal(row(session).body,'Actual saved output before restart.\n')
})

console.log(`PASS transcript recovery SQL acceptance: ${passed} groups, ${migrations.length} actual migrations`)
