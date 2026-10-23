// #region project-analytics — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
// W2-8 (OF-39): how work goes in one project, read from what Fabric already records (the journal's `task.moved@1`, the
// tasks' creation time, the open questions); no new tracking. Pure, so it is tested rather than reasoned about.

export interface TaskMove { taskId: string; from: string | null; to: string; at: string }

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
}

const HOUR = 3_600_000
const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function projectAnalytics(input: {
  moves: readonly TaskMove[]
  /** Each task's creation time, by id. */
  createdAt: ReadonlyMap<string, string>
  openQuestions: readonly { askedAt: string }[]
  now: number
  weeks?: number
}): ProjectAnalytics {
  const weeks = input.weeks ?? 8
  const start = input.now - weeks * 7 * 24 * HOUR
  const moves = [...input.moves].filter((m) => Date.parse(m.at) >= start && Date.parse(m.at) <= input.now)
    .sort((a, b) => a.at.localeCompare(b.at))
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
    questionsWaiting: input.openQuestions.length,
    oldestQuestionAt: asked[0] ?? null,
    weeks
  }
}
// #endregion project-analytics
