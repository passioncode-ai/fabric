// #region rail — docs: docs/ux/scenarios.md#scn-162-move-between-the-five-places-and-the-projects-from-the-rail
// The shell of Fabric 0.3.7 (SCN-162, SCR-84; the prototype's `simple-*` views, scripts/product/simple.mjs): ONE rail
// on the left with «＋ Создать», the five places (Главная, Агенты, История, Настройки; a project is opened from the
// list beneath, never a sixth fixed entry) and the projects list, and above the place a quiet top bar with its name.
// No tab strip of places or projects, no Back of Fabric's own (⌘[ and ⌘] are the shell's, App.tsx), no scope bar.
// 0.3.14, the simple Fabric (docs/ux/2026-10-26-simple-fabric.md §1): the brand IS Главная; under «Создать» a toggle
// «Проекты | Агенты» (remembered for the window); the projects alphabetically, or every agent at work with its project
// and git branch; История and Настройки at the foot. Агенты is no longer a place of its own, and a row has no graph
// button (the project page's «Связи» is the way to the graph).
// The top bar holds the name and the open consoles as tabs (OF-03, SCN-172: `ConsoleTabs`, passed in as `consoles`)
// and nothing else (OF-05, 2026-10-19): search is ⌘K, there is no profile block and no conversation with Fabric on
// the rail (it opens from Help), and the foot line about this computer shows only when something needs a look.

import { useEffect, useRef, useState } from 'react'
import type { ProjectRow } from '../../../shared/types'
import { railProjects } from '../../../shared/railProjects.ts'
import type { RailAgent } from '../../../shared/railAgents'
import { runnerLabel } from '../runnerLabel'
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
  at: { kind: Exclude<RailPlace, 'agents'> } | { kind: 'agents'; session?: string | null } | { kind: 'project'; projectId: string } | { kind: 'elsewhere' }
  /** The heading of the top bar: the place's or the project's name. */
  title: string
  /** Project ids the person pinned (favourites, local to this computer): a star beside the name, nothing more. */
  pins: string[]
  /** Every agent at work now, for the toggle's «Агенты» (`shared/railAgents.ts`); rows null while unread. */
  agents: { rows: RailAgent[] | null; problem: string | null }
  /** Opens an agent's screen. */
  onAgent(sessionId: string): void
  /** The console icon beside an agent whose console Fabric holds (the operator's second review, R-6): opens its session
   *  as a tab at once. Absent, no icon is drawn. */
  onAgentConsole?(sessionId: string): void
  /** Projects where an agent works now. */
  live: ReadonlySet<string>
  /** «Нужны вы» (`PERSON_KINDS`), over the whole estate and by project; null while unknown (no count is a non-claim). */
  waiting: { total: number; byProject: Record<string, number> } | null
  /** Comms threads with new messages (SCN-143's unread slice), carried on Настройки because Comms opens from
   *  Настройки → Ещё since 0.3.7 wave 3 (0.3.7 review UX-4). Null or absent while the board has not answered. */
  commsUnread?: { count: number; atLeast: boolean } | null
  /** How this computer is: the foot line, shown only on trouble (OF-05). */
  machine: 'reading' | 'ok' | 'trouble'
  onPlace(place: RailPlace): void
  onCreateProject(): void
  onProject(projectId: string): void
  /** Search, opened by ⌘K (OF-05: no field in the top bar). */
  onSearch(): void
  /** The act line at the foot of the place (ADR-0160 §1): «{что сделано} · Отменить». */
  actLine?: React.ReactNode
  /** Which page the place shows, finer than `at` (the board and the plan both mark nothing on the rail): a new key
   *  starts the page at its top. */
  placeKey?: string
  /** CO-388: this place was reached by going back or forward (⌘[, ⌘]); it opens where it was left, not at its top. */
  restoreScroll?: boolean
  /** The open consoles as tabs in the top bar (OF-03, SCN-172); renders nothing while none is open. */
  consoles?: React.ReactNode
  /** Where the way back and forward can go (the operator's second review, 2026-10-26, R-7): the buttons are disabled,
   *  never hidden, when there is nowhere to go. Absent, the top bar draws no travel buttons. */
  travel?: { back: boolean; forward: boolean }
  /** «Назад» and «Вперёд»: the same travel as ⌘[ and ⌘] (App.tsx). */
  onTravel?(dir: 'back' | 'forward'): void
  children: React.ReactNode
}

/** The foot's two places (0.3.14): Главная is the brand, Агенты is the toggle. */
const FOOT: ReadonlyArray<'history' | 'settings'> = ['history', 'settings']
type RailView = 'projects' | 'agents'

/**
 * The foot line's state from this computer's own reading, the journal on the local stack (0.3.7 review UX-10): a
 * shell error that is not about the computer (a draft that could not be kept, a refused link, a settings write) says
 * itself in the banner and never blames «этот компьютер».
 */
