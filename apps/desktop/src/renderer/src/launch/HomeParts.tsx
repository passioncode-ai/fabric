// The launch home's own parts (SCR-30/SCR-01, docs/reports/product.html `launchHome`): the
// rhythm of work, the top of the board and what the agents did. Each reads what the window
// already holds and says which of its three states it is in — unread, read and empty, read.

import { runnerLabel } from '../runnerLabel'
import { useEffect, useRef, useState } from 'react'
import type { BoardCut, BoardEntry } from '../../../shared/board'
import type { WorkRhythm } from '../../../shared/workRhythm'
import type { ReadEnvelope } from '../../../shared/readEnvelope'
import type { AnswerReceipt, FeedEvent, ProjectRow, TerminalSession } from '../../../shared/types'
import { AnswerForm, submitAnswer } from '../BoardPanel'
import { liveIsFresh, liveRows, rhythmDays, rhythmTotals, RHYTHM_DAYS, type LiveRow } from '../../../shared/homeView.ts'
import { describeEvent, useLocale, useT } from '../i18n'
import { detailOf, titleOf } from '../attentionTitle'
import { since } from '../duration'
import { FailureNote } from '../OperatorError'

const sameDay = (iso: string, now: Date): boolean => new Date(iso).toDateString() === now.toDateString()
/** A time today, a date otherwise: "09:18" beside "yesterday's" 09:18 would read as today. In the
 *  operator's language, 24-hour where that language writes it so. */
const when = (iso: string, now: Date, locale: string): string =>
  sameDay(iso, now)
    ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })

/** The journal families «Нужны вы» follows (0.3.12 review, iteration 2, UX-1): the rail's count, the home's list and the
 *  Board's list move together, so a new access request or refusal is counted everywhere at once. */
export const NEEDS_YOU_FAMILIES = ['task', 'work', 'question', 'goal', 'proposal', 'grant', 'policy', 'effect', 'access'] as const

/** «Ритм работы» as main reads it (`work.rhythm`, the mockup parity, home gaps D1, D2); `problem` after a failed read,
 *  the last reading kept beside it. */
export type RhythmReading = { rhythm: WorkRhythm | null; problem: string | null }

/** Reads `work.rhythm` when the journal moves, one reading in flight at a time (as `useHome`): a mark that arrives while
 *  one runs asks for ONE more after it lands. A failed read keeps the last reading and says why; never zeros. */
export function useRhythm(mark: number, enabled = true): RhythmReading {
  const [reading, setReading] = useState<RhythmReading>({ rhythm: null, problem: null })
  const flight = useRef({ busy: false, dirty: false, alive: true })
  useEffect(() => {
    flight.current.alive = true
    return () => { flight.current.alive = false }
  }, [])
  useEffect(() => {
    if (!enabled) return
    const f = flight.current
    const read = (): void => {
      if (f.busy) { f.dirty = true; return }
      f.busy = true
      f.dirty = false
      Promise.resolve().then(() => window.fabric.work.rhythm()).then(
        (rhythm) => { if (f.alive) setReading({ rhythm, problem: null }) },
        (e: unknown) => { if (f.alive) setReading((r) => ({ rhythm: r.rhythm, problem: e instanceof Error ? e.message : String(e) })) }
      ).finally(() => {
        f.busy = false
        if (f.dirty && f.alive) read()
      })
    }
    read()
  }, [mark, enabled])
  return reading
}

/** The chart's days and totals: from main's per-day counts when given (`work.rhythm`), else from the feed the window
 *  holds (an older main process, a test double), whose cut days are unknown. */
function rhythmOf(rhythm: RhythmReading | undefined, feed: FeedEvent[] | null, now: Date): {
  days: Array<{ date: string; count: number; known: boolean; today: boolean }>
  /** Null: not read (the line says so, never a zero). */
  decisions: string | null
  results: string | null
  why?: string
} {
  if (rhythm) {
    const r = rhythm.rhythm
    const days = r
      ? r.days.map((d) => ({ date: d.date, count: d.events ?? 0, known: d.events !== null, today: d.today }))
      : rhythmDays(null, now).map((d, i, all) => ({ ...d, today: i === all.length - 1 }))
    const plus = r?.marksCapped ? '+' : ''
    const known = typeof r?.totals.decisions === 'number' && typeof r?.totals.results === 'number'
    return {
      days,
      decisions: known ? `${r!.totals.decisions}${plus}` : null,
      results: known ? `${r!.totals.results}${plus}` : null,
      why: rhythm.problem ?? r?.unread?.join('; ')
    }
  }
  const totals = rhythmTotals(feed, now)
  const days = rhythmDays(feed, now).map((d, i, all) => ({ ...d, today: i === all.length - 1 }))
  return { days, decisions: String(totals.decisions), results: String(totals.results) }
}

