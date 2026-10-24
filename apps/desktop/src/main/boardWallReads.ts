// #region business-wall-reads — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
/**
 * The two reads the wall between businesses takes (W2-5; `boardService.ts`, region `business-wall-check`), through the
 * service client. Each throws with the reason it could not answer, so the wall says that reason in the operations log
 * before it lets the post through (0.3.12 review i2 ER-3, ER-4; W2-5: a read that fails walls nothing and is logged).
 *
 * - The estate's Projects, archived ones included (DA-4: an archived Project's business still applies to a thread it
 *   takes part in), paged by `id` above the last one read, not by offset (DA-3: a Project created mid-read neither
 *   pushes another past a page nor is read twice).
 * - An existing thread's participants, through the operator's thread page filtered to the reader's threads, newest
 *   first, at most 50 pages of 100; a signal stops the paging between pages (ER-4: the wall's own deadline).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProjectFact } from './boardService.ts'

/** Past this many Projects the wall reads no further: the read throws rather than walling from part of the estate. */
export const WALL_PROJECTS_MAX = 20_000
const PAGE = 1000

export async function readProjectFacts(db: SupabaseClient, estateId: string, signal?: AbortSignal): Promise<ProjectFact[]> {
  const rows: Array<{ id: string; name: string; business: string | null; repo_path: string | null; status: string | null }> = []
  let after: string | null = null
  for (;;) {
    if (signal?.aborted) throw new Error('the projects read was stopped by the wall\'s deadline')
    const base = db.from('projects').select('id,name,business,repo_path,status').eq('estate_id', estateId)
    const ranged = (after === null ? base : base.gt('id', after)).order('id', { ascending: true }).limit(PAGE)
    const { data, error } = await (signal ? ranged.abortSignal(signal) : ranged)
    if (error) throw new Error(`the projects could not be read: ${error.message}`)
    if (!Array.isArray(data)) throw new Error('the projects read answered no list')
    if (data.length === 0) break
    const page = data as typeof rows
    const last = page[page.length - 1].id
    if (after !== null && !(last > after)) throw new Error(`the projects read did not move past ${after}`)
    rows.push(...page)
    after = last
    if (rows.length > WALL_PROJECTS_MAX) throw new Error(`the estate holds more than ${WALL_PROJECTS_MAX} Projects; the wall reads no further`)
  }
  return rows.map((p) => ({ id: p.id, name: p.name, business: p.business ?? null, repo: p.repo_path ?? null, archived: p.status === 'archived' }))
}

/** At most this many pages of the reader's threads are searched for the thread (100 a page). */
export const WALL_THREAD_PAGES = 50

export async function readThreadParticipants(db: SupabaseClient, estateId: string, reader: string, threadId: string, signal?: AbortSignal): Promise<string[]> {
  let before: unknown = null
  for (let page = 0; page < WALL_THREAD_PAGES; page++) {
    if (signal?.aborted) throw new Error(`the thread's participants were not found before the wall's deadline (${page} pages read)`)
    const call = db.rpc('board_thread_page_operator', { p_estate: estateId, p_filter: { project: reader }, p_before: before, p_limit: 100 })
    const { data, error } = await (signal ? call.abortSignal(signal) : call)
    const answer = data as { ok?: unknown; threads?: Array<{ id?: unknown; participants?: unknown }>; more?: unknown; before?: unknown } | null
    if (error) throw new Error(`the reader's threads could not be read: ${error.message}`)
    if (!answer || answer.ok !== true || !Array.isArray(answer.threads)) throw new Error('the reader\'s threads read gave no page')
    const hit = answer.threads.find((t) => t.id === threadId)
    if (hit) {
      if (!Array.isArray(hit.participants)) throw new Error('the thread was found without its participants')
      return hit.participants as string[]
    }
    if (answer.more !== true) throw new Error('the thread is not among the reader\'s threads')
    before = answer.before
  }
  throw new Error(`the thread is not among the reader's newest ${WALL_THREAD_PAGES * 100} threads`)
}
// #endregion business-wall-reads
