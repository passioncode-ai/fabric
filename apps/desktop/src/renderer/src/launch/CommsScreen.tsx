// #region comms-screen — docs: docs/ux/screens.md#scr-81-project-comms
// Comms (SCR-81 · SCN-143): what projects tell each other, read by the operator with
// their own eyes. The name is Comms, not Board — the kanban owns that word
// (launch.nav.board), and ADR-0117 amendment 1 kept "board" out of user-facing text
// until this screen was designed.
//
// The rules the scenario sets, held here:
//
// - READ-ONLY. No write control: the operator reads; reply/stop/pause arrive with
//   their own scenarios, and no button here promises a recovery the contract does
//   not support.
// - UNAVAILABLE IS NOT EMPTY. A board that did not answer says so with Try again;
//   an empty thread list is rendered only from the board's own true answer.
// - THE SCREEN SHOWS THE BOARD'S TRUTH, never a renderer's cache of it: every read
//   goes to the RPC, polling continues from the cursor, and a failed poll keeps the
//   last confirmed page on screen WITH the time it was confirmed — the next success
//   resumes from the cursor, so a dropped read recovers without the operator.
// - A request's state and effect are TWO labels, the way the contract keeps them;
//   a principal's provenance (trusted / asserted) is shown as the board holds it.

import { useEffect, useRef, useState } from 'react'
import type { CommsMessage, CommsReadError, CommsThread } from '../../../shared/commsRead.ts'
import type { ProjectRow } from '../../../shared/types'
import { since } from '../duration'
import { useLocale, useT, type Translate } from '../i18n'
import { en, type StringKey } from '../i18n/en'
import { FabricStrip } from './FabricStrip'
import { MachineDetail } from '../OperatorError'

// The board is the record; polling is the v1 wake-up, on the feed's own clock (ADR-0027,
// FEED_POLL_MS in App.tsx).
const COMMS_POLL_MS = 2500
/** One page, bounded like the board's own pages (migration 80 caps the RPC at 100). */
const PAGE = 50
/** How many empty windows one Earlier may step over before it hands the next step back to the operator. */
const EARLIER_STEPS = 20
/** How much of a first message stands in for a missing subject (SCN-143 step 1). */
const FIRST_WORDS = 12

const shortId = (id: string): string => (id.length > 12 ? `${id.slice(0, 8)}…` : id)

/** A machine word the contract owns (request state/effect, provenance, message kind),
 *  in the operator's language where this build knows it, raw where it does not — a
 *  value from a newer schema reads as itself, never as a blank and never as the key. */
const contractWord = (t: Translate, group: string, value: string): string => {
  const key = `launch.comms.${group}.${value}`
  return key in en ? t(key as StringKey) : value
}

/** The page of history that lies in seqs (after, after + PAGE]: seqs are unique estate-wide, so a thread holds at
 *  most PAGE messages there, and one read of PAGE from `after` brings every one of them — no gap (UX-1). */
const earlierFrom = (earliestAfter: number, floor: number): number => Math.max(floor, earliestAfter - PAGE)
/** The cursor below which the thread holds nothing: its first message is at or after its createdSeq. */
const floorOf = (thread: Pick<CommsThread, 'createdSeq'>): number => Math.max(0, thread.createdSeq - 1)

const firstWordsOf = (text: string): string => {
  const words = text.trim().split(/\s+/).slice(0, FIRST_WORDS).join(' ')
  return text.trim().split(/\s+/).length > FIRST_WORDS ? `${words}…` : words
}

/** The contract's five message kinds, in the order the filter offers them (SCN-143, amended
 *  2026-10-11: a thread matches a kind filter when it HOLDS a message of that kind). */
const THREAD_KINDS = ['message', 'request', 'reply', 'finding', 'announcement'] as const

/** The filter slice: four filters, each at its widest by default, combining as AND. They narrow
 *  the list the board already answered and NEVER re-query it — so a filter can never make an
 *  unanswered board look empty. */
