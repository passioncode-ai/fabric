// The five-place rail (SCN-162, 0.3.7 wave 3): «＋ Создать», Главная, Агенты, История, Настройки, then the projects
// list with a dot where an agent works and a count where something waits for the person. No tab strip, no back
// button of Fabric's own, no scope bar: the rail is the whole of the navigation.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import type { ProjectRow } from '../../../shared/types'
import { LaunchShell, machineOf, type LaunchShellProps } from './LaunchShell'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const project = (id: string, name: string, over: Partial<ProjectRow> = {}): ProjectRow => ({
  id, name, estate_id: 'e', purpose: null, repo_path: null, status: 'active', config_revision: 1,
  created_at: '2026-10-01T00:00:00Z', memory_backend: 'local', default_agent: 'claude-code', mcp_servers: [], ...over
})

function shell(over: Partial<LaunchShellProps> = {}, locale: 'en' | 'ru' = 'en', chatActive = false) {
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { ceo: { status: vi.fn(async () => ({ active: chatActive })) } } }))
  const props: LaunchShellProps = {
    projects: [project('p1', 'Atlas'), project('p2', 'Nicegram'), project('p3', 'Fabric')],
    projectsProblem: null,
    projectsReadAt: null,
    onRetryProjects: vi.fn(),
    at: { kind: 'home' },
    title: 'Home',
    pins: ['p3'],
    lastActivity: { p2: '2026-10-18T10:00:00Z', p1: '2026-10-17T10:00:00Z' },
    live: new Set(['p2']),
    waiting: { total: 3, byProject: { p1: 2 } },
    machine: 'ok',
    onPlace: vi.fn(),
    onCreateProject: vi.fn(),
    onProject: vi.fn(),
    onSearch: vi.fn(),
    children: <p>place body</p>,
    ...over
  }
  render(<I18nProvider locale={locale}><LaunchShell {...props} /></I18nProvider>)
  return props
}

const rail = () => screen.getByRole('navigation', { name: en['rail.label'] })

