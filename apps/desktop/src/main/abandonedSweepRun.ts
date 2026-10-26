// #region abandoned-sweep-run — docs: docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md#requirements
/**
 * The sweep of abandoned work, run by the main process (0.3.13 wave 2, CO-427). The pure judgement lives in
 * `shared/abandonedSweep.ts`; this module reads what it judges, tells the agents what it found and releases the claims
 * whose sessions ended. Every dependency is injected, so it is tested without a database (test/abandoned-sweep-run).
 *
 *   SW-1  every third pass of the one-minute cycle (`onPass`, counted here, no timer of its own)
 *   SW-2  claims, running tasks, board requests and Fabric's own terminals, each read in its own try
 *   SW-4  a Fabric terminal gets one line written into it; any other session reads its nudges in its next tool answer
 *   SW-5  a finding is told once, then not again for 30 minutes while it stays (`toTell`)
 *   SW-7  interim: one ops line per sweep that found something (the journal receipt needs 0.3.13's schema step)
 *   SW-8  a lapsed claim found by two sweeps in a row is released as lapsed
 */
import {
  findAbandoned,
  lapsedTwice,
  nudgeText,
  sweepDue,
  toTell,
  TELL_QUIET_MS,
  type AbandonedKind,
  type Finding,
  type SweepClaim,
  type SweepRequest,
  type SweepTerminal
} from '../shared/abandonedSweep.ts'
import type { CommsMessage, CommsPageReply, CommsThreadPageReply, CommsFactsReply } from '../shared/commsRead.ts'
import { ops as opsSink } from './opsSink.ts'
import { readWork, type SessionSign } from './workRead.ts'
import type { createScopedStore } from './scopedStore.ts'

type Store = ReturnType<typeof createScopedStore>

/** The reason a lapsed claim's release carries (SW-8). */
export const LAPSED_REASON = 'lapsed: its session ended and two sweeps found it'
/** At most this many nudges wait per session and per project; the oldest goes first. */
export const NUDGES_PER_KEY = 50

export interface SweepRunningTask { taskId: string; projectId: string | null; movedAt: string }

export interface AbandonedSweepDeps {
  now(): number
  /** The open claims, each with its session's sign (null when Fabric holds no session for it), and the tasks a lease
   *  holds without a claim (a managed launch). */
  readClaims(now: number): Promise<{ claims: SweepClaim[]; heldTaskIds: string[] }>
  /** The tasks in running, with when each last moved. */
  readRunningTasks(): Promise<SweepRunningTask[]>
  readRequests(now: number): Promise<SweepRequest[]>
  /** Fabric's own terminals, with the runtime observer's liveness and the task each holds. */
  terminals(): SweepTerminal[]
  /** Whether Fabric runs a terminal for this session now (`PtyManager.get(id).running`). */
  terminalRunning(sessionId: string): boolean
  /** One fenced write into a Fabric terminal (`PtyManager.deliverWhenReady`). */
  deliver(sessionId: string, text: string): Promise<{ state: string; reason?: string }>
  /** Releases a claim as lapsed and returns its task to the backlog when the claim moved it there (`workRelease.ts`). */
  releaseLapsed(claimId: string, reason: string): Promise<{ released: boolean; reason?: string; failed?: string }>
  ops?: Pick<typeof opsSink, 'failed' | 'record' | 'correlate'>
}

type Source = 'claims' | 'tasks' | 'requests' | 'terminals'
/** Which kinds each read finds, so a failed read keeps what was told about them (SW-5 across a blind sweep). */
const KINDS_OF: Record<Source, AbandonedKind[]> = {
  claims: ['claim-silent', 'claim-lapsed', 'task-unclaimed'],
  tasks: ['task-unclaimed'],
  requests: ['request-unmoved', 'answer-unread'],
  terminals: ['terminal-stalled', 'task-unclaimed']
}

export interface SweepResult {
  findings: Finding[]
  told: number
  delivered: number
  queued: number
  released: number
  failedReads: Source[]
}

interface ProjectNudge { key: string; text: string; at: number; takenBy: Set<string> }

