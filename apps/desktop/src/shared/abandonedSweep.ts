// #region abandoned-sweep — docs: docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md#requirements
/**
 * The sweep of abandoned work (0.3.13 wave 2, CO-427; the operator, 2026-10-26: «Раз в три минуты обязательный чек
 * для всех агентов, чтобы у нас никогда задачи никакие не было»). Pure: the main process reads the claims, tasks,
 * board requests and its own terminals, hands them in, and tells what comes back. Nothing here reads or writes.
 */
import { SESSION_STALE_MS } from './workClaims.ts'

/** The one-minute cycle sweeps on every third pass (SW-1): three minutes, without a timer of its own. */
export const SWEEP_EVERY_TICKS = 3
/** How long work stands still before it is abandoned (SW-2). */
export const STILL_MS = 3 * 60_000
/** A terminal is stalled only when it has itself been quiet this long: no output and no typed input. The runtime
 *  observer's own stalled threshold (`runtimeObserver.ts#DEFAULT_THRESHOLDS`, `stallAfterMs`), so a heartbeat that
 *  stopped never outranks a terminal that is visibly working or that a person is typing into. */
export const TERMINAL_QUIET_MS = 15 * 60_000
/** A finding is told once, then not again for this long while it stays the same (SW-5). */
export const TELL_QUIET_MS = 30 * 60_000

/** Every kind the sweep finds, one list for the judgement and the receipt's ingress rules (0.3.13 review, iteration 2,
 *  DA-2: a second hand-written copy would refuse a receipt the day a kind is added). */
export const ABANDONED_KINDS = ['claim-silent', 'claim-lapsed', 'task-unclaimed', 'request-unmoved', 'answer-unread', 'terminal-stalled', 'work-unclaimed'] as const
export type AbandonedKind = (typeof ABANDONED_KINDS)[number]
/** The kinds that are a reminder to the agent at work, not abandoned work for the operator's queue (0.3.14 wave 2):
 *  a session changing files without a claim is told to claim, and the operator's «На проверке» is not filled with it. */
export const AGENT_ONLY_KINDS: ReadonlySet<AbandonedKind> = new Set<AbandonedKind>(['work-unclaimed'])
/** How far back a session's turns are read to see whether it changes files (0.3.14 wave 2, work-unclaimed). */
export const TURN_WINDOW_MS = 15 * 60_000
/** The sweep's reads, as a receipt's `unread` names them, and the reads that can stop at their bounds, as its `capped`
 *  does: one list each for the sweep and the receipt's ingress rules (iteration 3, DA-5). */
export const SWEEP_READS = ['claims', 'tasks', 'requests', 'terminals', 'turns'] as const
export type SweepRead = (typeof SWEEP_READS)[number]
export const SWEEP_CAPS = ['claims', 'threads', 'messages'] as const
export type SweepCap = (typeof SWEEP_CAPS)[number]

export interface SweepClaim {
  claimId: string
  taskId: string | null
  projectId: string | null
  sessionId: string
  expiresAt: string
  claimedAt: string
  renewedAt: string | null
  /** The holding session's last sign; null when Fabric no longer holds that session. */
  session: { lastSignAt: number | null } | null
}

export interface SweepTask {
  taskId: string
  projectId: string | null
  state: string
  movedAt: string
  claimed: boolean
  /** Who last moved the task (`project_tasks.moved_by_kind`): a task a person moved to running by hand is the
   *  person's own and is not called unclaimed, until an agent claims it after that move. */
  movedByKind?: string | null
  /** The newest claim ever opened on the task, released ones included; null when none. A claim does not move a task
   *  already in running, so `movedByKind` stays the person's after an agent took and left it (round 2, B2). */
  lastClaimedAt?: string | null
}

/** A task stays the person's while no claim has opened on it since the person moved it to running. */
function personHolds(t: SweepTask): boolean {
  return t.movedByKind === 'person' && !(t.lastClaimedAt && Date.parse(t.lastClaimedAt) >= Date.parse(t.movedAt))
}

export interface SweepRequest {
  requestId: string
  targetProjectId: string
  requesterProjectId: string
  state: string
  movedAt: string
  /** When the answer reached the requester and stayed unread; null when there is no answer or it was read. */
  answerUnreadSince: string | null
}

export interface SweepTerminal {
  sessionId: string
  projectId: string | null
  taskId: string | null
  liveness: string
  since: string
  /** The terminal's own last output or typed input (`PtyManager` session `lastActivityAt`), in ms. */
  lastActivityAt: number
}

/** One turn the session hooks observed (`session.turn.observed@1`): when, and how many files differ from HEAD; null
 *  when git could not say. */
export interface SweepTurn {
  sessionId: string
  projectId: string | null
  at: string
  filesChanged: number | null
}

