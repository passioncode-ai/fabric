// The launch home's own parts (SCR-30/SCR-01, docs/reports/product.html `launchHome`): the
// rhythm of work, the top of the board and what the agents did. Each reads what the window
// already holds and says which of its three states it is in — unread, read and empty, read.

import { runnerLabel } from '../runnerLabel'
import { useEffect, useState } from 'react'
import type { BoardCut, BoardEntry } from '../../../shared/board'
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

export function HomeRhythm({ feed, now, onPulse }: { feed: FeedEvent[] | null; now: Date; onPulse?: () => void }): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const days = rhythmDays(feed, now), totals = rhythmTotals(feed, now)
  const max = Math.max(1, ...days.map((d) => d.count))
  const latest = feed && feed.length ? feed.reduce((a, b) => (b.seq > a.seq ? b : a)) : null
  const moving = latest !== null && sameDay(latest.occurred_at, now)
  const label = (d: { date: string; count: number; known: boolean }) => {
    const date = `${d.date.slice(8)}.${d.date.slice(5, 7)}`
    return d.known ? t('launch.home.rhythm.day', { date, count: d.count }) : t('launch.home.rhythm.unknown', { date })
  }
  return (
    <div className="lh-rhythm">
      <span className="lh-rhythm-title">
        {t('launch.home.rhythm')}{' '}
        {onPulse
          ? <button type="button" className="lp-button lh-text-link" onClick={onPulse}>{t('launch.home.rhythm.days', { days: RHYTHM_DAYS })}</button>
          : <small>{t('launch.home.rhythm.days', { days: RHYTHM_DAYS })}</small>}
      </span>
      <div className="lh-spark" role="list" aria-label={t('launch.home.rhythm.label', { days: RHYTHM_DAYS })}>
        {days.map((d) => (
          <span key={d.date} role="listitem" aria-label={label(d)} title={label(d)} className={d.known ? '' : 'unknown'}
            style={{ '--lh-bar': `${Math.max(5, (100 * d.count) / max)}%` } as React.CSSProperties}>
            <i />
          </span>
        ))}
      </div>
      <span className="lh-totals">{t('launch.home.rhythm.totals', { decisions: totals.decisions, results: totals.results })}</span>
      <span className="lh-pulse-title">
        <span className="fp-signal" aria-hidden="true">{t('glyph.signal')}</span>
        <b>{feed === null ? t('launch.home.rhythm.unread') : moving ? t('launch.home.rhythm.moving') : t('launch.home.rhythm.quiet')}</b>
        {latest && <small>{t('launch.home.rhythm.last', { time: when(latest.occurred_at, now, locale) })}</small>}
      </span>
    </div>
  )
}

/** CO-391 (OF-14): who asks, in words: the agent by its name when Fabric knows it, else «агент», or «человек». */
export function askerOf(item: BoardEntry, t: ReturnType<typeof useT>): string | null {
  if (!item.askedBy) return null
  if (item.askedBy.kind === 'person') return t('needsYou.askedByPerson')
  return item.askedBy.agent ? t('needsYou.askedByAgent', { agent: runnerLabel(item.askedBy.agent, t) }) : t('needsYou.askedByAnAgent')
}

/** The top three of the SAME query the board runs, so the count here and the board never disagree (M151). */
export function HomeBoard({ feedMark, onBoard, onAddTopic, onTotal }: { feedMark: number; onBoard(item?: string): void; onAddTopic?(): void; /** The person's count, for Главная's greeting (SCN-163). */ onTotal?(total: number | null): void }): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [view, setView] = useState<ReadEnvelope<BoardCut> | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [receipt, setReceipt] = useState<Record<string, AnswerReceipt>>({})
  const [sending, setSending] = useState<string | null>(null)
  const answer = async (item: BoardEntry, option?: string): Promise<void> => {
    setSending(item.ref)
    try {
      const r = await submitAnswer(item, draft[item.ref] ?? '', option)
      setReceipt((m) => ({ ...m, [item.ref]: r }))
      if (r.committed) setDraft((d) => ({ ...d, [item.ref]: '' }))
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(null)
    }
  }
  useEffect(() => {
    let alive = true
    try {
      // CO-391 (OF-14): only what the person can resolve; what an agent can settle lives on the Board.
      void window.fabric.board.query({ projectId: null, limit: 3, personOnly: true }).then(
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
    <section className="lp-panel lh-board" id="sec-board" aria-labelledby="home-board-title">
      <div className="lp-panel-head">
        <div>
          <p className="lp-kicker">{t('launch.home.board.kicker')}</p>
          <h3 id="home-board-title">{t('launch.home.board.title')} {cut && <span className="lp-count">{cut.total}</span>}</h3>
        </div>
        <button type="button" className="lp-button primary" onClick={() => onBoard()}>{t('launch.home.board.open')}</button>
      </div>
      {problem && <FailureNote said={t('needsYou.unreadable')} detail={problem} />}
      {unread.length > 0 && <p className="lp-meta" role="status">{t('needsYou.partial', { sources: unread.map((s) => s.name).join(', ') })}</p>}
      {!cut && !problem && <p className="lp-meta">{t('estate.reading')}</p>}
      {cut && cut.total === 0 && unread.length === 0 && (
        <div className="lp-empty"><h3>{t('launch.home.board.clear')}</h3><p>{t('launch.home.board.clearBody')}</p></div>
      )}
      {/* OF-14 (the operator's walk, 2026-10-22): each row says who asks and why, and opens in place to read all of it. */}
      {cut?.items.map((item: BoardEntry, i) => (
        <details key={item.ref} className="lh-need">
          <summary className="lp-topic">
            <span className="lp-topic-num">{String(i + 1).padStart(2, '0')}</span>
            <span>
              <span className="lp-topic-title">{titleOf(item, t)}</span>
              {(item.projectName || item.askedBy) && <span className="lp-meta">{[item.projectName, askerOf(item, t)].filter(Boolean).join(' · ')}</span>}
            </span>
            <span className="lp-topic-end">
              <span className={`lp-pill ${item.origin === 'authored' ? 'attention' : ''}`}>{t(`needsYou.kind.${item.kind}` as 'needsYou.kind.question')}</span>
              <small>{since(item.waitingSince, t)}</small>
            </span>
          </summary>
          <div className="lh-need-body">
            {item.detail ? <p>{detailOf(item, t, locale)}</p> : <p className="lp-meta">{t('launch.home.board.noDetail')}</p>}
            {/* SCN-163 step 2 (CO-391): a question is answered where it is read, the options as buttons. */}
            {item.question && (
              <AnswerForm look="launch" item={item} draft={draft[item.ref] ?? ''} onDraft={(v) => setDraft((d) => ({ ...d, [item.ref]: v }))}
                receipt={receipt[item.ref]} sending={sending === item.ref} onSubmit={(option) => void answer(item, option)} />
            )}
            <button type="button" className="lp-button" onClick={() => onBoard(item.ref)}>{t('launch.home.board.openOne')}</button>
          </div>
        </details>
      ))}
      <div className="lp-panel-foot">
        <span>{t('launch.home.board.foot')}</span>
        {onAddTopic && <button type="button" className="lp-button" onClick={onAddTopic}>{t('launch.board.addTopic')}</button>}
      </div>
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
