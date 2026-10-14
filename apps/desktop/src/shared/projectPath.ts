// #region project-path — docs: docs/evidence/plans/2026-10-14-operator-home/README.md#проект-scr-31
/**
 * A project's way, read from its tasks (operator request 2026-10-14: «откуда мы сюда пришли и куда идём»): what was
 * done most recently, what is in work now, what comes next, and the board's four columns with their counts. Pure, so
 * the page and its tests read the same thing. A task's words are its summary (`brief_what`, then `title`) and, for a
 * task that predates titles, the first line of its instruction — cut, because an instruction is a prompt.
 */
import type { TaskState } from './ladder.ts'
import { taskSummary } from './homeLive.ts'

export interface PathTask {
  id: string
  status: TaskState
  title: string | null
  brief_what: string | null
  instruction: string
  started_at: string
  finished_at: string | null
  moved_at: string | null
  position: number | null
}

export interface PathItem {
  id: string
  summary: string
  at: string
}

export interface ProjectPath {
  done: PathItem[]
  now: PathItem[]
  next: PathItem[]
  columns: Record<'backlog' | 'running' | 'review' | 'done', { count: number; items: PathItem[] }>
}

const PROMPT_CUT = 120

/** What a task is, in words: the brief, the title, else the instruction's first line, cut at a word. */
export function pathSummary(t: Pick<PathTask, 'title' | 'brief_what' | 'instruction'>): string {
  const said = taskSummary(t)
  if (said) return said
  const line = (t.instruction ?? '').split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  if (line.length <= PROMPT_CUT) return line
  const cut = line.slice(0, PROMPT_CUT)
  return cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : PROMPT_CUT).trimEnd() + '…'
}

const item = (t: PathTask, at: string): PathItem => ({ id: t.id, summary: pathSummary(t), at })
const newest = (a: PathItem, b: PathItem) => b.at.localeCompare(a.at)

export function projectPath(tasks: readonly PathTask[], limit = 3): ProjectPath {
  const of = (s: TaskState) => tasks.filter((t) => t.status === s)
  const done = of('done').map((t) => item(t, t.finished_at ?? t.moved_at ?? t.started_at)).sort(newest)
  const running = of('running').map((t) => item(t, t.moved_at ?? t.started_at)).sort(newest)
  const review = of('review').map((t) => item(t, t.moved_at ?? t.started_at)).sort(newest)
  // The queue in its own order: position first (the board's), then the oldest — what was asked first comes first.
  const backlog = of('backlog')
    .slice()
    .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.started_at.localeCompare(b.started_at))
    .map((t) => item(t, t.started_at))
  const col = (items: PathItem[]) => ({ count: items.length, items: items.slice(0, limit) })
  return {
    done: done.slice(0, limit),
    now: [...running, ...review].slice(0, limit),
    next: backlog.slice(0, limit),
    columns: { backlog: col(backlog), running: col(running), review: col(review), done: col(done) }
  }
}
// #endregion project-path