describe('the rail', () => {
  it('holds «Создать» and the five places, Проект being opened from the list rather than a sixth entry', () => {
    const props = shell()
    const nav = rail()
    const links = within(nav).getAllByRole('link').map((a) => a.textContent ?? '')
    expect(links.slice(0, 4).map((s) => s.replace(/\d+$/, ''))).toEqual([en['rail.home'], en['rail.agents'], en['rail.history'], en['rail.settings']])
    fireEvent.click(screen.getByRole('button', { name: en['rail.create'] }))
    expect(props.onPlace).toHaveBeenCalledWith('create')
    for (const [name, place] of [[en['rail.agents'], 'agents'], [en['rail.history'], 'history'], [en['rail.settings'], 'settings'], [en['rail.home'], 'home']] as const) {
      fireEvent.click(within(nav).getByRole('link', { name: new RegExp(`^${name}`) }))
      expect(props.onPlace).toHaveBeenLastCalledWith(place)
    }
  })

  it('marks the place the person is at, and nothing else', () => {
    shell({ at: { kind: 'history' } })
    expect(within(rail()).getByRole('link', { name: new RegExp(`^${en['rail.history']}`) }).getAttribute('aria-current')).toBe('page')
    expect(within(rail()).getByRole('link', { name: new RegExp(`^${en['rail.home']}`) }).getAttribute('aria-current')).toBeNull()
  })

  it('carries Главная’s count of what waits for the person, and none when nothing waits or it is unknown', () => {
    shell()
    expect(within(rail()).getByLabelText(en['rail.waiting'].replace('{count}', '3')).textContent).toBe('3')
    cleanup()
    shell({ waiting: null })
    expect(within(rail()).queryByLabelText(/wait for you/)).toBeNull()
  })

  // 0.3.7 review UX-4: the count of Comms threads with new messages went unseen when Comms moved under Настройки → Ещё.
  it('carries the count of Comms threads with new messages on Настройки, "N+" when the board cut the heads', () => {
    shell({ commsUnread: { count: 7, atLeast: false } })
    const settings = within(rail()).getByRole('link', { name: new RegExp(`^${en['rail.settings']}`) })
    expect(within(settings).getByLabelText(en['rail.commsUnread'].replace('{count}', '7')).textContent).toBe('7')
    expect(settings.getAttribute('aria-label') ?? '').toBe('')
    cleanup()
    shell({ commsUnread: { count: 5000, atLeast: true } })
    expect(within(rail()).getByLabelText(en['rail.commsUnreadMax'].replace('{count}', '5000')).textContent).toBe('5000+')
    cleanup()
    shell({ commsUnread: { count: 0, atLeast: false } }, 'ru')
    expect(screen.queryByLabelText(/Новые сообщения/)).toBeNull()
    cleanup()
    shell({ commsUnread: { count: 3, atLeast: false } }, 'ru')
    expect(screen.getByLabelText('Новые сообщения: 3')).toBeTruthy()
  })

  // 0.3.7 review UX-9: under 900 px the names are hidden; each place keeps a tooltip and an accessible name of its own.
  it('names each place in a tooltip and in its accessible name, and the sidebar apart from its navigation', () => {
    shell()
    for (const place of ['home', 'agents', 'history', 'settings'] as const) {
      const name = en[`rail.${place}`]
      const link = within(rail()).getByRole('link', { name: new RegExp(`^${name}`) })
      expect(link.getAttribute('title')).toBe(name)
      // The name is referenced, so it survives the fold that hides the visible span.
      const ids = (link.getAttribute('aria-labelledby') ?? '').split(' ')
      expect(document.getElementById(ids[0])?.textContent).toBe(name)
    }
    expect(within(rail()).getByRole('link', { name: `${en['rail.home']} ${en['rail.waiting'].replace('{count}', '3')}` })).toBeTruthy()
    expect(screen.getByRole('complementary', { name: en['rail.aside'] })).toBeTruthy()
    expect(en['rail.aside']).not.toBe(en['rail.label'])
  })

  it('lists favourites first, then by latest activity; a dot where an agent works, a count where the person is needed', () => {
    const props = shell()
    const list = screen.getByRole('list', { name: en['rail.projects'] })
    const rows = within(list).getAllByRole('link')
    expect(rows.map((r) => r.querySelector('.rail-name')?.textContent)).toEqual(['Fabric', 'Nicegram', 'Atlas'])
    expect(within(rows[0]).getByLabelText(en['rail.favourite'])).toBeTruthy()
    expect(within(rows[1]).getByLabelText(en['rail.live'])).toBeTruthy()
    expect(within(rows[0]).queryByLabelText(en['rail.live'])).toBeNull()
    expect(within(rows[2]).getByLabelText(en['rail.waitingProject'].replace('{count}', '2')).textContent).toBe('2')
    fireEvent.click(rows[1])
    expect(props.onProject).toHaveBeenCalledWith('p2')
  })

  it('marks the open project in the list', () => {
    shell({ at: { kind: 'project', projectId: 'p1' } })
    const row = within(screen.getByRole('list', { name: en['rail.projects'] })).getAllByRole('link')[2]
    expect(row.getAttribute('aria-current')).toBe('page')
  })

  it('says it is reading rather than «no projects» before the list has answered', () => {
    shell({ projects: null })
    expect(screen.getByText(en['rail.projects.reading'])).toBeTruthy()
    expect(screen.queryByText(en['rail.projects.none'])).toBeNull()
  })

  it('offers «Создать проект» when there is no project yet', () => {
    const props = shell({ projects: [] })
    expect(screen.getByText(en['rail.projects.none'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['rail.projects.create'] }))
    expect(props.onCreateProject).toHaveBeenCalledOnce()
  })

  it('says a failed read in the rail, keeps the last list marked with its time, and offers to read again', () => {
    const props = shell({ projectsProblem: 'connect ECONNREFUSED', projectsReadAt: '2026-10-18T10:15:00Z' })
    expect(screen.getByText(en['rail.projects.failed'])).toBeTruthy()
    expect(screen.getByText('connect ECONNREFUSED')).toBeTruthy()
    expect(screen.getByText(/as it was at/)).toBeTruthy()
    expect(within(screen.getByRole('list', { name: en['rail.projects'] })).getAllByRole('link')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: en['rail.projects.retry'] }))
    expect(props.onRetryProjects).toHaveBeenCalledOnce()
    // The five places stay usable.
    fireEvent.click(within(rail()).getByRole('link', { name: new RegExp(`^${en['rail.agents']}`) }))
    expect(props.onPlace).toHaveBeenCalledWith('agents')
  })

  it('has no tab strip, no back button and no scope bar', () => {
    shell()
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByRole('button', { name: en['nav.back'] })).toBeNull()
    expect(document.querySelector('.scope-bar')).toBeNull()
  })

  it('opens search from ⌘K, with no search field, profile or Fabric chat in the top bar or the rail (OF-05)', () => {
    const props = shell()
    expect(document.querySelector('.fab-search, .rail-me, .rail-chat')).toBeNull()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(props.onSearch).toHaveBeenCalledTimes(1)
    const top = document.querySelector('.fab-top') as HTMLElement
    expect(within(top).getByRole('heading', { level: 1 }).textContent).toBe('Home')
    expect(within(top).queryAllByRole('button')).toHaveLength(0)
  })

  it('says how this computer is only when something needs a look (OF-05)', () => {
    shell()
    expect(screen.queryByRole('status')).toBeNull()
    cleanup()
    shell({ machine: 'reading' })
    expect(screen.queryByRole('status')).toBeNull()
    cleanup()
    shell({ machine: 'trouble' })
    expect(screen.getByRole('status').textContent).toContain(en['rail.machine.trouble'])
  })

  // 0.3.7 review UX-10: a draft not kept or a refused link set the shell's error, and the foot blamed this computer.
  it('blames this computer only when its own reading failed, never for a draft or a link', () => {
    expect(machineOf({ read: true, failed: false }, 'the draft was closed, but it could not be kept')).toBe('ok')
    expect(machineOf({ read: false, failed: false }, 'a link was refused')).toBe('reading')
    expect(machineOf({ read: true, failed: true }, null)).toBe('trouble')
    expect(machineOf({ read: false, failed: true })).toBe('trouble')
  })

  it('speaks Russian in Russian', () => {
    shell({}, 'ru')
    const nav = screen.getByRole('navigation', { name: ru['rail.label'] })
    expect(within(nav).getByRole('link', { name: new RegExp(`^${ru['rail.home']}`) })).toBeTruthy()
    expect(screen.getByRole('button', { name: ru['rail.create'] })).toBeTruthy()
    expect(ru['rail.home']).toBe('Главная')
    expect(ru['rail.create']).toBe('Создать')
  })

  it('puts no conversation with Fabric on the rail, even when it is switched on (OF-05)', async () => {
    shell({ onChat: vi.fn() } as Partial<LaunchShellProps>, 'en', true)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('button', { name: new RegExp(en['chat.open']) })).toBeNull()
  })

  it('keeps the rail compact: project rows at most 26 px, places at most 30 px (OF-04)', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync(`${process.cwd()}/src/renderer/src/launch/rail.css`, 'utf8')
    const minHeight = (selector: string): number => {
      // The last rule naming the selector that sets a min-height wins, as in the cascade (same specificity).
      const rules = css.split('}').map((r) => r.trim().split('{')).filter(([sel, body]) =>
        body !== undefined && !sel.startsWith('@') && sel.split(',').map((x) => x.trim()).includes(selector) && /min-height:/.test(body))
      const m = rules.at(-1)?.[1].match(/min-height:(\d+)px/)
      return m ? Number(m[1]) : Number.NaN
    }
    expect(minHeight('.rail-projects a')).toBeLessThanOrEqual(26)
    expect(minHeight('.rail-places a')).toBeLessThanOrEqual(30)
  })
})