export interface SweepInput {
  now: number
  claims: SweepClaim[]
  tasks: SweepTask[]
  requests: SweepRequest[]
  terminals: SweepTerminal[]
  /** The tasks read in running this sweep; absent when that read failed, and then no terminal is called stalled. */
  runningTaskIds?: readonly string[]
  /** The turns of the last fifteen minutes; given only when the claims and terminals were read whole, since a session is
   *  judged by what it holds (0.3.14 wave 2). */
  turns?: readonly SweepTurn[]
  /** Sessions that hold a task without a claim: the lease of a launch Fabric manages. */
  heldSessions?: readonly string[]
}

export interface Finding {
  kind: AbandonedKind
  /** One key per item and kind: what SW-5 remembers. */
  key: string
  projectId: string | null
  taskId: string | null
  requestId: string | null
  sessionId: string | null
  claimId: string | null
  /** How long it has stood still (SW-3). */
  stillMs: number
  /** What the agent that is woken does next, in its own reading. */
  nextStep: string
}

/** Every third pass, counting from one (SW-1). */
export function sweepDue(pass: number): boolean {
  return pass > 0 && pass % SWEEP_EVERY_TICKS === 0
}

/** What stands still now (SW-2), each with its owner and how long (SW-3). */
export function findAbandoned(input: SweepInput): Finding[] {
  const { now } = input
  const out: Finding[] = []
  const base = { taskId: null, requestId: null, sessionId: null, claimId: null }
  for (const c of input.claims) {
    const own = Math.max(Date.parse(c.claimedAt), c.renewedAt ? Date.parse(c.renewedAt) : 0)
    if (c.session === null) {
      out.push({ ...base, kind: 'claim-lapsed', key: `claim-lapsed:${c.claimId}`, projectId: c.projectId, taskId: c.taskId,
        sessionId: c.sessionId, claimId: c.claimId, stillMs: now - own,
        nextStep: 'The session that claimed this task has ended. Take the task if it is yours to continue; otherwise Fabric returns it to the backlog.' })
      continue
    }
    const sign = Math.max(own, c.session.lastSignAt ?? 0)
    if (Date.parse(c.expiresAt) <= now && now - sign >= SESSION_STALE_MS)
      out.push({ ...base, kind: 'claim-silent', key: `claim-silent:${c.claimId}`, projectId: c.projectId, taskId: c.taskId,
        sessionId: c.sessionId, claimId: c.claimId, stillMs: now - sign,
        nextStep: 'You hold this task and have not moved it: move it, hand it over or let it go (fabric_work_release).' })
  }
  for (const t of input.tasks) {
    const still = now - Date.parse(t.movedAt)
    if (t.state === 'running' && !t.claimed && !personHolds(t) && still >= STILL_MS)
      out.push({ ...base, kind: 'task-unclaimed', key: `task-unclaimed:${t.taskId}`, projectId: t.projectId, taskId: t.taskId, stillMs: still,
        nextStep: 'This task is running and nobody holds it: claim it (fabric_work_claim) and continue, or move it back to the backlog.' })
  }
  for (const r of input.requests) {
    const still = now - Date.parse(r.movedAt)
    // Only a queued request stands still: a claimed or accepted one is being worked, and its own deadlines are the
    // board's (SCN-147, `board_tick`).
    if (r.state === 'queued' && still >= STILL_MS)
      out.push({ ...base, kind: 'request-unmoved', key: `request-unmoved:${r.requestId}`, projectId: r.targetProjectId, requestId: r.requestId, stillMs: still,
        nextStep: 'A board request addressed to your project has not moved: read it (com.get) and answer it (com.reply), or say why it waits.' })
    if (r.answerUnreadSince && now - Date.parse(r.answerUnreadSince) >= STILL_MS)
      out.push({ ...base, kind: 'answer-unread', key: `answer-unread:${r.requestId}`, projectId: r.requesterProjectId, requestId: r.requestId,
        stillMs: now - Date.parse(r.answerUnreadSince),
        nextStep: 'A board request your project sent has been answered and the answer is unread: read it (com.list {unread: true}), mark it read (com.read_ack) and carry on.' })
  }
  const running = input.runningTaskIds ? new Set(input.runningTaskIds) : null
  for (const s of input.terminals) {
    if (s.liveness === 'stalled' && s.taskId && running?.has(s.taskId) && now - s.lastActivityAt >= TERMINAL_QUIET_MS)
      out.push({ ...base, kind: 'terminal-stalled', key: `terminal-stalled:${s.sessionId}`, projectId: s.projectId, taskId: s.taskId,
        // Still since the terminal itself went quiet, not since the observer marked it stalled (0.3.13 review ER-4).
        sessionId: s.sessionId, stillMs: now - s.lastActivityAt,
        nextStep: 'This session holds a task and has been still: continue it, or say what blocks it (fabric_heartbeat with phase blocked).' })
  }
  // #region work-unclaimed — docs: docs/evidence/plans/2026-10-26-release-0314-plan.md#composition
  // 0.3.14 wave 2: a session whose turns changed files in the window and that holds nothing (no open claim of any life,
  // no managed lease, no Fabric terminal on a task) is working on something nobody can see on the board.
  const holding = new Set<string>([
    ...input.claims.map((c) => c.sessionId),
    ...(input.heldSessions ?? []),
    ...input.terminals.filter((t) => t.taskId).map((t) => t.sessionId)
  ])
  const firstChange = new Map<string, { at: number; projectId: string | null }>()
  for (const t of input.turns ?? []) {
    const at = Date.parse(t.at)
    if (!(t.filesChanged && t.filesChanged > 0) || !Number.isFinite(at) || now - at > TURN_WINDOW_MS || holding.has(t.sessionId)) continue
    const prior = firstChange.get(t.sessionId)
    if (!prior || at < prior.at) firstChange.set(t.sessionId, { at, projectId: t.projectId ?? prior?.projectId ?? null })
  }
  for (const [sessionId, c] of firstChange)
    out.push({ ...base, kind: 'work-unclaimed', key: `work-unclaimed:${sessionId}`, projectId: c.projectId, sessionId, stillMs: Math.max(0, now - c.at),
      nextStep: 'Claim the task you are working on (fabric_work_claim): its taskId, or a new row with a title and its origin.' })
  // #endregion work-unclaimed
  return out
}

