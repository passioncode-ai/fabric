// A chain hands the next step a named thing, or does not start it (slice 3).
//
// `chain.test.ts` proves the rules against fixtures. This drives the ADVANCER
// against the real store, because what a fixture cannot check is the two
// queries: which followers are waiting, and what their predecessor actually
// produced. The spawn is faked — everything else is the code under test.

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { createClient } from '@supabase/supabase-js'
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createAdmitExisting } from ${JSON.stringify(path.join(HERE, '../src/main/admitExisting.ts'))}
import { createManagedLaunch } from ${JSON.stringify(path.join(HERE, '../src/main/managedLaunch.ts'))}
import { createUnattendedAdmission } from ${JSON.stringify(path.join(HERE, '../src/shared/unattendedAdmission.ts'))}
import { createChainAdvance } from ${JSON.stringify(path.join(HERE, '../src/main/chainAdvance.ts'))}
import { createScopedStore } from ${JSON.stringify(path.join(HERE, '../src/main/scopedStore.ts'))}
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const journal = createJournal(db)
const ESTATE = randomUUID()
const ACTOR = { kind: 'system', id: 'chain-probe' }

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

const spawns = []
let failSpawn = false
const nativeSessions = new Map()
const launch = createManagedLaunch({
  db, estateId: ESTATE, actor: ACTOR, authority: () => null,
  admit: () => { throw Error('chain supplies its admission') },
  prepare: async (receipt, input) => async (sessionId, validate) => {
    if(!await validate()) throw Error('launch no longer valid')
    if (failSpawn) throw Error('no runner on this machine')
    nativeSessions.set(sessionId, {running:true})
    spawns.push({id:input.taskId, projectId:receipt.project_id, instruction:input.instruction, sessionId})
    return {sessionId}
  },
  track() {}, untrack() {}, get:id=>nativeSessions.get(id)??null,
  stop:async()=>{}, dispatch:async()=>({state:'delivering',says:'fixture write; no native ACK claimed'})
})
const startTask = async input => {
  const result = await launch({taskId:input.followerId, trigger:'chain',
    admission:input.launchAdmission, instruction:input.instruction})
  if(!result.started) throw Error(result.says)
  return {task:{id:input.followerId,project_id:input.projectId,status:'backlog'},session:{sessionId:result.sessionId}}
}

const task = async (projectId, title) => {
  const id = randomUUID()
  await journal.append({ estateId: ESTATE, type: 'task.created@1', actor: ACTOR, projectId,
    payload: { id, title, instruction: title, origin: { kind: 'person', ref: 'chain-probe' } } })
  return id
}

/** A → B, where B needs the names given. */
const chain = async (needs) => {
  const projectId = randomUUID()
  await journal.append({ estateId: ESTATE, type: 'project.created@1', actor: ACTOR, projectId,
    payload: { id: projectId, name: 'chain probe' } })
  const a = await task(projectId, 'produce it')
  const b = await task(projectId, 'Read {report} and say what to do.')
  await journal.append({ estateId: ESTATE, type: 'task.linked@1', actor: ACTOR, projectId,
    payload: { task_id: b, rel: 'follows', target_kind: 'task', target_id: a, needs } })
  return { projectId, a, b }
}
const close = async (projectId, id, outcome) =>
  journal.append({ estateId: ESTATE, type: 'task.closed@1', actor: ACTOR, projectId,
    payload: { task_id: id, outcome, reason: outcome === 'done' ? null : 'probe cancels' } })
const handoff = async (projectId, id, name, value) =>
  journal.append({ estateId: ESTATE, type: 'task.handoff@1', actor: ACTOR, projectId,
    payload: { task_id: id, name, value } })

// S02.a: one estate, as the product hands it over. Unscoped, this advance read
// every follows link in the database and would start another estate's chain.
const store = createScopedStore(db, { kind: 'estate', estateId: ESTATE })
// A chain step is UNATTENDED work, and until FA-03 nothing asked the account
// whether one could start. The gate the file DID consult, mayStartFanIn,
// answers whether the predecessors are done — a different question with a
// confusingly similar name.
const roomyQuota = () => async () => ({
  fiveHour: { utilization: 5, resetsAt: null },
  sevenDay: { utilization: 5, resetsAt: null },
  byModel: {}, readAt: new Date().toISOString(), ageSeconds: 1, problem: null,
  account: 'chain-probe'
})
// Fresh per advance, because each case here drives its own chain and a door
// shared across them would refuse the second case for the first case's start.
// The REAL admission command, against the real database. A fake here would
// prove the chain calls something; what has to be proved is that what it calls
// admits — the mechanism it used before was rejected by a check constraint on
// every single call, and read the rejection as another process winning.
const admitExisting = createAdmitExisting(db)
// The real lifecycle, so a chain dispatch closes the run it opened rather than
// leaving the estate claiming work is in flight (AX-01).
const advanceWith = (quota, admit) =>
  createChainAdvance({
    store, journal, quota, admission: createUnattendedAdmission(),
    admitExisting: admit ?? ((taskId, sessionId) =>
      admitExisting({ estateId: ESTATE, taskId, actor: { kind: 'system', id: 'chain' }, sessionId, trigger: 'chain' })),
    startTask, estateId: ESTATE
  })
