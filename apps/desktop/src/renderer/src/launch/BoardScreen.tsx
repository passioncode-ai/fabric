// The Board as a screen (SCR-41 · docs/reports/product.html `launchBoard`, `topicRows`,
// `topicDetail`). One ranked query, the same one the home's top three is cut from (M151), so
// the count on the home and the list here never disagree; «Разобрано» is the answered
// questions, read separately (`board.resolved`). A row opens its details in place of the
// working ritual: an authored question is answered there through the one answer writer, a
// derived obligation offers the act that resolves it.
//
// «На следующий раз» sets an authored question aside with a reason — it stays open and keeps
// blocking — and «Вернуть на доску» brings it back; «+ Добавить тему» writes a question onto a
// project as the owner. Each goes through one command (L3b, migration 068) with a command id
// that is stable per attempt, so a retry after a lost answer is the same act.

import { useEffect, useRef, useState } from 'react'
import { PERSON_KINDS, reviewCounts, type BoardCut, type BoardEntry } from '../../../shared/board'
import type { BoardCommandResult, DeferredEntry, ResolvedEntry } from '../../../shared/boardResolved.ts'
import type { BoardTab } from '../../../shared/appRoute'
import type { EntityRef } from '../../../shared/entityRef'
import type { ReadEnvelope } from '../../../shared/readEnvelope'
import type { AnswerReceipt, BoardFilters, ProjectRow } from '../../../shared/types'
import { AnswerForm, submitAnswer } from '../BoardPanel'
import { since } from '../duration'
import { pluralForm, useLocale, useT } from '../i18n'
import { detailOf, titleOf } from '../attentionTitle'
import { FabricStrip } from './FabricStrip'
import { FailureNote, MachineDetail } from '../OperatorError'
import { KanbanBoard } from './KanbanBoard'
import { ObligationActs, useProposalDecisions } from './ObligationActs'
import { askerOf } from './HomeParts'

/** «Актуальное» is the person's part, the same reading as the home's «Нужны вы»: what blocks an agent until the person
 *  answers (CO-391). «На проверке» is the rest that is open (reviews, proposals and abandoned work): the person's to look
 *  at too, but nothing waits on it the way it waits on an answer (0.3.12 review, iteration 2, UX-2). */
type Filter = BoardTab
type Row = { at: 'open'; entry: BoardEntry } | { at: 'later'; entry: DeferredEntry } | { at: 'done'; entry: ResolvedEntry }
/** What the last Board command said, for the row (or the form) it was about. */
type Said = { of: string; result: BoardCommandResult }
/** How many open rows one read of the board carries. */
const BOARD_LIMIT = 100

