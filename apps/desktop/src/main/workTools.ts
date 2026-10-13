// #region work-tools — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it
/**
 * The claim tools of a session's MCP server (REQ-38, SCN-140) and the session's own observations (the
 * working-with-fabric hook pack, fabric-agent-adapter#53, D4/D5):
 *
 *   fabric_work_list       who works on what in this project: claims, sessions, open tasks, agent-sync leases
 *   fabric_work_claim      claim a task (a board id, a backlog row, or a new row) — refused only when another agent
 *                          holds the same task; related work held by others comes back as a warning
 *   fabric_work_release    end one claim (done → review, handed over, let go), or every claim of this session
 *   fabric_session_observe a turn's facts or the session's end, from the hooks — counts and ids, never content
 *
 * Every write is a journal event through the surface's one door (`appendRedacted`); the projection decides (the
 * lease, first in the journal) and the answer is READ BACK after the write, never assumed from the read before it.
 * The scope — project, session, how it came in — is the credential's, never an argument's.
 */
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { createScopedStore } from './scopedStore.ts'
import { ORIGIN_KINDS } from '../shared/origin.ts'
import { TERMINAL, mayMove, type TaskState } from '../shared/ladder.ts'
import {
  AGENT_RELEASES,
  CLAIM_DEFAULT_MINUTES,
  CLAIM_MAX_MINUTES,
  RELEASE_OUTCOME,
  TOUCHES_MAX,
  TOUCH_MAX_CHARS,
  normaliseTouch,
  relatedTo,
  sayWhy,
  sessionStale,
  type AgentRelease,
  type CameIn,
  type ClaimRow,
  type Related,
  type SourceRow
} from '../shared/workClaims.ts'
import { readWork, type SessionSign } from './workRead.ts'
import type { SourceResolution } from './backlogSource.ts'
import type { LeaseRefsRead } from './agentSyncLeases.ts'

type Store = ReturnType<typeof createScopedStore>

export interface WorkScope {
  estateId: string
  projectId: string
  sessionId: string
  taskId: string | null
  cameIn: CameIn
  agent: string | null
  /** The coding agent's own session id (Claude Code's CLAUDE_CODE_SESSION_ID), when it enrolled with one. */
  runtimeSessionId: string | null
}

/** A session of this project as Fabric knows it now: launched (a terminal) or enrolled (through the hub). */
export interface LiveSession {
  sessionId: string
  agent: string | null
  cameIn: CameIn
  startedAt: number
  lastSignAt: number | null
}

export interface WorkToolDeps {
  scope: WorkScope
  store: Store
  /** The surface's one door for agent-written events (`AgentSurface.appendRedacted`). */
  append(input: { type: string; payload: Record<string, unknown> }): Promise<{ seq: number }>
  /** The desktop journal itself, for `session.ended@1`, whose fields this module normalises (desktopIngress owners). */
  appendObserved(input: { type: 'session.ended@1'; payload: Record<string, unknown> }): Promise<{ seq: number }>
  /** Refuses a reference that carries a secret (`agentSurface.ts#assertAgentReference`). */
  checkReference(value: string | undefined): void
  /** The project's live sessions, this one included. */
  sessions(): LiveSession[]
  session: SessionSign
  resolveSource(source: { repository: string; path: string; id: string }): Promise<SourceResolution>
  /** agent-sync's leases on the project's primary repository; null when the project has no repository. */
  leaseRefs(): Promise<(LeaseRefsRead & { repository: string }) | null>
  /** Called when this session holds a claim, so its calls renew it. */
  onClaimed(): void
  /** Ends this session in Fabric (an `end` observation), after the answer has gone. */
  endSession(): void
  now(): number
}

/**
 * `fabric_work_release {claims: "session"}` (D5), READ BACK like the single-claim branch (0.3.5 review ER-8): every
 * live claim is released, then the live claims are read again. `released` only when none of them is still live;
 * a release the projection ignored is `unconfirmed`; an append that throws stops the walk and the answer says which
 * were released (confirmed by the read-back) and which are still live or were not tried (`partial`).
 */