const advance = () => advanceWith(roomyQuota())()
const spawnsIn = (p) => spawns.filter((s) => s.projectId === p)

// 1 — a finished predecessor that handed over what was asked starts the follower,
// and the brief is FILLED.
{
  const { projectId, a, b } = await chain(['report'])
  await handoff(projectId, a, 'report', 'three bugs, one blocked')
  await close(projectId, a, 'done')
  await advance()
  const started = spawnsIn(projectId)[0]
  started && started.instruction.includes('three bugs, one blocked')
    ? ok('a finished step starts the next one, with its named result in the brief')
    : fail('brief was: ' + JSON.stringify(started?.instruction))
  void b
}

// 2 — a CANCELLED predecessor starts nothing, and says so.
{
  const { projectId, a } = await chain(['report'])
  await handoff(projectId, a, 'report', 'x')
  await close(projectId, a, 'cancelled')
  await advance()
  const { data: paused } = await db.from('journal').select('payload')
    .eq('project_id', projectId).eq('type', 'routine.paused@1')
  spawnsIn(projectId).length === 0 && paused?.length === 1
    ? ok('a cancelled step starts nothing and the journal says why')
    : fail('cancelled: spawned ' + spawnsIn(projectId).length + ', paused ' + (paused?.length ?? 0))
}

// 3 — a MISSING input stops it, naming what was missing.
{
  const { projectId, a } = await chain(['report'])
  await close(projectId, a, 'done')
  await advance()
  const { data: paused } = await db.from('journal').select('payload')
    .eq('project_id', projectId).eq('type', 'routine.paused@1')
  const why = String(paused?.[0]?.payload?.reason ?? '')
  spawnsIn(projectId).length === 0 && why.includes('report')
    ? ok('a step whose named input never arrived does not run, and names it')
    : fail('missing input: spawned ' + spawnsIn(projectId).length + ', why ' + JSON.stringify(why))
}

// 4 — a name handed over EMPTY is the same as not handed over.
{
  const { projectId, a } = await chain(['report'])
  await handoff(projectId, a, 'report', '   ')
  await close(projectId, a, 'done')
  await advance()
  spawnsIn(projectId).length === 0
    ? ok('and an empty value under the right name does not count as arrival')
    : fail('an empty handoff started the next step')
}

// 5 — a predecessor still running is not a refusal; nothing is said.
{
  const { projectId } = await chain(['report'])
  await advance()
  const { data: paused } = await db.from('journal').select('seq')
    .eq('project_id', projectId).eq('type', 'routine.paused@1')
  spawnsIn(projectId).length === 0 && (paused?.length ?? 0) === 0
    ? ok('a predecessor that has not finished is quiet, not a refusal every minute')
    : fail('unfinished predecessor: paused ' + (paused?.length ?? 0))
}

// FA-03 — a chain step does not start on a quota nobody could read.
{
  const { projectId, a } = await chain(['report'])
  await handoff(projectId, a, 'report', 'ready')
  await close(projectId, a, 'done')
  await advanceWith(async () => null)()
  const started = spawnsIn(projectId).length
  started === 0
    ? ok('a chain step does NOT start when the account quota could not be read')
    : fail('an unreadable quota still started ' + started + ' chain session(s)')

  const { data: paused } = await db.from('journal').select('payload')
    .eq('estate_id', ESTATE).eq('type', 'routine.paused@1').eq('project_id', projectId)
  const named = (paused ?? []).some((r) => r.payload?.reason_code === 'no-reading')
  named
    ? ok('and it says so with a code, rather than stopping quietly')
    : fail('the pause did not name the quota: ' + JSON.stringify(paused))
}

