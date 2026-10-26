// #region agent-page — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
/**
 * One agent's page beside the list on Агенты (CO-393; the operator's walk OF-30, the flow of OF-09; decision W2-10):
 * its name, project and state, the ways out (console, project, task), the task it holds, what it is doing now, its
 * results, then everything its session did, newest first and by day. Read from the session's history, the same read
 * the console list uses, again when the journal moves; a failed read is said in its place with «Повторить».
 *
 * 0.3.14 (the operator, 2026-10-26: «посмотреть его флоу, как он по задачам шёл ... сверху самая последняя ... на каждую
 * задачу можно было развернуть, перейти к ней»): «Задачи» lists every task the session took, newest first
 * (`work.session`, `shared/sessionTasks.ts`); each row opens in place to its brief and «Открыть задачу». The raw
 * history moves below it, closed until opened, and a history row that is about a task names it and links to it.
 */
import { useEffect, useState } from 'react'
import type { LiveAgent } from '../../../shared/homeLive'
import type { FeedEvent } from '../../../shared/types'
import type { SessionTask, SessionTasksView } from '../../../shared/sessionTasks'
import { subjectOfEvent } from '../../../shared/eventSubject.ts'
import { eventKind } from '../../../shared/homeView.ts'
import { mayHaveEarlier, SESSION_HISTORY_WINDOW, shownHistory } from '../../../shared/sessionHistory.ts'
import { describeEvent, pluralForm, useLocale, useT } from '../i18n'
import { runnerLabel } from '../runnerLabel'
import { since } from '../duration'
import { FailureNote } from '../OperatorError'
import { Doing } from './HomeWork'
import { dayLabel } from './HistoryScreen'

type Read = { at: 'reading' } | { at: 'ready'; events: FeedEvent[] } | { at: 'failed'; says: string; kept: FeedEvent[] | null }
type TasksRead = { at: 'reading' } | { at: 'ready'; view: SessionTasksView } | { at: 'failed'; says: string; kept: SessionTasksView | null }

const BOARD_STATUS = new Set(['backlog', 'running', 'review', 'done'])
const RELEASED_HOW = new Set(['done', 'handed-over', 'let-go', 'operator', 'session-ended', 'lapsed'])

/** The task a journal row is about, when `subjectOfEvent` can say so and the row names its project. */
export function taskOfEvent(e: FeedEvent): { projectId: string; taskId: string } | null {
  const subject = subjectOfEvent(e)
  if (!subject.known || (subject.ref.kind !== 'task' && subject.ref.kind !== 'work') || !e.project_id) return null
  return { projectId: e.project_id, taskId: subject.ref.id }
}

