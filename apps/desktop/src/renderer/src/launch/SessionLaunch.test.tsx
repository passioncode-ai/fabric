// Board request eef5abeb, point 2: on an agent's page, who started its console and from where (the launch journal),
// and «Закрыть сессию», asked once more before it acts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { SessionLaunch } from './SessionLaunch'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const launch = {
  sessionId: 's-1', projectId: 'p', cwd: '/d/app', branch: 'feat/x', runner: 'claude-code', optionId: 'claude-code', program: 'claude',
  by: 'ceo', via: 'voice', reason: 'the owner asked', parentSessionId: 'cccccccc-1111', taskId: null, requestId: null, machine: 'mac',
  appPid: 1, appVersion: 'v', pid: 9, startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  runnerSessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', stopAskedBy: null, stopReason: null, endedAt: null, end: null, exitCode: null, signal: null
}

function mount(api: { launch: () => Promise<unknown>; end?: () => Promise<unknown> }, canClose = true, locale: 'en' | 'ru' = 'en') {
  const end = vi.fn(api.end ?? (async () => ({ state: 'stopped' })))
  vi.stubGlobal('window', Object.assign(window, { fabric: { terminal: { launch: vi.fn(api.launch), end } } }))
  render(<I18nProvider locale={locale}><SessionLaunch sessionId="s-1" canClose={canClose} /></I18nProvider>)
  return { end }
}

describe('SessionLaunch', () => {
  it('says who started it, through what, the reason, the console above it, the branch, the folder and how to continue', async () => {
    mount({ launch: async () => launch })
    expect(await screen.findByText(/by the CEO, by voice, 5m ago/)).toBeTruthy()
    expect(screen.getByText(en['sessionLaunch.reason'].replace('{reason}', 'the owner asked'))).toBeTruthy()
    expect(screen.getByText(en['sessionLaunch.parentCeo'])).toBeTruthy()
    expect(screen.queryByText(/cccccccc/), 'a machine id is not shown to a person (SP-2)').toBeNull()
    expect(screen.getByText('feat/x')).toBeTruthy()
    expect(screen.getByText('/d/app')).toBeTruthy()
    expect(screen.getByText('claude --resume aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBeTruthy()
  })
  it('in Russian, the person\'s own start reads «вы, с экрана Fabric»', async () => {
    mount({ launch: async () => ({ ...launch, by: 'person', via: 'screen', reason: null, parentSessionId: null }) }, true, 'ru')
    expect(await screen.findByText(/^вы, с экрана Fabric, 5 мин назад/)).toBeTruthy()
  })
  it('a session Fabric did not start says so; a journal it could not read says that, never «not started here»', async () => {
    mount({ launch: async () => null })
    expect(await screen.findByText(en['sessionLaunch.none'])).toBeTruthy()
    cleanup()
    mount({ launch: async () => { throw new Error('EACCES') } })
    expect(await screen.findByText(en['sessionLaunch.failed'])).toBeTruthy()
    expect(screen.queryByText(en['sessionLaunch.none'])).toBeNull()
  })
  it('closes only after the second press, as the person\'s stop; Cancel leaves it running', async () => {
    const { end } = mount({ launch: async () => launch })
    fireEvent.click(await screen.findByRole('button', { name: en['sessionLaunch.close'] }))
    expect(end).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en['common.cancel'] }))
    expect(end).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en['sessionLaunch.close'] }))
    fireEvent.click(screen.getByRole('button', { name: en['sessionLaunch.closeYes'] }))
    await waitFor(() => expect(end).toHaveBeenCalledWith('s-1'))
    expect(await screen.findByText(en['sessionLaunch.closed'])).toBeTruthy()
  })
  it('a close that fails is said with the machine\'s words; no close is offered for a console Fabric does not hold', async () => {
    mount({ launch: async () => launch, end: async () => { throw new Error('the process did not answer') } })
    fireEvent.click(await screen.findByRole('button', { name: en['sessionLaunch.close'] }))
    fireEvent.click(screen.getByRole('button', { name: en['sessionLaunch.closeYes'] }))
    expect(await screen.findByText(en['sessionLaunch.closeFailed'])).toBeTruthy()
    cleanup()
    mount({ launch: async () => launch }, false)
    await screen.findByText(/by the CEO/)
    expect(screen.queryByRole('button', { name: en['sessionLaunch.close'] })).toBeNull()
  })
})
