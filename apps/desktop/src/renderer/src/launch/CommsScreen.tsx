// #region comms-screen — docs: docs/ux/screens.md#scr-81-project-comms
// Comms (SCR-81 · SCN-143): what projects tell each other, read by the operator with
// their own eyes. The name is Comms, not Board — the kanban owns that word
// (launch.nav.board), and ADR-0117 amendment 1 kept "board" out of user-facing text
// until this screen was designed.
//
// The rules the scenario sets, held here:
//
// - READ-ONLY. No write control: the operator reads; pause and settlement arrive with
//   their own nodes (ADR-0156), and no button here promises a recovery the contract does
//   not support.
// - UNAVAILABLE IS NOT EMPTY. A board that did not answer says so with Try again;
//   an empty thread list is rendered only from the board's own true answer.
// - THE SCREEN SHOWS THE BOARD'S TRUTH, never a renderer's cache of it: every read
//   goes to the RPC, polling continues from the cursor, and a failed poll keeps the
//   last confirmed page on screen WITH the time it was confirmed — the next success
//   resumes from the cursor, so a dropped read recovers without the operator.
// - A request's state and effect are TWO labels, the way the contract keeps them;
//   a principal's provenance (trusted / asserted) is shown as the board holds it.
//
// Wave 4 (SCN-143's wave-4 amendment, SCN-147, SCN-156, SCN-157; W4-3…W4-6): the list is a
// bounded page, newest activity first, and a filter is a READ the board answers — "no match"
// only from its answer, a filtered read that fails keeps what was last confirmed and says so.
// Each request names who answers it and how it ended; each message who read it and the files
// it names; search and what waits for a project sit above the list.

import { useEffect, useRef, useState } from 'react'
import type {
  CommsHead,
  CommsMessage,
  CommsReadError,
  CommsRelatedThread,
  CommsRequestFacts,
  CommsSearchHit,
  CommsThread
} from '../../../shared/commsRead.ts'
import { COMMS_KINDS } from '../../../shared/commsRead.ts'
import type { ProjectRow } from '../../../shared/types'
import { since } from '../duration'
import { useLocale, useT, type Translate } from '../i18n'
import { FabricStrip } from './FabricStrip'
import { CommsFeed } from './CommsFeed'
import { FailureNote, MachineDetail } from '../OperatorError'
import { runnerLabel } from '../runnerLabel'
import { ALL_THREADS, MAX_HELD, PAGE as LIST_PAGE, appendOlder, boardFilterOf, cursorOf, mergeFirstPage, type Held, type ThreadFilters } from './commsList'
import {
  ArtifactList,
  OutcomeBlock,
  PendingPanel,
  ReadBy,
  RelatedThreads,
  ResponderLine,
  SearchPanel,
  Timeline,
  UnknownLine,
  artifactOf,
  contractWord,
  type FactsState,
  type PendingState,
  type RespondersState
} from './CommsParts'

// The board is the record; polling is the v1 wake-up, on the feed's own clock (ADR-0027,
// FEED_POLL_MS in App.tsx).
const COMMS_POLL_MS = 2500
/** One page of a thread's history, bounded like the board's own pages (migration 80 caps the RPC at 100). */
const PAGE = 50
/** How many empty windows one Earlier may step over before it hands the next step back to the operator. */
const EARLIER_STEPS = 20
/** How much of a first message stands in for a missing subject (SCN-143 step 1). */
const FIRST_WORDS = 12
/** The board answers the facts of at most 100 messages a read. */
const FACTS_CHUNK = 100

const shortId = (id: string): string => (id.length > 12 ? `${id.slice(0, 8)}…` : id)

/** The page of history that lies in seqs (after, after + PAGE]: seqs are unique estate-wide, so a thread holds at
 *  most PAGE messages there, and one read of PAGE from `after` brings every one of them — no gap (UX-1). */
const earlierFrom = (earliestAfter: number, floor: number): number => Math.max(floor, earliestAfter - PAGE)
/** The cursor below which the thread holds nothing: its first message is at or after its createdSeq. */
const floorOf = (thread: Pick<CommsThread, 'createdSeq'>): number => Math.max(0, thread.createdSeq - 1)