export function AgentPage({ agent, mark, onConsole, onOpenProject, onOpenTask, title, state, actions, note, workUnread }: {
  agent: LiveAgent
  /** Who works was not read: the task and the action are unknown, never said as none (0.3.13 review, iteration 2, UX-3). */
  workUnread?: boolean
  /** Moves when the journal does: the page reads its history again. */
  mark: number
  /** Absent on Агенты' «Работа» tab (CO-419): the console is the tab beside it, not a button here. */
  onConsole?(sessionId: string): void
  onOpenProject(projectId: string): void
  onOpenTask?(projectId: string, taskId: string): void
  /** The agent's name when the caller knows it better than its runner id (a joined agent's own name). */
  title?: string
  /** The agent's state in words, said under its name instead of «last heard» (CO-419: waiting, its session ended). */
  state?: string
  /** More acts beside «Проект» and «Задача»: «Отключить» for a joined agent (SX-26). */
  actions?: React.ReactNode
  /** Under the header: a joined agent's proof line and a refused act's words. */
  note?: React.ReactNode
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [read, setRead] = useState<Read & { of: string }>({ at: 'reading', of: agent.sessionId })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    const of = agent.sessionId
    Promise.resolve().then(() => window.fabric.terminal.history(of)).then(
      (events) => { if (alive) setRead({ at: 'ready', events, of }) },
      (e: unknown) => {
        if (alive) setRead((r) => ({ at: 'failed', says: e instanceof Error ? e.message : String(e), kept: r.of === of && r.at === 'ready' ? r.events : null, of }))
      }
    )
    return () => { alive = false }
  }, [agent.sessionId, mark, attempt])
  const [tasksRead, setTasksRead] = useState<TasksRead & { of: string }>({ at: 'reading', of: agent.sessionId })
  const [tasksAttempt, setTasksAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    const of = agent.sessionId
    // A bridge without the read (an older preload) is a failed read, said as such, never «no task».
    Promise.resolve().then(() => window.fabric.work.session(of)).then(
      (view) => { if (alive) setTasksRead({ at: 'ready', view, of }) },
      (e: unknown) => {
        if (alive) setTasksRead((r) => ({ at: 'failed', says: e instanceof Error ? e.message : String(e), kept: r.of === of && r.at === 'ready' ? r.view : null, of }))
      }
    )
    return () => { alive = false }
  }, [agent.sessionId, mark, tasksAttempt])
  const tasksMine = tasksRead.of === agent.sessionId ? tasksRead : ({ at: 'reading', of: agent.sessionId } as const)
  const tasksView = tasksMine.at === 'ready' ? tasksMine.view : tasksMine.at === 'failed' ? tasksMine.kept : null
  const nameOf = new Map((tasksView?.tasks ?? []).map((x) => [x.taskId, x.summary]))
  const when = (iso: string): string => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const statusOf = (s: string): string =>
    s === 'cancelled' ? t('launch.project.cancelled') : BOARD_STATUS.has(s) ? t(`board.${s}` as 'board.done') : s === 'unknown' ? t('agentPage.statusUnknown') : s
  const endedOf = (x: SessionTask): string =>
    x.releasedAt
      ? t('agentPage.taskEnded', { time: when(x.releasedAt), how: x.releasedHow && RELEASED_HOW.has(x.releasedHow) ? t(`agentPage.how.${x.releasedHow}` as 'agentPage.how.done') : (x.releasedHow ?? '') })
      : x.via === 'claim' ? t('agentPage.taskHeld') : ''
  /** A history row's task: its name from the tasks read, else the event's own title, else the word «Задача». */
  const historyTask = (e: FeedEvent): React.ReactNode => {
    const of = taskOfEvent(e)
    if (!of) return null
    const name = nameOf.get(of.taskId) || (typeof e.payload.title === 'string' && e.payload.title.trim() ? e.payload.title.trim() : '') || t('agentPage.task')
    return onOpenTask
      ? <> · <button type="button" className="lp-link" onClick={() => onOpenTask(of.projectId, of.taskId)}>{name}</button></>
      : <> · {name}</>
  }
  // Another agent's reading never shows under this one's name while the new read is in flight.
  const mine = read.of === agent.sessionId ? read : ({ at: 'reading', of: agent.sessionId } as const)
  const events = mine.at === 'ready' ? mine.events : mine.at === 'failed' ? mine.kept : null
  const newest = [...shownHistory(events ?? [])].reverse()
  const results = newest.filter((e) => eventKind(e) === 'result')
  const days: Array<{ day: string; rows: FeedEvent[] }> = []
  for (const e of newest) {
    const day = dayLabel(e.occurred_at, t, locale)
    if (days.length && days[days.length - 1].day === day) days[days.length - 1].rows.push(e)
    else days.push({ day, rows: [e] })
  }
  const time = (iso: string): string => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  return (
    <section className="lp-panel lh-agent-page" aria-labelledby="agent-page-title" data-testid="agent-page">
      <div className="lp-panel-head">
        <div>
          <p className="lp-kicker">{agent.projectName ?? t('launch.home.agents.noProject')}</p>
          <h3 id="agent-page-title" tabIndex={-1}>{title ?? runnerLabel(agent.agent, t)}</h3>
          <p className="lp-meta">{state ?? (agent.stale ? t('launch.home.agents.stale') : t('agentPage.since', { time: since(agent.lastSignAt ?? agent.startedAt, t) }))}</p>
        </div>
        <span className="lh-agents-actions">
          {agent.console && onConsole && <button type="button" className="lp-button primary" onClick={() => onConsole(agent.sessionId)}>{t('launch.home.agents.openConsole')}</button>}
          {agent.projectId && <button type="button" className="lp-button" onClick={() => onOpenProject(agent.projectId!)}>{t('launch.home.agents.openProject')}</button>}
          {agent.task && onOpenTask && (
            <button type="button" className="lp-button" onClick={() => onOpenTask(agent.task!.projectId, agent.task!.id)}>{t('agentPage.openTask')}</button>
          )}
          {actions}
        </span>
      </div>
      {note}
      <h4>{t('agentPage.task')}</h4>
      <p>{agent.task ? (agent.task.summary || t('launch.home.work.untitled')) : workUnread ? t('agentPage.taskUnread') : t('agentPage.noTask')}</p>
      <h4>{t('agentPage.doing')}</h4>
      {/* The task has its own line above, so this says the action itself (D-4 keeps the task first in the list). */}
      {workUnread && !agent.doing ? <p>{t('agentPage.doingUnread')}</p> : <Doing item={{ doing: agent.doing, summary: null }} />}
      <h4>{t('agentPage.tasks')}</h4>
      {tasksMine.at === 'reading' && <p className="lp-meta" role="status">{t('agentPage.tasksReading')}</p>}
      {tasksMine.at === 'failed' && (
        <>
          <FailureNote said={t('agentPage.tasksUnreadable')} detail={tasksMine.says} />
          <button type="button" className="lp-button" onClick={() => setTasksAttempt((n) => n + 1)}>{t('agentPage.tasksRetry')}</button>
        </>
      )}
      {tasksView && (tasksView.tasks.length === 0
        ? (tasksMine.at === 'ready' && <p className="lp-meta">{t('agentPage.noTasks')}</p>)
        : (
          <ul className="hx-list ap-tasks" aria-label={t('agentPage.tasks')}>
            {tasksView.tasks.map((x) => {
              const brief = [['task.what', x.brief.what], ['task.why', x.brief.why], ['task.expected', x.brief.expected]] as const
              return (
                <li key={x.taskId} className="hx-row">
                  <details>
                    <summary>
                      <b>{x.summary || t('launch.home.work.untitled')}</b>
                      <small className="lp-meta"> {[
                        x.projectName,
                        statusOf(x.status),
                        t(x.via === 'launch' ? 'agentPage.taskLaunched' : 'agentPage.taskTaken', { time: when(x.claimedAt) }),
                        endedOf(x),
                        x.claims > 1 ? t(`agentPage.taskTimes.${pluralForm(locale, x.claims)}` as 'agentPage.taskTimes.many', { count: x.claims }) : null
                      ].filter(Boolean).join(' · ')}</small>
                    </summary>
                    {brief.some(([, v]) => v) ? (
                      <dl>
                        {brief.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{t(k)}</dt><dd>{v}</dd></div>)}
                      </dl>
                    ) : <p className="lp-meta">{t('agentPage.noBrief')}</p>}
                    {onOpenTask && <button type="button" className="lp-button" onClick={() => onOpenTask(x.projectId, x.taskId)}>{t('agentPage.openThisTask')}</button>}
                  </details>
                </li>
              )
            })}
          </ul>
        ))}
      {tasksView?.capped && <p className="lp-meta">{t('agentPage.tasksCapped', { count: tasksView.tasks.length })}</p>}
      {mine.at === 'failed' && (
        <>
          <FailureNote said={t('agentPage.unreadable')} detail={mine.says} />
          <button type="button" className="lp-button" onClick={() => setAttempt((n) => n + 1)}>{t('acts.retry')}</button>
        </>
      )}
      {mine.at === 'reading' && <p className="lp-meta" role="status">{t('estate.reading')}</p>}
      {events && (
        <>
          <h4>{t('agentPage.results')}</h4>
          {results.length === 0 ? <p className="lp-meta">{t('agentPage.noResults')}</p> : (
            <ul className="hx-list" aria-label={t('agentPage.results')}>
              {results.map((e) => (
                <li key={e.seq} className="hx-row"><div className="hx-act"><time className="hx-time" dateTime={e.occurred_at}>{time(e.occurred_at)}</time><span className="hx-said">{describeEvent(t, e.type)}</span></div></li>
              ))}
            </ul>
          )}
          <details className="ap-history">
            <summary><h4>{t('agentPage.did')}</h4></summary>
            <p className="lp-meta">{t('agentPage.historyLede')}</p>
            {newest.length === 0 ? <p className="lp-meta">{t('agents.noHistory')}</p> : (
              <ul className="hx-list" aria-label={t('agentPage.did')}>
                {days.map(({ day, rows }) => rows.map((e, i) => (
                  <li key={e.seq} className="hx-row">
                    {i === 0 && <p className="hx-day">{day}</p>}
                    <div className="hx-act"><time className="hx-time" dateTime={e.occurred_at}>{time(e.occurred_at)}</time><span className="hx-said">{describeEvent(t, e.type)}{historyTask(e)}</span></div>
                  </li>
                )))}
              </ul>
            )}
            {mayHaveEarlier(events) && <p className="lp-meta">{t('agents.historyEarlier', { count: SESSION_HISTORY_WINDOW })}</p>}
          </details>
        </>
      )}
    </section>
  )
}
// #endregion agent-page
