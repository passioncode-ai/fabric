// #region home-in-work — docs: docs/ux/2026-10-26-simple-fabric.md#2b-в-работе-grouped-by-project
/**
 * «В работе» on the home, grouped by project (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §2b; the
 * operator, 2026-10-26: «по каждому нашему сначала проекту ... какие у нас внутри есть агенты ... агенты репортили»).
 * One card per project at work (`shared/homeProjects.ts#groupInWork`): its name opening the project, its one line (the
 * project profile's `summary`), its counts; one row per agent with its runner, branch, state and time since its last
 * sign, its current task (opening the task page) and its last report in its own words with «шаг N из M»; the row opens
 * the agent's screen. A task in work no agent holds is a line of its own. Quiet projects fold into one line. Everything
 * comes from the home's one reading (`work.home`) and the projects as read: no read of its own.
 */
import { useState } from 'react'
import type { LiveAgent } from '../../../shared/homeLive'
import type { ProjectRow } from '../../../shared/types'
import { groupInWork, type InWorkCard } from '../../../shared/homeProjects.ts'
import { pluralForm, useLocale, useT } from '../i18n'
import { since } from '../duration'
import { runnerLabel } from '../runnerLabel'
import { FailureNote } from '../OperatorError'
import { CappedNote, KeptNote, type HomeReading } from './HomeWork'

/** How many quiet projects the line names before «и ещё N». */
const QUIET_NAMED = 5

