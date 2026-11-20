// DEC-0189 SL-5 and the 0.3.26 review (iteration 2, PL-15, UX-20, UX-22): the ask a `session/continue` link raises.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ContinueSessionAsk } from './ContinueSessionAsk'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const row = { pid: 501, live: true, sessionId: id, cwd: '/d/site', name: null, status: 'busy', kind: null, entrypoint: 'cli', startedAt: null, updatedAt: null,
  source: 'claude' as const, state: 'working' as const, agent: 'claude-code' }

function mount(over: Record<string, unknown> = {}, from?: string) {
  const api = { machineSessions: vi.fn(async () => [row]), machineContinue: vi.fn(async () => ({ ok: true, sessionId: 'console-1' })), ...over }
  vi.stubGlobal('window', Object.assign(window, { fabric: { agents: api } }))
  const onOpened = vi.fn()
  const onDone = vi.fn()
  render(<I18nProvider locale="en"><ContinueSessionAsk session={id} from={from} onOpened={onOpened} onDone={onDone} /></I18nProvider>)
  return { api, onOpened, onDone }
}

describe('ContinueSessionAsk', () => {
  it('names the session by folder, agent and state and the app that asked, never by its id', async () => {
    mount({}, 'fabric-dashboards')
    const ask = await screen.findByTestId('continue-ask')
    await waitFor(() => expect(ask.textContent).toContain(en['links.continue.which'].replace('{folder}', 'site').replace('{agent}', 'claude-code').replace('{state}', en['machineSessions.state.working'])))
    expect(ask.textContent).toContain(en['links.continue.from'].replace('{app}', 'fabric-dashboards'))
    expect(ask.textContent).not.toContain('aaaaaaaa')
  })
  it('an ended session is said as continued from its history; an app id that is not a name is left out', async () => {
    mount({ machineSessions: vi.fn(async () => []) }, 'https://evil.example/x')
    const ask = await screen.findByTestId('continue-ask')
    await waitFor(() => expect(ask.textContent).toContain(en['links.continue.ended']))
    expect(ask.textContent).not.toContain('evil')
  })
  it('the press continues it with the app named, opens the console and ends the ask', async () => {
    const { api, onOpened, onDone } = mount({}, 'fabric-dashboards')
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    await waitFor(() => expect(onOpened).toHaveBeenCalledWith('console-1'))
    expect(api.machineContinue).toHaveBeenCalledWith(id, 'fabric-dashboards')
    expect(onDone).toHaveBeenCalled()
  })
  it('a refusal is said in words and keeps the ask; Cancel waits while the act is sent', async () => {
    let answer: (v: unknown) => void = () => {}
    const { api, onDone } = mount({ machineContinue: vi.fn(() => new Promise((r) => { answer = r })) })
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    const cancel = screen.getByRole('button', { name: en['common.cancel'] }) as HTMLButtonElement
    expect(cancel.disabled).toBe(true)
    await waitFor(() => expect(api.machineContinue).toHaveBeenCalled())
    answer({ ok: false, why: 'no-project' })
    expect((await screen.findByTestId('continue-refused')).textContent).toContain(en['machineSessions.why.noProject'])
    expect(onDone).not.toHaveBeenCalled()
    await waitFor(() => expect(cancel.disabled).toBe(false))
    fireEvent.click(cancel)
    expect(onDone).toHaveBeenCalled()
  })
  it('a stopped session that did not reach a console is half done: no «not done», a retry from its history', async () => {
    mount({ machineContinue: vi.fn(async () => ({ ok: false, why: 'stopped-not-continued', resume: { sessionId: id, cwd: '/d/site' } })) })
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    const said = await screen.findByTestId('continue-refused')
    expect(said.textContent).toContain(en['machineSessions.why.stoppedNotContinued'])
    expect(said.textContent).not.toContain(en['machineSessions.refused'])
    expect(screen.getByRole('button', { name: en['machineSessions.resumeFromHistory'] })).toBeTruthy()
  })
})
