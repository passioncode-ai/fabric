// #region home-in-work — docs: docs/ux/2026-10-26-simple-fabric.md#2b-в-работе-grouped-by-project
/**
 * «В работе» on the home, grouped by project (0.3.14, the simple Fabric, docs/ux/2026-10-26-simple-fabric.md §2b; the
 * operator, 2026-10-26: «по каждому нашему сначала проекту ... какие у нас внутри есть агенты ... агенты репортили»).
 * One card per project at work (`shared/homeProjects.ts#groupInWork`): its name opening the project, its one line (the
 * project profile's `summary`), its counts; one row per agent with its runner, branch, state and time since its last
 * sign, its current task (opening the task page) and its last report in its own words with «шаг N из M»; the row opens
 * the agent's screen. A task in work no agent holds is a line of its own. Quiet projects fold into one line. Everything
 * comes from the home's one reading (`work.home`) and the projects as read: no read of its own.
 *
 * The mockup parity, wave 2 (docs/reports/2026-10-27-mockup-parity/gaps/home.md D3, D4, D9): only agents AT work make
 * rows (a quiet one still holding its task keeps its «молчит» row), ordered by work; the merely connected are one line
 * «Подключены, без дела: N»; a row heads with the task's title, its brief's «what» the hover; under the time, how long
 * it has held the task; every project is printed by its display name.
 */
import { useState } from 'react'
import type { LiveAgent } from '../../../shared/homeLive'
import type { ProjectRow } from '../../../shared/types'
import { groupInWork, type InWorkCard } from '../../../shared/homeProjects.ts'
import { agentStatus, type SessionStatus, type StatusTerminal } from '../../../shared/sessionStatus.ts'
import { pluralForm, useLocale, useT } from '../i18n'
import { heldFor, since } from '../duration'
import { runnerLabel } from '../runnerLabel'
import { FailureNote } from '../OperatorError'
import { CappedNote, KeptNote, type HomeReading } from './HomeWork'

/** A task's heading: its own title (the mockup parity), else the summary an older reading carries. */
const taskTitle = (task: NonNullable<LiveAgent['task']>): string => (task.title ?? '').trim() || task.summary

/** How many quiet projects the line names before «и ещё N». */
const QUIET_NAMED = 5

