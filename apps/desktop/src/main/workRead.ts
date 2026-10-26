// #region work-read — docs: docs/ux/scenarios.md#scn-141-see-where-work-is-across-every-project--sessions-claims-review-and-sessions-with-no-project
/**
 * One reading of the claims in a scope — a project (an agent's `fabric_work_list`, the project page's «Who is
 * working on what») or the whole estate (SCR-78 «Where work is») — from the journal's projections only: live
 * `work_claims`, the `leases` they stand on, the tasks, their backlog links and their links to each other. Every
 * read's error is read: a projection that could not be read THROWS, so no caller can answer "nobody is working here"
 * from a read that did not happen (M108, IMP-04).
 */
import type { createScopedStore } from './scopedStore.ts'
import { currentLeases, type LeaseRefsRead } from './agentSyncLeases.ts'
import {
  claimLife,
  relatedPairs,
  sessionStale,
  unresolvedRuns,
  whereWorkRows,
  type CameIn,
  type ProjectWorkView,
  type WhereWorkView,
  type WorkClaimView,
  type WorkLeasesView,
  type WorkSessionView,
  type ClaimLife,
  type ClaimRow,
  type CompensationRow,
  type Related,
  type RunHold,
  type RunRow,
  type StopRow,
  type SourceRow,
  type TaskEdge
} from '../shared/workClaims.ts'
import { composeHome, type HomeView, type StageRow, type TaskBrief } from '../shared/homeLive.ts'
import { composeTaskBoard, type TaskBoardView } from '../shared/taskBoard.ts'
import { composeSessionTasks, SESSION_TASKS_LIMIT, type SessionClaimRow, type SessionTaskRow, type SessionTasksView } from '../shared/sessionTasks.ts'

type Store = ReturnType<typeof createScopedStore>

export interface ClaimView extends ClaimRow {
  project_id: string
  task: { id: string; title: string; status: string }
  source: SourceRow | null
  life: ClaimLife
  last_sign_at: string
  related: Related[]
}

/** A lease no claim stands on: a session's own task held by its managed launch (migration 61) — live, or lapsed with
 *  its run not proved stopped (CO-323), which holds the task as surely: the claim projector refuses every other claim. */
export interface HeldView {
  project_id: string
  task: { id: string; title: string; status: string }
  owner_session: string
  expires_at: string
  write_scopes: string[]
  /** The run holding the task past its lease's lapse; null for a live lease. */
  run: RunHold | null
}

export interface WorkSnapshot {
  claims: ClaimView[]
  held: HeldView[]
  readAt: string
  /** The reads that stopped at their limit (CO-310): past them a claim or a lease is not here. */
  capped?: Array<'claims' | 'leases'>
}

/** What Fabric holds of a session right now; null when it holds nothing (ended, or Fabric restarted since). */
export type SessionSign = (sessionId: string) => { lastSignAt: number | null } | null

function must<T>(r: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  if (r.error) throw new Error(`${what} could not be read: ${r.error.message}`)
  return r.data ?? []
}

/**
 * The runs Fabric launched for these tasks that still hold them — not proved stopped (CO-323). Read from the same
 * rows the claim projector reads (`task_runs`, `run_stop_commands`, `run_launch_compensations`) and judged by the
 * same rule (`unresolvedRuns`); a read that fails throws, so a task is never called free from a read that did not
 * happen.
 */
export async function readRunHolds(store: Store, taskIds: readonly string[]): Promise<RunHold[]> {
  if (!taskIds.length) return []
  const runs = await store.selectIn('task_runs', 'task_run_id,task_id,session_id,state,outcome,ended_seq,created_at', 'task_id', taskIds)
  if (runs.failed) throw new Error(`the task runs could not be read: ${runs.failed}`)
  const runIds = runs.rows.map((r) => r.task_run_id as string)
  const [stops, compensations] = await Promise.all([
    store.selectIn('run_stop_commands', 'task_run_id,session_id,state,reason', 'task_run_id', runIds),
    store.selectIn('run_launch_compensations', 'task_run_id,session_id,receipt_seq', 'task_run_id', runIds)
  ])
  for (const r of [stops, compensations]) if (r.failed) throw new Error(`the runs' stops could not be read: ${r.failed}`)
  return unresolvedRuns(runs.rows as unknown as RunRow[], stops.rows as unknown as StopRow[], compensations.rows as unknown as CompensationRow[])
}

