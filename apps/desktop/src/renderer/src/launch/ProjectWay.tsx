// #region project-way — docs: docs/evidence/plans/2026-10-14-operator-home/README.md#проект-scr-31
// The top of a project, as the operator asked for it (2026-10-14): where we came from, where we are, where we go — and
// the board's four columns at a glance. Read from the tasks the page already holds (`projectPath`) and the agents'
// own words (`work.home`), so nothing here is a second reading of the same thing.

import type { ProjectPath } from '../../../shared/projectPath'
import type { WorkItem } from '../../../shared/homeLive'
import { since } from '../duration'
import { useT } from '../i18n'
import { FailureNote } from '../OperatorError'

export function ProjectWay({ path, inWork, goal, problem = null, goalProblem = null, onOpenTask, onPlan }: {
  /** Null until the tasks are read. */
  path: ProjectPath | null
  /** The tasks could not be read: said in place of «Reading…», which would otherwise stay forever (i2 ER-5). */
  problem?: string | null
  /** The goal could not be read: said, not shown as a project with no goal (i2 ER-1). */
  goalProblem?: string | null
  /** This project's claimed work with what its agents say, from `work.home`; null when not read. */
  inWork: WorkItem[] | null
  goal: string | null
  onOpenTask: (taskId: string) => void
  onPlan: () => void
}): React.JSX.Element {
  const t = useT()
  const said = new Map((inWork ?? []).map((w) => [w.taskId, w]))
  const row = (id: string, summary: string, at: string | null, extra?: string | null) => (
    <li key={id}>
      <button type="button" className="lp-button lp-way-item" onClick={() => onOpenTask(id)}>
        <span className="lp-way-title">{summary || t('launch.home.work.untitled')}</span>
        {extra && <span className="lh-doing">{extra}</span>}
        {at && <small className="lp-meta">{since(at, t)}</small>}
      </button>
    </li>
  )
  return (
    <section className="lp-panel lp-way" aria-labelledby="project-way-title">
      <div className="lp-panel-head">
        <div>
          <p className="lp-kicker">{t('launch.project.way.kicker')}</p>
          <h3 id="project-way-title">{t('launch.project.way.title')}</h3>
        </div>
        <button type="button" className="lp-button lh-text-link" onClick={onPlan}>{t('launch.project.way.plan')}</button>
      </div>
      {/* A failed read is said whether or not an earlier one is on screen: the steps below are then the last read (i3 ER-1). */}
      {problem && <FailureNote said={t(path ? 'launch.project.way.stale' : 'launch.project.way.unreadable')} detail={problem} />}
      {path === null ? (
        problem ? null : <p className="lp-meta">{t('estate.reading')}</p>
      ) : (
        <div className="lp-way-steps">
          <div className="lp-way-step">
            <h4>{t('launch.project.way.from')}</h4>
            {path.done.length ? <ol>{path.done.map((i) => row(i.id, i.summary, i.at))}</ol> : <p className="lp-meta">{t('launch.project.way.nothingDone')}</p>}
          </div>
          <div className="lp-way-step is-now">
            <h4>{t('launch.project.way.now')}</h4>
            {path.now.length ? (
              <ol>{path.now.map((i) => row(i.id, i.summary, i.at, said.get(i.id)?.doing?.text ?? null))}</ol>
            ) : (
              <p className="lp-meta">{t('launch.project.way.nothingNow')}</p>
            )}
          </div>
          <div className="lp-way-step">
            <h4>{t('launch.project.way.next')}</h4>
            {goal && <p className="lp-way-goal">{t('launch.project.way.goal', { goal })}</p>}
            {goalProblem && <FailureNote said={t('launch.project.way.goalUnreadable')} detail={goalProblem} />}
            {path.next.length ? <ol>{path.next.map((i) => row(i.id, i.summary, null))}</ol> : <p className="lp-meta">{t('launch.project.way.nothingNext')}</p>}
          </div>
        </div>
      )}
    </section>
  )
}

/** The project's board at a glance: the four columns with their counts and their first cards. */
export function ProjectBoardGlance({ path, doneFloor = false, problem = null, onOpenTask, onBoard, onNewTask }: {
  /** The tasks read failed (i3 UX-1): said, never an endless «Reading…». */
  problem?: string | null
  path: ProjectPath | null
  /** The done column came from a capped read: its count is a floor, said «20+» (0.3.6 review DA-3, ER-2). */
  doneFloor?: boolean
  onOpenTask: (taskId: string) => void
  /** The whole board, below. */
  onBoard: () => void
  onNewTask: () => void
}): React.JSX.Element {
  const t = useT()
  const cols = ['backlog', 'running', 'review', 'done'] as const
  return (
    <section className="lp-panel lp-glance" aria-labelledby="project-board-glance-title">
      <div className="lp-panel-head">
        <h3 id="project-board-glance-title">{t('launch.project.glance.title')}</h3>
        <div className="lp-actions">
          <button type="button" className="lp-button" onClick={onNewTask}>{t('launch.project.newTask')}</button>
          <button type="button" className="lp-button lh-text-link" onClick={onBoard}>{t('launch.project.glance.all')}</button>
        </div>
      </div>
      {problem && <FailureNote said={t(path ? 'launch.project.way.stale' : 'launch.project.glance.unreadable')} detail={problem} />}
      {path === null ? (
        problem ? null : <p className="lp-meta">{t('estate.reading')}</p>
      ) : (
        <div className="lp-glance-columns">
          {cols.map((c) => (
            <div key={c} className="lp-glance-column">
              <h4>{t(`board.${c}` as 'board.done')} <span className="lp-count">{path.columns[c].count}{c === 'done' && doneFloor ? '+' : ''}</span></h4>
              {path.columns[c].items.map((i) => (
                <button key={i.id} type="button" className="lp-button lp-glance-card" onClick={() => onOpenTask(i.id)}>{i.summary || t('launch.home.work.untitled')}</button>
              ))}
              {(path.columns[c].count > path.columns[c].items.length || (c === 'done' && doneFloor)) && (
                <button type="button" className="lp-button lh-text-link" onClick={onBoard}>{c === 'done' && doneFloor ? t('launch.project.glance.all') : t('launch.home.agents.more', { count: path.columns[c].count - path.columns[c].items.length })}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
// #endregion project-way
