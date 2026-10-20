// Settings as a screen (SCR-52, 2026-10-14): the agents on this computer with the source said, Switchboard's default
// shown, a catalogue that cannot be read never shown as "no agents", and the existing controls still saving.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { AgentCatalogPanel, SettingsScreen } from './SettingsScreen'
import type { AppSettings } from '../../../shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const executors = [
  { id: 'claude-code', label: 'Claude Code', connected: true, state: 'found', version: '2.4.1', path: '/opt/homebrew/bin/claude', install: null },
  { id: 'goose', label: 'Goose', connected: false, state: 'missing', version: null, path: null, install: 'brew install block-goose-cli' }
]
const stub = (catalog: () => Promise<unknown>, found: () => Promise<unknown> = async () => executors) =>
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
    fabric: {
      start: { executors: found },
      settings: { agentCatalog: catalog },
      analytics: { status: async () => ({ enabled: false, answered: true }) }
    }
  }))
const show = (ui: React.ReactNode) => render(<I18nProvider locale="en">{ui}</I18nProvider>)

describe('the agents on this computer', () => {
  it("joins Switchboard's catalogue: its default, and an agent only Switchboard knows", async () => {
    stub(async () => ({ source: 'switchboard', revision: '3', defaultId: 'claude-code', agents: [
      { id: 'claude-code', name: 'Claude Code', installed: true, path: null, enabled: true, isDefault: true, install: null, url: null },
      { id: 'kilo', name: 'Kilo Code', installed: false, path: null, enabled: false, isDefault: false, install: 'npm i -g kilo', url: null }
    ] }))
    show(<AgentCatalogPanel />)
    await waitFor(() => expect(screen.getByText(en['settings.agents.sourceSwitchboard'])).toBeTruthy())
    expect(screen.getByText(en['settings.agents.default'])).toBeTruthy()
    expect(screen.getByText('Kilo Code')).toBeTruthy()
    expect(screen.getByText('npm i -g kilo')).toBeTruthy()
    expect(screen.getByText(en['settings.agents.found'].replace('{version}', '2.4.1'))).toBeTruthy()
  })

  it("says an old Switchboard is too old, and still shows what Fabric found", async () => {
    stub(async () => ({ source: 'absent', reason: 'too-old', detail: null }))
    show(<AgentCatalogPanel />)
    await waitFor(() => expect(screen.getByText(en['settings.agents.sourceTooOld'])).toBeTruthy())
    expect(screen.getByText('Claude Code')).toBeTruthy()
    expect(screen.getByText('brew install block-goose-cli')).toBeTruthy()
    expect(screen.queryByText(en['settings.agents.default'])).toBeNull()
  })

  it('a detection that fails is said, never an empty list', async () => {
    stub(async () => ({ source: 'absent', reason: 'not-installed', detail: null }), async () => { throw new Error('PATH unreadable') })
    show(<AgentCatalogPanel />)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('PATH unreadable'))
    expect(screen.getByText(en['settings.agents.sourceNone'])).toBeTruthy()
  })

  it('a failed read is our sentence; the machine\'s words stand on their own line beneath it (UX-5)', async () => {
    stub(async () => { throw new Error('spawn switchboard ENOENT') }, async () => { throw new Error('PATH unreadable') })
    show(<AgentCatalogPanel />)
    await waitFor(() => expect(screen.getByText(en['settings.agents.unreadable'])).toBeTruthy())
    expect(screen.getByText(en['settings.agents.unreadable']).textContent).not.toContain('PATH unreadable')
    expect(screen.getByText('PATH unreadable')).toBeTruthy()
    const source = screen.getByText(en['settings.agents.sourceFailed'])
    expect(source.textContent).not.toContain('ENOENT')
    expect(screen.getByText('spawn switchboard ENOENT')).toBeTruthy()
  })
})

describe('the settings screen', () => {
  it('saves the sleep choice through the same write', async () => {
    stub(async () => ({ source: 'absent', reason: 'not-installed', detail: null }))
    const onChange = vi.fn()
    const settings = { theme: 'dark', locale: 'en', keepAwake: 'while-working', runnerFallback: { order: [] } } as unknown as AppSettings
    show(<SettingsScreen settings={settings} onChange={onChange} onOpenHistory={() => {}} onOpenAccess={() => {}} />)
    // The screen is the page's main region and its heading has focus on open (0.3.6 review i2 UX-2).
    expect(screen.getByRole('main')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: en['settings.screen.title'] }))
    fireEvent.change(screen.getByLabelText(en['power.label']), { target: { value: 'always' } })
    expect(onChange).toHaveBeenCalledWith({ keepAwake: 'always' })
    expect(screen.getByText(en['settings.screen.title'])).toBeTruthy()
  })
})

