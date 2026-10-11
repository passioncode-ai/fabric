// The launch shell (SCR-30…SCR-41 · the launch prototype, docs/reports/product.html): a side
// navigation with the brand, the main destinations and one group per Project; a scope bar with
// the breadcrumb, Search and Profile; and Fabric's own launcher at the foot of the navigation.
// Only destinations that exist in this build are offered — a link to a screen that is not built
// yet would be a control that does nothing.

import { useEffect, useState } from 'react'
import type { ProjectRow } from '../../../shared/types'
import { useT } from '../i18n'
import { FabricAvatar } from './FabricAvatar'
import { FabricName } from './persona'
import brandMark from '../../../../../../assets/brand/favicon/transparent/passioncode-favicon-64.svg?url'
import { StackExposureNotice } from '../StackExposureNotice'

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

/** Where the scope bar offers "Discuss with Fabric": every launch screen but these. Home, the start paths and
 *  Help are the conversation's own start (the prototype's rule, scripts/product/controller.js); the guide's card
 *  already carries a Discuss of its own, and settings and a draft are not launch screens. */
export const NO_DISCUSS = ['home', 'start', 'welcome', 'help', 'guide', 'draft', 'settings'] as const
export function launchDiscuss(kind: string): boolean {
  return !(NO_DISCUSS as readonly string[]).includes(kind)
}

export interface LaunchShellProps {
  estateName: string
  projects: ProjectRow[] | null
  /** Where the operator is, for the current marker and the breadcrumb. */
  at: { kind: 'home' } | { kind: 'board' } | { kind: 'plan' } | { kind: 'pulse' } | { kind: 'help' } | { kind: 'quota' } | { kind: 'agents' } | { kind: 'settings' } | { kind: 'draft' } | { kind: 'start' } | { kind: 'welcome' } | { kind: 'project'; projectId: string; section?: ProjectSection }
  onHome(): void
  onBoard(): void
  onPlan(): void
  onHelp(): void
  onQuota(): void
  onNewProject(): void
  onProject(projectId: string, section: ProjectSection): void
  onAgents(): void
  onSettings(): void
  onHistory(): void
  onSearch(): void
  searchOpen: boolean
  /** "Your Fabric" (SCR-36): the prototype's Profile button beside Search. */
  onProfile(): void
  profileOpen: boolean
  /** Talk about THIS screen with Fabric. Null where the screen already is that conversation's start
   *  (Home, the start paths, Help) — the prototype's rule in `scripts/product/controller.js`. */
  onDiscuss: (() => void) | null
  onChat(): void
  chatOpen: boolean
  children: React.ReactNode
}

export function LaunchShell(props: LaunchShellProps): React.JSX.Element {
  const t = useT()
  const { at, projects } = props
  const [chatActive, setChatActive] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    // Not silence: an unreadable status is shown as unknown, never as "ready".
    try {
      window.fabric.ceo.status().then(s => { if (live) setChatActive(s?.active === true) }, () => { if (live) setChatActive(null) })
    } catch {
      setChatActive(null)
    }
    return () => { live = false }
  }, [])
  const current = (on: boolean) => (on ? { className: 'current', 'aria-current': 'page' as const } : {})
  const project = at.kind === 'project' ? (projects ?? []).find(p => p.id === at.projectId) : null
  const crumb = project ? project.name : t('launch.nav.fabric')
  return (
    <div className="workbench">
      <aside className="app-sidebar">
        <div className="app-logo">
          <img className="brand-mark" src={brandMark} alt="" width={35} height={35} />
          <div><strong>{t('launch.brand.product')}</strong><p className="meta">{t('launch.brand.umbrella')}</p></div>
        </div>
        <nav className="app-nav" aria-label={t('launch.nav.label')}>
          <div className="calm-main-nav">
            <a href="#" {...current(at.kind === 'home')} onClick={e => { e.preventDefault(); props.onHome() }}>{t('launch.nav.fabric')}</a>
            <a href="#" {...current(at.kind === 'board')} onClick={e => { e.preventDefault(); props.onBoard() }}>{t('launch.nav.board')}</a>
            <a href="#" {...current(at.kind === 'plan')} onClick={e => { e.preventDefault(); props.onPlan() }}>{t('launch.nav.plan')}</a>
            <a href="#" {...current(at.kind === 'draft' || at.kind === 'start')} onClick={e => { e.preventDefault(); props.onNewProject() }}>{t('launch.nav.newProject')}</a>
          </div>
          {(projects ?? []).filter(p => p.status !== 'archived').map(p => (
            <details key={p.id} className="calm-nav-group" open={project?.id === p.id}>
              <summary>{p.name}</summary>
              {(['overview', 'team', 'cycles', 'goals', 'memory', 'settings'] as ProjectSection[]).map(section => (
                <a key={section} href="#" {...current(project?.id === p.id && section === (at.kind === 'project' ? at.section ?? 'overview' : 'overview'))}
                  onClick={e => { e.preventDefault(); props.onProject(p.id, section) }}>{t(`launch.nav.project.${section}`)}</a>
              ))}
            </details>
          ))}
          <details className="calm-nav-group" open={at.kind === 'agents' || at.kind === 'settings' || at.kind === 'quota'}>
            <summary>{t('launch.nav.manage')}</summary>
            <a href="#" {...current(at.kind === 'agents')} onClick={e => { e.preventDefault(); props.onAgents() }}>{t('launch.nav.agents')}</a>
            <a href="#" {...current(at.kind === 'quota')} onClick={e => { e.preventDefault(); props.onQuota() }}>{t('launch.nav.quota')}</a>
            <a href="#" {...current(at.kind === 'settings')} onClick={e => { e.preventDefault(); props.onSettings() }}>{t('launch.nav.settings')}</a>
            <a href="#" onClick={e => { e.preventDefault(); props.onHistory() }}>{t('launch.nav.history')}</a>
          </details>
          <div className="calm-help-nav">
            <a href="#" {...current(at.kind === 'help')} onClick={e => { e.preventDefault(); props.onHelp() }}>{t('launch.nav.help')}</a>
          </div>
        </nav>
        <button type="button" className="fabric-launcher" aria-expanded={props.chatOpen} onClick={props.onChat}
          aria-label={`${t('chat.open')} · ${chatActive === null ? t('launch.launcher.unknown') : chatActive ? t('launch.launcher.ready') : t('launch.launcher.closed')}`}>
          <FabricAvatar size="tiny" label={t('launch.avatar.label')} />
          <span><strong><FabricName /></strong><small>{chatActive === null ? t('launch.launcher.unknown') : chatActive ? t('launch.launcher.ready') : t('launch.launcher.closed')}</small></span>
          <span aria-hidden="true">{t('glyph.open')}</span>
        </button>
      </aside>
      <div className="app-main">
        <div className="scope-bar">
          <span>{t('launch.workspace')} / {crumb}</span>
          <div className="actions">
            <button type="button" className="lp-button search-button" aria-pressed={props.searchOpen} onClick={props.onSearch}>{t('launch.search')}</button>
            <button type="button" className="lp-button" aria-current={props.profileOpen ? 'page' : undefined} onClick={props.onProfile}>{t('launch.profile')}</button>
          </div>
        </div>
        <StackExposureNotice />
        {props.onDiscuss && (
          <div className="calm-context-action">
            <button type="button" className="lp-button" onClick={props.onDiscuss}>{t('launch.board.discuss')}</button>
          </div>
        )}
        {props.children}
      </div>
    </div>
  )
}