interface ThreadFilters {
  project: string | null
  kind: string | null
  openOnly: boolean
  /** Last-activity window (SCN-143, the time-filter slice): read from `lastAt`, a fact the
   *  board already answered with. An undated thread — no messages yet, or a `lastAt` that does
   *  not parse — matches only 'all': it is not "old", and a window must not pretend otherwise. */
  activity: 'all' | 'day' | 'week'
}
const ALL_THREADS: ThreadFilters = { project: null, kind: null, openOnly: false, activity: 'all' }
/** The windows measure what their labels say: the last 24 hours and the last 7 days, inclusive at the edge. */
const ACTIVITY_WINDOW_MS = { day: 24 * 3_600_000, week: 7 * 24 * 3_600_000 } as const
/** A select's value, narrowed: anything that is not a known window is the widest one. */
const activityOf = (value: string): ThreadFilters['activity'] => (value === 'day' || value === 'week' ? value : 'all')
/** When the thread was last written, or null when it is undated (no message, or a time that does not parse). */
const lastActivityMs = (thread: Pick<CommsThread, 'lastAt'>): number | null => {
  if (thread.lastAt === null) return null
  const ms = Date.parse(thread.lastAt)
  return Number.isNaN(ms) ? null : ms
}
/** `nowMs` is read once per render from the injected clock, so every row is judged against one instant. */
const matchesFilters = (thread: CommsThread, f: ThreadFilters, nowMs: number): boolean => {
  if (f.project !== null && !thread.participants.includes(f.project)) return false
  if (f.kind !== null && !thread.kinds.includes(f.kind)) return false
  if (f.openOnly && thread.openRequests === 0) return false
  if (f.activity === 'all') return true
  const last = lastActivityMs(thread)
  return last !== null && nowMs - last <= ACTIVITY_WINDOW_MS[f.activity]
}

