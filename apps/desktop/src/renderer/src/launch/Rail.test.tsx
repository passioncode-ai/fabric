// The five-place rail (SCN-162, 0.3.7 wave 3): «＋ Создать», Главная, Агенты, История, Настройки, then the projects
// list with a dot where an agent works and a count where something waits for the person. No tab strip, no back
// button of Fabric's own, no scope bar: the rail is the whole of the navigation.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import type { ProjectRow } from '../../../shared/types'
import { LaunchShell, type LaunchShellProps } from './LaunchShell'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const project = (id: string, name: string, over: Partial<ProjectRow> = {}): ProjectRow => ({
  id, name, estate_id: 'e', purpose: null, repo_path: null, status: 'active', config_revision: 1,
  created_at: '2026-10-01T00:00:00Z', memory_backend: 'local', default_agent: 'claude-code', mcp_servers: [], ...over
})

function shell(over: Partial<LaunchShellProps> = {}, locale: 'en' | 'ru' = 'en') {
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { ceo: { status: vi.fn(async () => ({ active: false })) } } }))
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
    searchOpen: false,
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

  it('opens search from the field at the top and from ⌘K', () => {
    const props = shell()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en['rail.search']) }))
    expect(props.onSearch).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(props.onSearch).toHaveBeenCalledTimes(2)
  })

  it('says how this computer is at its foot', () => {
    shell()
    expect(screen.getByText(en['rail.machine.ok'])).toBeTruthy()
    cleanup()
    shell({ machine: 'trouble' })
    expect(screen.getByText(en['rail.machine.trouble'])).toBeTruthy()
  })

  it('speaks Russian in Russian', () => {
    shell({}, 'ru')
    const nav = screen.getByRole('navigation', { name: ru['rail.label'] })
    expect(within(nav).getByRole('link', { name: new RegExp(`^${ru['rail.home']}`) })).toBeTruthy()
    expect(screen.getByRole('button', { name: ru['rail.create'] })).toBeTruthy()
    expect(ru['rail.home']).toBe('Главная')
    expect(ru['rail.create']).toBe('Создать')
  })

  it('shows the conversation with Fabric only once it is switched on', async () => {
    shell()
    expect(screen.queryByRole('button', { name: new RegExp(en['chat.open']) })).toBeNull()
  })
})