/** Which findings to tell now (SW-5): once per key, then quiet for TELL_QUIET_MS; keys no longer found are forgotten. */
export function toTell(findings: Finding[], told: ReadonlyMap<string, number>, now: number): { tell: Finding[]; told: Map<string, number> } {
  const next = new Map<string, number>()
  const tell: Finding[] = []
  for (const f of findings) {
    if (next.has(f.key)) continue
    const last = told.get(f.key)
    if (last === undefined || now - last >= TELL_QUIET_MS) { tell.push(f); next.set(f.key, now) } else next.set(f.key, last)
  }
  return { tell, told: next }
}

const SUBJECT: Record<AbandonedKind, (f: Finding) => string> = {
  'claim-silent': (f) => `task ${f.taskId ?? f.claimId} you claimed`,
  'claim-lapsed': (f) => `task ${f.taskId ?? f.claimId} claimed by an ended session`,
  'task-unclaimed': (f) => `task ${f.taskId}`,
  'request-unmoved': (f) => `board request ${f.requestId}`,
  'answer-unread': (f) => `the answer to board request ${f.requestId}`,
  'terminal-stalled': (f) => `task ${f.taskId} in this session`,
  'work-unclaimed': () => 'this session'
}

/** A kind whose line is not "has been still": what it says, given the whole minutes. */
const SAYS: Partial<Record<AbandonedKind, (f: Finding, min: number) => string>> = {
  'work-unclaimed': (f, min) => `${SUBJECT[f.kind](f)} has changed files for ${min} min and holds no claim.`
}

/** The one line an agent is told (SW-4): what, how long it stood still in whole minutes (SW-3), what to do next. */
export function nudgeText(f: Finding): string {
  const min = Math.floor(f.stillMs / 60_000)
  const lead = SAYS[f.kind]?.(f, min) ?? `${SUBJECT[f.kind](f)} has been still for ${min} min.`
  return `Fabric: ${lead} ${f.nextStep}`
}

/** One nudge as an agent's answer carries it (0.3.14 wave 2): what kind of finding, the line it is told, and the task
 *  or board request it is about, when the finding names one. Snake case: it is read in an MCP tool's JSON answer. */
export interface Nudge {
  kind: AbandonedKind
  says: string
  task_id?: string
  request_id?: string
}

/** A finding as the nudge an agent is given. */
export function nudgeOf(f: Finding): Nudge {
  return { kind: f.kind, says: nudgeText(f), ...(f.taskId ? { task_id: f.taskId } : {}), ...(f.requestId ? { request_id: f.requestId } : {}) }
}

/** A task's newest claim, released ones included: when it opened, and when and how it ended (null while open). */
export interface SweepLastClaim {
  claimedAt: string
  releasedAt: string | null
  how: string | null
}

/** The running tasks whose last claim was released done with no move since (0.3.14 wave 2, task b2c42b88): the done
 *  release's move to review did not land. Not one something holds now. */
export function doneLeftRunning(tasks: readonly { taskId: string; movedAt: string; lastClaim?: SweepLastClaim | null }[], held: ReadonlySet<string>): string[] {
  return tasks.filter((t) => t.lastClaim?.how === 'done' && t.lastClaim.releasedAt && !held.has(t.taskId) &&
    Date.parse(t.movedAt) <= Date.parse(t.lastClaim.releasedAt)).map((t) => t.taskId)
}

/** Lapsed claims seen in two sweeps in a row are released (SW-8); `seen` carries this sweep's lapsed keys forward. */
export function lapsedTwice(seen: ReadonlySet<string>, findings: Finding[]): { release: Finding[]; seen: Set<string> } {
  const lapsed = findings.filter((f) => f.kind === 'claim-lapsed')
  return { release: lapsed.filter((f) => seen.has(f.key)), seen: new Set(lapsed.map((f) => f.key)) }
}
// #endregion abandoned-sweep