export function HomeInWork({ reading, projects, waitingByProject, onProject, onAgent, onTask }: {
  reading: HomeReading
  projects: ProjectRow[] | null
  /** What waits for the person, by project (the shell's count); null while unknown. */
  waitingByProject: Record<string, number> | null
  onProject(projectId: string): void
  onAgent(sessionId: string): void
  onTask(projectId: string, taskId: string): void
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [allQuiet, setAllQuiet] = useState(false)
  const v = reading.view
  const g = v ? groupInWork({ live: v.live, inWork: v.inWork, projects: projects ?? [], locale }) : null
  const plural = (key: 'projects' | 'agents', n: number): string => t(`launch.home.inWork.${key}.${pluralForm(locale, n)}` as 'launch.home.inWork.agents.many', { count: n })
  const quietShown = g ? (allQuiet ? g.quiet : g.quiet.slice(0, QUIET_NAMED)) : []
  return (
    <section className="lp-panel lh-inwork" aria-labelledby="home-inwork-title">
      <div className="lh-inwork-head">
        <h3 id="home-inwork-title">{t('launch.home.inWork.title')}</h3>
        {g && <span className="lp-meta">{plural('projects', g.projectsAtWork)} · {plural('agents', g.agentsAtWork)}</span>}
      </div>
      {reading.problem && <FailureNote said={t('launch.home.work.unreadable')} detail={reading.problem} />}
      <KeptNote reading={reading} />
      <CappedNote reading={reading} />
      {!v && !reading.problem && <p className="lp-meta" role="status">{t('estate.reading')}</p>}
      {g && g.cards.length === 0 && <p className="lp-meta">{t('launch.home.inWork.none')}</p>}
      {g?.cards.map((c) => (
        <Card key={c.projectId ?? 'none'} card={c} waiting={c.projectId && waitingByProject ? (waitingByProject[c.projectId] ?? 0) : 0}
          onProject={onProject} onAgent={onAgent} onTask={onTask} plural={plural} />
      ))}
      {g && g.quiet.length > 0 && (
        <p className="lh-inwork-quiet">
          <span>{t('launch.home.inWork.quiet')}</span>{' '}
          {quietShown.map((p, i) => (
            <span key={p.id}>
              <button type="button" className="lp-link" onClick={() => onProject(p.id)}>{p.name}</button>
              {i < quietShown.length - 1 ? ', ' : ''}
            </span>
          ))}
          {!allQuiet && g.quiet.length > QUIET_NAMED && (
            <> <button type="button" className="lp-link" onClick={() => setAllQuiet(true)}>{t('launch.home.inWork.quietMore', { count: g.quiet.length - QUIET_NAMED })}</button></>
          )}
        </p>
      )}
    </section>
  )
}

function Card({ card, waiting, onProject, onAgent, onTask, plural }: {
  card: InWorkCard
  waiting: number
  onProject(projectId: string): void
  onAgent(sessionId: string): void
  onTask(projectId: string, taskId: string): void
  plural(key: 'projects' | 'agents', n: number): string
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const id = `home-inwork-${card.projectId ?? 'none'}`
  const name = card.name ?? t('launch.home.agents.noProject')
  return (
    <article className="lh-proj" aria-labelledby={id}>
      <div className="lh-proj-head">
        <div className="lh-proj-words">
          <h4 id={id}>
            {card.projectId ? <button type="button" className="lp-link" onClick={() => onProject(card.projectId!)}>{name}</button> : name}
          </h4>
          {card.projectId && (card.summary
            ? <p className="lp-meta">{card.summary}</p>
            : (
              <p className="lp-meta">
                {t('launch.home.inWork.noSummary')}{' '}
                <button type="button" className="lp-link" onClick={() => onProject(card.projectId!)}>{t('launch.home.inWork.getToKnow')}</button>
              </p>
            ))}
        </div>
        <div className="lh-proj-counts">
          {card.agents.length > 0 && <span className="lp-pill">{plural('agents', card.agents.length)}</span>}
          {card.inWork > 0 && <span className="lp-pill">{t('launch.home.inWork.tasks', { count: card.inWork })}</span>}
          {waiting > 0 && <span className="lp-pill attention">{t(`launch.home.inWork.waiting.${pluralForm(locale, waiting)}` as 'launch.home.inWork.waiting.many', { count: waiting })}</span>}
        </div>
      </div>
      {card.agents.length > 0 && (
        <ul className="lh-proj-agents" aria-label={t('launch.home.inWork.agentsOf', { name })}>
          {card.agents.map((a) => <AgentRow key={a.sessionId} agent={a} onAgent={onAgent} onTask={onTask} />)}
        </ul>
      )}
      {card.orphans.map((w) => (
        <p key={w.taskId} className="lh-proj-orphan">
          {t('launch.home.inWork.orphan')}{' '}
          <button type="button" className="lp-link" onClick={() => onTask(w.projectId, w.taskId)}>{w.summary || t('launch.home.work.untitled')}</button>
          <span className="lp-meta"> · {t('launch.home.inWork.orphanSince', { time: since(w.since, t) })}</span>
        </p>
      ))}
    </article>
  )
}

function AgentRow({ agent: a, onAgent, onTask }: { agent: LiveAgent; onAgent(sessionId: string): void; onTask(projectId: string, taskId: string): void }): React.JSX.Element {
  const t = useT()
  const heard = since(a.lastSignAt ?? a.startedAt, t)
  return (
    <li className={`lh-arow ${a.stale ? 'is-stale' : ''}`}>
      <button type="button" className="lh-arow-who" onClick={() => onAgent(a.sessionId)} title={t('launch.home.inWork.openAgent')}>
        <b><span className={a.stale ? 'rail-dot quiet' : 'rail-dot live'} aria-hidden="true" />{runnerLabel(a.agent, t)}</b>
        {a.branch
          ? <span className="rail-branch">{a.branch}</span>
          : <span className="rail-branch unknown" title={t('rail.agents.branchUnknownWhy')}>{t('rail.agents.branchUnknown')}</span>}
      </button>
      <div className="lh-arow-body">
        {/* The operator's second review (R-3, R-4): the goal leads in the row's main type; what changes, the step, is the
            muted line below it with its progress. An older reading without goals keeps the task as the main line. */}
        {a.goal !== undefined ? (
          <p className="lh-arow-task">
            {a.goal
              ? <button type="button" className="lp-link" onClick={() => onTask(a.goal!.projectId, a.goal!.taskId)}>{t('launch.home.inWork.goal', { goal: a.goal.text })}</button>
              : <span className="lp-meta">{t('launch.home.inWork.noGoal')}</span>}
          </p>
        ) : (
          <p className="lh-arow-task">
            {a.task
              ? <button type="button" className="lp-link" onClick={() => onTask(a.task!.projectId, a.task!.id)}>{a.task.summary || t('launch.home.work.untitled')}</button>
              : <span className="lp-meta">{t('launch.home.inWork.noTask')}</span>}
          </p>
        )}
        <p className="lh-arow-report">
          {a.goal && !a.goal.isTask && a.task && (
            <><button type="button" className="lp-link" onClick={() => onTask(a.task!.projectId, a.task!.id)}>{a.task.summary || t('launch.home.work.untitled')}</button> · </>
          )}
          {a.doing ? (
            <>
              {a.doing.step && a.doing.ofSteps ? <><Progress step={a.doing.step} of={a.doing.ofSteps} /><span className="lh-arow-step">{t('launch.home.agents.step', { step: a.doing.step, of: a.doing.ofSteps })} · </span></> : null}
              {a.doing.text}
            </>
          ) : <span className="lp-meta">{t('launch.home.agents.silent')}</span>}
        </p>
      </div>
      <p className="lh-arow-when">{a.stale ? t('launch.home.inWork.quietFor', { time: heard }) : t('launch.home.inWork.heard', { time: heard })}</p>
    </li>
  )
}
/** A thin progress bar for the agent's own step and step count (R-4): the numbers are its claim, said beside it. */
export function Progress({ step, of }: { step: number; of: number }): React.JSX.Element {
  const t = useT()
  const now = Math.max(0, Math.min(step, of))
  return (
    <span className="lh-progress" role="progressbar" aria-valuemin={0} aria-valuemax={of} aria-valuenow={now}
      aria-label={t('launch.home.agents.step', { step, of })}>
      <i style={{ width: `${of > 0 ? Math.round((100 * now) / of) : 0}%` }} />
    </span>
  )
}
// #endregion home-in-work
