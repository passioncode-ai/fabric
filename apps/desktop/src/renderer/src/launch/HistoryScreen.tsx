// #region history-place — docs: docs/ux/scenarios.md#scn-168-read-every-act-in-история--who-did-it-when-and-to-what
/**
 * История on the rail (SCN-168, SCN-169, SCR-88; 0.3.7 wave 3): every recorded act, newest first, grouped by day, with
 * who did it (Вы, Fabric, an agent), the act in a sentence, the project, and «Отменить» or why it cannot be undone.
 * Read from wave 2's `acts.history`; «Отменить» is `acts.undo`. Read again when the journal moves (`mark`).
 *
 * 0.3.13 (CO-414): the filters «Кто», «Проект», «Что» and a search, kept when the person leaves and comes back, and the
 * detail pane beside the list that reads one act whole. Still not here: the agents' own acts through their MCP tools
 * (today only acts recorded as `act.recorded@1` are listed as acts; what the agents did is the journal's list below).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ACT_CATEGORIES, type ActActor, type ActCategory, type ActHistoryPage, type ActHistoryQuery, type ActView } from '../../../shared/acts.ts'
import { describeEvent, useLocale, useT, type Translate } from '../i18n'
import { actSentence, whyWords } from './actWords'
import { feedAct } from '../Feed'
import { runnerLabel } from '../runnerLabel'
import { DiagnosticsSection } from '../DiagnosticsSection'
import type { EntityRef } from '../../../shared/entityRef'
import type { FeedEvent, ProjectRow, TerminalSession } from '../../../shared/types'

const PAGE = 50
/** How long the search waits after the last key before it reads (one read per word typed, not per letter). */
export const SEARCH_SETTLE_MS = 250

// #region history-filters — docs: docs/ux/scenarios.md#scn-168-read-every-act-in-история--who-did-it-when-and-to-what
/** «Кто», «Проект», «Что» and the search (SCN-168 step 2); an empty value is «все». */
export interface HistoryFilters { who: '' | ActActor['kind']; project: string; what: '' | ActCategory; text: string }
export const NO_FILTERS: HistoryFilters = { who: '', project: '', what: '', text: '' }
const FILTERS_KEY = 'fabric.history.filters.v1'

/** The filters the person left История with (step 2: they stay when the person comes back, for as long as the window
 *  is open, as the open consoles are kept); none when unreadable. */
export function rememberedFilters(): HistoryFilters {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(FILTERS_KEY) ?? 'null') as Partial<HistoryFilters> | null
    if (!raw || typeof raw !== 'object') return NO_FILTERS
    return {
      who: raw.who === 'person' || raw.who === 'agent' || raw.who === 'system' ? raw.who : '',
      project: typeof raw.project === 'string' ? raw.project : '',
      what: typeof raw.what === 'string' && (ACT_CATEGORIES as readonly string[]).includes(raw.what) ? raw.what : '',
      text: typeof raw.text === 'string' ? raw.text.slice(0, 200) : ''
    }
  } catch {
    return NO_FILTERS
  }
}
function remember(f: HistoryFilters): void {
  try { window.sessionStorage.setItem(FILTERS_KEY, JSON.stringify(f)) } catch { /* a window without storage keeps them for this visit only */ }
}
const filtered = (f: HistoryFilters): boolean => f.who !== '' || f.project !== '' || f.what !== '' || f.text.trim() !== ''

/** The read's query: only the filters that are set, so an unfiltered read asks for exactly what it did before. */
export function queryOf(f: HistoryFilters, before?: number): ActHistoryQuery {
  return {
    limit: PAGE,
    ...(before !== undefined ? { before } : {}),
    ...(f.who ? { actorKind: f.who } : {}),
    ...(f.project ? { projectId: f.project } : {}),
    ...(f.what ? { category: f.what } : {}),
    ...(f.text.trim() ? { text: f.text.trim() } : {})
  }
}
// #endregion history-filters

/** A reading carries the filters it was read under (`keyOf`): rows read under other filters are never shown under these
 *  (0.3.13 review, iteration 1, UX-4). */
type Ready = { at: 'ready'; key: string; rows: ActView[]; next: number | null; readAt: string }
type Read =
  | { at: 'reading' }
  | Ready
  | { at: 'failed'; key: string; says: string; kept: Ready | null }

