// The one path that starts an agent with nobody watching (M13, M94, M132).
//
// Its pure parts were tested from the day they were written — which routines are
// due, whether the quota allows it, what the backlog brief says — and the code
// that puts the three together had been executed by NO check at all, because it
// lived in `index.ts` and `index.ts` cannot be imported (M110). "The file is
// unimportable" is a fact about the file, not a reason: it was extracted so this
// probe could drive it.
//
// The database and the journal are real. The QUOTA and the SPAWN are not: one
// would call Anthropic and the other would start an agent on this machine.
// Faking exactly those two is the point — everything between them is the code
// under test.

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { probeEnv } from '../../../scripts/lib/test-stack.mjs'

const HERE = import.meta.dirname
const script = `
import { createClient } from '@supabase/supabase-js'
import { createOps } from ${JSON.stringify(path.join(HERE, '../src/main/ops.ts'))}
import { useOps, ops as sink } from ${JSON.stringify(path.join(HERE, '../src/main/opsSink.ts'))}
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import nodePath from 'node:path'
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createUnattendedAdmission } from ${JSON.stringify(path.join(HERE, '../src/shared/unattendedAdmission.ts'))}
import { createRoutineTick } from ${JSON.stringify(path.join(HERE, '../src/main/routineTick.ts'))}
import { createScopedStore } from ${JSON.stringify(path.join(HERE, '../src/main/scopedStore.ts'))}
import { advancesWatermark } from ${JSON.stringify(path.join(HERE, '../src/shared/cyclePort.ts'))}
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const journal = createJournal(db)
const ESTATE = randomUUID()
const ACTOR = { kind: 'system', id: 'tick-probe' }
// S02.a: the tick is handed a client narrowed to THIS probe's estate, which is
// what the product does. Before the floor it read every enabled routine in the
// database — including the ones the other probes leave behind.
const store = createScopedStore(db, { kind: 'estate', estateId: ESTATE })
const projectId = randomUUID()

// The tick swallows its failures into ops.failed, and with no sink installed
// that is a no-op — so a broken tick looked exactly like a tick with nothing to
// do. The probe now installs one and prints what it caught.
useOps(createOps({ dir: mkdtempSync(nodePath.join(tmpdir(), 'fabric-tick-probe-')) }))
const tickFailures = () => sink.read({ level: 'error' }).filter((r) => r.op.startsWith('routineTick'))

// THE ESTATE IS FIXED AND SHARED, so every previous run of this probe left its
// never-run routines behind — twenty-five of them had accumulated, all
// permanently due. The suite stayed green while each tick started all
// twenty-five, because "spawnsIn(project)" counts one project and never asked
// how many sessions the tick opened in total. Cleaned at the start, so an
// assertion about "one pass" is about this run's routines.
await db.from('journal').delete().eq('estate_id', ESTATE).in('type', ['routine.defined@1', 'routine.ran@1'])
await db.from('routines').delete().eq('estate_id', ESTATE)

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

await journal.append({ estateId: ESTATE, type: 'project.created@1', actor: ACTOR, projectId,
  payload: { id: projectId, name: 'tick probe' } })

const freeQuota = async () => ({
  fiveHour: { utilization: 5, resetsAt: null },
  sevenDay: { utilization: 5, resetsAt: null },
  byModel: {}, readAt: new Date().toISOString(), ageSeconds: 1, problem: null,
  account: 'probe-account'
})

// What the REAL producer returns inside its TTL: the same reading, repeatedly.
// The helper above hands out a new read timestamp per call, which no producer
// does — and a probe that cannot reproduce the cache cannot see the defect that
// lives in it (FA-03).
const distinctFreeQuota = () => {
  // A DISTINCT reading per call, stated rather than accidental. A case that
  // measures the poll bound must not also be measuring the quota door, and the
  // free-quota helper stamps the clock — two calls inside one millisecond then
  // share a reading and the door refuses the second, which would make the poll
  // bound look smaller than it is for a reason that has nothing to do with it.
  let n = 0
  return async () => ({
    fiveHour: { utilization: 5, resetsAt: null },
    sevenDay: { utilization: 5, resetsAt: null },
    byModel: {}, readAt: new Date(Date.now() + n++).toISOString(), ageSeconds: 1,
    problem: null, account: 'probe-account'
  })
}

const cachedFreeQuota = () => {
  const reading = {
    fiveHour: { utilization: 5, resetsAt: null },
    sevenDay: { utilization: 5, resetsAt: null },
    byModel: {}, readAt: new Date().toISOString(), ageSeconds: 1, problem: null,
    account: 'probe-account'
  }
  return async () => reading
}

/**
 * Records what it was asked to start and JOURNALS NOTHING.
 *
 * The first version created a real task, and every one of them landed in the
 * backlog — so the empty-backlog case was asserting about a backlog its own fake
 * had filled. A fake that writes to the state under test is not a fake, and it
 * failed in the direction that looks like a code bug.
 *
 * The tick only needs an id back, and the "still running" check reads
 * project_tasks for it: an id with no row reads as not-open, which is what a
 * finished session looks like and is exactly right here.
 */
const spawns = []
const startTask = async (input) => {
  const id = randomUUID()
  spawns.push({ ...input, id })
  return { task: { id, project_id: input.projectId, status: 'running' } }
}

/**
 * A routine in a project of its OWN.
 *
 * Sharing one project made every later tick re-start the routines earlier cases
 * had left never-run, so a case asserting "nothing started" counted three
 * spawns that belonged to its predecessors. Isolation here is not tidiness: a
 * probe whose cases can see each other's state reports the wrong one as broken.
 */
const defineRoutine = async (kind, everyMinutes = 5) => {
  const id = randomUUID()
  const project = randomUUID()
  await journal.append({ estateId: ESTATE, type: 'project.created@1', actor: ACTOR,
    projectId: project, payload: { id: project, name: 'tick probe ' + id.slice(0, 8) } })
  await journal.append({ estateId: ESTATE, type: 'routine.defined@1', actor: ACTOR,
    projectId: project,
    payload: { id, project_id: project, instruction: 'probe routine',
               option_id: 'claude-code', every_minutes: everyMinutes, kind } })
  return { id, project }
}

/** Spawns for ONE project. The tick is estate-wide by design — it reads every
 *  enabled routine — so counting all spawns makes a case fail for work its
 *  predecessors left due. Assertions here are scoped the way the tick is not. */
const spawnsIn = (project) => spawns.filter((s) => s.projectId === project)

const pausesFor = async (id) => {
  const { data } = await db.from('journal').select('payload')
    .eq('type', 'routine.paused@1').eq('payload->>id', id)
  return data ?? []
}

// 1 — a due routine with a free quota STARTS, and the run is journalled.
{
  const { id, project } = await defineRoutine('fixed')
  const tick = createRoutineTick({ store, journal, quota: freeQuota, admission: createUnattendedAdmission(), startTask, estateId: ESTATE })
  await tick()
  spawnsIn(project).length === 1 ? ok('a routine that has never run starts, once')
    : fail('spawns in this project: ' + spawnsIn(project).length)

  const { data: after } = await db.from('routines').select('last_run_at,last_task_id').eq('id', id).single()
  after?.last_run_at && after.last_task_id
    ? ok('and the run is journalled, so the next tick knows it happened')
    : fail('routine after the run: ' + JSON.stringify(after))

  // 2 — the SECOND tick does not start it again: it is not due, and its task is open.
  const before = spawnsIn(project).length
  await tick()
  spawnsIn(project).length === before
    ? ok('a second tick does not start it again')
    : fail('the second tick started ' + (spawnsIn(project).length - before) + ' more')
}

// 3 — a blocked quota PAUSES with the reason, and starts nothing.
{
  const { id, project } = await defineRoutine('fixed')
  const full = async () => ({
    fiveHour: { utilization: 99, resetsAt: '2026-09-06T00:00:00Z' },
    sevenDay: null, byModel: {}, readAt: new Date().toISOString(), ageSeconds: 1, problem: null
  })
  const tick = createRoutineTick({ store, journal, quota: full, admission: createUnattendedAdmission(), startTask, estateId: ESTATE })
  await tick()
  spawnsIn(project).length === 0
    ? ok('a full quota starts nothing')
    : fail('the tick started work at 99% utilisation')

  const paused = await pausesFor(id)
  paused.length === 1 && String(paused[0].payload.reason).includes('five-hour')
    ? ok('and says why, naming the window — M94 asks it to pause AND SAY SO')
    : fail('pauses: ' + JSON.stringify(paused))
}

// 4 — an UNREADABLE quota blocks too. Absent is not zero.
{
  const { id, project } = await defineRoutine('fixed')
  const tick = createRoutineTick({ store, journal, quota: async () => null, admission: createUnattendedAdmission(), startTask, estateId: ESTATE })
  await tick()
  const paused = await pausesFor(id)
  spawnsIn(project).length === 0 && paused.length === 1
    ? ok('a quota that could not be read blocks unattended work rather than assuming room')
    : fail('unreadable quota: spawned ' + spawnsIn(project).length + ', paused ' + paused.length)
}

// 5 — a BACKLOG routine with an empty backlog does not start a session.
{
  const { id, project } = await defineRoutine('backlog')
  const tick = createRoutineTick({ store, journal, quota: freeQuota, admission: createUnattendedAdmission(), startTask, estateId: ESTATE })
  await tick()
  const paused = await pausesFor(id)
  spawnsIn(project).length === 0 && paused.some((p) => String(p.payload.reason).includes('backlog is empty'))
    ? ok('an empty backlog pauses instead of burning a session on nothing to do')
    : fail('empty backlog: spawned ' + spawnsIn(project).length + ', pauses ' + JSON.stringify(paused))
}

// 6 — with something in the backlog it starts, and the instruction is COMPOSED.
{
  const { id, project } = await defineRoutine('backlog')
  await journal.append({ estateId: ESTATE, type: 'task.created@1', actor: ACTOR,
    projectId: project,
    payload: { id: randomUUID(), title: 'the one thing in the backlog', instruction: 'x',
               origin: { kind: 'person', ref: 'tick-probe' } } })
  const tick = createRoutineTick({ store, journal, quota: freeQuota, admission: createUnattendedAdmission(), startTask, estateId: ESTATE })
  await tick()
  const started = spawnsIn(project).at(-1)
  started && started.instruction.includes('the one thing in the backlog')
    ? ok('a backlog routine is briefed with the backlog as it stands, not with what was typed')
    : fail('backlog brief was: ' + JSON.stringify(started?.instruction?.slice(0, 80)))
  void id
}

// 7 — TWO TICKS AT ONCE start the work once, not twice.
//
// The interval fires every minute and a slow pass can outlive it. Without the
// guard both passes read the same due list before either journals a run, and
// every routine due in that gap starts twice — two agents on one backlog, which
// is the contention the lease exists for, created by the scheduler itself.
//
// This case exists because removing the guard did NOT fail the probe: every
// other case awaits its tick, so the overlap it defends against never happened.
{
  const { project } = await defineRoutine('fixed')
  const tick = createRoutineTick({ store, journal, quota: freeQuota, admission: createUnattendedAdmission(), startTask, estateId: ESTATE })
  await Promise.all([tick(), tick()])
  spawnsIn(project).length === 1
    ? ok('two ticks overlapping start the work once, not twice')
    : fail('overlapping ticks started ' + spawnsIn(project).length + ' sessions')
}

// S15 — a poll is BOUNDED. Every routine whose interval elapsed used to start
// in one pass, so a day offline launched them all in the same second.
//
// In a project of its OWN, for the reason this file already records: a probe
// whose cases can see each other's state reports the wrong one as broken. Five
// never-run routines in the shared project made every EARLIER case count spawns
// that belonged to this one.
{
  const project = randomUUID()
  await journal.append({ estateId: ESTATE, type: 'project.created@1', actor: ACTOR,
    projectId: project, payload: { id: project, name: 'bounded poll' } })
  for (let n = 0; n < 5; n++)
    await journal.append({
      estateId: ESTATE, type: 'routine.defined@1', actor: ACTOR, projectId: project,
      payload: { id: randomUUID(), project_id: project, instruction: 'sweep ' + n,
                 option_id: 'claude-code', every_minutes: 60, kind: 'fixed' }
    })

  const boundedTick = createRoutineTick({ store, journal, quota: distinctFreeQuota(), admission: createUnattendedAdmission(), startTask, estateId: ESTATE })
  const before = (await db.from('journal').select('seq').eq('estate_id', ESTATE)
    .eq('type', 'cycle.ran@1')).data?.length ?? 0
  const pass = await boundedTick()
  const startedNow = spawnsIn(project).length
  startedNow > 0 && startedNow <= 3
    ? ok('five routines coming due at once start at most three in one pass (' + startedNow + ')')
    : fail('a single pass started ' + startedNow + ' sessions')

  // IT SAYS SO IN ITS RETURN VALUE, not in a receipt of its own (AX-08). The
  // tick used to append a second cycle.ran@1 whenever it deferred work, while
  // its caller appended one that said "completed" — two rows of one type for
  // one window, nothing joining them, and a reader taking the later one saw the
  // wrong state. The plan travels out instead, so there is ONE receipt and the
  // join it would have needed cannot be forgotten.
  pass.deferred > 0
    ? ok('and the pass SAYS how many it deferred — a poll that quietly took three of five reads as one that found three')
    : fail('the pass reported no deferral: ' + JSON.stringify(pass))
  pass.state === 'partial'
    ? ok('and a pass that deferred work is PARTIAL, which is what stops the watermark stepping over routines still due')
    : fail('a deferring pass reported ' + pass.state)

  const after = (await db.from('journal').select('seq').eq('estate_id', ESTATE)
    .eq('type', 'cycle.ran@1')).data?.length ?? 0
  after === before
    ? ok('and the tick wrote NO receipt of its own: one window, one row, no join id to forget')
    : fail('the tick appended ' + (after - before) + ' cycle receipt(s) of its own')
}

// FA-03 — one reading authorises ONE unattended start.
//
// MEASURED before this: the tick took ONE verdict outside the loop and started
// up to three routines from it. Three admissions against one observation of the
// remainder, the second and third on a number already out of date.
//
// The cached reading is the point. The free-quota helper hands out a new read
// timestamp per call, which no producer does — the real one caches inside its
// TTL — and a probe that cannot reproduce the cache cannot see the defect that
// lives in it.
//
// COUNTED ACROSS THE ESTATE, not inside one project. Earlier cases leave their
// own routines due, and the poll bound is estate-wide, so a project-scoped
// count here would measure which routines this poll happened to pick rather
// than how many starts one reading bought.
{
  const project = randomUUID()
  await journal.append({ estateId: ESTATE, type: 'project.created@1', actor: ACTOR,
    projectId: project, payload: { id: project, name: 'one reading one start' } })
  for (let n = 0; n < 3; n++)
    await journal.append({
      estateId: ESTATE, type: 'routine.defined@1', actor: ACTOR, projectId: project,
      payload: { id: randomUUID(), project_id: project, instruction: 'sweep ' + n,
                 option_id: 'claude-code', every_minutes: 60, kind: 'fixed' }
    })

  const before = spawns.length
  const pausedBefore = (await db.from('journal').select('seq', { count: 'exact', head: true })
    .eq('estate_id', ESTATE).eq('type', 'routine.paused@1')).count ?? 0

  const tick = createRoutineTick({
    store, journal, quota: cachedFreeQuota(), admission: createUnattendedAdmission(),
    startTask, estateId: ESTATE
  })
  await tick()

  spawns.length - before === 1
    ? ok('a poll on ONE cached reading starts exactly one unattended session')
    : fail('one reading authorised ' + (spawns.length - before) + ' starts')

  const { data: paused } = await db.from('journal').select('payload')
    .eq('estate_id', ESTATE).eq('type', 'routine.paused@1').order('seq', { ascending: false }).limit(10)
  const spent = (paused ?? []).filter((r) => r.payload?.reason_code === 'already-spent')
  spent.length > 0
    ? ok('and the rest are paused saying the reading was already spent, rather than stopping quietly')
    : fail('nothing was paused with already-spent; new paused rows: ' + ((paused?.length ?? 0) - pausedBefore))
}

for (const f of tickFailures()) console.log('  FAIL the tick threw: ' + (f.error?.message ?? JSON.stringify(f)))
if (tickFailures().length > 0) failures += tickFailures().length

// A REFUSED READ IS NOT AN EMPTY ESTATE (AX-08).
//
// The routines read destructured past its error: a refusal answers data null,
// which "!data?.length" took for "no routine is enabled", so the pass ended in
// silence and the caller recorded it as completed. Sixth time this shape has
// been found here, and the read sixteen lines below it already checked .failed
// and called ops.failed with a comment saying why.
{
  const refusing = {
    scope: store.scope,
    select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'the gateway refused' } }) }),
    selectIn: async () => ({ rows: [], failed: null })
  }
  const blindTick = createRoutineTick({ store: refusing, journal, quota: distinctFreeQuota(),
    admission: createUnattendedAdmission(), startTask, estateId: ESTATE })
  const pass = await blindTick()
  pass.state === 'outcome_unknown'
    ? ok('a pass that could not read the routines is outcome_unknown, never a completed empty pass')
    : fail('a refused routines read reported ' + pass.state)
  advancesWatermark(pass.state) === false
    ? ok('and the watermark does not step over it: advancing past work nobody can account for is how work disappears')
    : fail('a window nobody could read was allowed to advance the watermark')
  pass.says && pass.says.indexOf('refused') >= 0
    ? ok('and the reason travels with it, so the receipt says WHY rather than only that something went wrong')
    : fail('the pass carried no reason: ' + JSON.stringify(pass))
}

// And the other direction, so outcome_unknown is not simply what a quiet estate
// reports: a store that answers with no routines is "nothing to do", which DOES
// advance, because there was genuinely nothing due.
{
  const empty = {
    scope: store.scope,
    select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
    selectIn: async () => ({ rows: [], failed: null })
  }
  const quiet = await createRoutineTick({ store: empty, journal, quota: distinctFreeQuota(),
    admission: createUnattendedAdmission(), startTask, estateId: ESTATE })()
  quiet.state === 'skipped_no_delta' && advancesWatermark(quiet.state)
    ? ok('an estate with no enabled routine is skipped_no_delta and advances, which is why the refusal above means something')
    : fail('an empty estate reported ' + quiet.state)
}

if (failures > 0) { console.log('\\n' + failures + ' routine-tick failure(s)'); process.exit(1) }
`

// The disposable stack the tier started — never `supabase status` at the root, which is the
// operator's live stack. probeEnv() refuses (FAIL, exit 1) before anything connects otherwise.
const env = probeEnv()
try {
  const out = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script],
    { encoding: 'utf8', env, cwd: path.resolve(HERE, '..') })
  process.stdout.write(out.split('\n').filter((l) => /^\s+(ok|FAIL)/.test(l)).join('\n') + '\n')
} catch (e) {
  process.stdout.write((e.stdout ?? '') + (e.stderr ?? ''))
  process.exit(1)
}
