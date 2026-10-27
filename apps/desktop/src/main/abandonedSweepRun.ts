// #region abandoned-sweep-run — docs: docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md#requirements
/**
 * The sweep of abandoned work, run by the main process (0.3.13 wave 2, CO-427). The pure judgement lives in
 * `shared/abandonedSweep.ts`; this module reads what it judges, tells the agents what it found and releases the claims
 * whose sessions ended. Every dependency is injected, so it is tested without a database (test/abandoned-sweep-run).
 *
 *   SW-1  every third pass of the one-minute cycle (`onPass`, counted here, no timer of its own)
 *   SW-2  claims, running tasks, board requests and Fabric's own terminals, each read in its own try
 *   SW-4  every finding waits as a nudge its session reads in its next fabric_work_list or fabric_heartbeat answer;
 *         nothing is ever typed into a terminal (the 0.3.13 review's ER-2: Enter could answer a waiting prompt)
 *   SW-5  a finding is told once, then not again for 30 minutes while it stays (`toTell`)
 *   SW-7  one `work.swept@1` journal receipt per sweep that told or released, or whose blind or capped reads changed
 *         (migration 124, DA-2; iteration 2, DA-1); a sweep that only found what it had told writes none
 *   SW-8  a lapsed claim found by two sweeps in a row is released as lapsed, when this process knew it or it has
 *         expired, and its task has no unresolved run
 *   SW-9  the latest sweep's findings, read-only (`current`), for the operator's attention queue
 *
 * One sweep at a time, and none once the app is quitting. A queued nudge lives only while its finding does.
 */
import {
  AGENT_ONLY_KINDS,
  doneLeftRunning,
  mayBeReleaseStep,
  releasedLeftRunning,
  findAbandoned,
  lapsedTwice,
  nudgeOf,
  sweepDue,
  toTell,
  TELL_QUIET_MS,
  type AbandonedKind,
  type Finding,
  type Nudge,
  type SweepClaim,
  type SweepLastClaim,
  type SweepRequest,
  type SweepTerminal,
  type SweepTurn,
  TURN_WINDOW_MS,
  type SweepCap,
  type SweepRead
} from '../shared/abandonedSweep.ts'
import { specGaps, specMissing, type BriefParts, type SpecPart } from '../shared/taskSpec.ts'
import type { CommsMessage, CommsPageReply, CommsThreadPageReply, CommsFactsReply } from '../shared/commsRead.ts'
import { ops as opsSink } from './opsSink.ts'
import { readWork, type SessionSign } from './workRead.ts'
import type { createScopedStore } from './scopedStore.ts'

type Store = ReturnType<typeof createScopedStore>

/** The reason a lapsed claim's release carries (SW-8). */
export const LAPSED_REASON = 'lapsed: its session ended and two sweeps found it'
/** At most this many nudges wait per session and per project; the oldest goes first. */
export const NUDGES_PER_KEY = 50
/** At most this many nudges a turn's answer shows (the 0.3.14 review, iteration 1, PL-1): the adapter prints at most
 *  five; the rest wait for the next turn or the next fabric_work_list. */
export const TURN_NUDGES_MAX = 5
/** How long a turn's answer is kept for a repeat of that turn (same idempotencyKey, ER-2): the hook retries a spooled
 *  turn within minutes; the bound keeps the memory small. */
export const TURN_REPEAT_MS = 60 * 60_000
const TURN_ANSWERS_MAX = 1000

export interface SweepRunningTask {
  taskId: string
  projectId: string | null
  movedAt: string
  /** Who last moved it (`project_tasks.moved_by_kind`, written by the projector's move provenance). */
  movedByKind?: string | null
  /** The id of who last moved it (`project_tasks.moved_by`): for an agent, its session. */
  movedBy?: string | null
  /** The newest claim ever opened on it, released ones included (round 2, B2). */
  lastClaimedAt?: string | null
  /** That claim, with when and how it ended (0.3.14 wave 2); null when none. */
  lastClaim?: SweepLastClaim | null
  /** The column its last move left, read only for a possible done release step (ER-22); null: not read. */
  movedFrom?: string | null
}

/** What the board read could not finish within its bounds: past them a request is judged at a later sweep. */
export type BoardCap = Exclude<SweepCap, 'claims'>