describe('the projects\u2019 messages, reached from Настройки → Ещё (0.3.7 review UX-4)', () => {
  it('the button that opens Comms carries the count of threads with new messages', () => {
    stub(async () => ({ source: 'absent', reason: 'not-installed', detail: null }))
    const settings = { theme: 'dark', locale: 'en', keepAwake: 'while-working', runnerFallback: { order: [] } } as unknown as AppSettings
    const onOpen = vi.fn()
    show(<SettingsScreen settings={settings} onChange={vi.fn()} onOpenHistory={() => {}} onOpenAccess={() => {}} onOpen={onOpen} commsUnread={{ count: 4, atLeast: false }} />)
    const button = screen.getByRole('button', { name: new RegExp(`^${en['settings.more.comms']}`) })
    expect(within(button).getByLabelText(en['rail.commsUnread'].replace('{count}', '4')).textContent).toBe('4')
    fireEvent.click(button)
    expect(onOpen).toHaveBeenCalledWith('comms')
    cleanup()
    show(<SettingsScreen settings={settings} onChange={vi.fn()} onOpenHistory={() => {}} onOpenAccess={() => {}} onOpen={onOpen} commsUnread={null} />)
    expect(screen.queryByLabelText(/New messages/)).toBeNull()
  })
})

describe('agent permissions and how each agent starts (ADR-0168)', () => {
  const options = [
    { id: 'gemini-cli', label: 'Gemini CLI', program: 'gemini', description: '', available: true, connectsToSurface: false, defaultMode: 'bypass',
      permissionModes: [{ id: 'ask', labelKey: 'agent.mode.ask', blockedKey: null, warnKey: null, args: [], env: {} },
        { id: 'bypass', labelKey: 'agent.mode.bypass', blockedKey: null, warnKey: null, args: ['--yolo'], env: {} }] },
    { id: 'goose', label: 'Goose', program: 'goose', description: '', available: true, connectsToSurface: false, defaultMode: 'bypass',
      permissionModes: [{ id: 'ask', labelKey: 'agent.mode.ask', blockedKey: null, warnKey: null, args: [], env: { GOOSE_MODE: 'approve' } },
        { id: 'bypass', labelKey: 'agent.mode.bypass', blockedKey: null, warnKey: null, args: [], env: { GOOSE_MODE: 'auto' } }] }
  ]
  const rows = [
    { id: 'gemini-cli', label: 'Gemini CLI', connected: false, state: 'found', version: '1.2', path: '/opt/homebrew/bin/gemini', install: null },
    { id: 'goose', label: 'Goose', connected: false, state: 'found', version: '1.0', path: '/opt/homebrew/bin/goose', install: null }
  ]
  const fabric = () => vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
    fabric: {
      start: { executors: async () => rows },
      settings: { agentCatalog: async () => ({ source: 'absent', reason: 'not-installed', detail: null }) },
      terminal: { options: async () => options },
      analytics: { status: async () => ({ enabled: false, answered: true }) }
    }
  }))

  it('shows the command each agent starts with, its environment first', async () => {
    fabric()
    show(<AgentCatalogPanel />)
    await waitFor(() => expect(screen.getByText('gemini --yolo')).toBeTruthy())
    expect(screen.getByText('GOOSE_MODE=auto goose')).toBeTruthy()
  })

  // 0.3.7 review UX-7: the line was read once on mount and kept the old mode after the choice changed.
  it('reads each agent\u2019s launch line again when the permission choice changes', async () => {
    let mode = 'bypass'
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
      fabric: {
        start: { executors: async () => rows },
        settings: { agentCatalog: async () => ({ source: 'absent', reason: 'not-installed', detail: null }) },
        terminal: { options: async () => options.map((o) => ({ ...o, defaultMode: mode })) },
        analytics: { status: async () => ({ enabled: false, answered: true }) }
      }
    }))
    const base = { theme: 'dark', locale: 'en', keepAwake: 'while-working', runnerFallback: { order: [] }, launchAtLogin: true }
    const view = render(<I18nProvider locale="en"><SettingsScreen settings={{ ...base, agentPermissions: 'fewer-prompts' } as unknown as AppSettings}
      onChange={vi.fn()} onOpenHistory={() => {}} onOpenAccess={() => {}} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('gemini --yolo')).toBeTruthy())
    mode = 'ask'
    view.rerender(<I18nProvider locale="en"><SettingsScreen settings={{ ...base, agentPermissions: 'manual' } as unknown as AppSettings}
      onChange={vi.fn()} onOpenHistory={() => {}} onOpenAccess={() => {}} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('GOOSE_MODE=approve goose')).toBeTruthy())
    expect(screen.queryByText('gemini --yolo')).toBeNull()
    expect(screen.getByText('gemini')).toBeTruthy()
  })

  it('offers one choice for every agent, fewer prompts chosen, and saves the other', async () => {
    fabric()
    const onChange = vi.fn()
    const settings = { theme: 'dark', locale: 'en', keepAwake: 'while-working', workspace: { path: null, git: 'unanswered' }, tabs: { tabs: [], active: null },
      readThroughSeq: 0, commsReadThrough: {}, firstRun: { completedAt: null }, runnerFallback: { order: [] }, agentPermissions: 'fewer-prompts', launchAtLogin: true } as AppSettings
    show(<SettingsScreen settings={settings} onChange={onChange} onOpenHistory={() => {}} onOpenAccess={() => {}} />)
    const fewer = screen.getByRole('radio', { name: new RegExp(en['settings.permissions.fewer']) }) as HTMLInputElement
    const manual = screen.getByRole('radio', { name: new RegExp(en['settings.permissions.manual']) }) as HTMLInputElement
    expect(fewer.checked).toBe(true)
    expect(manual.checked).toBe(false)
    fireEvent.click(manual)
    expect(onChange).toHaveBeenCalledWith({ agentPermissions: 'manual' })
  })

})

