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
 *
 * 0.3.14, the simple Fabric (docs/ux/2026-10-26-simple-fabric.md §3; the operator: «сначала мы показываем ... статус,
 * планинг ... справа ... её актуальную сессию ... и можно было открыть ее»): the agent's screen in two columns. Its
 * header names the runner and session, the project, the branch and the state. «Сейчас» on top: the task it holds with
 * its brief's «Что должно произойти», its newest report with «шаг N из M», how long it has held the task, and the
 * task's milestones. Then «Задачи», newest first, each opening to its brief, «Чем закончил» and «Вехи»
 * (`shared/agentTrail.ts`). The raw history stays at the foot, closed. On the right the session card: what Fabric
 * observes, the agent's own word on its phase, where the session runs, and «Открыть сессию», which opens the console
 * as a tab only when pressed (no console mounts on choosing the agent). «Результаты» as event types are gone: a task's
 * «Чем закончил» says it in words.
 */
import { useEffect, useState } from 'react'
import type { LiveAgent } from '../../../shared/homeLive'
import type { FeedEvent } from '../../../shared/types'
import { laneOf, SESSION_LANES, type SessionLane, type SessionTask, type SessionTasksView } from '../../../shared/sessionTasks.ts'
import { subjectOfEvent } from '../../../shared/eventSubject.ts'
import { mayHaveEarlier, SESSION_HISTORY_WINDOW, shownHistory } from '../../../shared/sessionHistory.ts'
import { lastPhase, taskTrail, type TaskTrail } from '../../../shared/agentTrail.ts'
import { sessionStatus } from '../../../shared/sessionStatus.ts'
import { describeEvent, pluralForm, useLocale, useT } from '../i18n'
import { runnerLabel } from '../runnerLabel'
import { since } from '../duration'
import { FailureNote } from '../OperatorError'
import { Progress } from './HomeInWork'
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