export interface AbandonedSweepDeps {
  now(): number
  /** The open claims, each with its session's sign (null when Fabric holds no session for it), and the tasks a lease
   *  holds without a claim (a managed launch). */
  /** `capped`: the claims or leases read stopped at its limit, so a task past it may be held. */
  readClaims(now: number): Promise<{ claims: SweepClaim[]; heldTaskIds: string[]; heldSessionIds?: string[]; capped?: boolean }>
  /** The turns the session hooks observed in the last fifteen minutes (`readRecentTurns`), `capped` when the read
   *  stopped at its bound; absent: none is judged. */
  readTurns?(now: number): Promise<{ turns: SweepTurn[]; capped: boolean }>
  /** The missing brief parts of these claimed tasks (`readBriefGaps`); absent: no brief is judged. */
  readBriefGaps?(taskIds: string[]): Promise<Record<string, SpecPart[]>>
  /** The tasks in running, with when each last moved. */
  readRunningTasks(): Promise<SweepRunningTask[]>
  readRequests(now: number): Promise<{ requests: SweepRequest[]; capped: BoardCap[] }>
  /** Fabric's own terminals, with the runtime observer's liveness, the task each holds and its own last activity. */
  terminals(): SweepTerminal[]
  /** Releases a claim as lapsed and returns its task to the backlog when the claim moved it there (`workRelease.ts`). */
  releaseLapsed(claimId: string, reason: string): Promise<{ released: boolean; reason?: string; failed?: string }>
  /** Moves a running task whose last claim was released done to review (0.3.14 wave 2,
   *  `workRelease.ts#moveDoneLeftRunningToReview`); absent: no repair. */
  moveDoneToReview?(taskId: string, projectId: string | null): Promise<{ task_moved_to: 'review' | null; failed?: string }>
  /** Moves a running task whose last claim ended other than done, with no move since, back to backlog (the 0.3.14
   *  review, iteration 1, ER-6; `workRelease.ts#moveReleasedLeftRunningToBacklog`); absent: no retry. */
  moveReleasedToBacklog?(taskId: string, projectId: string | null): Promise<{ task_moved_to: 'backlog' | null; failed?: string }>
  /** The task ids among these whose run Fabric has not proved stopped (`workRead.ts#readRunHolds`). */
  unresolvedRuns(taskIds: string[]): Promise<string[]>
  /** Appends the sweep's receipt, `work.swept@1` (SW-7): counts only, never a title or a body. */
  recordSwept(receipt: SweptReceipt): Promise<void>
  /** True once the app has begun to quit (`quit.ts`, `quitting`). */
  quitting(): boolean
  /** When this process started: a claim older than that, whose session it never saw, is not its to release. */
  processStartedAt: number
  ops?: Pick<typeof opsSink, 'failed' | 'record' | 'correlate'>
}

type Source = SweepRead
/** Which kinds each read finds, so a failed read keeps what was told about them (SW-5 across a blind sweep). */
const KINDS_OF: Record<Source, AbandonedKind[]> = {
  // The 0.3.14 review, iteration 1, ER-3: the briefs are read from the claims, so a failed claims read blinds them too.
  claims: ['claim-silent', 'claim-lapsed', 'task-unclaimed', 'work-unclaimed', 'brief-missing'],
  tasks: ['task-unclaimed', 'terminal-stalled'],
  requests: ['request-unmoved', 'answer-unread'],
  terminals: ['terminal-stalled', 'task-unclaimed', 'work-unclaimed'],
  turns: ['work-unclaimed'],
  briefs: ['brief-missing']
}

/** The payload of `work.swept@1` (SW-7): what one sweep found by kind and what it did about it. */
export interface SweptReceipt {
  found: Partial<Record<AbandonedKind, number>>
  told: number
  queued: number
  released: number
  /** The reads that failed, so what they find was judged blind this sweep. */
  unread?: SweepRead[]
  /** The reads that stopped at their bounds. */
  capped?: SweepCap[]
}

export interface SweepResult {
  findings: Finding[]
  told: number
  queued: number
  released: number
  failedReads: Source[]
}

/** A finding as the operator's queue reads it (SW-9): since when it has stood still, fixed at the sweep that found it. */
export type SweptFinding = Finding & { stillSince: number }

/** A project's nudge: `takenBy` the sessions whose fabric_work_list or fabric_heartbeat took it, `shownTo` the sessions
 *  a turn's answer showed it to (shown is not taken: the 0.3.14 review, iteration 1, PL-1). */
interface ProjectNudge { key: string; nudge: Nudge; at: number; takenBy: Set<string>; shownTo: Set<string> }
/** A session's own nudge and whether a turn's answer has shown it (PL-1). */
interface SessionNudge { nudge: Nudge; shown: boolean }

const kindOf = (key: string): AbandonedKind => key.slice(0, key.indexOf(':')) as AbandonedKind

