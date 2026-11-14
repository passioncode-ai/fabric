// #region board-search-read — docs: docs/evidence/specs/2026-11-14-board-search.md#3-what-is-read
/**
 * `fabric_board_search`'s reads and answer (the operator, 2026-11-14: «хочу чтобы агенты делали раг поиск по доске когда
 * ищут связи кто чем занят»). One project's board, as its session may see it:
 *
 *   tasks      every task of the project moved in the window (closed ones on asking), with who holds it now (a live
 *              claim) or held it last (a released claim), at most TASK_ROWS
 *   notes      the task notes written in the window, at most NOTE_ROWS
 *   board      the board messages the project takes part in, through its own reader door (`com.list` with `since`):
 *              the window, else the last 7 days, else the last day, at most BOARD_PAGES pages of 100 each, newest kept
 *   projects   the board's directory: every other project's name and the capabilities it takes requests for
 *
 * Other projects' tasks are not read: the session sees its own project only (scope.one-project), and their work shows
 * here only as board messages its project takes part in and as their capabilities. Every read stands alone: one that
 * fails is named in `degraded` and the others still answer; a read stopped at its bound is named in `capped`. When
 * every read failed the answer says so and finds nothing, never "nothing matches".
 */
import { rankDocs, type SearchDoc, type SearchKind } from '../shared/boardSearch.ts'
import type { ClaimView } from './workRead.ts'

export const TASK_ROWS = 500
export const NOTE_ROWS = 1000
export const CLAIM_ROWS = 1000
export const BOARD_PAGES = 5
export const BOARD_PAGE = 100
export const DEFAULT_DAYS = 30
export const MAX_DAYS = 90
export const SEARCH_KINDS = ['tasks', 'notes', 'board', 'projects'] as const
export type SearchPart = (typeof SEARCH_KINDS)[number]

type Row = Record<string, unknown>
type Read = { rows: Row[]; failed: string | null; capped?: boolean }

export interface BoardSearchDeps {
  projectId: string
  sessionId: string
  now(): number
  /** Tasks of the project, `days` back by their last move; closed ones when asked. */
  tasks(sinceIso: string, includeClosed: boolean, limit: number): Promise<Read>
  /** Live claims of the project, as `fabric_work_list` reads them. Throws when the claims cannot be read. */
  liveClaims(): Promise<ClaimView[]>
  /** Released claims of the project since then, newest first. */
  releasedClaims(sinceIso: string, limit: number): Promise<Read>
  notes(sinceIso: string, limit: number): Promise<Read>
  /** `com.list` through the session's own reader door: a page, or a refusal `{error: {code, message}}`. */
  boardList?(args: { since: string; limit: number; cursor?: string }): Promise<Row>
  /** `com.directory`: a page of projects, or a refusal. */
  boardDirectory?(args: { limit: number; cursor?: string }): Promise<Row>
}

export interface BoardSearchInput {
  query: string
  kinds?: readonly SearchPart[]
  limit?: number
  days?: number
  includeClosed?: boolean
}

type Doc = SearchDoc & { ref: Record<string, unknown>; holder: string | null }

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const short = (id: string) => id.slice(0, 8)
const failedOf = (e: unknown) => (e instanceof Error ? e.message : String(e))

async function stand(part: string, read: () => Promise<Read>, degraded: Array<{ part: string; reason: string }>): Promise<Row[]> {
  try {
    const r = await read()
    if (r.failed) { degraded.push({ part, reason: r.failed }); return [] }
    return r.rows
  } catch (e) {
    // Not silent: the failed part is named in the answer's degraded, which the agent reads; the others still answer.
    degraded.push({ part, reason: failedOf(e) })
    return []
  }
}

/** The board's messages in a window, newest kept: the asked window, else 7 days, else 1, each read whole or not used. */
async function readBoard(deps: BoardSearchDeps, days: number, degraded: Array<{ part: string; reason: string }>, capped: string[]):
  Promise<{ rows: Row[]; windowDays: number | null }> {
  if (!deps.boardList) { degraded.push({ part: 'board', reason: 'this session has no board' }); return { rows: [], windowDays: null } }
  const windows = [...new Set([days, Math.min(days, 7), 1])]
  let last: Row[] = []
  for (const w of windows) {
    const since = new Date(deps.now() - w * 86_400_000).toISOString()
    const rows: Row[] = []
    let cursor: string | undefined
    let whole = false
    try {
      for (let page = 0; page < BOARD_PAGES; page++) {
        const r = await deps.boardList({ since, limit: BOARD_PAGE, ...(cursor ? { cursor } : {}) })
        const err = r.error as { code?: string; message?: string } | undefined
        if (err) { degraded.push({ part: 'board', reason: `${err.code ?? 'refused'}: ${err.message ?? ''}`.trim() }); return { rows: [], windowDays: null } }
        rows.push(...((r.messages as Row[] | undefined) ?? []))
        cursor = typeof r.cursor === 'string' ? r.cursor : undefined
        if (!cursor) { whole = true; break }
      }
    } catch (e) {
      // Not silent: the failed part is named in the answer's degraded, which the agent reads; the others still answer.
      degraded.push({ part: 'board', reason: failedOf(e) })
      return { rows: [], windowDays: null }
    }
    if (whole) return { rows, windowDays: w }
    last = rows
  }
  // Even the last day did not fit: its oldest pages are kept, and the read says it stopped.
  capped.push('board')
  return { rows: last, windowDays: 1 }
}