export async function releaseEveryOwnClaim(
  readLive: () => Promise<Array<{ id: string; work_id: string }>>,
  release: (c: { id: string; work_id: string }) => Promise<number>
): Promise<Record<string, unknown>> {
  const rows = await readLive()
  if (rows.length === 0) return { released: true, claims: [], note: 'this session holds no live claim' }
  let stopped: string | null = null
  for (const c of rows) {
    try {
      await release(c)
    } catch (e) {
      // Not silent: the reason is returned to the agent as `partial`, with the ids released so far.
      stopped = e instanceof Error ? e.message : String(e)
      break
    }
  }
  let still: Set<string>
  try {
    still = new Set((await readLive()).map((c) => c.id))
  } catch {
    // Unread is not released: nothing is claimed as done.
    still = new Set(rows.map((c) => c.id))
  }
  const claims = rows.filter((c) => !still.has(c.id)).map((c) => c.id)
  const unconfirmed = rows.filter((c) => still.has(c.id)).map((c) => c.id)
  if (stopped !== null)
    return { released: false, code: 'partial', claims, unconfirmed, reason: `a release failed (${stopped}); the claims listed as unconfirmed are still live or were not tried — read fabric_work_list before acting again` }
  if (unconfirmed.length)
    return { released: false, code: 'unconfirmed', claims, unconfirmed, reason: 'some releases could not be confirmed; read fabric_work_list before acting again' }
  return { released: true, claims }
}

/**
 * A done release's second write, READ BACK (0.3.5 review iteration 2, ER-8): the release and the task's move to review
 * are two appends, and only the first was read back, so a move that threw (or that the projection ignored) left the
 * task in running while a retry answered `already-released`. The task is read, moved when the ladder lets an agent move
 * it to review, and read again; `task_moved_to` is `review` only when the board says the task is there, and `failed`
 * says why it is not. A task already in review (a repeat) is not moved twice; no board task, or a closed one, moves
 * nothing and fails nothing.
 */
export async function moveDoneTaskToReview(
  readTask: () => Promise<{ id: string; status: TaskState } | null>,
  move: (task: { id: string; status: TaskState }) => Promise<unknown>
): Promise<{ task_moved_to: 'review' | null; task_status: TaskState | null; failed?: string }> {
  const said = (e: unknown): string => (e instanceof Error ? e.message : String(e))
  let task: { id: string; status: TaskState } | null
  try {
    task = await readTask()
  } catch (e) {
    // Returned to the agent as `failed`: the release stands, the move is unknown.
    return { task_moved_to: null, task_status: null, failed: said(e) }
  }
  if (!task) return { task_moved_to: null, task_status: null }
  if (task.status === 'review') return { task_moved_to: 'review', task_status: 'review' }
  if (!mayMove('agent', task.status, 'review').ok) return { task_moved_to: null, task_status: task.status }
  let failed: string | null = null
  try {
    await move(task)
  } catch (e) {
    // Returned to the agent as `failed`, with the status read back below.
    failed = said(e)
  }
  let after: { id: string; status: TaskState } | null
  try {
    after = await readTask()
  } catch (e) {
    // Unread is not moved: nothing is claimed as done.
    return { task_moved_to: null, task_status: task.status, failed: failed ?? said(e) }
  }
  if (after?.status === 'review') return { task_moved_to: 'review', task_status: 'review' }
  return { task_moved_to: null, task_status: after?.status ?? null, failed: failed ?? 'the move to review could not be confirmed' }
}

const reply = (value: Record<string, unknown>) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] })
const KEY = z.string().regex(/^[A-Za-z0-9._:-]{8,128}$/)
const RUNTIME_SESSION = /^[A-Za-z0-9._:-]{1,128}$/
const minutesAgo = (now: number, at: number): number => Math.max(0, Math.round((now - at) / 60_000))

/** The words an agent reads for a refusal or a warning — plain, naming who and since when. */
function heldBy(c: Pick<ClaimRow, 'owner_session' | 'agent' | 'came_in' | 'claimed_at'> | null, lease: { owner_session: string; expires_at: string }) {
  return {
    session_id: lease.owner_session,
    agent: c?.agent ?? null,
    came_in: c?.came_in ?? null,
    since: c?.claimed_at ?? null,
    until: lease.expires_at
  }
}

function warningOf(related: Related[]): string | null {
  if (!related.length) return null
  return related
    .map((r) => `${r.agent ?? 'another agent'} (session ${r.heldBy.slice(0, 8)}) holds task ${r.taskId} since ${r.since}: ${r.why.map(sayWhy).join('; ')}`)
    .join('. ') + '. Coordinate — ask Fabric to hand the work over (fabric_work_claim with askHandover), link the tasks (fabric_task_link) — or continue knowing it.'
}

