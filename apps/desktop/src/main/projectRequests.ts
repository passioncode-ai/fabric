// #region project-requests-read — docs: docs/ux/scenarios.md#scn-181-see-a-projects-work-by-where-it-came-from-and-where-it-goes
/**
 * One project's board requests, both ways (SCN-181, CO-543): the requests other projects addressed to it and the ones
 * it sent, for the project page's «От других проектов» and «В другие проекты». Read through the same door as the home's
 * waiting list (`commsWaitingList.ts`): the journal's `comms.message_submitted@1` requests of the last `WINDOW_DAYS`,
 * each way newest first and at most `REQUEST_ROWS`, then their transitions (`comms.request_transitioned@1`, by request
 * id) for the newest state, then the other projects' names. A read that fails REJECTS: the page then says the request
 * rows could not be read and keeps the task rows, never «no requests».
 */
import type { ProjectRequest, ProjectRequestsView } from '../shared/workDirections.ts'
export type { ProjectRequestsView }

/** How far back a project's requests are read: the board's seven-day deadline, with room for a longer one. */
export const WINDOW_DAYS = 30
/** How many requests each way are read. */
export const REQUEST_ROWS = 200

type Rows = { rows: Array<Record<string, unknown>>; failed: string | null }
interface Query {
  eq(c: string, v: string): Query
  gte(c: string, v: string): Query
  order(c: string, o: { ascending: boolean }): Query
  limit(n: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}
export interface ProjectRequestsDeps {
  select(table: string, columns: string): unknown
  selectIn(table: string, columns: string, key: string, values: string[], chunk?: number, signal?: AbortSignal, eq?: ReadonlyArray<readonly [string, string]>): Promise<Rows>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export async function readProjectRequests(store: ProjectRequestsDeps, projectId: unknown, now: number): Promise<ProjectRequestsView> {
  if (typeof projectId !== 'string' || !UUID.test(projectId)) throw new Error('Invalid project identity')
  const since = new Date(now - WINDOW_DAYS * 24 * 3600_000).toISOString()
  const submitted = (column: string) =>
    (store.select('journal', 'seq,occurred_at,payload') as Query)
      .eq('type', 'comms.message_submitted@1').eq('payload->>kind', 'request').eq(column, projectId)
      .gte('occurred_at', since).order('seq', { ascending: false }).limit(REQUEST_ROWS)
  const [incoming, outgoing] = await Promise.all([submitted('payload->request->>target_project_id'), submitted('payload->>sender_project_id')])
  if (incoming.error) throw new Error(`the requests to this project could not be read: ${incoming.error.message}`)
  if (outgoing.error) throw new Error(`the requests this project sent could not be read: ${outgoing.error.message}`)
  const rows = [...(incoming.data ?? []), ...(outgoing.data ?? [])] as Array<{ occurred_at: string; payload: Record<string, unknown> | null }>
  const seen = new Set<string>()
  const base: ProjectRequest[] = []
  for (const s of rows) {
    const p = s.payload ?? {}
    const req = (p.request ?? null) as Record<string, unknown> | null
    const id = str(p.message_id)
    const thread = str(p.thread_id)
    const to = str(req?.target_project_id)
    const capability = str(req?.capability)
    if (!req || !id || !thread || !to || !capability || seen.has(id)) continue
    seen.add(id)
    const subject = str((p.thread_new as Record<string, unknown> | null | undefined)?.subject)
    base.push({ requestId: id, threadId: thread, from: str(p.sender_project_id), to, capability, subject, state: null, at: s.occurred_at, changedAt: null })
  }
  const transitions = await store.selectIn('journal', 'seq,occurred_at,payload', 'payload->>request_id', base.map((r) => r.requestId), 100, undefined, [['type', 'comms.request_transitioned@1']])
  if (transitions.failed) throw new Error(`the requests' states could not be read: ${transitions.failed}`)
  const latest = new Map<string, { seq: number; to: string; at: string | null }>()
  for (const t of transitions.rows) {
    const p = (t.payload ?? {}) as Record<string, unknown>
    const id = str(p.request_id)
    const to = str(p.to)
    const seq = typeof t.seq === 'number' ? t.seq : Number(t.seq)
    if (!id || !to || !Number.isFinite(seq)) continue
    const prev = latest.get(id)
    if (!prev || prev.seq < seq) latest.set(id, { seq, to, at: str(t.occurred_at) })
  }
  const requests = base.map((r) => {
    const l = latest.get(r.requestId)
    return l ? { ...r, state: l.to, changedAt: l.at } : r
  })
  const others = [...new Set(requests.map((r) => (r.to === projectId ? r.from : r.to)).filter((x): x is string => !!x && x !== projectId))]
  const projects = await store.selectIn('projects', 'id,name', 'id', others)
  if (projects.failed) throw new Error(`the other projects' names could not be read: ${projects.failed}`)
  const names: Record<string, string> = {}
  for (const p of projects.rows) if (typeof p.id === 'string' && typeof p.name === 'string') names[p.id] = p.name
  return {
    requests,
    names,
    capped: (incoming.data ?? []).length >= REQUEST_ROWS || (outgoing.data ?? []).length >= REQUEST_ROWS,
    windowDays: WINDOW_DAYS
  }
}

/** One project's backlog rows (`task_sources`), at most `SOURCE_ROWS`; a read that fails rejects. */
export const SOURCE_ROWS = 1000
export async function readProjectSources(store: ProjectRequestsDeps, projectId: unknown): Promise<{ sources: Array<{ task_id: string; path: string; row_id: string }>; capped: boolean }> {
  if (typeof projectId !== 'string' || !UUID.test(projectId)) throw new Error('Invalid project identity')
  const r = await (store.select('task_sources', 'task_id,path,row_id') as Query).eq('project_id', projectId).order('linked_seq', { ascending: false }).limit(SOURCE_ROWS)
  if (r.error) throw new Error(`the project's backlog rows could not be read: ${r.error.message}`)
  const sources = ((r.data ?? []) as Array<Record<string, unknown>>)
    .filter((s) => typeof s.task_id === 'string' && typeof s.path === 'string' && typeof s.row_id === 'string')
    .map((s) => ({ task_id: s.task_id as string, path: s.path as string, row_id: s.row_id as string }))
  return { sources, capped: (r.data ?? []).length >= SOURCE_ROWS }
}
// #endregion project-requests-read
