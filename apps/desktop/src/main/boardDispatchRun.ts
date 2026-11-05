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
import { decideDispatch, EMPTY_RUNS_TO_OPERATOR, firstLine, limitsOf, runEndsAt, refusalCheck, type DispatchDecision, type RequestState } from '../shared/boardDispatch.ts'
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
  /** `starting`: written BEFORE Switchboard is asked (the 0.3.16 review, ER-1, ER-2), so a timeout, a crash or a quit
   *  during the start never leaves a request without its record; the next pass asks Switchboard again with the same
   *  workflow and hand-over, which answers the same launch when it did start. */
  state: 'starting' | 'running' | 'ended'
  outcome?: 'finished' | 'exited-without-answer' | 'failed-to-start' | 'refused' | 'unknown' | 'to-operator'
  /** Switchboard's refusal code, when it refused. */
  refused?: string
  /** How many times Switchboard was asked for this record. */
  attempts?: number
  /** When the record ended (ms); a refusal's back-off counts from here (0.3.16 review, iteration 2, ER-7). */
  endedAt?: number
  /** For `to-operator`: the workflow is closed. Absent or false: closing is tried again each pass (ER-3). */
  closed?: boolean
  /** Times closing was tried; after `CLOSE_ATTEMPTS` it is given up and said once (iteration 3, ER-1). */
  closeAttempts?: number
  /** Runs for this request that ended without settling it. */
  emptyRuns: number
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
  /** Whether the run still runs; `unknown` when Switchboard cannot say. */
  runState(launchId: string): Promise<'running' | 'ended' | 'unknown'>
  /** The request's state now, or null when it cannot be read. */
  requestState(requestId: string): Promise<string | null>
  load(): DispatchRecord[]
  save(records: DispatchRecord[]): void
  /** The app is quitting: no new start, no new Switchboard call. */
  quitting?(): boolean
  log(op: string, outcome: 'ok' | 'failed' | 'unknown', detail: Record<string, unknown>): void
}

const SETTLED = new Set(['completed', 'failed_known', 'answered', 'cancelled', 'expired'])
const DAY_MS = 24 * 3600_000
/** After a refusal or a start that never answered, Switchboard is not asked again for that request sooner than this (the 0.3.16 review, ER-1, DA-2). */
export const REFUSAL_BACKOFF_MS = 10 * 60_000
/** Times one start is asked of Switchboard before it is recorded as failed to start. */
export const START_ATTEMPTS = 3
/** A run Switchboard cannot report on is taken as ended this long after its own end (ER-3). */
export const UNKNOWN_AFTER_END_MS = 10 * 60_000
/** Times a to-operator workflow's close is tried before Fabric gives up on it (iteration 3, ER-1). */
export const CLOSE_ATTEMPTS = 5
/** How long a request's newest record is kept whatever the history bound (iteration 3, DA-2): past a week the board
 *  has expired the request. */
export const KEEP_REQUEST_MS = 8 * DAY_MS