export function registerWorkTools(server: McpServer, deps: WorkToolDeps): void {
  const { scope, store } = deps

  const ownTask = async (taskId: string): Promise<{ id: string; status: TaskState; title: string | null; instruction: string } | null> => {
    const found = await store.select('project_tasks', 'id,status,title,instruction').eq('id', taskId).maybeSingle()
    if (found.error) throw new Error(`the board could not be read: ${found.error.message}`)
    return (found.data as { id: string; status: TaskState; title: string | null; instruction: string } | null) ?? null
  }
  const leaseOf = async (taskId: string): Promise<{ owner_session: string; expires_at: string } | null> => {
    const r = await store.select('leases', 'owner_session,expires_at').eq('work_id', taskId).maybeSingle()
    if (r.error) throw new Error(`the leases could not be read: ${r.error.message}`)
    return (r.data as { owner_session: string; expires_at: string } | null) ?? null
  }
  const liveClaimOn = async (taskId: string): Promise<(ClaimRow & { project_id: string }) | null> => {
    const r = await store.select('work_claims', '*').eq('work_id', taskId).is('released_at', null).maybeSingle()
    if (r.error) throw new Error(`the claims could not be read: ${r.error.message}`)
    return (r.data as (ClaimRow & { project_id: string }) | null) ?? null
  }
  const claimById = async (claimId: string): Promise<Record<string, unknown> | null> => {
    const r = await store.select('work_claims', '*').eq('id', claimId).maybeSingle()
    if (r.error) throw new Error(`the claims could not be read: ${r.error.message}`)
    return (r.data as Record<string, unknown> | null) ?? null
  }
  const claimByKey = async (key: string): Promise<Record<string, unknown> | null> => {
    const r = await store.select('work_claims', '*').eq('idempotency_key', key).maybeSingle()
    if (r.error) throw new Error(`the claims could not be read: ${r.error.message}`)
    return (r.data as Record<string, unknown> | null) ?? null
  }
  /** The answer a claim row gives, the same on the first call and on a repeat with the same key. */
  const claimAnswer = (row: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> =>
    row.released_at
      ? { claimed: false, code: 'released', claim_id: row.id, task_id: row.work_id, how: row.released_how, at: row.released_at,
          reason: row.released_how === 'operator' ? 'the operator released this claim' : `this claim was released (${String(row.released_how)})`, ...extra }
      : { claimed: true, claim_id: row.id, task_id: row.work_id, until: row.expires_at, touches: row.touches ?? [], ...extra }

  /** Files a task on the board the way `fabric_task_create` does: backlog, assigned to the operator, with its origin. */
  const fileTask = async (title: string, origin: { kind: string; ref: string }): Promise<string> => {
    const id = randomUUID()
    await deps.append({ type: 'task.created@1', payload: { id, title, instruction: title, origin, section: null, task_type: 'development' } })
    await deps.append({ type: 'task.assigned@1', payload: { task_id: id, assigned_by: `agent:${scope.sessionId}`, assigned_to: 'operator' } })
    return id
  }
  const linkSource = async (taskId: string, s: Extract<SourceResolution, { ok: true }>): Promise<void> => {
    await deps.append({ type: 'task.source.linked@1', payload: { task_id: taskId, repository: s.repository, repo_path: s.repoPath, path: s.path, row_id: s.rowId } })
  }

  // ── fabric_work_list ───────────────────────────────────────────────────────────────────────────────────────
  server.registerTool(
    'fabric_work_list',
    {
      title: 'Who is working on what here',
      description:
        'Call this before you start a piece of work. Answers who works on what in this project: every live claim — the agent, how it came in (launched, enrolled, handed off, through the hub), the task and the backlog row it links, what it said it will touch, since when, its last sign of life — the sessions working here, the open tasks nobody holds, work handed over to you, handover requests on your claims, claims the operator released, and agent-sync\'s leases on the repository (read-only). Calling it renews your own claims. A board that cannot be read is an error, never "nobody is working here".',
      inputSchema: {}
    },
    async () => {
      const now = deps.now()
      const snap = await readWork(store, { now, session: deps.session })
      const [open, mine, leases] = await Promise.all([
        store.select('project_tasks', 'id,title,instruction,status').in('status', ['backlog', 'running', 'review']).order('started_at', { ascending: false }).limit(40),
        store.select('work_claims', 'id,work_id,owner_session,released_at,released_how,handed_to,release_note')
          .not('released_at', 'is', null).gte('released_at', new Date(now - 24 * 3600_000).toISOString())
          .or(`owner_session.eq.${scope.sessionId},handed_to.eq.${scope.sessionId}`).limit(50),
        deps.leaseRefs()
      ])
      if (open.error) throw new Error(`the board could not be read: ${open.error.message}`)
      if (mine.error) throw new Error(`the claims could not be read: ${mine.error.message}`)
      const held = new Set([...snap.claims.map((c) => c.work_id), ...snap.held.map((h) => h.task.id)])
      const recent = (mine.data ?? []) as Array<Record<string, string | null>>
      const mineLive = snap.claims.filter((c) => c.owner_session === scope.sessionId)
      if (mineLive.length) deps.onClaimed()
      return reply({
        project_id: scope.projectId,
        you: { session_id: scope.sessionId, agent: scope.agent, came_in: scope.cameIn },
        claims: snap.claims.map((c) => ({
          claim_id: c.id,
          task: { ...c.task, source: c.source ? { repository: c.source.repository, path: c.source.path, id: c.source.row_id } : null },
          session_id: c.owner_session,
          is_you: c.owner_session === scope.sessionId,
          agent: c.agent,
          came_in: c.came_in,
          touches: c.touches,
          since: c.claimed_at,
          until: c.expires_at,
          last_sign_at: c.last_sign_at,
          life: c.life,
          reads: c.life === 'lapsed' ? 'lapsed — the session ended' : c.life === 'silent' ? `no sign since ${c.last_sign_at}` : 'working',
          related: c.related.map((r) => ({ claim_id: r.claimId, task_id: r.taskId, held_by: r.heldBy, why: r.why.map(sayWhy) })),
          handover_requested: c.handover_requested_by ? { by: c.handover_requested_by, at: c.handover_requested_at, note: c.handover_note } : null
        })),
        held_without_claim: snap.held.map((h) => ({ task: h.task, session_id: h.owner_session, until: h.expires_at, note: 'held by the session Fabric launched for it' })),
        sessions: deps.sessions().map((s) => ({
          session_id: s.sessionId,
          is_you: s.sessionId === scope.sessionId,
          agent: s.agent,
          came_in: s.cameIn,
          started_at: new Date(s.startedAt).toISOString(),
          last_sign_at: s.lastSignAt ? new Date(s.lastSignAt).toISOString() : null,
          reads: sessionStale(s.lastSignAt, s.startedAt, now) ? `no sign for ${minutesAgo(now, s.lastSignAt ?? s.startedAt)} min` : 'active'
        })),
        open_tasks: ((open.data ?? []) as Array<Record<string, string | null>>)
          .filter((t) => !held.has(t.id as string))
          .slice(0, 20)
          .map((t) => ({ id: t.id, title: (t.title ?? t.instruction ?? '').slice(0, 200), status: t.status })),
        waiting_for_you: recent
          .filter((r) => r.handed_to === scope.sessionId && r.released_how === 'handed-over' && !held.has(r.work_id as string))
          .map((r) => ({ task_id: r.work_id, from_session: r.owner_session, note: r.release_note, at: r.released_at })),
        handover_requests: mineLive
          .filter((c) => c.handover_requested_by)
          .map((c) => ({ claim_id: c.id, task_id: c.work_id, by: c.handover_requested_by, at: c.handover_requested_at, note: c.handover_note })),
        released_by_operator: recent
          .filter((r) => r.owner_session === scope.sessionId && r.released_how === 'operator')
          .map((r) => ({ claim_id: r.id, task_id: r.work_id, at: r.released_at })),
        agent_sync_leases: leases === null ? { read: false, reason: 'this project has no repository' } : leases,
        read_at: snap.readAt
      })
    }
  )

  // ── fabric_work_claim ──────────────────────────────────────────────────────────────────────────────────────
  server.registerTool(
    'fabric_work_claim',
    {
      title: 'Claim your task before you start',
      description:
        'Say which task you are working on now, and what you will touch. Name it by taskId (a task on this project\'s board), by source {repository, path, id} (a backlog row: Fabric links it to its task and files one when none exists), or as a new row: title with its origin. Refused only when another agent already holds the same task — the answer names who and since when; set askHandover to ask the holder for it. Otherwise claimed, with its expiry; related work other agents hold (the same backlog row, a linked task, an overlapping folder or file) comes back as a warning, never a refusal. Your calls renew the claim while you work. Retrying with the same idempotencyKey is the same claim, never a second.',
      inputSchema: {
        taskId: z.string().uuid().optional(),
        source: z.object({ repository: z.string().min(1).max(300), path: z.string().min(1).max(300), id: z.string().min(1).max(64) }).optional()
          .describe('The backlog row this work serves, by its address: the repository (its remote, owner/name, or its folder), the file\'s path in it, and the row\'s id'),
        title: z.string().min(3).max(200).optional().describe('A new row\'s title, or the title of the task Fabric files for a backlog row'),
        origin: z.object({ kind: z.enum(ORIGIN_KINDS), ref: z.string().min(1).max(300) }).optional().describe('What a new row came out of; required with a title alone'),
        touches: z.array(z.string().min(1).max(TOUCH_MAX_CHARS)).max(TOUCHES_MAX).optional().describe('The folders, files or patterns you will change, relative to the repository'),
        minutes: z.number().int().min(1).max(CLAIM_MAX_MINUTES).optional().describe(`How long before the claim lapses unless renewed. Default ${CLAIM_DEFAULT_MINUTES}`),
        idempotencyKey: KEY.optional().describe('Your own key for this claim; the same key returns the same claim'),
        askHandover: z.boolean().optional().describe('When the task is held by another agent: ask that agent, through Fabric, to hand it over'),
        note: z.string().max(400).optional().describe('One line for the holder, with askHandover')
      }
    },
    async ({ taskId, source, title, origin, touches, minutes, idempotencyKey, askHandover, note }) => {
      for (const t of touches ?? []) deps.checkReference(t)
      deps.checkReference(origin?.ref)
      const key = idempotencyKey ? `claim:${scope.sessionId}:${idempotencyKey}` : null
      if (key) {
        const prior = await claimByKey(key)
        if (prior) return reply(claimAnswer(prior, { same_claim: true }))
      }
      let resolved: Extract<SourceResolution, { ok: true }> | null = null
      if (source) {
        deps.checkReference(source.repository)
        deps.checkReference(source.path)
        const r = await deps.resolveSource(source)
        if (!r.ok) return reply({ claimed: false, code: 'source-unresolved', part: r.part, reason: r.reason, next: 'name a backlog row of this project, or claim a new row with title and origin' })
        resolved = r
      }
      let id = taskId ?? null
      let filed = false
      if (!id && resolved) {
        const linked = await store.select('task_sources', 'task_id').eq('repo_path', resolved.repoPath).eq('path', resolved.path).eq('row_id', resolved.rowId)
        if (linked.error) throw new Error(`the board could not be read: ${linked.error.message}`)
        for (const l of (linked.data ?? []) as Array<{ task_id: string }>) {
          const t = await ownTask(l.task_id)
          if (t && !TERMINAL.includes(t.status)) { id = t.id; break }
        }
        if (!id) {
          id = await fileTask(title ?? `${resolved.rowId} (${resolved.path})`, { kind: 'document', ref: resolved.path })
          filed = true
        }
      }
      if (!id && title) {
        if (!origin) return reply({ claimed: false, code: 'bad-input', reason: 'a new row needs its origin: what it came out of (a file and line, a memory fact, a task)' })
        id = await fileTask(title, origin)
        filed = true
      }
      if (!id) return reply({ claimed: false, code: 'bad-input', reason: 'name the task: taskId, a backlog row as source, or a new row\'s title with its origin' })

      const task = await ownTask(id)
      if (!task) return reply({ claimed: false, code: 'not-in-project', reason: 'no such task in this project — a session claims tasks of its own project only' })
      if (TERMINAL.includes(task.status)) return reply({ claimed: false, code: 'closed', reason: `that task is ${task.status}` })
      if (resolved) {
        const has = await store.select('task_sources', 'repo_path,path,row_id').eq('task_id', id).maybeSingle()
        if (has.error) throw new Error(`the board could not be read: ${has.error.message}`)
        const cur = has.data as { repo_path: string; path: string; row_id: string } | null
        if (!cur || cur.repo_path !== resolved.repoPath || cur.path !== resolved.path || cur.row_id !== resolved.rowId) await linkSource(id, resolved)
      }

      const now = deps.now()
      const lease = await leaseOf(id)
      const live = lease && Date.parse(lease.expires_at) > now
      if (live && lease.owner_session !== scope.sessionId) {
        const holder = await liveClaimOn(id)
        let asked = false
        if (askHandover && holder) {
          await deps.append({ type: 'work.handover.requested@1', payload: { claim_id: holder.id, work: id, requested_by: scope.sessionId, note: note ?? null } })
          asked = true
        }
        return reply({
          claimed: false,
          code: 'held',
          task_id: id,
          reason: `another agent holds this task${holder?.agent ? ` (${holder.agent})` : ''}, since ${holder?.claimed_at ?? 'before this read'}`,
          held_by: heldBy(holder, lease),
          handover_requested: asked,
          next: asked ? 'the holder sees your request on its next fabric_work_list; choose another task meanwhile' : 'choose another task, file a linked one, or ask for a handover (askHandover: true)'
        })
      }
      const expiresAt = new Date(now + (minutes ?? CLAIM_DEFAULT_MINUTES) * 60_000).toISOString()
      const mineNow = live ? await liveClaimOn(id) : null
      let claimId: string
      let same = false
      if (mineNow && mineNow.owner_session === scope.sessionId) {
        // The same task claimed again by its holder is the same claim, renewed.
        await deps.append({ type: 'work.renewed@1', payload: { work: id, owner: scope.sessionId, expires_at: expiresAt, claim_id: mineNow.id } })
        claimId = mineNow.id
        same = true
      } else {
        claimId = randomUUID()
        await deps.append({
          type: 'work.claimed@1',
          payload: {
            work: id, owner: scope.sessionId, idempotency_key: key ?? `claim:${scope.sessionId}:${claimId}`, expires_at: expiresAt,
            write_scopes: (touches ?? []).map(normaliseTouch).filter(Boolean), claim_id: claimId, agent: scope.agent, came_in: scope.cameIn
          }
        })
      }
      // The answer is the projection's, read after the write: two claims at one moment — the first in the journal holds it.
      const settled = await claimById(claimId)
      if (!settled || settled.released_at) {
        const after = await leaseOf(id)
        if (after && after.owner_session !== scope.sessionId)
          return reply({ claimed: false, code: 'held', task_id: id, reason: 'another agent claimed it in the same moment', held_by: heldBy(await liveClaimOn(id), after) })
        return reply({ claimed: false, code: 'unresolved-run', task_id: id, reason: 'the task\'s last run has not ended; its session holds it until its exit is confirmed' })
      }
      deps.onClaimed()
      const snap = await readWork(store, { now: deps.now(), session: deps.session })
      const sources = new Map<string, SourceRow>(snap.claims.filter((c) => c.source).map((c) => [c.work_id, c.source as SourceRow]))
      const related = relatedTo(
        { claimId, taskId: id, owner: scope.sessionId, touches: (settled.touches as string[]) ?? [] },
        snap.claims,
        sources,
        await edgesOf(store, id)
      )
      return reply(claimAnswer(settled, {
        task: { id, title: task.title ?? task.instruction.slice(0, 200), status: task.status },
        filed,
        same_claim: same,
        ...(resolved ? { source: { repository: resolved.repository, path: resolved.path, id: resolved.rowId, id_checked: resolved.idChecked } } : {}),
        related: related.map((r) => ({ claim_id: r.claimId, task_id: r.taskId, held_by: r.heldBy, agent: r.agent, since: r.since, why: r.why.map(sayWhy) })),
        warning: warningOf(related)
      }))
    }
  )

  // ── fabric_work_release ────────────────────────────────────────────────────────────────────────────────────
  server.registerTool(
    'fabric_work_release',
    {
      title: 'Release your claim when the work ends',
      description:
        'Say how it ended: done (the task moves to review), handed-over (to the session that asked, or the one you name in to, with the note the next agent reads), or let-go (why). Name the claim by claimId or taskId — or claims: "session" to release every claim this session holds (the session hooks do this when the session ends; outcome let-go with a reason). Releasing one the operator already released says so. The same idempotencyKey is the same release.',
      inputSchema: {
        claimId: z.string().uuid().optional(),
        taskId: z.string().uuid().optional(),
        claims: z.literal('session').optional().describe('Every claim this session holds'),
        how: z.enum(AGENT_RELEASES).optional(),
        outcome: z.enum(AGENT_RELEASES).optional().describe('The same as how'),
        to: z.string().uuid().optional().describe('With handed-over: the session that takes it; by default the one that asked'),
        note: z.string().max(2000).optional().describe('What the next agent reads, or why you let it go'),
        reason: z.string().max(2000).optional().describe('The same as note'),
        idempotencyKey: KEY.optional()
      }
    },
    async ({ claimId, taskId, claims, how, outcome, to, note, reason, idempotencyKey }) => {
      const ending: AgentRelease | undefined = how ?? outcome
      const said = (note ?? reason)?.trim() || null
      if (!ending) return reply({ released: false, code: 'bad-input', reason: 'say how it ended: done, handed-over or let-go' })
      if (ending !== 'done' && !said) return reply({ released: false, code: 'bad-input', reason: `${ending} needs a note: what the next agent reads, or why` })
      const release = async (c: { id: string; work_id: string }, extra: Record<string, unknown> = {}): Promise<number> =>
        (await deps.append({
          type: 'work.released@1',
          payload: { work: c.work_id, owner: scope.sessionId, outcome: RELEASE_OUTCOME[ending], how: ending, claim_id: c.id, note: said,
                     ...(idempotencyKey ? { idempotency_key: `release:${scope.sessionId}:${idempotencyKey}:${c.id}` } : {}), ...extra }
        })).seq

      if (claims === 'session') {
        const readLive = async (): Promise<Array<{ id: string; work_id: string }>> => {
          const live = await store.select('work_claims', 'id,work_id').eq('owner_session', scope.sessionId).is('released_at', null)
          if (live.error) throw new Error(`the claims could not be read: ${live.error.message}`)
          return (live.data ?? []) as Array<{ id: string; work_id: string }>
        }
        return reply(await releaseEveryOwnClaim(readLive, (c) => release(c)))
      }
      if (!claimId && !taskId) return reply({ released: false, code: 'bad-input', reason: 'name the claim: claimId, taskId, or claims: "session"' })
      let row: Record<string, unknown> | null = claimId ? await claimById(claimId) : null
      if (!row && taskId) {
        const r = await store.select('work_claims', '*').eq('work_id', taskId).eq('owner_session', scope.sessionId)
          .order('claimed_at', { ascending: false }).limit(1).maybeSingle()
        if (r.error) throw new Error(`the claims could not be read: ${r.error.message}`)
        row = (r.data as Record<string, unknown> | null) ?? null
      }
      if (!row) return reply({ released: false, code: 'not-held', reason: 'you hold no such claim in this project' })
      if (row.owner_session !== scope.sessionId) return reply({ released: false, code: 'not-yours', reason: 'another session holds that claim' })
      // The move of a done task, read back; a repeat calls it again to finish a move that did not land (ER-8).
      const toReview = (taskId: string) =>
        moveDoneTaskToReview(() => ownTask(taskId), (task) => deps.append({ type: 'task.moved@1', payload: { task_id: task.id, from: task.status, to: 'review', note: said } }))
      const notMoved = (m: { task_status: TaskState | null; failed?: string }) => ({
        code: 'task-not-moved',
        task_status: m.task_status,
        reason: `the claim is released, but its task did not move to review (${m.failed}); call fabric_work_release again with the same idempotencyKey to finish the move, or read fabric_work_list`
      })
      if (ending === 'done' && row.released_how === 'done' && row.released_at) {
        const m = await toReview(row.work_id as string)
        if (m.failed) return reply({ released: true, claim_id: row.id, how: 'done', at: row.released_at, task_moved_to: null, ...notMoved(m) })
        return reply({ released: true, code: 'already-released', claim_id: row.id, how: 'done', at: row.released_at, task_moved_to: m.task_moved_to, task_status: m.task_status,
          reason: 'already released (done)' })
      }
      if (row.released_at)
        return reply({
          released: row.released_how === ending,
          code: row.released_how === 'operator' ? 'released-by-operator' : 'already-released',
          claim_id: row.id, how: row.released_how, at: row.released_at,
          reason: row.released_how === 'operator' ? `the operator released this claim at ${String(row.released_at)}` : `already released (${String(row.released_how)})`
        })
      const handedTo = ending === 'handed-over' ? (to ?? (row.handover_requested_by as string | null) ?? null) : null
      const seq = await release({ id: row.id as string, work_id: row.work_id as string }, handedTo ? { handed_to: handedTo } : {})
      const m = ending === 'done' ? await toReview(row.work_id as string) : null
      const after = await claimById(row.id as string)
      if (!after?.released_at) return reply({ released: false, code: 'unconfirmed', reason: 'the release could not be confirmed; read fabric_work_list before acting again', seq })
      if (m?.failed) return reply({ released: true, claim_id: row.id, how: ending, handed_to: handedTo, task_moved_to: null, seq, ...notMoved(m) })
      return reply({ released: true, claim_id: row.id, how: ending, handed_to: handedTo, task_moved_to: m?.task_moved_to ?? null, ...(m ? { task_status: m.task_status } : {}), seq })
    }
  )

  // ── fabric_session_observe ─────────────────────────────────────────────────────────────────────────────────
  server.registerTool(
    'fabric_session_observe',
    {
      title: 'Record a turn of this session, or its end',
      description:
        'For the working-with-fabric session hooks: one turn\'s facts (event turn) or the session\'s end (event end, with its reason) — the HEAD commit, the number of files that differ from it and the lines added and removed. Counts and ids only: no path, no branch, no message, no diff. runtimeSessionId must be the one this session enrolled with. The same idempotencyKey records nothing twice. An end ends this session in Fabric once the answer has gone.',
      inputSchema: {
        event: z.enum(['turn', 'end']),
        runtime: z.string().regex(/^[a-z][a-z0-9-]{1,40}$/),
        runtimeSessionId: z.string().regex(RUNTIME_SESSION),
        observedAt: z.string().datetime({ offset: true }),
        head: z.string().regex(/^[0-9a-f]{40}([0-9a-f]{24})?$/).nullable().optional(),
        // null = git could not say (a folder that is no repository, a repository with no commit): the hooks send
        // JSON null for a fact they could not read, and a refusal there lost every turn of such a session.
        filesChanged: z.number().int().min(0).max(10_000_000).nullable().optional(),
        linesAdded: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
        linesRemoved: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
        reason: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/).optional().describe('end only: why the session ended, as the agent names it (clear, logout, prompt_input_exit, other)'),
        idempotencyKey: KEY
      }
    },
    async ({ event, runtime, runtimeSessionId, observedAt, head, filesChanged, linesAdded, linesRemoved, reason, idempotencyKey }) => {
      if (!scope.runtimeSessionId || scope.runtimeSessionId !== runtimeSessionId)
        return reply({ recorded: false, code: 'not-this-session', reason: 'runtimeSessionId is not the one this session enrolled with' })
      if (event === 'turn' && reason !== undefined) return reply({ recorded: false, code: 'bad-input', reason: 'reason belongs to an end' })
      const type = event === 'turn' ? 'session.turn.observed@1' : 'session.ended@1'
      const prior = await store.select('journal', 'seq').eq('type', type)
        .eq('payload->>session_id', scope.sessionId).eq('payload->>idempotency_key', idempotencyKey).limit(1)
      if (prior.error) throw new Error(`the journal could not be read: ${prior.error.message}`)
      const was = (prior.data ?? [])[0] as { seq: number } | undefined
      if (was) return reply({ recorded: true, seq: was.seq, repeated: true })
      const facts = {
        session_id: scope.sessionId, runtime, runtime_session_id: runtimeSessionId, observed_at: observedAt,
        head: head ?? null, files_changed: filesChanged ?? null, lines_added: linesAdded ?? null, lines_removed: linesRemoved ?? null,
        idempotency_key: idempotencyKey
      }
      if (event === 'turn') {
        const e = await deps.append({ type: 'session.turn.observed@1', payload: facts })
        return reply({ recorded: true, seq: e.seq })
      }
      const e = await deps.appendObserved({ type: 'session.ended@1', payload: { ...facts, observed_by: 'hook', reason: reason ?? 'other' } })
      deps.endSession()
      return reply({ recorded: true, seq: e.seq, session: 'ended' })
    }
  )
}

/** The task links that touch one task, both directions. */
async function edgesOf(store: Store, taskId: string): Promise<Array<{ task_id: string; rel: string; target_id: string }>> {
  const [a, b] = await Promise.all([
    store.select('task_links', 'task_id,rel,target_id,target_kind').eq('task_id', taskId),
    store.select('task_links', 'task_id,rel,target_id,target_kind').eq('target_id', taskId)
  ])
  if (a.error || b.error) throw new Error(`the task links could not be read: ${(a.error ?? b.error)?.message}`)
  return [...(a.data ?? []), ...(b.data ?? [])]
    .filter((e) => (e as { target_kind: string }).target_kind === 'task')
    .map((e) => ({ task_id: (e as { task_id: string }).task_id, rel: (e as { rel: string }).rel, target_id: (e as { target_id: string }).target_id }))
}
// #endregion work-tools
