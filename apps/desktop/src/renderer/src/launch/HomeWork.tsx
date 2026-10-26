// #region home-work — docs: docs/evidence/plans/2026-10-14-operator-home/README.md#главная-scr-30
// Who is doing what, on the home (operator request 2026-10-14): the live agents in their own words, the work in
// progress and in review across projects, and the counts above them. One reading (`work.home`) serves all three, so
// the numbers in the strip and the rows below them never disagree. Plain language is the agents' own: a session's last
// stage report, a task's brief — never the prompt.

import { useEffect, useRef, useState } from 'react'
import type { ReviewItem, HomeView, LiveAgent, WorkItem } from '../../../shared/homeLive'
import { useLocale, useT } from '../i18n'
import { since } from '../duration'
import { runnerLabel } from '../runnerLabel'
import { FailureNote } from '../OperatorError'
import { useOpenConsole } from '../consoles'

/** `readAt`: when `view` was read. After a failed read the view kept is said to be that moment's (CO-313). `retry` reads
 *  again now, for a place that offers «Попробовать снова». */
export type HomeReading = { view: HomeView | null; problem: string | null; readAt?: string | null; retry?: () => void }

/** After a failed read, what still shows is the last reading: said with its time, never passed off as now (CO-313). */
export function KeptNote({ reading }: { reading: HomeReading }): React.JSX.Element | null {
  const t = useT(), locale = useLocale()
  if (!reading.problem || !reading.view || !reading.readAt) return null
  return <p className="lp-meta" role="status">{t('acts.stale', { time: new Date(reading.readAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</p>
}

/** A read behind this place that stopped at its limit (CO-310): said, so a missing agent is never read as «nobody». */
export function CappedNote({ reading }: { reading: HomeReading }): React.JSX.Element | null {
  const t = useT()
  const capped = reading.view?.capped ?? []
  if (!capped.length) return null
  return <p className="lp-meta" role="status">{t('launch.home.work.capped', { what: capped.map((c) => t(`launch.home.work.cappedWhat.${c}` as 'launch.home.work.cappedWhat.claims')).join(', ') })}</p>
}

const REFRESH_MS = 15_000
/** Rows a lane shows before «Ещё N» leads to the Board. */
const LANE_ROWS = 6
const hasMore = (n: number): boolean => n > LANE_ROWS

/** Reads `work.home` when the journal moves (claims, stages, tasks) and every 15 s for silence (a session that stops
 *  signing turns stale without an event). A failed read is said, never shown as "nobody is working". */
export function useHome(mark: number, enabled = true): HomeReading {
  const [reading, setReading] = useState<HomeReading>({ view: null, problem: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => setTick((n) => n + 1), REFRESH_MS)
    return () => clearInterval(timer)
  }, [enabled])
  useEffect(() => {
    // A detached console or editor window shows no home: it reads nothing (0.3.14: the shell reads once for the rail).
    if (!enabled) return
    let alive = true
    // Through a promise, so a build without the reading (an older preload, a test double) is said as a problem
    // rather than thrown out of the effect.
    Promise.resolve().then(() => window.fabric.work.home()).then(
      (view) => alive && setReading({ view, problem: null, readAt: new Date().toISOString() }),
      (e: unknown) => alive && setReading((r) => ({ view: r.view, readAt: r.readAt ?? null, problem: e instanceof Error ? e.message : String(e) }))
    )
    return () => {
      alive = false
    }
  }, [mark, tick, enabled])
  return { ...reading, retry: () => setTick((n) => n + 1) }
}

/** The counts above the board: agents working now, tasks in work, waiting for you, in review. `toReview`, when given, is
 *  what the Board's «На проверке» lists (reviews, proposals, abandoned work; null while unknown) and the cell opens that
 *  tab (0.3.12 review, iteration 3, UX-2); absent, the cell counts the tasks in review from this reading. */
export function HomeStats({ reading, waiting, toReview, onAgents, onBoard, onWaiting, onReview }: { reading: HomeReading; waiting: number | null; toReview?: number | null; onAgents(): void; onBoard(): void; onWaiting?(): void; onReview?(): void }): React.JSX.Element {
  const t = useT()
  const v = reading.view
  // After a failed read the last numbers are not current: the strip says it cannot tell (0.3.6 review ER-7).
  const known = v && !reading.problem ? v : null
  const working = known ? known.live.filter((l) => !l.stale).length : null
  // The same number the «В работе» lane heads with: a claim nobody is signing for is still in work, and says so there.
  const inWork = known ? known.inWork.length : null
  const cell = (n: number | string | null, label: string, onClick: () => void, tone = '') => (
    <button type="button" className={`lh-stat ${tone}`} onClick={onClick} title={reading.problem ? t('launch.home.work.unreadable') : undefined}>
      <b>{n === null ? '—' : n}</b>
      <span>{label}</span>
    </button>
  )
  return (
    <div className="lh-stats" role="group" aria-label={t('launch.home.stats.label')}>
      {cell(working, t('launch.home.stats.working'), onAgents, working ? 'live' : '')}
      {cell(inWork === null ? null : `${inWork}${known!.inWorkCapped ? '+' : ''}`, t('launch.home.stats.inWork'), onBoard)}
      {cell(waiting, t('launch.home.stats.waiting'), onWaiting ?? onBoard, waiting ? 'attention' : '')}
      {toReview !== undefined
        ? cell(toReview, t('launch.home.stats.review'), onReview ?? onBoard)
        : cell(known ? `${known.review.length}${known.reviewCapped ? '+' : ''}` : null, t('launch.home.stats.review'), onBoard)}
    </div>
  )
}

export function Doing({ item, bare = false }: { item: Pick<LiveAgent, 'doing'> & { summary?: string | null }; bare?: boolean }): React.JSX.Element {
  const t = useT()
  // D-4 (the operator's walk, 2026-10-22): the task an agent holds is what it is doing; its latest action changes every
  // second and says little. The action is shown only for an agent that holds no task.
  // In a project's narrow column the list already says what it lists: the task alone (0.3.11 review, iteration 2, UX-3).
  if (item.summary) return <span className="lh-doing" title={item.summary}>{bare ? item.summary : t('launch.home.agents.workingOn', { task: item.summary })}</span>
  if (item.doing) {
    return (
      <span className="lh-doing">
        {item.doing.text}
        {item.doing.step && item.doing.ofSteps ? <small> · {t('launch.home.agents.step', { step: item.doing.step, of: item.doing.ofSteps })}</small> : null}
      </span>
    )
  }
  return <span className="lh-doing muted">{item.summary ? t('launch.home.agents.workingOn', { task: item.summary }) : t('launch.home.agents.silent')}</span>
}

/** In work and in review, across projects: what is being done, by whom, where — the board's other two lanes. */
export function HomeWorkLanes({ reading, onOpen, onOpenTask, onSession, onBoard }: {
  reading: HomeReading
  onOpen(projectId: string): void
  /** CO-394: a lane's task opens its own page, as the kanban's card does; without it a lane opens the project. */
  onOpenTask?(projectId: string, taskId: string): void
  onSession(sessionId: string): void
  onBoard?: () => void
}): React.JSX.Element {
  const openTask = (projectId: string, taskId: string): void => (onOpenTask ? onOpenTask(projectId, taskId) : onOpen(projectId))
  const t = useT()
  const v = reading.view
  const work = (w: WorkItem) => (
    <li key={w.taskId} className="lh-work-row">
      <button type="button" className="lp-button lh-work-open" onClick={() => (w.console && w.sessionId ? onSession(w.sessionId) : openTask(w.projectId, w.taskId))}>
        <span className="lh-work-title">{w.summary || t('launch.home.work.untitled')}</span>
        <span className="lp-meta">
          {[w.projectName, w.agent ? runnerLabel(w.agent, t) : null, since(w.since, t)].filter(Boolean).join(' · ')}
        </span>
        {/* A live task with no stage says so, as «Агенты в работе» does — never a blank line (i2 UX-6); the title is already the summary. */}
        {w.live ? <Doing item={{ doing: w.doing }} /> : <span className="lp-pill">{t('launch.home.work.notSigning')}</span>}
      </button>
    </li>
  )
  // OF-18 (the operator's walk, 2026-10-22): two columns, «В работе» (review marked inside it) and «Закончили»;
  // the whole board, every stage, is one press away.
  const reviewRow = (r: ReviewItem) => (
    <li key={r.taskId} className="lh-work-row">
      <button type="button" className="lp-button lh-work-open" onClick={() => openTask(r.projectId, r.taskId)}>
        <span className="lh-work-title">{r.summary || t('launch.home.work.untitled')}</span>
        <span className="lp-meta">{[r.projectName, r.since ? since(r.since, t) : null].filter(Boolean).join(' · ')}</span>
        <span className="lp-pill">{t('launch.home.work.review')}</span>
      </button>
    </li>
  )
  const doneRow = (r: ReviewItem) => (
    <li key={r.taskId} className="lh-work-row">
      <button type="button" className="lp-button lh-work-open" onClick={() => openTask(r.projectId, r.taskId)}>
        <span className="lh-work-title">{r.summary || t('launch.home.work.untitled')}</span>
        <span className="lp-meta">{[r.projectName, r.since ? since(r.since, t) : null].filter(Boolean).join(' · ')}</span>
      </button>
    </li>
  )
  const inWorkCount = v ? v.inWork.length + v.review.length : 0
  // A reading without the finished list (an older main process) shows none rather than failing the home.
  const done = v?.done ?? []
  return (
    <section className="lp-panel lh-work" aria-labelledby="home-work-title">
      <div className="lp-panel-head">
        <div>
          <p className="lp-kicker">{t('launch.home.work.kicker')}</p>
          <h3 id="home-work-title">{t('launch.home.work.title')}</h3>
        </div>
        {onBoard && <button type="button" className="lp-button lh-text-link" onClick={onBoard}>{t('launch.home.board.open')}</button>}
      </div>
      {reading.problem && <FailureNote said={t('launch.home.work.unreadable')} detail={reading.problem} />}
      <KeptNote reading={reading} />
      <CappedNote reading={reading} />
      {!v && !reading.problem && <p className="lp-meta">{t('estate.reading')}</p>}
      {v && (
        <div className="lh-lanes">
          <div className="lh-lane">
            {/* The in-work count is the strip's own number (release review i2 DO-3); review is counted beside it. */}
            <h4>
              {t('launch.home.work.inWork')} <span className="lp-count">{v.inWork.length}{v.inWorkCapped ? '+' : ''}</span>
              {v.review.length > 0 && <span className="lp-meta"> · {t('launch.home.work.review')} {v.review.length}{v.reviewCapped ? '+' : ''}</span>}
            </h4>
            {inWorkCount ? (
              <ol>
                {v.inWork.slice(0, LANE_ROWS).map(work)}
                {v.review.slice(0, Math.max(0, LANE_ROWS - Math.min(LANE_ROWS, v.inWork.length))).map(reviewRow)}
              </ol>
            ) : <p className="lp-meta">{t('launch.home.work.noneInWork')}</p>}
            {hasMore(inWorkCount) && onBoard && <button type="button" className="lp-button lh-text-link" onClick={onBoard}>{t('launch.home.agents.more', { count: inWorkCount - LANE_ROWS })}</button>}
            {/* 0.3.14: work no agent holds and no session works on is not in «В работе»; the board lists it as «Брошено». */}
            {v.abandoned?.length && onBoard ? <button type="button" className="lp-button lh-text-link" onClick={onBoard}>{t('launch.home.work.abandoned', { count: v.abandoned.length })}</button> : null}
          </div>
          <div className="lh-lane">
            <h4>{t('launch.home.work.done')} <span className="lp-count">{v.doneUnread ? '?' : `${done.length}${v.doneCapped ? '+' : ''}`}</span></h4>
            {v.doneUnread && <FailureNote said={t('launch.home.work.unreadable')} detail={v.doneUnread} />}
            {!v.doneUnread && done.length > 0 && <ol>{done.slice(0, LANE_ROWS).map(doneRow)}</ol>}
            {!v.doneUnread && done.length === 0 && <p className="lp-meta">{t('launch.home.work.noneDone')}</p>}
            {hasMore(done.length) && onBoard && <button type="button" className="lp-button lh-text-link" onClick={onBoard}>{t('launch.home.agents.more', { count: done.length - LANE_ROWS })}</button>}
          </div>
        </div>
      )}
    </section>
  )
}

/** Every working session, in its own words: who, where, what it is doing now. Opens its console when Fabric holds
 *  one, else its project. */
export function HomeAgents({ reading, onOpen, onSession, onAll, onComms, projectId, title, selected, onSelect }: {
  reading: HomeReading
  /** On Агенты (CO-393): a row selects its agent, whose page opens beside the list, instead of leaving the place. */
  onSelect?(sessionId: string): void
  selected?: string | null
  /** OF-16: the one way to the comms from the home. */
  onComms?(): void
  onOpen(projectId: string): void
  onSession(sessionId: string): void
  /** «Все агенты»; absent on the Agents place itself. */
  onAll?(): void
  /** Only this project's agents (the project page); every agent when absent. */
  projectId?: string
  title?: string
}): React.JSX.Element {
  const t = useT()
  const v = reading.view
  // OF-17: active agents first, then the quiet ones; every one is listed, in a box that scrolls on its own.
  const live = (v?.live ?? []).filter((l) => !projectId || l.projectId === projectId).sort((a, b) => Number(a.stale) - Number(b.stale))
  const working = live.filter((l) => !l.stale).length
  return (
    <section className="lp-panel lh-agents" aria-labelledby="home-agents-title">
      <div className="lp-panel-head">
        <h3 id="home-agents-title">
          <span className={`lh-live-indicator ${working ? '' : 'is-quiet'}`} aria-hidden="true" />
          {title ?? t('launch.home.agents.title')} {v && <span className="lp-count">{working}</span>}
        </h3>
        <span className="lh-agents-actions">
          {onComms && <button type="button" className="lp-button lh-text-link" onClick={onComms}>{t('launch.home.agents.comms')}</button>}
          {onAll && <button type="button" className="lp-button lh-text-link" onClick={onAll}>{projectId ? t('launch.project.agents.all') : t('launch.home.agents.all')}</button>}
        </span>
      </div>
      {reading.problem && <FailureNote said={t('launch.home.work.unreadable')} detail={reading.problem} />}
      <KeptNote reading={reading} />
      <CappedNote reading={reading} />
      {!v && !reading.problem && <p className="lp-meta">{t('estate.reading')}</p>}
      {v && live.length === 0 && <p className="lp-meta">{t('launch.home.agents.none')}</p>}
      {/* OF-23: on a project page the project goes without saying, and a row takes one line. */}
      {live.length > 0 && (
        <ol className={`lh-agent-list lh-scrollbox ${projectId ? 'lh-compact' : ''}`}>
          {live.map((a) => {
            const inner = (
              <>
                <span className="lh-agent-head">
                  <b>{runnerLabel(a.agent, t)}</b>
                  {!projectId && <span className="lp-meta">{a.projectName ?? t('launch.home.agents.noProject')}</span>}
                  {a.stale ? <span className="lp-pill">{t('launch.home.agents.stale')}</span> : <small>{since(a.lastSignAt ?? a.startedAt, t)}</small>}
                </span>
                <Doing item={{ doing: a.doing, summary: a.task ? (a.task.summary || t('launch.home.work.untitled')) : null }} bare={!!projectId} />
              </>
            )
            // An agent with no console here and no project has nowhere to open: it is a row, not a dead button (ER-5).
            const go = a.console ? () => onSession(a.sessionId) : a.projectId ? () => onOpen(a.projectId!) : onAll
            return (
              <li key={a.sessionId} className={a.stale ? 'is-stale' : ''}>
                {onSelect
                  ? <button type="button" className={`lp-button lh-agent ${selected === a.sessionId ? 'is-selected' : ''}`} aria-pressed={selected === a.sessionId} onClick={() => onSelect(a.sessionId)}>{inner}</button>
                  : go
                  ? <button type="button" className="lp-button lh-agent" onClick={go} title={a.console ? t('launch.home.agents.openConsole') : a.projectId ? t('launch.home.agents.openProject') : undefined}>{inner}</button>
                  : <div className="lh-agent">{inner}</div>}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/**
 * The Agents place's list of who works now (the operator's walk OF-30, 2026-10-22): the same reading as the home, so an
 * agent opened in a terminal and joined through fabric-mcp is listed as well as a console Fabric holds; the console
 * opens in one press when Fabric holds one, else the agent's project.
 */
export function AgentsAtWork({ mark, onOpen, page }: {
  mark: number
  onOpen(projectId: string): void
  /** The agent's page beside the list (CO-393), drawn by the caller so this file does not import it back. */
  page?(agent: LiveAgent, openConsole: (sessionId: string) => void): React.ReactNode
}): React.JSX.Element {
  const t = useT()
  const reading = useHome(mark)
  const showConsole = useOpenConsole()
  const [problem, setProblem] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  // A press on a row brings the agent's page into view and focus (0.3.12 review UX-7): below 850 px the page sits under
  // the whole list, and nothing said it had opened. As the Board does for a picked row (CO-400).
  // The agent the person just picked, cleared by the first render that shows the pick: a reading of the place never moves
  // focus, and pressing the agent already chosen focuses its page at once (0.3.12 review, iteration 2, UX-3).
  const picked = useRef<string | null>(null)
  const focusPage = (): void => {
    const h = document.getElementById('agent-page-title')
    h?.focus({ preventScroll: true })
    h?.scrollIntoView?.({ block: 'nearest' })
  }
  const select = (sessionId: string): void => {
    if (sessionId === selected) { focusPage(); return }
    picked.current = sessionId
    setSelected(sessionId)
  }
  useEffect(() => {
    if (picked.current === null || picked.current !== selected) return
    picked.current = null
    focusPage()
  }, [selected])
  const openConsole = (sessionId: string): void => {
    setProblem(null)
    showConsole(sessionId).catch((e: unknown) => setProblem(e instanceof Error ? e.message : String(e)))
  }
  // An agent that has left the list leaves no page behind under its name.
  const chosen = (reading.view?.live ?? []).find((a) => a.sessionId === selected) ?? null
  return (
    <>
      {/* The place's own name, so a screen reader and the rail's focus move land on it (0.3.11 review, iteration 2, UX-10). */}
      <h2 className="visually-hidden" tabIndex={-1}>{t('agents.title')}</h2>
      {problem && <FailureNote said={t('launch.home.agents.consoleFailed')} detail={problem} />}
      {page ? (
        <div className="lh-agents-place">
          <HomeAgents reading={reading} onOpen={onOpen} onSession={openConsole} selected={chosen?.sessionId ?? null} onSelect={select} />
          {/* 0.3.12 review UX-3 (OF-30): «choose an agent» only when there is one to choose; a list that could not be read
              and a list with nobody in it are each said as what they are. */}
          {chosen ? page(chosen, openConsole)
            : !reading.view ? (reading.problem && (
              <div className="lp-meta lh-agent-pick" role="status">
                <p>{t('agentPage.unread')}</p>
                {reading.retry && <button type="button" className="lp-button" onClick={reading.retry}>{t('common.retry')}</button>}
              </div>
            ))
            : reading.view.live.length === 0 ? <p className="lp-meta lh-agent-pick">{t('agentPage.none')}</p>
            : <p className="lp-meta lh-agent-pick">{t('agentPage.pick')}</p>}
        </div>
      ) : <HomeAgents reading={reading} onOpen={onOpen} onSession={openConsole} />}
    </>
  )
}
// #endregion home-work