export function CommsScreen({ projects, onPulse, seen, onRead, now = Date.now }: {
  /** Participant names resolve through this list; null while unread, and an id the
   *  estate no longer holds renders as its short form rather than as nothing. */
  projects: ProjectRow[] | null
  onPulse?: () => void
  /** This operator's read marks — thread id to the last seq seen, machine-local
   *  settings, never a fact about the estate (SCN-143, the unread slice). */
  seen: Record<string, number>
  /** Merge new marks; the parent persists them field-scoped, never as a whole-settings write. */
  onRead: (marks: Record<string, number>) => void
  /** The clock the activity windows are measured from; the machine's own by default, injected by tests. */
  now?: () => number
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const nameOf = (id: string): string => (projects ?? []).find((p) => p.id === id)?.name ?? shortId(id)

  const [threads, setThreads] = useState<CommsThread[] | null>(null)
  const [textsMissing, setTextsMissing] = useState(0)
  const [threadsError, setThreadsError] = useState<CommsReadError | null>(null)
  const [threadsConfirmedAt, setThreadsConfirmedAt] = useState<string | null>(null)
  const [threadsStale, setThreadsStale] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [filters, setFilters] = useState<ThreadFilters>(ALL_THREADS)
  /** Marks reported this mount, over the persisted ones: the marker clears on the act of
   *  opening, not when the settings write round-trips back. A persisted mark always wins
   *  over a smaller local one — the max is the truth in both directions. */
  const [seenLocal, setSeenLocal] = useState<Record<string, number>>({})
  const seenOf = (id: string): number => Math.max(seen[id] ?? 0, seenLocal[id] ?? 0)
  /** Mark threads read through the given seqs. Only marks that MOVE anything are written:
   *  a poll that changes nothing writes nothing, so the settings file is not churned. */
  const mark = (marks: Record<string, number>): void => {
    const fresh = Object.fromEntries(Object.entries(marks).filter(([id, seq]) => seq > seenOf(id)))
    if (Object.keys(fresh).length === 0) return
    setSeenLocal((m) => {
      const next = { ...m }
      for (const [id, seq] of Object.entries(fresh)) next[id] = Math.max(next[id] ?? 0, seq)
      return next
    })
    onRead(fresh)
  }
  /** An open thread is being looked at: it is read through its last seq, and messages that
   *  arrive while it is open move the mark with them (SCN-143, the unread slice). */
  const openThread = threads?.find((thread) => thread.id === selected) ?? null
  useEffect(() => {
    if (openThread) mark({ [openThread.id]: openThread.lastSeq })
    // mark reads the latest seen/seenLocal; it is stable enough for this effect's purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, threads])
  /** First words of untitled threads, filled lazily one bounded read per thread. */
  const [firstWords, setFirstWords] = useState<Record<string, string>>({})
  const confirmed = useRef(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      let reply: Awaited<ReturnType<typeof window.fabric.comms.threads>>
      try {
        reply = await window.fabric.comms.threads()
      } catch (e) {
        reply = { ok: false, error: { code: 'unavailable', message: e instanceof Error ? e.message : String(e) } }
      }
      if (!alive) return
      if (reply.ok) {
        confirmed.current = true
        setThreads(reply.threads)
        setTextsMissing(reply.textsMissing ?? 0)
        setThreadsError(null)
        setThreadsConfirmedAt(new Date().toISOString())
        setThreadsStale(false)
      } else if (!confirmed.current) {
        setThreadsError(reply.error)
      } else {
        // A failed poll keeps the last confirmed list and says when it was confirmed (SCN-143).
        setThreadsStale(true)
      }
    }
    void load()
    const timer = setInterval(() => void load(), COMMS_POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [attempt])

  // A thread with no subject is named by its first words: one bounded read per such
  // thread, cached — never a re-read on every poll.
  useEffect(() => {
    if (!threads) return
    let alive = true
    for (const thread of threads) {
      if (thread.subject !== null || firstWords[thread.id] !== undefined) continue
      void window.fabric.comms.list(thread.id, 0, 1).then((reply) => {
        if (!alive || !reply.ok) return
        const text = reply.messages[0]?.body?.text
        if (text) setFirstWords((m) => (m[thread.id] === undefined ? { ...m, [thread.id]: firstWordsOf(text) } : m))
      }, () => {})
    }
    return () => { alive = false }
  }, [threads, firstWords])

  const titleOf = (thread: CommsThread): string => thread.subject ?? firstWords[thread.id] ?? t('launch.comms.untitled', { id: shortId(thread.id) })
  // A narrowed list hides the rows outside it; a detail of an invisible row would be a second
  // truth beside the filter, so a selection the filter excludes is closed with the filter change.
  const nowMs = now()
  useEffect(() => {
    if (selected !== null && threads && !threads.some((thread) => thread.id === selected && matchesFilters(thread, filters, nowMs))) {
      setSelected(null)
    }
  }, [filters, threads, selected, nowMs])
  const shown = threads?.filter((thread) => matchesFilters(thread, filters, nowMs)) ?? null
  const anyUnread = (threads ?? []).some((thread) => thread.lastSeq > seenOf(thread.id))
  const chosen = openThread
  const observed = threadsConfirmedAt
    ? new Date(threadsConfirmedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  return (
    <div className="lp" data-launch-view="comms">
      <FabricStrip text={observed ? t('launch.comms.observed', { time: observed }) : t('launch.comms.reading')} onPulse={onPulse} />
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.comms.kicker')}</p>
          <h2 tabIndex={-1}>{t('launch.comms.title')}</h2>
          <p>{t('launch.comms.lede')}</p>
        </div>
      </header>
      {threadsError && threads === null ? (
        // UNAVAILABLE, never an empty list: the board did not answer at all.
        <div className="lp-callout" role="alert">
          <b>{t('launch.comms.unavailable')}</b>
          <MachineDetail text={threadsError.message} />
          <div className="lp-actions">
            <button type="button" className="lp-button primary" onClick={() => { confirmed.current = false; setAttempt((a) => a + 1) }}>{t('launch.comms.tryAgain')}</button>
          </div>
        </div>
      ) : (
        <div className="lp-board-layout">
          <section className="lp-panel" aria-label={t('launch.comms.threads')}>
            {threadsStale && observed && (
              <div className="lp-callout" role="status"><b>{t('launch.comms.pollFailed', { time: observed })}</b></div>
            )}
            {threads === null && <p className="lp-meta">{t('launch.comms.reading')}</p>}
            {threads !== null && threads.length === 0 && textsMissing > 0 && (
              // SCN-146 alt path: the journal holds messages whose texts the restore did not bring back.
              <div className="lp-empty" role="status">
                <h3>{t('launch.comms.textsMissing')}</h3>
                <p>{t('launch.comms.textsMissingBody', { count: String(textsMissing) })}</p>
              </div>
            )}
            {threads !== null && threads.length === 0 && textsMissing === 0 && (
              <div className="lp-empty">
                <h3>{t('launch.comms.empty')}</h3>
                <p>{t('launch.comms.emptyBody')}</p>
              </div>
            )}
            {threads !== null && threads.length > 0 && (
              <div className="lp-filters" role="group" aria-label={t('launch.comms.filters.label')}>
                <label>
                  {t('launch.comms.filters.project')}
                  <select value={filters.project ?? ''} onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value || null }))}>
                    <option value="">{t('launch.comms.filters.allProjects')}</option>
                    {(projects ?? []).filter((p) => p.status !== 'archived').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label>
                  {t('launch.comms.filters.kind')}
                  <select value={filters.kind ?? ''} onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value || null }))}>
                    <option value="">{t('launch.comms.filters.allKinds')}</option>
                    {THREAD_KINDS.map((k) => <option key={k} value={k}>{contractWord(t, 'kind', k)}</option>)}
                  </select>
                </label>
                <label>
                  {t('launch.comms.filters.activity')}
                  <select value={filters.activity} onChange={(e) => setFilters((f) => ({ ...f, activity: activityOf(e.target.value) }))}>
                    <option value="all">{t('launch.comms.filters.allTime')}</option>
                    <option value="day">{t('launch.comms.filters.day')}</option>
                    <option value="week">{t('launch.comms.filters.week')}</option>
                  </select>
                </label>
                <label className="lp-filters-check">
                  <input type="checkbox" checked={filters.openOnly} onChange={(e) => setFilters((f) => ({ ...f, openOnly: e.target.checked }))} />
                  {t('launch.comms.filters.openRequests')}
                </label>
                {/* The first run of the slice shows every thread unread; one act clears the
                    list instead of punishing a long board with a click per thread (SCN-143).
                    It marks EVERY thread of the board, the ones a filter hides included: it
                    answers the rail's count, which counts every thread, so it is offered while
                    any thread is unread, visible or not (SCN-143, amended 2026-10-12). */}
                {anyUnread && (
                  <button type="button" className="lp-button" onClick={() => mark(Object.fromEntries((threads ?? []).map((thread) => [thread.id, thread.lastSeq])))}>
                    {t('launch.comms.markAllRead')}
                  </button>
                )}
              </div>
            )}
            {shown !== null && shown.length === 0 && threads !== null && threads.length > 0 && (
              // A narrowed list with no match is said in words with the way back — it is the
              // filter's answer, and it must never read as the estate's (empty) or the board's
              // silence (unavailable).
              <div className="lp-empty">
                <h3>{t('launch.comms.filters.noMatch')}</h3>
                <p>{t('launch.comms.filters.noMatchBody')}</p>
                <div className="lp-actions">
                  <button type="button" className="lp-button" onClick={() => setFilters(ALL_THREADS)}>{t('launch.comms.filters.clear')}</button>
                </div>
              </div>
            )}
            {shown?.map((thread) => {
              const unread = thread.lastSeq > seenOf(thread.id)
              return (
              <button key={thread.id} type="button" className="lp-topic" aria-expanded={selected === thread.id}
                onClick={() => setSelected(selected === thread.id ? null : thread.id)}>
                <span>
                  <span className="lp-topic-title">{titleOf(thread)}</span>
                  <span className="lp-meta">{thread.participants.map(nameOf).join(', ')}</span>
                </span>
                <span className="lp-topic-end">
                  {unread && <span className="lp-pill attention">{t('launch.comms.new')}</span>}
                  <span className="lp-pill">{t('launch.comms.messageCount', { count: thread.messageCount })}</span>
                  <small>{thread.lastAt ? since(thread.lastAt, t) : t('launch.comms.noMessages')}</small>
                </span>
                <span aria-hidden="true">{t('glyph.open')}</span>
              </button>
              )
            })}
          </section>
          {chosen ? (
            <ThreadView key={chosen.id} thread={chosen} title={titleOf(chosen)} nameOf={nameOf} onClose={() => setSelected(null)} />
          ) : (
            <aside className="lp-panel lp-brief">
              <p className="lp-kicker">{t('launch.comms.kicker')}</p>
              <h3>{t('launch.comms.aside.title')}</h3>
              <p>{t('launch.comms.aside.body')}</p>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}

function ThreadView({ thread, title, nameOf, onClose }: {
  thread: CommsThread
  /** The thread's name as the list says it: subject, else its first words (UX-11). */
  title: string
  nameOf: (id: string) => string
  onClose: () => void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [messages, setMessages] = useState<CommsMessage[] | null>(null)
  const [readError, setReadError] = useState<CommsReadError | null>(null)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null)
  const [pollFailed, setPollFailed] = useState(false)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [hasEarlier, setHasEarlier] = useState(false)
  const [historyBusy, setHistoryBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const cursor = useRef(0)
  /** The after_seq the OLDEST confirmed page was read from; Earlier steps back from it. Seeded by the first page,
   *  never left at 0 — a cursor at 0 read the thread's first page and skipped everything between (UX-1). */
  const earliestAfter = useRef(0)
  const confirmed = useRef(false)
  /** What is on screen, for Earlier to tell a new older message from one already shown. */
  const shown = useRef<CommsMessage[] | null>(null)
  shown.current = messages
  /** A thread the estate does not hold stops the poll: it cannot recover by asking again. */
  const gone = useRef(false)
  // The operator lands at the END of the history: the newest page, walked back with
  // Earlier (SCN-143 steps 4–5). Seqs are the estate's, so the window is approximate
  // and the dedupe below is what keeps it exact.
  const floor = floorOf(thread)
  const initialAfter = Math.max(floor, thread.lastSeq - PAGE)

  useEffect(() => {
    let alive = true
    const tick = async (): Promise<void> => {
      if (gone.current) return
      const initial = !confirmed.current
      let reply: Awaited<ReturnType<typeof window.fabric.comms.list>>
      try {
        reply = await window.fabric.comms.list(thread.id, initial ? initialAfter : cursor.current, 100)
      } catch (e) {
        reply = { ok: false, error: { code: 'unavailable', message: e instanceof Error ? e.message : String(e) } }
      }
      if (!alive) return
      if (reply.ok) {
        confirmed.current = true
        cursor.current = reply.lastSeq
        if (initial) {
          earliestAfter.current = initialAfter
          setMessages(reply.messages)
          setHasEarlier(initialAfter > floor)
        } else if (reply.messages.length > 0) {
          setMessages((prev) => {
            const have = new Set((prev ?? []).map((m) => m.id))
            return [...(prev ?? []), ...reply.messages.filter((m) => !have.has(m.id))]
          })
        }
        setConfirmedAt(new Date().toISOString())
        setPollFailed(false)
      } else if (reply.error.code === 'not_found') {
        gone.current = true
        setReadError(reply.error)
      } else if (initial) {
        setReadError(reply.error)
      } else {
        setPollFailed(true)
      }
    }
    void tick()
    const timer = setInterval(() => void tick(), COMMS_POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [thread.id, attempt, initialAfter, floor])

  /** One page further back by the same cursor contract, bounded like the board's own pages. Seqs are the estate's,
   *  so a window of PAGE seqs can hold none of this thread's messages: Earlier keeps stepping back (a bounded number
   *  of reads) until it brings at least one, or reaches the thread's first seq — and only there is it "the beginning". */
  const earlier = async (): Promise<void> => {
    setHistoryBusy(true)
    try {
      const have = new Set((shown.current ?? []).map((m) => m.id))
      const older: CommsMessage[] = []
      let after = earliestAfter.current
      for (let step = 0; step < EARLIER_STEPS && after > floor && older.length === 0; step++) {
        after = earlierFrom(earliestAfter.current, floor)
        const reply = await window.fabric.comms.list(thread.id, after, PAGE)
        if (!reply.ok) {
          // A read that fails mid-history keeps the pages already read and refuses the older page only.
          setHistoryFailed(true)
          return
        }
        earliestAfter.current = after
        older.push(...reply.messages.filter((m) => !have.has(m.id)))
      }
      setHistoryFailed(false)
      setMessages((prev) => {
        const now = new Set((prev ?? []).map((m) => m.id))
        const fresh = older.filter((m) => !now.has(m.id))
        return fresh.length === 0 ? prev : [...fresh, ...(prev ?? [])]
      })
      setHasEarlier(earliestAfter.current > floor)
    } catch {
      setHistoryFailed(true)
    } finally {
      setHistoryBusy(false)
    }
  }

  const confirmedTime = confirmedAt
    ? new Date(confirmedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  if (readError) {
    return (
      <section className="lp-detail" aria-label={t('launch.comms.threads')}>
        <div className="lp-callout" role="alert">
          <b>{readError.code === 'not_found' ? t('launch.comms.notFound') : t('launch.comms.unavailable')}</b>
          {readError.code !== 'not_found' && <MachineDetail text={readError.message} />}
          {readError.code !== 'not_found' && (
            <div className="lp-actions">
              <button type="button" className="lp-button primary" onClick={() => { confirmed.current = false; setReadError(null); setAttempt((a) => a + 1) }}>{t('launch.comms.tryAgain')}</button>
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="lp-detail" aria-labelledby="comms-thread-title">
      <div className="lp-panel-head">
        <p className="lp-kicker">{thread.participants.map(nameOf).join(', ')}</p>
        <button type="button" className="lp-button" aria-label={t('launch.comms.close')} onClick={onClose}>{t('glyph.close')}</button>
      </div>
      <h3 id="comms-thread-title" tabIndex={-1}>{title}</h3>
      {pollFailed && confirmedTime && (
        <div className="lp-callout" role="status"><b>{t('launch.comms.pollFailed', { time: confirmedTime })}</b></div>
      )}
      {messages === null && <p className="lp-meta">{t('launch.comms.reading')}</p>}
      {messages !== null && messages.length === 0 && <p className="lp-meta">{t('launch.comms.threadEmpty')}</p>}
      {messages !== null && messages.length > 0 && (
        <>
          {hasEarlier ? (
            <div className="lp-actions">
              <button type="button" className="lp-button" disabled={historyBusy} onClick={() => void earlier()}>{t('launch.comms.earlier')}</button>
            </div>
          ) : (
            <p className="lp-meta">{t('launch.comms.historyStart')}</p>
          )}
          {historyFailed && <div className="lp-callout" role="status"><b>{t('launch.comms.historyFailed')}</b></div>}
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} answered={m.replyTo ? (messages.find((x) => x.id === m.replyTo) ?? null) : null} nameOf={nameOf} t={t} locale={locale} />
          ))}
          <div className="lp-panel-foot">
            <span>{confirmedTime ? t('launch.comms.confirmed', { time: confirmedTime }) : t('launch.comms.reading')}</span>
          </div>
        </>
      )}
    </section>
  )
}

/** What a reply answers, in words: the sender and first words of the message when it is on the page, else "an earlier
 *  message" — never the message's id (UX-11, SCN-143 step 3). */
function answers(t: Translate, nameOf: (id: string) => string, answered: CommsMessage | null): string {
  if (!answered) return t('launch.comms.replyToEarlier')
  const sender = nameOf(answered.sender.project)
  const text = answered.body?.text?.trim()
  return text ? t('launch.comms.replyTo', { sender, words: firstWordsOf(text) }) : t('launch.comms.replyToFrom', { sender })
}

function MessageRow({ message: m, answered, nameOf, t, locale }: {
  message: CommsMessage
  /** The message this one answers, when it is on the page. */
  answered: CommsMessage | null
  nameOf: (id: string) => string
  t: Translate
  locale: string
}): React.JSX.Element {
  const principal = m.sender.principal
  const principalText = principal ? (principal.label ?? principal.id ?? principal.kind ?? null) : null
  return (
    <article className="lp-topic" data-comms-kind={m.kind}>
      <span>
        <span className="lp-topic-title">{nameOf(m.sender.project)}</span>
        <span className="lp-meta">
          {[principalText, new Date(m.at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="lp-topic-end">
        {principal?.provenance && <span className="lp-pill">{contractWord(t, 'provenance', principal.provenance)}</span>}
        {m.kind !== 'message' && <span className="lp-pill">{contractWord(t, 'kind', m.kind)}</span>}
      </span>
      {m.replyTo && <p className="lp-meta">{answers(t, nameOf, answered)}</p>}
      {m.request && (
        <dl className="lp-facts">
          {/* TWO separate facts, the way the contract keeps them (SCN-143 step 3). */}
          <div><dt>{t('launch.comms.request.state')}</dt><dd><span className="lp-pill">{contractWord(t, 'request.state', m.request.state)}</span></dd></div>
          <div><dt>{t('launch.comms.request.effect')}</dt><dd><span className="lp-pill">{contractWord(t, 'request.effect', m.request.effect)}</span></dd></div>
          <div><dt>{t('launch.comms.request.target')}</dt><dd>{nameOf(m.request.target)} · {m.request.capability}</dd></div>
        </dl>
      )}
      {m.redacted ? (
        <p className="lp-meta">{t('launch.comms.redacted')} · {shortId(m.id)} · {m.digest}</p>
      ) : (
        m.body && <p>{m.body.text}</p>
      )}
    </article>
  )
}
// #endregion comms-screen
