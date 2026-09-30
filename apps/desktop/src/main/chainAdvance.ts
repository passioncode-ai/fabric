// Starting the step that follows (slice 3).
//
// `chain.ts` decides WHETHER a follower runs — the outcome of the one before it,
// and whether what it needs actually arrived. This puts that decision against
// the store and starts the work, and it is separate from `index.ts` for the
// reason the routine tick was: the code that launches an agent without a person
// present should be reachable by a check.
//
// IT SHARES THE ROUTINE TICK'S INTERVAL rather than adding one. Two timers
// firing on the same estate is two chances to start the same thing twice, and
// the guard that stops it would have to know about both.
//
// AND A CHAIN COUNTS AGAINST THE LOOP BOUND. A chain is exactly the hand-off
// M68 bounds; a step that started its follower outside that count would be a way
// around the only thing between a hand-off and a runaway — and the prettiest
// way, because it would look like a feature rather than a hole.

import { randomUUID } from 'node:crypto'
import { cleanOriginalText } from './desktopIngress.ts'
import type { Journal } from '@fabric/journal'
import { mayStartFanIn, fillBrief, type Outcome } from '../shared/chain.ts'
import { nodeFor } from './pipelineAdapters/taskPipeline.ts'
import { mayChain } from '../shared/loopBound.ts'
import type { Quota, TaskRow } from '../shared/types'
import type { UnattendedAdmission } from '../shared/unattendedAdmission.ts'
import type { AdmitOutcome } from '../shared/admission.ts'
import type { LaunchInput } from './managedLaunch.ts'
import type { ScopedStore } from './scopedStore.ts'
import { ops } from './opsSink.ts'

export interface ChainDeps {
  /** One estate (S02.a). This tick read EVERY `follows` link in the database and
   *  then fetched the tasks they named by id — the exact shape S02 calls "an
   *  array of foreign ids assembled by an unscoped preliminary query". A chain
   *  belonging to another estate would have been advanced here, and its start
   *  journalled under this one. */
  store: ScopedStore
  journal: Journal
  /** The account's quota, or null when it could not be read — which BLOCKS
   *  (FA-03). A chain step is unattended work: nobody is watching it start. */
  quota: () => Promise<Quota | null>
  /** The ONE door unattended work goes through, shared with the routine tick.
   *  Before FA-03 the chain consulted `mayStartFanIn` — which answers whether
   *  the PREDECESSORS are done, a different question with a confusingly similar
   *  name — and no quota gate stood between a finished predecessor and a new
   *  unattended session. */
  admission: UnattendedAdmission
  /**
   * The ONE command that admits an existing task (FA-02). Shared verbatim with
   * the operator's Run: admission decides whether work may start, and a chain
   * step is the same decision made by a timer instead of by a person.
   *
   * Injected rather than reached for, so this module stays drivable without a
   * database client and the probe can watch a refusal without inventing one.
   */
  admitExisting: (taskId: string, sessionId: string) => Promise<AdmitOutcome>
  startTask: (input: {
    projectId: string
    instruction: string
    optionId: string
    preset?: string
    /** Advance THIS existing backlog follower instead of minting a new task
     *  (PF-07.01) — reusing the id is what makes a repeated advance idempotent. */
    followerId?: string
    /** run/node/revision/attempt idempotency key for the advance. */
    launchAdmission?: LaunchInput['admission']
    idempotencyKey?: string
  }) => Promise<{ task: TaskRow; session?: { sessionId: string } }>
  estateId: string
}

/**
 * Merge predecessors' hand-offs into one input set (PF-08.02).
 *
 * Every value is ALSO addressable namespaced (`<producerId>.<name>`), and a
 * bare name resolves only while it is unambiguous: two producers handing over
 * the same name with DIFFERENT values is an explicit collision — never a
 * silent last-writer-wins, because the overwritten half is somebody's input.
 * Identical duplicate values merge (an idempotent re-emit is not a conflict).
 */
