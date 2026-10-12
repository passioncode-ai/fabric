// #region work-read — docs: docs/ux/scenarios.md#scn-141-see-where-work-is-across-every-project--sessions-claims-review-and-sessions-with-no-project
/**
 * One reading of the claims in a scope — a project (an agent's `fabric_work_list`, the project page's «Who is
 * working on what») or the whole estate (SCR-78 «Where work is») — from the journal's projections only: live
 * `work_claims`, the `leases` they stand on, the tasks, their backlog links and their links to each other. Every
 * read's error is read: a projection that could not be read THROWS, so no caller can answer "nobody is working here"
 * from a read that did not happen (M108, IMP-04).
 */
import type { createScopedStore } from './scopedStore.ts'
import type { LeaseRefsRead } from './agentSyncLeases.ts'
import {
  claimLife,
  relatedPairs,
  sessionStale,
  whereWorkRows,
  type CameIn,
  type ProjectWorkView,
  type WhereWorkView,
  type WorkClaimView,
  type WorkLeasesView,
  type WorkSessionView,
  type ClaimLife,
  type ClaimRow,
  type Related,
  type SourceRow,
  type TaskEdge
} from '../shared/workClaims.ts'

type Store = ReturnType<typeof createScopedStore>

export interface ClaimView extends ClaimRow {
  project_id: string
  task: { id: string; title: string; status: string }
  source: SourceRow | null
  life: ClaimLife
  last_sign_at: string
  related: Related[]
}

/** A lease no claim stands on: a session's own task held by its managed launch (migration 61). */
export interface HeldView {
  project_id: string
  task: { id: string; title: string; status: string }
  owner_session: string
  expires_at: string
  write_scopes: string[]
}

export interface WorkSnapshot {
  claims: ClaimView[]
  held: HeldView[]
  readAt: string
}

/** What Fabric holds of a session right now; null when it holds nothing (ended, or Fabric restarted since). */
export type SessionSign = (sessionId: string) => { lastSignAt: number | null } | null

function must<T>(r: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  if (r.error) throw new Error(`${what} could not be read: ${r.error.message}`)
  return r.data ?? []
}

const CLAIM_COLUMNS =
  'id,project_id,work_id,owner_session,agent,came_in,touches,claimed_at,expires_at,renewed_at,handover_requested_by,handover_requested_at,handover_note'

export async function readWork(store: Store, opts: { now: number; session: SessionSign; limit?: number }): Promise<WorkSnapshot> {
  const limit = opts.limit ?? 200
  const [claims, leases] = await Promise.all([
    store.select('work_claims', CLAIM_COLUMNS).is('released_at', null).order('claimed_at', { ascending: true }).limit(limit),
    store.select('leases', 'work_id,project_id,owner_session,expires_at,write_scopes').limit(limit)
  ])
  const claimRows = must(claims, 'the claims') as unknown as Array<ClaimRow & { project_id: string }>
  const leaseRows = must(leases, 'the leases') as unknown as Array<{ work_id: string; project_id: string; owner_session: string; expires_at: string; write_scopes: string[] | null }>
  const claimed = new Set(claimRows.map((c) => c.work_id))
  const ids = [...new Set([...claimRows.map((c) => c.work_id), ...leaseRows.map((l) => l.work_id)])]

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
      .filter((l) => !claimed.has(l.work_id) && Date.parse(l.expires_at) > opts.now)
      .map((l) => ({
        project_id: l.project_id,
        task: taskOf.get(l.work_id) ?? unknownTask(l.work_id),
        owner_session: l.owner_session,
        expires_at: l.expires_at,
        write_scopes: l.write_scopes ?? []
      })),
    readAt: new Date(opts.now).toISOString()
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
  if (refs.read) return { read: true, repository: refs.repository, readAt: refs.readAt, leases: refs.leases.map((l) => ({ key: l.key })), truncated: refs.truncated }
  return refs.code === 'not-used' ? null : { read: false, code: refs.code }
}

/** SCR-78 «Where work is»: every project's sessions, claims and review queue, from one estate-scoped reading. */
export async function readWhereWork(store: Store, opts: { now: number; session: SessionSign; sessions: HeldSession[] }): Promise<WhereWorkView> {
  const [snap, projects, review] = await Promise.all([
    readWork(store, opts),
    store.select('projects', 'id,name').eq('status', 'active').order('name', { ascending: true }).limit(500),
    store.select('project_tasks', 'project_id').eq('status', 'review').limit(5000)
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
  return { ...built, reviewUnread: review.error ? `the review queue could not be read: ${review.error.message}` : null, readAt: snap.readAt }
}
// #endregion work-read
