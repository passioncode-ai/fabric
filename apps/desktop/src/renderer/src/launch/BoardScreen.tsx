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
import type { BoardCut, BoardEntry } from '../../../shared/board'
import type { BoardCommandResult, DeferredEntry, ResolvedEntry } from '../../../shared/boardResolved.ts'
import type { EntityRef } from '../../../shared/entityRef'
import type { ReadEnvelope } from '../../../shared/readEnvelope'
import type { AnswerReceipt, ProjectRow } from '../../../shared/types'
import { AnswerForm, submitAnswer } from '../BoardPanel'
import { since } from '../duration'
import { useLocale, useT } from '../i18n'
import { titleOf } from '../attentionTitle'
import { FabricAvatar } from './FabricAvatar'
import { FabricName } from './persona'
import { ObligationActs, useProposalDecisions } from './ObligationActs'

type Filter = 'open' | 'later' | 'done' | 'all'
type Row = { at: 'open'; entry: BoardEntry } | { at: 'later'; entry: DeferredEntry } | { at: 'done'; entry: ResolvedEntry }
/** What the last Board command said, for the row (or the form) it was about. */
type Said = { of: string; result: BoardCommandResult }

export function BoardScreen({ feedMark, projects, projectId = null, initialItem = null, onOpen, onError, onChat, onPulse }: {
  /** «Пульс →» in the strip (SCR-42). */
  onPulse?: () => void
  /** One project's board, or the estate's when null (SCR-41 from SCR-31 «Доска проекта»). */
  projectId?: string | null
  /** A row to open on arrival — «Разобрать вопрос» names the question it came for. */
  initialItem?: string | null
  /** The projects a topic can be written onto; null while unread. */
  projects: ProjectRow[] | null
  /** Re-read on the journal's clock, like the board panel it replaces. */
  feedMark: number
  onOpen: (projectId: string, focus: EntityRef) => void
  onError: (message: string) => void
  onChat: () => void
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [open, setOpen] = useState<ReadEnvelope<BoardCut> | null>(null)
  const [done, setDone] = useState<ReadEnvelope<ResolvedEntry[]> | null>(null)
  const [later, setLater] = useState<ReadEnvelope<DeferredEntry[]> | null>(null)
  /** The reason being written for one question, keyed by it; kept across a refusal. */
  const [reason, setReason] = useState<Record<string, string>>({})
  const [deferring, setDeferring] = useState<string | null>(null)
  const [said, setSaid] = useState<Said | null>(null)
  const [busy, setBusy] = useState(false)
  /** The topic form, with the ids of THIS attempt: a retry sends the same ones. */
  const [topic, setTopic] = useState<{ commandId: string; questionId: string; projectId: string; text: string; note: string } | null>(null)
  const commands = useRef(new Map<string, string>())
  const commandFor = (key: string): string => {
    const existing = commands.current.get(key)
    if (existing) return existing
    const id = crypto.randomUUID()
    commands.current.set(key, id)
    return id
  }
  const [problem, setProblem] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('open')
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
      try {
        const [o, d, l] = await Promise.all([
          window.fabric.board.query({ projectId, limit: 100 }),
          window.fabric.board.resolved({ projectId, limit: 50 }),
          window.fabric.board.deferred({ projectId, limit: 50 })
        ])
        if (alive) { setOpen(o); setDone(d); setLater(l); setProblem(null) }
      } catch (e) {
        if (alive) setProblem(e instanceof Error ? e.message : String(e))
      }
    }
    reload.current = load
    void load()
    return () => { alive = false }
  }, [feedMark, projectId])
  const decisions = useProposalDecisions(() => reload.current(), onError)

  const unread = [...(open?.sources ?? []), ...(later?.sources ?? []), ...(done?.sources ?? [])].filter((s) => s.status !== 'ok')
  const shows = (at: Row['at']) => filter === 'all' || filter === at
  const rows: Row[] | null = open === null || done === null || later === null ? null : [
    ...(shows('open') ? (open.data?.items ?? []).map((entry) => ({ at: 'open' as const, entry })) : []),
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
  const observed = open?.asOf ? new Date(open.asOf).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null
  /** A board row's kind in words. Set-aside and resolved rows are authored questions, whatever
   *  the question's own kind (decision, access…): the board names them as questions. */
  const scopeName = projectId ? ((projects ?? []).find((p) => p.id === projectId)?.name ?? null) : null
  const kindOf = (kind: string) => t(`needsYou.kind.${kind}` as 'needsYou.kind.question')
  const kindOfRow = (r: Row) => kindOf(r.at === 'open' ? r.entry.kind : 'question')

  return (
    <div className="lp" data-launch-view="launch-board">
      <div className="lp-actions lp-board-chat">
        <button type="button" className="lp-button" onClick={onChat}>{t('launch.board.discuss')}</button>
      </div>
      <div className="fp-strip">
        <FabricAvatar size="tiny" label={t('launch.avatar.label')} />
        <div>
          <b><FabricName /></b>
          <span>{observed ? t(scopeName ? 'launch.board.observedProject' : 'launch.board.observed', { time: observed, project: scopeName ?? '' }) : t('launch.board.reading')}</span>
        </div>
        {onPulse && <button type="button" className="lp-button" onClick={onPulse}>{t('launch.pulse.open')}</button>}
      </div>
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.board.kicker')}</p>
          <h2 tabIndex={-1}>{t('launch.board.title')}</h2>
          <p>{t('launch.board.lede')}</p>
        </div>
        <div className="lp-actions">
          <button type="button" className="lp-button primary" aria-pressed={review} onClick={() => setReview(!review)}>
            {review ? t('launch.board.reviewEnd') : t('launch.board.reviewStart')}
          </button>
          <button type="button" className="lp-button" aria-expanded={topic !== null}
            onClick={() => setTopic(topic ? null : { commandId: crypto.randomUUID(), questionId: crypto.randomUUID(), projectId: projectId ?? (projects ?? []).find((p) => p.status !== 'archived')?.id ?? '', text: '', note: '' })}>
            {t('launch.board.addTopic')}
          </button>
        </div>
      </header>
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
      {problem && <div className="lp-callout" role="alert"><b>{t('needsYou.unreadable', { reason: problem })}</b></div>}
      {accessSaid && (
        <div className="lp-callout" role="status" tabIndex={-1} ref={accessSaidRef}>
          <b>{accessSaid.text}</b>{accessSaid.detail && <p>{accessSaid.detail}</p>}
        </div>
      )}
      {unread.length > 0 && (
        <div className="lp-callout" role="status"><b>{t('needsYou.partial', { sources: unread.map((s) => s.name).join(', ') })}</b></div>
      )}
      <div className="lp-board-layout">
        <section className="lp-panel" aria-label={t('launch.board.title')}>
          <div className="lp-tabs" role="group" aria-label={t('launch.board.filter')}>
            {(['open', 'later', 'done', 'all'] as Filter[]).map((f) => (
              <button key={f} type="button" className="lp-button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {t(`launch.board.tab.${f}` as 'launch.board.tab.open')}
              </button>
            ))}
          </div>
          {rows === null && !problem && <p className="lp-meta">{t('estate.reading')}</p>}
          {rows !== null && rows.length === 0 && (
            // "Clear" is a measurement, so it is said only of a read that was whole.
            unread.length === 0 ? (
              <div className="lp-empty">
                <h3>{filter === 'open' ? t('launch.home.board.clear') : t('launch.board.emptyTab')}</h3>
                <p>{t('launch.home.board.clearBody')}</p>
              </div>
            ) : <p className="lp-meta">{t('launch.board.emptyPartial')}</p>
          )}
          {rows?.map((r, i) => (
            <button key={r.entry.ref} type="button" className="lp-topic" aria-expanded={selected === r.entry.ref}
              onClick={() => setSelected(selected === r.entry.ref ? null : r.entry.ref)}>
              <span className="lp-topic-num">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="lp-topic-title">{titleOf(r.entry, t)}</span>
                <span className="lp-meta">
                  {[r.entry.projectName, kindOfRow(r), r.at === 'open' ? r.entry.detail : r.at === 'later' ? r.entry.reason : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="lp-topic-end">
                {r.at === 'open'
                  ? <span className={`lp-pill ${r.entry.origin === 'authored' ? 'attention' : ''}`}>{kindOf(r.entry.kind)}</span>
                  : <span className="lp-pill">{t(r.at === 'later' ? 'launch.board.tab.later' : 'launch.board.tab.done')}</span>}
                <small>{since(r.at === 'open' ? r.entry.waitingSince : r.at === 'later' ? r.entry.deferredAt : r.entry.answeredAt, t)}</small>
              </span>
              <span aria-hidden="true">{t('glyph.open')}</span>
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
                {chosen.entry.detail && <p>{chosen.entry.detail}</p>}
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
    </div>
  )
}