async function readDirectory(deps: BoardSearchDeps, degraded: Array<{ part: string; reason: string }>, capped: string[]): Promise<Row[]> {
  if (!deps.boardDirectory) return []
  const out: Row[] = []
  let cursor: string | undefined
  try {
    for (let page = 0; page < 5; page++) {
      const r = await deps.boardDirectory({ limit: 100, ...(cursor ? { cursor } : {}) })
      const err = r.error as { code?: string; message?: string } | undefined
      if (err) { degraded.push({ part: 'projects', reason: `${err.code ?? 'refused'}: ${err.message ?? ''}`.trim() }); return out }
      out.push(...((r.projects as Row[] | undefined) ?? []))
      cursor = typeof r.cursor === 'string' ? r.cursor : undefined
      if (!cursor) return out
    }
    capped.push('projects')
  } catch (e) {
    // Not silent: the failed part is named in the answer's degraded, which the agent reads; the others still answer.
    degraded.push({ part: 'projects', reason: failedOf(e) })
  }
  return out
}

export async function searchBoard(input: BoardSearchInput, deps: BoardSearchDeps): Promise<Record<string, unknown>> {
  const now = deps.now()
  const days = Math.min(MAX_DAYS, Math.max(1, Math.round(input.days ?? DEFAULT_DAYS)))
  const sinceIso = new Date(now - days * 86_400_000).toISOString()
  const want = new Set<SearchPart>(input.kinds?.length ? input.kinds : SEARCH_KINDS)
  const degraded: Array<{ part: string; reason: string }> = []
  const capped: string[] = []

  const none = async (): Promise<Read> => ({ rows: [], failed: null })
  const [taskRows, released, noteRows, board, directory] = await Promise.all([
    want.has('tasks') || want.has('notes') ? stand('tasks', async () => {
      const r = await deps.tasks(sinceIso, input.includeClosed ?? true, TASK_ROWS)
      if (!r.failed && r.rows.length >= TASK_ROWS) capped.push('tasks')
      return r
    }, degraded) : stand('tasks', none, degraded),
    want.has('tasks') ? stand('released claims', () => deps.releasedClaims(sinceIso, CLAIM_ROWS), degraded) : [],
    want.has('notes') ? stand('notes', async () => {
      const r = await deps.notes(sinceIso, NOTE_ROWS)
      if (!r.failed && r.rows.length >= NOTE_ROWS) capped.push('notes')
      return r
    }, degraded) : [],
    want.has('board') ? readBoard(deps, days, degraded, capped) : Promise.resolve({ rows: [] as Row[], windowDays: null }),
    want.has('projects') ? readDirectory(deps, degraded, capped) : Promise.resolve([] as Row[])
  ])
  let live: ClaimView[] = []
  if (want.has('tasks')) {
    try { live = await deps.liveClaims() } catch (e) {
      // Not silent: the failed part is named in the answer's degraded, which the agent reads; the others still answer.
      degraded.push({ part: 'claims', reason: failedOf(e) })
    }
  }

  const names = new Map<string, string>(directory.map((p) => [str(p.id), str(p.name)]))
  const projectName = (id: string) => (id === deps.projectId ? 'this project' : names.get(id) ?? `project ${short(id)}`)
  const holderOf = new Map(live.map((c) => [c.work_id, c]))
  const lastHolder = new Map<string, Row>()
  for (const r of released) if (!lastHolder.has(str(r.work_id))) lastHolder.set(str(r.work_id), r)
  const titleOf = new Map(taskRows.map((t) => [str(t.id), str(t.title) || str(t.instruction).slice(0, 200)]))

  const docs: Doc[] = []
  if (want.has('tasks')) for (const t of taskRows) {
    const id = str(t.id), held = holderOf.get(id), last = lastHolder.get(id)
    const agentOf = (session: string, agent: unknown) => `session ${short(session)}${str(agent) ? ` (${str(agent)})` : ''}`
    docs.push({
      id: `task:${id}`, kind: 'task', title: titleOf.get(id) ?? '',
      text: [t.instruction, t.brief_what, t.brief_why, t.brief_expected, ...(held?.touches ?? [])].map(str).filter(Boolean).join(' · '),
      at: str(t.moved_at) || str(t.started_at) || null,
      live: Boolean(held),
      holder: held ? agentOf(held.owner_session, held.agent) : null,
      ref: {
        task: { id, title: titleOf.get(id), status: str(t.status) },
        held_by: held ? { session_id: held.owner_session, is_you: held.owner_session === deps.sessionId, agent: held.agent, came_in: held.came_in,
          since: held.claimed_at, life: held.life, touches: held.touches } : null,
        last_held_by: !held && last ? { session_id: str(last.owner_session), agent: last.agent ?? null, released: str(last.released_how), at: str(last.released_at) } : null
      }
    })
  }
  if (want.has('notes')) for (const n of noteRows) {
    const taskId = str(n.task_id)
    docs.push({
      id: `note:${str(n.id) || `${taskId}:${str(n.created_at)}`}`, kind: 'note', title: titleOf.get(taskId) ?? '', text: str(n.body_md),
      at: str(n.created_at) || null, holder: null,
      ref: { task: { id: taskId, title: titleOf.get(taskId) ?? null }, author: str(n.author_kind) === 'person' ? 'the operator' : str(n.author_kind), at: str(n.created_at) }
    })
  }
  for (const m of board.rows) {
    const req = m.request as Row | undefined, sender = (m.sender as Row | undefined)?.project
    const body = str((m.body as Row | undefined)?.text)
    const open = req ? ['queued', 'claimed', 'accepted', 'in_progress', 'outcome_unknown'].includes(str(req.state)) : false
    const target = req ? str(req.target) : ''
    docs.push({
      id: `message:${str(m.id)}`, kind: (req ? 'request' : 'message') as SearchKind,
      title: req ? `${str(req.capability)} → ${projectName(target)}` : `${str(m.kind)} from ${projectName(str(sender))}`,
      text: body, at: str(m.at) || null, live: open, holder: req ? projectName(target) : null,
      ref: {
        message_id: str(m.id), thread: str(m.thread), kind: str(m.kind), from: projectName(str(sender)), at: str(m.at),
        ...(req ? { request: { id: str(req.id), target: projectName(target), target_id: target, capability: str(req.capability), state: str(req.state) } } : {})
      }
    })
  }
  for (const p of directory) {
    const caps = ((p.capabilities as Row[] | undefined) ?? []).map((c) => (typeof c === 'string' ? c : str(c.name)))
    docs.push({
      id: `project:${str(p.id)}`, kind: 'project', title: str(p.name), text: caps.join(' '), at: null, holder: str(p.name),
      ref: { project: { id: str(p.id), name: str(p.name), capabilities: caps } }
    })
  }

  const allFailed = [...want].every((p) => degraded.some((d) => d.part === p))
  const hits = rankDocs(input.query, docs, { now, limit: Math.min(30, Math.max(1, input.limit ?? 10)) })
  const who = new Map<string, { holder: string; live: boolean; hits: string[] }>()
  for (const h of hits) {
    if (!h.doc.holder) continue
    const w = who.get(h.doc.holder) ?? { holder: h.doc.holder, live: false, hits: [] }
    w.live ||= Boolean(h.doc.live)
    w.hits.push(h.doc.id)
    who.set(h.doc.holder, w)
  }
  return {
    query: input.query,
    method: 'lexical: Russian and English word forms and ids, ranked by BM25 with recency and live work raised; no model reads your query',
    hits: hits.map((h) => ({ kind: h.doc.kind, id: h.doc.id, score: h.score, matched: h.matched, snippet: h.snippet, ...h.doc.ref })),
    who: [...who.values()],
    read: { tasks: taskRows.length, notes: noteRows.length, messages: board.rows.length, projects: directory.length, window_days: days,
      ...(board.windowDays !== null && board.windowDays !== days ? { board_window_days: board.windowDays } : {}) },
    ...(capped.length ? { capped } : {}),
    ...(degraded.length ? { degraded } : {}),
    note: allFailed
      ? 'Nothing could be read, so nothing was searched: this is not "nothing matches". Read fabric_work_list, or try again.'
      : hits.length === 0
        ? 'Nothing read matches. That means these words were not found, not that nobody works on it: try other words, in both Russian and English, or a wider days.'
        : 'Only this project\'s tasks are read; other projects show as board messages your project takes part in and as their capabilities. Ask one with com.submit.'
  }
}
// #endregion board-search-read
