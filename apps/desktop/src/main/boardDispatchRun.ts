// #region board-dispatch-run — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#3-the-flow
/**
 * The dispatcher wired (CO-409 wave 1, spec §3): on the cycle it reads the open board requests, asks `decideDispatch`
 * what to do with each, and for a launch opens the request's workflow in Observatory, writes its `run-ends-at`
 * checkpoint, offers it to the default agent's provider and starts the run through `switchboard dispatch`. It watches
 * each run to its end, counts a run that ended with the request unsettled, and stops after two (§3.6): the sweep of
 * abandoned work already shows such a request to the operator in «На проверке». One pass at a time; what it started
 * is kept in a small file so a restart never starts a second run for a request. Every external call is a dependency.
 */
import { randomUUID } from 'node:crypto'
import type { OperatorMandate } from './hubAuthority.ts'
import { decideDispatch, EMPTY_RUNS_TO_OPERATOR, firstLine, GRACE_MS, limitsOf, runEndsAt, refusalCheck, type DispatchDecision, type RequestState } from '../shared/boardDispatch.ts'
import { FABRIC_OWNER, type ToolCall } from './observatoryMemory.ts'

export interface OpenRequest {
  id: string
  thread: string
  state: RequestState
  target: string
  capability: string
  submittedAt: string
  deadline: string
  /** The board's fact: the request's current attempt holds its lease. Absent: judged by the slot alone. */
  attemptLive?: boolean
  /** The operator's mandate the request carries (DEC-0125 MD-3, `boardMandate.ts`), carried into the run's packet. */
  mandate?: OperatorMandate
}

export interface DispatchRecord {
  requestId: string
  projectId: string
  dispatchId: string
  workflowId: string
  handoffId: string
  launchId: string | null
  startedAt: number
  endsAt: string
  /** The request's deadline on the board (ms), when it named one: its newest record is kept at least until then, so a
   *  request given to the operator never comes back as new (the 0.3.16 final candidate's verification, B-1). */
  until?: number
  /** `starting`: written BEFORE Switchboard is asked (the 0.3.16 review, ER-1, ER-2), so a timeout, a crash or a quit
   *  during the start never leaves a request without its record; the next pass asks Switchboard again with the same
   *  workflow and hand-over, which answers the same launch when it did start. */
  state: 'starting' | 'running' | 'ended'
  outcome?: 'finished' | 'exited-without-answer' | 'timed-out' | 'failed-to-start' | 'refused' | 'unknown' | 'to-operator'
  /** Switchboard's refusal code, when it refused. */
  refused?: string
  /** How many times Switchboard was asked for this record. */
  attempts?: number
  /** When the record ended (ms); a refusal's back-off counts from here (0.3.16 review, iteration 2, ER-7). */
  endedAt?: number
  /** The workflow Fabric opened is closed: for `to-operator` (ER-3), or once another session settled the request (CO-409).
   *  Absent or false: closing is tried again each pass, at most `CLOSE_ATTEMPTS` times. */
  closed?: boolean
  /** Times closing was tried; after `CLOSE_ATTEMPTS` it is given up and said once (iteration 3, ER-1). */
  closeAttempts?: number
  /** Runs for this request that ended without settling it. */
  emptyRuns: number
  /** NB-2: the switch ended this start after Switchboard was asked without an answer, so its run may have begun; when
   *  the switch is back on, Switchboard is asked again with the same dispatch id while the request is still open. */
  askAgain?: boolean
  /** §3.4: Switchboard reported the run's process exited with a failure code; the workflow is taken back as `crash`. */
  crashed?: boolean
}

const OUTCOMES = new Set(['finished', 'exited-without-answer', 'timed-out', 'failed-to-start', 'refused', 'unknown', 'to-operator'])
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isCount = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0

/**
 * One saved record, checked field by field (the 0.3.16 review, ER-8): a record the file holds in any other shape is
 * left out, never half-read, so a damaged entry cannot start a run, count against the day or hide a request.
 */
export function isDispatchRecord(r: unknown): r is DispatchRecord {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false
  const x = r as Record<string, unknown>
  return isText(x.requestId) && isText(x.projectId) && isText(x.dispatchId) && isText(x.workflowId) && isText(x.handoffId)
    && (x.launchId === null || isText(x.launchId))
    && isCount(x.startedAt) && typeof x.endsAt === 'string' && Number.isFinite(Date.parse(x.endsAt))
    && (x.state === 'starting' || x.state === 'running' || x.state === 'ended')
    && (x.outcome === undefined || OUTCOMES.has(x.outcome as string))
    && isCount(x.emptyRuns)
    && (x.attempts === undefined || isCount(x.attempts)) && (x.endedAt === undefined || isCount(x.endedAt))
    && (x.until === undefined || isCount(x.until)) && (x.closeAttempts === undefined || isCount(x.closeAttempts))
    && (x.closed === undefined || typeof x.closed === 'boolean') && (x.refused === undefined || typeof x.refused === 'string')
    && (x.askAgain === undefined || typeof x.askAgain === 'boolean') && (x.crashed === undefined || typeof x.crashed === 'boolean')
}

