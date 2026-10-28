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
 * header names the runner, its state, the project, the branch and the session. «Сейчас» on top: the task it holds with
 * its brief's «Что должно произойти», its newest report with «шаг N из M», how long it has held the task, and the
 * task's milestones. Then «Задачи», newest first, each opening to its brief, «Чем закончил» and «Вехи»
 * (`shared/agentTrail.ts`). The raw history stays at the foot, closed. On the right the session card: what Fabric
 * observes, the agent's own word on its phase, where the session runs, and «Открыть сессию», which opens the console
 * as a tab only when pressed (no console mounts on choosing the agent). «Результаты» as event types are gone: a task's
 * «Чем закончил» says it in words.
 *
 * The mockup parity, wave 1 (docs/reports/2026-10-27-mockup-parity/gaps/2026-10-27-agent.md): the layout of the approved mockup
 * (docs/reports/2026-10-26-simple-fabric/mockup.html `#agent`). «← Главная» above the header; the header's status is a
 * pill and comes first; v2's goal is a kicker line inside «Сейчас», never a box of its own; «Сейчас» always names the
 * task; the step is a bar with «шаг N из M» in bold and the hold time in the muted tail; milestones are a timeline;
 * the lanes are small chips on the «Задачи» row; each task is a card of its own with its status as a pill, its brief,
 * «Чем закончил», «Вехи» and «Нужна правка в другом проекте» inline; the session card adds «Агент», and under it
 * «Вопросы этого агента».
 */
import { useEffect, useState } from 'react'
import type { LiveAgent } from '../../../shared/homeLive'
import type { FeedEvent } from '../../../shared/types'
import { laneOf, SESSION_LANES, type SessionLane, type SessionTask, type SessionTasksView } from '../../../shared/sessionTasks.ts'
import { subjectOfEvent } from '../../../shared/eventSubject.ts'
import { mayHaveEarlier, SESSION_HISTORY_WINDOW, shownHistory } from '../../../shared/sessionHistory.ts'
import { lastPhase, taskTrail, type TaskTrail } from '../../../shared/agentTrail.ts'
import { agentStatus, type StatusTerminal } from '../../../shared/sessionStatus.ts'
import { StatusPill } from './StatusPill'
import { describeEvent, pluralForm, useLocale, useT, type Translate } from '../i18n'
import { runnerLabel } from '../runnerLabel'
import { heldFor, knownTime, since, untimed } from '../duration'
import { FailureNote } from '../OperatorError'
import { Progress } from './HomeInWork'
import { dayLabel } from './HistoryScreen'
import { CrossProjectConsole, type CrossProject } from './CrossProjectConsole'
import { NeedsYouCard } from './HomeParts'
import { useMediaQuery } from '../useMediaQuery'
import { boardEntries, type BoardEntry, type BoardQuestion } from '../../../shared/board.ts'
import type { AgentQuestion } from '../../../shared/sessionTasks.ts'

type Read = { at: 'reading' } | { at: 'ready'; events: FeedEvent[] } | { at: 'failed'; says: string; kept: FeedEvent[] | null }
type TasksRead = { at: 'reading' } | { at: 'ready'; view: SessionTasksView } | { at: 'failed'; says: string; kept: SessionTasksView | null }

/** What a heartbeat can wait on (`fabric_heartbeat` waitingOn.kind), said in words; an unknown kind is said not at all
 *  (the 0.3.14 review, iteration 2, UX-19: the raw code showed in the Russian interface). */
const WAITING_ON = new Set(['question', 'grant', 'continuation'])
const RELEASED_HOW = new Set(['done', 'handed-over', 'let-go', 'operator', 'session-ended', 'lapsed'])
/** The permission modes a console can be launched as (`shared/agents.ts`), said short in the session card. */
const PERMISSIONS = new Set(['plan', 'ask', 'bypass'])

/** The task a journal row is about, when `subjectOfEvent` can say so and the row names its project. */
export function taskOfEvent(e: FeedEvent): { projectId: string; taskId: string } | null {
  const subject = subjectOfEvent(e)
  if (!subject.known || (subject.ref.kind !== 'task' && subject.ref.kind !== 'work') || !e.project_id) return null
  return { projectId: e.project_id, taskId: subject.ref.id }
}

