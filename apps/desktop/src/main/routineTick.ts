// The tick that starts unattended work (M13, M94, M132).
//
// EXTRACTED FROM `index.ts` BECAUSE IT IS THE HIGHEST-RISK CODE IN THE PRODUCT
// AND NOTHING HAD EVER RUN IT. Its pure parts are tested — which routines are
// due, whether the quota allows it, what the backlog brief says — and the
// projection is probed, and the code that puts those three together had been
// executed by no check at all. It is the one path that launches an agent with
// nobody watching, so "the file it lives in is unimportable" is a fact about the
// file rather than a reason.
//
// M110 records that `index.ts` cannot be imported: `app.whenReady()` runs at
// module scope, so importing it launches Electron. Everything here takes its
// dependencies as arguments for exactly that reason, the same shape the bundle
// compiler and the transcript store already use.
//
// A DESKTOP APP THAT IS CLOSED RUNS NOTHING, and that is stated rather than
// engineered around: routines are due while Fabric is open. A missed window is
// not made up (`routine.ts`), so a laptop shut for three days runs each daily
// routine once when it opens — not three times, which is how a week away turns
// into a queue of agents starting together.

import { dueRoutines } from '../shared/routine.ts'
import type { UnattendedAdmission } from '../shared/unattendedAdmission.ts'
import { planCycle, worstOf, type WindowState } from '../shared/cyclePort.ts'
import { backlogBrief } from '../shared/backlogBrief.ts'
import type { Journal } from '@fabric/journal'
import type { Quota, TaskRow } from '../shared/types'
import type { ScopedStore } from './scopedStore.ts'
import { ops } from './opsSink.ts'

export interface RoutineTickDeps {
  /** Narrowed to ONE estate before it gets here (S02.a). The tick used to take
   *  a naked client and read `routines where enabled` — every enabled routine in
   *  the database, including a test fixture's and another estate's — then start
   *  them and journal the run under its own estate id. The predicate was never
   *  the hard part; being able to omit it was. */
  store: ScopedStore
  journal: Journal
  /** The account's quota, or null when it could not be read — which BLOCKS. */
  quota: () => Promise<Quota | null>
  /** The ONE door unattended work goes through (FA-03). Shared with the chain
   *  advance, because the account is shared: two callers each holding their own
   *  gate would each authorise a start against the same observation. */
  admission: UnattendedAdmission
  startTask: (input: {
    projectId: string
    instruction: string
    optionId: string
    preset?: string
  }) => Promise<{ task: TaskRow }>
  estateId: string
}

/** What one pass did, in the estate's own window vocabulary (AX-08). */
export interface TickResult {
  state: WindowState
  started: number
  deferred: number
  /** Why this state, in a sentence the receipt carries. */
  says: string
}

export interface RoutineTick {
  /**
   * Run one pass, and SAY WHAT IT DID.
   *
   * It returned `void` until AX-08, so everything it knew died here: the
   * `partial` that `planCycle` computes when more routines are due than one
   * pass may start, and a refused routines read that early-returned in silence.
   * The caller then wrote a receipt saying the pass completed, because
   * `completed` was the value it started from and nothing could tell it
   * otherwise. A window recorded as complete is one the watermark may step
   * over, which is how work that was never done stops being due.
   *
   * Still safe to call while a previous pass is going: it returns immediately
   * rather than overlapping, because two passes would double-start every
   * routine due in the gap. That answer is `running` rather than a lie about
   * work.
   */
  (): Promise<TickResult>
}

