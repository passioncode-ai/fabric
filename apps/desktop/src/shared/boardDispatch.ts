// #region board-dispatch — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#3-the-flow
/**
 * The dispatcher's decision (CO-409, wave 1; the operator, 2026-11-04, paraphrased: a request no agent of the project
 * picked up starts a new session that does the work, reports that it is done and ends). Pure: the main process reads the request, the responders, the sessions and the running dispatches,
 * hands them in, and acts on what comes back. Nothing here reads, writes or starts anything.
 */

/** How long a request may wait for a live session before a session is started for it (§3.1). */
export const GRACE_MS = 2 * 60_000
/** After this many runs that ended without settling the request, no more are started for it (§3.6, option (b)). */
export const EMPTY_RUNS_TO_OPERATOR = 2
/** No run is started this close to the board's deadline: 120 s of the executor's silence before the workflow is taken
 *  back (§3.4), a 60 s cycle and the launch (§3.1; fabric-agent-adapter's question, thread `b3e60686`). */
export const LAUNCH_MARGIN_MS = 5 * 60_000
/** How far past a run's own end (`run-ends-at`) the deadline must be for a run to leave the request accepted for the
 *  next one: the decision comes at most 120 s of silence and a 60 s cycle after it, then `LAUNCH_MARGIN_MS`; 10 min
 *  with room for a slow launch. Nearer, the run completes `failed_known` (§3.6; fabric-agent-adapter's FAA-201, its
 *  question `aea81d66`). */
export const RUN_END_TO_DEADLINE_MS = 10 * 60_000

export interface DispatchLimits {
  /** On-demand sessions running at once on this machine (§3.3). */
  maxOnMachine: number
  /** On-demand sessions running at once for one project. */
  maxPerProject: number
  /** Runs started for one project in the last 24 hours. */
  maxPerProjectPerDay: number
  /** A run's time limit in minutes, cut to the board's deadline when it is earlier (§3.6). */
  runMinutes: number
}
export const DISPATCH_DEFAULTS: Readonly<DispatchLimits> = { maxOnMachine: 2, maxPerProject: 1, maxPerProjectPerDay: 20, runMinutes: 60 }

/** A request's state as the board names it (fabric-project-comms/0.1). */
/** The agent a run starts as Switchboard names it (`dispatch_agent`), which is also the hand-over's provider: the
 *  session accepts the offer as this id, so the offer must name it (CO-556, the on-demand spec §3.5). */
export type DispatchAgent = 'claude-code' | 'codex'

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
    /** For `accepted` and `in_progress`: a holder whose lease is live. */
    holderLive: boolean
    /** For `claimed`: the attempt's lease lapsed. */
    attemptLapsed: boolean
  }
  /** A live responder holds the request's capability on its project. */
  liveResponder: boolean
  /** A live session is enrolled in the target project. */
  liveSession: boolean
  /** The switch «Запускать агента на запрос доски, который некому взять». */
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
  if (Date.parse(r.deadline) - now < LAUNCH_MARGIN_MS) return false
  if (r.state === 'queued') return true
  if (r.state === 'claimed') return r.attemptLapsed
  // An accepted request whose holder is gone continues in the next run through com.responder_replace (§3.6).
  if (r.state === 'accepted' || r.state === 'in_progress') return !r.holderLive
  return false
}