export interface DispatchDeps {
  now(): number
  switchOn(): boolean
  readRequests(): Promise<OpenRequest[]>
  /** A live responder holds the capability on the project (board_status). */
  responderLive(projectId: string, capability: string): Promise<boolean>
  /** A live session is enrolled in the project. */
  sessionLive(projectId: string): boolean
  /** The project's folder on this machine, or null. */
  folderOf(projectId: string): Promise<string | null>
  /** The default agent's provider, or null when none is set. */
  defaultProvider(): Promise<'claude' | 'codex' | null>
  observatory: ToolCall
  launch(args: { dir: string; workflow: string; handoff: string; request: string; dispatchId: string; timeoutMinutes: number }): Promise<{ launchId: string } | { refused: string }>
  /** Whether the run still runs; `crashed` when it ended with a failure exit code; `unknown` when Switchboard cannot say. */
  runState(launchId: string): Promise<'running' | 'ended' | 'crashed' | 'unknown'>
  /** §3.6: stop a run past its time limit (`switchboard dispatch stop`); absent, no run is stopped. */
  stop?(launchId: string): Promise<'stopped' | 'already-ended' | 'failed'>
  /** The request's state now, or null when it cannot be read. */
  requestState(requestId: string): Promise<string | null>
  load(): DispatchRecord[]
  save(records: DispatchRecord[]): void
  /** The app is quitting: no new start, no new Switchboard call. */
  quitting?(): boolean
  log(op: string, outcome: 'ok' | 'failed' | 'unknown', detail: Record<string, unknown>): void
}

const SETTLED = new Set(['completed', 'failed_known', 'answered', 'cancelled', 'expired'])
/** A run left its request settled when the request is SETTLED or `outcome_unknown` (the run claimed it and the board can
 *  no longer say; it is the operator's now, not an empty run). Agreed with fabric-agent-adapter (FAA-213, FAA-215) and
 *  private31 on the board, thread `1add3c03`, 2026-11-05 (CO-409). */
const RUN_SETTLED = new Set([...SETTLED, 'outcome_unknown'])
/** Observatory's typed refusal for a closed workflow, matched by name (never the word «closed», NB-1). */
const CLOSED = /\bWorkflowClosed\b/
const DAY_MS = 24 * 3600_000
/** After a refusal or a start that never answered, Switchboard is not asked again for that request sooner than this (the 0.3.16 review, ER-1, DA-2). */
export const REFUSAL_BACKOFF_MS = 10 * 60_000
/** A workflow is taken back only once its newest checkpoint is this old (the on-demand spec §3.4, CO-409's ER-5):
 *  Observatory refuses a take-back without the lease sooner, and a refused one used to cost the request the back-off. */
export const TAKE_BACK_SILENCE_MS = 120_000
/** An open asked again with its first end only while that end is this far off (ER-9); nearer, it is opened anew. */
const LAUNCH_AGAIN_MARGIN_MS = 10 * 60_000
/** The workflow's run wrote a checkpoint less than TAKE_BACK_SILENCE_MS ago: wait for a later pass, not a failure. */
class NotSilentYet extends Error {}
/** The longest a refusal that keeps coming back waits (CO-409, the 0.3.16 review's ER-6). */
export const REFUSAL_BACKOFF_MAX_MS = 6 * 3600_000
/**
 * How long a request waits after `refusals` refusals or failed starts in a row: the first REFUSAL_BACKOFF_MS, each
 * next one twice the last, at most REFUSAL_BACKOFF_MAX_MS (CO-409, ER-6: a refusal that keeps coming back, such as no
 * default agent, is not asked again every ten minutes for the request's whole week).
 */
export function refusalBackoffMs(refusals: number): number {
  if (refusals <= 1) return REFUSAL_BACKOFF_MS
  return Math.min(REFUSAL_BACKOFF_MAX_MS, REFUSAL_BACKOFF_MS * 2 ** Math.min(refusals - 1, 16))
}
/** Times one start is asked of Switchboard before it is recorded as failed to start. */
export const START_ATTEMPTS = 3
/** A run Switchboard cannot report on is taken as ended this long after its own end (ER-3). */
export const UNKNOWN_AFTER_END_MS = 10 * 60_000
/** A run still running this long past its own end is stopped through Switchboard (§3.6, DO-5). */
export const STOP_GRACE_MS = 5 * 60_000
/** Times a to-operator workflow's close is tried before Fabric gives up on it (iteration 3, ER-1). */
export const CLOSE_ATTEMPTS = 5
/** How long a request's newest record is kept whatever the history bound (iteration 3, DA-2): past a week the board
 *  has expired the request. */
export const KEEP_REQUEST_MS = 8 * DAY_MS