export function createAbandonedSweep(deps: AbandonedSweepDeps) {
  const ops = deps.ops ?? opsSink
  let pass = 0
  let told = new Map<string, number>()
  let lapsedSeen = new Set<string>()
  const bySession = new Map<string, string[]>()
  const byProject = new Map<string, ProjectNudge[]>()

  const push = <T,>(list: T[], item: T): void => {
    list.push(item)
    if (list.length > NUDGES_PER_KEY) list.splice(0, list.length - NUDGES_PER_KEY)
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

  async function sweep(): Promise<SweepResult> {
    const now = deps.now()
    const failedReads: Source[] = []
    const [claimRead, taskRead, requests, terminals] = await Promise.all([
      attempt('claims', () => deps.readClaims(now), failedReads),
      attempt('tasks', () => deps.readRunningTasks(), failedReads),
      attempt('requests', () => deps.readRequests(now), failedReads),
      attempt('terminals', () => deps.terminals(), failedReads)
    ])
    // A running task is unclaimed only when no open claim (any life: a silent or lapsed one is its own finding), no
    // lease of a managed launch and no Fabric terminal stands on it. Without the claims or the terminals read, that
    // cannot be judged, so no task is called unclaimed.
    const holders = claimRead && terminals
      ? new Set<string>([
          ...claimRead.claims.map((c) => c.taskId).filter((id): id is string => id !== null),
          ...claimRead.heldTaskIds,
          ...terminals.map((t) => t.taskId).filter((id): id is string => id !== null)
        ])
      : null
    const findings = findAbandoned({
      now,
      claims: claimRead?.claims ?? [],
      tasks: holders && taskRead
        ? taskRead.map((t) => ({ taskId: t.taskId, projectId: t.projectId, state: 'running', movedAt: t.movedAt, claimed: holders.has(t.taskId) }))
        : [],
      requests: requests ?? [],
      terminals: terminals ?? []
    })

    // SW-5. What a failed read could not see is not forgotten: its kinds keep their last telling.
    const blind = new Set(failedReads.flatMap((s) => KINDS_OF[s]))
    const decided = toTell(findings, told, now)
    for (const [key, at] of told) if (!decided.told.has(key) && blind.has(key.slice(0, key.indexOf(':')) as AbandonedKind)) decided.told.set(key, at)
    told = decided.told

    let delivered = 0
    let queued = 0
    for (const f of decided.tell) {
      const text = nudgeText(f)
      // A lapsed claim's session has ended: there is nobody to wake but the project's other agents.
      const own = f.kind === 'claim-lapsed' ? null : f.sessionId
      if (own && deps.terminalRunning(own)) {
        delivered++
        deps.deliver(own, text).then(
          (r) => { if (r.state !== 'written') ops.failed('work.sweep-deliver', new Error(r.reason ?? r.state), { session_id: own, kind: f.kind, note: 'the line was not written into the terminal; the finding is told again after the quiet period' }) },
          (e: unknown) => ops.failed('work.sweep-deliver', e, { session_id: own, kind: f.kind, note: 'the terminal write threw; the finding is told again after the quiet period' })
        )
      } else if (own) {
        const list = bySession.get(own) ?? []
        push(list, text)
        bySession.set(own, list)
        queued++
      } else if (f.projectId) {
        const list = prune(f.projectId, now).filter((n) => n.key !== f.key)
        push(list, { key: f.key, text, at: now, takenBy: new Set<string>() })
        byProject.set(f.projectId, list)
        queued++
      }
    }

    // SW-8. A blind claims read breaks no row: what was seen stays seen until the claims are read again.
    let released = 0
    if (claimRead) {
      const twice = lapsedTwice(lapsedSeen, findings)
      lapsedSeen = twice.seen
      for (const f of twice.release) {
        if (!f.claimId) continue
        try {
          const r = await deps.releaseLapsed(f.claimId, LAPSED_REASON)
          if (r.released) released++
          if (r.failed) ops.failed('work.sweep-release', new Error(r.failed), { claim_id: f.claimId, note: 'the claim is released; its task stays where it is' })
        } catch (e) {
          ops.failed('work.sweep-release', e, { claim_id: f.claimId, note: 'the lapsed claim was not released; the next sweep tries again' })
        }
      }
    }

    // SW-7, interim: one line naming what this sweep found; an idle sweep writes nothing.
    if (findings.length) {
      const found: Partial<Record<AbandonedKind, number>> = {}
      for (const f of findings) found[f.kind] = (found[f.kind] ?? 0) + 1
      ops.record({ op: 'work.swept', outcome: 'ok', detail: { found, told: decided.tell.length, delivered, queued, released, ...(failedReads.length ? { unread: failedReads } : {}) }, ctx: { correlationId: ops.correlate() } })
    }
    return { findings, told: decided.tell.length, delivered, queued, released, failedReads }
  }

  return {
    /** One pass of the cycle: every third one sweeps (SW-1). Null when this pass does not. */
    async onPass(): Promise<SweepResult | null> {
      pass++
      return sweepDue(pass) ? sweep() : null
    },
    /** This session's nudges, and its project's it has not yet taken; the session's own are cleared (SW-4). */
    takeNudges(sessionId: string, projectId: string | null): string[] {
      const own = bySession.get(sessionId) ?? []
      bySession.delete(sessionId)
      const shared = projectId ? prune(projectId, deps.now()).filter((n) => !n.takenBy.has(sessionId)) : []
      for (const n of shared) n.takenBy.add(sessionId)
      return [...own, ...shared.map((n) => n.text)]
    }
  }
}

export type AbandonedSweep = ReturnType<typeof createAbandonedSweep>

/** How many open claims and running tasks one sweep reads; past it the rest are judged at a later sweep. */
export const SWEEP_READ_LIMIT = 500

/** The open claims for the sweep (SW-2), from the same reading `fabric_work_list` and the screens use
 *  (`workRead.ts#readWork`): each with its session's sign, and the tasks a managed launch's lease holds without one. */
export async function readSweepClaims(store: Store, now: number, session: SessionSign): Promise<{ claims: SweepClaim[]; heldTaskIds: string[] }> {
  const snap = await readWork(store, { now, session, limit: SWEEP_READ_LIMIT })
  return {
    claims: snap.claims.map((c) => ({
      claimId: c.id, taskId: c.work_id, projectId: c.project_id, sessionId: c.owner_session,
      expiresAt: c.expires_at, claimedAt: c.claimed_at, renewedAt: c.renewed_at, session: session(c.owner_session)
    })),
    heldTaskIds: snap.held.map((h) => h.task.id)
  }
}

/** The tasks in running (SW-2). When a task last moved is read the way the home's «В работе» reads it
 *  (`workRead.ts#readHome`): `moved_at`, the time it last changed column, else `started_at`. A read that fails throws. */
export async function readRunningTasks(store: Store): Promise<SweepRunningTask[]> {
  const r = await store.select('project_tasks', 'id,project_id,moved_at,started_at').eq('status', 'running').limit(SWEEP_READ_LIMIT)
  if (r.error) throw new Error(`the tasks in work could not be read: ${r.error.message}`)
  return ((r.data ?? []) as Array<{ id: string; project_id: string | null; moved_at: string | null; started_at: string | null }>)
    .filter((t) => t.moved_at ?? t.started_at)
    .map((t) => ({ taskId: t.id, projectId: t.project_id, movedAt: (t.moved_at ?? t.started_at) as string }))
}

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
 * A door that does not answer throws: an unread board is never "nothing waits".
 */
export async function readBoardRequests(comms: SweepComms, estateId: string, now: number): Promise<SweepRequest[]> {
  const must = <T extends { ok: boolean }>(r: T, what: string): Extract<T, { ok: true }> => {
    if (!r.ok) throw new Error(`the board's ${what} could not be read: ${(r as { error?: { message?: string } }).error?.message ?? 'no reason given'}`)
    return r as Extract<T, { ok: true }>
  }
  const threads: string[] = []
  let before: unknown = null
  for (let page = 0; page < THREAD_PAGES; page++) {
    const r = must(await comms.threadPage(estateId, { kind: 'request', activeSince: new Date(now - BOARD_WINDOW_MS).toISOString() }, before, 100), 'threads')
    threads.push(...r.threads.map((t) => t.id))
    if (!r.more || !r.before) break
    before = r.before
  }
  const messages: CommsMessage[] = []
  for (const thread of threads) {
    let after = 0
    for (let page = 0; page < MESSAGE_PAGES; page++) {
      const r = must(await comms.list(estateId, thread, after, 100), 'messages')
      messages.push(...r.messages)
      if (!r.more) break
      after = r.lastSeq
    }
  }
  const requests = messages.filter((m) => m.kind === 'request' && m.request)
  // The target's latest answer to each answered request.
  const answerOf = new Map<string, CommsMessage>()
  for (const m of messages) {
    if (!m.replyTo) continue
    const req = requests.find((r) => r.id === m.replyTo)
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
  return requests.map((m) => {
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
  })
}
// #endregion abandoned-sweep-run
