// Acceptance boundary: actual TS adapters -> named SQL RPCs -> real projections.
// Invoke through run-command-ingress-db.mjs; HTTP/MCP/provider conformance is NOT_RUN.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { createJournal } from '../../../packages/journal/src/index.ts'
import { createDesktopJournal, prepareAgentPayload, prepareTaskText } from '../src/main/desktopIngress.ts'
import { commitPreparedAnswer, commitPreparedImport } from '../src/main/commandIngressAdapters.ts'

const dir = process.env.FABRIC_INGRESS_DB_DIR, nonce = process.env.FABRIC_INGRESS_DB_NONCE
if (!dir || !nonce || !process.env.FABRIC_INGRESS_PG_BIN) {
  console.error('NOT_RUN: use run-command-ingress-db.mjs to create an owned disposable cluster')
  process.exit(2)
}
assert.match(path.basename(dir), /^fabric-ingress-[a-zA-Z0-9]+$/)
assert.equal(readFileSync(path.join(dir, 'owner'), 'utf8'), nonce)
const sql = input => execFileSync(path.join(process.env.FABRIC_INGRESS_PG_BIN, 'psql'), [
  '-h', dir, '-p', '58439', '-U', 'postgres', '-d', 'fabric_ingress_test_owned',
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
for (const file of migrations) {
  sql(readFileSync(new URL('../../../supabase/migrations/' + file, import.meta.url), 'utf8'))
  sql(`insert into supabase_migrations.schema_migrations values (${text(file.split('_')[0])})`)
}
assert.equal(Number(sql('select count(*) from supabase_migrations.schema_migrations')), migrations.length)

const signatures = {
  append_event: { p_estate_id:'uuid', p_type:'text', p_actor:'jsonb', p_payload:'jsonb',
    p_schema_rev:'text', p_project_id:'uuid', p_run_id:'uuid', p_node_id:'uuid' },
  answer_question: { p_estate_id:'uuid', p_project_id:'uuid', p_question_id:'uuid', p_command_id:'uuid',
    p_expected_revision:'integer', p_answer:'text', p_chosen_option:'text', p_basis:'jsonb', p_actor:'jsonb' },
  import_declared_snapshot: { p_estate_id:'uuid', p_command_id:'uuid', p_input_digest:'text', p_actor:'jsonb', p_events:'jsonb' }
}
const calls = []
async function rpc(name, args) {
  assert.ok(Object.hasOwn(signatures, name), 'only the three declared RPCs may execute')
  const spec = signatures[name]
  assert.deepEqual(Object.keys(args).sort(), Object.keys(spec).sort())
  const params = Object.entries(spec).map(([key, type]) => {
    const value = args[key]
    assert.notEqual(value, undefined)
    if (value === null) return `${key} => null::${type}`
    if (type === 'integer') assert.ok(Number.isSafeInteger(value))
    if (type === 'uuid') assert.match(value, /^[0-9a-f-]{36}$/i)
    return `${key} => ${text(type === 'jsonb' ? JSON.stringify(value) : String(value))}::${type}`
  })
  calls.push(structuredClone({name,args}))
  try {
    const result = sql(`set role service_role; select to_jsonb(public.${name}(${params.join(',')}));`)
    return { data: JSON.parse(result), error: null }
  } catch {
    // Neither raw errors nor SQL (which can contain synthetic input) are echoed.
    return { data: null, error: { code:'fixture_rpc_failed' } }
  }
}
const journal = createDesktopJournal(createJournal({rpc}, {maxAttempts:1}))
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const estate = uuid(1), project = uuid(2), task = uuid(3), question = uuid(4), command = uuid(5)
const actor = {kind:'person',id:uuid(6)}
const append = (type,payload, projectId=project) => journal.append({estateId:estate,projectId,type,payload,actor})
const rows = query => JSON.parse(sql(`select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (${query}) q`))
const journalCount = () => Number(sql('select count(*) from journal'))
const canary = 'syntheticIngressCanary', secret = `SERVICE_TOKEN=${canary}`
const token = 'sk-' + 'A'.repeat(48)
let passed = 0
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name) }
sql(`insert into estates(id,name) values (${text(estate)}::uuid,'ingress fixture')`)

