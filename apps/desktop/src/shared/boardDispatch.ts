// #region board-dispatch — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#3-the-flow
/**
 * The dispatcher's decision (CO-409, wave 1; the operator, 2026-11-04: «если такого агента нет и никто задачу не
 * поднял, значит должна бы инициироваться новая сессия … Она все это делает, заканчивает, отчитывается о завершении и
 * выключается»). Pure: the main process reads the request, the responders, the sessions and the running dispatches,
 * hands them in, and acts on what comes back. Nothing here reads, writes or starts anything.
 */

/** How long a request may wait for a live session before a session is started for it (§3.1). */
export const GRACE_MS = 2 * 60_000
/** After this many runs that ended without settling the request, no more are started for it (§3.6, option (b)). */
export const EMPTY_RUNS_TO_OPERATOR = 2

export interface DispatchLimits {
  /** On-demand sessions running at once on this machine (§3.3). */
  maxOnMachine: number
  /** On-demand sessions running at once for one project. */
  maxPerProject: number
  /** Dispatches for one project per UTC day. */
  maxPerProjectPerDay: number
  /** A run's time limit in minutes, cut to the board's deadline when it is earlier (§3.6). */
  runMinutes: number
}
export const DISPATCH_DEFAULTS: Readonly<DispatchLimits> = { maxOnMachine: 2, maxPerProject: 1, maxPerProjectPerDay: 20, runMinutes: 60 }

/** A request's state as the board names it (fabric-project-comms/0.1). */
export type RequestState = 'queued' | 'claimed' | 'accepted' | 'in_progress' | 'completed' | 'failed_known' | 'outcome_unknown' | 'expired' | 'cancelled' | 'answered'

export interface DispatchInput {
  now: number
  request: {
    id: string
    state: RequestState
    submittedAt: string
    /** The board's own deadline (`request.deadline`, explicit or seven days). */
    deadline: string
    urgent: boolean
    /** For `in_progress`: a holder whose lease is live. */
    holderLive: boolean
    /** For `claimed`: the attempt's lease lapsed. */
    attemptLapsed: boolean
  }
  /** A live responder holds the request's capability on its project. */
  liveResponder: boolean
  /** A live session is enrolled in the target project. */
  liveSession: boolean
  /** The switch «Запускать агентов по запросам доски». */
  switchOn: boolean
  /** The target project has a folder on this machine. */
  hasFolder: boolean
  runningOnMachine: number
  runningInProject: number
  dispatchesToday: number
  /** Runs for this request that ended without settling it. */
  emptyRuns: number
  /** A dispatch for this request is running. */
  inFlight: boolean
  limits?: Partial<DispatchLimits>
}

/** The check that stopped a dispatch, in the order of §3.3, plus the grace and Switchboard's failure to start. */
export type DispatchCheck = 'grace' | 'skipped-off' | 'skipped-no-folder' | 'deferred-cap' | 'deferred-project-busy' | 'skipped-daily-cap' | 'deferred-no-agent' | 'failed-to-start'

export type DispatchDecision =
  | { path: 'none' }
  | { path: 'responder' }
  | { path: 'live-session' }
  | { path: 'launch' }
  | { path: 'to-operator' }
  | { path: 'wait' | 'skip'; check: DispatchCheck }

const atLeastOne = (n: number | undefined, fallback: number) => (Number.isFinite(n) && (n as number) >= 1 ? Math.floor(n as number) : fallback)

export function limitsOf(over: Partial<DispatchLimits> = {}): DispatchLimits {
  return {
    maxOnMachine: atLeastOne(over.maxOnMachine, DISPATCH_DEFAULTS.maxOnMachine),
    maxPerProject: atLeastOne(over.maxPerProject, DISPATCH_DEFAULTS.maxPerProject),
    maxPerProjectPerDay: atLeastOne(over.maxPerProjectPerDay, DISPATCH_DEFAULTS.maxPerProjectPerDay),
    runMinutes: atLeastOne(over.runMinutes, DISPATCH_DEFAULTS.runMinutes)
  }
}

/** Whether the request is one a session may be started for (§3.1). */
function candidate(r: DispatchInput['request'], now: number): boolean {
  if (Date.parse(r.deadline) <= now) return false
  if (r.state === 'queued') return true
  if (r.state === 'claimed') return r.attemptLapsed
  if (r.state === 'in_progress') return !r.holderLive
  return false
}

export function decideDispatch(input: DispatchInput): DispatchDecision {
  const { now, request } = input
  if (input.inFlight || !candidate(request, now)) return { path: 'none' }
  if (input.liveResponder) return { path: 'responder' }
  const waited = now - Date.parse(request.submittedAt)
  if (input.liveSession && waited < GRACE_MS) return { path: 'live-session' }
  if (!request.urgent && waited < GRACE_MS) return { path: 'wait', check: 'grace' }
  if (input.emptyRuns >= EMPTY_RUNS_TO_OPERATOR) return { path: 'to-operator' }
  const limits = limitsOf(input.limits)
  if (!input.switchOn) return { path: 'skip', check: 'skipped-off' }
  if (!input.hasFolder) return { path: 'skip', check: 'skipped-no-folder' }
  if (input.runningOnMachine >= limits.maxOnMachine) return { path: 'wait', check: 'deferred-cap' }
  if (input.runningInProject >= limits.maxPerProject) return { path: 'wait', check: 'deferred-project-busy' }
  if (input.dispatchesToday >= limits.maxPerProjectPerDay) return { path: 'skip', check: 'skipped-daily-cap' }
  return { path: 'launch' }
}

/** The run's own end (§3.4, `run-ends-at`): the earlier of its launch plus the limit and the board's deadline. */
export function runEndsAt(launchedAt: number, limitMinutes: number, deadline: string): string {
  const byLimit = launchedAt + atLeastOne(limitMinutes, DISPATCH_DEFAULTS.runMinutes) * 60_000
  return new Date(Math.min(byLimit, Date.parse(deadline))).toISOString()
}

const WORKFLOW = /^wf_[0-9a-f]{16}$/
const TOKEN = /^[^\s=]+$/
const LINE = /^fabric-dispatch\/1 workflow=(wf_[0-9a-f]{16}) handoff=([^\s=]+) request=([^\s=]+)$/

export interface DispatchIds { workflow: string; handoff: string; request: string }

/** The exact first line of a dispatched run's prompt (§3.5): fields one space apart, in this order. */
export function firstLine(ids: DispatchIds): string {
  if (!WORKFLOW.test(ids.workflow)) throw new Error('a workflow id is wf_ and 16 hex digits')
  if (!TOKEN.test(ids.handoff) || !TOKEN.test(ids.request)) throw new Error('a handoff or request id holds no space or equals sign')
  return `fabric-dispatch/1 workflow=${ids.workflow} handoff=${ids.handoff} request=${ids.request}`
}

export function parseFirstLine(line: string): DispatchIds | null {
  const m = LINE.exec(line)
  return m ? { workflow: m[1], handoff: m[2], request: m[3] } : null
}

/** Switchboard's refusal codes (SB-247) as the checks of §3.3; an unknown code is a failure to start. */
export function refusalCheck(code: string): DispatchCheck {
  switch (code) {
    case 'no_agent': return 'deferred-no-agent'
    case 'not_in_group': return 'skipped-no-folder'
    case 'ceiling_reached':
    case 'spend_unknown': return 'deferred-cap'
    default: return 'failed-to-start'
  }
}
// #endregion board-dispatch