export function AgentPage({ agent, mark, onConsole, onOpenProject, onOpenTask, title, state, actions, note, workUnread, where, terminal }: {
  agent: LiveAgent
  /** Who works was not read: the task and the action are unknown, never said as none (0.3.13 review, iteration 2, UX-3). */
  workUnread?: boolean
  /** Moves when the journal does: the page reads its history again. */
  mark: number
  /** «Открыть сессию» in the session card (0.3.14): opens the console Fabric holds as a tab, only when pressed. */
  onConsole?(sessionId: string): void
  /** Where the session runs: a console Fabric holds, a terminal outside Fabric, or not known (who joined was not read). */
  where?: 'fabric' | 'terminal' | 'unknown'
  /** Its console as Fabric holds it, for the status word (R-19); absent when it runs elsewhere. */
  terminal?: { state: 'running' | 'idle' | 'ended'; exitCode: number | null } | null
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
  const [lane, setLane] = useState<SessionLane | null>(null)
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
  // The 0.3.14 review, iteration 1, UX-8: each ending in words of its own (an ending the agent did not cause is not
  // said as its own), and an ending code this build does not know is said as not recorded, never shown raw.
  const endedOf = (x: SessionTask): string =>
    x.releasedAt
      ? t(x.releasedHow && RELEASED_HOW.has(x.releasedHow) ? (`agentPage.ended.${x.releasedHow}` as 'agentPage.ended.done') : 'agentPage.ended.unknown', { time: when(x.releasedAt) })
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
  const days: Array<{ day: string; rows: FeedEvent[] }> = []
  for (const e of newest) {
    const day = dayLabel(e.occurred_at, t, locale)
    if (days.length && days[days.length - 1].day === day) days[days.length - 1].rows.push(e)
    else days.push({ day, rows: [e] })
  }
  const time = (iso: string): string => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  // The task trails: milestones, endings and handoffs, from the history and the session's holds (`agentTrail.ts`).
  const holds = (tasksView?.tasks ?? []).filter((x) => x.via === 'claim').map((x) => ({ taskId: x.taskId, from: x.claimedAt, to: x.releasedAt }))
  const trails = events ? taskTrail(events, holds) : null
  const phase = events ? lastPhase(events) : null
  const current = agent.task ? (tasksView?.tasks.find((x) => x.taskId === agent.task!.id) ?? null) : null
  const laneCounts = Object.fromEntries(SESSION_LANES.map((l) => [l, (tasksView?.tasks ?? []).filter((x) => laneOf(x) === l).length])) as Record<SessionLane, number>
  // Until the person picks one, the first lane that has a task is open.
  const shownLane: SessionLane = lane ?? SESSION_LANES.find((l) => laneCounts[l] > 0) ?? 'inWork'
  const laneTasks = (tasksView?.tasks ?? []).filter((x) => laneOf(x) === shownLane)
  const currentTrail = agent.task && trails ? (trails.get(agent.task.id) ?? null) : null
  const historyFull = events ? mayHaveEarlier(events) : false
  const heard = agent.lastSignAt ?? agent.startedAt
  // The status from what Fabric observes and the agent's own word (R-19, `sessionStatus.ts`), said in a word.
  const status = sessionStatus({ stale: agent.stale, phase: phase?.phase ?? null, terminal: terminal ?? null })
  const stateChip = state ?? (status === 'working' ? t('agentScreen.state.working') : status === 'idle' ? t('agentScreen.state.quiet', { time: since(heard, t) }) : t(`status.${status}` as 'status.idle'))
  const name = title ?? runnerLabel(agent.agent, t)
  const placeOf = where ?? (agent.console ? 'fabric' : 'terminal')
  const trailOf = (x: SessionTask): React.ReactNode => {
    if (!trails) return null
    const tr: TaskTrail | undefined = trails.get(x.taskId)
    return (
      <>
        <h5>{t('agentScreen.endedHow')}</h5>
        {tr && (tr.endings.length || tr.handoffs.length) ? (
          <ul className="as-ending">
            {tr.endings.map((e) => <li key={`e-${e.at}`}>{e.note}</li>)}
            {tr.handoffs.map((h) => <li key={`h-${h.name}-${h.at}`}>{t('agentScreen.handoff', { name: h.name, value: h.value })}</li>)}
          </ul>
        ) : <p className="lp-meta">{t('agentScreen.noEnding')}</p>}
        <h5>{t('agentScreen.milestones')}</h5>
        <Milestones list={tr ? tr.milestones : null} empty={t('agentScreen.noTaskMilestones')} />
      </>
    )
  }
  return (
    <section className="as" aria-labelledby="agent-page-title" data-testid="agent-page">
      <header className="as-head">
        <div className="as-head-words">
          <h3 id="agent-page-title" tabIndex={-1}>{t('agentScreen.title', { runner: name, id: agent.sessionId.slice(0, 8) })}</h3>
          <p className="as-meta">
            {agent.projectId
              ? <button type="button" className="lp-link" onClick={() => onOpenProject(agent.projectId!)}>{agent.projectName ?? t('launch.home.agents.noProject')}</button>
              : <span>{t('launch.home.agents.noProject')}</span>}
            {agent.branch
              ? <span className="rail-branch">{agent.branch}</span>
              : <span className="rail-branch unknown" title={t('rail.agents.branchUnknownWhy')}>{t('rail.agents.branchUnknown')}</span>}
            <span className={`lp-pill as-status s-${status} ${status === 'working' && !state ? 'live' : ''}`}><span className={`rail-dot s-${status}`} aria-hidden="true" /> {stateChip}</span>
          </p>
        </div>
        <span className="lh-agents-actions">
          {agent.task && onOpenTask && (
            <button type="button" className="lp-button" onClick={() => onOpenTask(agent.task!.projectId, agent.task!.id)}>{t('agentPage.openTask')}</button>
          )}
          {agent.projectId && <button type="button" className="lp-button" onClick={() => onOpenProject(agent.projectId!)}>{t('launch.home.agents.openProject')}</button>}
        </span>
      </header>
      {note}
      <div className="as-cols">
        <div className="as-main">
          {/* The operator's second review (R-3): the goal, the root of its task's decomposition, above what it does now. */}
          {agent.goal !== undefined && (
            <section className="as-goal" aria-labelledby="agent-goal-title">
              <h4 id="agent-goal-title">{t('agentScreen.goal')}</h4>
              {agent.goal ? (
                <>
                  <p className="as-now-task">{agent.goal.text}</p>
                  {agent.goal.what && agent.goal.what !== agent.goal.text && <p className="lp-meta">{agent.goal.what}</p>}
                  <p className="as-meta">
                    {agent.goal.byPerson && <span>{t('agentScreen.goalByPerson')}</span>}
                    {onOpenTask && <button type="button" className="lp-link" onClick={() => onOpenTask(agent.goal!.projectId, agent.goal!.taskId)}>{t('agentScreen.openGoal')}</button>}
                  </p>
                </>
              ) : <p className="lp-meta">{t('launch.home.inWork.noGoal')}</p>}
            </section>
          )}
          <section className="as-now" aria-labelledby="agent-now-title">
            <h4 id="agent-now-title">{t('agentScreen.now')}</h4>
            {agent.task ? (
              <>
                <p className="as-now-task">
                  {onOpenTask
                    ? <button type="button" className="lp-link" onClick={() => onOpenTask(agent.task!.projectId, agent.task!.id)}>{agent.task.summary || t('launch.home.work.untitled')}</button>
                    : (agent.task.summary || t('launch.home.work.untitled'))}
                </p>
                {current?.brief.what && current.brief.what !== agent.task.summary && <p className="lp-meta">{current.brief.what}</p>}
              </>
            ) : <p>{workUnread ? t('agentPage.taskUnread') : t('agentPage.noTask')}</p>}
            <p className="as-now-report">
              {workUnread && !agent.doing ? t('agentPage.doingUnread') : agent.doing ? (
                <>
                  {agent.doing.step && agent.doing.ofSteps ? <><Progress step={agent.doing.step} of={agent.doing.ofSteps} /><span className="lh-arow-step">{t('launch.home.agents.step', { step: agent.doing.step, of: agent.doing.ofSteps })} · </span></> : null}
                  {agent.doing.text}
                  <small className="lp-meta"> · {t('launch.home.inWork.heard', { time: since(agent.doing.at, t) })}</small>
                </>
              ) : <span className="lp-meta">{t('launch.home.agents.silent')}</span>}
            </p>
            {current && current.via === 'claim' && !current.releasedAt && <p className="lp-meta">{t('agentScreen.held', { time: since(current.claimedAt, t) })}</p>}
            {agent.task && events && (
              <>
                <h5>{t('agentScreen.nowMilestones')}</h5>
                <Milestones list={currentTrail ? currentTrail.milestones : null} empty={t('agentScreen.noTaskMilestones')} />
              </>
            )}
          </section>
          <h4>{t('agentPage.tasks')}</h4>
          {tasksMine.at === 'reading' && <p className="lp-meta" role="status">{t('agentPage.tasksReading')}</p>}
          {tasksMine.at === 'failed' && (
            <>
              <FailureNote said={t('agentPage.tasksUnreadable')} detail={tasksMine.says} />
              <button type="button" className="lp-button" onClick={() => setTasksAttempt((n) => n + 1)}>{t('agentPage.tasksRetry')}</button>
            </>
          )}
          {tasksView && tasksView.tasks.length > 0 && (
            // The operator's second review (R-12): the tasks in lanes, each with its count; the lane opened is the person's.
            <div className="lp-tabs as-lanes" role="group" aria-label={t('agentScreen.lanes')}>
              {SESSION_LANES.map((l) => (
                <button key={l} type="button" className="lp-tab" aria-pressed={shownLane === l} onClick={() => setLane(l)}>
                  {t(`agentScreen.lane.${l}` as 'agentScreen.lane.inWork')} <span className="lp-count">{laneCounts[l]}</span>
                </button>
              ))}
            </div>
          )}
          {tasksView && (tasksView.tasks.length === 0
            ? (tasksMine.at === 'ready' && <p className="lp-meta">{t('agentPage.noTasks')}</p>)
            : laneTasks.length === 0 ? <p className="lp-meta">{t('agentScreen.laneEmpty')}</p> : (
              <ul className="hx-list ap-tasks" aria-label={t('agentPage.tasks')}>
                {laneTasks.map((x) => {
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
                        {trailOf(x)}
                        {onOpenTask && <button type="button" className="lp-button" onClick={() => onOpenTask(x.projectId, x.taskId)}>{t('agentPage.openThisTask')}</button>}
                      </details>
                    </li>
                  )
                })}
              </ul>
            ))}
          {tasksView?.capped && <p className="lp-meta">{t('agentPage.tasksCapped', { count: tasksView.tasks.length })}</p>}
          {historyFull && <p className="lp-meta">{t('agentScreen.trailWindow', { count: SESSION_HISTORY_WINDOW })}</p>}
          {mine.at === 'failed' && (
            <>
              <FailureNote said={t('agentPage.unreadable')} detail={mine.says} />
              <button type="button" className="lp-button" onClick={() => setAttempt((n) => n + 1)}>{t('acts.retry')}</button>
            </>
          )}
          {mine.at === 'reading' && <p className="lp-meta" role="status">{t('estate.reading')}</p>}
          {events && (
            <>
              {/* UX-4: the heading stands outside the disclosure, which names what it opens. */}
              <h4 id="agent-page-history">{t('agentPage.did')}</h4>
              <details className="ap-history">
                <summary>{t('agentPage.historyOpen')}</summary>
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
        </div>
        <aside className="as-session lp-panel" aria-labelledby="agent-session-title">
          <h4 id="agent-session-title">{t('agentScreen.session')}</h4>
          <dl className="as-facts">
            <div><dt>{t('agentScreen.stateLabel')}</dt><dd>{stateChip}</dd></div>
            <div><dt>{t('agentScreen.lastSign')}</dt><dd>{t('launch.home.inWork.heard', { time: since(heard, t) })}</dd></div>
            {phase && (
              <div><dt>{t('agentScreen.claim')}</dt><dd>
                {t(`agentScreen.phase.${phase.phase}` as 'agentScreen.phase.working')}{phase.waitingOn ? ` (${phase.waitingOn})` : ''}{' '}
                <small className="lp-meta">{t('agentScreen.claimAt', { time: since(phase.at, t) })}</small>
              </dd></div>
            )}
            <div><dt>{t('agentScreen.where')}</dt><dd>{t(`agentScreen.where.${placeOf}` as 'agentScreen.where.fabric')}</dd></div>
            <div><dt>{t('agentScreen.started')}</dt><dd>{when(agent.startedAt)}</dd></div>
          </dl>
          {agent.console && onConsole ? (
            <>
              <button type="button" className="lp-button primary" onClick={() => onConsole(agent.sessionId)}>{t('agentScreen.openSession')}</button>
              <p className="lp-meta">{t('agentScreen.openSessionNote')}</p>
            </>
          ) : <p className="lp-meta">{t(placeOf === 'unknown' ? 'agentScreen.sessionUnknown' : 'agentScreen.sessionElsewhere')}</p>}
          {actions}
        </aside>
      </div>
    </section>
  )
}

/** A task's milestones, newest first: «Шаг N.» and the agent's words, with when it said them. `list` is null when the
 *  history (already read) holds no trail for the task: said as none, the same as an empty trail. */
function Milestones({ list, empty }: { list: TaskTrail['milestones'] | null; empty: string }): React.JSX.Element {
  const t = useT(), locale = useLocale()
  if (!list || !list.length) return <p className="lp-meta">{empty}</p>
  return (
    <ol className="as-miles">
      {list.map((m) => (
        <li key={`${m.at}-${m.text}`}>
          <time className="hx-time" dateTime={m.at}>{new Date(m.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</time>
          <span>{m.step ? `${t('agentScreen.stepShort', { step: m.step })} ` : ''}{m.text}{m.note ? <small className="lp-meta"> · {m.note}</small> : null}</span>
        </li>
      ))}
    </ol>
  )
}
// #endregion agent-page