await test('project/task/note/memory preparation reaches real projections without secret fragments', async () => {
  await append('project.created@1',{id:project,name:'Ingress fixture',purpose:secret})
  const prepared = prepareTaskText('x'.repeat(150) + ' ' + token)
  await append('task.created@1',{id:task,...prepared,option_id:'claude-code'})
  await append('task.note.added@1',{task_id:task,note_id:uuid(7),body_md:secret})
  await append('memory.project.recorded@1',prepareAgentPayload('memory.project.recorded@1',{
    id:uuid(8),claim:secret,source_ref:'docs/decision.md:12',kind:'finding'
  }))
  const projected = rows(`select name,purpose from projects where id=${text(project)}::uuid`)[0]
  assert.equal(projected.purpose,'SERVICE_TOKEN=[redacted: assignment]')
  const actualTask = rows(`select title,instruction from project_tasks where id=${text(task)}::uuid`)[0]
  assert.deepEqual(actualTask,prepared)
  assert.equal(rows(`select body_md from task_notes where id=${text(uuid(7))}::uuid`)[0].body_md,'SERVICE_TOKEN=[redacted: assignment]')
  assert.equal(rows(`select claim from memory_facts where id=${text(uuid(8))}::uuid`)[0].claim,'SERVICE_TOKEN=[redacted: assignment]')
  const fact = rows(`select payload from journal where type='memory.project.recorded@1'`)[0].payload
  assert.equal(fact.redactions,'1 redacted (assignment×1)')
  assert.equal(fact.source_ref,'docs/decision.md:12')
  assert.ok(!JSON.stringify(rows('select payload from journal')).includes(canary))
  assert.ok(!JSON.stringify(rows('select payload from journal')).includes('AAAA'))
})

await test('invalid reference and uncovered version refuse before any RPC or journal change', async () => {
  const before=journalCount(), attempts=calls.length
  await assert.rejects(append('project.repo.attached@1',{id:uuid(9),path:`/tmp/${token}`,label:'unsafe'}))
  await assert.rejects(append('task.created@2',{id:uuid(10),instruction:'new version'}))
  await assert.rejects(append('task.note.added@1',{task_id:task,note_id:uuid(10),body_md:'safe',password:canary}))
  assert.equal(calls.length,attempts);assert.equal(journalCount(),before)
})

await test('safe immutable references and SQL punctuation preserve original bytes', async () => {
  const ref = "/tmp/O'Reilly/日本語\\repo; SELECT 1 --"
  await append('project.repo.attached@1',{id:uuid(11),path:ref,label:'Quoted repository'})
  const receipt=rows(`select payload from journal where type='project.repo.attached@1'`)[0].payload
  assert.equal(receipt.path,ref)
  assert.equal(rows(`select path from project_repos where id=${text(uuid(11))}::uuid`)[0].path,ref)
})

await test('answer option plus text is exact in SQL, memory and continuation; changed retry reports no new canonical text', async () => {
  // Legacy question producer uses its existing explicit owner policy. This
  // fixture contains no secret in the seed, so only the answer ingress is under test.
  await append('question.asked@1',{id:question,project_id:project,task_id:task,text:'Choose next step',
    why_blocked:'Needs owner',options:[],blocks:[task]})
  const revision=rows(`select revision from questions where id=${text(question)}::uuid`)[0].revision
  const delivered=[]
  const deps={estateId:estate,actor,rpc,continueAnswer:async(taskId,decisionId,answer)=>{
    delivered.push({taskId,decisionId,answer});return {state:'fixture_returned'}
  }}
  const input={commandId:command,questionId:question,projectId:project,expectedRevision:revision,
    chosenOption:'a',options:[{id:'a',label:`Authorization: Bearer ${canary}`}],answer:'Proceed with the safe plan'}
  const answer=await commitPreparedAnswer(deps,input)
  assert.equal(answer.state,'committed');assert.equal(answer.receipt.repeated,false)
  const canonical='Authorization: Bearer [redacted: authorization] — Proceed with the safe plan'
  assert.equal(answer.canonicalAnswer,canonical)
  assert.equal(calls.at(-1).args.p_answer,canonical)
  assert.equal(rows(`select answer from questions where id=${text(question)}::uuid`)[0].answer,canonical)
  assert.equal(rows(`select claim from memory_facts where id=${text(answer.receipt.decision_id)}::uuid`)[0].claim,canonical)
  assert.deepEqual(delivered,[{taskId:task,decisionId:answer.receipt.decision_id,answer:canonical}])
  const before=journalCount()
  const again=await commitPreparedAnswer(deps,{...input,answer:'Different retry text',chosenOption:'',options:[]})
  assert.equal(again.state,'committed');assert.equal(again.receipt.repeated,true)
  assert.equal(again.canonicalAnswer,null);assert.equal(again.receipt.decision_id,answer.receipt.decision_id)
  assert.equal(delivered.length,1);assert.equal(journalCount(),before)
  assert.equal(rows(`select answer from questions where id=${text(question)}::uuid`)[0].answer,canonical)
  const attempts=calls.length
  assert.equal((await commitPreparedAnswer(deps,{...input,answer:'',chosenOption:'',options:[]})).state,'refused')
  assert.equal(calls.length,attempts);assert.equal(journalCount(),before)
})

