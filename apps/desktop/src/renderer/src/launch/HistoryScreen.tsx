// #region history-place — docs: docs/ux/scenarios.md#scn-168-read-every-act-in-история--who-did-it-when-and-to-what
/**
 * История on the rail (SCN-168, SCN-169, SCR-88; 0.3.7 wave 3): every recorded act, newest first, grouped by day, with
 * who did it (Вы, Fabric, an agent), the act in a sentence, the project, and «Отменить» or why it cannot be undone.
 * Read from wave 2's `acts.history`; «Отменить» is `acts.undo`. Read again when the journal moves (`mark`).
 *
 * WHAT WAVE 4 ADDS, said rather than implied: the filters (Кто, Проект, Что, search), the detail pane, and the agents'
 * own acts through their MCP tools (today only acts recorded as `act.recorded@1` are listed).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActHistoryPage, ActView } from '../../../shared/acts.ts'
import { describeEvent, useLocale, useT, type Translate } from '../i18n'
import { actSentence, whyWords } from './actWords'
import { feedAct } from '../Feed'
import { runnerLabel } from '../runnerLabel'
import { DiagnosticsSection } from '../DiagnosticsSection'
import type { EntityRef } from '../../../shared/entityRef'
import type { FeedEvent, ProjectRow, TerminalSession } from '../../../shared/types'

const PAGE = 50

type Read =
  | { at: 'reading' }
  | { at: 'ready'; rows: ActView[]; next: number | null; readAt: string }
  | { at: 'failed'; says: string; kept: { rows: ActView[]; next: number | null; readAt: string } | null }

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
  const last = useRef<Extract<Read, { at: 'ready' }> | null>(null)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const page: ActHistoryPage = await window.fabric.acts.history({ limit: PAGE })
        if (!alive) return
        const ready = { at: 'ready' as const, rows: page.rows, next: page.next, readAt: new Date().toISOString() }
        last.current = ready
        setRead(ready)
      } catch (e) {
        // Never an empty list for a failure: what was read before stays, marked with its time.
        if (alive) setRead({ at: 'failed', says: e instanceof Error ? e.message : String(e), kept: last.current })
      }
    })()
    return () => { alive = false }
  }, [mark, attempt])
  const more = useCallback(async (): Promise<void> => {
    if (read.at !== 'ready' || read.next === null) return
    try {
      const page = await window.fabric.acts.history({ limit: PAGE, before: read.next })
      const ready = { at: 'ready' as const, rows: [...read.rows, ...page.rows], next: page.next, readAt: read.readAt }
      last.current = ready
      setRead(ready)
    } catch (e) {
      setRead({ at: 'failed', says: e instanceof Error ? e.message : String(e), kept: read })
    }
  }, [read])
  const shown = read.at === 'ready' ? read : read.at === 'failed' ? read.kept : null
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
      {read.at === 'reading' && <p className="hx-muted" role="status">{t('acts.reading')}</p>}
      {read.at === 'failed' && (
        <div className="hx-problem" role="alert">
          <p>{t('acts.failed')}</p>
          <p className="hx-words">{read.says}</p>
          <button type="button" className="hx-button" onClick={() => setAttempt((a) => a + 1)}>{t('acts.retry')}</button>
          {read.kept && <p className="hx-muted">{t('acts.stale', { time: new Date(read.kept.readAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</p>}
        </div>
      )}
      {read.at === 'ready' && read.rows.length === 0 && <p className="hx-empty">{t('acts.empty')}</p>}
      {days.length > 0 && (
        <ul className="hx-list" aria-label={t('acts.list')}>
          {days.map(({ day, rows }) => rows.map((r, i) => (
            <li key={r.seq} className="hx-row">
              {i === 0 && <p className="hx-day" aria-hidden={false}>{day}</p>}
              <HistoryRow row={r} project={nameOf(r.projectId)} onChanged={() => setAttempt((a) => a + 1)} />
            </li>
          )))}
        </ul>
      )}
      {read.at === 'ready' && read.next !== null && (
        <button type="button" className="hx-button" onClick={() => void more()}>{t('acts.more')}</button>
      )}
      {/* OF-34: the acts above are what was done through Fabric's own controls; the agents' work is in the journal. */}
      {feed !== undefined && (
        <section className="hx-agents" aria-labelledby="hx-agents-title">
          <h3 id="hx-agents-title">{t('acts.agentsTitle')}</h3>
          {/* Unread projects keep the feed unread too, so «nothing yet» never renders as «nothing» (the unread boundary). */}
          {feedFailed && !feed ? <p className="hx-problem" role="status">{t('acts.agentsUnread')}</p> : <AgentWork events={feedProjects || projectsFailed ? (feed ?? null) : null} projects={feedProjects ?? null} sessions={sessions} onOpen={onOpen} />}
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
function AgentWork({ events, projects, sessions, onOpen }: {
  events: FeedEvent[] | null
  /** Null while unread; the events are null then too, so the list says it is reading. */
  projects: ProjectRow[] | null
  sessions: TerminalSession[] | null
  onOpen?: (projectId: string, focus: EntityRef) => void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  if (events === null) return <p className="hx-muted" role="status">{t('journal.reading')}</p>
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
              <span className="hx-said" title={'why' in act ? act.why : undefined}>{saidOf(t, e)}{project && <small className="hx-project">{project}</small>}</span>
              <span className="hx-end">
                {'ref' in act && onOpen && <button type="button" className="hx-undo" onClick={() => onOpen(act.projectId, act.ref)}>{t('journal.open')}</button>}
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
 * задачу» told the operator an agent did what Fabric did.
 */
function saidOf(t: Translate, e: FeedEvent): string {
  if (e.type === 'work.released@1' && e.actor.kind === 'system') return t('acts.releasedByFabric')
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

function HistoryRow({ row, project, onChanged }: { row: ActView; project: string | null; onChanged(): void }): React.JSX.Element {
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
      <span className="hx-said">{actSentence(t, row.record)}{project && <small className="hx-project">{project}</small>}</span>
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
