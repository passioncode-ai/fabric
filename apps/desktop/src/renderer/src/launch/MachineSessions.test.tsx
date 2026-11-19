// Board request eef5abeb, point 3: the Claude Code sessions outside Fabric on Агенты: read, continued in Fabric, closed.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { MachineSessionsPanel } from './MachineSessions'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const row = { pid: 501, sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', cwd: '/d/site', name: 'site', status: 'busy', kind: 'interactive', entrypoint: 'cli', startedAt: null, updatedAt: null }

function mount(over: Record<string, unknown> = {}) {
  const api = {
    machineSessions: vi.fn(async () => [row]),
    machineRead: vi.fn(async () => ({ turns: [{ role: 'user', text: 'fix the header' }, { role: 'assistant', text: 'done' }] })),
    machineClose: vi.fn(async () => ({ ok: true })),
    machineContinue: vi.fn(async () => ({ ok: true, sessionId: 'console-1' })),
    ...over
  }
  vi.stubGlobal('window', Object.assign(window, { fabric: { agents: api } }))
  const onOpenConsole = vi.fn()
  render(<I18nProvider locale="en"><MachineSessionsPanel onOpenConsole={onOpenConsole} /></I18nProvider>)
  return { api, onOpenConsole }
}

describe('MachineSessionsPanel', () => {
  it('lists them, and reads one\'s last messages in place', async () => {
    const { api } = mount()
    const item = await screen.findByTestId('machine-session')
    expect(item.textContent).toContain('site')
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.read'] }))
    expect(await within(item).findByText('fix the header')).toBeTruthy()
    expect(api.machineRead).toHaveBeenCalledWith(row.sessionId)
  })
  it('continues one in Fabric after the second press and opens its console', async () => {
    const { api, onOpenConsole } = mount()
    const item = await screen.findByTestId('machine-session')
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.continue'] }))
    expect(api.machineContinue).not.toHaveBeenCalled()
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.yes'] }))
    await waitFor(() => expect(onOpenConsole).toHaveBeenCalledWith('console-1'))
  })
  it('closes one only after the second press; a refusal says why; Cancel does nothing', async () => {
    const { api } = mount({ machineClose: vi.fn(async () => ({ ok: false, why: 'changed' })) })
    const item = await screen.findByTestId('machine-session')
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.close'] }))
    fireEvent.click(within(item).getByRole('button', { name: en['common.cancel'] }))
    expect(api.machineClose).not.toHaveBeenCalled()
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.close'] }))
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.yes'] }))
    expect(await screen.findByText(en['machineSessions.why.changed'])).toBeTruthy()
  })
  it('none, and a read that failed, are said differently', async () => {
    mount({ machineSessions: vi.fn(async () => []) })
    expect(await screen.findByText(en['machineSessions.none'])).toBeTruthy()
    cleanup()
    mount({ machineSessions: vi.fn(async () => { throw new Error('EACCES') }) })
    expect(await screen.findByText(en['machineSessions.failed'])).toBeTruthy()
  })
})