await test('atomic import preserves source digest and IDs, nullable bindings, retry and whole-batch refusal', async () => {
  const target=uuid(20), imported=uuid(21), agent=uuid(22), importCommand=uuid(23)
  sql(`insert into estates(id,name) values (${text(target)}::uuid,'import fixture')`)
  const inputDigest='AbCdEf12'.repeat(8)
  const input={commandId:importCommand,inputDigest,events:[
    {type:'project.created@1',project_id:imported,payload:{id:imported,name:'Imported',purpose:secret}},
    {type:'agent.registered@1',project_id:imported,payload:{id:agent,project_id:imported,name:'Imported agent',instructions:null,runner_id:null}}
  ]}
  const deps={estateId:target,actor,rpc}
  const before=journalCount(), attempts=calls.length
  const rejected=await commitPreparedImport(deps,{...input,events:[...input.events,
    {type:'project.created@1',project_id:uuid(24),payload:{id:uuid(24),name:'Bad',repo_path:`/tmp/${token}`}}]})
  assert.equal(rejected.state,'refused');assert.equal(journalCount(),before);assert.equal(calls.length,attempts)
  assert.equal(rows(`select id from projects where estate_id=${text(target)}::uuid`).length,0)
  // A privacy-valid batch can still fail the real domain constraint on its
  // second event. The first project/event must roll back in that same RPC.
  const domainFailure=await commitPreparedImport(deps,{...input,events:[input.events[0],
    {type:'agent.registered@1',project_id:uuid(99),payload:{id:agent,project_id:uuid(99),name:'Missing parent'}}]})
  assert.equal(domainFailure.state,'unconfirmed');assert.equal(calls.length,attempts+1)
  assert.equal(journalCount(),before)
  assert.equal(rows(`select id from projects where estate_id=${text(target)}::uuid`).length,0)
  const result=await commitPreparedImport(deps,input)
  assert.equal(result.state,'committed');assert.equal(result.receipt.commandId,importCommand)
  assert.equal(result.receipt.inputDigest,inputDigest);assert.equal(result.receipt.events,2)
  assert.equal(journalCount()-before,3,'two domain events and one atomic receipt')
  assert.equal(calls.at(-1).args.p_input_digest,inputDigest)
  assert.equal(rows(`select purpose from projects where id=${text(imported)}::uuid`)[0].purpose,'SERVICE_TOKEN=[redacted: assignment]')
  const binding=rows(`select id,instructions,provider_ref from agent_bindings where id=${text(agent)}::uuid`)[0]
  assert.deepEqual(binding,{id:agent,instructions:null,provider_ref:null})
  const after=journalCount(), repeat=await commitPreparedImport(deps,input)
  assert.equal(repeat.state,'committed');assert.equal(repeat.receipt.seq,result.receipt.seq);assert.equal(journalCount(),after)
  assert.ok(!JSON.stringify(rows('select payload from journal')).includes(canary))
})

console.log(`PASS command ingress SQL acceptance: ${passed} groups; ${migrations.length} actual migrations; service-role RPCs and projected rows verified`)
console.log('NOT_RUN actual HTTP/MCP transport, provider invocation and native end-to-end conformance')
