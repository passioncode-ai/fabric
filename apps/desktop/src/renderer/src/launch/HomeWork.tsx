// #region home-work — docs: docs/evidence/plans/2026-10-14-operator-home/README.md#главная-scr-30
// Who is doing what, on the home (operator request 2026-10-14): the live agents in their own words, the work in
// progress and in review across projects, and the counts above them. One reading (`work.home`) serves all three, so
// the numbers in the strip and the rows below them never disagree. Plain language is the agents' own: a session's last
// stage report, a task's brief — never the prompt.

import { useEffect, useState } from 'react'
import type { HomeView, LiveAgent, WorkItem } from '../../../shared/homeLive'
import { useT } from '../i18n'
import { since } from '../duration'
import { runnerLabel } from '../runnerLabel'
import { FailureNote } from '../OperatorError'

export type HomeReading = { view: HomeView | null; problem: string | null }

const REFRESH_MS = 15_000
/** Rows a lane shows before «Ещё N» leads to the Board. */
const LANE_ROWS = 6
const hasMore = (n: number): boolean => n > LANE_ROWS

/** Reads `work.home` when the journal moves (claims, stages, tasks) and every 15 s for silence (a session that stops
 *  signing turns stale without an event). A failed read is said, never shown as "nobody is working". */
export function useHome(mark: number): HomeReading {
  const [reading, setReading] = useState<HomeReading>({ view: null, problem: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), REFRESH_MS)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    let alive = true
    // Through a promise, so a build without the reading (an older preload, a test double) is said as a problem
    // rather than thrown out of the effect.
    Promise.resolve().then(() => window.fabric.work.home()).then(
      (view) => alive && setReading({ view, problem: null }),
      (e: unknown) => alive && setReading((r) => ({ view: r.view, problem: e instanceof Error ? e.message : String(e) }))
    )
    return () => {
      alive = false
    }
  }, [mark, tick])
  return reading
}

/** The counts above the board: agents working now, tasks in work, waiting for you, in review. */
export function HomeStats({ reading, waiting, onAgents, onBoard }: { reading: HomeReading; waiting: number | null; onAgents(): void; onBoard(): void }): React.JSX.Element {
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
      {cell(waiting, t('launch.home.stats.waiting'), onBoard, waiting ? 'attention' : '')}
      {cell(known ? `${known.review.length}${known.reviewCapped ? '+' : ''}` : null, t('launch.home.stats.review'), onBoard)}
    </div>
  )
}

