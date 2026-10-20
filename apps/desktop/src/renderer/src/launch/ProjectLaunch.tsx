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
import { useT } from '../i18n'
import { titleOf } from '../attentionTitle'
import { ProjectStrip } from './FabricStrip'
import { HomeAgents, useHome } from './HomeWork'
import { ProjectBoardGlance, ProjectWay } from './ProjectWay'
import { projectPath } from '../../../shared/projectPath'
import { FailureNote } from '../OperatorError'
import { useOpenConsole } from '../consoles'

export function ProjectLaunch({ project, tasks, tasksProblem = null, closedCapped = false, sessions, feedMark, lastEventAt, onBoard, onPlan, onPulse, onOpenTask, onNewTask, onSection }: {
  /** This project's pulse (SCR-42). */
  onPulse?: () => void
  project: ProjectRow
  /** Null until read (M108). */
  tasks: TaskRow[] | null
  /** The tasks read failed; the way says so instead of reading forever. */
  tasksProblem?: string | null
  /** Whether the closed half of `tasks` was cut (the list reads the newest closed only): then «Готово» is a floor (DA-3). */
  closedCapped?: boolean | 'unknown' | null
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
  const t = useT()
  const showConsole = useOpenConsole()
  const [board, setBoard] = useState<ReadEnvelope<BoardCut> | null>(null)
  const [boardProblem, setBoardProblem] = useState<string | null>(null)
  const [goals, setGoals] = useState<GoalRow[] | null>(null)
  const [team, setTeam] = useState<CreatedAgent[] | null>(null)
  const [teamProblem, setTeamProblem] = useState<string | null>(null)
  const [goalsProblem, setGoalsProblem] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    window.fabric.board.query({ projectId: project.id, limit: 10 }).then(
      (b) => { if (alive) { setBoard(b); setBoardProblem(null) } },
      (e: unknown) => alive && setBoardProblem(e instanceof Error ? e.message : String(e))
    )
    window.fabric.goals.list(project.id).then(
      (g) => { if (alive) { setGoals(g); setGoalsProblem(null) } },
      (e: unknown) => alive && setGoalsProblem(e instanceof Error ? e.message : String(e))
    )
    window.fabric.agents.list(project.id).then(
      (a) => { if (alive) { setTeam(a); setTeamProblem(null) } },
      (e: unknown) => alive && setTeamProblem(e instanceof Error ? e.message : String(e))
    )
    return () => { alive = false }
  }, [project.id, feedMark])

  const cut = board?.data ?? null
  const unread = (board?.sources ?? []).filter((s) => s.status !== 'ok')
  const first = cut?.items[0] ?? null
  const kindOf = (kind: string) => t(`needsYou.kind.${kind}` as 'needsYou.kind.question')
  const goal = goals?.[0] ?? null
  /** The agents' own words for this project (operator request 2026-10-14): the same reading as the home. */
  const home = useHome(feedMark)
  const pulse = home.view?.projects.find((p) => p.projectId === project.id) ?? null
  const path = tasks === null ? null : projectPath(tasks)
  const [consoleProblem, setConsoleProblem] = useState<string | null>(null)
  /** A console that will not open is said, never swallowed (the home does the same). */
  const openConsole = (sessionId: string): void => {
    setConsoleProblem(null)
    showConsole(sessionId).catch((e: unknown) => setConsoleProblem(e instanceof Error ? e.message : String(e)))
  }

  return (
    <div className="lp" data-launch-view="launch-project">
      <ProjectStrip project={project} lastEventAt={lastEventAt} onPulse={onPulse} />
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.project.kicker')}</p>
          <h2 tabIndex={-1}>{project.name}</h2>
          <p>{project.purpose || t('project.noPurpose')}</p>
          {pulse?.now && (
            <p className="lp-project-now"><span className="lh-live-indicator" aria-hidden="true" />{t('launch.project.nowLine', { text: pulse.now.text })}</p>
          )}
        </div>
        <div className="lp-actions">
          <button type="button" className="lp-button primary" onClick={() => onBoard()}>{t('launch.project.board')}</button>
          <button type="button" className="lp-button" onClick={onPlan}>{t('launch.project.plan')}</button>
        </div>
      </header>
      {consoleProblem && <FailureNote said={t('launch.home.agents.consoleFailed')} detail={consoleProblem} />}
      <div className="lp-project-grid">
        <div>
          {tasks !== null && tasks.length === 0 ? (
            <section className="lp-panel lp-context" aria-labelledby="project-now-title">
              <p className="lp-kicker">{t('launch.project.way.kicker')}</p>
              <h3 id="project-now-title">{t('launch.project.firstResult')}</h3>
              <p>{t('launch.project.firstResultBody')}</p>
              <button type="button" className="lp-button" onClick={onNewTask}>{t('launch.project.writeTask')}</button>
            </section>
          ) : (
            <ProjectWay path={path} inWork={home.view ? home.view.inWork.filter((w) => w.projectId === project.id) : null}
              goal={goal?.title ?? null} problem={tasksProblem} goalProblem={goalsProblem} onOpenTask={onOpenTask} onPlan={onPlan} />
          )}

          <section className="lp-panel" aria-labelledby="project-board-title">
            <div className="lp-panel-head">
              <h3 id="project-board-title">{t('launch.project.questions')}</h3>
              {cut && <span className="lp-pill">{cut.total}</span>}
            </div>
            {boardProblem && <FailureNote said={t('needsYou.unreadable')} detail={boardProblem} />}
            {unread.length > 0 && <p className="lp-meta" role="status">{t('needsYou.partial', { sources: unread.map((s) => s.name).join(', ') })}</p>}
            {cut === null && !boardProblem && <p className="lp-meta">{t('estate.reading')}</p>}
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
              </button>
            ))}
            {first && <button type="button" className="lp-button" onClick={() => onBoard(first.ref)}>{t('launch.project.review')}</button>}
          </section>

          <ProjectBoardGlance path={path} problem={tasksProblem} doneFloor={closedCapped !== false && closedCapped !== null} onOpenTask={onOpenTask} onBoard={() => onSection('sec-board')} onNewTask={onNewTask} />
        </div>

        <aside className="lp-side">
          <HomeAgents reading={home} projectId={project.id} title={t('launch.project.agentsHere')}
            onOpen={() => onSection('sec-agents')} onSession={openConsole} onAll={() => onSection('sec-agents')} />
          {/* The goal is said once, in the way's «Дальше»; this panel stands in only while there is none (i3 UX-4). */}
          {!goal && (
            <section className="lp-panel">
              <p className="lp-kicker">{t('launch.project.goal')}</p>
              <h3>{project.purpose || t('launch.project.noGoal')}</h3>
              <button type="button" className="lp-button" onClick={onPlan}>{t('launch.project.goals')}</button>
            </section>
          )}
          <section className="lp-panel" aria-labelledby="project-team-title">
            <div className="lp-panel-head">
              <h3 id="project-team-title">{t('launch.project.team')}</h3>
              {team && <span className="lp-pill">{team.length}</span>}
            </div>
            {teamProblem && <FailureNote said={t('launch.project.teamUnreadable')} detail={teamProblem} />}
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
