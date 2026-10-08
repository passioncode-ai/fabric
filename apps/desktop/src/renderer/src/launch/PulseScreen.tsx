// Pulse (SCR-42 · docs/reports/product.html `renderPulse`, `activityChart`): the rhythm of work
// over 7 or 28 days read closer — any day's events, decisions and results apart — beside what the
// running sessions are observed doing and what the cycles will do next. Everything is read from the
// journal the window holds, the sessions and the routines; a day the window cannot see is said to be
// unknown, a session nobody observed is not called working.

import { useEffect, useState } from 'react'
import { eventsOfDay, rhythmDays, rhythmTotals } from '../../../shared/homeView.ts'
import type { ReadEnvelope } from '../../../shared/readEnvelope'
import { latestVerified, type ReleaseEntry } from '../../../shared/releases.ts'
import type { RunStatusView } from '../../../shared/runStatus.ts'
import type { FeedEvent, ProjectRow, RoutineRow, TerminalSession } from '../../../shared/types'
import { describeEvent, useLocale, useT } from '../i18n'
import { FeedStrip } from './FabricStrip'

export function PulseScreen({ projects, feed, sessions, projectId = null, onBoard, onProject, onReleases }: {
  projects: ProjectRow[] | null
  feed: FeedEvent[] | null
  sessions: TerminalSession[] | null
  /** One project's pulse, or every project's when null. */
  projectId?: string | null
  onBoard: () => void
  onProject: (projectId: string) => void
  /** Releases, or one release when named (the launch design's «Релизы →» and «Состав и проверка →»). */
  onReleases: (release?: { id: string; projectId: string }) => void
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [now] = useState(() => new Date())
  const [period, setPeriod] = useState<7 | 28>(28)
  const [kind, setKind] = useState<'all' | 'result' | 'decision'>('all')
  const scoped = feed === null ? null : projectId ? feed.filter((e) => e.project_id === projectId) : feed
  // Which days the window can see is a fact about the WHOLE feed: filtered to one project, a day the
  // feed cut off is still unknown, never a quiet day of that project.
  const visible = rhythmDays(feed, now, period)
  const days = rhythmDays(scoped, now, period).map((d, i) => (visible[i].known ? d : { ...d, known: false, count: 0 }))
  const [day, setDay] = useState(days[days.length - 1].date)
  const totals = rhythmTotals(scoped, now, period)
  const max = Math.max(1, ...days.map((d) => d.count))
  const selected = days.find((d) => d.date === day) ?? days[days.length - 1]
  const shown = eventsOfDay(scoped, selected.date, kind)
  const nameOf = (id: string | null) => (id ? (projects ?? []).find((p) => p.id === id)?.name ?? id.slice(0, 8) : t('launch.pulse.estate'))
  const scopeName = projectId ? nameOf(projectId) : t('launch.pulse.allProjects')
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const label = (d: { date: string; count: number; known: boolean }) => (d.known ? t('launch.pulse.dayCount', { date: d.date, count: d.count }) : t('launch.pulse.dayUnknown', { date: d.date }))

  return (
    <div className="lp" data-launch-view="launch-pulse">
      <FeedStrip feed={feed} projectId={projectId} projectName={projectId ? scopeName : null} />
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.pulse.kicker', { scope: scopeName })}</p>
          <h2 tabIndex={-1}>{t('launch.pulse.title')}</h2>
          <p>{t('launch.pulse.lede')}</p>
        </div>
        <div className="lp-actions"><button type="button" className="lp-button" onClick={() => onReleases()}>{t('launch.pulse.releases')}</button></div>
      </header>
      <div className="fp-pulse-grid">
        <div>
          <section className="lp-panel fp-activity" aria-labelledby="pulse-rhythm-title">
            <div className="lp-panel-head">
              <div><p className="lp-kicker">{t('launch.pulse.accumulated')}</p><h3 id="pulse-rhythm-title">{t('launch.home.rhythm')}</h3></div>
              <div className="lp-actions">
                {([7, 28] as const).map((n) => (
                  <button key={n} type="button" className="lp-button" aria-pressed={period === n}
                    onClick={() => { setPeriod(n); setDay(rhythmDays(scoped, now, n).slice(-1)[0].date) }}>{t('launch.home.rhythm.days', { days: n })}</button>
                ))}
              </div>
            </div>
            <p className="lp-meta">{days[0].date} — {days[days.length - 1].date} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
            <label className="fp-day-picker">
              {t('launch.pulse.day')}
              <select value={selected.date} onChange={(e) => setDay(e.target.value)} aria-label={t('launch.pulse.dayLabel')}>
                {days.map((d) => <option key={d.date} value={d.date}>{label(d)}</option>)}
              </select>
            </label>
            <div className="fp-chart" style={{ '--fp-days': days.length } as React.CSSProperties} aria-label={t('launch.pulse.chart')}>
              {days.map((d) => (
                <button key={d.date} type="button" className={`fp-bar ${d.known ? '' : 'unknown'}`} aria-pressed={d.date === selected.date}
                  aria-label={label(d)} title={label(d)} onClick={() => setDay(d.date)}>
                  <span style={{ '--fp-bar': `${Math.max(3, (100 * d.count) / max)}%` } as React.CSSProperties}>{d.known ? d.count : '?'}</span>
                  <small>{d.date.slice(-2)}</small>
                </button>
              ))}
            </div>
            <div className="fp-chart-legend"><span>{t('launch.pulse.legendEvents')}</span><span>{t('launch.pulse.legendUnknown')}</span></div>
            <div className="lp-tabs" role="group" aria-label={t('launch.pulse.kind')}>
              {(['all', 'result', 'decision'] as const).map((k) => (
                <button key={k} type="button" className="lp-button" aria-pressed={kind === k} onClick={() => setKind(k)}>{t(`launch.pulse.kind.${k}` as 'launch.pulse.kind.all')}</button>
              ))}
            </div>
            <div className="fp-day">
              <h4>{selected.date}</h4>
              {!selected.known ? <p>{t('launch.pulse.notRead')}</p>
                : shown.length === 0 ? <p>{t('launch.pulse.none')}</p>
                : shown.map((e) => (
                  <article key={`${e.estate_id}:${e.seq}`} className="fp-event">
                    <small>{time(e.occurred_at)} · {nameOf(e.project_id)}</small>
                    <b>{describeEvent(t, e.type)}</b>
                    <details>
                      <summary>{t('launch.pulse.basis')}</summary>
                      <p>{t('launch.pulse.basisBody', { seq: e.seq, actor: t(`launch.pulse.actor.${e.actor.kind === 'agent' || e.actor.kind === 'person' ? e.actor.kind : 'system'}` as 'launch.pulse.actor.agent') })}</p>
                      {e.project_id && <button type="button" className="lp-button lh-text-link" onClick={() => onProject(e.project_id!)}>{t('launch.pulse.toProject')}</button>}
                    </details>
                  </article>
                ))}
            </div>
            <details className="fp-formula">
              <summary>{t('launch.pulse.formula')}</summary>
              <p>{t('launch.pulse.formulaBody', { days: days.filter((d) => d.known && d.count > 0).length, decisions: totals.decisions, results: totals.results, period })}</p>
            </details>
          </section>
          <LivePanel sessions={projectId ? (sessions ?? []).filter((s) => s.projectId === projectId) : sessions} nameOf={nameOf} />
        </div>
        <aside>
          <CyclesPanel projects={projects} projectId={projectId} onBoard={onBoard} />
          <ReleasePreview projectId={projectId} onOpen={onReleases} />
          <section className="lp-panel">
            <h4>{t('launch.pulse.meaning')}</h4>
            <p>{t('launch.pulse.meaningBody')}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

/** Running sessions and what was observed of each — the observation, not the agent's own account. */
function LivePanel({ sessions, nameOf }: { sessions: TerminalSession[] | null; nameOf: (id: string | null) => string }): React.JSX.Element {
  const t = useT()
  const running = (sessions ?? []).filter((s) => s.running)
  const [status, setStatus] = useState<Record<string, ReadEnvelope<RunStatusView> | 'failed'>>({})
  const [paused, setPaused] = useState(false)
  const key = running.map((s) => s.sessionId).join(',')
  useEffect(() => {
    if (paused) return
    let alive = true
    for (const s of running)
      window.fabric.runs.status(s.sessionId).then(
        (v) => alive && setStatus((m) => ({ ...m, [s.sessionId]: v })),
        () => alive && setStatus((m) => ({ ...m, [s.sessionId]: 'failed' }))
      )
    return () => { alive = false }
  }, [key, paused])
  return (
    <section className="lp-panel" aria-labelledby="pulse-live-title">
      <div className="lp-panel-head">
        <div><p className="lp-kicker">{t('launch.pulse.observations')}</p><h3 id="pulse-live-title">{t('launch.home.live.title')}</h3></div>
        <button type="button" className="lp-button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? t('launch.home.live.resume') : t('launch.home.live.pause')}</button>
      </div>
      <p className="lp-meta">{t('launch.pulse.viewingChangesNothing')}</p>
      {sessions === null ? <p className="lp-meta">{t('estate.reading')}</p>
        : running.length === 0 ? <p>{t('launch.pulse.noSessions')}</p>
        : running.map((s) => {
          const v = status[s.sessionId]
          const data = v && v !== 'failed' ? v.data : null
          return (
            <div key={s.sessionId} className="fp-observation">
              <span className={`fp-indicator ${data ? '' : 'unknown'}`} aria-hidden="true">{data ? '◷' : '?'}</span>
              <div>
                <h4>{s.program} · {nameOf(s.projectId)}</h4>
                <p>{v === 'failed' ? t('launch.agent.statusUnreadable') : data ? t(`launch.agent.liveness.${data.observation.liveness}` as 'launch.agent.liveness.working') : t('estate.reading')}</p>
                {data?.claim.phase && <small>{t('launch.agent.claims', { phase: t(`launch.agent.phase.${data.claim.phase}` as 'launch.agent.phase.working') })}</small>}
              </div>
              <button type="button" className="lp-button" onClick={() => void window.fabric.windows.openSession(s.sessionId)}>{t('task.openSession')}</button>
            </div>
          )
        })}
    </section>
  )
}

/** What the cycles will do next: each enabled routine, when it last ran and when it is due. */
function CyclesPanel({ projects, projectId, onBoard }: { projects: ProjectRow[] | null; projectId: string | null; onBoard: () => void }): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [routines, setRoutines] = useState<RoutineRow[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const ids = (projects ?? []).filter((p) => p.status !== 'archived' && (!projectId || p.id === projectId)).map((p) => p.id)
  useEffect(() => {
    if (projects === null) return
    let alive = true
    Promise.all(ids.map((id) => window.fabric.routines.list(id))).then(
      (lists) => alive && setRoutines(lists.flat().filter((r) => r.enabled)),
      (e: unknown) => alive && setFailed(e instanceof Error ? e.message : String(e))
    )
    return () => { alive = false }
  }, [ids.join(','), projects === null])
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const next = (r: RoutineRow) => (r.last_run_at ? new Date(Date.parse(r.last_run_at) + r.every_minutes * 60_000).toISOString() : null)
  const soonest = (routines ?? []).map((r) => ({ r, at: next(r) })).sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))[0] ?? null
  return (
    <section className="lp-panel fp-cycle-panel">
      <p className="lp-kicker">{t('launch.pulse.nextStep')}</p>
      {failed ? <p role="alert">{t('launch.pulse.cyclesUnreadable', { reason: failed })}</p>
        : routines === null ? <p className="lp-meta">{t('estate.reading')}</p>
        : routines.length === 0 ? <><h3>{t('launch.pulse.noCycles')}</h3><p>{t('launch.pulse.noCyclesBody')}</p></>
        : (
          <>
            <h3>{soonest!.r.instruction}</h3>
            <dl>
              <dt>{t('launch.pulse.every')}</dt><dd>{t('launch.pulse.everyMinutes', { minutes: soonest!.r.every_minutes })}</dd>
              <dt>{t('launch.pulse.lastRun')}</dt><dd>{soonest!.r.last_run_at ? when(soonest!.r.last_run_at) : t('launch.pulse.neverRan')}</dd>
              <dt>{t('launch.pulse.nextRun')}</dt><dd>{soonest!.at ? when(soonest!.at) : t('launch.pulse.nextOnStart')}</dd>
              <dt>{t('launch.pulse.whenWorks')}</dt><dd>{t('launch.pulse.whileOpen')}</dd>
            </dl>
            <p className="lp-meta">{t('launch.pulse.cyclesCount', { count: routines.length })}</p>
          </>
        )}
      <div className="lp-actions"><button type="button" className="lp-button" onClick={onBoard}>{t('launch.pulse.toBoard')}</button></div>
      <p className="lp-meta">{t('launch.pulse.missedWindow')}</p>
    </section>
  )
}

/** The latest release that stands verified (the launch design's `releasePreview`). A candidate is
 *  not a result, and a rolled-back release is not the latest one. */
function ReleasePreview({ projectId, onOpen }: { projectId: string | null; onOpen: (release: { id: string; projectId: string }) => void }): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [read, setRead] = useState<ReadEnvelope<ReleaseEntry[]> | 'failed' | null>(null)
  useEffect(() => {
    let alive = true
    window.fabric.releases.list({ projectId, limit: 50 }).then((r) => alive && setRead(r), () => alive && setRead('failed'))
    return () => { alive = false }
  }, [projectId])
  const unread = read === 'failed' || (read !== null && read.sources.some((s) => s.name === 'releases' && s.status !== 'ok'))
  const latest = read && read !== 'failed' ? latestVerified(read.data ?? []) : null
  return (
    <section className="lp-panel fp-release-preview">
      <p className="lp-kicker">{t('launch.pulse.lastVerified')}</p>
      {read === null ? <p className="lp-meta">{t('estate.reading')}</p>
        : unread ? <p role="alert">{t('launch.releases.unread', { sources: 'releases' })}</p>
        : !latest ? <p>{t('launch.pulse.noVerified')}</p>
        : (
          <>
            <h3>{latest.name} <span className="lp-pill">{t('launch.releases.status.verified')}</span></h3>
            {latest.summary && <p>{latest.summary}</p>}
            <small>{new Date(latest.recordedAt).toLocaleDateString(locale, { day: 'numeric', month: 'long' })} · {latest.environment}</small>
            <button type="button" className="lp-button lh-text-link" onClick={() => onOpen({ id: latest.id, projectId: latest.projectId })}>{t('launch.pulse.releaseOpen')}</button>
          </>
        )}
    </section>
  )
}
