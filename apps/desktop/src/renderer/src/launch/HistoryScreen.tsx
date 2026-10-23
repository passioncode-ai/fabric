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
import { useLocale, useT } from '../i18n'
import { actSentence, whyWords } from './actWords'
import { Feed } from '../Feed'
import { DiagnosticsSection } from '../DiagnosticsSection'
import type { EntityRef } from '../../../shared/entityRef'
import type { FeedEvent, ProjectRow } from '../../../shared/types'

const PAGE = 50

type Read =
  | { at: 'reading' }
  | { at: 'ready'; rows: ActView[]; next: number | null; readAt: string }
  | { at: 'failed'; says: string; kept: { rows: ActView[]; next: number | null; readAt: string } | null }

const NO_PROJECTS: ProjectRow[] = []

export function HistoryScreen({ projects, mark, feed, feedProjects, feedFailed = false, onOpen }: {
  projects: ReadonlyArray<{ id: string; name: string }> | null
  mark: number
  /** OF-34 (the operator's walk, 2026-10-22): what the agents did, from the journal; null while unread, absent to hide. */
  feed?: FeedEvent[] | null
  /** Null while unread: the feed then says it is reading instead of naming no project. */
  feedProjects?: ProjectRow[] | null
  /** The journal could not be read: said instead of «reading» forever (0.3.11 review ER-9). */
  feedFailed?: boolean
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
  const dayOf = (iso: string): string => {
    const d = new Date(iso), now = new Date()
    const startOf = (x: Date): number => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const days = Math.round((startOf(now) - startOf(d)) / 86_400_000)
    if (days === 0) return t('acts.today')
    if (days === 1) return t('acts.yesterday')
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
  }
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
          {feedFailed && !feed ? <p className="hx-problem" role="status">{t('acts.agentsUnread')}</p> : <Feed events={feedProjects ? feed : null} projects={feedProjects || NO_PROJECTS} onOpen={onOpen} />}
        </section>
      )}
      <OpsLog />
    </div>
  )
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
