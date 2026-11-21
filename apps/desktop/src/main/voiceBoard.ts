// #region voice-board — docs: docs/ux/scenarios.md#scn-191-the-ceos-voice-reads-the-board-itself
/**
 * The CEO's voice reads Fabric's board itself (the owner, 2026-11-21, ~02:10: «чтобы у голосового агента был прямой
 * доступ к доске Fabric. Не дёргать CEO-сессии, а сразу отвечать на вопросы про задачи с доски: последние проекты,
 * навигация по графу задач, статусы»). Read-only: nothing here writes; a change on the board still goes to the CEO.
 *
 *   board_projects  the newest projects, with when each was added (the owner's time zone)
 *   board_tasks     a project's tasks: status, who holds each, what waits for the owner
 *   board_task      one task and its graph: its goal, what it grew from and into, what it blocks and follows
 *
 * Every read can fail; a failed read is said as unread, never as an empty board.
 */
import { findProject } from '../shared/ceoAgent.ts'
import { isCeoAddress } from '../shared/ceoAddress.ts'

export interface BoardProject { id: string; name: string; created_at: string; repo_path: string | null }
export interface BoardTask { id: string; project_id: string; title: string | null; instruction: string | null; status: string; goal_id: string | null; started_at: string | null; finished_at: string | null; assigned_to?: string | null }
export interface BoardLink { task_id: string; rel: string; target_kind: string; target_id: string }
export interface BoardClaim { work_id: string; agent: string | null; owner_session: string; claimed_at: string }

/** The reads, each bounded by the host. */
export interface BoardReads {
  projects(): Promise<BoardProject[]>
  tasks(projectId: string): Promise<BoardTask[]>
  tasksByIds(ids: readonly string[]): Promise<BoardTask[]>
  linksFrom(taskIds: readonly string[]): Promise<BoardLink[]>
  linksTo(taskId: string): Promise<BoardLink[]>
  claims(taskIds: readonly string[]): Promise<BoardClaim[]>
  goals(ids: readonly string[]): Promise<Array<{ id: string; title: string }>>
}

const CLOSED = new Set(['done', 'cancelled', 'finished', 'abandoned'])
const GOAL_HOPS = 10
const TASKS_SAID = 25
/** The newest tasks of a project the host reads at most (`main/index.ts`, region voice-board-reads); counts past it are capped. */
export const TASKS_READ = 200
/** Said first: what runs, then what waits for the owner, then the rest (0.3.27 review UX-66). */
const STATUS_ORDER: Record<string, number> = { running: 0, review: 1, backlog: 2 }

export const VOICE_BOARD_TOOLS = [
  {
    type: 'function' as const,
    name: 'board_projects',
    description: 'The newest projects on Fabric\'s board, newest first, each with the date and time it was added. Read it yourself when the owner asks what projects are new or recent; do not ask the CEO.',
    parameters: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 20, description: 'How many; 5 by default.' } }, additionalProperties: false }
  },
  {
    type: 'function' as const,
    name: 'board_tasks',
    description: 'A project\'s tasks on Fabric\'s board: each with its status (backlog, running, review, done), who holds it now, and what waits for the owner (review). Read it yourself when the owner asks about a project\'s tasks or statuses; do not ask the CEO.',
    parameters: { type: 'object', properties: { project: { type: 'string', description: 'The project as the owner named it.' }, include_closed: { type: 'boolean', description: 'Also the done and cancelled ones.' } }, required: ['project'], additionalProperties: false }
  },
  {
    type: 'function' as const,
    name: 'board_task',
    description: 'One task and its graph on Fabric\'s board: its goal, the task it grew from and the ones that grew from it, what it blocks, what blocks it, what it follows. Read it yourself to walk the task graph; give the task by its words and its project, or by its id.',
    parameters: { type: 'object', properties: { task: { type: 'string', description: 'The task\'s words or id.' }, project: { type: 'string', description: 'Its project, as the owner named it.' } }, required: ['task'], additionalProperties: false }
  }
] as const

type Answer = Record<string, unknown>