export function createAbandonedSweep(deps: AbandonedSweepDeps) {
  const ops = deps.ops ?? opsSink
  let pass = 0
  let told = new Map<string, number>()
  /** The last sweep's blind and capped reads, so a lasting one is recorded once (DA-1). */
  let lastReadState = JSON.stringify({ unread: [], capped: [] })
  let lapsedSeen = new Set<string>()
  /** Sessions this process has seen live on a claim: a claim of one of them that lapses is this process's to release. */
  let seenLive = new Set<string>()
  let inFlight = false
  /** SW-9: what the latest sweep found, for the operator's queue; null before the first sweep. */
  let latest: { at: number; findings: SweptFinding[]; unclaimed: number | null; unclaimedSessions: string[] } | null = null
  /** Per session, at most one line per finding key: a newer telling replaces the older (finding 2). */
  const bySession = new Map<string, Map<string, SessionNudge>>()
  const byProject = new Map<string, ProjectNudge[]>()
  /** What each turn's answer showed, by session and the turn's idempotencyKey, so a repeat answers the same (ER-2). */
  const turnAnswers = new Map<string, { at: number; nudges: Nudge[] }>()

  const push = <T,>(list: T[], item: T): void => {
    list.push(item)
    if (list.length > NUDGES_PER_KEY) list.splice(0, list.length - NUDGES_PER_KEY)
  }
  /** Drops queued nudges whose finding this sweep no longer found, unless the read that finds that kind failed. */
  const dropStale = (current: ReadonlySet<string>, blind: ReadonlySet<AbandonedKind>): void => {
    const stale = (key: string): boolean => !current.has(key) && !blind.has(kindOf(key))
    for (const [session, lines] of bySession) {
      for (const key of [...lines.keys()]) if (stale(key)) lines.delete(key)
      if (!lines.size) bySession.delete(session)
    }
    for (const [project, list] of byProject) {
      const kept = list.filter((n) => !stale(n.key))
      if (kept.length) byProject.set(project, kept)
      else byProject.delete(project)
    }
  }
  const prune = (projectId: string, now: number): ProjectNudge[] => {
    const kept = (byProject.get(projectId) ?? []).filter((n) => now - n.at < TELL_QUIET_MS)
    if (kept.length) byProject.set(projectId, kept)
    else byProject.delete(projectId)
    return kept
  }

  /** One read, in its own try: a failure is reported and named, and the sweep goes on with the others (SW-2). */
  const attempt = async <T,>(source: Source, read: () => Promise<T> | T, failedReads: Source[]): Promise<T | null> => {
    try {
      return await read()
    } catch (e) {
      ops.failed('work.sweep-read', e, { read: source, note: 'this sweep judged without it; what it finds is judged again in three minutes' })
      failedReads.push(source)
      return null
    }
  }

  // #region sweep-left-running-repairs — docs: docs/evidence/plans/2026-10-26-release-0314-plan.md#review-iteration-1
  /** The repairs of a release whose task's move did not land (0.3.14 wave 2; the review, iteration 1, ER-4, ER-5, ER-6),
   *  each read back; returns the tasks that moved. A failure is said in the ops log and tried again next sweep. Judged
   *  only when every holder was read whole. */
  async function repairLeftRunning(holders: ReadonlySet<string> | null, taskRead: SweepRunningTask[] | null): Promise<Set<string>> {
    const moved = new Set<string>()
    if (!holders || !taskRead) return moved
    const projectOf = (id: string): string | null => taskRead.find((t) => t.taskId === id)?.projectId ?? null
    const jobs: Array<{ taskId: string; op: string; move: () => Promise<{ task_moved_to: string | null; failed?: string }> }> = [
      ...(deps.moveDoneToReview ? doneLeftRunning(taskRead, holders).map((id) => ({ taskId: id, op: 'work.sweep-done-review', move: () => deps.moveDoneToReview!(id, projectOf(id)) })) : []),
      ...(deps.moveReleasedToBacklog ? releasedLeftRunning(taskRead, holders).map((id) => ({ taskId: id, op: 'work.sweep-released-backlog', move: () => deps.moveReleasedToBacklog!(id, projectOf(id)) })) : [])
    ]
    for (const j of jobs) {
      if (deps.quitting()) break
      try {
        const r = await j.move()
        if (r.task_moved_to) moved.add(j.taskId)
        if (r.failed) ops.failed(j.op, new Error(r.failed), { task_id: j.taskId, note: 'the task stays in running and in «На проверке»; the next sweep tries again' })
      } catch (e) {
        ops.failed(j.op, e, { task_id: j.taskId, note: 'the task stays in running and in «На проверке»; the next sweep tries again' })
      }
    }
    return moved
  }
  // #endregion sweep-left-running-repairs

  async function sweep(): Promise<SweepResult> {
    const now = deps.now()
    const failedReads: Source[] = []
    const [claimRead, taskRead, requestRead, terminals, turns] = await Promise.all([
      attempt('claims', () => deps.readClaims(now), failedReads),
      attempt('tasks', () => deps.readRunningTasks(), failedReads),
      attempt('requests', () => deps.readRequests(now), failedReads),
      attempt('terminals', () => deps.terminals(), failedReads),
      deps.readTurns ? attempt('turns', () => deps.readTurns!(now), failedReads) : Promise.resolve(null)
    ])
    // A running task is unclaimed only when no open claim (any life: a silent or lapsed one is its own finding), no
    // lease of a managed launch and no Fabric terminal stands on it. Without the claims or the terminals read, that
    // cannot be judged, so no task is called unclaimed; nor when the claims read stopped at its limit (a claim past
    // it may hold the task).
    const holders = claimRead && !claimRead.capped && terminals
      ? new Set<string>([
          ...claimRead.claims.map((c) => c.taskId).filter((id): id is string => id !== null),
          ...claimRead.heldTaskIds,
          ...terminals.map((t) => t.taskId).filter((id): id is string => id !== null)
        ])
      : null
    // 0.3.14 wave 2: the briefs of the claimed tasks, read after the claims (it needs their tasks), in its own try.
    const claimedTaskIds = [...new Set((claimRead?.claims ?? []).filter((c) => c.session !== null).map((c) => c.taskId).filter((id): id is string => id !== null))]
    const briefGaps = deps.readBriefGaps && claimedTaskIds.length ? await attempt('briefs', () => deps.readBriefGaps!(claimedTaskIds), failedReads) : null
    // 0.3.14 wave 2: a done release whose move to review did not land is moved to review; the review, iteration 1, ER-6:
    // a release other than done whose move back to backlog did not land is moved there. Repaired before the judgement,
    // so a task leaves the findings only once its repair read back (ER-5): a repair that keeps failing stays a
    // `task-unclaimed` finding the operator sees in «На проверке», and the next sweep tries again.
    const repaired = await repairLeftRunning(holders, taskRead)
    const findings = findAbandoned({
      now,
      claims: claimRead?.claims ?? [],
      tasks: holders && taskRead
        ? taskRead.filter((t) => !repaired.has(t.taskId)).map((t) => ({ taskId: t.taskId, projectId: t.projectId, state: 'running', movedAt: t.movedAt, claimed: holders.has(t.taskId), movedByKind: t.movedByKind ?? null, lastClaimedAt: t.lastClaimedAt ?? null }))
        : [],
      requests: requestRead?.requests ?? [],
      terminals: terminals ?? [],
      ...(taskRead ? { runningTaskIds: taskRead.map((t) => t.taskId) } : {}),
      // 0.3.14 wave 2: a session is judged by what it holds, so its turns are judged only when everything it could hold
      // was read whole (the same condition as a running task's holders above), and only when the turns were (ER-12).
      ...(holders && turns && !turns.capped ? { turns: turns.turns, heldSessions: claimRead?.heldSessionIds ?? [] } : {}),
      ...(briefGaps ? { briefGaps } : {})
    })

    // SW-5. What a failed read could not see is not forgotten: its kinds keep their last telling. The review, iteration
    // 1, ER-3 and ER-12: so do the kinds judged from the holders when the claims read stopped at its bound, and
    // `work-unclaimed` when the turns read did.
    const blind = new Set<AbandonedKind>([
      ...failedReads.flatMap((s) => KINDS_OF[s]),
      ...(claimRead?.capped ? (['task-unclaimed', 'work-unclaimed'] as const) : []),
      ...(turns?.capped ? (['work-unclaimed'] as const) : [])
    ])
    const decided = toTell(findings, told, now)
    for (const [key, at] of told) if (!decided.told.has(key) && blind.has(kindOf(key))) decided.told.set(key, at)
    told = decided.told
    dropStale(new Set(findings.map((f) => f.key)), blind)
    let queued = 0
    for (const f of decided.tell) {
      const nudge = nudgeOf(f)
      // A lapsed claim's session has ended: there is nobody to wake but the project's other agents.
      const own = f.kind === 'claim-lapsed' ? null : f.sessionId
      // 0.3.13 review, iteration 1, ER-2: nothing is ever typed into a terminal. A line ends in Enter, and a terminal
      // quiet on a running task may be a coding agent waiting on a permission prompt, where Enter approves. A stalled
      // terminal's finding waits as that session's nudge like every other, and the operator sees it in «На проверке».
      if (own) {
        const lines = bySession.get(own) ?? new Map<string, SessionNudge>()
        lines.delete(f.key)
        // A new telling is shown on a turn again, even when its older telling was (PL-1).
        lines.set(f.key, { nudge, shown: false })
        while (lines.size > NUDGES_PER_KEY) lines.delete(lines.keys().next().value as string)
        bySession.set(own, lines)
        queued++
      } else if (f.projectId) {
        const list = prune(f.projectId, now).filter((n) => n.key !== f.key)
        push(list, { key: f.key, nudge, at: now, takenBy: new Set<string>(), shownTo: new Set<string>() })
        byProject.set(f.projectId, list)
        queued++
      }
    }

    // SW-8. A blind claims read breaks no row: what was seen stays seen until the claims are read again.
    let released = 0
    const releasedClaims = new Set<string>()
    if (claimRead) {
      const twice = lapsedTwice(lapsedSeen, findings)
      lapsedSeen = twice.seen
      // Finding 9: a claim this process knew: one minted (claimed or renewed) since it started, or one whose session
      // it saw live. A claim from before a restart or a crash, whose session it never saw, is released once its
      // expires_at has passed (round 2, B1): no expiry ends a claim by itself, the projector ends one only on
      // work.released@1 or another owner's claim (migration 95), so leaving it would hold its task forever. Live
      // sessions are remembered only while a claim of theirs is open.
      for (const c of claimRead.claims) if (c.session) seenLive.add(c.sessionId)
      seenLive = new Set(claimRead.claims.map((c) => c.sessionId).filter((id) => seenLive.has(id)))
      const ownAt = new Map(claimRead.claims.map((c) => [c.claimId, Math.max(Date.parse(c.claimedAt), c.renewedAt ? Date.parse(c.renewedAt) : 0)]))
      const expiresAt = new Map(claimRead.claims.map((c) => [c.claimId, Date.parse(c.expiresAt)]))
      const ours = twice.release.filter((f) => f.claimId && f.sessionId &&
        ((ownAt.get(f.claimId) ?? 0) >= deps.processStartedAt || seenLive.has(f.sessionId) || (expiresAt.get(f.claimId) ?? Infinity) <= now))
      // A task whose run Fabric has not proved stopped stays held: the claim is not released over a live process.
      let held: Set<string> | null = new Set()
      const taskIds = ours.map((f) => f.taskId).filter((id): id is string => id !== null)
      if (taskIds.length) {
        try {
          held = new Set(await deps.unresolvedRuns(taskIds))
        } catch (e) {
          ops.failed('work.sweep-release', e, { note: 'the runs could not be read; no lapsed claim is released this sweep' })
          held = null
        }
      }
      for (const f of held ? ours : []) {
        if (!f.claimId || (f.taskId && held?.has(f.taskId))) continue
        if (deps.quitting()) break
        try {
          const r = await deps.releaseLapsed(f.claimId, LAPSED_REASON)
          if (r.released) { released++; releasedClaims.add(f.claimId) }
          if (r.failed) ops.failed('work.sweep-release', new Error(r.failed), { claim_id: f.claimId, note: 'the claim is released; its task stays where it is' })
        } catch (e) {
          ops.failed('work.sweep-release', e, { claim_id: f.claimId, note: 'the lapsed claim was not released; the next sweep tries again' })
        }
      }
    }

    // SW-7: one journal receipt of what this sweep did, counts only: written when it told an agent, released a claim,
    // or read blind or capped; a sweep that found only what it had already told writes nothing (0.3.13 review,
    // iteration 1, DA-2: one stuck item wrote a receipt every three minutes), nor one that runs into a quit (ER-5).
    // A receipt the journal refused is said in the ops log; the sweep stands.
    const capped: SweepCap[] = [...(claimRead?.capped ? ['claims' as const] : []), ...(requestRead?.capped ?? []), ...(turns?.capped ? ['turns' as const] : [])]
    // A read that stays blind or capped is recorded when that changes, not on every sweep it lasts (iteration 2, DA-1:
    // a board read stuck at its bound wrote 480 receipts a day). The state counts as recorded only once its receipt is
    // in the journal, so a receipt the journal refused is tried again at the next sweep (iteration 3, ER-3, DA-1).
    const readState = JSON.stringify({ unread: [...failedReads].sort(), capped: [...capped].sort() })
    const readsChanged = readState !== lastReadState
    if (!failedReads.length && !capped.length) lastReadState = readState
    if ((decided.tell.length || released || ((failedReads.length || capped.length) && readsChanged)) && !deps.quitting()) {
      const found: Partial<Record<AbandonedKind, number>> = {}
      for (const f of findings) found[f.kind] = (found[f.kind] ?? 0) + 1
      const receipt: SweptReceipt = { found, told: decided.tell.length, queued, released, ...(failedReads.length ? { unread: failedReads } : {}), ...(capped.length ? { capped } : {}) }
      try {
        await deps.recordSwept(receipt)
        lastReadState = readState
      } catch (e) {
        ops.failed('work.sweep-receipt', e, { note: 'the sweep ran; its work.swept@1 receipt was not journalled', found: findings.length })
      }
    }
    // SW-9. The operator's queue reads this sweep's findings: what a failed read could not see keeps its last finding
    // (as SW-5 keeps its telling), and a lapsed claim this sweep released is gone now, not at the next sweep.
    const foundKeys = new Set(findings.map((f) => f.key))
    latest = {
      at: now,
      // 0.3.14, the simple Fabric: how many sessions change files with no claim, for the home's strip; unknown (null)
      // when this sweep was blind to them, never 0.
      unclaimed: blind.has('work-unclaimed') ? null : new Set(findings.filter((f) => f.kind === 'work-unclaimed').map((f) => f.sessionId ?? f.key)).size,
      // Which sessions, so the strip's number opens where it is counted (the 0.3.14 review, iteration 2, UX-16).
      unclaimedSessions: blind.has('work-unclaimed') ? [] : [...new Set(findings.filter((f) => f.kind === 'work-unclaimed' && f.sessionId).map((f) => f.sessionId as string))],
      // A reminder to the agent at work is not abandoned work for the operator (0.3.14 wave 2, AGENT_ONLY_KINDS).
      findings: [
        ...findings.filter((f) => !(f.kind === 'claim-lapsed' && f.claimId && releasedClaims.has(f.claimId)))
          .map((f) => ({ ...f, stillSince: now - f.stillMs })),
        ...(latest?.findings ?? []).filter((f) => blind.has(f.kind) && !foundKeys.has(f.key))
      ].filter((f) => !AGENT_ONLY_KINDS.has(f.kind))
    }
    return { findings, told: decided.tell.length, queued, released, failedReads }
  }

  const takeNudgeItems = (sessionId: string, projectId: string | null): Nudge[] => {
    const own = [...(bySession.get(sessionId)?.values() ?? [])].map((e) => e.nudge)
    bySession.delete(sessionId)
    const shared = projectId ? prune(projectId, deps.now()).filter((n) => !n.takenBy.has(sessionId)) : []
    for (const n of shared) n.takenBy.add(sessionId)
    return [...own, ...shared.map((n) => n.nudge)]
  }

  // #region turn-nudges-shown — docs: docs/evidence/plans/2026-10-26-release-0314-plan.md#review-iteration-1
  /** The nudges a turn's answer shows (the 0.3.14 review, iteration 1, PL-1, DA-1, ER-1, DO-1, ER-2): at most
   *  `TURN_NUDGES_MAX`, each shown on this session's turns at most once, and NEVER taken off the queue, so a hook that
   *  throws the answer away (every fabric-agent-adapter before 0.51.2) loses none: fabric_work_list and fabric_heartbeat
   *  still take each once. A repeat of the same turn (its idempotencyKey) answers what the first answer showed. */
  const showTurnNudges = (sessionId: string, projectId: string | null, turnKey: string): Nudge[] => {
    const now = deps.now()
    for (const [k, a] of turnAnswers) if (now - a.at >= TURN_REPEAT_MS) turnAnswers.delete(k)
    const answerKey = `${sessionId}\u0000${turnKey}`
    const was = turnAnswers.get(answerKey)
    if (was) return was.nudges.map((n) => ({ ...n }))
    const out: Nudge[] = []
    for (const e of bySession.get(sessionId)?.values() ?? []) {
      if (out.length >= TURN_NUDGES_MAX) break
      if (e.shown) continue
      e.shown = true
      out.push(e.nudge)
    }
    for (const n of projectId ? prune(projectId, now) : []) {
      if (out.length >= TURN_NUDGES_MAX) break
      if (n.takenBy.has(sessionId) || n.shownTo.has(sessionId)) continue
      n.shownTo.add(sessionId)
      out.push(n.nudge)
    }
    turnAnswers.set(answerKey, { at: now, nudges: out })
    while (turnAnswers.size > TURN_ANSWERS_MAX) turnAnswers.delete(turnAnswers.keys().next().value as string)
    return out.map((n) => ({ ...n }))
  }
  // #endregion turn-nudges-shown

  return {
    /** What the latest sweep found, a copy (SW-9): the operator's attention queue reads it. Null before the first sweep. */
    current(): { at: number; findings: SweptFinding[]; unclaimed: number | null; unclaimedSessions: string[] } | null {
      return latest ? { at: latest.at, findings: latest.findings.map((f) => ({ ...f })), unclaimed: latest.unclaimed, unclaimedSessions: [...latest.unclaimedSessions] } : null
    },
    /** One pass of the cycle: every third one sweeps (SW-1). Null when this pass does not. */
    async onPass(): Promise<SweepResult | null> {
      // Nothing once quitting; and one sweep at a time: a pass that falls due while one is in flight is skipped.
      if (deps.quitting()) return null
      pass++
      if (!sweepDue(pass) || inFlight) return null
      inFlight = true
      try {
        return await sweep()
      } finally {
        inFlight = false
      }
    },
    /** This session's nudges, and its project's it has not yet taken; the session's own are cleared (SW-4). Only
     *  fabric_work_list and fabric_heartbeat take; a turn's answer shows (`showTurnNudges`). */
    takeNudgeItems,
    showTurnNudges,
    /** The same nudges as the lines fabric_work_list and fabric_heartbeat carry. */
    takeNudges(sessionId: string, projectId: string | null): string[] {
      return takeNudgeItems(sessionId, projectId).map((n) => n.says)
    }
  }
}

