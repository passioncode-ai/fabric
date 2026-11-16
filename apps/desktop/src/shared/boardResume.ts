// #region board-resume — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#311-left-work-is-continued-the-board-supervisor
/**
 * The board's supervisor continues left work (the operator, 2026-11-16: a session ended after the first of the waves he
 * ordered and the work stopped until he came back; «стартовать всегда самому если все доделано и можно двигаться
 * вперед а не ждать»). A task whose last session let it go without finishing it, that nobody holds and no person moved
 * since, becomes one more item of the board dispatcher beside requests and inboxes: with no live session in its project
 * the dispatcher starts a run that claims the task and does its next step, under the dispatcher's own limits. Pure:
 * the main process reads the claims, the tasks and the questions and hands them in.
 */

/** The capability a resume item names, so no project's own responder slot ever stands for it. */
export const RESUME_CAPABILITY = 'board.resume'
/** How long after a release a task waits before a run is started for it: a person resuming the session, a /clear, or a
 *  hand-over taking a minute must never meet a second agent in the same folder. */
export const RESUME_GRACE_MS = 10 * 60_000
/** Releases older than this are not continued: the work was left on purpose, or the board moved on. Also the item's
 *  deadline, so a task nobody could continue in a week stops being tried. */
export const RESUME_WINDOW_MS = 7 * 24 * 3600_000
/** The ends of a claim that leave work behind. `done` finished it; `operator` is a person's own release. */
export const RESUME_HOWS: ReadonlySet<string> = new Set(['session-ended', 'lapsed', 'let-go', 'handed-over'])
/** The task's columns that still have work in them. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(['backlog', 'running'])

export interface ResumeCandidate {
  taskId: string
  projectId: string | null
  title: string
  status: string
  /** When the task last changed column, and who moved it (`person`, `agent` or `system`). */
  movedAt: string | null
  movedByKind: string | null
  /** The task's newest claim, or null when it never had one. */
  lastClaim: { claimedAt: string; releasedAt: string | null; how: string | null } | null
  /** An open question to a person names the task: the run would only ask again, so the person decides first. */
  openQuestion: boolean
}

export interface ResumeItem { taskId: string; projectId: string; title: string; how: string; releasedAt: string; deadline: string }

/**
 * The tasks a run may be started for: open, with a project, whose newest claim ended by one of `RESUME_HOWS` between
 * `RESUME_WINDOW_MS` and `RESUME_GRACE_MS` ago, held by nobody now, not moved by a person since that release, with no
 * open question to a person. Oldest release first, so a task left longest is continued first.
 */
export function resumeItems(candidates: readonly ResumeCandidate[], now: number): ResumeItem[] {
  const out: ResumeItem[] = []
  for (const c of candidates) {
    if (!c.projectId || !OPEN_STATUSES.has(c.status) || c.openQuestion) continue
    const claim = c.lastClaim
    if (!claim || !claim.releasedAt || !claim.how || !RESUME_HOWS.has(claim.how)) continue
    const released = Date.parse(claim.releasedAt)
    if (!Number.isFinite(released) || now - released < RESUME_GRACE_MS || now - released > RESUME_WINDOW_MS) continue
    // A person who moved the task after the release decided where it stands (back to the queue to wait, or forward):
    // the supervisor never overrides a person's move. An agent's or the sweep's move after it is the release's own step.
    const moved = c.movedAt ? Date.parse(c.movedAt) : NaN
    if (c.movedByKind === 'person' && Number.isFinite(moved) && moved > released) continue
    out.push({ taskId: c.taskId, projectId: c.projectId, title: c.title, how: claim.how, releasedAt: claim.releasedAt, deadline: new Date(released + RESUME_WINDOW_MS).toISOString() })
  }
  return out.sort((a, b) => Date.parse(a.releasedAt) - Date.parse(b.releasedAt) || a.taskId.localeCompare(b.taskId))
}

/**
 * A resume item's state as the dispatcher reads it after a run: `answered` once the work was taken since the release
 * the item stands for (a claim opened after it, the run's own included, live or already handed on with its next step),
 * moved on (review, done, cancelled), or moved by a person since; `queued` while nobody took it; null when the task
 * cannot be read. So a run that did a step and handed the rest on is not an empty run: its own release is a new item,
 * continued after its grace, and only runs that never took the task count toward the operator.
 */
export function resumeStateOf(task: { status: string; lastClaimedAt: string | null; movedAt: string | null; movedByKind: string | null } | null, releasedAt: string): 'answered' | 'queued' | null {
  if (!task) return null
  if (!OPEN_STATUSES.has(task.status)) return 'answered'
  const released = Date.parse(releasedAt)
  const taken = task.lastClaimedAt ? Date.parse(task.lastClaimedAt) : NaN
  if (Number.isFinite(taken) && taken > released) return 'answered'
  const moved = task.movedAt ? Date.parse(task.movedAt) : NaN
  if (task.movedByKind === 'person' && Number.isFinite(moved) && moved > released) return 'answered'
  return 'queued'
}
// #endregion board-resume