export function createVoiceBoard(deps: { reads: BoardReads; timeZone?: string }) {
  const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: deps.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const when = (iso: string | null | undefined): string | null => (iso ? fmt.format(new Date(iso)) : null)
  const unread = (what: string, e: unknown): Answer => ({ ok: false, reason: `${what} could not be read: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`, next: 'tell the owner the board could not be read now' })
  const titleOf = (t: BoardTask): string => (t.title || t.instruction || '').trim().slice(0, 140)
  // The whole id: it goes only to the model, never to a screen, and board_task opens a task by it (0.3.27 review UX-64).
  const brief = (t: BoardTask): Answer => ({ id: t.id, title: titleOf(t), status: t.status })

  async function project(name: unknown): Promise<{ ok: true; p: BoardProject } | { ok: false; a: Answer }> {
    const q = typeof name === 'string' ? name.trim() : ''
    if (!q) return { ok: false, a: { ok: false, reason: 'name the project' } }
    // The owner's words for the CEO itself are never a project (the owner, 2026-11-21).
    if (isCeoAddress(q)) return { ok: false, a: { ok: false, reason: `«${q}» is the CEO itself, not a project`, next: 'ask the owner which project he means' } }
    let list: BoardProject[]
    try { list = await deps.reads.projects() } catch (e) { /* said to the voice as unread; the host logs the tool's failure (ceo.voice.board) */ return { ok: false, a: unread('the projects', e) } }
    const r = findProject(list, q)
    if ('found' in r) return { ok: true, p: r.found }
    if ('ambiguous' in r) return { ok: false, a: { ok: false, reason: 'several projects match', choices: r.ambiguous.slice(0, 3), next: 'read the owner two or three and ask' } }
    return { ok: false, a: { ok: false, reason: `no project «${q}»`, ...(r.near.length ? { near: r.near.slice(0, 3) } : {}), next: 'ask the owner which project he means' } }
  }

  async function projects(a: { limit?: unknown }): Promise<Answer> {
    const n = typeof a.limit === 'number' && Number.isFinite(a.limit) ? Math.max(1, Math.min(20, Math.round(a.limit))) : 5
    let list: BoardProject[]
    try { list = await deps.reads.projects() } catch (e) { /* said to the voice as unread; the host logs the tool's failure (ceo.voice.board) */ return unread('the projects', e) }
    const newest = [...list].sort((x, y) => Date.parse(y.created_at) - Date.parse(x.created_at)).slice(0, n)
    return { ok: true, projects: newest.map((p) => ({ name: p.name, created: when(p.created_at) })), of: list.length }
  }

  async function tasks(a: { project?: unknown; include_closed?: unknown }): Promise<Answer> {
    const found = await project(a.project)
    if (!found.ok) return found.a
    let rows: BoardTask[]
    try { rows = await deps.reads.tasks(found.p.id) } catch (e) { /* said to the voice as unread; the host logs the tool's failure (ceo.voice.board) */ return unread('the tasks', e) }
    const shown = rows.filter((t) => a.include_closed === true || !CLOSED.has(t.status))
      .sort((x, y) => (STATUS_ORDER[x.status] ?? 3) - (STATUS_ORDER[y.status] ?? 3)
        || (Date.parse(y.started_at ?? '') || 0) - (Date.parse(x.started_at ?? '') || 0))
    let claims: BoardClaim[] = []
    let claimsUnread: string | null = null
    try { claims = await deps.reads.claims(shown.map((t) => t.id)) } catch (e) { /* the tasks still answer; said as holders_unread */ claimsUnread = e instanceof Error ? e.message.slice(0, 120) : String(e) }
    const holder = new Map(claims.map((c) => [c.work_id, c]))
    const said = shown.slice(0, TASKS_SAID).map((t) => {
      const c = holder.get(t.id)
      return { ...brief(t), ...(c ? { held_by: c.agent ?? `session ${c.owner_session.slice(0, 8)}`, since: when(c.claimed_at) } : {}) }
    })
    return {
      ok: true, project: found.p.name, tasks: said, ...(shown.length > TASKS_SAID ? { more: shown.length - TASKS_SAID } : {}),
      waits_for_owner: shown.filter((t) => t.status === 'review').map(brief),
      counts: countBy(rows.map((t) => t.status)),
      // The host reads the newest TASKS_READ; at that bound the counts are of those, not the project's (DA-52).
      ...(rows.length >= TASKS_READ ? { capped: true, note: `counts are of the newest ${TASKS_READ} tasks; say «at least»` } : {}),
      ...(claimsUnread ? { holders_unread: claimsUnread } : {})
    }
  }

  async function task(a: { task?: unknown; project?: unknown }): Promise<Answer> {
    const q = typeof a.task === 'string' ? a.task.trim() : ''
    if (!q) return { ok: false, reason: 'name the task' }
    let t: BoardTask | null = null
    try {
      if (/^[0-9a-f-]{8,36}$/i.test(q) || /^t-/.test(q)) {
        const byId = await deps.reads.tasksByIds([q])
        t = byId[0] ?? null
      }
      if (!t) {
        if (!a.project) return { ok: false, reason: 'name the task\'s project too, or its id' }
        const found = await project(a.project)
        if (!found.ok) return found.a
        const words = q.toLowerCase().split(/\s+/).filter(Boolean)
        const all = await deps.reads.tasks(found.p.id)
        // An id's first characters, as an older answer or the owner may give them, open the task too (UX-64).
        const byPrefix = /^[0-9a-f-]{6,35}$/i.test(q) ? all.filter((r) => r.id.toLowerCase().startsWith(q.toLowerCase())) : []
        const rows = byPrefix.length ? byPrefix : all.filter((r) => words.every((w) => titleOf(r).toLowerCase().includes(w)))
        if (rows.length > 1) return { ok: false, reason: 'several tasks match', choices: rows.slice(0, 3).map(brief), next: 'read the owner two or three and ask' }
        t = rows[0] ?? null
      }
    } catch (e) { /* said to the voice as unread; the host logs the tool's failure (ceo.voice.board) */ return unread('the task', e) }
    if (!t) return { ok: false, reason: `no task «${q}»`, next: 'ask the owner for the task\'s words or its project' }
    try {
      const [from, to] = await Promise.all([deps.reads.linksFrom([t.id]), deps.reads.linksTo(t.id)])
      const ids = new Set<string>()
      for (const l of from) if (l.target_kind === 'task') ids.add(l.target_id)
      for (const l of to) ids.add(l.task_id)
      const near = new Map((await deps.reads.tasksByIds([...ids])).map((r) => [r.id, r]))
      const pick = (rel: string, dir: 'from' | 'to'): Answer[] => (dir === 'from' ? from : to)
        .filter((l) => l.rel === rel && (dir === 'to' || l.target_kind === 'task'))
        .map((l) => near.get(dir === 'from' ? l.target_id : l.task_id)).filter((r): r is BoardTask => !!r).map(brief)
      const parent = pick('spawned', 'from')[0] ?? null
      return {
        ok: true, ...brief(t), id: t.id,
        goal: await goalOf(t),
        grew_from: parent, grew_into: pick('spawned', 'to'),
        blocks: pick('blocks', 'from'), blocked_by: pick('blocks', 'to'),
        follows: pick('follows', 'from'), followed_by: pick('follows', 'to'),
        started: when(t.started_at), ...(t.finished_at ? { finished: when(t.finished_at) } : {})
      }
    } catch (e) { /* said to the voice as unread; the host logs the tool's failure (ceo.voice.board) */ return unread('the task\'s links', e) }
  }

  /** The goal: walk `spawned` up to the root (at most ten hops, never round a cycle); the root's goal, or a goal the root
   *  was spawned from. */
  async function goalOf(start: BoardTask): Promise<string | null> {
    let cur = start
    const seen = new Set([cur.id])
    for (let hop = 0; hop < GOAL_HOPS; hop++) {
      const up = (await deps.reads.linksFrom([cur.id])).filter((l) => l.rel === 'spawned')
      const goalLink = up.find((l) => l.target_kind === 'goal')
      if (goalLink) return (await deps.reads.goals([goalLink.target_id]))[0]?.title ?? null
      const next = up.find((l) => l.target_kind === 'task' && !seen.has(l.target_id))
      if (!next) break
      const parent = (await deps.reads.tasksByIds([next.target_id]))[0]
      if (!parent) break
      seen.add(parent.id)
      cur = parent
    }
    return cur.goal_id ? (await deps.reads.goals([cur.goal_id]))[0]?.title ?? null : null
  }

  const table: Record<string, (a: Record<string, unknown>) => Promise<Answer>> = { board_projects: projects, board_tasks: tasks, board_task: task }
  return {
    has: (name: string): boolean => name in table,
    run: async (name: string, args: unknown): Promise<Answer> => {
      const fn = table[name]
      if (!fn) return { ok: false, reason: `unknown tool ${name}` }
      return fn(args && typeof args === 'object' ? (args as Record<string, unknown>) : {})
    }
  }
}

function countBy(xs: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const x of xs) out[x] = (out[x] ?? 0) + 1
  return out
}
// #endregion voice-board