/** The filters as the read asks for them: two filter sets that ask the same read are the same key. */
const keyOf = (f: HistoryFilters): string => JSON.stringify(queryOf(f))

/** «Сегодня», «Вчера» or the date: the day a row of История is grouped under. */
export function dayLabel(iso: string, t: Translate, locale: string): string {
  const d = new Date(iso), now = new Date()
  const startOf = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (days === 0) return t('acts.today')
  if (days === 1) return t('acts.yesterday')
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
}

export function HistoryScreen({ projects, mark, feed, feedProjects, feedFailed = false, projectsFailed = false, sessions = null, onOpen }: {
  projects: ReadonlyArray<{ id: string; name: string }> | null
  mark: number
  /** OF-34 (the operator's walk, 2026-10-22): what the agents did, from the journal; null while unread, absent to hide. */
  feed?: FeedEvent[] | null
  /** Null while unread: the feed then says it is reading instead of naming no project. */
  feedProjects?: ProjectRow[] | null
  /** The journal could not be read: said instead of «reading» forever (0.3.11 review ER-9). */
  feedFailed?: boolean
  /** The projects could not be read: the journal's rows still show, without their project names (CO-405), rather than
   *  «reading» for as long as the projects keep failing. */
  projectsFailed?: boolean
  /** The sessions Fabric runs, to name the agent of an act by its program (CO-395); an agent not among them is «Агент». */
  sessions?: TerminalSession[] | null
  onOpen?: (projectId: string, focus: EntityRef) => void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [read, setRead] = useState<Read>({ at: 'reading' })
  const [attempt, setAttempt] = useState(0)
  const [filters, setFilters] = useState<HistoryFilters>(rememberedFilters)
  // The search as typed; it becomes a filter once the person stops typing.
  const [typed, setTyped] = useState(filters.text)
  const [open, setOpen] = useState<number | null>(null)
  // The act whose pane was last open, so «Закрыть» returns the person to its sentence (UX-6).
  const opener = useRef<number | null>(null)
  const key = keyOf(filters)
  // The last successful reading under each filter set: a failed read keeps only what was read under the same filters.
  const last = useRef(new Map<string, Ready>())
  const change = (next: Partial<HistoryFilters>): void => {
    setFilters((f) => { const n = { ...f, ...next }; remember(n); return n })
  }
  useEffect(() => {
    if (typed === filters.text) return
    const timer = setTimeout(() => change({ text: typed }), SEARCH_SETTLE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settles the typed words only
  }, [typed])
  const reset = (): void => { setTyped(''); setFilters(NO_FILTERS); remember(NO_FILTERS) }
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const page: ActHistoryPage = await window.fabric.acts.history(queryOf(filters))
        if (!alive) return
        const ready: Ready = { at: 'ready', key, rows: page.rows, next: page.next, readAt: new Date().toISOString() }
        last.current.set(key, ready)
        setRead(ready)
      } catch (e) {
        // Never an empty list for a failure: what was read before under these same filters stays, marked with its time.
        if (alive) setRead({ at: 'failed', key, says: e instanceof Error ? e.message : String(e), kept: last.current.get(key) ?? null })
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is `filters`, said as the read asks for it
  }, [mark, attempt, filters])
  const more = useCallback(async (): Promise<void> => {
    if (read.at !== 'ready' || read.next === null || read.key !== key) return
    try {
      const page = await window.fabric.acts.history(queryOf(filters, read.next))
      const ready: Ready = { ...read, rows: [...read.rows, ...page.rows], next: page.next }
      last.current.set(read.key, ready)
      setRead(ready)
    } catch (e) {
      setRead({ at: 'failed', key: read.key, says: e instanceof Error ? e.message : String(e), kept: read })
    }
  }, [read, filters, key])
  // A reading under other filters is not this one: while the new filters are read, «Читаю историю…» and no rows (UX-4).
  const current: Read = read.at !== 'reading' && read.key !== key ? { at: 'reading' } : read
  const shown = current.at === 'ready' ? current : current.at === 'failed' ? current.kept : null
  const close = (): void => { opener.current = open; setOpen(null) }
  useEffect(() => {
    if (open !== null || opener.current === null) return
    // Back to the sentence that opened the pane, when it is still listed (UX-6).
    document.getElementById(`hx-open-${opener.current}`)?.focus()
    opener.current = null
  }, [open])
  const chosen = shown?.rows.find((r) => r.seq === open) ?? null
  const nameOf = (id: string | null): string | null => (id ? (projects ?? []).find((p) => p.id === id)?.name ?? null : null)
  const dayOf = (iso: string): string => dayLabel(iso, t, locale)
  const days: Array<{ day: string; rows: ActView[] }> = []
  for (const r of shown?.rows ?? []) {
    const day = dayOf(r.occurredAt)
    if (days.length && days[days.length - 1].day === day) days[days.length - 1].rows.push(r)
    else days.push({ day, rows: [r] })
  }
  return (
    <div className="hx" data-launch-view="history">
      <header className="cr-head">
        <h2 tabIndex={-1}>{t('acts.title')}</h2>
        <p>{t('acts.lede')}</p>
      </header>
      {current.at === 'reading' && <p className="hx-muted" role="status">{t('acts.reading')}</p>}
      {current.at === 'failed' && (
        <div className="hx-problem" role="alert">
          <p>{t('acts.failed')}</p>
          <p className="hx-words">{current.says}</p>
          <button type="button" className="hx-button" onClick={() => setAttempt((a) => a + 1)}>{t('acts.retry')}</button>
          {current.kept && <p className="hx-muted">{t('acts.stale', { time: new Date(current.kept.readAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</p>}
        </div>
      )}
      <Filters filters={filters} typed={typed} onTyped={setTyped} onChange={change} projects={projects} />
      {current.at === 'ready' && current.rows.length === 0 && !filtered(filters) && <p className="hx-empty">{t('acts.empty')}</p>}
      {current.at === 'ready' && current.rows.length === 0 && filtered(filters) && (
        <div className="hx-problem" role="status">
          <p className="hx-empty">{t('acts.filter.none')}</p>
          <button type="button" className="hx-button" onClick={reset}>{t('acts.filter.reset')}</button>
        </div>
      )}
      <div className={`hx-grid ${chosen ? 'has-detail' : ''}`}>
        <div className="hx-main">
          {days.length > 0 && (
            <ul className="hx-list" aria-label={t('acts.list')}>
              {days.map(({ day, rows }) => rows.map((r, i) => (
                <li key={r.seq} className={`hx-row ${open === r.seq ? 'is-open' : ''}`}>
                  {i === 0 && <p className="hx-day" aria-hidden={false}>{day}</p>}
                  <HistoryRow row={r} project={nameOf(r.projectId)} open={open === r.seq} onOpen={() => setOpen(open === r.seq ? null : r.seq)} onChanged={() => setAttempt((a) => a + 1)} />
                </li>
              )))}
            </ul>
          )}
          {current.at === 'ready' && current.next !== null && (
            <button type="button" className="hx-button" onClick={() => void more()}>{t('acts.more')}</button>
          )}
        </div>
        {chosen && <ActDetail row={chosen} rows={shown?.rows ?? null} project={nameOf(chosen.projectId)} onOpen={onOpen} onClose={close} />}
      </div>
      {/* OF-34: the acts above are what was done through Fabric's own controls; the agents' work is in the journal. */}
      {feed !== undefined && (
        <section className="hx-agents" aria-labelledby="hx-agents-title">
          <h3 id="hx-agents-title">{t('acts.agentsTitle')}</h3>
          {/* Unread projects keep the feed unread too, so «nothing yet» never renders as «nothing» (the unread boundary). */}
          {feedFailed && !feed ? <p className="hx-problem" role="status">{t('acts.agentsUnread')}</p> : <AgentWork events={feedProjects || projectsFailed ? (feed ? feed.filter((e) => (!filters.who || e.actor.kind === filters.who) && (!filters.project || e.project_id === filters.project)) : null) : null} narrowed={Boolean(filters.who || filters.project)} onReset={reset} projects={feedProjects ?? null} sessions={sessions} onOpen={onOpen} />}
        </section>
      )}
      <OpsLog />
    </div>
  )
}

/**
 * «Что делали агенты» read as History (CO-395): newest first, grouped by day like the acts above, each row its time, who
 * did it (the agent by its program, «Вы», Fabric), the act in a sentence and the project, never the journal's `#seq`.
 * A row opens what it is about when a screen can focus it, the same act the journal feed offers (`feedAct`).
 */
function AgentWork({ events, narrowed = false, onReset, projects, sessions, onOpen }: {
  events: FeedEvent[] | null
  /** «Кто» or «Проект» narrows this list: an empty answer is then «nothing found», never «the journal is empty» (0.3.13 review, iteration 3, UX-1). */
  narrowed?: boolean
  onReset?: () => void
  /** Null while unread; the events are null then too, so the list says it is reading. */
  projects: ProjectRow[] | null
  sessions: TerminalSession[] | null
  onOpen?: (projectId: string, focus: EntityRef) => void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  if (events === null) return <p className="hx-muted" role="status">{t('journal.reading')}</p>
  if (events.length === 0 && narrowed) return (
    <div className="hx-problem" role="status">
      <p className="hx-empty">{t('acts.filter.none')}</p>
      {onReset && <button type="button" className="hx-button" onClick={onReset}>{t('acts.filter.reset')}</button>}
    </div>
  )
  if (events.length === 0) return <p className="hx-empty">{t('journal.empty')}</p>
  const nameOf = (id: string | null): string | null => (id ? (projects ?? []).find((p) => p.id === id)?.name ?? null : null)
  const who = (e: FeedEvent): string =>
    e.actor.kind === 'person' ? t('acts.actor.you')
      : e.actor.kind === 'system' ? t('acts.actor.fabric')
        : ((program) => (program ? runnerLabel(program, t) : t('acts.actor.agent')))(sessions?.find((s) => s.sessionId === e.actor.id)?.program)
  const days: Array<{ day: string; rows: FeedEvent[] }> = []
  for (const e of [...events].sort((a, b) => b.seq - a.seq)) {
    const day = dayLabel(e.occurred_at, t, locale)
    if (days.length && days[days.length - 1].day === day) days[days.length - 1].rows.push(e)
    else days.push({ day, rows: [e] })
  }
  return (
    <ul className="hx-list" aria-label={t('acts.agentsTitle')}>
      {days.map(({ day, rows }) => rows.map((e, i) => {
        const act = feedAct(e, t)
        const project = nameOf(e.project_id)
        return (
          <li key={`${e.estate_id}:${e.seq}`} className="hx-row">
            {i === 0 && <p className="hx-day">{day}</p>}
            <div className="hx-act">
              <time className="hx-time" dateTime={e.occurred_at}>{new Date(e.occurred_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</time>
              <span className="hx-who">{who(e)}</span>
              <span className="hx-said">{saidOf(t, e)}{project && <small className="hx-project">{project}</small>}</span>
              {/* Why a row opens nothing, said where a keyboard and a screen reader reach it (UX-10), as an act that
                  cannot be undone says why beside it. */}
              <span className="hx-end">
                {'ref' in act && onOpen && <button type="button" className="hx-undo" onClick={() => onOpen(act.projectId, act.ref)}>{t('journal.open')}</button>}
                {'why' in act && onOpen && <span className="hx-muted">{act.why}</span>}
              </span>
            </div>
          </li>
        )
      }))}
    </ul>
  )
}

/**
 * The act in a sentence. A task Fabric released (CO-430: the sweep's lapsed release, a session's end, the app's quit) is
 * said without an agent: the journal's sentence for `work.released@1` names one, and «Fabric» beside «агент освободил
 * задачу» told the operator an agent did what Fabric did. A task the operator released is said the same way: «Вы ·
 * освободили задачу», never «Вы · агент освободил задачу».
 */
function saidOf(t: Translate, e: FeedEvent): string {
  if (e.type === 'work.released@1' && e.actor.kind === 'system') return t('acts.releasedByFabric')
  if (e.type === 'work.released@1' && e.actor.kind === 'person') return t('acts.releasedByYou')
  return describeEvent(t, e.type)
}

/**
 * The operations log and the build line (CO-387): ADR-0160 took Diagnostics off the project page and made every
 * failure an act here, but the log and «which build is this» had no other place, so they close История, folded and
 * read only when opened.
 */
function OpsLog(): React.JSX.Element {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <details className="hx-ops" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('acts.opsLog')}</summary>
      {open && <DiagnosticsSection />}
    </details>
  )
}

/** «Кто», «Проект», «Что» and the search (SCN-168 step 2): each is a select the person reads, not a code. */
function Filters({ filters, typed, onTyped, onChange, projects }: {
  filters: HistoryFilters
  typed: string
  onTyped(text: string): void
  onChange(next: Partial<HistoryFilters>): void
  projects: ReadonlyArray<{ id: string; name: string }> | null
}): React.JSX.Element {
  const t = useT()
  // A remembered project that is no longer listed stays a choice, so the filter in force is never hidden (CO-401).
  const known = (projects ?? []).some((p) => p.id === filters.project)
  return (
    <div className="hx-filters" role="group" aria-label={t('acts.filter.label')}>
      <label>
        <span>{t('acts.filter.who')}</span>
        <select value={filters.who} onChange={(e) => onChange({ who: e.target.value as HistoryFilters['who'] })}>
          <option value="">{t('acts.filter.whoAll')}</option>
          <option value="person">{t('acts.actor.you')}</option>
          <option value="system">{t('acts.actor.fabric')}</option>
          <option value="agent">{t('acts.filter.agents')}</option>
        </select>
      </label>
      <label>
        <span>{t('acts.filter.project')}</span>
        <select value={filters.project} onChange={(e) => onChange({ project: e.target.value })}>
          <option value="">{t('acts.filter.projectAll')}</option>
          {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          {filters.project && !known && <option value={filters.project}>{t('joined.someProject')}</option>}
        </select>
      </label>
      <label>
        <span>{t('acts.filter.what')}</span>
        <select value={filters.what} onChange={(e) => onChange({ what: e.target.value as HistoryFilters['what'] })}>
          <option value="">{t('acts.filter.whatAll')}</option>
          {ACT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`acts.category.${c}` as 'acts.category.tasks')}</option>)}
        </select>
      </label>
      <label className="hx-search">
        <span>{t('acts.filter.search')}</span>
        <input type="search" value={typed} placeholder={t('acts.filter.searchHint')} onChange={(e) => onTyped(e.target.value)} />
      </label>
    </div>
  )
}

/** Where an act's subject opens, when a screen can show it: its task, its question, its project. */
function sourceOf(row: ActView): EntityRef | null {
  const s = row.record.subject
  if (!row.projectId || !s.id) return null
  if (s.type === 'task') return { kind: 'task', id: s.id }
  if (s.type === 'question') return { kind: 'question', id: s.id }
  if (s.type === 'project') return { kind: 'project', id: s.id }
  return null
}

/**
 * One act read whole beside the list (SCN-168 step 3): when and who, the act in a sentence, its project and what it was
 * done to, what changed (before and after, where the record says both), whether it can be undone or why not, the act
 * that undid it, and its source one press away.
 */
function ActDetail({ row, rows, project, onOpen, onClose }: {
  row: ActView
  /** The acts read so far, to name the act that undid this one; null while unread. */
  rows: readonly ActView[] | null
  project: string | null
  onOpen?: (projectId: string, focus: EntityRef) => void
  onClose(): void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const at = new Date(row.occurredAt)
  const who = row.actor.kind === 'person' ? t('acts.actor.you') : row.actor.kind === 'system' ? t('acts.actor.fabric') : t('acts.actor.agent')
  const params = row.record.said.params
  const word = (v: string | number | null | undefined): string | null => (v === null || v === undefined || v === '' ? null : String(v))
  const before = word(params.from)
  const after = word(params.to)
  // The act that undid it, when it is among the acts read; otherwise «a later act», said without placing it in a list
  // that does not hold it (UX-5).
  const undoer = row.undo.state === 'undone' && row.undo.by !== null ? (rows ?? []).find((r) => r.seq === (row.undo as { by: number }).by) ?? null : null
  const source = sourceOf(row)
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    // Under 850 px the pane sits below the whole list: bring it into view, as Агенты does (UX-6).
    ref.current?.closest('section')?.scrollIntoView?.({ block: 'nearest' })
  }, [row.seq])
  return (
    <section id="hx-detail" className="hx-detail" aria-labelledby="hx-detail-title">
      <div className="hx-detail-head">
        <h3 id="hx-detail-title" tabIndex={-1} ref={ref}>{actSentence(t, row.record)}</h3>
        <button type="button" className="hx-button" onClick={onClose}>{t('acts.detail.close')}</button>
      </div>
      <dl>
        <dt>{t('acts.detail.when')}</dt>
        <dd>{dayLabel(row.occurredAt, t, locale)}, {at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</dd>
        <dt>{t('acts.detail.who')}</dt>
        <dd>{who}</dd>
        {project && <><dt>{t('acts.detail.project')}</dt><dd>{project}</dd></>}
        {row.record.subject.label && <><dt>{t('acts.detail.subject')}</dt><dd>{row.record.subject.label}</dd></>}
        {before && after && <><dt>{t('acts.detail.before')}</dt><dd>{actWord(t, before)}</dd></>}
        {after && <><dt>{t('acts.detail.after')}</dt><dd>{actWord(t, after)}</dd></>}
        <dt>{t('acts.detail.undo')}</dt>
        <dd>
          {row.undo.state === 'available' ? t('acts.detail.canUndo')
            : row.undo.state === 'undone' ? t('acts.undoneAt')
              : t('act.cannot', { why: whyWords(t, row.undo.why) })}
        </dd>
        {row.undo.state === 'undone' && (
          <><dt>{t('acts.detail.undoneBy')}</dt><dd>{undoer ? actSentence(t, undoer.record) : t('acts.detail.undoneLater')}</dd></>
        )}
      </dl>
      {source && onOpen && row.projectId && (
        <button type="button" className="hx-button" onClick={() => onOpen(row.projectId!, source)}>{t('acts.detail.source')}</button>
      )}
    </section>
  )
}

/** A task's column is a word the person reads («Проверить»), never `review`; any other value is said as it is. */
function actWord(t: Translate, v: string): string {
  return ['backlog', 'running', 'review', 'done', 'cancelled'].includes(v) ? t(`act.state.${v}` as 'act.state.review') : v
}

function HistoryRow({ row, project, open, onOpen, onChanged }: { row: ActView; project: string | null; open: boolean; onOpen(): void; onChanged(): void }): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [state, setState] = useState<{ at: 'idle' } | { at: 'undoing' } | { at: 'refused'; why: string; says?: string }>({ at: 'idle' })
  const actor = row.actor.kind === 'person' ? t('acts.actor.you') : row.actor.kind === 'system' ? t('acts.actor.fabric') : t('acts.actor.agent')
  const undo = async (): Promise<void> => {
    if (state.at === 'undoing') return
    setState({ at: 'undoing' })
    try {
      const answer = await window.fabric.acts.undo(row.seq)
      if (answer.ok) { setState({ at: 'idle' }); onChanged() }
      else setState({ at: 'refused', why: answer.reason, ...(answer.says ? { says: answer.says } : {}) })
    } catch (e) {
      setState({ at: 'refused', why: 'failed', says: e instanceof Error ? e.message : String(e) })
    }
  }
  return (
    <div className="hx-act">
      <time className="hx-time" dateTime={row.occurredAt}>{new Date(row.occurredAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</time>
      <span className="hx-who">{actor}</span>
      {/* The sentence opens the act whole beside the list (SCN-168 step 3); pressed again, it closes. */}
      <span className="hx-said">
        <button type="button" id={`hx-open-${row.seq}`} className="hx-open" aria-expanded={open} aria-controls={open ? 'hx-detail' : undefined} onClick={onOpen}>{actSentence(t, row.record)}</button>
        {project && <small className="hx-project">{project}</small>}
      </span>
      <span className="hx-end">
        {row.undo.state === 'available' && (
          <button type="button" className="hx-undo" aria-busy={state.at === 'undoing'} disabled={state.at === 'undoing'} onClick={() => void undo()}>
            {t('act.undo')}
          </button>
        )}
        {row.undo.state === 'undone' && <span className="hx-muted">{t('acts.undoneAt')}</span>}
        {row.undo.state === 'cannot' && <span className="hx-muted">{t('act.cannot', { why: whyWords(t, row.undo.why) })}</span>}
      </span>
      {state.at === 'refused' && (
        <span className="hx-refused">
          <span>{t('act.undoFailed', { why: whyWords(t, state.why) })}</span>
          {state.says && <small className="hx-words">{state.says}</small>}
        </span>
      )}
    </div>
  )
}
// #endregion history-place
