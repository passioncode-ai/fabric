// The top of a Project (SCR-31/SCR-03 · docs/reports/product.html `launchProject`): where the
// work stands and the next step, the project's own board, its work, and beside them the goal,
// the team and the rhythm. Every number is read here from a reader the app already has; the
// detailed sections the navigation's project groups point at stay below, unchanged.

import { useEffect, useState } from 'react'
import type { BoardCut } from '../../../shared/board'
import type { GoalRow } from '../../../shared/plan'
import type { ReadEnvelope } from '../../../shared/readEnvelope'
import type { CreatedAgent, ProjectRow, TaskRow, TerminalSession } from '../../../shared/types'
import { since } from '../duration'
import { useLocale, useT } from '../i18n'
import { titleOf } from '../attentionTitle'
import { FabricAvatar } from './FabricAvatar'
import { FabricName } from './persona'

export function ProjectLaunch({ project, tasks, sessions, feedMark, lastEventAt, onBoard, onPlan, onPulse, onOpenTask, onNewTask, onSection }: {
  /** This project's pulse (SCR-42). */
  onPulse?: () => void
  project: ProjectRow
  /** Null until read (M108). */
  tasks: TaskRow[] | null
  sessions: TerminalSession[] | null
  feedMark: number
  /** When the journal last said anything about this project; null when it has said nothing. */
  lastEventAt: string | null
  onBoard: (item?: string) => void
  /** Planning, opened at this project's goals (SCR-40). */
  onPlan: () => void
  onOpenTask: (taskId: string) => void
  onNewTask: () => void
  /** Scroll to one of the detailed sections below (`sec-…`). */
  onSection: (anchor: string) => void
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [board, setBoard] = useState<ReadEnvelope<BoardCut> | null>(null)
  const [boardProblem, setBoardProblem] = useState<string | null>(null)
  const [goals, setGoals] = useState<GoalRow[] | null>(null)
  const [team, setTeam] = useState<CreatedAgent[] | null>(null)
  const [teamProblem, setTeamProblem] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    window.fabric.board.query({ projectId: project.id, limit: 10 }).then(
      (b) => { if (alive) { setBoard(b); setBoardProblem(null) } },
      (e: unknown) => alive && setBoardProblem(e instanceof Error ? e.message : String(e))
    )
    window.fabric.goals.list(project.id).then((g) => alive && setGoals(g), () => alive && setGoals(null))
    window.fabric.agents.list(project.id).then(
      (a) => { if (alive) { setTeam(a); setTeamProblem(null) } },
      (e: unknown) => alive && setTeamProblem(e instanceof Error ? e.message : String(e))
    )
    return () => { alive = false }
  }, [project.id, feedMark])

  const cut = board?.data ?? null
  const unread = (board?.sources ?? []).filter((s) => s.status !== 'ok')
  const first = cut?.items[0] ?? null
  const live = (sessions ?? []).filter((s) => s.projectId === project.id && s.running)
  const kindOf = (kind: string) => t(`needsYou.kind.${kind}` as 'needsYou.kind.question')
  const stateOf = (task: TaskRow) => t(task.status === 'cancelled' ? 'launch.project.cancelled' : (`board.${task.status}` as 'board.done'))
  const goal = goals?.[0] ?? null

  return (
    <div className="lp" data-launch-view="launch-project">
      <div className="fp-strip">
        <FabricAvatar size="tiny" label={t('launch.avatar.label')} />
        <div>
          <b><FabricName /></b>
          <span>
            {lastEventAt
              ? t('launch.project.observed', { time: new Date(lastEventAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }), project: project.name })
              : t('launch.project.unobserved', { project: project.name })}
          </span>
        </div>
        {onPulse && <button type="button" className="lp-button" onClick={onPulse}>{t('launch.pulse.open')}</button>}
      </div>
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.project.kicker')}</p>
          <h2 tabIndex={-1}>{project.name}</h2>
          <p>{project.purpose || t('project.noPurpose')}</p>
        </div>
        <div className="lp-actions">
          <button type="button" className="lp-button primary" onClick={() => onBoard()}>{t('launch.project.board')}</button>
          <button type="button" className="lp-button" onClick={onPlan}>{t('launch.project.plan')}</button>
        </div>
      </header>
      <div className="lp-project-grid">
        <div>
          <section className="lp-panel lp-context" aria-labelledby="project-now-title">
            <p className="lp-kicker">{t('launch.project.now')}</p>
            {cut === null && !boardProblem ? (
              <h3 id="project-now-title">{t('estate.reading')}</h3>
            ) : first ? (
              <>
                <h3 id="project-now-title">{t('launch.project.attention', { count: cut!.total })}</h3>
                <p>{first.title}</p>
                <button type="button" className="lp-button" onClick={() => onBoard(first.ref)}>{t('launch.project.review')}</button>
              </>
            ) : (tasks?.length ?? 0) > 0 ? (
              <>
                <h3 id="project-now-title">{t('launch.project.workKept')}</h3>
                <p>{t('launch.project.workKeptBody')}</p>
              </>
            ) : (
              <>
                <h3 id="project-now-title">{t('launch.project.firstResult')}</h3>
                <p>{t('launch.project.firstResultBody')}</p>
                <button type="button" className="lp-button" onClick={onNewTask}>{t('launch.project.writeTask')}</button>
              </>
            )}
            <small className="lp-meta">
              {live.length > 0 ? t('launch.home.projects.live', { count: live.length }) : t('launch.project.noLive')}
            </small>
          </section>

          <section className="lp-panel" aria-labelledby="project-board-title">
            <div className="lp-panel-head">
              <h3 id="project-board-title">{t('launch.project.boardTitle')}</h3>
              {cut && <span className="lp-pill">{cut.total}</span>}
            </div>
            {boardProblem && <p className="lp-meta" role="alert">{t('needsYou.unreadable', { reason: boardProblem })}</p>}
            {unread.length > 0 && <p className="lp-meta" role="status">{t('needsYou.partial', { sources: unread.map((s) => s.name).join(', ') })}</p>}
            {cut && cut.total === 0 && unread.length === 0 && (
              <div className="lp-empty"><h3>{t('launch.home.board.clear')}</h3><p>{t('launch.home.board.clearBody')}</p></div>
            )}
            {cut?.items.map((item, i) => (
              <button key={item.ref} type="button" className="lp-topic" onClick={() => onBoard(item.ref)}>
                <span className="lp-topic-num">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  <span className="lp-topic-title">{titleOf(item, t)}</span>
                  <span className="lp-meta">{[item.projectName, kindOf(item.kind), item.detail].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="lp-topic-end">
                  <span className={`lp-pill ${item.origin === 'authored' ? 'attention' : ''}`}>{kindOf(item.kind)}</span>
                  <small>{since(item.waitingSince, t)}</small>
                </span>
                <span aria-hidden="true">{t('glyph.open')}</span>
              </button>
            ))}
          </section>

          <section className="lp-panel" aria-labelledby="project-work-title">
            <div className="lp-panel-head">
              <h3 id="project-work-title">{t('launch.project.work')}</h3>
              <button type="button" className="lp-button" onClick={onNewTask}>{t('launch.project.newTask')}</button>
            </div>
            {tasks === null ? (
              <p className="lp-meta">{t('estate.reading')}</p>
            ) : tasks.length === 0 ? (
              <p>{t('launch.project.noTasks')}</p>
            ) : (
              <>
                {tasks.slice(0, 5).map((task) => (
                  <button key={task.id} type="button" className="lp-agent-row" onClick={() => onOpenTask(task.id)}>
                    <div>
                      <h4>{task.title || task.instruction}</h4>
                      <p>{task.id.slice(0, 8)} · {stateOf(task)}</p>
                    </div>
                    <span aria-hidden="true">{t('glyph.open')}</span>
                  </button>
                ))}
                {tasks.length > 5 && (
                  <button type="button" className="lp-button lh-text-link" onClick={() => onSection('sec-board')}>
                    {t('launch.project.allTasks', { count: tasks.length })}
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="lp-side">
          <section className="lp-panel">
            <p className="lp-kicker">{t('launch.project.goal')}</p>
            <h3>{goal ? goal.title : project.purpose || t('launch.project.noGoal')}</h3>
            <button type="button" className="lp-button" onClick={onPlan}>{t('launch.project.goals')}</button>
          </section>
          <section className="lp-panel" aria-labelledby="project-team-title">
            <div className="lp-panel-head">
              <h3 id="project-team-title">{t('launch.project.team')}</h3>
              {team && <span className="lp-pill">{team.length}</span>}
            </div>
            {teamProblem && <p className="lp-meta" role="alert">{t('launch.project.teamUnreadable', { reason: teamProblem })}</p>}
            {team === null && !teamProblem && <p className="lp-meta">{t('estate.reading')}</p>}
            {team?.length === 0 && <p>{t('launch.project.noTeam')}</p>}
            {team?.map((a) => (
              <div key={a.id} className="lp-agent-row">
                <span className="lp-agent-icon" aria-hidden="true">{(a.name.trim()[0] ?? 'A').toUpperCase()}</span>
                <div><h4>{a.name}</h4><p>{a.runner_id}</p></div>
              </div>
            ))}
            <button type="button" className="lp-button" onClick={() => onSection('sec-agents')}>{t('launch.project.setupTeam')}</button>
          </section>
          <section className="lp-panel">
            <h3>{t('launch.project.rhythm')}</h3>
            <div className="lp-actions">
              <button type="button" className="lp-button" onClick={() => onSection('sec-automations')}>{t('launch.project.cycles')}</button>
              <button type="button" className="lp-button" onClick={() => (onPulse ? onPulse() : onSection('sec-journal'))}>{t('launch.project.pulse')}</button>
            </div>
          </section>
          <details className="lp-panel">
            <summary>{t('launch.project.resources')}</summary>
            <div className="lp-actions">
              <button type="button" className="lp-button" onClick={() => onSection('sec-project-settings')}>{t('launch.project.settings')}</button>
              <button type="button" className="lp-button" onClick={() => onSection('sec-memory')}>{t('launch.project.memory')}</button>
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}
