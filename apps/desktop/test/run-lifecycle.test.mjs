// One admitted task, one session, one ending that cannot be rewritten (AX-01).
//
// MEASURED at d28c321 and the shape of it is worth stating: the TABLE was
// complete and the RUNTIME was absent. `task_runs` had five states, an outcome
// vocabulary, an `outcome_only_when_ended` constraint, an `ended_has_a_receipt`
// constraint and a trigger refusing to reopen an ended run — and nothing in the
// main process had ever appended a `run.ended@1`. Every admitted run stayed
// `admitted` for ever.
//
// The packet forbids counting a SQL unit probe as runtime proof, and it is
// right to: the lifecycle lives in a module the application wires, and a
// function tested through `psql` proves the function. So this drives the real
// module, against the real database, through the whole path an application
// takes — admit, bind to the session the pty actually minted, exit, and a
// restart that finds a run whose process is gone. Nothing is spawned; the pty is
// the one thing faked, because the question is what the RECORD says.
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const HERE = import.meta.dirname
const script = `
import { createClient } from '@supabase/supabase-js'
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createAdmitExisting } from ${JSON.stringify(path.join(HERE, '../src/main/admitExisting.ts'))}
import { createRunLifecycle } from ${JSON.stringify(path.join(HERE, '../src/main/runLifecycle.ts'))}
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const journal = createJournal(db)
const ESTATE = randomUUID()
const ACTOR = { kind: 'system', id: 'run-probe' }

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

const rawAdmit = createAdmitExisting(db)
const admit = async input => {
  const admitted = await rawAdmit(input)
  if (admitted.admitted) {
    const { data, error } = await db.rpc('begin_task_run_launch', {
      p_estate_id: ESTATE, p_run_id: admitted.receipt.task_run_id,
      p_session_id: input.sessionId, p_actor: ACTOR
    })
    if (error || data?.granted !== true) throw Error('managed fixture begin failed')
  }
  return admitted
}
const runs = createRunLifecycle({ db, estateId: ESTATE, actor: ACTOR })

const project = async () => {
  const id = randomUUID()
  await journal.append({ estateId: ESTATE, type: 'project.created@1', actor: ACTOR, projectId: id,
    payload: { id, name: 'run probe' } })
  return id
}
const task = async (projectId, title) => {
  const id = randomUUID()
  await journal.append({ estateId: ESTATE, type: 'task.created@1', actor: ACTOR, projectId,
    payload: { id, title, instruction: title, origin: { kind: 'person', ref: 'probe' } } })
  return id
}
const rowOf = async (runId) =>
  (await db.from('task_runs').select('*').eq('estate_id', ESTATE).eq('task_run_id', runId).maybeSingle()).data

const P = await project()

// ── 1 · one start, one run, the SESSION THAT RAN, and an ending ─────────────
{
  const t = await task(P, 'the whole path')
  const admissionSession = randomUUID()
  const a = await admit({ estateId: ESTATE, taskId: t, actor: ACTOR, sessionId: admissionSession, trigger: 'operator' })
  if (!a.admitted) { fail('admission refused: ' + JSON.stringify(a)); }
  else {
    const runId = a.receipt.task_run_id
    const before = await rowOf(runId)
    before?.state === 'launching' && before.session_id === admissionSession
      ? ok('an admitted run exists, carrying the id minted BEFORE the spawn')
      : fail('after admission: ' + JSON.stringify(before))

    // Native PTY receives the identity already consumed by begin.
    const ptySession = admissionSession
    const bound = await runs.bind(runId, ptySession)
    const afterBind = await rowOf(runId)
    bound.ok && afterBind?.session_id === ptySession && afterBind.state === 'active'
      ? ok('binding moves the run onto the session that ACTUALLY ran it, and marks it active')
      : fail('after bind: ' + JSON.stringify(bound) + ' / ' + JSON.stringify(afterBind))

    const ended = await runs.endForSession(ptySession, { code: 0 })
    const afterEnd = await rowOf(runId)
    ended?.ok && afterEnd?.state === 'ended' && afterEnd.outcome === 'completed' && afterEnd.ended_seq
      ? ok('the session exiting ends the run it was carrying, with a receipt')
      : fail('after exit: ' + JSON.stringify(ended) + ' / ' + JSON.stringify(afterEnd))
  }
}

// ── 2 · an ended run is immutable, and a second ending is not a second story ─
{
  const t = await task(P, 'ends once')
  const a = await admit({ estateId: ESTATE, taskId: t, actor: ACTOR, sessionId: randomUUID(), trigger: 'operator' })
  const runId = a.receipt.task_run_id
  const s = a.receipt.session_id
  await runs.bind(runId, s)
  await runs.end(runId, 'completed')
  const second = await runs.end(runId, 'failed_known', 'a restart also saw this')
  const row = await rowOf(runId)
  second.ok && second.outcome === 'completed' && row.outcome === 'completed'
    ? ok('a second ending returns the FIRST outcome rather than overwriting it')
    : fail('second ending: ' + JSON.stringify(second) + ' / row ' + JSON.stringify(row))

  const { count } = await db.from('journal').select('seq', { count: 'exact', head: true })
    .eq('estate_id', ESTATE).eq('type', 'run.ended@1')
  const rebind = await runs.bind(runId, randomUUID())
  !rebind.ok && rebind.reasonCode === 'ended'
    ? ok('and an ended run does not take a new session')
    : fail('rebinding an ended run: ' + JSON.stringify(rebind))
  void count
}

// ── 3 · a second generation does not steal a live run ───────────────────────
{
  const t = await task(P, 'one generation')
  const a = await admit({ estateId: ESTATE, taskId: t, actor: ACTOR, sessionId: randomUUID(), trigger: 'operator' })
  const runId = a.receipt.task_run_id
  const first = a.receipt.session_id
  await runs.bind(runId, first)
  const second = await runs.bind(runId, randomUUID())
  const row = await rowOf(runId)
  // `session_conflict`, the managed-launch contract (migration 61/62, HAR-R0-03).
  // This expected migration 55's `already_bound` long after the command stopped
  // returning it; `run-lifecycle-contract.test.mjs` now keeps the two in step.
  !second.ok && second.reasonCode === 'session_conflict' && row.session_id === first
    ? ok('a run already attached to a live session refuses a second process')
    : fail('second generation: ' + JSON.stringify(second) + ' / ' + JSON.stringify(row))

  const same = await runs.bind(runId, first)
  same.ok
    ? ok('and binding the SAME session again is not a second generation')
    : fail('re-binding the same session was refused: ' + JSON.stringify(same))
}

// ── 4 · a spawn that threw ends a failed run rather than leaving it admitted ─
{
  const t = await task(P, 'spawn threw')
  const a = await admit({ estateId: ESTATE, taskId: t, actor: ACTOR, sessionId: randomUUID(), trigger: 'chain' })
  const runId = a.receipt.task_run_id
  await runs.end(runId, 'failed_known', 'the spawn threw before a process existed')
  const row = await rowOf(runId)
  row?.state === 'ended' && row.outcome === 'failed_known'
    ? ok('a spawn that threw ends the run it was admitted for, as a KNOWN failure')
    : fail('after a failed spawn: ' + JSON.stringify(row))
}

// ── 5 · a restart observes absence without inventing an ending ────────
{
  const t = await task(P, 'the process is gone')
  const a = await admit({ estateId: ESTATE, taskId: t, actor: ACTOR, sessionId: randomUUID(), trigger: 'operator' })
  const runId = a.receipt.task_run_id
  const gone = a.receipt.session_id
  await runs.bind(runId, gone)

  const live = await task(P, 'still running')
  const b = await admit({ estateId: ESTATE, taskId: live, actor: ACTOR, sessionId: randomUUID(), trigger: 'operator' })
  const liveSession = b.receipt.session_id
  await runs.bind(b.receipt.task_run_id, liveSession)

  const result = await runs.reconcile([liveSession])
  const dead = await rowOf(runId)
  const alive = await rowOf(b.receipt.task_run_id)
  result.ended === 0 && result.unobserved >= 1 && dead?.state === 'active'
    ? ok('a local absence remains unresolved; it never ends a potentially remote run')
    : fail('reconcile: ' + JSON.stringify(result) + ' / ' + JSON.stringify(dead))
  alive?.state === 'active'
    ? ok('and it leaves the run whose session IS live exactly where it was')
    : fail('the live run was ended too: ' + JSON.stringify(alive))
}

// ── 6 · a run that was never admitted is not invented ───────────────────────
{
  const missing = await runs.end(randomUUID(), 'completed')
  !missing.ok && missing.reasonCode === 'not_found'
    ? ok('ending a run that does not exist says so, rather than creating one')
    : fail('ending a missing run: ' + JSON.stringify(missing))

  const nonsense = await runs.end(randomUUID(), 'triumphant')
  !nonsense.ok && nonsense.reasonCode === 'unknown_outcome'
    ? ok('and an outcome the vocabulary does not have is refused by name')
    : fail('an invented outcome was accepted: ' + JSON.stringify(nonsense))
}

// ── 7 · a session with no run is the ordinary case, not a failure ──────────
{
  const none = await runs.endForSession(randomUUID(), { code: 0 })
  none === null
    ? ok('a plain terminal exiting ends nothing and reports nothing')
    : fail('a session with no run produced: ' + JSON.stringify(none))
}

// ── 7b · a command that could not RUN is not a decision ───────────────────
//
// The branch this reaches had no test until a plant walked past it: every call
// in this probe succeeds, so the error path was code nobody had ever executed.
// A malformed id is refused by Postgres before the function body runs, which is
// the cheapest way to make the transport fail for real rather than with a fake.
{
  // The CODE alone cannot tell the two branches apart — a dropped error also
  // ends at "unavailable", by way of a null answer. What distinguishes them is
  // whether the database's own words survive, so that is what is asserted. A
  // plant walked past the first version of this case for exactly that reason.
  const bad = await runs.bind('not-a-uuid', randomUUID())
  !bad.ok && bad.reasonCode === 'unavailable' && (bad.says ?? '').includes('invalid input syntax')
    ? ok('a bind the database refused outright is unavailable, and carries what the database said')
    : fail('a failed bind produced: ' + JSON.stringify(bad))

  const badEnd = await runs.end('not-a-uuid', 'completed')
  !badEnd.ok && badEnd.reasonCode === 'unavailable' && (badEnd.says ?? '').includes('invalid input syntax')
    ? ok('and so is an ending it refused, with its reason intact')
    : fail('a failed end produced: ' + JSON.stringify(badEnd))

  const badReconcile = await runs.reconcile(['not-a-uuid'])
  badReconcile.ended === 0
    ? ok('a reconciliation that could not run ends nothing rather than guessing')
    : fail('a failed reconcile reported: ' + JSON.stringify(badReconcile))
}

// ── 8 · replay rebuilds the same lifecycle ─────────────────────────────────
{
  const shape = async () => {
    const { data } = await db.from('task_runs').select('task_run_id,state,outcome,session_id')
      .eq('estate_id', ESTATE).order('task_run_id')
    return JSON.stringify(data)
  }
  const live = await shape()
  const { error } = await db.rpc('rebuild_estate_projections', { p_estate_id: ESTATE })
  if (error) fail('replay failed on the lifecycle it recorded: ' + error.message)
  else if (await shape() === live) ok('replay rebuilds every run in the state the runtime left it')
  else fail('replay differs. live: ' + live + ' | replay: ' + (await shape()))
}

await db.from('journal').delete().eq('estate_id', ESTATE)
console.log(failures ? '  FAIL ' + failures + ' failure(s)' : '\\nall green')
process.exit(failures ? 1 : 0)
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
  process.stdout.write(out.split('\n').filter((l) => /^\s+(ok|FAIL)/.test(l)).join('\n') + '\n')
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}