export function createRoutineTick(deps: RoutineTickDeps): RoutineTick {
  let ticking = false
  const tick = async (): Promise<TickResult> => {
    // Not `completed`: this pass did nothing because another is doing it, and
    // the one in flight will report for itself.
    if (ticking)
      return { state: 'running', started: 0, deferred: 0, says: 'a previous pass was still running' }
    ticking = true
    try {
      // ERROR READ, not destructured past. A refused read answers `data: null`,
      // which `!data?.length` took for "no routine is enabled" — so the pass
      // ended in silence and the caller recorded it as complete. Sixth time
      // this shape has been found in this repository, and the read sixteen
      // lines below already knew better.
      const { data, error } = await deps.store
        .select('routines', 'id,project_id,instruction,option_id,every_minutes,enabled,last_run_at,last_task_id,kind')
        .eq('enabled', true)
      if (error) {
        ops.failed('routine.routines-unreadable', new Error(error.message))
        return {
          state: 'outcome_unknown',
          started: 0,
          deferred: 0,
          says: `the routines could not be read, so what was due is unknown: ${error.message}`
        }
      }
      if (!data?.length)
        return { state: 'skipped_no_delta', started: 0, deferred: 0, says: 'no routine is enabled' }

      // "Still running" is read from the TASK the routine started, not from a
      // flag on the routine: a flag survives a crash and a task does not.
      const openIds = (data.map((r) => r.last_task_id).filter(Boolean) as string[])
      // Chunked and error-read: `openIds` is as long as the routines, and a URL
      // the gateway refuses would have read as "nothing is still running" —
      // which is permission to start another. The status filter moved into the
      // predicate below because `selectIn` takes one list.
      const openRead = await deps.store.selectIn('project_tasks', 'id,status', 'id', openIds)
      if (openRead.failed) {
        // A tick that cannot tell what is still running does not start work.
        ops.failed('routine.open-tasks-unreadable', new Error(openRead.failed))
        return {
          state: 'outcome_unknown',
          started: 0,
          deferred: 0,
          says: `what is still running could not be read, so nothing was started: ${openRead.failed}`
        }
      }
      const open = new Set(
        openRead.rows
          .filter((t) => ['backlog', 'running', 'review'].includes(t.status as string))
          .map((t) => t.id as string)
      )

      const kinds = new Map(data.map((r) => [r.id as string, (r.kind as string) ?? 'fixed']))
      const due = dueRoutines(
        data.map((r) => ({
          id: r.id as string,
          projectId: r.project_id as string,
          instruction: r.instruction as string,
          optionId: r.option_id as string,
          everyMinutes: r.every_minutes as number,
          lastRunAt: (r.last_run_at as string | null) ?? null,
          running: open.has((r.last_task_id as string | null) ?? ''),
          enabled: r.enabled as boolean
        })),
        Date.now()
      )
      if (due.length === 0)
        return { state: 'skipped_no_delta', started: 0, deferred: 0, says: 'nothing was due' }

      // S15 — BOUNDED. Every routine whose interval elapsed used to start in
      // one pass, so a day offline launched every due routine in the same
      // second: ten agents competing for one machine, for an operator who
      // opened the app to look at one thing. The rest stay due and are taken
      // next poll — being due is a fact about the routine, not a message in a
      // queue that can be dropped.
      const plan = planCycle(due.map((d) => d.routine.id))
      const takingNow = new Set(plan.started)
      // NO RECEIPT OF ITS OWN. This used to append a second `cycle.ran@1` for
      // the same pass whenever work was deferred, while the caller appended one
      // saying `completed` — two rows of one type for one window, with nothing
      // joining them, and a reader taking the later one saw the wrong state.
      // The plan travels out in the return value instead, so there is ONE
      // receipt and the join it would have needed cannot be forgotten.
      //
      // COUNTED AS THEY HAPPEN. `plan.started` is what this pass INTENDED; a
      // quota refusal or a spawn failure inside the loop means fewer ran, and a
      // receipt reporting the intention would be the same species of optimism
      // this card is about.
      let startedCount = 0

      for (const d of due) {
        if (!takingNow.has(d.routine.id)) continue
        // M132 — a backlog routine's instruction is composed HERE, from the
        // backlog as it stands tonight. A fixed sentence would have the agent
        // rediscover the list it was scheduled to work.
        let instruction: string | null = d.routine.instruction
        if (kinds.get(d.routine.id) === 'backlog') {
          const { data: backlog } = await deps.store
            .select('project_tasks', 'id,title,instruction,position,goal_id')
            .eq('project_id', d.routine.projectId)
            .eq('status', 'backlog')
          instruction = backlogBrief(
            (backlog ?? []).map((t) => ({
              id: t.id as string,
              title: (t.title as string | null) ?? null,
              instruction: t.instruction as string,
              position: (t.position as number | null) ?? null,
              goalId: (t.goal_id as string | null) ?? null
            }))
          )
        }
        // ASKED PER START, AND LAST (FA-03). One `mayStart` used to stand
        // outside this loop and authorise up to MAX_STARTS_PER_POLL routines:
        // three admissions spending one observation of the remainder, the
        // second and third on a number already out of date. The threshold
        // leaves room for a run, not for a poll.
        //
        // AND IT IS THE LAST QUESTION ASKED, after every other reason not to
        // start. A reading is spent by a START; claiming it earlier let a
        // routine that was then skipped for an empty backlog consume the
        // account's headroom without running anything — a refusal charged to a
        // run that never happened.
        const verdict =
          instruction === null ? null : deps.admission.claim(await deps.quota())
        if (verdict && !verdict.ok) {
          // Paused AND SAID SO (M94). A routine that did not run and left no
          // trace cannot be told apart from one that ran and did nothing.
          await deps.journal.append({
            estateId: deps.estateId,
            type: 'routine.paused@1',
            actor: { kind: 'system', id: 'routine-tick' },
            projectId: d.routine.projectId,
            payload: {
              id: d.routine.id,
              reason: verdict.reason,
              window: verdict.window ?? null,
              // The CODE beside the sentence: "why did nothing run last night"
              // is a question about a class, and a sentence cannot be counted.
              reason_code: verdict.reasonCode ?? null
            }
          })
          continue
        }
        if (instruction === null) {
          // Nothing to do is a PAUSE with a reason, not a silent skip and not a
          // session. Starting one burns quota and writes a transcript saying
          // there was nothing to do, every night, for as long as it exists.
          await deps.journal.append({
            estateId: deps.estateId,
            type: 'routine.paused@1',
            actor: { kind: 'system', id: 'routine-tick' },
            projectId: d.routine.projectId,
            payload: {
              id: d.routine.id,
              reason: 'the backlog is empty, so there was nothing to work on',
              window: null
            }
          })
          continue
        }

        try {
          const started = await deps.startTask({
            projectId: d.routine.projectId,
            instruction,
            optionId: d.routine.optionId,
            preset: 'routine'
          })
          startedCount++
          await deps.journal.append({
            estateId: deps.estateId,
            type: 'routine.ran@1',
            actor: { kind: 'system', id: 'routine-tick' },
            projectId: d.routine.projectId,
            payload: { id: d.routine.id, task_id: started.task.id, because: d.because }
          })
        } catch (e) {
          // A spawn failure is recorded as a pause with its reason, not
          // swallowed: the next tick will try again, and the operator can see
          // that it has been trying.
          await deps.journal.append({
            estateId: deps.estateId,
            type: 'routine.paused@1',
            actor: { kind: 'system', id: 'routine-tick' },
            projectId: d.routine.projectId,
            payload: { id: d.routine.id, reason: `it could not start: ${String(e)}`, window: null }
          })
        }
      }
      // A pass that intended three and started none is not `completed`, whatever
      // the plan said: the routines are still due and the watermark must not
      // step over them.
      const state: WindowState =
        startedCount < plan.started.length ? worstOf([plan.state, 'partial']) : plan.state
      return {
        state,
        started: startedCount,
        deferred: plan.deferred.length,
        says:
          startedCount < plan.started.length
            ? `${plan.started.length - startedCount} of ${plan.started.length} routine(s) this pass took on did not start`
            : plan.deferred.length > 0
              ? `more routines were due than one pass starts; ${plan.deferred.length} are still due`
              : 'every routine that was due was taken'
      }
    } catch (e) {
      ops.failed('routineTick.routine-tick-failed', e, { note: 'routine tick failed:' })
      // SEEN, so `failed_known` — and it does not advance the watermark either.
      return { state: 'failed_known', started: 0, deferred: 0, says: `the pass failed: ${String(e)}` }
    } finally {
      ticking = false
    }
  }
  return tick
}