export type AbandonedSweep = ReturnType<typeof createAbandonedSweep>

/** How many open claims and running tasks one sweep reads; past it the rest are judged at a later sweep. */
export const SWEEP_READ_LIMIT = 500

/** The open claims for the sweep (SW-2), from the same reading `fabric_work_list` and the screens use
 *  (`workRead.ts#readWork`): each with its session's sign, and the tasks a managed launch's lease holds without one. */
export async function readSweepClaims(store: Store, now: number, session: SessionSign): Promise<{ claims: SweepClaim[]; heldTaskIds: string[]; heldSessionIds: string[]; capped?: boolean }> {
  const snap = await readWork(store, { now, session, limit: SWEEP_READ_LIMIT })
  return {
    claims: snap.claims.map((c) => ({
      claimId: c.id, taskId: c.work_id, projectId: c.project_id, sessionId: c.owner_session,
      expiresAt: c.expires_at, claimedAt: c.claimed_at, renewedAt: c.renewed_at, session: session(c.owner_session)
    })),
    heldTaskIds: snap.held.map((h) => h.task.id),
    heldSessionIds: snap.held.map((h) => h.owner_session),
    ...(snap.capped?.length ? { capped: true } : {})
  }
}

// #region sweep-brief-gaps — docs: docs/evidence/plans/2026-10-26-release-0314-plan.md#composition
/** The missing parts of each claimed task's brief (0.3.14 wave 2, brief-missing), by `taskSpec.ts#specGaps`; a closed
 *  task has none to write. Bounded by the claims read. A read that fails throws: unread is never "written". */