/** Whole days between a moment and today, by the calendar of this machine (0 = today, 1 = yesterday). */
function daysAgo(iso: string): number {
  const d = new Date(iso), now = new Date()
  const startOf = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  return Math.round((startOf(now) - startOf(d)) / 86_400_000)
}

/** A moment said day-relative, as the mockup does: «в 17:58» today, «вчера в 17:58», else «26 окт. в 17:58». */
export function atWords(iso: string, t: Translate, locale: string): string | null {
  const d = new Date(iso)
  // A time that does not parse says nothing, never «?» (the 0.3.15 review, iteration 2, UX-16).
  if (!Number.isFinite(d.getTime())) return null
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const days = daysAgo(iso)
  if (days === 0) return t('agentScreen.at.today', { time })
  if (days === 1) return t('agentScreen.at.yesterday', { time })
  return t('agentScreen.at.date', { date: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }), time })
}

export function AgentPage({ agent, mark, onConsole, onOpenProject, onOpenTask, title, state, actions, note, workUnread, where, terminal, goalsUnread,
  onHome, runnerVersion, permission, onQuestion, projectOf }: {
  agent: LiveAgent
  /** The goals could not be read (`main/agentGoals.ts`): said where the goal would be, never «not named» (ER-20). */
  goalsUnread?: string | null
  /** Who works was not read: the task and the action are unknown, never said as none (0.3.13 review, iteration 2, UX-3). */
  workUnread?: boolean
  /** Moves when the journal does: the page reads its history again. */
  mark: number
  /** «Открыть сессию» in the session card (0.3.14): opens the console Fabric holds as a tab, only when pressed. */
  onConsole?(sessionId: string): void
  /** Where the session runs: a console Fabric holds, a terminal outside Fabric, or not known (who joined was not read). */
  where?: 'fabric' | 'terminal' | 'unknown'
  /** Its console as Fabric holds it, for the status word (R-19); absent when it runs elsewhere. */
  terminal?: StatusTerminal | null
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
  /** «← Главная» above the header (the mockup's back link); absent: no link, the top bar's travel buttons remain. */
  onHome?(): void
  /** The runner's installed version (`start.executors`), for the session card's «Агент»; absent: not known. */
  runnerVersion?: string | null
  /** The permission mode its console was launched as (`TerminalSession.permissionMode`); said only for a console
   *  Fabric holds. */
  permission?: string | null
  /** Opens one of its questions on the board (its `BoardEntry.ref`); absent, a question card opens nothing. */
  onQuestion?(ref: string): void
  /** A project's row by id, for «Нужна правка в другом проекте» in a task row; absent or null: the action is not offered. */
  projectOf?(projectId: string): CrossProject | null
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  // CO-476: below 1000 px the session card follows «Сейчас» in the DOM, where the narrow layout shows it.
  const narrow = useMediaQuery('(max-width: 1000px)')
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
  const aliasKey = (agent.aliases ?? []).join(',')
  const [lane, setLane] = useState<SessionLane | 'all'>('all')
  /** The task row whose «Нужна правка в другом проекте» is open; one at a time. */
  const [xpOpen, setXpOpen] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    const of = agent.sessionId
    // A bridge without the read (an older preload) is a failed read, said as such, never «no task». CO-475: the agent's
    // earlier session ids are read with the live one, so a question asked before a re-enrolment is still its question.
    Promise.resolve().then(() => (aliasKey ? window.fabric.work.session(of, aliasKey.split(',')) : window.fabric.work.session(of))).then(
      (view) => { if (alive) setTasksRead({ at: 'ready', view, of }) },
      (e: unknown) => {
        if (alive) setTasksRead((r) => ({ at: 'failed', says: e instanceof Error ? e.message : String(e), kept: r.of === of && r.at === 'ready' ? r.view : null, of }))
      }
    )
    return () => { alive = false }
  }, [agent.sessionId, aliasKey, mark, tasksAttempt])
  const tasksMine = tasksRead.of === agent.sessionId ? tasksRead : ({ at: 'reading', of: agent.sessionId } as const)
  const tasksView = tasksMine.at === 'ready' ? tasksMine.view : tasksMine.at === 'failed' ? tasksMine.kept : null
  const nameOf = new Map((tasksView?.tasks ?? []).map((x) => [x.taskId, x.summary]))
  const at = (iso: string): string | null => atWords(iso, t, locale)
  /** A sentence with its moment, or the same sentence with the moment left out when it does not parse (UX-16). */
  const withAt = (key: Parameters<typeof t>[0], iso: string): string => { const time = at(iso); return time ? t(key, { time }) : untimed(t(key, { time: '' })) }
  /** «… назад», or nothing when the time does not parse (UX-16). */
  const ago = (key: Parameters<typeof t>[0], iso: string | null | undefined): string | null => (knownTime(iso) ? t(key, { time: since(iso, t) }) : null)
  // The 0.3.14 review, iteration 1, UX-8: each ending in words of its own (an ending the agent did not cause is not
  // said as its own), and an ending code this build does not know is said as not recorded, never shown raw. Handed in
  // with the task now in review is said as the mockup says it: «сдал на проверку».
  const endedOf = (x: SessionTask): string =>
    x.releasedAt
      ? withAt(x.releasedHow === 'done' && x.status === 'review' ? 'agentPage.ended.doneReview'
        : x.releasedHow && RELEASED_HOW.has(x.releasedHow) ? (`agentPage.ended.${x.releasedHow}` as 'agentPage.ended.done') : 'agentPage.ended.unknown', x.releasedAt)
      : x.via === 'claim' ? t('agentPage.taskHeld') : ''
  /** A task's status as the row's pill: its lane in words; a cancelled task in «done» is said as cancelled. */
  const pillOf = (x: SessionTask): { lane: SessionLane; words: string } => {
    const l = laneOf(x)
    return { lane: l, words: t(l === 'done' && x.status === 'cancelled' ? 'agentScreen.pill.cancelled' : (`agentScreen.pill.${l}` as 'agentScreen.pill.inWork')) }
  }
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
  const nowTitle = agent.task ? ((agent.task.title ?? current?.title ?? '').trim() || agent.task.summary) : ''
  const nowWhat = agent.task ? (agent.task.what ?? current?.brief.what ?? null) : null
  // «Вопросы этого агента»: its open questions as «Нужны вы» cards (the same card and answers as Главная), from the
  // session read; a read that did not happen is said as such, never «none».
  const questionsRead: AgentQuestion[] | null = tasksView?.questions ?? null
  const questionCards: BoardEntry[] = questionsRead ? boardEntries({
    questions: questionsRead.map((q): BoardQuestion => ({
      id: q.id, projectId: q.projectId, projectName: q.projectId ? (q.projectId === agent.projectId ? agent.projectName : projectOf?.(q.projectId)?.name ?? null) : null,
      text: q.text, kind: (q.kind ?? 'decision') as BoardQuestion['kind'], askedAt: q.askedAt, blocks: 0, servesActiveGoal: false,
      revision: q.revision, options: Array.isArray(q.options) ? (q.options as BoardQuestion['options']) : [], why: q.why
    })),
    attention: [], projectWeightOf: () => 1, now: new Date()
  }) : []
  const laneCounts = Object.fromEntries(SESSION_LANES.map((l) => [l, (tasksView?.tasks ?? []).filter((x) => laneOf(x) === l).length])) as Record<SessionLane, number>
  // The 0.3.14 review, iteration 2, UX-20: «Все» first and open until the person picks a lane, every task newest first,
  // as the operator asked («сверху самая последняя»); a lane of tasks not found shows only when it holds one (DA-4).
  // The mockup parity: the lanes are quiet chips, so an empty lane is not offered (unless it is the one pressed).
  const shownLane: SessionLane | 'all' = lane
  const laneTasks = (tasksView?.tasks ?? []).filter((x) => shownLane === 'all' || laneOf(x) === shownLane)
  const tabs: Array<SessionLane | 'all'> = ['all', ...SESSION_LANES.filter((l) => laneCounts[l] > 0 || l === shownLane)]
  // UX-13: «Цель» only for a goal the agent split from, or one the person set; a task that is its own root is the task.
  const goal = agent.goal && (!agent.goal.isTask || agent.goal.byPerson) ? agent.goal : null
  const currentTrail = agent.task && trails ? (trails.get(agent.task.id) ?? null) : null
  const historyFull = events ? mayHaveEarlier(events) : false
  const heard = agent.lastSignAt ?? agent.startedAt
  // The status from what Fabric observes and the agent's own word (R-19, `sessionStatus.ts`), said in a word.
  // ER-18: the same function and inputs as the left column and «В работе»; a phase counts only while fresh.
  const status = agentStatus(agent, terminal ?? null, { phase: phase ? { phase: phase.phase, at: phase.at } : null })
  const stateChip = state ?? (status === 'working' ? t('agentScreen.state.working') : status === 'idle' ? (ago('agentScreen.state.quiet', heard) ?? t('status.idle')) : t(`status.${status}` as 'status.idle'))
  const name = title ?? runnerLabel(agent.agent, t)
  const placeOf = where ?? (agent.console ? 'fabric' : 'terminal')
  // How long it has held the task, to the minute as the mockup says it (`heldFor`, the same as «В работе»).
  const heldTime = current && current.via === 'claim' && !current.releasedAt ? heldFor(current.claimedAt, t) : null
  const held = heldTime ? t('agentScreen.held', { time: heldTime }) : null
  const startedWords = daysAgo(agent.startedAt) === 0
    ? t('agentScreen.startedToday', { time: time(agent.startedAt) })
    : (at(agent.startedAt) ?? '')
  // «Агент»: the runner and its version (the caller's, else the session read's own, `start.executors` in main), and, for
  // a console Fabric holds, the permission mode it was launched as.
  const version = runnerVersion ?? tasksView?.runner?.version ?? null
  const agentFact = [
    version ? `${runnerLabel(agent.agent, t)} ${version}` : null,
    placeOf === 'fabric' && permission && PERMISSIONS.has(permission) ? t(`agentScreen.permission.${permission}` as 'agentScreen.permission.ask') : null
  ].filter(Boolean).join(' · ')
  const goalLine = goalsUnread ? (
    // ER-20: a failed goals read is said where the goal would be.
    <p className="as-now-goal" title={goalsUnread}>{t('agentScreen.goalLine', { goal: t('launch.home.inWork.goalsUnread') })}</p>
  ) : goal ? (
    <p className="as-now-goal" title={goal.what ?? undefined}>
      {goal.isTask ? t('agentScreen.goalIsTask') : t('agentScreen.goalLine', { goal: goal.text })}
      {goal.byPerson && <> · {t('agentScreen.goalByPerson')}</>}
      {onOpenTask && !goal.isTask && <> · <button type="button" className="lp-link" onClick={() => onOpenTask(goal.projectId, goal.taskId)}>{t('agentScreen.openGoal')}</button></>}
    </p>
  ) : null
  const trailOf = (x: SessionTask): React.ReactNode => {
    if (!trails && !x.releaseNote) return null
    const tr: TaskTrail | undefined = trails?.get(x.taskId)
    const endings = tr ? [...tr.endings.map((e) => ({ key: `e-${e.at}`, text: e.note })), ...tr.handoffs.map((h) => ({ key: `h-${h.name}-${h.at}`, text: t('agentScreen.handoff', { name: h.name, value: h.value }) }))] : []
    // The mockup parity: an older task's ending, past the history window, in the agent's own words from its claim.
    if (!endings.length && x.releaseNote) endings.push({ key: `note-${x.taskId}`, text: x.releaseNote })
    return (
      <>
        <div>
          <h5 className="as-kicker">{t('agentScreen.endedHow')}</h5>
          {endings.length === 1 ? <p className="ap-summary">{endings[0].text}</p>
            : endings.length > 1 ? <ul className="ap-summary as-ending">{endings.map((e) => <li key={e.key}>{e.text}</li>)}</ul>
            : <p className="lp-meta">{t('agentScreen.noEnding')}</p>}
        </div>
        <div>
          <h5 className="as-kicker">{t('agentScreen.milestones')}</h5>
          <Milestones list={tr ? tr.milestones : null} empty={t('agentScreen.noTaskMilestones')} current={laneOf(x) === 'inWork'} />
        </div>
      </>
    )
  }
  const side = (
    <aside className="as-side" aria-labelledby="agent-session-title">
      <section className="as-session">
        <h4 id="agent-session-title">{t('agentScreen.session')}</h4>
        <dl className="as-facts">
          <div><dt>{t('agentScreen.stateLabel')}</dt><dd><StatusPill status={status} words={stateChip} /></dd></div>
          <div><dt>{t('agentScreen.lastSign')}</dt><dd>{ago('launch.home.inWork.heard', heard) ?? t('duration.unknown')}</dd></div>
          {phase && (
            <div><dt>{t('agentScreen.claim')}</dt><dd>
              {t(`agentScreen.phase.${phase.phase}` as 'agentScreen.phase.working')}{phase.waitingOn && WAITING_ON.has(phase.waitingOn) ? ` (${t(`agentScreen.waitingOn.${phase.waitingOn}` as 'agentScreen.waitingOn.question')})` : ''}{' '}
              {knownTime(phase.at) && <small className="lp-meta as-claim-at">{t('agentScreen.claimAt', { time: since(phase.at, t) })}</small>}
            </dd></div>
          )}
          <div><dt>{t('agentScreen.where')}</dt><dd>{t(`agentScreen.where.${placeOf}` as 'agentScreen.where.fabric')}</dd></div>
          <div><dt>{t('agentScreen.started')}</dt><dd>{startedWords}</dd></div>
          {agentFact && <div><dt>{t('agentScreen.agentLabel')}</dt><dd>{agentFact}</dd></div>}
        </dl>
        {agent.console && onConsole ? (
          <>
            <button type="button" className="lp-button primary" onClick={() => onConsole(agent.sessionId)}>{t('agentScreen.openSession')}</button>
            <p className="lp-meta">{t('agentScreen.openSessionNote')}</p>
          </>
        ) : <p className="lp-meta">{t(placeOf === 'unknown' ? 'agentScreen.sessionUnknown' : 'agentScreen.sessionElsewhere')}</p>}
        {actions}
      </section>
      <section className="as-questions lh-qs" aria-labelledby="agent-questions-title">
        <h4 id="agent-questions-title">{t('agentScreen.questions')}</h4>
        {questionsRead === null
          ? (tasksMine.at === 'reading' ? <p className="lp-meta" role="status">{t('estate.reading')}</p>
            : <p className="lp-meta" title={tasksView?.questionsUnread}>{t('agentScreen.questionsNotRead')}</p>)
          : questionCards.length === 0 ? <p className="lp-meta">{t('agentScreen.questionsNone')}</p>
          : questionCards.map((item) => (
            <NeedsYouCard key={item.ref} item={item} onOpen={onQuestion}
              meta={<>{item.projectName && <b>{item.projectName}</b>}{' '}<span>· {since(item.waitingSince, t)}</span></>} />
          ))}
      </section>
    </aside>
  )
  return (
    <section className="as" aria-labelledby="agent-page-title" data-testid="agent-page">
      {onHome && <p className="as-back"><button type="button" className="lp-link" onClick={onHome}>{t('agentScreen.backHome')}</button></p>}
      <header className="as-head">
        <div className="as-head-words">
          <h3 id="agent-page-title" tabIndex={-1}>{name}</h3>
          <p className="as-meta">
            <StatusPill status={status} words={stateChip} />
            {agent.projectId
              ? <span>{t('agentScreen.projectWord')} <button type="button" className="lp-link" onClick={() => onOpenProject(agent.projectId!)}>{agent.projectName ?? t('launch.home.agents.noProject')}</button></span>
              : <span>{t('launch.home.agents.noProject')}</span>}
            {agent.branch
              ? <span className="rail-branch">{agent.branch}</span>
              : <span className="rail-branch unknown" title={t('rail.agents.branchUnknownWhy')}>{t('rail.agents.branchUnknown')}</span>}
            <span>{t('agentScreen.sessionWord')} <span className="as-mono">{agent.sessionId.slice(0, 8)}</span></span>
          </p>
        </div>
        <span className="lh-agents-actions">
          {agent.task && onOpenTask && (
            <button type="button" className="lp-button" onClick={() => onOpenTask(agent.task!.projectId, agent.task!.id)}>{t('agentPage.openThisTask')}</button>
          )}
          {agent.projectId && <button type="button" className="lp-button" onClick={() => onOpenProject(agent.projectId!)}>{t('agentScreen.openProject')}</button>}
        </span>
      </header>
      {note}
      <div className="as-cols">
        <div className="as-main">
          <section className="as-now" aria-labelledby="agent-now-title">
            <h4 id="agent-now-title" className="as-kicker">{t('agentScreen.now')}</h4>
            {/* The operator's second review (R-3): the goal, the root of its task's decomposition, as a line above the
                task (the mockup parity: one hero card, never a box of its own). */}
            {goalLine}
            {agent.task ? (
              <>
                {/* The mockup parity: the task's own title heads «Сейчас»; its brief's «what» is the muted line. */}
                <p className="as-now-task">{nowTitle || t('launch.home.work.untitled')}</p>
                {nowWhat && nowWhat !== nowTitle && <p className="as-now-what">{nowWhat}</p>}
              </>
            ) : <p className="as-now-task-none">{workUnread ? t('agentPage.taskUnread') : t('agentPage.noTask')}</p>}
            <p className="as-now-doing">
              {workUnread && !agent.doing ? <span>{t('agentPage.doingUnread')}</span> : agent.doing ? (
                <>
                  {agent.doing.step && agent.doing.ofSteps ? <Progress step={agent.doing.step} of={agent.doing.ofSteps} /> : null}
                  <span className="as-now-stage">
                    {agent.doing.step && agent.doing.ofSteps ? <><b>{t('launch.home.agents.step', { step: agent.doing.step, of: agent.doing.ofSteps })}</b> · </> : null}
                    {agent.doing.text}
                  </span>
                </>
              ) : <span className="lp-meta">{t('launch.home.agents.silent')}</span>}
              {(agent.doing || held) && (
                <span className="as-now-tail">{[agent.doing ? ago('launch.home.inWork.heard', agent.doing.at) : null, held].filter(Boolean).join(' · ')}</span>
              )}
            </p>
            {agent.task && events && (
              <>
                <h5 className="as-kicker as-now-miles">{t('agentScreen.nowMilestones')}</h5>
                <Milestones list={currentTrail ? currentTrail.milestones : null} empty={t('agentScreen.noTaskMilestones')} current={!!held} />
              </>
            )}
          </section>
          {narrow && side}
          <div className="as-tasks-head">
            <h4>{t('agentPage.tasks')}</h4>
            {tasksView && tasksView.tasks.length > 0 && <span className="lp-meta">{t('agentPage.tasksSub', { count: tasksView.tasks.length })}</span>}
            {tasksView && tasksView.tasks.length > 0 && (
              // The operator's second review (R-12): the tasks in lanes, each with its count; the lane opened is the
              // person's. The mockup parity: small chips on the heading's row, never a full-width tab bar.
              <div className="as-lanes" role="group" aria-label={t('agentScreen.lanes')}>
                {tabs.map((l) => (
                  <button key={l} type="button" className="as-chip" aria-pressed={shownLane === l} onClick={() => setLane(l)}>
                    {t(`agentScreen.lane.${l}` as 'agentScreen.lane.inWork')} <span className="as-chip-n">{l === 'all' ? tasksView.tasks.length : laneCounts[l]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {tasksMine.at === 'reading' && <p className="lp-meta" role="status">{t('agentPage.tasksReading')}</p>}
          {tasksMine.at === 'failed' && (
            <>
              <FailureNote said={t('agentPage.tasksUnreadable')} detail={tasksMine.says} />
              <button type="button" className="lp-button" onClick={() => setTasksAttempt((n) => n + 1)}>{t('agentPage.tasksRetry')}</button>
            </>
          )}
          {tasksView && (tasksView.tasks.length === 0
            ? (tasksMine.at === 'ready' && <p className="lp-meta">{t('agentPage.noTasks')}</p>)
            : laneTasks.length === 0 ? <p className="lp-meta">{t('agentScreen.laneEmpty')}</p> : (
              <ul className="ap-tasks" aria-label={t('agentPage.tasks')}>
                {laneTasks.map((x) => {
                  const brief = [['task.what', x.brief.what], ['task.why', x.brief.why], ['agentScreen.briefExpected', x.brief.expected]] as const
                  const pill = pillOf(x)
                  const xpProject = projectOf?.(x.projectId) ?? null
                  const xpId = `ap-xp-${x.taskId}`
                  return (
                    <li key={x.taskId} className="ap-task">
                      <details>
                        <summary>
                          <span className="ap-chev" aria-hidden="true" />
                          <span className="ap-task-words">
                            <b className="ap-task-title">{(x.title ?? '').trim() || x.summary || t('launch.home.work.untitled')}</b>
                            <small className="ap-task-meta">{[
                              x.projectId !== agent.projectId ? x.projectName : null,
                              withAt(x.via === 'launch' ? 'agentPage.taskLaunched' : 'agentPage.taskTaken', x.claimedAt),
                              endedOf(x),
                              x.claims > 1 ? t(`agentPage.taskTimes.${pluralForm(locale, x.claims)}` as 'agentPage.taskTimes.many', { count: x.claims }) : null
                            ].filter(Boolean).join(' · ')}</small>
                          </span>
                          <span className={`ap-pill l-${pill.lane}`}>{pill.words}</span>
                        </summary>
                        <div className="ap-task-body">
                          {brief.some(([, v]) => v) ? (
                            <dl className="ap-brief">
                              {brief.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{t(k)}</dt><dd>{v}</dd></div>)}
                            </dl>
                          ) : <p className="lp-meta">{t('agentPage.noBrief')}</p>}
                          {trailOf(x)}
                          <div className="ap-task-acts">
                            {onOpenTask && <button type="button" className="lp-button" onClick={() => onOpenTask(x.projectId, x.taskId)}>{t('agentPage.openThisTask')}</button>}
                            {xpProject && (
                              <button type="button" className="lp-button" aria-expanded={xpOpen === x.taskId} aria-controls={xpId}
                                onClick={() => setXpOpen((o) => (o === x.taskId ? null : x.taskId))}>{t('xp.title')}</button>
                            )}
                          </div>
                          {xpProject && xpOpen === x.taskId && (
                            <div id={xpId}>
                              <CrossProjectConsole inline project={xpProject} taskId={x.taskId} taskTitle={(x.title ?? '').trim() || x.summary || t('launch.home.work.untitled')} />
                            </div>
                          )}
                        </div>
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
            // UX-4 then the mockup parity: no heading of its own; the disclosure is named for assistive technology and
            // its summary says what it opens.
            <details className="ap-history" aria-label={t('agentScreen.history')}>
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
          )}
        </div>
        {!narrow && side}
      </div>
    </section>
  )
}

/** A task's milestones, newest first, as a timeline: «Шаг N.» and the agent's words, with when it said them; the newest
 *  is marked current while the task is held. `list` is null when the history (already read) holds no trail for the
 *  task: said as none, the same as an empty trail. */
function Milestones({ list, empty, current = false }: { list: TaskTrail['milestones'] | null; empty: string; current?: boolean }): React.JSX.Element {
  const t = useT(), locale = useLocale()
  if (!list || !list.length) return <p className="lp-meta">{empty}</p>
  return (
    <ol className="as-miles">
      {list.map((m, i) => (
        <li key={`${m.at}-${m.text}`} className={current && i === 0 ? 'cur' : undefined}>
          <time className="as-miles-time" dateTime={m.at}>{new Date(m.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</time>
          <span>{m.step ? `${t('agentScreen.stepShort', { step: m.step })} ` : ''}{m.text}{m.note ? <small className="lp-meta"> · {m.note}</small> : null}</span>
        </li>
      ))}
    </ol>
  )
}
// #endregion agent-page