export function HomeRhythm({ feed, now, onPulse, rhythm }: {
  /** The window's journal: the pulse line's newest event (and the chart, when `rhythm` is absent). */
  feed: FeedEvent[] | null
  now: Date
  onPulse?: () => void
  /** Main's per-day counts (`useRhythm`): the chart and its totals. Absent: counted from the feed, as before. */
  rhythm?: RhythmReading
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const { days, decisions, results, why } = rhythmOf(rhythm, feed, now)
  const max = Math.max(1, ...days.map((d) => d.count))
  const latest = feed && feed.length ? feed.reduce((a, b) => (b.seq > a.seq ? b : a)) : null
  const moving = latest !== null && sameDay(latest.occurred_at, now)
  const label = (d: { date: string; count: number; known: boolean }) => {
    const date = `${d.date.slice(8)}.${d.date.slice(5, 7)}`
    return d.known ? t('launch.home.rhythm.day', { date, count: d.count }) : t('launch.home.rhythm.unknown', { date })
  }
  const span = t('launch.home.rhythm.days', { days: RHYTHM_DAYS })
  // The approved mockup (2026-10-26, `.activity`): the title and its days on the left, the totals on the right of one
  // row; the bars with today in ink; the pulse with the live dot and a lower-case «· последнее событие».
  return (
    <div className="lh-rhythm">
      <div className="lh-rhythm-head">
        <span className="lh-rhythm-title">
          {t('launch.home.rhythm')}{' '}
          <span className="lh-rhythm-days">
            {'· '}
            {onPulse
              ? <button type="button" className="lp-button lh-text-link" onClick={onPulse}>{span}</button>
              : span}
          </span>
        </span>
        <span className="lh-totals" title={why}>{decisions !== null && results !== null ? t('launch.home.rhythm.totals', { decisions, results }) : t('launch.home.rhythm.totalsUnread')}</span>
      </div>
      <div className="lh-spark" role="list" aria-label={t('launch.home.rhythm.label', { days: RHYTHM_DAYS })}>
        {days.map((d) => (
          <span key={d.date} role="listitem" aria-label={label(d)} title={label(d)}
            className={[d.known ? '' : 'unknown', d.today ? 'today' : ''].filter(Boolean).join(' ')}
            style={{ '--lh-bar': `${Math.max(5, (100 * d.count) / max)}%` } as React.CSSProperties}>
            <i />
          </span>
        ))}
      </div>
      <p className="lh-pulse-line">
        <span className={`lh-live-indicator ${moving ? '' : 'is-quiet'}`} aria-hidden="true" />
        <b>{feed === null ? t('launch.home.rhythm.unread') : moving ? t('launch.home.rhythm.moving') : t('launch.home.rhythm.quiet')}</b>
        {latest && <span className="lh-pulse-last">{' · '}{t('launch.home.rhythm.last', { time: when(latest.occurred_at, now, locale) })}</span>}
      </p>
    </div>
  )
}

/** CO-391 (OF-14): who asks, in words: the agent by its name when Fabric knows it, else «агент», or «человек». */
export function askerOf(item: BoardEntry, t: ReturnType<typeof useT>): string | null {
  if (!item.askedBy) return null
  if (item.askedBy.kind === 'person') return t('needsYou.askedByPerson')
  return item.askedBy.agent ? t('needsYou.askedByAgent', { agent: runnerLabel(item.askedBy.agent, t) }) : t('needsYou.askedByAnAgent')
}

/** How many items «Нужны вы» asks the board for: the right column is the place for them (the approved mockup shows every
 *  question as an open card, gap map F3), so the home no longer stops at three; past this, a line says how many more. */
export const NEEDS_YOU_LIMIT = 50

/** What the person resolves, from the SAME query the board runs, so the count here and the board never disagree (M151).
 *  The approved mockup (2026-10-26, `.side`): «Нужны вы» with a gold count, then one OPEN card per item: who asks and
 *  how long ago, the question, why it is asked, and its answers as buttons. The question opens the item on the board. */
type DetailLocale = Parameters<typeof detailOf>[2]

/** The muted line under a «Нужны вы» card: why it is asked. A question says its asker's own words (`why`, the asked
 *  question's «what cannot proceed») or nothing; never the board's count of the tasks it blocks, which read «Держит 1
 *  задачу» under a question as if it were the reason (found by the mockup parity's home harness). Any other item says
 *  its own detail, as the board does. */
export function whyOf(item: BoardEntry, t: ReturnType<typeof useT>, locale: DetailLocale): string | null {
  if (item.kind === 'question') return item.why?.trim() || null
  return detailOf(item, t, locale)
}

/** One «Нужны вы» card (the approved mockup, `.side .q`): who asks and how long ago, the question, why it is asked, and
 *  its answers as buttons, the first one gold. Answered where it is read; the question opens it on the board. Used on
 *  Главная and on an agent's page («Вопросы этого агента»), so a question looks and answers the same in both. */
export function NeedsYouCard({ item, onOpen, meta, nameOf }: {
  item: BoardEntry
  /** A project's printed name by id (`projectDisplayName`); absent: the name the board read. */
  nameOf?(projectId: string): string
  /** Opens the item on the board; absent, the question is plain text and the card opens nothing. */
  onOpen?(ref: string): void
  /** The card's first line when the caller words it otherwise (the agent page names no asker: it is the page's agent). */
  meta?: React.ReactNode
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [draft, setDraft] = useState('')
  const [receipt, setReceipt] = useState<AnswerReceipt | undefined>(undefined)
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const answer = async (option?: string): Promise<void> => {
    setSending(true)
    setProblem(null)
    try {
      const r = await submitAnswer(item, draft, option)
      setReceipt(r)
      if (r.committed) setDraft('')
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }
  const options = item.question?.options ?? []
  const why = whyOf(item, t, locale)
  return (
    // OF-14 (the operator's walk, 2026-10-22): each card says who asks and why; the question opens it on the board.
    <article className={onOpen ? 'lh-q' : 'lh-q lh-q-still'} aria-label={titleOf(item, t)}
      onClick={(e) => { if (onOpen && !(e.target as HTMLElement).closest('button,a,input,textarea,label,select')) onOpen(item.ref) }}>
      <p className="lh-q-from">
        {meta ?? (
          <>
            {/* The spaces between the parts keep the line one sentence for a screen reader and for copying. */}
            {(item.projectId && nameOf ? nameOf(item.projectId) : item.projectName) && <b>{item.projectId && nameOf ? nameOf(item.projectId) : item.projectName}</b>}
            {askerOf(item, t) && <>{' '}<span>· {askerOf(item, t)}</span></>}
            {' '}<span>· {since(item.waitingSince, t)}</span>
          </>
        )}
      </p>
      <p className="lh-q-text">
        {onOpen
          ? <button type="button" className="lh-q-open" title={t('launch.home.board.openOne')} onClick={() => onOpen(item.ref)}>{titleOf(item, t)}</button>
          : titleOf(item, t)}
      </p>
      {why && <p className="lh-q-why">{why}</p>}
      {problem && <FailureNote said={t('needsYou.unreadable')} detail={problem} />}
      {/* SCN-163 step 2 (CO-391): a question is answered where it is read, the options as buttons. */}
      {receipt?.committed ? (
        <AnswerForm look="launch" item={item} draft="" onDraft={() => {}} receipt={receipt} sending={false} onSubmit={() => {}} />
      ) : item.question && options.length > 0 ? (
        <>
          {receipt && <p className="lh-q-why" role="alert">{receipt.reason}</p>}
          <div className="lh-q-acts" role="group" aria-label={t('launch.board.options')}>
            {options.map((o, i) => (
              <button key={o.id} type="button" className={`lh-q-btn ${i === 0 ? 'gold' : ''}`} disabled={sending}
                title={o.consequence} onClick={() => void answer(o.id)}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : item.question ? (
        <AnswerForm look="launch" item={item} draft={draft} onDraft={setDraft}
          receipt={receipt} sending={sending} onSubmit={(option) => void answer(option)} />
      ) : onOpen ? (
        <div className="lh-q-acts">
          <button type="button" className="lh-q-btn" onClick={() => onOpen(item.ref)}>{t('launch.home.board.openOne')}</button>
        </div>
      ) : null}
    </article>
  )
}

/** What the person resolves, from the SAME query the board runs, so the count here and the board never disagree (M151).
 *  The approved mockup (2026-10-26, `.side`): «Нужны вы» with a gold count, then one OPEN card per item (`NeedsYouCard`). */
export function HomeBoard({ feedMark, onBoard, onTotal, nameOf }: { feedMark: number; onBoard(item?: string): void; /** A project's printed name by id (`projectDisplayName`). */ nameOf?(projectId: string): string; /** Kept for callers; the home no longer shows «Добавить тему» (gap map F4). */ onAddTopic?(): void; /** The person's count, for Главная's greeting (SCN-163). */ onTotal?(total: number | null): void }): React.JSX.Element {
  const t = useT()
  const [view, setView] = useState<ReadEnvelope<BoardCut> | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    try {
      // CO-391 (OF-14): only what the person can resolve; what an agent can settle lives on the Board.
      void window.fabric.board.query({ projectId: null, limit: NEEDS_YOU_LIMIT, personOnly: true }).then(
        (v) => { if (alive) { setView(v); setProblem(null); onTotal?.(v.data?.total ?? null) } },
        (e: unknown) => { if (alive) { setProblem(e instanceof Error ? e.message : String(e)); onTotal?.(null) } }
      )
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onTotal is a setter from the parent; the reading follows the feed only
  }, [feedMark])
  const cut = view?.data ?? null
  const unread = (view?.sources ?? []).filter((s) => s.status !== 'ok')
  return (
    <section className="lh-board lh-qs" id="sec-board" aria-labelledby="home-board-title">
      <h3 id="home-board-title" className="lh-side-title">
        {t('launch.home.board.title')}
        {cut && cut.total > 0 && <span className="lh-pill attention">{cut.total}</span>}
      </h3>
      {problem && <FailureNote said={t('needsYou.unreadable')} detail={problem} />}
      {unread.length > 0 && <p className="lp-meta" role="status">{t('needsYou.partial', { sources: unread.map((s) => s.name).join(', ') })}</p>}
      {!cut && !problem && <p className="lp-meta">{t('estate.reading')}</p>}
      {cut && cut.total === 0 && unread.length === 0 && (
        <div className="lh-q lh-q-clear"><p className="lh-q-text">{t('launch.home.board.clear')}</p><p className="lh-q-why">{t('launch.home.board.clearBody')}</p></div>
      )}
      {cut?.items.map((item: BoardEntry) => <NeedsYouCard key={item.ref} item={item} nameOf={nameOf} onOpen={(ref) => onBoard(ref)} />)}
      {cut && cut.hidden > 0 && (
        <button type="button" className="lp-link lh-q-more" onClick={() => onBoard()}>{t('launch.home.board.more', { count: cut.hidden })}</button>
      )}
    </section>
  )
}

export function HomeLive({ feed, projects, sessions, now, onOpen, onAll }: {
  feed: FeedEvent[] | null
  projects: ProjectRow[]
  sessions: TerminalSession[] | null
  now: Date
  onOpen(projectId: string): void
  onAll(): void
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [frozen, setFrozen] = useState<LiveRow[] | null>(null)
  const current = liveRows(feed, 5)
  const rows = frozen ?? current
  const nameOf = (id: string | null) => (id ? (projects.find((p) => p.id === id)?.name ?? id.slice(0, 8)) : '—')
  const programOf = (sessionId: string) => sessions?.find((s) => s.sessionId === sessionId)?.program ?? t('launch.home.live.agent')
  const fresh = liveIsFresh(rows, now)
  return (
    <section className="lp-panel lh-live" aria-labelledby="home-live-title">
      <div className="lp-panel-head">
        <h3 id="home-live-title">
          <span className={`lh-live-indicator ${fresh && !frozen ? '' : 'is-quiet'}`} aria-hidden="true" />
          {t('launch.home.live.title')} <span className="lh-live-label">{t('launch.home.live.label')}</span>
        </h3>
        <button type="button" className="lp-button lh-text-link" aria-pressed={frozen !== null}
          onClick={() => setFrozen(frozen ? null : (current ?? []))}>
          {frozen ? t('launch.home.live.resume') : t('launch.home.live.pause')}
        </button>
      </div>
      <p className="lp-meta">
        {rows === null ? t('journal.reading') : rows.length ? t('launch.home.live.latest', { time: when(rows[0].occurredAt, now, locale) }) : t('launch.home.live.none')}
        {frozen ? ` · ${t('launch.home.live.paused')}` : ''}
      </p>
      {rows && rows.length > 0 && (
        <ol className="lh-events">
          {rows.map((r) => (
            <li key={r.seq}>
              <span className="lh-event-dot" aria-hidden="true" />
              <div>
                <div className="lh-event-meta"><b>{programOf(r.sessionId)} <span>· {nameOf(r.projectId)}</span></b><time dateTime={r.occurredAt}>{when(r.occurredAt, now, locale)}</time></div>
                <p>{describeEvent(t, r.type)}</p>
                <details>
                  <summary>{t('launch.home.live.context')}</summary>
                  <p>{t('launch.home.live.where', { project: nameOf(r.projectId), program: programOf(r.sessionId) })}</p>
                  {r.projectId && (
                    <button type="button" className="lp-button lh-text-link" onClick={() => onOpen(r.projectId!)}>{t('launch.home.live.openProject')}</button>
                  )}
                </details>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="lp-button lh-text-link" onClick={onAll}>{t('launch.home.live.all')}</button>
    </section>
  )
}