export async function readBriefGaps(store: Pick<Store, 'selectIn'>, taskIds: string[]): Promise<Record<string, SpecPart[]>> {
  const r = await store.selectIn('project_tasks', 'id,status,brief_what,brief_why,brief_expected', 'id', taskIds)
  if (r.failed) throw new Error(`the claimed tasks' briefs could not be read: ${r.failed}`)
  const out: Record<string, SpecPart[]> = {}
  for (const t of r.rows as unknown as Array<BriefParts & { id: string; status: string | null }>) out[t.id] = specMissing(t) ? specGaps(t) : []
  return out
}
// #endregion sweep-brief-gaps

// #region sweep-recent-turns — docs: docs/evidence/plans/2026-10-26-release-0314-plan.md#composition
/** The turns the session hooks observed in the last fifteen minutes (0.3.14 wave 2, work-unclaimed): newest first and
 *  bounded like the sweep's other reads, by the database's own time (`occurred_at`), never the agent's clock. A read
 *  that fails throws: unread turns are never "no session changed anything". */
export async function readRecentTurns(store: Pick<Store, 'select'>, now: number): Promise<{ turns: SweepTurn[]; capped: boolean }> {
  const r = await store.select('journal', 'project_id,occurred_at,payload').eq('type', 'session.turn.observed@1')
    .gte('occurred_at', new Date(now - TURN_WINDOW_MS).toISOString()).order('seq', { ascending: false }).limit(SWEEP_READ_LIMIT)
  if (r.error) throw new Error(`the sessions' turns could not be read: ${r.error.message}`)
  const rows = (r.data ?? []) as Array<{ project_id: string | null; occurred_at: string; payload: { session_id?: unknown; files_changed?: unknown; lines_added?: unknown; lines_removed?: unknown } | null }>
  const count = (v: unknown): number | null => (typeof v === 'number' ? v : null)
  return {
    turns: rows.filter((t) => typeof t.payload?.session_id === 'string').map((t) => ({
      sessionId: t.payload!.session_id as string, projectId: t.project_id, at: t.occurred_at,
      filesChanged: count(t.payload!.files_changed), linesAdded: count(t.payload!.lines_added), linesRemoved: count(t.payload!.lines_removed)
    })),
    // The review, iteration 1, DA-7, ER-12: a read that stopped at its bound is named (CO-310), never "every turn".
    capped: rows.length >= SWEEP_READ_LIMIT
  }
}
// #endregion sweep-recent-turns