/** A failure's note for the log: its message without absolute paths (DA-7), at most 200 characters. */
export function noteOf(e: unknown): string {
  // A path may hold spaces (a folder named with words), so everything from the first absolute path on is dropped
  // (the 0.3.16 review, iterations 2 and 3, DA-5, ER-10, and the final candidate's NB-3): after a space, a quote, a
  // backtick, `(`, `=`, `:`, `[`, `{`, `<`, `,`, `;` or `|`, as `/…`, `~/…`, `C:\…` or a `file://` URL.
  return (e instanceof Error ? e.message : String(e)).replace(/(^|[\s'"`(=:[{<,;|])(?:file:\/\/|~|[A-Za-z]:)?[\\/][\s\S]*$/, '$1<path>').slice(0, 200)
}

/** Why a request is the operator's: two runs left it unsettled, or it passed its deadline accepted with no run (ER-7). */
export type ToOperatorWhy = 'runs' | 'past-due'

/**
 * §3.1: a request filed on the board wakes the dispatcher when its grace ends, instead of on the next 60 s cycle after
 * it; several requests filed together wake it once. The cycle still runs every pass, so a missed wake costs at most a
 * cycle (CO-409).
 */
/** The grace of §3.1 plus a few seconds, so the wake lands after the request's grace has passed. */
export const GRACE_AFTER_MS = GRACE_MS + 5_000

export function createDispatchWake(onPass: () => void, deps: { graceMs: number; setTimer?: (fn: () => void, ms: number) => unknown; clearTimer?: (t: unknown) => void; now?: () => number } = { graceMs: GRACE_AFTER_MS }): { wake(): void; stop(): void } {
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => { const t = setTimeout(fn, ms); t.unref?.(); return t })
  const clearTimer = deps.clearTimer ?? ((t: unknown) => clearTimeout(t as ReturnType<typeof setTimeout>))
  const now = deps.now ?? Date.now
  let due: number | null = null
  let timer: unknown = null
  return {
    wake() {
      const at = now() + deps.graceMs
      // An earlier wake already pending covers this one too: the pass reads every open request.
      if (due !== null && due <= at) return
      if (timer !== null) clearTimer(timer)
      due = at
      timer = setTimer(() => { due = null; timer = null; onPass() }, deps.graceMs)
    },
    stop() { if (timer !== null) clearTimer(timer); timer = null; due = null }
  }
}

export function createBoardDispatch(deps: DispatchDeps): { onPass(): Promise<void>; records(): DispatchRecord[]; toOperator(): Map<string, ToOperatorWhy> } {
  let records = deps.load()
  let busy = false
  const decided = new Map<string, string>()
  /** ER-7: requests past their deadline, accepted and unsettled, that no record of Fabric's carries. */
  const pastDue = new Set<string>()
  const said = (requestId: string, d: DispatchDecision): void => {
    const key = d.path + ('check' in d ? `:${d.check}` : '')
    if (decided.get(requestId) === key) return
    decided.set(requestId, key)
    deps.log('board.dispatch.decided', 'ok', { request: requestId, path: d.path, ...('check' in d ? { check: d.check } : {}) })
  }

  const watch = async (now: number): Promise<void> => {
    let changed = false
    for (const r of records) {
      if (r.state !== 'running' || !r.launchId) continue
      const run = await deps.runState(r.launchId)
      if (run === 'running') {
        // §3.6 (DO-5): a run still running past its own end plus a grace, which Switchboard's own timeout should have
        // ended, is stopped through Switchboard and ends `timed-out`; it counts as empty unless its request is settled.
        if (!deps.stop || now <= Date.parse(r.endsAt) + STOP_GRACE_MS) continue
        const stopped = await deps.stop(r.launchId)
        if (stopped === 'failed') {
          deps.log('board.dispatch.ended', 'failed', { request: r.requestId, dispatch: r.dispatchId, outcome: 'timed-out', note: 'Switchboard did not stop the run; it is asked again on the next pass' })
          continue
        }
        const state = await deps.requestState(r.requestId)
        const settled = state !== null && RUN_SETTLED.has(state)
        r.state = 'ended'
        r.endedAt = now
        r.outcome = settled ? 'finished' : 'timed-out'
        if (!settled) r.emptyRuns++
        changed = true
        deps.log('board.dispatch.ended', settled ? 'ok' : 'unknown', { request: r.requestId, dispatch: r.dispatchId, outcome: r.outcome, empty_runs: r.emptyRuns })
        continue
      }
      if (run === 'unknown') {
        // ER-3: Switchboard cannot say. Past the run's own end plus a margin it is taken as ended, outcome unknown, so it
        // no longer holds a place under the caps; it is not counted as an empty run.
        if (now <= Date.parse(r.endsAt) + UNKNOWN_AFTER_END_MS) continue
        r.state = 'ended'
        r.outcome = 'unknown'
        r.endedAt = now
        // Iteration 3, ER-2: a run nobody can account for counts as empty unless its request is settled, so the stop
        // after two empty runs holds even when Switchboard cannot say how a run ended.
        const settled = await deps.requestState(r.requestId)
        if (!(settled !== null && RUN_SETTLED.has(settled))) r.emptyRuns++
        changed = true
        deps.log('board.dispatch.ended', 'unknown', { request: r.requestId, dispatch: r.dispatchId, outcome: r.outcome, empty_runs: r.emptyRuns })
        continue
      }
      // ER-6: the request's state as read in THIS pass; when it cannot be read the run is judged on a later pass.
      const state = await deps.requestState(r.requestId)
      if (state === null) {
        // Iteration 2, ER-1: a request outside this pass's read (older than the window, past the pages) is never judged;
        // past the run's end plus the margin the run is ended as unknown, so it frees its place. CO-512: and it counts as
        // empty, as iteration 3's ER-2 counts a run Switchboard cannot account for, or a request moving in and out of the
        // read at its page bounds would be started a third time and more. A request read settled later starts nothing.
        if (now <= Date.parse(r.endsAt) + UNKNOWN_AFTER_END_MS) continue
        r.state = 'ended'
        r.outcome = 'unknown'
        r.endedAt = now
        r.emptyRuns++
        changed = true
        deps.log('board.dispatch.ended', 'unknown', { request: r.requestId, dispatch: r.dispatchId, outcome: r.outcome, empty_runs: r.emptyRuns })
        continue
      }
      r.state = 'ended'
      r.endedAt = now
      if (run === 'crashed') r.crashed = true
      r.outcome = RUN_SETTLED.has(state) ? 'finished' : 'exited-without-answer'
      if (r.outcome === 'exited-without-answer') r.emptyRuns++
      changed = true
      deps.log('board.dispatch.ended', r.outcome === 'finished' ? 'ok' : 'unknown', { request: r.requestId, dispatch: r.dispatchId, outcome: r.outcome, empty_runs: r.emptyRuns })
    }
    if (changed) deps.save(records)
  }

  /** Opens the workflow (first run) or takes it back (a later run), writes run-ends-at and offers it on. */
  const open = async (req: OpenRequest, prior: DispatchRecord | undefined, provider: 'claude' | 'codex', endsAt: string, dispatchId: string): Promise<{ workflowId: string; handoffId: string }> => {
    const body = {
      goal: `Answer the board request ${req.id} addressed to this project, then end.`,
      constraints: [
        'Read the request with com.get and its thread with com.list under your own credential.',
        // fabric-agent-contract DEC-0152 (`v0.1.0+2026-11-07.4`, SA-6, CO-530): the slot first; a live holder is left alone.
        'Read the slot with com.status first: when it is active, a live service of the project holds the request, so leave it, send nothing, ask no one and end.',
        'Otherwise claim it (com.enroll, com.claim), renew about every 20 s during a long step, give the state with com.progress, accept it with com.accept before its effect begins, answer in its thread, and close it with com.complete once the work is done.',
        // fabric-agent-adapter FAA-247: the step above alone would let a refused run answer the request and take it from
        // the project's service. The refusal follows the board rule every session reads (protocolObligations.ts).
        'If com.enroll answers not_authorized, follow the board rule board.read-at-start (fabric_whoami): send one com.reply, with why and what lifts it, only when com.status shows the slot absent at generation 0, otherwise no com.reply (a service of the project will take the request); then ask the operator with fabric_question_ask, then end.',
        'Stop before any step that touches production and hand it to a session the person is in or to the operator.',
        'Write the final checkpoint and close the workflow only once the request is settled, then end.',
        // CO-409 (DEC-0125 MD-2, MD-3): the operator's mandate the request carries, unchanged; the run appends itself.
        ...(req.mandate ? [`The operator's mandate for this request (DEC-0125, carried by the requesting project's verified message): ${JSON.stringify(req.mandate)}. Act on what it covers as the operator's decision, append yourself to its chain on each call you make under it, and ask the operator for anything it does not cover (outside-mandate).`] : [])
      ],
      artifacts: [
        { kind: 'other', ref: `board-request:${req.id}` },
        { kind: 'other', ref: `board-thread:${req.thread}` },
        { kind: 'other', ref: `capability:${req.capability}` },
        { kind: 'other', ref: `fabric-project:${req.target}` },
        { kind: 'other', ref: `deadline:${req.deadline}` },
        { kind: 'other', ref: `run-ends-at:${endsAt}` }
      ],
      open: [{ step_id: 'answer', next_action: 'Take the request and answer it.' }]
    }
    let workflowId: string
    let leaseId: string
    if (!prior) {
      const projectId = await resolveProject(req.target)
      const w = await deps.observatory('observatory_checkpoint_write', {
        owner: FABRIC_OWNER, idempotencyKey: `dispatch-${dispatchId}-open`, stepId: 'run-ends-at', status: 'in_progress', projectId, body
      })
      if (typeof w.workflowId !== 'string' || typeof w.leaseId !== 'string') throw new Error(`the workflow was not opened: ${String(w.error ?? 'no id')}`)
      workflowId = w.workflowId
      leaseId = w.leaseId
    } else if (leases.has(prior.workflowId) && await (async () => {
      // A start that was refused or failed: the offer was never accepted, so Fabric still holds the workflow. When the
      // lease was superseded after all (a start that did run, iteration 2, ER-4), it is dropped and taken back below.
      try {
        const w = await deps.observatory('observatory_checkpoint_write', {
          owner: FABRIC_OWNER, idempotencyKey: `dispatch-${dispatchId}-ends-held`, stepId: 'run-ends-at', status: 'in_progress', workflowId: prior.workflowId, leaseId: leases.get(prior.workflowId), body
        })
        if (w.error) throw new Error(String(w.error))
        return true
      } catch {
        // The lease is no longer Fabric's: take the workflow back as after a run.
        leases.delete(prior.workflowId)
        return false
      }
    })()) {
      workflowId = prior.workflowId
      leaseId = leases.get(prior.workflowId)!
    } else {
      // §3.4: a run that left the request unsettled keeps the lease; Fabric takes the workflow back to itself, once the
      // workflow has been silent 120 s (ER-5). An answer that cannot be read leaves it to Observatory's own check.
      workflowId = prior.workflowId
      const latest = await deps.observatory('observatory_checkpoint_latest', { workflowId }).catch(() => null)
      const written = Date.parse(String((latest?.checkpoint as { createdAt?: unknown } | undefined)?.createdAt ?? ''))
      if (Number.isFinite(written) && deps.now() - written < TAKE_BACK_SILENCE_MS) throw new NotSilentYet()
      let back: Record<string, unknown>
      try {
        back = await deps.observatory('observatory_handoff_create', {
          owner: FABRIC_OWNER, idempotencyKey: `dispatch-${dispatchId}-back`, workflowId, to: { provider: 'fabric' }, reason: prior.crashed ? 'crash' : 'restart'
        })
      } catch (e) {
        // Iteration 3, ER-3 (agreed on the board, thread `1add3c03`): a run closed the workflow itself while the request
        // stayed open, so it cannot be taken back; the request gets a workflow of its own again.
        // Matched by Observatory's typed name, never the word «closed», which a dropped connection also says (final
        // candidate's verification, NB-1).
        if (CLOSED.test(e instanceof Error ? e.message : String(e))) return open(req, undefined, provider, endsAt, dispatchId)
        throw e
      }
      if (typeof back.handoffId !== 'string') {
        if (CLOSED.test(String(back.error ?? ''))) return open(req, undefined, provider, endsAt, dispatchId)
        throw new Error(`the workflow could not be taken back: ${String(back.error ?? 'no handoff')}`)
      }
      const took = await deps.observatory('observatory_handoff_accept', { owner: FABRIC_OWNER, idempotencyKey: `dispatch-${dispatchId}-accept`, handoffId: back.handoffId })
      if (typeof took.leaseId !== 'string') throw new Error(`the workflow could not be accepted back: ${String(took.error ?? 'no lease')}`)
      leaseId = took.leaseId
      const w = await deps.observatory('observatory_checkpoint_write', {
        owner: FABRIC_OWNER, idempotencyKey: `dispatch-${dispatchId}-ends`, stepId: 'run-ends-at', status: 'in_progress', workflowId, leaseId, body
      })
      if (w.error) throw new Error(`run-ends-at was not written: ${String(w.error)}`)
    }
    const offer = await deps.observatory('observatory_handoff_create', {
      owner: FABRIC_OWNER, idempotencyKey: `dispatch-${dispatchId}-offer`, workflowId, to: { provider }, reason: 'plan_route', leaseId, offerTtlSeconds: 3600
    })
    if (typeof offer.handoffId !== 'string') throw new Error(`the hand-over was not offered: ${String(offer.error ?? 'no handoff')}`)
    leases.set(workflowId, leaseId)
    return { workflowId, handoffId: offer.handoffId }
  }

  // The workflow's lease while Fabric still holds it (an offer not yet accepted): kept in memory only, never in the file.
  const leases = new Map<string, string>()
  const projectIds = new Map<string, string>()
  const openFailedAt = new Map<string, number>()
  /** ER-9: the dispatch id and end of an open whose answer was lost, asked again with the same ones. */
  const retryOpen = new Map<string, { dispatchId: string; endsAt: string }>()
  /** §3.6: a request that goes to the operator has its workflow closed, taken back first when a run holds it. */
  const closeWorkflow = async (r: DispatchRecord, why: 'to-operator' | 'settled' | 'unsaved' = 'to-operator'): Promise<void> => {
    let leaseId = leases.get(r.workflowId)
    if (!leaseId) {
      // CO-409 (FAA-213, 2026-11-05): a workflow a run already closed is closed; nothing to retry.
      let back: Record<string, unknown>
      try {
        back = await deps.observatory('observatory_handoff_create', {
          owner: FABRIC_OWNER, idempotencyKey: `dispatch-${r.dispatchId}-close-back`, workflowId: r.workflowId, to: { provider: 'fabric' }, reason: 'restart'
        })
      } catch (e) {
        if (CLOSED.test(e instanceof Error ? e.message : String(e))) return
        throw e
      }
      if (CLOSED.test(String(back.error ?? ''))) return
      if (typeof back.handoffId !== 'string') throw new Error('the workflow could not be taken back to close it')
      const took = await deps.observatory('observatory_handoff_accept', { owner: FABRIC_OWNER, idempotencyKey: `dispatch-${r.dispatchId}-close-accept`, handoffId: back.handoffId })
      if (typeof took.leaseId !== 'string') throw new Error('the workflow could not be accepted back to close it')
      leaseId = took.leaseId
    }
    const w = await deps.observatory('observatory_checkpoint_write', {
      owner: FABRIC_OWNER, idempotencyKey: `dispatch-${r.dispatchId}-close`, stepId: why, status: why === 'settled' ? 'done' : 'blocked', workflowId: r.workflowId, leaseId, close: true,
      body: { goal: `Answer the board request ${r.requestId} addressed to this project, then end.`, notes: why === 'settled'
        ? 'The run ended before the request was settled; another session settled it, so Fabric closes the workflow it opened.'
        : why === 'unsaved'
          ? 'Fabric could not record this dispatch, or quit before it, so it started nothing and closes the workflow; a later attempt opens a new one.'
          : 'Two runs left the request unsettled; it waits for the operator in «На проверке».' }
    })
    if (CLOSED.test(String(w.error ?? ''))) { leases.delete(r.workflowId); return }
    if (w.error) throw new Error('the workflow was not closed')
    leases.delete(r.workflowId)
  }
  const resolveProject = async (fabricProject: string): Promise<string> => {
    const known = projectIds.get(fabricProject)
    if (known) return known
    const folder = await deps.folderOf(fabricProject)
    if (!folder) throw new Error('the project has no folder on this computer')
    const r = await deps.observatory('observatory_resolve', { id: folder })
    if (typeof r.canonical !== 'string') throw new Error('Observatory does not know this project')
    projectIds.set(fabricProject, r.canonical)
    return r.canonical
  }

  /** Asks Switchboard for a record written as `starting`; idempotent on Switchboard's side for one workflow. */
  const start = async (r: DispatchRecord, dir: string, now: number): Promise<void> => {
    r.attempts = (r.attempts ?? 0) + 1
    const timeoutMinutes = Math.max(1, Math.floor((Date.parse(r.endsAt) - now) / 60_000))
    const started = await deps.launch({ dir, workflow: r.workflowId, handoff: r.handoffId, request: r.requestId, dispatchId: r.dispatchId, timeoutMinutes })
    if ('launchId' in started) {
      r.launchId = started.launchId
      r.state = 'running'
      // The run accepts the hand-over: the lease is its now, and a later run takes the workflow back (§3.4).
      leases.delete(r.workflowId)
      deps.log('board.dispatch.started', 'ok', { request: r.requestId, dispatch: r.dispatchId, workflow: r.workflowId, launch: started.launchId, ends_at: r.endsAt })
    } else if (started.refused !== 'failed') {
      // A refusal is Switchboard's answer: nothing started. The request waits `refusalBackoffMs` before it is asked again.
      r.state = 'ended'
      r.endedAt = now
      r.outcome = 'refused'
      r.refused = started.refused
      said(r.requestId, { path: 'wait', check: refusalCheck(started.refused) })
    } else if (r.attempts >= START_ATTEMPTS) {
      r.state = 'ended'
      r.endedAt = now
      r.outcome = 'failed-to-start'
      deps.log('board.dispatch.started', 'failed', { request: r.requestId, dispatch: r.dispatchId, attempts: r.attempts })
    } else {
      // No answer (a timeout or an unreadable one): it may have started. The record stays `starting` and the next pass
      // asks again with the same workflow and hand-over, which Switchboard answers with the run it started, if any.
      deps.log('board.dispatch.started', 'unknown', { request: r.requestId, dispatch: r.dispatchId, attempts: r.attempts })
    }
    deps.save(records)
  }

  const pass = async (): Promise<void> => {
    const now = deps.now()
    const on = deps.switchOn()
    if (!on) {
      // Iteration 3, ER-4, DO-2: a start still waiting for Switchboard's answer is not asked again with the switch off;
      // it ends as unknown, so the board is not read for it and no run starts without a fresh decision.
      let ended = false
      for (const r of records.filter((x) => x.state === 'starting')) {
        r.state = 'ended'; r.outcome = 'unknown'; r.endedAt = now; ended = true
        // NB-2: a start Switchboard was asked for may have begun; it is asked about again once the switch is back on.
        if ((r.attempts ?? 0) > 0) r.askAgain = true
        deps.log('board.dispatch.ended', 'unknown', { request: r.requestId, dispatch: r.dispatchId, outcome: 'switch-off' })
      }
      if (ended) deps.save(records)
    }
    const live = records.some((r) => r.state !== 'ended')
    // ER-7: with the switch off and nothing of ours in flight the board is not read at all.
    if (!on && !live) return
    const requests = await deps.readRequests()
    // A request no longer on the board leaves «На проверке» with it (ER-7).
    for (const id of [...pastDue]) if (!requests.some((q) => q.id === id)) pastDue.delete(id)
    await watch(now)
    // Iteration 2, ER-3, ER-2, DA-2: a request given to the operator has its workflow closed, retried until it is.
    for (const r of records.filter((x) => x.outcome === 'to-operator' && !x.closed && (x.closeAttempts ?? 0) < CLOSE_ATTEMPTS)) {
      if (deps.quitting?.()) return
      r.closeAttempts = (r.closeAttempts ?? 0) + 1
      try {
        await closeWorkflow(r)
        r.closed = true
      } catch (e) {
        // Recorded through the caller's ops sink; the request is already the operator's. Closing is tried again up to
        // CLOSE_ATTEMPTS times, then given up (iteration 3, ER-1): the open workflow is harmless, nobody holds it.
        deps.log('board.dispatch.closed', 'failed', { request: r.requestId, attempt: r.closeAttempts, gave_up: r.closeAttempts >= CLOSE_ATTEMPTS, note: noteOf(e) })
      }
      deps.save(records)
    }
    // CO-409 (promised on the board, thread `1add3c03`, by 2026-11-12): a run that ended with its request unsettled leaves
    // its workflow open, since only a settled request closes it; once another session settles the request, Fabric closes
    // the workflow it opened, as tried as many times as a given-up request's.
    const newestOf = new Map<string, DispatchRecord>()
    for (const r of records) newestOf.set(r.requestId, r)
    for (const r of newestOf.values()) {
      if (r.state !== 'ended' || r.closed || (r.outcome !== 'exited-without-answer' && r.outcome !== 'timed-out' && r.outcome !== 'unknown') || (r.closeAttempts ?? 0) >= CLOSE_ATTEMPTS) continue
      const state = await deps.requestState(r.requestId)
      if (state === null || !RUN_SETTLED.has(state)) continue
      if (deps.quitting?.()) return
      r.closeAttempts = (r.closeAttempts ?? 0) + 1
      try {
        await closeWorkflow(r, 'settled')
        r.closed = true
        deps.log('board.dispatch.closed', 'ok', { request: r.requestId, why: 'settled' })
      } catch (e) {
        // Recorded through the caller's ops sink; an open workflow nobody holds is harmless, so after CLOSE_ATTEMPTS it is left.
        deps.log('board.dispatch.closed', 'failed', { request: r.requestId, why: 'settled', attempt: r.closeAttempts, gave_up: r.closeAttempts >= CLOSE_ATTEMPTS, note: noteOf(e) })
      }
      deps.save(records)
    }
    // NB-2 (the 0.3.16 final candidate's verification): with the switch back on, a start the switch ended after
    // Switchboard was asked is asked again with the same dispatch id, workflow and hand-over while its request is open,
    // so a run that did begin is found and watched rather than left unknown; a settled request is only closed (above).
    if (on) {
      for (const r of records.filter((x) => x.askAgain && x.state === 'ended')) {
        const newest = records.filter((x) => x.requestId === r.requestId).at(-1)
        const open = requests.some((q) => q.id === r.requestId && !SETTLED.has(q.state))
        r.askAgain = false
        if (newest === r && open) { r.state = 'starting'; delete r.outcome; delete r.endedAt }
        deps.save(records)
      }
    }
    // Starts left without an answer are asked again first (ER-1, ER-2); with the switch off, not at all (iteration 2, ER-6).
    for (const r of on ? records.filter((x) => x.state === 'starting') : []) {
      if (deps.quitting?.()) return
      const dir = await deps.folderOf(r.projectId)
      if (!dir) { r.state = 'ended'; r.outcome = 'failed-to-start'; deps.save(records); continue }
      await start(r, dir, now)
    }
    if (!on) return
    const limits = limitsOf()
    for (const req of requests) {
      if (deps.quitting?.()) return
      const mine = records.filter((r) => r.requestId === req.id)
      const last = mine[mine.length - 1]
      if (mine.some((r) => r.outcome === 'to-operator')) continue
      // Iteration 2, ER-2: two empty runs give the request to the operator whatever path the decision would take now.
      if (last && last.state === 'ended' && last.emptyRuns >= EMPTY_RUNS_TO_OPERATOR && !SETTLED.has(req.state)) {
        last.outcome = 'to-operator'
        last.closed = false
        deps.save(records)
        said(req.id, { path: 'to-operator' })
        continue
      }
      const active = records.filter((r) => r.state !== 'ended')
      const slotLive = await deps.responderLive(req.target, req.capability)
      const holderLive = req.attemptLive ?? slotLive
      const decision = decideDispatch({
        now,
        request: { id: req.id, state: req.state, submittedAt: req.submittedAt, deadline: req.deadline, urgent: false, holderLive, attemptLapsed: !holderLive },
        liveResponder: slotLive,
        liveSession: deps.sessionLive(req.target),
        switchOn: on,
        hasFolder: (await deps.folderOf(req.target)) !== null,
        runningOnMachine: active.length,
        runningInProject: active.filter((r) => r.projectId === req.target).length,
        // Only runs that started count against the day (iteration 2, ER-7, DA-3); the day is the last 24 hours.
        dispatchesToday: records.filter((r) => r.projectId === req.target && r.launchId !== null && now - r.startedAt < DAY_MS).length,
        emptyRuns: last?.emptyRuns ?? 0,
        inFlight: last !== undefined && last.state !== 'ended',
        limits
      })
      said(req.id, decision)
      // ER-7: an accepted request past its deadline that Fabric never started a run for has no record to carry the
      // operator's mark, so it is held here and shown in «На проверке» like a request given up after two runs.
      if (decision.path === 'to-operator' && !last && !SETTLED.has(req.state)) pastDue.add(req.id)
      else pastDue.delete(req.id)
      if (decision.path === 'to-operator') {
        if (last && !SETTLED.has(req.state)) {
          last.outcome = 'to-operator'
          last.closed = false
          deps.save(records)
        }
        continue
      }
      if (decision.path !== 'launch') continue
      if (last?.outcome === 'refused' || last?.outcome === 'failed-to-start') {
        let inRow = 0
        for (let i = mine.length - 1; i >= 0 && (mine[i].outcome === 'refused' || mine[i].outcome === 'failed-to-start'); i--) inRow++
        if (now - (last.endedAt ?? last.startedAt) < refusalBackoffMs(inRow)) continue
      }
      // Iteration 2, ER-5: a workflow that could not be opened is not tried again for the request sooner than the back-off.
      if (now - (openFailedAt.get(req.id) ?? -Infinity) < REFUSAL_BACKOFF_MS) continue
      const provider = await deps.defaultProvider()
      if (!provider) { said(req.id, { path: 'wait', check: 'deferred-no-agent' }); continue }
      const folder = await deps.folderOf(req.target)
      if (!folder) continue
      // ER-9: an open whose answer was lost is asked again with the same dispatch id and end, so Observatory's
      // idempotency answers the workflow it opened instead of a second one being left open beside it.
      const again = retryOpen.get(req.id)
      const reuse = again && Date.parse(again.endsAt) - now > LAUNCH_AGAIN_MARGIN_MS ? again : null
      retryOpen.delete(req.id)
      const dispatchId = reuse?.dispatchId ?? randomUUID()
      const endsAt = reuse?.endsAt ?? runEndsAt(now, limits.runMinutes, req.deadline)
      let opened: { workflowId: string; handoffId: string }
      try {
        opened = await open(req, last, provider, endsAt, dispatchId)
        firstLine({ workflow: opened.workflowId, handoff: opened.handoffId, request: req.id }) // the ids are well formed (§3.5)
      } catch (e) {
        // ER-5: the run's workflow is not silent yet; a later pass takes it back, with no back-off and no failure.
        if (e instanceof NotSilentYet) { deps.log('board.dispatch.decided', 'ok', { request: req.id, path: 'wait', check: 'workflow-not-silent' }); continue }
        // Recorded through the caller's ops sink (deps.log); the request is tried again on a later pass.
        deps.log('board.dispatch.started', 'failed', { request: req.id, dispatch: dispatchId, note: noteOf(e) })
        openFailedAt.set(req.id, now)
        if (!last) retryOpen.set(req.id, { dispatchId, endsAt })
        continue
      }
      const r: DispatchRecord = { requestId: req.id, projectId: req.target, dispatchId, workflowId: opened.workflowId, handoffId: opened.handoffId, launchId: null,
        startedAt: now, endsAt, state: 'starting', attempts: 0, emptyRuns: last?.emptyRuns ?? 0,
        ...(Number.isFinite(Date.parse(req.deadline)) ? { until: Date.parse(req.deadline) } : {}) }
      if (deps.quitting?.()) {
        // ER-9: the app quits between opening the workflow and recording the start: nothing starts, and the workflow
        // Fabric holds is closed rather than left open with a lease nobody will hold after the restart.
        await closeWorkflow(r, 'unsaved').catch((c: unknown) => deps.log('board.dispatch.closed', 'failed', { request: req.id, dispatch: dispatchId, note: noteOf(c) }))
        return
      }
      records.push(r)
      try {
        deps.save(records)
      } catch (e) {
        // ER-8: a record that could not be saved is not started; it is dropped, so no later pass starts it either, and the
        // workflow Fabric holds for it is closed; the next attempt after the back-off opens a new one.
        records = records.filter((x) => x !== r)
        openFailedAt.set(req.id, now)
        deps.log('board.dispatch.started', 'failed', { request: req.id, dispatch: dispatchId, note: `the record could not be saved: ${noteOf(e)}` })
        await closeWorkflow(r, 'unsaved').catch((c: unknown) => deps.log('board.dispatch.closed', 'failed', { request: req.id, dispatch: dispatchId, note: noteOf(c) }))
        continue
      }
      await start(r, folder, now)
    }
    // A bounded history (iteration 3, DA-2; the final candidate's verification, B-1): never a record in flight, and never
    // a request's newest record while the request can still come back: started in the last eight days
    // (`KEEP_REQUEST_MS`), before its own deadline, or read on the board in this pass. So its count of empty runs and a
    // request given to the operator stay. Of the rest, the newest 500.
    const newest = new Map<string, DispatchRecord>()
    for (const r of records) newest.set(r.requestId, r)
    const shown = new Set(requests.map((q) => q.id))
    // NB-5: a run started in the last day is kept too, so the day's count of started runs never loses one to a trim.
    const kept = (r: DispatchRecord): boolean => r.state !== 'ended' || (r.launchId !== null && now - r.startedAt < DAY_MS)
      || (newest.get(r.requestId) === r && (now - r.startedAt < KEEP_REQUEST_MS || (r.until ?? 0) > now || shown.has(r.requestId)))
    const rest = records.filter((r) => !kept(r))
    if (rest.length > 500) {
      const drop = new Set(rest.slice(0, rest.length - 500))
      records = records.filter((r) => !drop.has(r))
      deps.save(records)
    }
  }

  return {
    async onPass() {
      if (busy || deps.quitting?.()) return
      busy = true
      try { await pass() } catch (e) {
        // Recorded through the caller's ops sink (deps.log); the next pass reads the board again.
        deps.log('board.dispatch.pass', 'failed', { note: noteOf(e) })
      } finally { busy = false }
    },
    records: () => records,
    toOperator: () => new Map<string, ToOperatorWhy>([
      ...[...pastDue].map((id) => [id, 'past-due'] as [string, ToOperatorWhy]),
      ...records.filter((r) => r.outcome === 'to-operator').map((r) => [r.requestId, 'runs'] as [string, ToOperatorWhy])
    ])
  }
}

// #endregion board-dispatch-run