export function decideDispatch(input: DispatchInput): DispatchDecision {
  const { now, request } = input
  if (input.inFlight) return { path: 'none' }
  // An accepted or in-progress request never expires by itself: past its deadline, unsettled and with nobody holding
  // it, it goes to the operator (§3.6), and its workflow is closed.
  if (Date.parse(request.deadline) <= now && (request.state === 'accepted' || request.state === 'in_progress') && !request.holderLive)
    return { path: 'to-operator' }
  if (!candidate(request, now)) return { path: 'none' }
  if (input.liveResponder) return { path: 'responder' }
  const waited = now - Date.parse(request.submittedAt)
  // The 0.3.16 review (ER-5, DO-2): a project with a live session gets no second agent in the same folder; the request
  // is that session's (and, unanswered, the operator's in «На проверке»), until the live session's wake of §3.2 exists.
  if (input.liveSession) return { path: 'live-session' }
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

/** The run's own end (§3.4, `run-ends-at`): the earlier of its launch plus the limit and the board's deadline, the
 *  limit alone when the deadline cannot be read. */
export function runEndsAt(launchedAt: number, limitMinutes: number, deadline: string): string {
  const byLimit = launchedAt + atLeastOne(limitMinutes, DISPATCH_DEFAULTS.runMinutes) * 60_000
  // An unreadable deadline leaves the run its own limit (CO-512): `new Date(NaN)` threw here and ended the whole pass,
  // every other request with it. The board's `timestamptz` keeps such a value from the real door; this keeps a stand-in
  // or a future reader from taking the dispatcher down.
  const due = Date.parse(deadline)
  return new Date(Number.isFinite(due) ? Math.min(byLimit, due) : byLimit).toISOString()
}

/** Observatory's limit on a dispatch packet's deadline: at most seven days after the write that sets it
 *  (`dispatch_packet.py#check_write`, `deadline-too-far`), less a minute for the time between reading and writing. */
export const PACKET_HORIZON_MS = 7 * 24 * 60 * 60_000 - 60_000

/**
 * The deadline written into the workflow's packet: the board's own, cut to the time of the write that opens the
 * workflow plus `PACKET_HORIZON_MS`. A request may name a deadline further out (the board accepts any), and Observatory
 * refuses such a packet, so the workflow never opened (2026-11-09: 986 refusals `DeadlineTooFar` for 28 requests). Counted from the
 * write, not from the request: the board's default deadline (168 hours after the request) is then never cut, since a
 * run opens no sooner than `GRACE_MS` after the request, and a request older than a week is never given a deadline
 * already past (0.3.18 review, iteration 3, DA-13, DA-14, ER-24, ER-25). Only the opening write carries it: the packet
 * is frozen there, and a later write leaves the ref out (`boardDispatchRun.ts`). The dispatcher itself still follows
 * the board's deadline. A value that cannot be read is left as it is.
 */
export function packetDeadline(deadline: string, writtenAt: number): string {
  const due = Date.parse(deadline)
  if (!Number.isFinite(due) || !Number.isFinite(writtenAt)) return deadline
  return due <= writtenAt + PACKET_HORIZON_MS ? deadline : new Date(writtenAt + PACKET_HORIZON_MS).toISOString()
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

// #region board-dispatch-remote — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#37-a-run-on-another-machine-co-551-stage-a
/**
 * CO-551, stage A: a run started on another machine (the Mac Studio) has no `fabric-mcp` there, so it writes a result
 * file that Switchboard fetches over the same ssh and hands back in `dispatch status --json` (fabric-switchboard SB-317,
 * 0.7.40). The dispatcher posts its answer in the request's thread only when the file is the run's own: its first line
 * names the workflow, hand-over and request Fabric passed (`FABRIC_DISPATCH_*`) and the launch Switchboard answered.
 * Agreed on the board, thread `14d6cb73` (`32e834d4`, `f75293e0`, `13f00feb`, `e6f33c33`).
 */

/** Switchboard's refusals that send a run meant for another machine back to this one (D-2, `13f00feb`, `e6f33c33`). */
export const REMOTE_REFUSALS: ReadonlySet<string> = new Set(['not_on_target', 'target_busy', 'target_unreachable'])
/** The most of a result file Switchboard hands back (`result`, up to 64 KiB, `f75293e0`). */
export const RESULT_MAX_BYTES = 64 * 1024

export type RunOutcome = 'answered' | 'failed' | 'blocked'
export interface RunIds extends DispatchIds { launch: string }
export interface RunResult extends RunIds { outcome: RunOutcome; branch: string | null; commit: string | null; body: string }
/** Why a result file was not posted: another run's ids, a shape this build cannot read, no known outcome, an answer
 *  with no text, or more than Switchboard hands back. Codes only: the file's text never reaches a log. */
export type ResultRefusal = 'other-run' | 'unreadable' | 'no-outcome' | 'empty-answer' | 'too-large'

const RESULT_LINE = /^fabric-dispatch\/1 result workflow=(wf_[0-9a-f]{16}) handoff=([^\s=]+) request=([^\s=]+) launch=([^\s=]+)$/
const HEADER = /^(outcome|branch|commit)=(\S*)$/
const OUTCOMES: ReadonlySet<string> = new Set(['answered', 'failed', 'blocked'])

/**
 * A result file read and checked against the run Fabric started. The shape is the one Switchboard agreed (`f75293e0`):
 * the first line, then `outcome=`, `branch=` and `commit=` (each at most once, the last two when there are any), an
 * empty line and the answer for the board in Markdown. Anything else is refused, never guessed.
 */
export function checkRunResult(text: string, expected: RunIds): { ok: true; result: RunResult } | { ok: false; reason: ResultRefusal } {
  if (new TextEncoder().encode(text).length > RESULT_MAX_BYTES) return { ok: false, reason: 'too-large' }
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const m = RESULT_LINE.exec(lines[0] ?? '')
  if (!m) return { ok: false, reason: 'unreadable' }
  const ids = { workflow: m[1], handoff: m[2], request: m[3], launch: m[4] }
  if (ids.workflow !== expected.workflow || ids.handoff !== expected.handoff || ids.request !== expected.request || ids.launch !== expected.launch)
    return { ok: false, reason: 'other-run' }
  const header = new Map<string, string>()
  let i = 1
  for (; i < lines.length && lines[i] !== ''; i++) {
    const h = HEADER.exec(lines[i])
    if (!h || header.has(h[1])) return { ok: false, reason: 'unreadable' }
    header.set(h[1], h[2])
  }
  const outcome = header.get('outcome')
  if (!outcome || !OUTCOMES.has(outcome)) return { ok: false, reason: 'no-outcome' }
  const body = lines.slice(i + 1).join('\n').trim()
  if (outcome === 'answered' && body === '') return { ok: false, reason: 'empty-answer' }
  return { ok: true, result: { ...ids, outcome: outcome as RunOutcome, branch: header.get('branch') || null, commit: header.get('commit') || null, body } }
}

/** The reply Fabric posts for the run: one line naming the launch and the machine it ran on (agreed in `32e834d4`),
 *  the outcome, branch and commit, an empty line, then the run's answer as written. */
export function relayText(r: RunResult, machine: string): string {
  const where = [r.branch ? `ветка \`${r.branch}\`` : null, r.commit ? `коммит \`${r.commit}\`` : null].filter(Boolean).join(', ')
  return `_Ретрансляция запуска \`${r.launch}\` с машины \`${machine}\`: исход ${r.outcome}${where ? `, ${where}` : ''}._\n\n${r.body}`
}

/** The machine a run is started on, as Settings names it (`dispatchTarget`): an ssh host name, optionally with a user,
 *  never an option (a leading `-`), a space or `auto` (choosing by headroom is stage B, CO-552); anything else is none. */
export function dispatchTargetOf(v: unknown): string | null {
  return typeof v === 'string' && /^[A-Za-z0-9_][A-Za-z0-9._@-]{0,252}$/.test(v) && v !== 'auto' ? v : null
}
// #endregion board-dispatch-remote

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
