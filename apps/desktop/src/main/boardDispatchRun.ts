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
import { decideDispatch, firstLine, limitsOf, runEndsAt, refusalCheck, type DispatchDecision, type RequestState } from '../shared/boardDispatch.ts'
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
  state: 'running' | 'ended'
  outcome?: 'finished' | 'exited-without-answer' | 'failed-to-start'
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
  log(op: string, outcome: 'ok' | 'failed' | 'unknown', detail: Record<string, unknown>): void
}

const SETTLED = new Set(['completed', 'failed_known', 'answered', 'cancelled', 'expired'])
const DAY_MS = 24 * 3600_000

export function createBoardDispatch(deps: DispatchDeps): { onPass(): Promise<void>; records(): DispatchRecord[] } {
  let records = deps.load()
  let busy = false
  const decided = new Map<string, string>()
  const said = (requestId: string, d: DispatchDecision): void => {
    const key = d.path + ('check' in d ? `:${d.check}` : '')
    if (decided.get(requestId) === key) return
    decided.set(requestId, key)
    deps.log('board.dispatch.decided', 'ok', { request: requestId, path: d.path, ...('check' in d ? { check: d.check } : {}) })
  }

  const watch = async (): Promise<void> => {
    let changed = false
    for (const r of records) {
      if (r.state !== 'running' || !r.launchId) continue
      const run = await deps.runState(r.launchId)
      if (run !== 'ended') continue
      const state = await deps.requestState(r.requestId)
      r.state = 'ended'
      r.outcome = state !== null && SETTLED.has(state) ? 'finished' : 'exited-without-answer'
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
    } else {
      // §3.4: a run that left the request unsettled keeps the lease; Fabric takes the workflow back to itself.
      workflowId = prior.workflowId
      const back = await deps.observatory('observatory_handoff_create', {
        owner: FABRIC_OWNER, idempotencyKey: `dispatch-${dispatchId}-back`, workflowId, to: { provider: 'fabric' }, reason: 'restart'
      })
      if (typeof back.handoffId !== 'string') throw new Error(`the workflow could not be taken back: ${String(back.error ?? 'no handoff')}`)
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
    return { workflowId, handoffId: offer.handoffId }
  }

  const projectIds = new Map<string, string>()
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

  const pass = async (): Promise<void> => {
    await watch()
    const now = deps.now()
    const requests = await deps.readRequests()
    const limits = limitsOf()
    for (const req of requests) {
      const mine = records.filter((r) => r.requestId === req.id)
      const last = mine[mine.length - 1]
      const running = records.filter((r) => r.state === 'running')
      const slotLive = await deps.responderLive(req.target, req.capability)
      const holderLive = req.attemptLive ?? slotLive
      const decision = decideDispatch({
        now,
        request: { id: req.id, state: req.state, submittedAt: req.submittedAt, deadline: req.deadline, urgent: false, holderLive, attemptLapsed: !holderLive },
        liveResponder: slotLive,
        liveSession: deps.sessionLive(req.target),
        switchOn: deps.switchOn(),
        hasFolder: (await deps.folderOf(req.target)) !== null,
        runningOnMachine: running.length,
        runningInProject: running.filter((r) => r.projectId === req.target).length,
        dispatchesToday: records.filter((r) => r.projectId === req.target && now - r.startedAt < DAY_MS).length,
        emptyRuns: last?.emptyRuns ?? 0,
        inFlight: last?.state === 'running',
        limits
      })
      said(req.id, decision)
      if (decision.path !== 'launch') continue
      const provider = await deps.defaultProvider()
      if (!provider) { said(req.id, { path: 'wait', check: 'deferred-no-agent' }); continue }
      const folder = await deps.folderOf(req.target)
      if (!folder) continue
      const dispatchId = randomUUID()
      const endsAt = runEndsAt(now, limits.runMinutes, req.deadline)
      const timeoutMinutes = Math.max(1, Math.floor((Date.parse(endsAt) - now) / 60_000))
      try {
        const { workflowId, handoffId } = await open(req, last, provider, endsAt, dispatchId)
        firstLine({ workflow: workflowId, handoff: handoffId, request: req.id }) // the ids are well formed (§3.5)
        const started = await deps.launch({ dir: folder, workflow: workflowId, handoff: handoffId, request: req.id, dispatchId, timeoutMinutes })
        if ('refused' in started) {
          said(req.id, { path: 'wait', check: refusalCheck(started.refused) })
          continue
        }
        records.push({ requestId: req.id, projectId: req.target, dispatchId, workflowId, handoffId, launchId: started.launchId, startedAt: now, endsAt,
          state: 'running', emptyRuns: last?.emptyRuns ?? 0 })
        deps.save(records)
        deps.log('board.dispatch.started', 'ok', { request: req.id, dispatch: dispatchId, workflow: workflowId, launch: started.launchId, ends_at: endsAt })
      } catch (e) {
        // Recorded through the caller's ops sink (deps.log); the request is tried again on a later pass.
        deps.log('board.dispatch.started', 'failed', { request: req.id, dispatch: dispatchId, note: e instanceof Error ? e.message.slice(0, 200) : String(e) })
      }
    }
    // Keep a bounded history: the newest 500 records.
    if (records.length > 500) { records = records.slice(-500); deps.save(records) }
  }

  return {
    async onPass() {
      if (busy) return
      busy = true
      try { await pass() } catch (e) {
        // Recorded through the caller's ops sink (deps.log); the next pass reads the board again.
        deps.log('board.dispatch.pass', 'failed', { note: e instanceof Error ? e.message.slice(0, 200) : String(e) })
      } finally { busy = false }
    },
    records: () => records
  }
}

// #endregion board-dispatch-run