export function machineOf(journal: { read: boolean; failed: boolean }, _shellError?: string | null): LaunchShellProps['machine'] {
  return journal.failed ? 'trouble' : journal.read ? 'ok' : 'reading'
}

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
  const rows = projects ? railProjects(projects, props.pins, locale) : []
  // The toggle (0.3.14): remembered for the window, as the scroll positions are; on an agent's screen it shows the agents.
  const [view, setView] = useState<RailView>(at.kind === 'agents' ? 'agents' : 'projects')
  const atAgents = at.kind === 'agents'
  useEffect(() => { if (atAgents) setView('agents') }, [atAgents])
  const viewButtons = useRef<Record<RailView, HTMLButtonElement | null>>({ projects: null, agents: null })
  const onViewKey = (e: React.KeyboardEvent): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const next: RailView = e.key === 'Home' ? 'projects' : e.key === 'End' ? 'agents' : view === 'projects' ? 'agents' : 'projects'
    setView(next)
    viewButtons.current[next]?.focus()
  }
  const agentSession = at.kind === 'agents' ? (at.session ?? null) : null
  const readAt = props.projectsReadAt
    ? new Date(props.projectsReadAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : null
  const go = (e: React.MouseEvent, fn: () => void): void => { e.preventDefault(); fn() }
  // The page scrolls inside the place (rail.css): another place, or another project, starts at its top rather than
  // at the scroll position the last one was left at. The rail's own mark is too coarse for this (the board, the
  // plan and Help all mark nothing), so App names the place it shows.
  const place = useRef<HTMLDivElement>(null)
  const where = props.placeKey ?? (at.kind === 'project' ? `project:${at.projectId}` : at.kind)
  // CO-388 (SCN-058): the last position of each place, so going back opens a page where the person left it. Kept as
  // they scroll; in memory only, for this window.
  const positions = useRef(new Map<string, number>())
  const whereRef = useRef(where)
  whereRef.current = where
  useEffect(() => {
    const box = place.current
    if (!box) return
    const remember = (e: Event): void => {
      const el = e.target instanceof HTMLElement ? e.target : null
      const page = el?.tagName === 'MAIN' && el.parentElement?.classList.contains('shell') && el.parentElement.parentElement === box
      if (el && (el === box || page)) positions.current.set(whereRef.current, el.scrollTop)
    }
    box.addEventListener('scroll', remember, { capture: true, passive: true })
    return () => box.removeEventListener('scroll', remember, { capture: true })
  }, [])
  useEffect(() => {
    const box = place.current
    if (!box) return
    const top = props.restoreScroll ? positions.current.get(where) ?? 0 : 0
    box.scrollTo?.({ top })
    for (const page of box.querySelectorAll<HTMLElement>(':scope > .shell > main')) page.scrollTo?.({ top })
    // CO-384: a move made from the rail left focus on the rail's link, so PageDown, Space and the arrows scrolled
    // nothing until the person clicked in the page. Focus goes to the new page's first heading (the usual way a page
    // change is announced), only when it was on the rail, so ⌘K and a field the person typed in keep theirs.
    if (!document.activeElement?.closest('.rail')) return
    const page = box.querySelector<HTMLElement>(':scope > .shell > main:not([hidden])')
    const heading = page?.querySelector<HTMLElement>('h1, h2') ?? page
    if (!heading) return
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
  }, [where])
  return (
    <div className="fab-shell">
      <aside className="rail" aria-label={t('rail.aside')}>
        {/* The brand is Главная (0.3.14): pressing it comes home; it carries the count of what waits for the person. */}
        <button type="button" className={at.kind === 'home' ? 'rail-brand rail-home on' : 'rail-brand rail-home'}
          aria-current={at.kind === 'home' ? 'page' : undefined} title={t('rail.home')}
          aria-labelledby={`rail-name-home${props.waiting && props.waiting.total > 0 ? ' rail-count-home' : ''}`}
          onClick={() => props.onPlace('home')}>
          <img src={brandMark} alt="" width={26} height={26} />
          <span className="rail-home-words"><b>{t('launch.brand.product')}</b><small>{t('rail.brand')}</small></span>
          <span className="visually-hidden" id="rail-name-home">{t('rail.home')}</span>
          {props.waiting && props.waiting.total > 0 && (
            <span className="rail-n" id="rail-count-home" aria-label={t('rail.waiting', { count: props.waiting.total })}>{props.waiting.total}</span>
          )}
        </button>
        <button type="button" className={at.kind === 'create' ? 'rail-create on' : 'rail-create'}
          aria-current={at.kind === 'create' ? 'page' : undefined} aria-label={t('rail.create')}
          onClick={() => props.onPlace('create')}>
          <span aria-hidden="true">{t('glyph.plus')}</span> {t('rail.create')}
        </button>
        <div className="rail-view" role="group" aria-label={t('rail.view.label')} onKeyDown={onViewKey}>
          {(['projects', 'agents'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} tabIndex={view === v ? 0 : -1}
              ref={(el) => { viewButtons.current[v] = el }} onClick={() => setView(v)}>
              {t(v === 'projects' ? 'rail.projects' : 'rail.agents')}
            </button>
          ))}
        </div>
        {view === 'projects' ? (
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
            <ul aria-label={t('rail.projects')}>
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
        ) : (
        <div className="rail-projects rail-agents">
          {props.agents.problem && !props.agents.rows && <p className="rail-muted" role="alert">{t('rail.agents.failed')}</p>}
          {props.agents.rows === null && !props.agents.problem && <p className="rail-muted" role="status">{t('rail.agents.reading')}</p>}
          {props.agents.rows !== null && props.agents.rows.length === 0 && <p className="rail-muted">{t('rail.agents.none')}</p>}
          {props.agents.rows !== null && props.agents.rows.length > 0 && (
            <ul aria-label={t('rail.agents.list')}>
              {props.agents.rows.map((a) => {
                const name = `${runnerLabel(a.runner, t)} · ${a.projectName ?? t('launch.home.agents.noProject')}`
                return (
                  <li key={a.sessionId}>
                    <a href="#" className="rail-agent" title={name} {...current(agentSession === a.sessionId)}
                      onClick={(e) => go(e, () => props.onAgent(a.sessionId))}>
                      <span className={a.state === 'working' ? 'rail-dot live' : 'rail-dot quiet'} aria-hidden="true" />
                      <span className="rail-agent-words">
                        <span className="rail-name">{name}</span>
                        <span className="rail-agent-line">
                          {a.branch
                            ? <span className="rail-branch">{a.branch}</span>
                            : <span className="rail-branch unknown" title={t('rail.agents.branchUnknownWhy')}>{t('rail.agents.branchUnknown')}</span>}
                          {a.state === 'quiet' && <span> · {t('launch.home.agents.stale')}</span>}
                        </span>
                      </span>
                    </a>
                    {props.onAgentConsole && (a.console
                      ? (
                        <button type="button" className="rail-console" aria-label={t('rail.agents.openSession', { name })} title={t('rail.agents.openSession', { name })}
                          onClick={() => props.onAgentConsole?.(a.sessionId)}>
                          <span aria-hidden="true">{t('glyph.console')}</span>
                        </button>
                      )
                      : <span className="rail-console elsewhere" role="img" aria-label={t('rail.agents.elsewhere')} title={t('rail.agents.elsewhere')}>{t('glyph.console')}</span>)}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        )}
        <nav className="rail-places rail-foot" aria-label={t('rail.label')}>
          {FOOT.map((place) => {
            const comms = place === 'settings' && props.commsUnread && props.commsUnread.count > 0 ? props.commsUnread : null
            return (
              <a key={place} href="#" title={t(`rail.${place}`)} aria-labelledby={`rail-name-${place}${comms ? ` rail-count-${place}` : ''}`}
                {...current(at.kind === place)} onClick={(e) => go(e, () => props.onPlace(place))}>
                <span className={`rail-i rail-i-${place}`} aria-hidden="true" />
                <span className="rail-name" id={`rail-name-${place}`}>{t(`rail.${place}`)}</span>
                {comms && (
                  <span className="rail-c" id={`rail-count-${place}`}
                    aria-label={t(comms.atLeast ? 'rail.commsUnreadMax' : 'rail.commsUnread', { count: comms.count })}>
                    {comms.count}{comms.atLeast ? '+' : ''}
                  </span>
                )}
              </a>
            )
          })}
        </nav>
        {props.machine === 'trouble' && (
          <p className="rail-machine" role="status" title={t('rail.machine.trouble')}>
            <span className="rail-dot trouble" aria-hidden="true" />
            <span className="rail-name">{t('rail.machine.trouble')}</span>
          </p>
        )}
      </aside>
      <div className="fab-main">
        <header className="fab-top">
          {/* The operator's second review, 2026-10-26 (v2 §3.0, §4.4, R-7): visible back, forward and home, the same
              travel as ⌘[ and ⌘]; SCN-162's «no Back of Fabric's own» (0.3.7) is amended. */}
          {props.travel && (
            <nav className="fab-travel" aria-label={t('nav.travel')}>
              <button type="button" aria-label={t('nav.back')} title={t('nav.backKey')} disabled={!props.travel.back} onClick={() => props.onTravel?.('back')}>
                <span aria-hidden="true">{t('glyph.travelBack')}</span>
              </button>
              <button type="button" aria-label={t('nav.forward')} title={t('nav.forwardKey')} disabled={!props.travel.forward} onClick={() => props.onTravel?.('forward')}>
                <span aria-hidden="true">{t('glyph.travelForward')}</span>
              </button>
              <button type="button" aria-label={t('rail.home')} title={t('rail.home')} aria-current={at.kind === 'home' ? 'page' : undefined} onClick={() => props.onPlace('home')}>
                <span aria-hidden="true">{t('glyph.home')}</span>
              </button>
            </nav>
          )}
          <h1>{props.title}</h1>
          {props.consoles}
        </header>
        <div className="fab-place" ref={place}>
          {props.children}
          {props.actLine}
        </div>
      </div>
    </div>
  )
}
// #endregion rail