const CLAIM_COLUMNS =
  'id,project_id,work_id,owner_session,agent,came_in,touches,claimed_at,expires_at,renewed_at,handover_requested_by,handover_requested_at,handover_note'

export async function readWork(store: Store, opts: { now: number; session: SessionSign; limit?: number; projectId?: string | null }): Promise<WorkSnapshot> {
  const limit = opts.limit ?? 200
  // One project's reading filters in the query, so its claims are never lost behind the estate's 200 oldest (CO-405).
  const claimsQuery = store.select('work_claims', CLAIM_COLUMNS).is('released_at', null)
  const leasesQuery = store.select('leases', 'work_id,project_id,owner_session,expires_at,write_scopes')
  const [claims, leases] = await Promise.all([
    (opts.projectId ? claimsQuery.eq('project_id', opts.projectId) : claimsQuery).order('claimed_at', { ascending: true }).limit(limit),
    (opts.projectId ? leasesQuery.eq('project_id', opts.projectId) : leasesQuery).limit(limit)
  ])
  const claimRows = must(claims, 'the claims') as unknown as Array<ClaimRow & { project_id: string }>
  const leaseRows = must(leases, 'the leases') as unknown as Array<{ work_id: string; project_id: string; owner_session: string; expires_at: string; write_scopes: string[] | null }>
  const claimed = new Set(claimRows.map((c) => c.work_id))
  const ids = [...new Set([...claimRows.map((c) => c.work_id), ...leaseRows.map((l) => l.work_id)])]
  // A lapsed lease no claim stands on is free — unless its task's run is not proved stopped (CO-323).
  const lapsed = leaseRows.filter((l) => !claimed.has(l.work_id) && Date.parse(l.expires_at) <= opts.now).map((l) => l.work_id)
  const runOf = new Map((await readRunHolds(store, lapsed)).map((h) => [h.taskId, h]))

  const [tasks, sources, from, to] = await Promise.all([
    store.selectIn('project_tasks', 'id,title,instruction,status', 'id', ids),
    store.selectIn('task_sources', 'task_id,repository,repo_path,path,row_id', 'task_id', ids),
    store.selectIn('task_links', 'task_id,rel,target_id,target_kind', 'task_id', ids),
    store.selectIn('task_links', 'task_id,rel,target_id,target_kind', 'target_id', ids)
  ])
  for (const r of [tasks, sources, from, to]) if (r.failed) throw new Error(`the board could not be read: ${r.failed}`)
  const taskOf = new Map(tasks.rows.map((t) => [t.id as string, {
    id: t.id as string,
    title: ((t.title as string | null) ?? (t.instruction as string | null) ?? '').slice(0, 200),
    status: t.status as string
  }]))
  const sourceOf = new Map(sources.rows.map((s) => [s.task_id as string, s as unknown as SourceRow]))
  const seen = new Set<string>()
  const edges: TaskEdge[] = []
  for (const e of [...from.rows, ...to.rows]) {
    if (e.target_kind !== 'task') continue
    const key = `${e.task_id}|${e.rel}|${e.target_id}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({ task_id: e.task_id as string, rel: e.rel as string, target_id: e.target_id as string })
  }
  const unknownTask = (id: string): { id: string; title: string; status: string } => ({ id, title: '', status: 'unknown' })
  // Related is judged within a project: two projects' claims never warn each other.
  const byProject = new Map<string, Array<ClaimRow & { project_id: string }>>()
  for (const c of claimRows) byProject.set(c.project_id, [...(byProject.get(c.project_id) ?? []), c])
  const related = new Map<string, Related[]>()
  for (const list of byProject.values()) for (const [k, v] of relatedPairs(list, sourceOf, edges)) related.set(k, v)

  return {
    claims: claimRows.map((c) => {
      const life = claimLife(c, opts.now, opts.session(c.owner_session))
      return {
        ...c,
        touches: c.touches ?? [],
        task: taskOf.get(c.work_id) ?? unknownTask(c.work_id),
        source: sourceOf.get(c.work_id) ?? null,
        life: life.life,
        last_sign_at: life.lastSignAt,
        related: related.get(c.id) ?? []
      }
    }),
    held: leaseRows
      .filter((l) => !claimed.has(l.work_id) && (Date.parse(l.expires_at) > opts.now || runOf.has(l.work_id)))
      .map((l) => ({
        project_id: l.project_id,
        task: taskOf.get(l.work_id) ?? unknownTask(l.work_id),
        owner_session: l.owner_session,
        expires_at: l.expires_at,
        write_scopes: l.write_scopes ?? [],
        run: Date.parse(l.expires_at) > opts.now ? null : runOf.get(l.work_id) ?? null
      })),
    readAt: new Date(opts.now).toISOString(),
    ...((): { capped?: Array<'claims' | 'leases'> } => {
      const capped = [...(claimRows.length >= limit ? ['claims' as const] : []), ...(leaseRows.length >= limit ? ['leases' as const] : [])]
      return capped.length ? { capped } : {}
    })()
  }
}
/** A session as the screens read it: what the surface holds (launched and enrolled) and the terminals running. */
export interface HeldSession {
  sessionId: string
  projectId: string | null
  agent: string | null
  cameIn: CameIn
  /** Fabric runs a terminal for it (a PTY); an enrolled or hub session has none (0.3.5 review UX-3). */
  console?: boolean
  /** The folder it works in, when Fabric knows it (its own terminals); an enrolled agent's folder is not shared. */
  folder?: string | null
  startedAt: number
  lastSignAt: number | null
}

export function sessionView(s: HeldSession, now: number): WorkSessionView {
  return {
    sessionId: s.sessionId,
    projectId: s.projectId,
    agent: s.agent,
    cameIn: s.cameIn,
    console: s.console === true,
    folder: s.folder ?? null,
    startedAt: new Date(s.startedAt).toISOString(),
    lastSignAt: s.lastSignAt ? new Date(s.lastSignAt).toISOString() : null,
    stale: sessionStale(s.lastSignAt, s.startedAt, now)
  }
}

/** The sessions Fabric holds a console for: a claim's «Open session» is offered only for one of these. */
export const consolesOf = (sessions: readonly HeldSession[]): ReadonlySet<string> => new Set(sessions.filter((s) => s.console === true).map((s) => s.sessionId))

export function claimView(c: ClaimView, titles: ReadonlyMap<string, string>, consoles: ReadonlySet<string> = new Set()): WorkClaimView {
  return {
    claimId: c.id,
    projectId: c.project_id,
    taskId: c.work_id,
    title: c.task.title,
    status: c.task.status,
    source: c.source ? { repository: c.source.repository, path: c.source.path, id: c.source.row_id } : null,
    sessionId: c.owner_session,
    agent: c.agent,
    cameIn: c.came_in,
    console: consoles.has(c.owner_session),
    touches: c.touches,
    since: c.claimed_at,
    until: c.expires_at,
    lastSignAt: c.last_sign_at,
    life: c.life,
    related: c.related.map((r) => ({ claimId: r.claimId, taskId: r.taskId, title: titles.get(r.taskId) ?? '', why: r.why }))
  }
}

/** SCR-31 «Who is working on what»: one project's claims, sessions and agent-sync leases. */
export async function readProjectWork(
  store: Store,
  opts: { now: number; session: SessionSign; sessions: HeldSession[]; leases: () => Promise<(LeaseRefsRead & { repository: string }) | null> }
): Promise<ProjectWorkView> {
  const [snap, refs] = await Promise.all([readWork(store, opts), opts.leases()])
  const titles = new Map(snap.claims.map((c) => [c.work_id, c.task.title]))
  const consoles = consolesOf(opts.sessions)
  return {
    claims: snap.claims.map((c) => claimView(c, titles, consoles)),
    held: snap.held.map((h) => ({ projectId: h.project_id, taskId: h.task.id, title: h.task.title, sessionId: h.owner_session, until: h.expires_at })),
    sessions: opts.sessions.map((s) => sessionView(s, opts.now)),
    leases: refs === null ? null : leasesView(refs),
    readAt: snap.readAt
  }
}

/** The screens' view of the lease read: null for a repository that does not use agent-sync (no block at all), and an
 *  unread list as its code alone — each window says it in its own language (0.3.5 review UX-5). */
export function leasesView(refs: LeaseRefsRead & { repository: string }): WorkLeasesView | null {
  if (refs.read) {
    // TR-7: an expired lease is not current; it is counted, not shown as one.
    const shown = currentLeases(refs)
    return { read: true, repository: refs.repository, readAt: refs.readAt, leases: shown.read ? shown.leases.map((l) => ({ key: l.key })) : [], truncated: refs.truncated, ...(shown.read && shown.expired ? { expired: shown.expired } : {}) }
  }
  return refs.code === 'not-used' ? null : { read: false, code: refs.code }
}

/** SCR-78 «Where work is»: every project's sessions, claims and review queue, from one estate-scoped reading. */
export async function readWhereWork(store: Store, opts: { now: number; session: SessionSign; sessions: HeldSession[]; projectId?: string | null }): Promise<WhereWorkView> {
  const [snap, projects, review] = await Promise.all([
    readWork(store, opts),
    store.select('projects', 'id,name').eq('status', 'active').order('name', { ascending: true }).limit(500),
    // A project's reading counts its own review only (CO-405), like its claims above.
    (opts.projectId ? store.select('project_tasks', 'project_id').eq('status', 'review').eq('project_id', opts.projectId) : store.select('project_tasks', 'project_id').eq('status', 'review')).limit(5000)
  ])
  if (projects.error) throw new Error(`the projects could not be read: ${projects.error.message}`)
  const counts = review.error ? null : new Map<string, number>()
  for (const r of (review.data ?? []) as Array<{ project_id: string }>) counts?.set(r.project_id, (counts.get(r.project_id) ?? 0) + 1)
  const titles = new Map(snap.claims.map((c) => [c.work_id, c.task.title]))
  const consoles = consolesOf(opts.sessions)
  const built = whereWorkRows({
    projects: (projects.data ?? []) as Array<{ id: string; name: string }>,
    sessions: opts.sessions.map((s) => sessionView(s, opts.now)),
    claims: snap.claims.map((c) => claimView(c, titles, consoles)),
    review: counts
  })
  const capped = [...(snap.capped ?? []), ...(((projects.data ?? []) as unknown[]).length >= 500 ? ['projects' as const] : [])]
  return { ...built, reviewUnread: review.error ? `the review queue could not be read: ${review.error.message}` : null, readAt: snap.readAt, ...(capped.length ? { capped } : {}) }
}

/** The home's one reading (operator request 2026-10-14): where work is, plus each session's own words (its last stage
 *  report), each claimed task's summary, the tasks in review and each project's latest journalled activity. A source
 *  that could not be read throws, as every read here does — the home never says "nobody is working" from a read that
 *  did not happen. */
export async function readHome(store: Store, opts: { now: number; session: SessionSign; sessions: HeldSession[]; projectId?: string | null; doneLimit?: number }): Promise<HomeView> {
  // «Закончили» shows the newest 20; the board pages beyond them (0.3.14), asking for more by this limit.
  const DONE = opts.doneLimit ?? 20
  const where = await readWhereWork(store, opts)
  // One project's board filters in the query, so its tasks are never lost behind the estate's caps (0.3.11 review DA-2).
  const tasks = (status: string, columns: string) => {
    const q = store.select('project_tasks', columns).eq('status', status)
    return opts.projectId ? q.eq('project_id', opts.projectId) : q
  }
  const [projects, stages, review, running, reviewIds, finished] = await Promise.all([
    store.select('projects', 'id,name').eq('status', 'active').limit(500),
    store.select('agent_stages', 'session_id,project_id,task_id,stage,step,of_steps,note,reported_at').order('reported_at', { ascending: false }).limit(500),
    // `moved_at` is when the task last changed column — for a task in review, when it was put there.
    tasks('review', 'id,project_id,title,brief_what,status,moved_at').order('moved_at', { ascending: false, nullsFirst: false }).limit(50),
    tasks('running', 'id,project_id,title,brief_what,brief_why,brief_expected,status,moved_at,started_at,session_id').limit(200),
    // Each project's own review count, beyond the newest 50 the list shows (0.3.6 review i2 ER-2).
    tasks('review', 'project_id').limit(5000),
    // The newest finished tasks for «Закончили» (the operator's walk OF-18).
    tasks('done', 'id,project_id,title,brief_what,status,moved_at').order('moved_at', { ascending: false, nullsFirst: false }).limit(DONE)
  ])
  const projectRows = must(projects as never, 'the projects') as Array<{ id: string; name: string }>
  const stageRows = must(stages as never, 'the stage reports') as StageRow[]
  const reviewRows = (must(review as never, 'the review queue') as Array<TaskBrief & { moved_at: string | null }>).map((t) => ({ ...t, updated_at: t.moved_at }))
  const runningRows = (must(running as never, 'the tasks in work') as Array<TaskBrief & { moved_at: string | null; started_at: string }>).map((t) => ({ ...t, updated_at: t.moved_at ?? t.started_at }))
  // «Закончили» is one lane: its read failing is said there, and the rest of the home still reads (0.3.11 review ER-7).
  const finishedError = (finished as { error?: { message?: string } | null }).error
  const doneRows = finishedError ? [] : ((finished as { data: unknown }).data as Array<TaskBrief & { moved_at: string | null }> ?? []).map((t) => ({ ...t, updated_at: t.moved_at }))
  const reviewProjectIds = (must(reviewIds as never, 'the review counts') as Array<{ project_id: string }>).map((r) => r.project_id)
  // CO-307: each project's newest journal event from `project_activity` (migration 124), one index probe per project,
  // instead of the estate's newest 3 000 events, past which a quiet project had no «Тихо уже».
  const lastActive = await store.selectIn('project_activity', 'project_id,last_occurred_at', 'project_id', projectRows.map((p) => p.id))
  if (lastActive.failed) throw new Error(`the projects' last activity could not be read: ${lastActive.failed}`)
  const activity = new Map<string, string | null>()
  for (const row of lastActive.rows as Array<{ project_id: string; last_occurred_at: string | null }>) activity.set(row.project_id, row.last_occurred_at)
  const claimIds = [...new Set(where.rows.flatMap((r) => r.claims.map((c) => c.taskId)))]
  // The brief's three parts, so «В работе» can say a task's spec is not gathered (ADR-0176 §1).
  const briefs = await store.selectIn('project_tasks', 'id,project_id,title,brief_what,brief_why,brief_expected,status', 'id', claimIds)
  if (briefs.failed) throw new Error(`the claimed tasks could not be read: ${briefs.failed}`)
  // CO-310: every read here that stopped at its limit is named, so «nobody» past it is never read as a fact.
  const capped = [...new Set([...(where.capped ?? []), ...(projectRows.length >= 500 ? ['projects' as const] : []), ...(stageRows.length >= 500 ? ['stages' as const] : [])])]
  const home = composeHome({ where, projects: projectRows, stages: stageRows, briefs: briefs.rows as unknown as TaskBrief[], reviewTasks: reviewRows, runningTasks: runningRows, doneTasks: doneRows, limits: { review: 50, running: 200, done: DONE }, reviewProjectIds, activity, now: new Date(opts.now).toISOString() })
  const read = capped.length ? { ...home, capped } : home
  return finishedError ? { ...read, doneUnread: `the finished tasks could not be read: ${finishedError.message ?? 'no reason given'}` } : read
}

/** The Board screen's kanban (OF-19, SCN-173): the home's own reading plus the queue, one read, so the two agree. */
export async function readTaskBoard(store: Store, opts: { now: number; session: SessionSign; sessions: HeldSession[]; projectId?: string | null; doneLimit?: number }): Promise<TaskBoardView> {
  const QUEUE = 100
  // «Отменено» (CO-401): the most recently cancelled tasks; fewer than the queue, since they are read only to look back.
  // By when they were cancelled, `moved_at` (task.closed@1 and the move set it), not by filing order: a task filed long
  // ago and cancelled today is the newest here, and the order agrees with the date each card shows (0.3.12 review DA-6).
  const CANCELLED = 50
  const columns = 'id,project_id,title,brief_what,brief_why,brief_expected,status,moved_at,started_at'
  const queue = store.select('project_tasks', columns).eq('status', 'backlog')
  const cancelled = store.select('project_tasks', columns).eq('status', 'cancelled')
  const [home, projects, queued, cancelledRead] = await Promise.all([
    readHome(store, opts),
    store.select('projects', 'id,name').eq('status', 'active').order('name', { ascending: true }).limit(500),
    // Newest filed first: a task never moved has no `moved_at`, and ordering by it dropped the newest at the cap (DA-7).
    (opts.projectId ? queue.eq('project_id', opts.projectId) : queue).order('seq', { ascending: false }).limit(QUEUE),
    (opts.projectId ? cancelled.eq('project_id', opts.projectId) : cancelled).order('moved_at', { ascending: false, nullsFirst: false }).order('seq', { ascending: false }).limit(CANCELLED)
  ])
  const projectRows = must(projects as never, 'the projects') as Array<{ id: string; name: string }>
  const withWhen = (rows: Array<TaskBrief & { moved_at: string | null; started_at: string | null }>) => rows.map((t) => ({ ...t, updated_at: t.moved_at ?? t.started_at }))
  const queuedRows = withWhen(must(queued as never, 'the queue') as Array<TaskBrief & { moved_at: string | null; started_at: string | null }>)
  // A failed read of the cancelled tasks is said in their column; the four columns still stand.
  const { data: cancelledRows, error: cancelledError } = cancelledRead as { data: Array<TaskBrief & { moved_at: string | null; started_at: string | null }> | null; error: { message: string } | null }
  return composeTaskBoard({
    home, queued: queuedRows, projects: projectRows, queuedLimit: QUEUE,
    cancelled: cancelledError ? { unread: cancelledError.message } : { rows: withWhen(cancelledRows ?? []), limit: CANCELLED }
  })
}
const SESSION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SESSION_TASK_COLUMNS = 'id,project_id,title,brief_what,brief_why,brief_expected,status,started_at'

/**
 * One agent session's tasks, newest first (0.3.14, `shared/sessionTasks.ts`): its claims, live and released (indexed by
 * `owner_session`, migration 95), and the tasks Fabric launched in it (`project_tasks.session_id`), joined to each
 * task's brief and project. Every read's error THROWS, so the agent page never says "no task" from a read that did
 * not happen. Claims are read twice the page's limit, so a task claimed again and again does not push the rest out.
 */
export async function readSessionTasks(store: Store, sessionId: unknown): Promise<SessionTasksView> {
  if (typeof sessionId !== 'string' || !SESSION_UUID.test(sessionId)) throw new Error('Invalid session identity')
  const CLAIMS = SESSION_TASKS_LIMIT * 2
  const [claims, launched, attached] = await Promise.all([
    store.select('work_claims', 'work_id,project_id,claimed_at,released_at,released_how').eq('owner_session', sessionId).order('claimed_at', { ascending: false }).limit(CLAIMS),
    store.select('project_tasks', SESSION_TASK_COLUMNS).eq('session_id', sessionId).order('started_at', { ascending: false }).limit(SESSION_TASKS_LIMIT),
    // The 0.3.14 review, iteration 1, DA-5: a launched task is dated by when Fabric attached it to this session, not by
    // when the task was created (indexed by `journal_by_session_id`, migration 116).
    store.select('journal', 'occurred_at,payload').eq('payload->>session_id', sessionId).eq('type', 'task.session.attached@1').order('seq', { ascending: false }).limit(SESSION_TASKS_LIMIT)
  ])
  const attachedAt: Record<string, string> = {}
  for (const e of must(attached as never, "the session's launches") as Array<{ occurred_at: string; payload: { id?: unknown } | null }>)
    if (typeof e.payload?.id === 'string' && !attachedAt[e.payload.id]) attachedAt[e.payload.id] = e.occurred_at
  const claimRows = must(claims as never, "the session's claims") as SessionClaimRow[]
  const launchedRows = must(launched as never, "the session's launched tasks") as SessionTaskRow[]
  const launchedIds = new Set(launchedRows.map((t) => t.id))
  const ids = [...new Set(claimRows.map((c) => c.work_id))].filter((id) => !launchedIds.has(id))
  const tasks = await store.selectIn('project_tasks', SESSION_TASK_COLUMNS, 'id', ids)
  if (tasks.failed) throw new Error(`the session's tasks could not be read: ${tasks.failed}`)
  const projectIds = [...new Set([...claimRows.map((c) => c.project_id), ...launchedRows.map((t) => t.project_id)])]
  const projects = await store.selectIn('projects', 'id,name', 'id', projectIds)
  if (projects.failed) throw new Error(`the session's projects could not be read: ${projects.failed}`)
  return composeSessionTasks({
    claims: claimRows,
    launched: launchedRows,
    tasks: tasks.rows as unknown as SessionTaskRow[],
    projects: projects.rows as unknown as Array<{ id: string; name: string }>,
    attachedAt,
    readCapped: claimRows.length >= CLAIMS || launchedRows.length >= SESSION_TASKS_LIMIT
  })
}
// #endregion work-read