export function mergeHandoffs(
  rows: ReadonlyArray<{ producer: string; name: string; value: string }>
): { ok: true; values: Record<string, string> } | { ok: false; collisions: string[] } {
  const values: Record<string, string> = {}
  const bare = new Map<string, string>()
  const collisions = new Set<string>()
  for (const r of rows) {
    values[`${r.producer}.${r.name}`] = r.value
    const prior = bare.get(r.name)
    if (prior !== undefined && prior !== r.value) collisions.add(r.name)
    else bare.set(r.name, r.value)
  }
  if (collisions.size)
    return { ok: false, collisions: [...collisions].sort() }
  for (const [name, value] of bare) values[name] = value
  return { ok: true, values }
}

export function createChainAdvance(deps: ChainDeps): () => Promise<void> {
  let running = false
  return async (): Promise<void> => {
    if (running) return
    running = true
    try {
      // NO RECONCILIATION PASS OVER `dispatching`, because there is no such
      // status and there never was. PF-07.02 wrote a backlog->dispatching CAS
      // and a pass that re-drives rows stuck in it; `project_tasks_status_check`
      // has allowed backlog, running, review, done, cancelled, open, finished
      // and abandoned since migration one. Every one of those writes was
      // REJECTED, the error was destructured away, and `if (!casWon?.length)`
      // read the empty answer as another process winning the race.
      //
      // The durable intent is now the LEASE that `admit_task_launch` takes, and
      // the `task.admitted@1` receipt it appends. Both outlive a crash, and
      // neither invents a state the schema does not know. What a crash leaves
      // is a live lease, and the next tick stands down on `lease_held` rather
      // than re-driving a spawn whose real process nobody has checked — which
      // this card's own instructions forbid.

      // Followers still waiting: a `follows` link from a task in backlog.
      const { data: links } = await deps.store
        .select('task_links', 'task_id,target_id,needs')
        .eq('rel', 'follows')
        .eq('target_kind', 'task')
      if (!links?.length) return

      const followerIds = [...new Set(links.map((l) => l.task_id as string))]
      const targetIds = [...new Set(links.map((l) => l.target_id as string))]
      // CHUNKED, AND THE ERROR IS READ. These were two `.in('id', …)` filters
      // over lists as long as the data: at 294 followers the URL is 10 879
      // characters and the gateway answers 414, which `.data ?? []` turned into
      // "nothing is waiting". Unattended chains stopped advancing silently, and
      // the tier went from green to red with nothing committed in between —
      // measured 2026-09-10, reproduced with curl.
      const [followers, targets] = await Promise.all([
        deps.store.selectIn(
          'project_tasks',
          'id,project_id,status,option_id,instruction,brief_what',
          'id',
          followerIds
        ),
        deps.store.selectIn('project_tasks', 'id,status', 'id', targetIds)
      ])
      if (followers.failed || targets.failed) {
        // A tick that could not read is a tick that says so. Returning quietly
        // is what made this invisible for as long as it was.
        ops.failed('chain.followers-unreadable', new Error(followers.failed ?? targets.failed ?? 'unknown'))
        return
      }

      const outcomeOf = new Map(targets.rows.map((t) => [t.id as string, t.status as string]))
      const waiting = new Map(
        followers.rows.filter((t) => t.status === 'backlog').map((t) => [t.id as string, t])
      )

      // One advance per follower per tick. The `running` mutex is local to this
      // process (M-note above), so it cannot stop a second call in the same
      // pass from dispatching the same follower; this set does, and the
      // deterministic follower id below stops it ACROSS ticks.
      const dispatched = new Set<string>()

      // PF-08.01 — incoming edges GROUPED by follower. The old loop judged one
      // edge at a time and dispatched on the first finished predecessor: in a
      // diamond A(done)→B ← C(running), B started with C's slot unfilled, and
      // once both finished, one tick could start B once per edge. A follower
      // runs on ALL its predecessors or not at all.
      const byFollower = new Map<string, typeof links>()
      for (const link of links) {
        const arr = byFollower.get(link.task_id as string) ?? []
        arr.push(link)
        byFollower.set(link.task_id as string, arr)
      }

      for (const [followerId, incoming] of byFollower) {
        const follower = waiting.get(followerId)
        if (!follower) continue
        if (dispatched.has(follower.id as string)) continue
        // A predecessor that has not finished is not a refusal — it is a chain
        // that has not got there yet, and saying so every minute would fill the
        // journal with "not yet". ONE unfinished predecessor holds the whole
        // fan-in.
        const terminal = new Set(['done', 'cancelled', 'abandoned'])
        if (incoming.some((l) => !terminal.has(outcomeOf.get(l.target_id as string) ?? '')))
          continue

        // The UNION of every predecessor's hand-offs, merged by NAMESPACE
        // (PF-08.02): a bare name stays available only while unambiguous, two
        // different values under one name are an explicit error, and every
        // value is also reachable as `<producerId>.<name>`.
        const rows: Array<{ producer: string; name: string; value: string }> = []
        for (const l of incoming) {
          const { data: produced } = await deps.store
            .select('task_handoffs', 'name,value')
            .eq('task_id', l.target_id as string)
          for (const h of produced ?? [])
            rows.push({ producer: l.target_id as string,
                        name: h.name as string, value: h.value as string })
        }
        const merged = mergeHandoffs(rows)
        if (!merged.ok) {
          await deps.journal.append({
            estateId: deps.estateId,
            type: 'routine.paused@1',
            actor: { kind: 'system', id: 'chain' },
            projectId: follower.project_id as string,
            payload: { id: follower.id,
                       reason: `two predecessors produced ${merged.collisions.join(', ')} ` +
                         `with different values — reference the input namespaced ` +
                         `({<taskId>.<name>}) instead of relying on which write landed last`,
                       window: null }
          })
          continue
        }
        const needs = [...new Set(incoming.flatMap((l) => (l.needs as string[]) ?? []))]
        const outcomes = incoming.map((l) => outcomeOf.get(l.target_id as string) as Outcome)

        // Interpolation happens strictly AFTER this validation: fillBrief runs
        // only on a verdict that passed, never on an unchecked value set.
        const verdict = mayStartFanIn(
          { taskId: follower.id as string, needs },
          outcomes,
          merged.values
        )
        if (!verdict.start) {
          // Said once. The follower stays in backlog and the journal carries why
          // it will not advance, because a chain that silently stops is a chain
          // the operator finds out about from the absence of a result.
          await deps.journal.append({
            estateId: deps.estateId,
            type: 'routine.paused@1',
            actor: { kind: 'system', id: 'chain' },
            projectId: follower.project_id as string,
            payload: { id: follower.id, reason: verdict.why, window: null, reason_code: 'not-ready' }
          })
          continue
        }

        // AND THE ACCOUNT (FA-03). Everything above answers "is this step
        // ready"; nothing answered "may an unattended session start at all".
        // Asked HERE, per follower, and through the same door the routine tick
        // uses: two gates would each authorise a start against one observation
        // of the remainder, which is the defect one gate exists to close.
        const allowed = deps.admission.claim(await deps.quota())
        if (!allowed.ok) {
          await deps.journal.append({
            estateId: deps.estateId,
            type: 'routine.paused@1',
            actor: { kind: 'system', id: 'chain' },
            projectId: follower.project_id as string,
            payload: {
              id: follower.id,
              reason: allowed.reason,
              window: allowed.window ?? null,
              reason_code: allowed.reasonCode ?? null
            }
          })
          continue
        }

        // The bound, counted from the predecessor exactly as a hand-off is.
        const { data: spawnLinks } = await deps.store
          .select('task_links', 'task_id,target_id')
          .eq('rel', 'spawned')
          .eq('target_kind', 'task')
        const from: Record<string, string | undefined> = {}
        for (const l of spawnLinks ?? []) from[l.task_id as string] = l.target_id as string
        // Every predecessor's chain counts against the bound — the longest one
        // decides, because the follower continues all of them.
        const bound = incoming
          .map((l) => mayChain(from, l.target_id as string))
          .find((b) => !b.ok) ?? { ok: true as const }
        if (!bound.ok) {
          await deps.journal.append({
            estateId: deps.estateId,
            type: 'routine.paused@1',
            actor: { kind: 'system', id: 'chain' },
            projectId: follower.project_id as string,
            payload: { id: follower.id, reason: bound.reason, window: null }
          })
          continue
        }

        const brief = cleanOriginalText(fillBrief(
          (follower.brief_what as string | null) ?? (follower.instruction as string),
          verdict.values
        ))
        // ONE SHARED ADMISSION (FA-02), and it replaces a CAS that never ran.
        // `admit_task_launch` takes the launch lease under the estate lock,
        // refuses a task that is terminal, already running, blocked by an open
        // question or already leased, and BEARS the TaskRun — so two ticks and
        // two hosts produce one run and one spawn without this file owning a
        // mutex of its own.
        //
        // A refusal is a decision and is not retried. An UNAVAILABLE command is
        // neither an admission nor a lost race, and it stands down loudly: the
        // whole defect this replaces was an unreadable answer being read as
        // healthy contention.
        const sessionId = randomUUID()
        const admitted = await deps.admitExisting(follower.id as string, sessionId)
        if (!admitted.admitted) {
          if (!['lease_held', 'already_running', 'run_unresolved'].includes(admitted.reasonCode))
            await deps.journal.append({
              estateId: deps.estateId,
              type: 'routine.paused@1',
              actor: { kind: 'system', id: 'chain' },
              projectId: follower.project_id as string,
              payload: {
                id: follower.id,
                reason: admitted.says,
                window: null,
                reason_code: admitted.reasonCode
              }
            })
          continue
        }

        // The outbox record, journalled BEFORE the spawn: if the process dies
        // here, the restart still knows exactly which dispatch was in flight.
        // PF-06.02 — a task that is a PROJECTION of a task-pipeline node names
        // the immutable node revision it advances, so the result event routes
        // back to that exact revision (never "the current one"), and Fabric is
        // visibly the single dispatch authority for the imported queue.
        const projected = nodeFor(follower.id as string)
        await deps.journal.append({
          estateId: deps.estateId,
          type: 'chain.dispatch@1',
          actor: { kind: 'system', id: 'chain' },
          projectId: follower.project_id as string,
          payload: { id: follower.id, phase: 'intent',
                     // The run the admission BORE. A dispatch that does not name
                     // its run cannot be told apart from a dispatch for another
                     // attempt of the same follower.
                     task_run_id: admitted.receipt.task_run_id,
                     session_id: sessionId,
                     instruction: brief,
                     ...(projected ? { node: projected } : {}),
                     key: `chain:${follower.id}:${incoming.map((l) => l.target_id as string).sort().join('+')}` }
        })

        try {
          await deps.startTask({
            launchAdmission: { receipt: admitted.receipt, sessionId },
            projectId: follower.project_id as string,
            instruction: brief,
            optionId: (follower.option_id as string) || 'claude-code',
            preset: 'chain',
            // Advance the EXISTING follower, do not spawn a new UUID: the dispatch
            // intent names the follower and carries an idempotency key over
            // run/node (the follower) and its predecessor, so a repeated advance
            // maps to one follower/attempt (PF-07.01).
            followerId: follower.id as string,
            // One key per follower per COMPLETE predecessor set (PF-08.01): a
            // second edge of the same diamond maps to the same key, so one
            // tick cannot start the follower once per edge.
            idempotencyKey: `chain:${follower.id}:${incoming.map((l) => l.target_id as string).sort().join('+')}`
          })
        } catch (spawnError) {
          // Only the shared coordinator knows whether begin was granted and
          // whether a process existed. The chain must never release its lease.
          await deps.journal.append({
            estateId: deps.estateId,
            type: 'chain.dispatch@1',
            actor: { kind: 'system', id: 'chain' },
            projectId: follower.project_id as string,
            payload: {
              id: follower.id,
              phase: 'failed',
              task_run_id: admitted.receipt.task_run_id,
              says: 'The launch did not complete. Inspect the run receipt before retrying.'
            }
          })
          throw spawnError
        }
        dispatched.add(follower.id as string)
      }
    } catch (e) {
      ops.failed('chainAdvance.a-chain-could-not-be-advanced', e, { note: 'a chain could not be advanced:' })
    } finally {
      running = false
    }
  }
}
