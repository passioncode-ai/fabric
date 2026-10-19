// #region rail — docs: docs/ux/scenarios.md#scn-162-move-between-the-five-places-and-the-projects-from-the-rail
// The shell of Fabric 0.3.7 (SCN-162, SCR-84; the prototype's `simple-*` views, scripts/product/simple.mjs): ONE rail
// on the left with «＋ Создать», the five places (Главная, Агенты, История, Настройки; a project is opened from the
// list beneath, never a sixth fixed entry) and the projects list, and above the place a quiet top bar with its name.
// No tab strip of places or projects, no Back of Fabric's own (⌘[ and ⌘] are the shell's, App.tsx), no scope bar.
// The top bar holds the name and the open consoles as tabs (OF-03, SCN-172: `ConsoleTabs`, passed in as `consoles`)
// and nothing else (OF-05, 2026-10-19): search is ⌘K, there is no profile block and no conversation with Fabric on
// the rail (it opens from Help), and the foot line about this computer shows only when something needs a look.

import { useEffect } from 'react'
import type { ProjectRow } from '../../../shared/types'
import { railProjects } from '../../../shared/railProjects.ts'
import { useLocale, useT } from '../i18n'
import brandMark from '../../../../../../assets/brand/favicon/transparent/passioncode-favicon-64.svg?url'
import './rail.css'

export type ProjectSection = 'overview' | 'team' | 'cycles' | 'goals' | 'memory' | 'settings'
export const PROJECT_SECTION_ANCHOR: Record<ProjectSection, string | null> = {
  overview: null, team: 'sec-agents', cycles: 'sec-automations', goals: 'sec-plan', memory: 'sec-memory', settings: 'sec-project-settings'
}

/**
 * Brings a project section into view once it has rendered, and moves focus to its heading (SCN-130
 * step 2). It waits for the element rather than a fixed timer, and scrolls only the nearest scrolling
 * container — `scrollIntoView` scrolled the whole shell and cut the tab bar off (iteration 2).
 */
export function revealSection(anchor: string, deadlineMs = 2000, settleMs = 1500): void {
  const started = performance.now()
  let alignedAt: number | null = null
  // The page above the section keeps growing while its reads settle, so the section is re-aligned for a short
  // while after it first appears — until the person scrolls or types themselves (0.3.3 verification, iteration 2,
  // UX-6: the setup draft opened at the top of the page, its field out of view).
  let moved = false
  const stop = (): void => { moved = true }
  const events = ['wheel', 'keydown', 'pointerdown', 'touchstart'] as const
  for (const e of events) window.addEventListener(e, stop, { passive: true, once: true })
  const done = (): void => { for (const e of events) window.removeEventListener(e, stop) }
  const align = (el: HTMLElement): void => {
    let box: HTMLElement | null = el.parentElement
    while (box && box !== document.body) {
      const { overflowY } = getComputedStyle(box)
      if ((overflowY === 'auto' || overflowY === 'scroll') && box.scrollHeight > box.clientHeight) break
      box = box.parentElement
    }
    if (box && box !== document.body) {
      const off = el.getBoundingClientRect().top - box.getBoundingClientRect().top
      if (Math.abs(off) > 2) box.scrollTop += off
    } else el.scrollIntoView({ block: 'start' })
  }
  const step = (): void => {
    const el = document.getElementById(anchor)
    if (!el) {
      if (performance.now() - started < deadlineMs) requestAnimationFrame(step)
      else done()
      return
    }
    if (moved) { done(); return }
    align(el)
    if (alignedAt === null) {
      alignedAt = performance.now()
      const heading = el.querySelector<HTMLElement>('h2, h3') ?? el
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
      heading.focus({ preventScroll: true })
    }
    if (performance.now() - alignedAt < settleMs) requestAnimationFrame(step)
    else done()
  }
  requestAnimationFrame(step)
}

export type RailPlace = 'home' | 'agents' | 'history' | 'settings' | 'create'

export interface LaunchShellProps {
  /** Null until the list has been read: an unknown list is not an empty one (M108). */
  projects: ProjectRow[] | null
  /** The last read of the list failed; said in the rail in place of the list (SCN-162 errors). */
  projectsProblem: string | null
  /** When the list on screen was read, so a kept list after a failure says how old it is. */
  projectsReadAt: string | null
  onRetryProjects(): void
  /** Where the person is: a place of the rail, an open project, or somewhere reached from a place (a start path). */
  at: { kind: RailPlace } | { kind: 'project'; projectId: string } | { kind: 'elsewhere' }
  /** The heading of the top bar: the place's or the project's name. */
  title: string
  /** Project ids the person pinned, in their order (favourites, local to this computer). */
  pins: string[]
  /** The newest event per project the shell has read. */
  lastActivity: Record<string, string>
  /** Projects where an agent works now. */
  live: ReadonlySet<string>
  /** What waits for the person, over the whole board and by project; null while unknown (no count is a non-claim). */
  waiting: { total: number; byProject: Record<string, number> } | null
  /** How this computer is: the foot line, shown only on trouble (OF-05). */
  machine: 'reading' | 'ok' | 'trouble'
  onPlace(place: RailPlace): void
  onCreateProject(): void
  onProject(projectId: string): void
  /** Search, opened by ⌘K (OF-05: no field in the top bar). */
  onSearch(): void
  /** The act line at the foot of the place (ADR-0160 §1): «{что сделано} · Отменить». */
  actLine?: React.ReactNode
  /** The open consoles as tabs in the top bar (OF-03, SCN-172); renders nothing while none is open. */
  consoles?: React.ReactNode
  children: React.ReactNode
}

