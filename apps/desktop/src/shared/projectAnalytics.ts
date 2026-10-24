// #region project-analytics — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
// W2-8 (OF-39): how work goes in one project, read from what Fabric already records (the journal's `task.moved@1` and
// `task.closed@1`, the tasks' creation time, the open questions); no new tracking. Pure, so it is tested rather than
// reasoned about. A task reaches done by the person's close (`task.closed@1`, outcome done): an agent never moves a
// task to a terminal state (`shared/ladder.ts#mayMove`), so a reading of moves alone never sees a task done (DA-1).

export interface TaskMove { taskId: string; from: string | null; to: string; at: string }
/** A task closed by the person (`task.closed@1`): its outcome is where it went. */
export interface TaskClose { taskId: string; outcome: string; at: string }

export interface ProjectAnalytics {
  /** Tasks moved to done in each of the last `weeks` weeks, oldest first (a week is seven days ending now). */
  donePerWeek: number[]
  /** Median hours from a task's creation to its move to done, over the window; null when nothing was done. */
  leadHours: number | null
  /** Median hours a task spent in review before it was done, over the window; null when none passed review. */
  reviewHours: number | null
  /** Of the tasks that reached review in the window, the share sent back to work; null when none reached review. */
  reopenedShare: number | null
  questionsWaiting: number
  /** When the oldest open question was asked; null when none waits. */
  oldestQuestionAt: string | null
  /** The window, in weeks. */
  weeks: number
  /** The journal read stopped at its bound before the window's start: the oldest weeks may be missing (DA-4). */
  capped: boolean
}

const HOUR = 3_600_000
const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Moves and closes as one ordered list of moves: a close becomes a move from the task's last known state (the latest
 * earlier move's `to`, or null when none was read) to its outcome. Ordered by time, a close after a move at the same
 * instant last.
 */
export function withCloses(moves: readonly TaskMove[], closes: readonly TaskClose[]): TaskMove[] {
  const events = [
    ...moves.map((m) => ({ at: m.at, order: 0, move: m as TaskMove | null, close: null as TaskClose | null })),
    ...closes.map((c) => ({ at: c.at, order: 1, move: null as TaskMove | null, close: c as TaskClose | null }))
  ].sort((a, b) => a.at.localeCompare(b.at) || a.order - b.order)
  const last = new Map<string, string>()
  const out: TaskMove[] = []
  for (const e of events) {
    const m = e.move ?? { taskId: e.close!.taskId, from: last.get(e.close!.taskId) ?? null, to: e.close!.outcome, at: e.close!.at }
    last.set(m.taskId, m.to)
    out.push(m)
  }
  return out
}

export function projectAnalytics(input: {
  moves: readonly TaskMove[]
  /** The person's closes; a close whose outcome is done is a task reaching done. */
  closes?: readonly TaskClose[]
  /** Each task's creation time, by id. */
  createdAt: ReadonlyMap<string, string>
  /** The open questions read (the oldest first, at most the read's bound). */
  openQuestions: readonly { askedAt: string }[]
  /** How many questions are open, when the read counted them past its bound; else the length of `openQuestions`. */
  questionCount?: number
  /** The journal read stopped at its bound before the window's start. */
  capped?: boolean
  now: number
  weeks?: number
}): ProjectAnalytics {
  const weeks = input.weeks ?? 8
  const start = input.now - weeks * 7 * 24 * HOUR
  const moves = withCloses(input.moves, input.closes ?? []).filter((m) => Date.parse(m.at) >= start && Date.parse(m.at) <= input.now)
  const donePerWeek = Array.from({ length: weeks }, () => 0)
  const lead: number[] = []
  const review: number[] = []
  const reviewEnteredAt = new Map<string, number>()
  const reachedReview = new Set<string>()
  const reopened = new Set<string>()
  for (const m of moves) {
    const at = Date.parse(m.at)
    if (m.to === 'review') { reviewEnteredAt.set(m.taskId, at); reachedReview.add(m.taskId) }
    if (m.from === 'review' && m.to === 'running') reopened.add(m.taskId)
    if (m.to === 'done') {
      const week = Math.min(weeks - 1, Math.floor((at - start) / (7 * 24 * HOUR)))
      donePerWeek[week] += 1
      const created = input.createdAt.get(m.taskId)
      if (created) lead.push((at - Date.parse(created)) / HOUR)
      const entered = reviewEnteredAt.get(m.taskId)
      if (entered !== undefined) review.push((at - entered) / HOUR)
    }
  }
  const asked = input.openQuestions.map((q) => q.askedAt).sort()
  return {
    donePerWeek,
    leadHours: median(lead),
    reviewHours: median(review),
    reopenedShare: reachedReview.size ? [...reopened].filter((t) => reachedReview.has(t)).length / reachedReview.size : null,
    questionsWaiting: Math.max(input.questionCount ?? 0, input.openQuestions.length),
    oldestQuestionAt: asked[0] ?? null,
    weeks,
    capped: input.capped ?? false
  }
}

/**
 * Pages a read newest first until it is exhausted or holds `maxRows` (DA-4): the gateway answers at most 1000 rows a
 * request (`supabase/config.toml` max_rows) and says nothing of the rest, so a single larger `limit` is silently cut.
 * Paged by keyset, not offset (0.3.12 review i2 ER-5, DA-3): each page asks for rows whose `key` (the journal's `seq`)
 * is below the last one read, so a row appended while the pages are read lands above the cursor and is neither read
 * twice nor pushes another out; `backup.ts` pages the journal the same way. A page shorter than asked is not taken as
 * the end (a gateway's cap may be lower than `pageSize`); an empty one is. `capped` is true when rows past the bound
 * exist, which one extra row's read decides. A refused page, or one that does not move below the cursor, is `failed`.
 */
export async function readNewestPaged<Row>(
  page: (before: number | null, limit: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  bound: { pageSize?: number; maxRows: number; key: (row: Row) => number }
): Promise<{ rows: Row[]; capped: boolean; failed: string | null }> {
  const pageSize = bound.pageSize ?? 1000
  const rows: Row[] = []
  let before: number | null = null
  while (rows.length < bound.maxRows) {
    const want = Math.min(pageSize, bound.maxRows - rows.length)
    const { data, error } = await page(before, want)
    if (error) return { rows: [], capped: false, failed: error.message }
    const got = data ?? []
    if (got.length === 0) return { rows, capped: false, failed: null }
    const cursor: number | null = before
    for (const row of got.slice(0, want)) {
      const k = bound.key(row)
      // A row at or above the cursor was read already (a source that ignored the keyset): it is not counted twice.
      if (cursor !== null && !(k < cursor)) continue
      rows.push(row)
      if (before === null || k < before) before = k
    }
    // Not silent: a page that gave nothing below the cursor would be asked again forever; the read says so instead.
    if (before === cursor) return { rows: [], capped: false, failed: `the read did not move past ${String(cursor)}` }
  }
  const beyond = await page(before, 1)
  if (beyond.error) return { rows: [], capped: false, failed: beyond.error.message }
  return { rows, capped: (beyond.data ?? []).length > 0, failed: null }
}
// #endregion project-analytics