export function BoardScreen({ feedMark, projects, projectId = null, initialItem = null, startTopic = false, mode: initialMode, onMode, tab: routeTab, onTab, onOpen, onError, onPulse, boardFilters, onRememberBoard }: {
  /** The kanban's filters kept from the last visit, and where to keep the next ones (CO-401). */
  boardFilters?: BoardFilters
  onRememberBoard?(filters: BoardFilters): void
  /** Which view opens (OF-19): the kanban by stage, unless the person came for a row or a topic. */
  mode?: 'kanban' | 'needs'
  /** The view the person switched to, so the way back from a task returns to it (0.3.12 review UX-19). */
  onMode?(mode: 'kanban' | 'needs'): void
  /** The tab of «Нужны вы» the route names, and the one the person switched to: the way back keeps it (iteration 2, UX-4). */
  tab?: BoardTab
  onTab?(tab: BoardTab): void
  /** «Пульс» in the strip (SCR-42). */
  onPulse?: () => void
  /** One project's board, or the estate's when null (SCR-41 from SCR-31 «Доска проекта»). */
  projectId?: string | null
  /** A row to open on arrival — «Разобрать вопрос» names the question it came for. */
  initialItem?: string | null
  /** Open with the add-a-topic form already open. */
  startTopic?: boolean
  /** The projects a topic can be written onto; null while unread. */
  projects: ProjectRow[] | null
  /** Re-read on the journal's clock, like the board panel it replaces. */
  feedMark: number
  onOpen: (projectId: string, focus: EntityRef) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [mode, setModeHere] = useState<'kanban' | 'needs'>(initialMode ?? (initialItem || startTopic ? 'needs' : 'kanban'))
  const setMode = (next: 'kanban' | 'needs'): void => { setModeHere(next); if (next !== mode) onMode?.(next) }
  // The route names the view; a route that changes it while the screen stays (the rail's «Доска» from «Нужны вы») shows it.
  const routeMode = useRef(initialMode)
  useEffect(() => {
    if (initialMode === routeMode.current) return
    routeMode.current = initialMode
    if (initialMode) setModeHere(initialMode)
  }, [initialMode])
  const [open, setOpen] = useState<ReadEnvelope<BoardCut> | null>(null)
  /** The whole open board, for «На проверке»; its own failure is said on its tab (iteration 2, ER-8). */
  const [wholeOpen, setWholeOpen] = useState<ReadEnvelope<BoardCut> | null>(null)
  const [wholeProblem, setWholeProblem] = useState<string | null>(null)
  /** When the kept whole board was read: said beside its rows after a later read fails (iteration 3, ER-3). */
  const [wholeAt, setWholeAt] = useState<string | null>(null)
  const [done, setDone] = useState<ReadEnvelope<ResolvedEntry[]> | null>(null)
  const [later, setLater] = useState<ReadEnvelope<DeferredEntry[]> | null>(null)
  /** The reason being written for one question, keyed by it; kept across a refusal. */
  const [reason, setReason] = useState<Record<string, string>>({})
  const [deferring, setDeferring] = useState<string | null>(null)
  const [said, setSaid] = useState<Said | null>(null)
  const [busy, setBusy] = useState(false)
  /** The topic form, with the ids of THIS attempt: a retry sends the same ones. */
  const [topic, setTopic] = useState<{ commandId: string; questionId: string; projectId: string; text: string; note: string } | null>(() =>
    startTopic ? { commandId: crypto.randomUUID(), questionId: crypto.randomUUID(), projectId: projectId ?? (projects ?? []).find((p) => p.status !== 'archived')?.id ?? '', text: '', note: '' } : null)
  // Arriving with the form before the projects have been read leaves it on no project, and the Add button
  // stays disabled with the picker showing a choice the state does not hold: take the first active project
  // the moment the list arrives, and only while the operator has not chosen one.
  const firstActive = (projects ?? []).find((p) => p.status !== 'archived')?.id ?? ''
  useEffect(() => {
    if (firstActive) setTopic((t) => (t && !t.projectId ? { ...t, projectId: firstActive } : t))
  }, [firstActive])
  const commands = useRef(new Map<string, string>())
  const commandFor = (key: string): string => {
    const existing = commands.current.get(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    commands.current.set(key, id)
    return id
  }
  const [problem, setProblem] = useState<string | null>(null)
  const [filter, setFilterHere] = useState<Filter>(routeTab ?? 'open')
  const setFilter = (next: Filter): void => { setFilterHere(next); if (next !== filter) onTab?.(next) }
  // A route that names another tab while the screen stays shows it, as the view does.
  const routeTabSeen = useRef(routeTab)
  useEffect(() => {
    if (routeTab === routeTabSeen.current) return
    routeTabSeen.current = routeTab
    if (routeTab) setFilterHere(routeTab)
  }, [routeTab])
  const [selected, setSelected] = useState<string | null>(initialItem)
  const [review, setReview] = useState(false)
  /** Kept across a refusal, keyed by the question: an answer belongs to its row. */
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [receipt, setReceipt] = useState<Record<string, AnswerReceipt>>({})
  /** One-time grants issued from the detail, by row: the receipt that keeps a granted refusal on screen (UX-3). */
  const [granted, setGranted] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)
  /** The row last shown in the detail, kept so an answered question's receipt outlives its row. */
  const lastChosen = useRef<Row | null>(null)
  const reload = useRef<() => Promise<void>>(async () => {})
  /** What the last access decision did, named: its row leaves the queue once the decision is projected (UX-1). */
  const [accessSaid, setAccessSaid] = useState<{ text: string; detail: string | null } | null>(null)
  const accessSaidRef = useRef<HTMLDivElement>(null)
  // Focus follows the act (UX-7, iteration 2): the buttons that were pressed are gone, so the sentence
  // that says what happened takes focus instead of the document body.
  useEffect(() => { if (accessSaid) accessSaidRef.current?.focus() }, [accessSaid])

  useEffect(() => {
    let alive = true
    const load = async (): Promise<void> => {
      // The whole open board, read for «На проверке», is its own read: its failure is said on that tab and leaves the
      // person's part on screen (iteration 2, ER-8).
      let rest: Promise<void> = Promise.resolve()
      try {
        // The person's part, the read the home's «Нужны вы» counts (CO-391).
        const mineRead = window.fabric.board.query({ projectId, limit: BOARD_LIMIT, personOnly: true })
        rest = window.fabric.board.query({ projectId, limit: BOARD_LIMIT }).then(
          (a) => { if (alive) { setWholeOpen(a); setWholeAt(a.asOf ?? new Date().toISOString()); setWholeProblem(null) } },
          (e: unknown) => { if (alive) setWholeProblem(e instanceof Error ? e.message : String(e)) })
        const [o, d, l] = await Promise.all([
          mineRead,
          window.fabric.board.resolved({ projectId, limit: 50 }),
          window.fabric.board.deferred({ projectId, limit: 50 })
        ])
        if (alive) { setOpen(o); setDone(d); setLater(l); setProblem(null) }
      } catch (e) {
        if (alive) setProblem(e instanceof Error ? e.message : String(e))
      }
      await rest
    }
    reload.current = load
    void load()
    return () => { alive = false }
  }, [feedMark, projectId])
  const decisions = useProposalDecisions(() => reload.current(), onError)

  const shows = (at: Filter) => filter === 'all' || filter === at
  // What the tab on screen was read from and did not answer; «На проверке» is read from the whole board (iteration 2, ER-8).
  const consulted = [...(shows('open') ? open?.sources ?? [] : []), ...(shows('review') ? wholeOpen?.sources ?? [] : []),
    ...(shows('later') ? later?.sources ?? [] : []), ...(shows('done') ? done?.sources ?? [] : [])]
  // Named once among the FAILED sources: the person's read and the whole board's report the same names, and a source one
  // answered must not hide the other's failure of it (iteration 3, ER-2).
  const unread = consulted.filter((s) => s.status !== 'ok').filter((s, i, failed) => failed.findIndex((x) => x.name === s.name) === i)
  const mine = (open?.data?.items ?? []).filter((e) => PERSON_KINDS.has(e.kind))
  const toReview = (wholeOpen?.data?.items ?? []).filter((e) => !PERSON_KINDS.has(e.kind))
  /** The person's part cut at its first rows (exact: `personOnly` counts the whole part), and the whole board's cut, from
   *  which «На проверке» is filtered: past it, rows to review may be missing (iteration 2, ER-8, UX-5). */
  const mineCut = open?.data && open.data.hidden > 0 ? open.data : null
  const reviewCut = wholeOpen?.data ? wholeOpen.data.hidden > 0 : false
  /** «На проверке» has never been read: said in its place, never as nothing to review. */
  const reviewFailed = wholeProblem !== null && wholeOpen === null
  /** A later read of it failed while rows from an earlier one are kept: they stay, said as that reading's (ER-3). */
  const reviewStale = wholeProblem !== null && wholeOpen !== null
  /** How many rows «На проверке» holds, for its tab: from the same two readings (iteration 3, UX-2). */
  const reviewTotal = open?.data && wholeOpen?.data ? reviewCounts(wholeOpen.data, open.data).total : null
  // Arriving for a row to review (a project's «Разобрать» on a review) opens the tab that lists it; when that tab's read
  // failed, a row the person's part does not hold is one to review, and the tab says its failure (iteration 3, ER-3).
  const arrivedTab = useRef(false)
  useEffect(() => {
    if (arrivedTab.current || !initialItem || open === null || (wholeOpen === null && wholeProblem === null)) return
    arrivedTab.current = true
    if (!mine.some((e) => e.ref === initialItem) && (wholeOpen === null || toReview.some((e) => e.ref === initialItem))) setFilter('review')
  })
  const rows: Row[] | null = open === null || (wholeOpen === null && !reviewFailed) || done === null || later === null ? null : [
    ...(shows('open') ? mine.map((entry) => ({ at: 'open' as const, entry })) : []),
    ...(shows('review') ? toReview.map((entry) => ({ at: 'open' as const, entry })) : []),
    ...(shows('later') ? (later.data ?? []).map((entry) => ({ at: 'later' as const, entry })) : []),
    ...(shows('done') ? (done.data ?? []).map((entry) => ({ at: 'done' as const, entry })) : [])
  ]
  /** Run one Board command and keep its answer beside the thing it was about. */
  const act = async (of: string, run: () => Promise<BoardCommandResult>, done: () => void): Promise<void> => {
    setBusy(true)
    try {
      const result = await run()
      setSaid({ of, result })
      if (result.state === 'committed') { done(); await reload.current() }
    } catch {
      // A rejected invoke does not say whether the command ran: that is uncertainty, and the
      // board is re-read rather than a result invented here.
      setSaid({ of, result: { state: 'unconfirmed' } })
      await reload.current()
    } finally {
      setBusy(false)
    }
  }
  const saidAbout = (of: string) => (said?.of === of ? said.result : null)
  const saying = (r: BoardCommandResult | null, committed: string) =>
    r === null ? null
      : r.state === 'committed' ? <div className="lp-callout" role="status"><b>{committed}</b></div>
      : r.state === 'refused' ? <div className="lp-callout" role="alert"><p>{t(`launch.board.refused.${r.refusal}` as 'launch.board.refused.no_such')}</p></div>
      : <div className="lp-callout" role="alert"><p>{t('launch.board.unconfirmed')}</p></div>
  // An answered question leaves the open list on the re-read its commit triggers. The receipt (what
  // the answer unblocked, where it was delivered) is the reason the person stays on this row, so the
  // row is kept, as it was, until the person closes it or picks another (audit 2026-10-05 A3-001: the
  // detail closed on the next render and the receipt was never seen).
  const found = rows?.find((r) => r.entry.ref === selected) ?? null
  if (found) lastChosen.current = found
  const keptHere = !found && selected !== null && lastChosen.current?.entry.ref === selected
  const answeredHere = keptHere && receipt[selected!]?.committed === true
  // 0.3.2 verification UX-3: a granted refusal leaves the queue on the same re-read; its "until" is the
  // receipt, so the row stays, as A3-001 keeps an answered question.
  const grantedHere = keptHere && !answeredHere && granted[selected!] !== undefined
  const settledHere = answeredHere || grantedHere
  const chosen = found ?? (settledHere ? lastChosen.current : null)
  // Arriving with a row (the home's «Открыть на доске»): its detail takes focus and comes into view once, even where the
  // detail sits under the whole list in one column (0.3.11 review, iteration 2, UX-4).
  const arrived = useRef(false)
  useEffect(() => {
    if (arrived.current || !initialItem || chosen?.entry.ref !== initialItem) return
    arrived.current = true
    const h = document.getElementById('topic-title')
    h?.focus({ preventScroll: true })
    h?.scrollIntoView?.({ block: 'start' })
  })
  // A row the person picks brings its detail into view and focus too: in one column the detail sits under the whole list,
  // and nothing showed that it had opened (0.3.11 review, iteration 3, UX-6; CO-400).
  const picked = useRef(false)
  useEffect(() => {
    if (!picked.current || !chosen || chosen.entry.ref !== selected) return
    picked.current = false
    const h = document.getElementById('topic-title')
    h?.focus({ preventScroll: true })
    h?.scrollIntoView?.({ block: 'nearest' })
  })
  const observed = open?.asOf ? new Date(open.asOf).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null
  /** A board row's kind in words. Set-aside and resolved rows are authored questions, whatever
   *  the question's own kind (decision, access…): the board names them as questions. */
  const scopeName = projectId ? ((projects ?? []).find((p) => p.id === projectId)?.name ?? null) : null
  const kindOf = (kind: string) => t(`needsYou.kind.${kind}` as 'needsYou.kind.question')
  const kindOfRow = (r: Row) => kindOf(r.at === 'open' ? r.entry.kind : 'question')

  return (
    <div className="lp" data-launch-view="launch-board">
      <FabricStrip
        text={observed ? t(scopeName ? 'launch.board.observedProject' : 'launch.board.observed', { time: observed, project: scopeName ?? '' }) : t('launch.board.reading')}
        onPulse={onPulse}
      />
      <header className="lp-heading">
        <div>
          {/* The kanban has its own heading; the queue's is «Нужны вы»'s (0.3.11 review, iteration 2, UX-2). */}
          <p className="lp-kicker">{t(mode === 'kanban' ? 'launch.kanban.kicker' : 'launch.board.kicker')}</p>
          <h2 tabIndex={-1}>{t(mode === 'kanban' ? 'launch.kanban.title' : 'launch.board.title')}</h2>
          <p>{t(mode === 'kanban' ? (projectId ? 'launch.kanban.ledeProject' : 'launch.kanban.lede') : 'launch.board.lede')}</p>
        </div>
        <div className="lp-actions">
          <button type="button" className="lp-button primary" aria-pressed={mode === 'needs' && review} onClick={() => { if (mode !== 'needs') { setMode('needs'); setReview(true) } else setReview(!review) }}>
            {/* On the kanban a press opens «Нужны вы» and its review, so it says so (iteration 3, ER-5). */}
            {mode === 'needs' && review ? t('launch.board.reviewEnd') : t('launch.board.reviewStart')}
          </button>
          <button type="button" className="lp-button" aria-expanded={mode === 'needs' && topic !== null}
            onClick={() => { const opening = mode !== 'needs'; setMode('needs'); setTopic(topic && !opening ? null : topic ?? { commandId: crypto.randomUUID(), questionId: crypto.randomUUID(), projectId: projectId ?? (projects ?? []).find((p) => p.status !== 'archived')?.id ?? '', text: '', note: '' }) }}>
            {t('launch.board.addTopic')}
          </button>
        </div>
      </header>
      {/* OF-19 (the operator's walk, 2026-10-22): the kanban of every task by stage, and the queue of what needs the person. */}
      <div className="lp-modes" role="group" aria-label={t('launch.board.modes')}>
        <button type="button" className="lp-button" aria-pressed={mode === 'kanban'} onClick={() => setMode('kanban')}>{t('launch.board.mode.kanban')}</button>
        <button type="button" className="lp-button" aria-pressed={mode === 'needs'} onClick={() => setMode('needs')}>{t('launch.board.mode.needs')}</button>
      </div>
      {mode === 'kanban' && <KanbanBoard feedMark={feedMark} projectId={projectId} remembered={boardFilters} onRemember={onRememberBoard} onOpen={(project, task) => onOpen(project, { kind: 'task', id: task })} />}
      {mode === 'needs' && (
        <>
      {topic && (
        <section className="lp-detail" aria-labelledby="new-topic-title">
          <h3 id="new-topic-title" tabIndex={-1}>{t('launch.board.topic.title')}</h3>
          <label className="lp-field">
            {t('launch.board.topic.project')}
            <select value={topic.projectId} onChange={(e) => setTopic({ ...topic, projectId: e.target.value })}>
              {(projects ?? []).filter((p) => p.status !== 'archived').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="lp-field">
            {t('launch.board.topic.text')}
            <input value={topic.text} maxLength={500} onChange={(e) => setTopic({ ...topic, text: e.target.value })} />
          </label>
          <label className="lp-field">
            {t('launch.board.topic.note')}
            <textarea rows={3} value={topic.note} onChange={(e) => setTopic({ ...topic, note: e.target.value })} />
          </label>
          {saying(saidAbout('topic'), t('launch.board.topic.added'))}
          <div className="lp-actions">
            <button type="button" className="lp-button primary" disabled={busy || !topic.text.trim() || !topic.projectId}
              onClick={() => void act('topic', () => window.fabric.board.addTopic({
                commandId: topic.commandId, questionId: topic.questionId, projectId: topic.projectId,
                text: topic.text, ...(topic.note.trim() ? { note: topic.note } : {})
              }), () => setTopic(null))}>
              {t('launch.board.topic.add')}
            </button>
            <button type="button" className="lp-button" onClick={() => setTopic(null)}>{t('launch.board.cancel')}</button>
          </div>
        </section>
      )}
      {!topic && saying(saidAbout('topic'), t('launch.board.topic.added'))}
      {review && (
        <div className="lp-callout" role="status"><b>{t('launch.board.reviewTitle')}</b><p>{t('launch.board.reviewBody')}</p></div>
      )}
      {problem && <div className="lp-callout" role="alert"><b>{t('needsYou.unreadable')}</b><MachineDetail text={problem} /></div>}
      {accessSaid && (
        <div className="lp-callout" role="status" tabIndex={-1} ref={accessSaidRef}>
          <b>{accessSaid.text}</b>{accessSaid.detail && <p>{accessSaid.detail}</p>}
        </div>
      )}
      {unread.length > 0 && (
        <div className="lp-callout" role="status"><b>{t('needsYou.partial', { sources: unread.map((s) => s.name).join(', ') })}</b></div>
      )}
      <div className="lp-board-layout">
        <section className="lp-panel" aria-label={t('launch.board.list')}>
          <div className="lp-tabs" role="group" aria-label={t('launch.board.filter')}>
            {(['open', 'review', 'later', 'done', 'all'] as Filter[]).map((f) => (
              <button key={f} type="button" className="lp-button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'review' && reviewTotal !== null ? t('launch.board.tab.reviewCount', { count: reviewTotal }) : t(`launch.board.tab.${f}` as 'launch.board.tab.open')}
              </button>
            ))}
          </div>
          {rows === null && !problem && <p className="lp-meta">{t('estate.reading')}</p>}
          {shows('review') && reviewFailed && <FailureNote said={t('launch.board.reviewUnreadable')} detail={wholeProblem} />}
          {shows('review') && reviewStale && (
            <FailureNote said={t('launch.board.reviewStale', { time: new Date(wholeAt ?? Date.now()).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })} detail={wholeProblem} />
          )}
          {rows !== null && rows.length === 0 && !(filter === 'review' && reviewFailed) && (
            // "Clear" is a measurement, so it is said only of a read that was whole.
            unread.length === 0 && !(filter === 'all' && reviewFailed) ? (
              <div className="lp-empty">
                <h3>{filter === 'open' ? t('launch.home.board.clear') : filter === 'review' ? t('launch.board.reviewEmpty') : t('launch.board.emptyTab')}</h3>
                {filter !== 'review' && <p>{t('launch.home.board.clearBody')}</p>}
              </div>
            ) : <p className="lp-meta">{t('launch.board.emptyPartial')}</p>
          )}
          {shows('open') && mineCut && (
            <p className="lp-meta" role="status">{t(`launch.board.cut.${pluralForm(locale, mineCut.items.length)}`, { shown: mineCut.items.length, total: mineCut.total })}</p>
          )}
          {shows('review') && reviewCut && <p className="lp-meta" role="status">{t('launch.board.reviewCut', { limit: BOARD_LIMIT })}</p>}
          {rows?.map((r, i) => (
            <button key={r.entry.ref} type="button" className="lp-topic" aria-expanded={selected === r.entry.ref}
              onClick={() => { picked.current = selected !== r.entry.ref; setSelected(selected === r.entry.ref ? null : r.entry.ref) }}>
              <span className="lp-topic-num">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="lp-topic-title">{titleOf(r.entry, t)}</span>
                <span className="lp-meta">
                  {[r.entry.projectName, r.at === 'open' ? askerOf(r.entry, t) : null, kindOfRow(r), r.at === 'open' ? detailOf(r.entry, t, locale) : r.at === 'later' ? r.entry.reason : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="lp-topic-end">
                {r.at === 'open'
                  ? <span className={`lp-pill ${r.entry.origin === 'authored' ? 'attention' : ''}`}>{kindOf(r.entry.kind)}</span>
                  : <span className="lp-pill">{t(r.at === 'later' ? 'launch.board.tab.later' : 'launch.board.tab.done')}</span>}
                <small>{since(r.at === 'open' ? r.entry.waitingSince : r.at === 'later' ? r.entry.deferredAt : r.entry.answeredAt, t)}</small>
              </span>
            </button>
          ))}
          <div className="lp-panel-foot"><span>{t(scopeName ? 'launch.board.footProject' : 'launch.board.foot', { project: scopeName ?? '' })}</span></div>
        </section>
        {chosen ? (
          <section className="lp-detail" aria-labelledby="topic-title">
            <div className="lp-panel-head">
              <p className="lp-kicker">{[kindOfRow(chosen), chosen.entry.projectName].filter(Boolean).join(' · ')}</p>
              <button type="button" className="lp-button" aria-label={t('launch.board.close')} onClick={() => setSelected(null)}>{t('glyph.close')}</button>
            </div>
            <h3 id="topic-title" tabIndex={-1}>{titleOf(chosen.entry, t)}</h3>
            {chosen.at === 'open' ? (
              <>
                {chosen.entry.detail && <p>{detailOf(chosen.entry, t, locale)}</p>}
                <dl className="lp-facts">
                  <div><dt>{t('launch.board.fact.state')}</dt><dd>{t(answeredHere ? 'launch.board.state.answered' : grantedHere ? 'launch.board.state.allowed' : 'launch.board.state.open')}</dd></div>
                  {/* A settled row waits for nothing (UX-4). */}
                  {!settledHere && <div><dt>{t('launch.board.fact.waiting')}</dt><dd>{since(chosen.entry.waitingSince, t)}</dd></div>}
                </dl>
                <div className="lp-divider" />
                {chosen.entry.question ? (
                  <AnswerForm
                    look="launch"
                    item={chosen.entry}
                    draft={draft[chosen.entry.ref] ?? ''}
                    onDraft={(v) => setDraft((d) => ({ ...d, [chosen.entry.ref]: v }))}
                    receipt={receipt[chosen.entry.ref]}
                    sending={sending === chosen.entry.ref}
                    onSubmit={async (option) => {
                      const entry = chosen.entry as BoardEntry
                      setSending(entry.ref)
                      try {
                        const r = await submitAnswer(entry, draft[entry.ref] ?? '', option)
                        setReceipt((m) => ({ ...m, [entry.ref]: r }))
                        if (r.committed) { setDraft((d) => ({ ...d, [entry.ref]: '' })); void reload.current() }
                      } catch (e) {
                        onError(String(e))
                      } finally {
                        setSending(null)
                      }
                    }}
                  />
                ) : (
                  // Keyed by the row: the acts keep their own answer, and another row's must never show it (UX-1, iteration 2).
                  <ObligationActs key={chosen.entry.ref} item={chosen.entry} decisions={decisions} onOpen={onOpen} onError={onError} onAccessDecided={(text, detail) => setAccessSaid({ text, detail })}
                    grantedUntil={granted[chosen.entry.ref] ?? null} onGranted={(until) => setGranted((m) => ({ ...m, [chosen.entry.ref]: until }))} />
                )}
                {/* Setting aside a settled question can only be refused (UX-4). */}
                {chosen.entry.question && chosen.entry.projectId && !settledHere && (() => {
                  const entry = chosen.entry as BoardEntry
                  return deferring === entry.ref ? (
                    <>
                      <label className="lp-field">
                        {t('launch.board.defer.reason')}
                        <textarea rows={2} value={reason[entry.ref] ?? ''} placeholder={t('launch.board.defer.hint')}
                          onChange={(e) => setReason((m) => ({ ...m, [entry.ref]: e.target.value }))} />
                      </label>
                      {saying(saidAbout(entry.ref), t('launch.board.defer.done'))}
                      <div className="lp-actions">
                        <button type="button" className="lp-button primary" disabled={busy || !(reason[entry.ref] ?? '').trim()}
                          onClick={() => void act(entry.ref, () => window.fabric.board.defer({
                            commandId: commandFor('defer:' + entry.ref), questionId: entry.subject.id, projectId: entry.projectId!, reason: reason[entry.ref] ?? ''
                          }), () => { setDeferring(null); setSelected(null); setReason((m) => ({ ...m, [entry.ref]: '' })); commands.current.delete('defer:' + entry.ref) })}>
                          {t('launch.board.defer.confirm')}
                        </button>
                        <button type="button" className="lp-button" onClick={() => setDeferring(null)}>{t('launch.board.cancel')}</button>
                      </div>
                    </>
                  ) : (
                    <div className="lp-actions">
                      <button type="button" className="lp-button" onClick={() => setDeferring(entry.ref)}>{t('launch.board.tab.later')}</button>
                    </div>
                  )
                })()}
              </>
            ) : chosen.at === 'later' ? (
              <>
                <dl className="lp-facts">
                  <div><dt>{t('launch.board.fact.state')}</dt><dd>{t('launch.board.tab.later')}</dd></div>
                  <div><dt>{t('launch.board.fact.reason')}</dt><dd>{chosen.entry.reason}</dd></div>
                  <div><dt>{t('launch.board.fact.deferred')}</dt><dd>{new Date(chosen.entry.deferredAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
                </dl>
                <p className="lp-meta">{t('launch.board.defer.stillBlocks')}</p>
                {saying(saidAbout(chosen.entry.ref), t('launch.board.reopen.done'))}
                <div className="lp-actions">
                  <button type="button" className="lp-button primary" disabled={busy}
                    onClick={() => {
                      const entry = chosen.entry as DeferredEntry
                      void act(entry.ref, () => window.fabric.board.reopen({
                        commandId: commandFor('reopen:' + entry.ref), questionId: entry.questionId, projectId: entry.projectId ?? ''
                      }), () => { setSelected(null); commands.current.delete('reopen:' + entry.ref) })
                    }}>
                    {t('launch.board.reopen')}
                  </button>
                </div>
              </>
            ) : (
              <dl className="lp-facts">
                <div><dt>{t('launch.board.fact.state')}</dt><dd>{t('launch.board.tab.done')}</dd></div>
                <div><dt>{t('launch.board.fact.answered')}</dt><dd>{new Date(chosen.entry.answeredAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
                {chosen.entry.answeredBy && (
                  <div><dt>{t('launch.board.fact.by')}</dt><dd>{chosen.entry.answeredBy === 'ceo' ? t('launch.brand.product') : chosen.entry.answeredBy === 'person' ? t('launch.board.by.you') : chosen.entry.answeredBy}</dd></div>
                )}
                {chosen.entry.chosenLabel && <div><dt>{t('launch.board.fact.option')}</dt><dd>{chosen.entry.chosenLabel}</dd></div>}
                {chosen.entry.answer && <div><dt>{t('launch.board.fact.answer')}</dt><dd>{chosen.entry.answer}</dd></div>}
              </dl>
            )}
            <p className="lp-meta">{t('launch.board.detailNote')}</p>
          </section>
        ) : (
          <aside className="lp-panel lp-brief">
            <p className="lp-kicker">{t('launch.board.ritual.kicker')}</p>
            <h3>{t('launch.board.ritual.title')}</h3>
            <ol className="lp-checklist">
              {(['closed', 'needs', 'agents', 'next'] as const).map((k) => <li key={k}>{t(`launch.board.ritual.${k}` as 'launch.board.ritual.closed')}</li>)}
            </ol>
            <p>{t('launch.board.ritual.body')}</p>
          </aside>
        )}
      </div>
        </>
      )}
    </div>
  )
}