/** A failure's note for the log: its message without absolute paths (DA-7), at most 200 characters. */
export function noteOf(e: unknown): string {
  // A path may hold spaces (a folder named with words), so everything from the first absolute path on is dropped
  // (the 0.3.16 review, iterations 2 and 3, DA-5, ER-10): after a space, a quote, `(`, `=`, `:`, `[` or `,`, as
  // `/…`, `~/…`, `C:\…` or a `file://` URL.
  return (e instanceof Error ? e.message : String(e)).replace(/(^|[\s'"(=:[,])(?:file:\/\/|~|[A-Za-z]:)?[\\/][\s\S]*$/, '$1<path>').slice(0, 200)
}

export function createBoardDispatch(deps: DispatchDeps): { onPass(): Promise<void>; records(): DispatchRecord[]; toOperator(): Set<string> } {
  let records = deps.load()
  let busy = false
  const decided = new Map<string, string>()
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
      if (run === 'running') continue
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
        if (!(settled !== null && SETTLED.has(settled))) r.emptyRuns++
        changed = true
        deps.log('board.dispatch.ended', 'unknown', { request: r.requestId, dispatch: r.dispatchId, outcome: r.outcome, empty_runs: r.emptyRuns })
        continue
      }
      // ER-6: the request's state as read in THIS pass; when it cannot be read the run is judged on a later pass.
      const state = await deps.requestState(r.requestId)
      if (state === null) {
        // Iteration 2, ER-1: a request outside this pass's read (older than the window, past the pages) is never judged;
        // past the run's end plus the margin the run is ended as unknown, so it frees its place.
        if (now <= Date.parse(r.endsAt) + UNKNOWN_AFTER_END_MS) continue
        r.state = 'ended'
        r.outcome = 'unknown'
        r.endedAt = now
        changed = true
        deps.log('board.dispatch.ended', 'unknown', { request: r.requestId, dispatch: r.dispatchId, outcome: r.outcome })
        continue
      }
      r.state = 'ended'
      r.endedAt = now
      r.outcome = SETTLED.has(state) ? 'finished' : 'exited-without-answer'
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
        'Claim it (com.enroll, com.claim), renew about every 20 s during a long step, answer in its thread, complete it.',
        'Stop before any step that touches production and hand it to a session the person is in or to the operator.',
        'Write the final checkpoint, then end.'
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
      // §3.4: a run that left the request unsettled keeps the lease; Fabric takes the workflow back to itself.
      workflowId = prior.workflowId
      let back: Record<string, unknown>
      try {
        back = await deps.observatory('observatory_handoff_create', {
          owner: FABRIC_OWNER, idempotencyKey: `dispatch-${dispatchId}-back`, workflowId, to: { provider: 'fabric' }, reason: 'restart'
        })
      } catch (e) {
        // Iteration 3, ER-3 (agreed on the board, thread `1add3c03`): a run closed the workflow itself while the request
        // stayed open, so it cannot be taken back; the request gets a workflow of its own again.
        if (/closed/i.test(e instanceof Error ? e.message : String(e))) return open(req, undefined, provider, endsAt, dispatchId)
        throw e
      }
      if (typeof back.handoffId !== 'string') {
        if (/closed/i.test(String(back.error ?? ''))) return open(req, undefined, provider, endsAt, dispatchId)
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
  /** §3.6: a request that goes to the operator has its workflow closed, taken back first when a run holds it. */
  const closeWorkflow = async (r: DispatchRecord): Promise<void> => {
    let leaseId = leases.get(r.workflowId)
    if (!leaseId) {
      const back = await deps.observatory('observatory_handoff_create', {
        owner: FABRIC_OWNER, idempotencyKey: `dispatch-${r.dispatchId}-close-back`, workflowId: r.workflowId, to: { provider: 'fabric' }, reason: 'restart'
      })
      if (typeof back.handoffId !== 'string') throw new Error('the workflow could not be taken back to close it')
      const took = await deps.observatory('observatory_handoff_accept', { owner: FABRIC_OWNER, idempotencyKey: `dispatch-${r.dispatchId}-close-accept`, handoffId: back.handoffId })
      if (typeof took.leaseId !== 'string') throw new Error('the workflow could not be accepted back to close it')
      leaseId = took.leaseId
    }
    const w = await deps.observatory('observatory_checkpoint_write', {
      owner: FABRIC_OWNER, idempotencyKey: `dispatch-${r.dispatchId}-close`, stepId: 'to-operator', status: 'blocked', workflowId: r.workflowId, leaseId, close: true,
      body: { goal: `Answer the board request ${r.requestId} addressed to this project, then end.`, notes: 'Two runs left the request unsettled; it waits for the operator in «На проверке».' }
    })
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
      // A refusal is Switchboard's answer: nothing started. The request waits REFUSAL_BACKOFF_MS before it is asked again.
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
        deps.log('board.dispatch.ended', 'unknown', { request: r.requestId, dispatch: r.dispatchId, outcome: 'switch-off' })
      }
      if (ended) deps.save(records)
    }
    const live = records.some((r) => r.state !== 'ended')
    // ER-7: with the switch off and nothing of ours in flight the board is not read at all.
    if (!on && !live) return
    const requests = await deps.readRequests()
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
      if (decision.path === 'to-operator') {
        if (last && !SETTLED.has(req.state)) {
          last.outcome = 'to-operator'
          last.closed = false
          deps.save(records)
        }
        continue
      }
      if (decision.path !== 'launch') continue
      if ((last?.outcome === 'refused' || last?.outcome === 'failed-to-start') && now - (last.endedAt ?? last.startedAt) < REFUSAL_BACKOFF_MS) continue
      // Iteration 2, ER-5: a workflow that could not be opened is not tried again for the request sooner than the back-off.
      if (now - (openFailedAt.get(req.id) ?? -Infinity) < REFUSAL_BACKOFF_MS) continue
      const provider = await deps.defaultProvider()
      if (!provider) { said(req.id, { path: 'wait', check: 'deferred-no-agent' }); continue }
      const folder = await deps.folderOf(req.target)
      if (!folder) continue
      const dispatchId = randomUUID()
      const endsAt = runEndsAt(now, limits.runMinutes, req.deadline)
      let opened: { workflowId: string; handoffId: string }
      try {
        opened = await open(req, last, provider, endsAt, dispatchId)
        firstLine({ workflow: opened.workflowId, handoff: opened.handoffId, request: req.id }) // the ids are well formed (§3.5)
      } catch (e) {
        // Recorded through the caller's ops sink (deps.log); the request is tried again on a later pass.
        deps.log('board.dispatch.started', 'failed', { request: req.id, dispatch: dispatchId, note: noteOf(e) })
        openFailedAt.set(req.id, now)
        continue
      }
      if (deps.quitting?.()) return
      const r: DispatchRecord = { requestId: req.id, projectId: req.target, dispatchId, workflowId: opened.workflowId, handoffId: opened.handoffId, launchId: null,
        startedAt: now, endsAt, state: 'starting', attempts: 0, emptyRuns: last?.emptyRuns ?? 0 }
      records.push(r)
      deps.save(records)
      await start(r, folder, now)
    }
    // A bounded history (iteration 3, DA-2): never a record in flight, and never a request's newest record while the
    // board can still hold the request (`KEEP_REQUEST_MS`), so its count of empty runs and a given-up request stay; of
    // the rest, the newest 500. The file holds at most 500 plus one record per request of the last eight days.
    const newest = new Map<string, DispatchRecord>()
    for (const r of records) newest.set(r.requestId, r)
    const kept = (r: DispatchRecord): boolean => r.state !== 'ended' || (newest.get(r.requestId) === r && now - r.startedAt < KEEP_REQUEST_MS)
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
    toOperator: () => new Set(records.filter((r) => r.outcome === 'to-operator').map((r) => r.requestId))
  }
}

// #endregion board-dispatch-run