describe('the place scroller', () => {
  it('opens a page reached by going back where the person left it, and a page reached otherwise at its top (CO-388)', () => {
    const tops: number[] = []
    const scrollTo = vi.fn(function (this: HTMLElement, o?: ScrollToOptions) { if (this.matches('.shell > main')) tops.push(o?.top ?? -1); return this })
    const original = HTMLElement.prototype.scrollTo
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof original
    try {
      vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { ceo: { status: vi.fn(async () => ({ active: false })) } } }))
      const props = (at: LaunchShellProps['at'], restoreScroll = false): LaunchShellProps => ({
        projects: [project('p1', 'Atlas')], projectsProblem: null, projectsReadAt: null, onRetryProjects: vi.fn(), at, title: 'T',
        pins: [], lastActivity: {}, live: new Set<string>(), waiting: null, machine: 'ok', onPlace: vi.fn(), onCreateProject: vi.fn(),
        onProject: vi.fn(), onSearch: vi.fn(), restoreScroll, children: <div className="shell"><main className="content"><p>body</p></main></div>
      })
      const { container, rerender } = render(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'home' })} /></I18nProvider>)
      const main = container.querySelector('.shell > main') as HTMLElement
      Object.defineProperty(main, 'scrollTop', { configurable: true, value: 640 })
      main.dispatchEvent(new Event('scroll'))
      rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'history' })} /></I18nProvider>)
      rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'home' }, true)} /></I18nProvider>)
      expect(tops.at(-1)).toBe(640)
      rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'history' })} /></I18nProvider>)
      rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'home' })} /></I18nProvider>)
      expect(tops.at(-1)).toBe(0)
    } finally {
      HTMLElement.prototype.scrollTo = original
    }
  })
  // The page scrolls inside the place (rail.css; scripts/test/shell-scroll.browser.mjs proves the wheel reaches the
  // foot of a long page). Moving to another place, or another project, starts it at its top.
  it('starts a new place, or another project, at its top; the same place keeps its position', () => {
    // Counts the resets of the page itself (`.shell > main`), the scroller a person moves (0.3.10 review ER-4).
    const scrollTo = vi.fn(function (this: HTMLElement, _o?: ScrollToOptions) { return this })
    const original = HTMLElement.prototype.scrollTo
    HTMLElement.prototype.scrollTo = scrollTo as unknown as typeof original
    try {
      vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { ceo: { status: vi.fn(async () => ({ active: false })) } } }))
      const calls = (): number => scrollTo.mock.calls.filter(([o], i) => (o as ScrollToOptions)?.top === 0 && (scrollTo.mock.contexts[i] as HTMLElement).matches('.shell > main')).length
      const props = (at: LaunchShellProps['at']): LaunchShellProps => ({
        projects: [project('p1', 'Atlas')], projectsProblem: null, projectsReadAt: null, onRetryProjects: vi.fn(), at, title: 'T',
        pins: [], lastActivity: {}, live: new Set<string>(), waiting: null, machine: 'ok', onPlace: vi.fn(), onCreateProject: vi.fn(),
        onProject: vi.fn(), onSearch: vi.fn(), children: <div className="shell"><main className="content"><p>body</p></main></div>
      })
      const { rerender } = render(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'home' })} /></I18nProvider>)
      const first = calls()
      rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'home' })} /></I18nProvider>)
      expect(calls()).toBe(first)
      rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'history' })} /></I18nProvider>)
      expect(calls()).toBe(first + 1)
      rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'project', projectId: 'p1' })} /></I18nProvider>)
      rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'project', projectId: 'p2' })} /></I18nProvider>)
      expect(calls()).toBe(first + 3)
      // The board and the plan both mark nothing on the rail; App's place key still tells them apart.
      rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'elsewhere' })} placeKey="board" /></I18nProvider>)
      const atBoard = calls()
      rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'elsewhere' })} placeKey="plan" /></I18nProvider>)
      expect(calls()).toBe(atBoard + 1)
    } finally {
      HTMLElement.prototype.scrollTo = original
    }
  })

  it('moves focus from the rail to the new page, so the keyboard scrolls it (CO-384)', () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { ceo: { status: vi.fn(async () => ({ active: false })) } } }))
    const props = (at: LaunchShellProps['at'], heading: string): LaunchShellProps => ({
      projects: [project('p1', 'Atlas')], projectsProblem: null, projectsReadAt: null, onRetryProjects: vi.fn(), at, title: 'T',
      pins: [], lastActivity: {}, live: new Set<string>(), waiting: null, machine: 'ok', onPlace: vi.fn(), onCreateProject: vi.fn(),
      onProject: vi.fn(), onSearch: vi.fn(),
      children: <div className="shell"><main className="content"><h2>{heading}</h2><p>body</p></main></div>
    })
    const { rerender, container } = render(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'home' }, 'Home')} /></I18nProvider>)
    const link = container.querySelector<HTMLElement>('.rail a')!
    link.focus()
    expect(document.activeElement).toBe(link)
    rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'history' }, 'History')} /></I18nProvider>)
    expect(document.activeElement?.textContent).toBe('History')
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1')
    // Focus elsewhere (⌘K, a field) is left where it is.
    const field = document.createElement('input')
    document.body.appendChild(field)
    field.focus()
    rerender(<I18nProvider locale="en"><LaunchShell {...props({ kind: 'settings' }, 'Settings')} /></I18nProvider>)
    expect(document.activeElement).toBe(field)
    field.remove()
  })
})