/** The tasks in running (SW-2). When a task last moved is read the way the home's «В работе» reads it
 *  (`workRead.ts#readHome`): `moved_at`, the time it last changed column, else `started_at`. Who moved it is the
 *  `moved_by_kind` column the projector writes with `moved_at` from the move's actor (`apply_move_provenance`), so no
 *  journal read and no migration is needed to tell a person's hand move. A read that fails throws. */
export async function readRunningTasks(store: Pick<Store, 'select' | 'selectIn'>): Promise<SweepRunningTask[]> {
  const r = await store.select('project_tasks', 'id,project_id,moved_at,started_at,moved_by_kind,moved_by').eq('status', 'running').limit(SWEEP_READ_LIMIT)
  if (r.error) throw new Error(`the tasks in work could not be read: ${r.error.message}`)
  const rows = ((r.data ?? []) as Array<{ id: string; project_id: string | null; moved_at: string | null; started_at: string | null; moved_by_kind: string | null; moved_by?: string | null }>)
    .filter((t) => t.moved_at ?? t.started_at)
  // Round 2, B2: a person's move holds only until a claim opens after it, and a claim does not move a task already in
  // running. 0.3.14 wave 2: and a done release whose move to review did not land is found by its last claim. The claims
  // ever opened on the running tasks read (bounded by the read above), released ones included; the newest per task.
  // An unread history throws: it is never "no claim since". The 0.3.14 review, iteration 2, DA-3: each chunk of tasks
  // is read newest first under the gateway's 1 000 rows; a chunk that came back full may miss a task's newest claim, so
  // its tasks without a claim row are not judged this sweep (left out), never "no claim".
  const last = new Map<string, SweepLastClaim>()
  const unjudged = new Set<string>()
  for (let i = 0; i < rows.length; i += CLAIMS_CHUNK) {
    const ids = rows.slice(i, i + CLAIMS_CHUNK).map((t) => t.id)
    const claims = await store.selectIn('work_claims', 'work_id,claimed_at,released_at,released_how,owner_session', 'work_id', ids, CLAIMS_CHUNK, undefined, [],
      { column: 'claimed_at', ascending: false, limit: GATEWAY_ROWS })
    if (claims.failed) throw new Error(`the claims of the tasks in work could not be read: ${claims.failed}`)
    const got = claims.rows as Array<{ work_id: string; claimed_at: string; released_at: string | null; released_how: string | null; owner_session?: string | null }>
    for (const c of got) {
      const prior = last.get(c.work_id)
      if (!prior || Date.parse(c.claimed_at) > Date.parse(prior.claimedAt))
        last.set(c.work_id, { claimedAt: c.claimed_at, releasedAt: c.released_at ?? null, how: c.released_how ?? null, owner: c.owner_session ?? null })
    }
    if (got.length >= GATEWAY_ROWS) for (const id of ids) if (!last.has(id)) unjudged.add(id)
  }
  if (unjudged.size) opsSink.record({ op: 'work.sweep-claims-capped', outcome: 'unknown', level: 'warn', ctx: { correlationId: opsSink.correlate() },
    detail: { tasks: unjudged.size, note: 'a chunk of claims came back at the gateway\'s 1 000 rows; these tasks are judged next sweep' } })
  const out: SweepRunningTask[] = rows.filter((t) => !unjudged.has(t.id)).map((t) => ({
    taskId: t.id, projectId: t.project_id, movedAt: (t.moved_at ?? t.started_at) as string, movedByKind: t.moved_by_kind ?? null,
    movedBy: t.moved_by ?? null, lastClaimedAt: last.get(t.id)?.claimedAt ?? null, lastClaim: last.get(t.id) ?? null
  }))
  // The 0.3.14 review, iteration 3, ER-22: a move by the releasing session within the minute after a done release is
  // the release's own step only when it left backlog. Its `from` is read from the task's last move, only for those
  // few; a read that fails leaves it unread, and an unread move is never taken for the release's own (no repair).
  for (const t of out) {
    if (!mayBeReleaseStep(t)) continue
    const m = await store.select('journal', 'payload').eq('type', 'task.moved@1').eq('payload->>task_id', t.taskId).order('seq', { ascending: false }).limit(1)
    if (m.error) {
      opsSink.record({ op: 'work.sweep-move-unread', outcome: 'unknown', level: 'warn', ctx: { correlationId: opsSink.correlate() },
        detail: { task_id: t.taskId, note: `the task's last move could not be read (${m.error.message}); its done release is not repaired this sweep` } })
      t.movedFrom = null
      continue
    }
    const from = ((m.data ?? []) as Array<{ payload?: { from?: unknown } }>)[0]?.payload?.from
    t.movedFrom = typeof from === 'string' ? from : null
  }
  return out
}