const firstWordsOf = (text: string): string => {
  const words = text.trim().split(/\s+/).slice(0, FIRST_WORDS).join(' ')
  return text.trim().split(/\s+/).length > FIRST_WORDS ? `${words}…` : words
}

/** A select's value, narrowed: anything that is not a known window is the widest one. */
const activityOf = (value: string): ThreadFilters['activity'] => (value === 'day' || value === 'week' ? value : 'all')
const kindOf = (value: string): ThreadFilters['kind'] => ((COMMS_KINDS as readonly string[]).includes(value) ? (value as ThreadFilters['kind']) : null)
const sameFilters = (a: ThreadFilters, b: ThreadFilters): boolean =>
  a.project === b.project && a.kind === b.kind && a.openOnly === b.openOnly && a.activity === b.activity && a.provider === b.provider

/** A thread the operator opened: from the list, or from a search hit or a related thread the list may not hold. */
type Opened = { thread: CommsThread; from: 'list' | 'search' | 'related'; focusSeq?: number }

export function CommsScreen({ projects, onPulse, seen, onRead, now = Date.now, heads, mode: initialMode = 'feed' }: {
  /** OF-29 (the operator's walk, 2026-10-22): the feed opens first; the threads are the second tab. */
  mode?: 'feed' | 'threads'
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
  /** Every thread's last seq, as the rail's count reads it (App polls them): "mark all read" marks these, so it reaches
   *  threads the page does not hold. Absent, the screen marks what it holds. */
  heads?: { heads: CommsHead[]; truncated: boolean } | null
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [mode, setMode] = useState<'feed' | 'threads'>(initialMode)
  const nameOf = (id: string): string => (projects ?? []).find((p) => p.id === id)?.name ?? shortId(id)

  const [held, setHeld] = useState<Held | null>(null)
  const [textsMissing, setTextsMissing] = useState(0)
  const [threadsError, setThreadsError] = useState<CommsReadError | null>(null)
  const [threadsConfirmedAt, setThreadsConfirmedAt] = useState<string | null>(null)
  const [threadsStale, setThreadsStale] = useState(false)
  /** The filtered read the board did not answer: the list stays what was last confirmed (P12). */
  const [filterFailed, setFilterFailed] = useState(false)
  const [olderBusy, setOlderBusy] = useState(false)
  /** The machine's words when the last older page did not come; "Show older threads" stays to ask it again (UX-7). */
  const [olderFailed, setOlderFailed] = useState<string | null>(null)
  const [opened, setOpened] = useState<Opened | null>(null)
  const [filters, setFilters] = useState<ThreadFilters>(ALL_THREADS)
  /** The filters the held list answers: a poll for other filters never merges into it. */
  const answered = useRef<ThreadFilters>(ALL_THREADS)
  /** The same, for rendering: an empty answer is the estate's only when it answers no filter, and "no match" only when it
   *  answers the filters chosen now. */
  const [answeredFilters, setAnsweredFilters] = useState<ThreadFilters>(ALL_THREADS)
  const [responders, setResponders] = useState<RespondersState>({ kind: 'checking' })
  const [pending, setPending] = useState<PendingState>({ kind: 'reading' })
  const [pendingConfirmedAt, setPendingConfirmedAt] = useState<string | null>(null)
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
  const threads = held?.rows ?? null
  /** An open thread is being looked at: it is read through its last seq, and messages that
   *  arrive while it is open move the mark with them (SCN-143, the unread slice). */
  const listed = opened ? (threads?.find((thread) => thread.id === opened.thread.id) ?? null) : null
  const chosen: Opened | null = opened ? { ...opened, thread: listed ?? opened.thread } : null
  useEffect(() => {
    if (chosen && listed) mark({ [chosen.thread.id]: chosen.thread.lastSeq })
    // mark reads the latest seen/seenLocal; it is stable enough for this effect's purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened?.thread.id, threads])
  /** First words of untitled threads, filled lazily one bounded read per thread. */
  const [firstWords, setFirstWords] = useState<Record<string, string>>({})
  const confirmed = useRef(false)
  const [attempt, setAttempt] = useState(0)

  // The first page, on the poll clock, for the filters chosen. A filter change reads again at once (it is a read the
  // board answers); a reply for filters no longer chosen is dropped.
  useEffect(() => {
    let alive = true
    const asked = filters
    const load = async (): Promise<void> => {
      let reply: Awaited<ReturnType<typeof window.fabric.comms.threadPage>>
      try {
        reply = await window.fabric.comms.threadPage(boardFilterOf(asked, now()), null, LIST_PAGE)
      } catch (e) {
        reply = { ok: false, error: { code: 'unavailable', message: e instanceof Error ? e.message : String(e) } }
      }
      if (!alive) return
      if (reply.ok) {
        const fresh = !sameFilters(answered.current, asked)
        answered.current = asked
        setAnsweredFilters(asked)
        confirmed.current = true
        setHeld((h) => mergeFirstPage(fresh ? null : h, reply))
        setTextsMissing(reply.textsMissing ?? 0)
        setThreadsError(null)
        setThreadsConfirmedAt(new Date().toISOString())
        setThreadsStale(false)
        setFilterFailed(false)
        // A list for other filters starts over: an older page that failed for the last ones is no longer this list's.
        if (fresh) setOlderFailed(null)
      } else if (!confirmed.current) {
        setThreadsError(reply.error)
      } else if (!sameFilters(answered.current, asked)) {
        // A filter the board did not answer: the list is still the last confirmed one, said as such — never "no match".
        setFilterFailed(true)
      } else {
        // A failed poll keeps the last confirmed list and says when it was confirmed (SCN-143).
        setThreadsStale(true)
      }
    }
    void load()
    // Read once while «Лента» shows (its header still says when the board answered); poll only the threads tab
    // (0.3.11 review, iteration 2, DA-4: the hidden list read the board every 2.5 s under the feed).
    if (mode !== 'threads') return () => { alive = false }
    const timer = setInterval(() => void load(), COMMS_POLL_MS)
    return () => { alive = false; clearInterval(timer) }
    // `now` is the clock; the read re-runs on the filters and on Try again, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, filters, mode])

  // Who answers, and what waits: each its own read on the same clock, each failing on its own (SCN-147, SCN-157).
  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      const [r, p] = await Promise.all([
        window.fabric.comms.responders().catch(() => null),
        window.fabric.comms.pending().catch(() => null)
      ])
      if (!alive) return
      if (r?.ok) setResponders({ kind: 'read', responders: r.responders })
      else setResponders((s) => (s.kind === 'read' ? s : { kind: 'unknown' }))
      if (p?.ok) {
        setPending({ kind: 'read', projects: p.projects, more: p.more, stale: false })
        setPendingConfirmedAt(new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      } else setPending((s) => (s.kind === 'read' ? { ...s, stale: true } : { kind: 'unavailable' }))
    }
    void load()
    if (mode !== 'threads') return () => { alive = false }
    const timer = setInterval(() => void load(), COMMS_POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [locale, mode])

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

  const titleOf = (thread: Pick<CommsThread, 'id' | 'subject'>): string => thread.subject ?? firstWords[thread.id] ?? t('launch.comms.untitled', { id: shortId(thread.id) })
  // A narrowed list hides the rows outside it; a detail of an invisible row would be a second truth beside the filter,
  // so a list-opened selection the board's filtered answer no longer holds is closed with the filter change.
  useEffect(() => {
    if (opened?.from === 'list' && threads && sameFilters(answered.current, filters) && !threads.some((thread) => thread.id === opened.thread.id)) setOpened(null)
  }, [filters, threads, opened])

  const showOlder = async (): Promise<void> => {
    if (!held) return
    const cursor = cursorOf(held.rows)
    if (!cursor) return
    setOlderBusy(true)
    try {
      const reply = await window.fabric.comms.threadPage(boardFilterOf(filters, now()), cursor, LIST_PAGE)
      if (reply.ok && sameFilters(answered.current, filters)) setHeld((h) => (h ? appendOlder(h, reply) : h))
      // An older page that did not come is said beside its button — never as the list's end (2026-10-14 review UX-7).
      setOlderFailed(reply.ok ? null : reply.error.message)
    } catch (e) {
      setOlderFailed(e instanceof Error ? e.message : String(e))
    } finally {
      setOlderBusy(false)
    }
  }

  const everyThread = heads?.heads ?? threads ?? []
  const anyUnread = everyThread.some((thread) => thread.lastSeq > seenOf(thread.id))
  const observed = threadsConfirmedAt
    ? new Date(threadsConfirmedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null
  // The agents the screen knows: those on the threads held and those holding a slot; the chosen one stays offered.
  const providers = [...new Set([...(threads ?? []).flatMap((th) => th.providers),
    ...(responders.kind === 'read' ? responders.responders.flatMap((r) => (r.agent ? [r.agent] : [])) : []),
    ...(filters.provider ? [filters.provider] : [])])].sort((a, b) => runnerLabel(a, t).localeCompare(runnerLabel(b, t), locale))
  const filtered = !sameFilters(filters, ALL_THREADS)
  const answeredFiltered = !sameFilters(answeredFilters, ALL_THREADS)
  /** The list on screen answers the filters chosen now (not a read still in flight for a change). */
  const current = sameFilters(answeredFilters, filters)
  const capped = held !== null && held.rows.length >= MAX_HELD && held.more

  const openThread = (thread: CommsThread, from: Opened['from'], focusSeq?: number): void => setOpened({ thread, from, ...(focusSeq !== undefined ? { focusSeq } : {}) })
  const openHit = (hit: CommsSearchHit): void => {
    const known = threads?.find((th) => th.id === hit.thread)
    openThread(known ?? { id: hit.thread, subject: hit.subject ?? null, participants: hit.participants ?? [], createdBy: hit.sender, createdSeq: hit.createdSeq ?? 1,
      messageCount: 0, lastSeq: hit.seq, lastAt: hit.at, kinds: [], openRequests: 0 }, 'search', hit.seq)
  }
  const openPost = (post: CommsMessage): void => {
    const known = threads?.find((th) => th.id === post.thread)
    openThread(known ?? { id: post.thread, subject: null, participants: [post.sender.project], createdBy: post.sender.project, createdSeq: 1,
      messageCount: 0, lastSeq: 0, lastAt: post.at, kinds: [], openRequests: 0 }, 'search')
    setMode('threads')
  }
  const openRelated = (r: CommsRelatedThread): void => {
    const known = threads?.find((th) => th.id === r.id)
    openThread(known ?? { id: r.id, subject: r.subject, participants: r.participants ?? [], createdBy: '', createdSeq: r.createdSeq ?? 1,
      messageCount: 0, lastSeq: r.lastSeq ?? 0, lastAt: r.lastAt, kinds: [], openRequests: 0 }, 'related')
  }

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
      <div className="lp-modes" role="group" aria-label={t('launch.comms.title')}>
        <button type="button" className="lp-button" aria-pressed={mode === 'feed'} onClick={() => setMode('feed')}>{t('launch.comms.mode.feed')}</button>
        <button type="button" className="lp-button" aria-pressed={mode === 'threads'} onClick={() => setMode('threads')}>{t('launch.comms.mode.threads')}</button>
      </div>
      {mode === 'feed' && <CommsFeed mark={attempt} nameOf={nameOf} onOpen={openPost} />}
      {mode === 'threads' && (<>
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
            <SearchPanel nameOf={nameOf} onOpen={openHit} />
            <PendingPanel state={pending} nameOf={nameOf} confirmedAt={pendingConfirmedAt}
              onProject={(project) => setFilters((f) => ({ ...f, project }))} />
            {threadsStale && observed && (
              <div className="lp-callout" role="status"><b>{t('launch.comms.pollFailed', { time: observed })}</b></div>
            )}
            {threads === null && <p className="lp-meta">{t('launch.comms.reading')}</p>}
            {threads !== null && threads.length === 0 && !answeredFiltered && current && textsMissing > 0 && (
              // SCN-146 alt path: the journal holds messages whose texts the restore did not bring back.
              <div className="lp-empty" role="status">
                <h3>{t('launch.comms.textsMissing')}</h3>
                <p>{t('launch.comms.textsMissingBody', { count: String(textsMissing) })}</p>
              </div>
            )}
            {threads !== null && threads.length === 0 && !answeredFiltered && current && textsMissing === 0 && (
              <div className="lp-empty">
                <h3>{t('launch.comms.empty')}</h3>
                <p>{t('launch.comms.emptyBody')}</p>
              </div>
            )}
            {threads !== null && (threads.length > 0 || filtered || answeredFiltered) && (
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
                  <select value={filters.kind ?? ''} onChange={(e) => setFilters((f) => ({ ...f, kind: kindOf(e.target.value) }))}>
                    <option value="">{t('launch.comms.filters.allKinds')}</option>
                    {COMMS_KINDS.map((k) => <option key={k} value={k}>{contractWord(t, 'kind', k)}</option>)}
                  </select>
                </label>
                <label>
                  {t('launch.comms.filters.provider')}
                  <select value={filters.provider ?? ''} onChange={(e) => setFilters((f) => ({ ...f, provider: e.target.value || null }))}>
                    <option value="">{t('launch.comms.filters.allProviders')}</option>
                    {providers.map((p) => <option key={p} value={p}>{runnerLabel(p, t)}</option>)}
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
                {/* The first run shows every thread unread; one act clears the list instead of punishing a long board
                    with a click per thread (SCN-143). It marks every thread the heads name — the ones the page does not
                    hold included: it answers the rail's count, so it is offered while any thread is unread. */}
                {anyUnread && (
                  <button type="button" className="lp-button" onClick={() => mark(Object.fromEntries(everyThread.map((thread) => [thread.id, thread.lastSeq])))}>
                    {t('launch.comms.markAllRead')}
                  </button>
                )}
              </div>
            )}
            {filterFailed && (
              <div className="lp-callout" role="status"><b>{t('launch.comms.filters.readFailed')}</b></div>
            )}
            {!filterFailed && threads !== null && threads.length === 0 && answeredFiltered && current && (
              // A filter the board answered with no thread is said in words with the way back — never the estate's
              // empty answer, and never the board's silence (that is the callout above).
              <div className="lp-empty">
                <h3>{t('launch.comms.filters.noMatch')}</h3>
                <p>{t('launch.comms.filters.noMatchBody')}</p>
                <div className="lp-actions">
                  <button type="button" className="lp-button" onClick={() => setFilters(ALL_THREADS)}>{t('launch.comms.filters.clear')}</button>
                </div>
              </div>
            )}
            {threads?.map((thread) => {
              const unread = thread.lastSeq > seenOf(thread.id)
              return (
              <button key={thread.id} type="button" className="lp-topic" aria-expanded={chosen?.thread.id === thread.id}
                onClick={() => (chosen?.thread.id === thread.id ? setOpened(null) : openThread(thread, 'list'))}>
                <span>
                  <span className="lp-topic-title">{titleOf(thread)}</span>
                  <span className="lp-meta">{thread.participants.map(nameOf).join(', ')}</span>
                </span>
                <span className="lp-topic-end">
                  {unread && <span className="lp-pill attention">{t('launch.comms.new')}</span>}
                  <span className="lp-pill">{t('launch.comms.messageCount', { count: thread.messageCount })}</span>
                  <small>{thread.lastAt ? since(thread.lastAt, t) : t('launch.comms.noMessages')}</small>
                </span>
              </button>
              )
            })}
            {olderFailed !== null && held !== null && held.more && !capped && <FailureNote role="status" said={t('launch.comms.moreFailed')} detail={olderFailed} />}
            {held !== null && held.more && !capped && (
              <div className="lp-actions">
                <button type="button" className="lp-button" disabled={olderBusy} onClick={() => void showOlder()}>{t('launch.comms.more')}</button>
              </div>
            )}
            {capped && <p className="lp-meta">{t('launch.comms.capped', { count: MAX_HELD })}</p>}
          </section>
          {chosen ? (
            <ThreadView key={`${chosen.thread.id}:${chosen.focusSeq ?? ''}`} thread={chosen.thread} focusSeq={chosen.focusSeq} title={titleOf(chosen.thread)}
              nameOf={nameOf} responders={responders} onClose={() => setOpened(null)} onRelated={openRelated} />
          ) : (
            <aside className="lp-panel lp-brief">
              <p className="lp-kicker">{t('launch.comms.kicker')}</p>
              <h3>{t('launch.comms.aside.title')}</h3>
              <p>{t('launch.comms.aside.body')}</p>
            </aside>
          )}
        </div>
      )}
      </>)}
    </div>
  )
}

function ThreadView({ thread, focusSeq, title, nameOf, responders, onClose, onRelated }: {
  thread: CommsThread
  /** Open at this message (a search hit): the page starts there, with Earlier above it. */
  focusSeq?: number
  /** The thread's name as the list says it: subject, else its first words (UX-11). */
  title: string
  nameOf: (id: string) => string
  responders: RespondersState
  onClose: () => void
  onRelated: (thread: CommsRelatedThread) => void
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
  const [facts, setFacts] = useState<FactsState>({ kind: 'reading' })
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
  // Earlier (SCN-143 steps 4–5) — or, from a search hit, at the hit. Seqs are the estate's,
  // so the window is approximate and the dedupe below is what keeps it exact.
  const floor = floorOf(thread)
  const initialAfter = focusSeq !== undefined ? Math.max(floor, focusSeq - 1) : Math.max(floor, thread.lastSeq - PAGE)

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

  // The facts of the messages on screen — who read each, how each request ended — read again on every confirmed
  // page, in reads of at most 100. A failed read says so where the answers would be; it never reads as "none".
  useEffect(() => {
    if (!messages || messages.length === 0) return
    let alive = true
    const ids = messages.map((m) => m.id)
    const read = async (): Promise<void> => {
      const merged = { messages: {} as Record<string, { readBy: string[] }>, requests: {} as Record<string, CommsRequestFacts> }
      for (let i = 0; i < ids.length; i += FACTS_CHUNK) {
        let reply: Awaited<ReturnType<typeof window.fabric.comms.facts>>
        try {
          reply = await window.fabric.comms.facts(ids.slice(i, i + FACTS_CHUNK))
        } catch {
          reply = { ok: false, error: { code: 'unavailable', message: 'the facts read threw' } }
        }
        if (!alive) return
        if (!reply.ok) { setFacts((f) => (f.kind === 'read' ? f : { kind: 'unavailable' })); return }
        Object.assign(merged.messages, reply.messages)
        Object.assign(merged.requests, reply.requests)
      }
      if (alive) setFacts({ kind: 'read', facts: merged })
    }
    void read()
    return () => { alive = false }
  }, [messages, confirmedAt])

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
      <RelatedThreads threadId={thread.id} onOpen={onRelated} />
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
            <MessageRow key={m.id} message={m} answered={m.replyTo ? (messages.find((x) => x.id === m.replyTo) ?? null) : null} nameOf={nameOf} t={t} locale={locale}
              responders={responders} facts={facts} />
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

function MessageRow({ message: m, answered, nameOf, t, locale, responders, facts }: {
  message: CommsMessage
  /** The message this one answers, when it is on the page. */
  answered: CommsMessage | null
  nameOf: (id: string) => string
  t: Translate
  locale: string
  responders: RespondersState
  facts: FactsState
}): React.JSX.Element {
  const principal = m.sender.principal
  const principalText = principal ? (principal.label ?? principal.id ?? principal.kind ?? null) : null
  const artifacts = (m.artifacts ?? []).map(artifactOf).filter((a): a is NonNullable<ReturnType<typeof artifactOf>> => a !== null)
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
        <>
          <dl className="lp-facts">
            {/* TWO separate facts, the way the contract keeps them (SCN-143 step 3). */}
            <div><dt>{t('launch.comms.request.state')}</dt><dd><span className="lp-pill">{contractWord(t, 'request.state', m.request.state)}</span></dd></div>
            <div><dt>{t('launch.comms.request.effect')}</dt><dd><span className="lp-pill">{contractWord(t, 'request.effect', m.request.effect)}</span></dd></div>
            <div><dt>{t('launch.comms.request.target')}</dt><dd>{nameOf(m.request.target)} · {m.request.capability}</dd></div>
            <ResponderLine request={m.request} state={responders} nameOf={nameOf} />
          </dl>
          <UnknownLine request={m.request} state={responders} />
          <OutcomeBlock request={m.request} facts={facts} />
          <Timeline requestId={m.request.id} />
        </>
      )}
      {m.redacted ? (
        <p className="lp-meta">{t('launch.comms.redacted')} · {shortId(m.id)} · {m.digest}</p>
      ) : (
        m.body && <p>{m.body.text}</p>
      )}
      {artifacts.length > 0 && <ArtifactList artifacts={artifacts} />}
      <ReadBy messageId={m.id} facts={facts} nameOf={nameOf} />
    </article>
  )
}
// #endregion comms-screen
