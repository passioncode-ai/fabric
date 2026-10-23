// A coding agent's console opens INSIDE Fabric (OF-03, SCN-172): «Open the session» in Агенты adds a tab along the top
// with the console sign and the project's name and shows the console in the content area; a second open of the same
// session switches to its tab rather than adding another; × takes the tab away and the session goes on running.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    open(): void {}
    loadAddon(): void {}
    write(): void {}
    focus(): void {}
    dispose(): void {}
    onData(): { dispose: () => void } { return { dispose: () => {} } }
    cols = 80
    rows = 24
  }
}))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit(): void {} } }))

import { App } from './App'
import { en } from './i18n/en'
import { whole } from '../../../test/envelopes'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.sessionStorage.clear()
})

const session = {
  sessionId: 's1', projectId: 'p1', cwd: '/Users/me/DATA/fabric-dashboards', program: 'claude', optionId: 'claude-code',
  permissionMode: null, excerpt: '', written: 0, running: true, state: 'running', startedAt: '2026-10-19T10:00:00Z',
  lastActivityAt: '2026-10-19T10:00:00Z', tail: '', exitCode: null
}

// The shell's seams, as `actLineShell.test.tsx` gives them, plus what Агенты and a console read.
function stub(sessions: unknown[]) {
  const api = {
    settings: { read: async () => ({ theme: 'dark', locale: 'en', keepAwake: 'never' }) },
    meta: {
      info: async () => ({
        estateId: 'e1',
        estateName: 'org #1',
        filePath: null,
        sessionId: null,
        build: null,
        buildLine: { says: 'a build that cannot say what it is', short: 'unknown', unidentified: true },
        compatibility: { compatibility: 'compatible', reasonCode: 'in_window', says: 'in window' }
      })
    },
    tabs: { read: async () => ({ tabs: [], active: null }), write: vi.fn(async () => {}), onCloseActive: () => () => {} },
    projects: {
      list: async () => [{ id: 'p1', name: 'fabric-dashboards', estate_id: 'e1' }],
      onRepoChanged: () => () => {},
      repoStates: async () => [],
      stats: async () => null,
      saveSettings: async () => ({ state: 'committed', revision: '1' })
    },
    terminal: {
      list: async () => sessions,
      get: async (id: string) => (sessions as Array<{ sessionId: string }>).find((s) => s.sessionId === id) ?? null,
      history: async () => [],
      scrollback: async () => null,
      onData: () => () => {},
      onExit: () => () => {},
      write: () => {},
      resize: () => {},
      options: async () => [],
      memoryBackends: async () => [],
      claims: async () => [],
      open: async () => ({ ok: true }),
      end: vi.fn(async () => ({ ok: true })),
      dismiss: vi.fn(async () => ({ ok: true }))
    },
    feed: { replay: vi.fn(async () => []) },
    acts: { undo: vi.fn(), history: async () => ({ rows: [], next: null }) },
    drafts: { read: async () => ({ drafts: {}, status: 'ready', problem: null }), save: async () => ({ saved: true, reason: null }) },
    gateway: { offer: async () => ({ reachable: false, servers: [] }) },
    memory: {
      backends: async () => [],
      overview: async () => null,
      misses: async () => [],
      remember: async () => ({ ok: true }),
      retro: async () => null,
      search: async () => []
    },
    estate: { summary: async () => null, profile: async () => null },
    attention: { list: async () => whole([]) },
    favourites: { list: async () => [] },
    board: { query: async () => ({ rows: [], total: 0 }) },
    workspace: { state: async () => ({ path: null, git: 'declined' }) },
    windows: { openSession: vi.fn(async () => {}) },
    search: { run: vi.fn(async () => []) },
    runs: { status: async () => null, list: async () => [] },
    hub: { overview: async () => ({ agents: [], keptOut: [] }) },
    agents: { list: async () => [], create: async () => ({ ok: true }) },
    digest: { read: async () => null, seen: async () => {} },
    goals: { list: async () => [], define: async () => ({ ok: true }) },
    harness: { read: async () => null },
    tasks: { list: async () => ({ tasks: [], closed: { truncated: false, says: 'all of them' } }) },
    repos: { list: async () => [] },
    routines: { list: async () => [] },
    transcripts: { list: async () => [], get: async () => null },
    automations: { list: async () => [] },
    diagnostics: { read: async () => ({ records: [], file: null }) },
    stack: { exposure: async () => null }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return { api }
}

const rail = () => screen.getByRole('navigation', { name: en['rail.label'] })
const agentsLink = () => within(rail()).getByRole('link', { name: new RegExp(`^${en['rail.agents']}`) })
const tabsStrip = () => screen.queryByRole('navigation', { name: en['consoles.label'] })
const content = () => document.querySelector('main.content') as HTMLElement

async function openFromAgents(): Promise<void> {
  await screen.findByRole('navigation', { name: en['rail.label'] })
  fireEvent.click(agentsLink())
  // The agent's row in Агенты, then its «Open the session».
  const row = await waitFor(() => within(content()).getByText('fabric-dashboards'))
  fireEvent.click(row)
  fireEvent.click(await within(content()).findByRole('button', { name: en['agents.openSession'] }))
}

describe('a console opens inside Fabric as a tab along the top', () => {
  it('opens in the main window with its tab, not in a window of its own', async () => {
    const { api } = stub([session])
    render(<App />)
    await openFromAgents()
    const strip = await waitFor(() => {
      const found = tabsStrip()
      expect(found).toBeTruthy()
      return found!
    })
    const tab = within(strip).getByRole('button', { name: /^fabric-dashboards/ })
    expect(tab.getAttribute('aria-current')).toBe('page')
    expect(tab.textContent).toContain(en['glyph.console'])
    expect(api.windows.openSession).not.toHaveBeenCalled()
    // The console itself, full size in the content area: its folder in the header.
    await within(content()).findByText('/Users/me/DATA/fabric-dashboards')
    // The separate window stays one press away, on the console itself.
    fireEvent.click(within(content()).getByRole('button', { name: en['consoles.detach'] }))
    await waitFor(() => expect(api.windows.openSession).toHaveBeenCalledWith('s1'))
  })

  it('a second open of the same session switches to its tab and adds none', async () => {
    stub([session])
    render(<App />)
    await openFromAgents()
    await waitFor(() => expect(tabsStrip()).toBeTruthy())
    await openFromAgents()
    await waitFor(() => expect(agentsLink().getAttribute('aria-current')).toBeNull())
    expect(within(tabsStrip()!).getAllByRole('listitem')).toHaveLength(1)
    expect(within(tabsStrip()!).getByRole('button', { name: /^fabric-dashboards/ }).getAttribute('aria-current')).toBe('page')
  })

  it('× closes the tab only: the session is not ended, and the strip goes with its last tab', async () => {
    const { api } = stub([session])
    render(<App />)
    await openFromAgents()
    await waitFor(() => expect(tabsStrip()).toBeTruthy())
    fireEvent.click(within(tabsStrip()!).getByRole('button', { name: en['consoles.close'].replace('{name}', 'fabric-dashboards') }))
    await waitFor(() => expect(tabsStrip()).toBeNull())
    expect(api.terminal.end).not.toHaveBeenCalled()
    expect(api.terminal.dismiss).not.toHaveBeenCalled()
    // Back where the person was before the console: Агенты.
    expect(agentsLink().getAttribute('aria-current')).toBe('page')
  })
})