const PLACES: ReadonlyArray<Exclude<RailPlace, 'create'>> = ['home', 'agents', 'history', 'settings']

export function LaunchShell(props: LaunchShellProps): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const { at, projects } = props
  const onSearch = props.onSearch
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSearch])
  const current = (on: boolean) => (on ? { 'aria-current': 'page' as const, className: 'on' } : {})
  const rows = projects ? railProjects(projects, props.pins, props.lastActivity) : []
  const readAt = props.projectsReadAt
    ? new Date(props.projectsReadAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : null
  const go = (e: React.MouseEvent, fn: () => void): void => { e.preventDefault(); fn() }
  return (
    <div className="fab-shell">
      <aside className="rail" aria-label={t('rail.label')}>
        <div className="rail-brand">
          <img src={brandMark} alt="" width={26} height={26} />
          <div><b>{t('launch.brand.product')}</b><small>{t('rail.brand')}</small></div>
        </div>
        <button type="button" className={at.kind === 'create' ? 'rail-create on' : 'rail-create'}
          aria-current={at.kind === 'create' ? 'page' : undefined} aria-label={t('rail.create')}
          onClick={() => props.onPlace('create')}>
          <span aria-hidden="true">{t('glyph.plus')}</span> {t('rail.create')}
        </button>
        <nav className="rail-places" aria-label={t('rail.label')}>
          {PLACES.map((place) => (
            <a key={place} href="#" {...current(at.kind === place)} onClick={(e) => go(e, () => props.onPlace(place))}>
              <span className={`rail-i rail-i-${place}`} aria-hidden="true" />
              <span className="rail-name">{t(`rail.${place}`)}</span>
              {place === 'home' && props.waiting && props.waiting.total > 0 && (
                <span className="rail-n" aria-label={t('rail.waiting', { count: props.waiting.total })}>{props.waiting.total}</span>
              )}
            </a>
          ))}
        </nav>
        <p className="rail-sect" id="rail-projects-label">{t('rail.projects')}</p>
        <div className="rail-projects">
          {props.projectsProblem && (
            <div className="rail-problem" role="alert">
              <p>{t('rail.projects.failed')}</p>
              <p className="rail-machine-words">{props.projectsProblem}</p>
              <button type="button" className="rail-small" onClick={props.onRetryProjects}>{t('rail.projects.retry')}</button>
              {projects !== null && readAt && <p className="rail-muted">{t('rail.projects.stale', { time: readAt })}</p>}
            </div>
          )}
          {projects === null && !props.projectsProblem && <p className="rail-muted" role="status">{t('rail.projects.reading')}</p>}
          {projects !== null && rows.length === 0 && !props.projectsProblem && (
            <>
              <p className="rail-muted">{t('rail.projects.none')}</p>
              <button type="button" className="rail-small" onClick={props.onCreateProject}>{t('rail.projects.create')}</button>
            </>
          )}
          {rows.length > 0 && (
            <ul aria-labelledby="rail-projects-label">
              {rows.map((p) => {
                const waiting = props.waiting?.byProject[p.id] ?? 0
                const live = props.live.has(p.id)
                return (
                  <li key={p.id}>
                    <a href="#" title={p.name} {...current(at.kind === 'project' && at.projectId === p.id)}
                      onClick={(e) => go(e, () => props.onProject(p.id))}>
                      <span className={live ? 'rail-dot live' : 'rail-dot'} {...(live ? { role: 'img', 'aria-label': t('rail.live') } : { 'aria-hidden': true })} />
                      <span className="rail-name">{p.name}</span>
                      {p.favourite && <span className="rail-star" role="img" aria-label={t('rail.favourite')}>{t('glyph.star')}</span>}
                      {waiting > 0 && <span className="rail-c" aria-label={t('rail.waitingProject', { count: waiting })}>{waiting}</span>}
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {props.machine === 'trouble' && (
          <p className="rail-machine" role="status" title={t('rail.machine.trouble')}>
            <span className="rail-dot trouble" aria-hidden="true" />
            <span className="rail-name">{t('rail.machine.trouble')}</span>
          </p>
        )}
      </aside>
      <div className="fab-main">
        <header className="fab-top">
          <h1>{props.title}</h1>
          {props.consoles}
        </header>
        <div className="fab-place">
          {props.children}
          {props.actLine}
        </div>
      </div>
    </div>
  )
}
// #endregion rail
