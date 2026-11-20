// Board request eef5abeb, point 3: the Claude Code sessions outside Fabric on Агенты: read, continued in Fabric, closed.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { MachineSessionsPanel } from './MachineSessions'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const row = { pid: 501, live: true, sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', cwd: '/d/site', name: 'site', status: 'busy', kind: 'interactive', entrypoint: 'cli', startedAt: null, updatedAt: null,
  source: 'claude' as const, state: 'working' as const, agent: 'claude-code' }
const about = (key: 'machineSessions.readAbout' | 'machineSessions.continueAbout' | 'machineSessions.closeAbout') => en[key].replace('{folder}', 'site')

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
    fireEvent.click(within(item).getByRole('button', { name: about('machineSessions.readAbout') }))
    expect(await within(item).findByText('fix the header')).toBeTruthy()
    expect(api.machineRead).toHaveBeenCalledWith(row.sessionId)
  })
  it('continues one in Fabric after the second press and opens its console', async () => {
    const { api, onOpenConsole } = mount()
    const item = await screen.findByTestId('machine-session')
    fireEvent.click(within(item).getByRole('button', { name: about('machineSessions.continueAbout') }))
    expect(api.machineContinue).not.toHaveBeenCalled()
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.yes'] }))
    await waitFor(() => expect(onOpenConsole).toHaveBeenCalledWith('console-1'))
  })
  it('closes one only after the second press; a refusal says why; Cancel does nothing', async () => {
    const { api } = mount({ machineClose: vi.fn(async () => ({ ok: false, why: 'changed' })) })
    const item = await screen.findByTestId('machine-session')
    fireEvent.click(within(item).getByRole('button', { name: about('machineSessions.closeAbout') }))
    fireEvent.click(within(item).getByRole('button', { name: en['common.cancel'] }))
    expect(api.machineClose).not.toHaveBeenCalled()
    fireEvent.click(within(item).getByRole('button', { name: about('machineSessions.closeAbout') }))
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.yes'] }))
    expect(await screen.findByText(`${en['machineSessions.refused']} ${en['machineSessions.why.changed']}`)).toBeTruthy()
  })
  // 0.3.26 review, iteration 1, UX-3: a session only Switchboard names is read here and offers no act.
  it('a session only Switchboard names is read, never continued or closed from here', async () => {
    mount({ machineSessions: vi.fn(async () => [{ ...row, pid: 0, name: null, status: null, source: 'switchboard', state: 'waiting' }]) })
    const item = await screen.findByTestId('machine-session')
    expect(within(item).getByRole('button', { name: about('machineSessions.readAbout') })).toBeTruthy()
    expect(within(item).queryByRole('button', { name: about('machineSessions.continueAbout') })).toBeNull()
    expect(within(item).queryByRole('button', { name: about('machineSessions.closeAbout') })).toBeNull()
    expect(item.textContent).toContain(en['machineSessions.viaSwitchboard'])
  })
  // UX-1: a folder in no project is refused before anything is stopped; a continue that failed after the stop says so.
  it('a continue refused for no project, and one stopped but not continued, are said with what to do', async () => {
    mount({ machineContinue: vi.fn(async () => ({ ok: false, why: 'no-project' })) })
    let item = await screen.findByTestId('machine-session')
    fireEvent.click(within(item).getByRole('button', { name: about('machineSessions.continueAbout') }))
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.yes'] }))
    expect(await screen.findByText(`${en['machineSessions.refused']} ${en['machineSessions.why.noProject']}`)).toBeTruthy()
    cleanup()
    mount({ machineContinue: vi.fn(async () => ({ ok: false, why: 'stopped-not-continued', resume: { sessionId: row.sessionId, cwd: '/d/site' } })) })
    item = await screen.findByTestId('machine-session')
    fireEvent.click(within(item).getByRole('button', { name: about('machineSessions.continueAbout') }))
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.yes'] }))
    // UX-18: half done is said without «It was not done», with a retry from the history that opens the console.
    expect(await screen.findByText(en['machineSessions.why.stoppedNotContinued'])).toBeTruthy()
    expect(screen.queryByText(new RegExp(en['machineSessions.refused']))).toBeNull()
    const api = window.fabric.agents as unknown as { machineContinue: ReturnType<typeof vi.fn> }
    api.machineContinue.mockResolvedValueOnce({ ok: true, sessionId: 'console-2' })
    fireEvent.click(await screen.findByRole('button', { name: en['machineSessions.resumeFromHistory'] }))
    await waitFor(() => expect(api.machineContinue).toHaveBeenCalledTimes(2))
  })
  // UX-21: a refusal Fabric has no sentence for is said in words; its code is only the detail.
  it('an unknown refusal code is never shown as the sentence', async () => {
    mount({ machineClose: vi.fn(async () => ({ ok: false, why: 'EPERM' })) })
    const item = await screen.findByTestId('machine-session')
    fireEvent.click(within(item).getByRole('button', { name: about('machineSessions.closeAbout') }))
    fireEvent.click(within(item).getByRole('button', { name: en['machineSessions.yes'] }))
    expect(await within(item).findByText(`${en['machineSessions.refused']} ${en['machineSessions.why.other']}`)).toBeTruthy()
  })
  // Switchboard, 2026-11-20 (board 7c726479): needs_you and waiting hold gone processes; the live ones are counted apart.
  it('counts the sessions a process runs now', async () => {
    mount({ machineSessions: vi.fn(async () => [row, { ...row, sessionId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', pid: 0, live: false, source: 'switchboard', state: 'needs_you' }]) })
    const counts = await screen.findByTestId('machine-counts')
    expect(counts.textContent).toContain(en['machineSessions.counts'].replace('{working}', '1').replace('{waiting}', '0').replace('{needs}', '1').replace('{live}', '1'))
  })
  it('counts sum to the list: a session with no state is counted as such', async () => {
    mount({ machineSessions: vi.fn(async () => [row, { ...row, sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', state: null }]) })
    const counts = await screen.findByTestId('machine-counts')
    expect(counts.textContent).toContain(en['machineSessions.countsUnknown'].replace('{unknown}', '1').trim())
  })
  it('none, and a read that failed, are said differently', async () => {
    mount({ machineSessions: vi.fn(async () => []) })
    expect(await screen.findByText(en['machineSessions.none'])).toBeTruthy()
    cleanup()
    mount({ machineSessions: vi.fn(async () => { throw new Error('EACCES') }) })
    expect(await screen.findByText(en['machineSessions.failed'])).toBeTruthy()
  })
})
