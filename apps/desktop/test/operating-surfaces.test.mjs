// The board's data layer, probed by ATTEMPTING what it forbids (R-003).
//
// What this must prove:
//   1. Every new event type appends — the vocabulary is registered.
//   2. task.created lands in `backlog` with its origin; assigned / moved /
//      closed drive the ladder; a cancel without a reason is the TOOL's refusal
//      (later step), but the projection records what the journal accepted.
//   3. NO ROW AT REST holds the legacy vocabulary — the post-fix normalises
//      open/finished/abandoned inside the same transaction, and this assertion
//      is the licence for the widened CHECK.
//   (the rest is asserted inline)
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { probeEnv } from '../../../scripts/lib/test-stack.mjs'

const HERE = import.meta.dirname
const script = `
import { createJournal } from ${JSON.stringify(path.join(HERE, '../../../packages/journal/src/index.ts'))}
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const journal = createJournal(db)
const ESTATE = randomUUID()
const ACTOR = { kind: 'agent', id: 'surfaces-probe' }
const projectId = randomUUID()

let failures = 0
const ok = (m) => console.log('  ok   ' + m)
const fail = (m) => { failures++; console.log('  FAIL ' + m) }

await journal.append({ estateId: ESTATE, type: 'project.created@1',
  actor: { kind: 'system', id: 'probe' }, projectId,
  payload: { id: projectId, name: 'surfaces probe' } })

// ── 1+2. the ladder, driven by events ────────────────────────────────────────
const A = randomUUID(), B = randomUUID(), C = randomUUID()
for (const [id, title] of [[A,'task A'],[B,'task B'],[C,'task C']]) {
  await journal.append({ estateId: ESTATE, type: 'task.created@1', actor: ACTOR, projectId,
    payload: { id, title, task_type: 'development', section: 'core',
               origin: { kind: 'task', ref: 'probe' } } })
}
const { data: created } = await db.from('project_tasks').select('status,title,origin_kind')
  .eq('id', A).single()
created?.status === 'backlog' && created.origin_kind === 'task'
  ? ok('task.created lands in backlog carrying its origin')
  : fail('created row wrong: ' + JSON.stringify(created))

await journal.append({ estateId: ESTATE, type: 'task.assigned@1', actor: ACTOR, projectId,
  payload: { task_id: A, assigned_by: 'agent:ceo', assigned_to: 'agent:dev' } })
await journal.append({ estateId: ESTATE, type: 'task.moved@1', actor: ACTOR, projectId,
  payload: { task_id: A, from: 'backlog', to: 'running' } })
await journal.append({ estateId: ESTATE, type: 'task.closed@1', actor: ACTOR, projectId,
  payload: { task_id: B, outcome: 'cancelled', reason: 'probe cancels with a reason' } })
const { data: moved } = await db.from('project_tasks').select('status,assigned_by,assigned_to').eq('id', A).single()
const { data: closed } = await db.from('project_tasks').select('status,closed_reason').eq('id', B).single()
moved?.status === 'running' && moved.assigned_to === 'agent:dev'
  ? ok('assigned and moved drive the row') : fail('move/assign: ' + JSON.stringify(moved))
// M124 — the actor was in the journal from the first day and the projection
// dropped it. Without this the board can say WHERE a card is and not whose hand
// put it there, and for review those are two different statements.
{
  const { data: prov } = await db
    .from('project_tasks').select('moved_by,moved_by_kind,moved_at').eq('id', A).single()
  prov?.moved_by_kind === 'agent' && prov.moved_by === 'surfaces-probe' && prov.moved_at
    ? ok('a move carries the hand that made it into the projection')
    : fail('move provenance: ' + JSON.stringify(prov))

  // A close is a move too — it is the one an agent may not make, so the
  // provenance of a terminal state is the sharpest of the lot.
  const { data: cprov } = await db
    .from('project_tasks').select('moved_by_kind').eq('id', B).single()
  cprov?.moved_by_kind === 'agent'
    ? ok('and so does a close, which is how a forbidden one would be visible at all')
    : fail('close provenance: ' + JSON.stringify(cprov))

  // THE GUARD, and two wrong guesses before the right case. Provenance follows
  // a move that LANDED, so it is written only where the status is already the
  // one the event asked for.
  //
  // What is NOT a refusal, learned by trying: a move to an invented state. The
  // projector writes it, the status CHECK rejects it, and append_event rolls
  // back whole — the journal never accepts the event. Atomic, and unlike the DAG
  // failure it leaves nothing poisoned to replay.
  //
  // Nor is a move out of abandoned: no row holds that status at rest (the probe
  // below asserts it), because the post-fix normalises it in-transaction.
  //
  // AND A MOVE OUT OF cancelled IS NOT A DEFECT even though it looks like one.
  // The ladder forbids it and is enforced at BOTH write boundaries — mayMove in
  // the IPC handler, and the tool schema that cannot phrase it. A direct journal
  // append bypasses them, which is what a harness does and no product code does;
  // the projection then renders what the journal holds, which is 4.1 working.
  //
  // The reachable case is an event about a task the projection never created.
  {
    const ghost = randomUUID()
    // The actor is unique per run. The test estate is NOT reset between runs, so
    // a fixed name matches a row this probe wrote an hour ago and the assertion
    // fails against its own history — which is how this comment got written.
    const nobody = 'nobody-moved-' + ghost
    await journal.append({ estateId: ESTATE, type: 'task.moved@1',
      actor: { kind: 'person', id: nobody }, projectId,
      payload: { task_id: ghost, from: 'backlog', to: 'running' } })
    const { data: none } = await db
      .from('project_tasks').select('id').eq('moved_by', nobody)
    none?.length === 0
      ? ok('a move naming a task the projection never created writes no provenance anywhere')
      : fail('provenance written for a ghost task: ' + JSON.stringify(none))
  }
}

closed?.status === 'cancelled' && closed.closed_reason?.includes('reason')
  ? ok('a cancel carries its reason onto the row') : fail('close: ' + JSON.stringify(closed))

// ── 3. no row at rest holds the legacy vocabulary ───────────────────────────
// exercise the legacy path first: a real task.started/finished cycle
const legacy = randomUUID()
await journal.append({ estateId: ESTATE, type: 'task.started@1', actor: ACTOR, projectId,
  payload: { id: legacy, instruction: 'legacy path', option_id: 'claude-code', session_id: null, preset: null } })
await journal.append({ estateId: ESTATE, type: 'task.finished@1', actor: ACTOR, projectId,
  payload: { id: legacy, exit_code: 0 } })
const { count: atRest } = await db.from('project_tasks')
  .select('id', { count: 'exact', head: true })
  .in('status', ['open','finished','abandoned'])
atRest === 0
  ? ok('no row at rest holds open/finished/abandoned — the post-fix normalises in-transaction')
  : fail('LEGACY VOCABULARY AT REST: ' + atRest + ' row(s)')
const { data: lrow } = await db.from('project_tasks').select('status').eq('id', legacy).single()
lrow?.status === 'done' ? ok('the legacy finish reads done') : fail('legacy finish: ' + JSON.stringify(lrow))

// ── 4. the DAG refuses a cycle at write time, naming it ─────────────────────
await journal.append({ estateId: ESTATE, type: 'task.linked@1', actor: ACTOR, projectId,
  payload: { task_id: A, rel: 'blocks', target_kind: 'task', target_id: B } })
await journal.append({ estateId: ESTATE, type: 'task.linked@1', actor: ACTOR, projectId,
  payload: { task_id: B, rel: 'blocks', target_kind: 'task', target_id: C } })
// The refusal lives at the WRITE boundary, in three places with three jobs:
//   the function answers, the trigger guards direct writes, and the tool (build
//   step 3) refuses to the caller. The PROJECTOR does none of these — it drops
//   the edge and carries on, because a projection that refuses an accepted
//   event makes the estate permanently unrebuildable. That is not a theory: it
//   is what this probe did to the test estate before the check was moved out.
const { data: closes } = await db.rpc('would_close_cycle', { p_task_id: C, p_target_id: A })
closes === true ? ok('the check itself sees C -> A closing a cycle')
                : fail('would_close_cycle is blind: ' + JSON.stringify(closes))

const { error: directRefused } = await db.from('task_links').insert({
  estate_id: ESTATE, project_id: projectId, task_id: C, rel: 'blocks',
  target_kind: 'task', target_id: A, seq: 0
})
directRefused && String(directRefused.message).includes('cycle')
  ? ok('a direct table write is refused by the trigger, naming the cycle')
  : fail('THE DAG IS OPEN to direct writes: ' + JSON.stringify(directRefused))

let replaySurvived = true
try {
  await journal.append({ estateId: ESTATE, type: 'task.linked@1', actor: ACTOR, projectId,
    payload: { task_id: C, rel: 'blocks', target_kind: 'task', target_id: A } })
} catch (e) { replaySurvived = false; fail('the projector refused an accepted event: ' + e) }
if (replaySurvived) ok('a cyclic edge in the journal does not abort the projector')
const { count: links } = await db.from('task_links').select('*', { count: 'exact', head: true })
  .eq('task_id', C)
links === 0 ? ok('and the edge it would have closed is not in the projection')
            : fail('a cycle reached the projection')

const { error: rebuildFailed } = await db.rpc('rebuild_estate_projections', { p_estate_id: ESTATE })
rebuildFailed
  ? fail('THE ESTATE CANNOT BE REBUILT: ' + rebuildFailed.message)
  : ok('the whole estate still replays from the journal with that event in it')

// ── 5. notes are append-only for every role ──────────────────────────────────
const noteId = randomUUID()
await journal.append({ estateId: ESTATE, type: 'task.note.added@1', actor: ACTOR, projectId,
  payload: { task_id: A, note_id: noteId, body_md: 'found: the stat is declared twice' } })
const { error: editRefused } = await db.from('task_notes')
  .update({ body_md: 'rewritten history' }).eq('id', noteId)
editRefused
  ? ok('a note cannot be edited even by the service role — append-only by grants')
  : fail('A NOTE WAS REWRITTEN: history is editable')
const factId = randomUUID()
await journal.append({ estateId: ESTATE, type: 'task.note.promoted@1', actor: ACTOR, projectId,
  payload: { task_id: A, note_id: noteId, fact_id: factId } })
const { data: note } = await db.from('task_notes').select('promoted_fact_id,body_md').eq('id', noteId).single()
note?.promoted_fact_id === factId && note.body_md.includes('declared twice')
  ? ok('promotion marks the note through the projector while the body stays untouched')
  : fail('promotion: ' + JSON.stringify(note))

// A note is promoted ONCE. The handler refuses a second attempt, and this is
// the guarantee underneath that refusal: even if a second event reached the
// journal, the projector will not repoint the note. A note that could change
// which fact it promoted to would make provenance a moving target.
const otherFact = randomUUID()
await journal.append({ estateId: ESTATE, type: 'task.note.promoted@1', actor: ACTOR, projectId,
  payload: { task_id: A, note_id: noteId, fact_id: otherFact } })
const { data: still } = await db.from('task_notes').select('promoted_fact_id').eq('id', noteId).single()
still?.promoted_fact_id === factId
  ? ok('a promoted note keeps pointing at the fact it made, not at a later one')
  : fail('the note was repointed: ' + JSON.stringify(still))

// ── 6. leases replay deterministically ───────────────────────────────────────
const s1 = randomUUID(), s2 = randomUUID()
const past = new Date(Date.now() - 60_000).toISOString()
const future = new Date(Date.now() + 600_000).toISOString()
await journal.append({ estateId: ESTATE, type: 'work.claimed@1', actor: ACTOR, projectId,
  payload: { work: A, owner: s1, idempotency_key: 'probe-claim-000000001', expires_at: future, write_scopes: ['repo'] } })
await journal.append({ estateId: ESTATE, type: 'work.claimed@1', actor: ACTOR, projectId,
  payload: { work: A, owner: s2, idempotency_key: 'probe-claim-000000002', expires_at: future } })
const { data: lease1 } = await db.from('leases').select('owner_session').eq('work_id', A).single()
lease1?.owner_session === s1
  ? ok('a live lease is not overwritten by a second claim — the projection keeps the holder')
  : fail('lease stolen while live: ' + JSON.stringify(lease1))
await journal.append({ estateId: ESTATE, type: 'work.released@1', actor: ACTOR, projectId,
  payload: { work: A, owner: s1, outcome: 'succeeded' } })
await journal.append({ estateId: ESTATE, type: 'work.claimed@1', actor: ACTOR, projectId,
  payload: { work: A, owner: s2, idempotency_key: 'probe-claim-000000003', expires_at: past } })
await journal.append({ estateId: ESTATE, type: 'work.claimed@1', actor: ACTOR, projectId,
  payload: { work: A, owner: s1, idempotency_key: 'probe-claim-000000004', expires_at: future } })
const { data: lease2 } = await db.from('leases').select('owner_session').eq('work_id', A).single()
lease2?.owner_session === s1
  ? ok('an EXPIRED lease is taken over, judged by the event clock — deterministic on replay')
  : fail('expired takeover failed: ' + JSON.stringify(lease2))

// ── 6b. a lease does not outlive the process that took it ───────────────────
// Every lease at startup belongs to a session that cannot exist: the app has
// just started. The sweep releases them as abandoned, never as succeeded.
await journal.append({ estateId: ESTATE, type: 'work.claimed@1', actor: ACTOR, projectId,
  payload: { work: C, owner: s2, idempotency_key: 'probe-claim-000000005', expires_at: future } })
const { count: beforeSweep } = await db.from('leases').select('*', { count: 'exact', head: true }).eq('work_id', C)
await journal.append({ estateId: ESTATE, type: 'work.released@1',
  actor: { kind: 'system', id: 'startup-reconcile' }, projectId,
  payload: { work: C, owner: s2, outcome: 'abandoned' } })
const { count: afterSweep } = await db.from('leases').select('*', { count: 'exact', head: true }).eq('work_id', C)
beforeSweep === 1 && afterSweep === 0
  ? ok('a lease released as abandoned leaves no holder behind')
  : fail('lease sweep: held ' + beforeSweep + ' before, ' + afterSweep + ' after')

// ── 7. goals and priority ────────────────────────────────────────────────────
const G = randomUUID()
await journal.append({ estateId: ESTATE, type: 'goal.defined@1', actor: ACTOR, projectId,
  payload: { id: G, title: 'the operating unit works', autonomy: 'guarded' } })
await journal.append({ estateId: ESTATE, type: 'task.prioritised@1', actor: ACTOR, projectId,
  payload: { goal_id: G, task_id: A, position: 1 } })
const { data: prio } = await db.from('project_tasks').select('goal_id,position').eq('id', A).single()
prio?.goal_id === G && prio.position === 1
  ? ok('priority is a field on the task, written through the journal')
  : fail('prioritise: ' + JSON.stringify(prio))

// The goal carries an autonomy level the floor does not read yet, so the
// handler writes every goal as safe and the operator is not offered the choice.
// Asserted here so the day something starts reading it, this line says so.
const { data: goalRow } = await db.from('goals').select('autonomy,title').eq('id', G).single()
goalRow?.autonomy === 'guarded' && goalRow.title.includes('operating unit')
  ? ok('a goal is journalled with its title and autonomy, and the row is the projection of the event')
  : fail('goal projection: ' + JSON.stringify(goalRow))

// M132 — a routine's KIND projects, and the default is the one that leaves
// existing routines behaving exactly as they did.
{
  const rid = randomUUID(), rid2 = randomUUID()
  await journal.append({ estateId: ESTATE, type: 'routine.defined@1', actor: ACTOR, projectId,
    payload: { id: rid, project_id: projectId, instruction: 'work the backlog',
               option_id: 'claude-code', every_minutes: 1440, kind: 'backlog' } })
  await journal.append({ estateId: ESTATE, type: 'routine.defined@1', actor: ACTOR, projectId,
    payload: { id: rid2, project_id: projectId, instruction: 'say hello',
               option_id: 'claude-code', every_minutes: 60 } })
  const { data: kinds } = await db.from('routines').select('id,kind').in('id', [rid, rid2])
  const backlog = kinds?.find((r) => r.id === rid)
  const plain = kinds?.find((r) => r.id === rid2)
  backlog?.kind === 'backlog' && plain?.kind === 'fixed'
    ? ok('a routine kind projects, and one defined without it stays fixed')
    : fail('routine kinds: ' + JSON.stringify(kinds))
}

if (failures > 0) { console.log('\\n' + failures + ' operating-surfaces failure(s)'); process.exit(1) }
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