// THE POSITIVE CONTROL, and this file needs one more than most. CO-118 means
// no chain step starts at all right now, so "started === 0" above is true
// whatever the quota says — a green that has not reached its condition. What
// distinguishes them is the RECEIPT: the quota branch writes a code no other
// path writes, and with a roomy reading it must not appear.
{
  const { projectId, a } = await chain(['report'])
  await handoff(projectId, a, 'report', 'ready')
  await close(projectId, a, 'done')
  await advance()
  const { data: paused } = await db.from('journal').select('payload')
    .eq('estate_id', ESTATE).eq('type', 'routine.paused@1').eq('project_id', projectId)
  const quotaPause = (paused ?? []).filter((r) =>
    ['no-reading', 'empty', 'already-spent', 'over-threshold'].includes(r.payload?.reason_code)
  )
  quotaPause.length === 0
    ? ok('and with a roomy reading the quota does not refuse — so the refusals above are the gate, not the silence')
    : fail('a roomy quota still refused: ' + JSON.stringify(quotaPause))
}

// And an EMPTY reading — an HTTP 200 that said nothing — is not permission.
{
  const { projectId, a } = await chain(['report'])
  await handoff(projectId, a, 'report', 'ready')
  await close(projectId, a, 'done')
  const empty = async () => ({
    fiveHour: null, sevenDay: null, byModel: {},
    readAt: new Date().toISOString(), ageSeconds: 1, problem: null, account: 'chain-probe'
  })
  await advanceWith(empty)()
  const { data: paused } = await db.from('journal').select('payload')
    .eq('estate_id', ESTATE).eq('type', 'routine.paused@1').eq('project_id', projectId)
  const named = (paused ?? []).some((r) => r.payload?.reason_code === 'empty')
  spawnsIn(projectId).length === 0 && named
    ? ok('a reading with no windows in it starts no chain step, and the receipt says which failure it was')
    : fail('empty reading: started ' + spawnsIn(projectId).length + ', receipts ' + JSON.stringify(paused))
}

// FA-02 — one shared admission: N repeats and two concurrent hosts produce ONE
// active run and ONE spawn.
//
// The lease is what serialises them, and it is taken inside the same command
// the operator's Run uses. Before this, the chain guarded itself with a
// conditional update to a status the database rejects, so the guard it thought
// it had was an error being read as healthy contention.
{
  const { projectId, a, b } = await chain(['report'])
  await handoff(projectId, a, 'report', 'ready')
  await close(projectId, a, 'done')
  const before = spawnsIn(projectId).length
  await Promise.all([advance(), advance(), advance()])
  const started = spawnsIn(projectId).length - before
  started === 1
    ? ok('three advances of one window start the follower exactly once')
    : fail('three advances started ' + started + ' session(s)')

  const { data: runs } = await db.from('task_runs').select('task_run_id,state').eq('estate_id', ESTATE).eq('task_id', b)
  ;(runs ?? []).length === 1
    ? ok('and exactly one TaskRun exists for the follower, not one per advance')
    : fail('task_runs for the follower: ' + JSON.stringify(runs))
}

// The follower is an EXISTING task. Advancing it must not create a second one.
{
  const { projectId, a, b } = await chain(['report'])
  await handoff(projectId, a, 'report', 'ready')
  await close(projectId, a, 'done')
  const { count: createdBefore } = await db.from('journal')
    .select('seq', { count: 'exact', head: true })
    .eq('estate_id', ESTATE).eq('project_id', projectId).eq('type', 'task.created@1')
  await advance()
  const { count: createdAfter } = await db.from('journal')
    .select('seq', { count: 'exact', head: true })
    .eq('estate_id', ESTATE).eq('project_id', projectId).eq('type', 'task.created@1')
  createdAfter === createdBefore
    ? ok('advancing a follower creates no second task — it starts the one that exists')
    : fail('advancing created ' + (createdAfter - createdBefore) + ' new task(s)')

  const { data: dispatch } = await db.from('journal').select('payload')
    .eq('estate_id', ESTATE).eq('project_id', projectId).eq('type', 'chain.dispatch@1')
  const names = (dispatch ?? []).some((r) => r.payload?.id === b && r.payload?.task_run_id)
  names
    ? ok('and the dispatch names the follower and the run the admission bore')
    : fail('the dispatch does not name its run: ' + JSON.stringify(dispatch))
}