/** The gateway answers at most this many rows (`supabase/config.toml` `max_rows`); a read that asks for more cannot
 *  tell a capped answer from a complete one (CO-310). */
export const GATEWAY_ROWS = 1000
/** Running tasks per claims request: the URL stays short (`scopedStore.ts#selectIn`). */
const CLAIMS_CHUNK = 100

/** The operator's read door onto the board (`commsOperatorRead.ts`), the four reads this sweep uses. */
export interface SweepComms {
  threadPage(estateId: string, filter: unknown, before: unknown, limit?: number): Promise<CommsThreadPageReply>
  list(estateId: string, threadId: string | null, afterSeq: number, limit?: number): Promise<CommsPageReply>
  facts(estateId: string, messages: unknown): Promise<CommsFactsReply>
}

/** How far back the sweep reads the board: a request with no deadline of its own expires after seven days (migration
 *  120, `board_request_default_ttl`), so a thread quiet for longer holds nothing open. */
export const BOARD_WINDOW_MS = 7 * 24 * 3600_000
const THREAD_PAGES = 3
const MESSAGE_PAGES = 5

/**
 * The board requests the sweep judges (SW-2), read through the operator's existing doors, never a table: the threads
 * with a request active in the last seven days, their messages, and the facts of the requests and their answers. An
 * open request moved when it last changed state (`lastAt`), else when it was sent. An answered one carries the time
 * its target's answer came while the requester has not marked that answer read (`readBy`, the board's read marks).
 * A door that does not answer throws: an unread board is never "nothing waits". `capped` names the reads that stopped
 * at their bound (more threads, or a thread's more messages, than one sweep reads), so the sweep can say so.
 */
