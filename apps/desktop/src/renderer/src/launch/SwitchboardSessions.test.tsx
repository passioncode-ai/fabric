// CO-457: the Switchboard sessions on «Агенты», as Fabric Dashboards lists them, read-only.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SwitchboardSessionsPanel } from './SwitchboardSessions'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const row = (over: Record<string, unknown>) => ({ id: 'sb:1', key: null, folder: '/Users/example/DATA/atlas', project: 'atlas', agent: 'claude-code', account: 'work@example.com',
  context: null, contextName: null, origin: 'switchboard', state: 'running-terminal', group: 'running', actions: [], reason: null, openedInTerminal: false,
  startedAt: 1, endedAt: null, expectedAt: null, candidates: [], waitReason: null, resumable: false, consoleEmpty: false, launch: null, paid: null, at: 1, ...over })
const mount = (answer: () => Promise<unknown>, locale: 'en' | 'ru' = 'en') => {
  vi.stubGlobal('window', Object.assign(window, { fabric: { agents: { switchboardSessions: vi.fn(answer) } } }))
  return render(<I18nProvider locale={locale}><SwitchboardSessionsPanel /></I18nProvider>)
}

describe('Switchboard\'s sessions on «Агенты» (CO-457)', () => {
  it('lists a session running in a terminal and one waiting until its probe time', async () => {
    const at = new Date(2026, 10, 2, 14, 30).getTime()
    mount(async () => ({ installed: true, unread: [], rows: [row({}), row({ id: 'st:1', project: 'beta', state: 'waiting-reset', group: 'waiting', expectedAt: at })] }), 'ru')
    await waitFor(() => expect(screen.getByText(ru['agentsPlace.switchboard.running']!)).toBeTruthy())
    expect(screen.getByText(ru['agentsPlace.switchboard.waitingUntil']!.replace('{time}', '14:30'))).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
  })

  it('shows nothing when Switchboard is not installed', async () => {
    const { container } = mount(async () => ({ installed: false, rows: [], unread: [] }))
    await waitFor(() => expect(container.textContent).toBe(''))
  })

  it('says which source did not answer, and that the read failed, never an empty list', async () => {
    mount(async () => ({ installed: true, rows: [], unread: [{ source: 'recovery', reason: 'timeout' }] }))
    await waitFor(() => expect(screen.getByText(en['agentsPlace.switchboard.partial']!.replace('{sources}', 'recovery'))).toBeTruthy())
    expect(screen.queryByText(en['agentsPlace.switchboard.empty'])).toBeNull()
    cleanup()
    mount(async () => { throw new Error('bridge down') })
    await waitFor(() => expect(screen.getByText(en['agentsPlace.switchboard.failed'])).toBeTruthy())
  })

  it('CO-585: opens a hosted session in a shell console of its project, and only a hosted one', async () => {
    const id = '0f8e2c1a-5b6d-4e7f-8a9b-0c1d2e3f4a5b'
    const plan = vi.fn(async () => ({ ok: true, projectId: 'p-1', command: `exec '/usr/local/bin/switchboard' attach ${id}` }))
    const open = vi.fn(async () => ({ sessionId: 's-1' }))
    vi.stubGlobal('window', Object.assign(window, { fabric: {
      agents: { switchboardSessions: vi.fn(async () => ({ installed: true, unread: [], rows: [
        row({ actions: ['attach', 'reveal'], launch: { launchId: id } }), row({ id: 'sb:2', project: 'plain' })] })), switchboardAttach: plan },
      terminal: { open } } }))
    render(<I18nProvider locale="en"><SwitchboardSessionsPanel /></I18nProvider>)
    const buttons = await screen.findAllByRole('button', { name: en['agentsPlace.switchboard.attach'] })
    expect(buttons).toHaveLength(1)
    expect(screen.getByText(en['agentsPlace.switchboard.runningHosted']!)).toBeTruthy()
    fireEvent.click(buttons[0]!)
    await waitFor(() => expect(open).toHaveBeenCalledWith('p-1', 'shell', `exec '/usr/local/bin/switchboard' attach ${id}`))
    expect(plan).toHaveBeenCalledWith(id)
  })

  it('CO-585: a refused plan says why and opens nothing', async () => {
    const open = vi.fn()
    vi.stubGlobal('window', Object.assign(window, { fabric: {
      agents: { switchboardSessions: vi.fn(async () => ({ installed: true, unread: [], rows: [row({ actions: ['attach'], launch: { launchId: '0f8e2c1a-5b6d-4e7f-8a9b-0c1d2e3f4a5b' } })] })),
        switchboardAttach: vi.fn(async () => ({ ok: false, reason: 'no-project' })) },
      terminal: { open } } }))
    render(<I18nProvider locale="ru"><SwitchboardSessionsPanel /></I18nProvider>)
    fireEvent.click(await screen.findByRole('button', { name: ru['agentsPlace.switchboard.attach'] }))
    expect(await screen.findByText(ru['agentsPlace.switchboard.attach.no-project']!)).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
  })
})