// An admission that could not be ASKED is not an admission, and is not a lost
// race either. This is the exact shape the whole card turns on.
{
  const { projectId, a } = await chain(['report'])
  await handoff(projectId, a, 'report', 'ready')
  await close(projectId, a, 'done')
  const before = spawnsIn(projectId).length
  await advanceWith(roomyQuota(), async () => ({
    admitted: false, reasonCode: 'unavailable', says: 'the database was unreachable', retryable: true
  }))()
  spawnsIn(projectId).length === before
    ? ok('an admission that could not be asked starts nothing')
    : fail('an unavailable admission still started a session')

  const { data: paused } = await db.from('journal').select('payload')
    .eq('estate_id', ESTATE).eq('project_id', projectId).eq('type', 'routine.paused@1')
  ;(paused ?? []).some((r) => r.payload?.reason_code === 'unavailable')
    ? ok('and it says so, rather than standing down as if somebody else won')
    : fail('no unavailable receipt: ' + JSON.stringify(paused))
}

// A lease already held is CONTENTION, not a fault, and says nothing: a chain
// that logged a refusal every minute for a follower somebody is already running
// would fill the journal with noise.
{
  const { projectId, a } = await chain(['report'])
  await handoff(projectId, a, 'report', 'ready')
  await close(projectId, a, 'done')
  const before = (await db.from('journal').select('seq', { count: 'exact', head: true })
    .eq('estate_id', ESTATE).eq('project_id', projectId).eq('type', 'routine.paused@1')).count ?? 0
  await advanceWith(roomyQuota(), async () => ({
    admitted: false, reasonCode: 'lease_held', says: 'another launch is in flight', retryable: false
  }))()
  const after = (await db.from('journal').select('seq', { count: 'exact', head: true })
    .eq('estate_id', ESTATE).eq('project_id', projectId).eq('type', 'routine.paused@1')).count ?? 0
  after === before
    ? ok('a lease already held is quiet: contention is not a refusal worth journalling every minute')
    : fail('lease contention wrote ' + (after - before) + ' receipt(s)')
}

// AX-01 — a chain dispatch leaves a run attached to the session that ran it.
{
  const { projectId, a, b } = await chain(['report'])
  await handoff(projectId, a, 'report', 'ready')
  await close(projectId, a, 'done')
  await advance()
  const spawned = spawnsIn(projectId)[0]
  const { data: run } = await db.from('task_runs').select('session_id,state')
    .eq('estate_id', ESTATE).eq('task_id', b).maybeSingle()
  run && spawned && run.session_id === spawned.sessionId && run.state === 'active'
    ? ok('the chain binds its run to the session the spawn actually minted')
    : fail('run after a chain dispatch: ' + JSON.stringify(run) + ' vs spawn ' + JSON.stringify(spawned?.sessionId))
}

// And a spawn that throws does not leave the estate claiming work is in flight.
{
  const { projectId, a, b } = await chain(['report'])
  await handoff(projectId, a, 'report', 'ready')
  await close(projectId, a, 'done')
  const boom = createChainAdvance({
    store, journal, quota: roomyQuota(), admission: createUnattendedAdmission(),
    admitExisting: (taskId, sessionId) =>
      admitExisting({ estateId: ESTATE, taskId, actor: { kind: 'system', id: 'chain' }, sessionId, trigger: 'chain' }),
    startTask,
    estateId: ESTATE
  })
  failSpawn = true
  await boom()
  failSpawn = false
  const { data: run } = await db.from('task_runs').select('state,outcome')
    .eq('estate_id', ESTATE).eq('task_id', b).maybeSingle()
  run?.state === 'ended' && run.outcome === 'failed_known'
    ? ok('a chain spawn that throws ends the run it opened, as a known failure')
    : fail('run after a failed chain spawn: ' + JSON.stringify(run))
}

if (failures > 0) { console.log('\\n' + failures + ' chain failure(s)'); process.exit(1) }
`

const env = { ...process.env }
try {
  const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', cwd: path.resolve(HERE, '../../..') })
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/)
    if (!m) continue
    if (m[1] === 'API_URL') env.SUPABASE_URL = m[2]
    if (m[1] === 'SERVICE_ROLE_KEY') env.SUPABASE_SERVICE_ROLE_KEY = m[2]
  }
} catch {
  console.log('  FAIL the local stack is not running — this probe asserts nothing without it (no skip, M110).')
  process.exit(1)
}
try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script],
    { encoding: 'utf8', env, cwd: path.resolve(HERE, '..') })
  process.stdout.write(process.env.CHAIN_VERBOSE ? out : out.split('\n').filter((l) => /^\s+(ok|FAIL)/.test(l)).join('\n') + '\n')
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}