export async function readBoardRequests(comms: SweepComms, estateId: string, now: number): Promise<{ requests: SweepRequest[]; capped: BoardCap[] }> {
  const must = <T extends { ok: boolean }>(r: T, what: string): Extract<T, { ok: true }> => {
    if (!r.ok) throw new Error(`the board's ${what} could not be read: ${(r as { error?: { message?: string } }).error?.message ?? 'no reason given'}`)
    return r as Extract<T, { ok: true }>
  }
  const capped = new Set<BoardCap>()
  const threads: string[] = []
  let before: unknown = null
  for (let page = 0; page < THREAD_PAGES; page++) {
    const r = must(await comms.threadPage(estateId, { kind: 'request', activeSince: new Date(now - BOARD_WINDOW_MS).toISOString() }, before, 100), 'threads')
    threads.push(...r.threads.map((t) => t.id))
    if (!r.more || !r.before) break
    if (page === THREAD_PAGES - 1) capped.add('threads')
    before = r.before
  }
  const messages: CommsMessage[] = []
  for (const thread of threads) {
    let after = 0
    for (let page = 0; page < MESSAGE_PAGES; page++) {
      const r = must(await comms.list(estateId, thread, after, 100), 'messages')
      messages.push(...r.messages)
      if (!r.more) break
      if (page === MESSAGE_PAGES - 1) capped.add('messages')
      after = r.lastSeq
    }
  }
  const requests = messages.filter((m) => m.kind === 'request' && m.request)
  const requestById = new Map(requests.map((r) => [r.id, r]))
  // The target's latest answer to each answered request.
  const answerOf = new Map<string, CommsMessage>()
  for (const m of messages) {
    if (!m.replyTo) continue
    const req = requestById.get(m.replyTo)
    if (!req || req.request?.state !== 'answered' || m.sender.project !== req.request.target) continue
    const prior = answerOf.get(req.id)
    if (!prior || Date.parse(m.at) > Date.parse(prior.at)) answerOf.set(req.id, m)
  }
  const ids = [...requests.map((r) => r.id), ...[...answerOf.values()].map((m) => m.id)]
  const lastAt = new Map<string, string>()
  const readBy = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += 100) {
    const f = must(await comms.facts(estateId, ids.slice(i, i + 100)), 'message facts')
    for (const [id, r] of Object.entries(f.requests)) if (r.lastAt) lastAt.set(id, r.lastAt)
    for (const [id, m] of Object.entries(f.messages)) readBy.set(id, m.readBy)
  }
  return { capped: [...capped], requests: requests.map((m) => {
    const req = m.request!
    const answer = answerOf.get(m.id)
    return {
      requestId: m.id,
      targetProjectId: req.target,
      requesterProjectId: m.sender.project,
      state: req.state,
      movedAt: lastAt.get(m.id) ?? m.at,
      answerUnreadSince: answer && !(readBy.get(answer.id) ?? []).includes(m.sender.project) ? answer.at : null
    }
  }) }
}
// #endregion abandoned-sweep-run