export function HomeInWork({ reading, projects, waitingByProject, onProject, onAgent, onTask, terminals = null }: {
  reading: HomeReading
  /** The consoles Fabric holds, for each agent's status (R-19); null while unread. */
  terminals?: ReadonlyArray<StatusTerminal & { sessionId: string }> | null
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
  // The mockup parity (home gaps D3, D4): only the agents at work make rows (and a quiet one still holding its task), the
  // cards ordered by the newest work, then what waits on the person; the merely connected fold into one quiet line.
  const g = v ? groupInWork({
    live: v.live, inWork: v.inWork, projects: projects ?? [], locale, goalsUnread: !!v.goalsUnread,
    atWorkOnly: true, waitingByProject: waitingByProject ?? undefined, names: v.displayNames ?? null
  }) : null
  const plural = (key: 'projects' | 'agents', n: number): string => t(`launch.home.inWork.${key}.${pluralForm(locale, n)}` as 'launch.home.inWork.agents.many', { count: n })
  const quietShown = g ? (allQuiet ? g.quiet : g.quiet.slice(0, QUIET_NAMED)) : []
  return (
    <section className="lh-inwork" aria-labelledby="home-inwork-title">
      <div className="lh-inwork-head">
        <h3 id="home-inwork-title">{t('launch.home.inWork.title')}</h3>
        {g && <span className="lp-meta">{plural('projects', g.projectsAtWork)} · {plural('agents', g.agentsAtWork)}{g.agentsQuiet > 0 ? ` · ${t('launch.home.inWork.agentsQuiet', { count: g.agentsQuiet })}` : ''}</span>}
      </div>
      {reading.problem && <FailureNote said={t('launch.home.work.unreadable')} detail={reading.problem} />}
      {/* UX-18: the reading can be asked again here, as the projects view beside it can. */}
      {reading.problem && reading.retry && <button type="button" className="lp-button" onClick={reading.retry}>{t('common.retry')}</button>}
      <KeptNote reading={reading} />
      <CappedNote reading={reading} />
      {!v && !reading.problem && <p className="lp-meta" role="status">{t('estate.reading')}</p>}
      {/* ER-20: a failed goals read is said once, above the rows that would carry them. */}
      {v?.goalsUnread && <p className="lp-meta" role="status" title={v.goalsUnread}>{t('launch.home.inWork.goalsUnread')}</p>}
      {g && g.cards.length === 0 && <p className="lp-meta">{t('launch.home.inWork.none')}</p>}
      {g?.cards.map((c) => (
        <Card key={c.projectId ?? 'none'} card={c} waiting={c.projectId && waitingByProject ? (waitingByProject[c.projectId] ?? 0) : 0}
          onProject={onProject} onAgent={onAgent} onTask={onTask} plural={plural} terminals={terminals} />
      ))}
      {/* Home gap D3: the agents whose windows answer Fabric but do no work now, one quiet line, never a card each. */}
      {g && g.connectedIdle > 0 && (
        <p className="lh-inwork-quiet lh-inwork-idle" title={t('launch.home.inWork.connectedIdleWhy')}>
          {t('launch.home.inWork.connectedIdle', { count: g.connectedIdle })}
        </p>
      )}
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

function Card({ card, waiting, onProject, onAgent, onTask, plural, terminals }: {
  card: InWorkCard
  terminals: ReadonlyArray<StatusTerminal & { sessionId: string }> | null
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
            {card.projectId
              ? <button type="button" className="lp-link" title={card.summary ?? undefined} onClick={() => onProject(card.projectId!)}>{name}</button>
              : name}
          </h4>
          {/* The operator's second review (R-1, R-2): what is being done there now; the description is the name's hover. */}
          {card.aim && <p className="lh-proj-aim">{card.aim.from === 'plan' ? t('launch.home.inWork.next', { text: card.aim.text }) : card.aim.text}</p>}
        </div>
        <div className="lh-proj-counts">
          {card.agents.length > 0 && <span className="lh-pill">{plural('agents', card.agents.length)}</span>}
          {card.inWork > 0 && <span className="lh-pill">{t('launch.home.inWork.tasks', { count: card.inWork })}</span>}
          {waiting > 0 && <span className="lh-pill attention">{t(`launch.home.inWork.waiting.${pluralForm(locale, waiting)}` as 'launch.home.inWork.waiting.many', { count: waiting })}</span>}
        </div>
      </div>
      {card.agents.length > 0 && (
        <ul className="lh-proj-agents" aria-label={t('launch.home.inWork.agentsOf', { name })}>
          {card.agents.map((a) => (
            <AgentRow key={a.sessionId} agent={a} onAgent={onAgent} onTask={onTask}
              status={agentStatus(a, terminals?.find((x) => x.sessionId === a.sessionId) ?? null)} />
          ))}
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

function AgentRow({ agent: a, onAgent, onTask, status }: { agent: LiveAgent; onAgent(sessionId: string): void; onTask(projectId: string, taskId: string): void; status: SessionStatus }): React.JSX.Element {
  const t = useT()
  const heard = since(a.lastSignAt ?? a.startedAt, t)
  return (
    <li className={`lh-arow ${a.stale ? 'is-stale' : ''}`}>
      <button type="button" className="lh-arow-who" onClick={() => onAgent(a.sessionId)} title={t('launch.home.inWork.openAgent')}>
        <b><span className={`rail-dot s-${status}`} aria-hidden="true" />{runnerLabel(a.agent, t)}</b>
        {a.branch
          ? <span className="rail-branch">{a.branch}</span>
          : <span className="rail-branch unknown" title={t('rail.agents.branchUnknownWhy')}>{t('rail.agents.branchUnknown')}</span>}
      </button>
      <div className="lh-arow-body">
        {/* The operator's second review (R-3, R-4): the goal leads in the row's main type; what changes, the step, is the
            muted line below it with its progress. An older reading without goals keeps the task as the main line. */}
        {/* UX-12: an agent with no task says so, never «no goal»; UX-13: «Цель» only for a goal it split from or one
            the person set, a task that is its own root is the task line. */}
        {a.task && a.goal && (!a.goal.isTask || a.goal.byPerson) ? (
          <p className="lh-arow-task">
            <button type="button" className="lp-link" onClick={() => onTask(a.goal!.projectId, a.goal!.taskId)}>{t('launch.home.inWork.goal', { goal: a.goal.text })}</button>
          </p>
        ) : a.task && a.goal === null ? (
          <p className="lh-arow-report lh-arow-none">{t('launch.home.inWork.noGoal')}</p>
        ) : a.task ? (
          <p className="lh-arow-task">
            {/* The mockup parity: the task's own title heads the row; its brief's «what» is the hover and, while the agent
                says nothing, the muted line below. */}
            <button type="button" className="lp-link" title={a.task.what ?? undefined} onClick={() => onTask(a.task!.projectId, a.task!.id)}>{taskTitle(a.task) || t('launch.home.work.untitled')}</button>
          </p>
        ) : (
          // The mockup-parity pass (gap map E6): «no task» is a fact about the row, said in the quiet report type,
          // never in the bold type a task title has.
          <p className="lh-arow-report lh-arow-none">{t('launch.home.inWork.noTask')}</p>
        )}
        <p className="lh-arow-report">
          {a.goal && !a.goal.isTask && a.task && (
            <><button type="button" className="lp-link" title={a.task.what ?? undefined} onClick={() => onTask(a.task!.projectId, a.task!.id)}>{taskTitle(a.task) || t('launch.home.work.untitled')}</button> · </>
          )}
          {a.doing ? (
            <>
              {a.doing.step && a.doing.ofSteps ? <><Progress step={a.doing.step} of={a.doing.ofSteps} /><span className="lh-arow-step">{t('launch.home.agents.step', { step: a.doing.step, of: a.doing.ofSteps })} · </span></> : null}
              {a.doing.text}
            </>
          ) : a.task?.what && a.task.what !== taskTitle(a.task) ? <span className="lh-arow-what">{a.task.what}</span>
            : <span className="lp-meta">{t('launch.home.agents.silent')}</span>}
        </p>
      </div>
      <p className="lh-arow-when">
        {/* UX-17: the word is said for every status, «working» too; the colour never stands alone. The mockup's quiet
            type (11.5px, muted), on its own line above the time; a quiet agent's time is the mockup's idle pill. */}
        <span className={`lh-status s-${status}`}>{t(`status.${status}` as 'status.idle')}</span>
        {a.stale
          ? <span className="lh-pill idle">{t('launch.home.inWork.quietFor', { time: heard })}</span>
          : <span className="lh-arow-heard">{t('launch.home.inWork.heard', { time: heard })}</span>}
        {/* Home gap D9: how long it has held its task, under the time, as the mockup says it («держит 1 ч 44 мин»). */}
        {a.task?.heldSince && <span className="lh-arow-held">{t('launch.home.inWork.held', { time: heldFor(a.task.heldSince, t) })}</span>}
      </p>
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