describe('launch at login, only where it does something (CO-322; 0.3.7 review UX-3, ER-3, DO-6)', () => {
  const withLoginItem = (state: unknown) => vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
    fabric: {
      start: { executors: async () => executors },
      settings: { agentCatalog: async () => ({ source: 'absent', reason: 'not-installed', detail: null }), loginItem: async () => state },
      analytics: { status: async () => ({ enabled: false, answered: true }) }
    }
  }))
  const open = (launchAtLogin: boolean, onChange = vi.fn()) => {
    const settings = { theme: 'dark', locale: 'en', keepAwake: 'while-working', runnerFallback: { order: [] }, launchAtLogin } as unknown as AppSettings
    show(<SettingsScreen settings={settings} onChange={onChange} onOpenHistory={() => {}} onOpenAccess={() => {}} />)
    return onChange
  }

  it('on macOS: on by default, the Dock note, and the person can turn it off', async () => {
    withLoginItem({ supported: true, platform: 'darwin', system: 'on' })
    const onChange = open(true)
    const box = await screen.findByRole('checkbox', { name: en['settings.launchAtLogin'] }) as HTMLInputElement
    expect(box.checked).toBe(true)
    expect(screen.getByText(en['settings.launchAtLoginNote'])).toBeTruthy()
    expect(screen.queryByText(en['settings.launchAtLogin.offDarwin'])).toBeNull()
    fireEvent.click(box)
    expect(onChange).toHaveBeenCalledWith({ launchAtLogin: false })
  })

  it('on macOS: says when the system refused or the person must allow Fabric in Login Items', async () => {
    withLoginItem({ supported: true, platform: 'darwin', system: 'needs-approval' })
    open(true)
    expect(await screen.findByText(en['settings.launchAtLogin.approval'])).toBeTruthy()
    cleanup()
    withLoginItem({ supported: true, platform: 'darwin', system: 'off' })
    open(true)
    expect(await screen.findByText(en['settings.launchAtLogin.offDarwin'])).toBeTruthy()
  })

  it('on Windows: the Start menu, never the Dock', async () => {
    withLoginItem({ supported: true, platform: 'win32', system: 'off' })
    open(true)
    expect(await screen.findByText(en['settings.launchAtLoginNoteWindows'])).toBeTruthy()
    expect(screen.queryByText(en['settings.launchAtLoginNote'])).toBeNull()
    expect(screen.getByText(en['settings.launchAtLogin.offWindows'])).toBeTruthy()
  })

  it('on Linux and in a development build: no row at all', async () => {
    withLoginItem({ supported: false })
    open(true)
    await screen.findByText(en['power.note'])
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole('checkbox', { name: en['settings.launchAtLogin'] })).toBeNull()
    expect(screen.queryByText(en['settings.launchAtLoginNote'])).toBeNull()
  })
})