function Doing({ item }: { item: Pick<LiveAgent, 'doing'> & { summary?: string | null } }): React.JSX.Element {
  const t = useT()
  // D-4 (the operator's walk, 2026-10-22): the task an agent holds is what it is doing; its latest action changes every
  // second and says little. The action is shown only for an agent that holds no task.
  if (item.summary) return <span className="lh-doing">{t('launch.home.agents.workingOn', { task: item.summary })}</span>
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
export function HomeWorkLanes({ reading, onOpen, onSession, onBoard }: { reading: HomeReading; onOpen(projectId: string): void; onSession(sessionId: string): void; onBoard?: () => void }): React.JSX.Element {
  const t = useT()
  const v = reading.view
  const work = (w: WorkItem) => (
    <li key={w.taskId} className="lh-work-row">
      <button type="button" className="lp-button lh-work-open" onClick={() => (w.console && w.sessionId ? onSession(w.sessionId) : onOpen(w.projectId))}>
        <span className="lh-work-title">{w.summary || t('launch.home.work.untitled')}</span>
        <span className="lp-meta">
          {[w.projectName, w.agent ? runnerLabel(w.agent, t) : null, since(w.since, t)].filter(Boolean).join(' · ')}
        </span>
        {/* A live task with no stage says so, as «Агенты в работе» does — never a blank line (i2 UX-6); the title is already the summary. */}
        {w.live ? <Doing item={{ doing: w.doing }} /> : <span className="lp-pill">{t('launch.home.work.notSigning')}</span>}
      </button>
    </li>
  )
  return (
    <section className="lp-panel lh-work" aria-labelledby="home-work-title">
      <div className="lp-panel-head">
        <div>
          <p className="lp-kicker">{t('launch.home.work.kicker')}</p>
          <h3 id="home-work-title">{t('launch.home.work.title')}</h3>
        </div>
      </div>
      {reading.problem && <FailureNote said={t('launch.home.work.unreadable')} detail={reading.problem} />}
      {!v && !reading.problem && <p className="lp-meta">{t('estate.reading')}</p>}
      {v && (
        <div className="lh-lanes">
          <div className="lh-lane">
            <h4>{t('launch.home.work.inWork')} <span className="lp-count">{v.inWork.length}{v.inWorkCapped ? '+' : ''}</span></h4>
            {v.inWork.length ? <ol>{v.inWork.slice(0, LANE_ROWS).map(work)}</ol> : <p className="lp-meta">{t('launch.home.work.noneInWork')}</p>}
            {hasMore(v.inWork.length) && onBoard && <button type="button" className="lp-button lh-text-link" onClick={onBoard}>{t('launch.home.agents.more', { count: v.inWork.length - LANE_ROWS })}</button>}
          </div>
          <div className="lh-lane">
            <h4>{t('launch.home.work.review')} <span className="lp-count">{v.review.length}{v.reviewCapped ? '+' : ''}</span></h4>
            {v.review.length ? (
              <ol>
                {v.review.slice(0, LANE_ROWS).map((r) => (
                  <li key={r.taskId} className="lh-work-row">
                    <button type="button" className="lp-button lh-work-open" onClick={() => onOpen(r.projectId)}>
                      <span className="lh-work-title">{r.summary || t('launch.home.work.untitled')}</span>
                      <span className="lp-meta">{[r.projectName, r.since ? since(r.since, t) : null].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}
            {hasMore(v.review.length) && onBoard && <button type="button" className="lp-button lh-text-link" onClick={onBoard}>{t('launch.home.agents.more', { count: v.review.length - LANE_ROWS })}</button>}
            {v.review.length ? null : (
              <p className="lp-meta">{t('launch.home.work.noneInReview')}</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

/** Every working session, in its own words: who, where, what it is doing now. Opens its console when Fabric holds
 *  one, else its project. */
export function HomeAgents({ reading, onOpen, onSession, onAll, onComms, projectId, title }: {
  reading: HomeReading
  /** OF-16: the one way to the comms from the home. */
  onComms?(): void
  onOpen(projectId: string): void
  onSession(sessionId: string): void
  onAll(): void
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
          <button type="button" className="lp-button lh-text-link" onClick={onAll}>{projectId ? t('launch.project.agents.all') : t('launch.home.agents.all')}</button>
        </span>
      </div>
      {reading.problem && <FailureNote said={t('launch.home.work.unreadable')} detail={reading.problem} />}
      {!v && !reading.problem && <p className="lp-meta">{t('estate.reading')}</p>}
      {v && live.length === 0 && <p className="lp-meta">{t('launch.home.agents.none')}</p>}
      {live.length > 0 && (
        <ol className="lh-agent-list lh-scrollbox">
          {live.map((a) => (
            <li key={a.sessionId} className={a.stale ? 'is-stale' : ''}>
              <button type="button" className="lp-button lh-agent" onClick={() => (a.console ? onSession(a.sessionId) : a.projectId ? onOpen(a.projectId) : onAll())}
                title={a.console ? t('launch.home.agents.openConsole') : t('launch.home.agents.openProject')}>
                <span className="lh-agent-head">
                  <b>{runnerLabel(a.agent, t)}</b>
                  <span className="lp-meta">{a.projectName ?? t('launch.home.agents.noProject')}</span>
                  {a.stale ? <span className="lp-pill">{t('launch.home.agents.stale')}</span> : <small>{since(a.lastSignAt ?? a.startedAt, t)}</small>}
                </span>
                <Doing item={{ doing: a.doing, summary: a.task?.summary ?? null }} />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
// #endregion home-work
