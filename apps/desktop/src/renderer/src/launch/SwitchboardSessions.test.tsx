// CO-457: the Switchboard sessions on «Агенты», as Fabric Dashboards lists them, read-only.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { SwitchboardSessionsPanel } from './SwitchboardSessions'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const row = (over: Record<string, unknown>) => ({ id: 'sb:1', key: null, folder: '/Users/p/DATA/atlas', project: 'atlas', agent: 'claude-code', account: 'work@example.com',
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
})
