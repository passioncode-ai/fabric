// DEC-0189 SL-5 and the 0.3.26 review (iteration 2, PL-15, UX-20, UX-22): the ask a `session/continue` link raises.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { appName, ContinueSessionAsk } from './ContinueSessionAsk'
import { LAUNCH_BY, LAUNCH_VIA } from '../../../shared/sessionLaunches'
import { ru } from '../i18n/ru'

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
    await waitFor(() => expect(ask.textContent).toContain(en['links.continue.which'].replace('{folder}', 'site').replace('{agent}', 'Claude Code').replace('{state}', en['machineSessions.state.working'])))
    expect(ask.textContent).toContain(en['links.continue.from'].replace('{app}', 'Fabric Dashboards'))
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
    expect(api.machineContinue).toHaveBeenCalledWith(id, { from: 'fabric-dashboards' })
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
    // Its process is gone after the stop: the next read no longer lists it.
    const reads = [[row]]
    mount({ machineSessions: vi.fn(async () => reads.shift() ?? []), machineContinue: vi.fn(async () => ({ ok: false, why: 'stopped-not-continued', resume: { sessionId: id, cwd: '/d/site' } })) })
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    const said = await screen.findByTestId('continue-refused')
    expect(said.textContent).toContain(en['machineSessions.why.stoppedNotContinued'])
    expect(said.textContent).not.toContain(en['machineSessions.refused'])
    expect(screen.getByRole('button', { name: en['machineSessions.resumeFromHistory'] })).toBeTruthy()
  })
  // DA-19, UX-27: the contract's name.instance form is a valid app, said by its product's name.
  it('names the app by its product, the instance form included; a value outside the grammar is left out', () => {
    expect(appName('observatory.default')).toBe('Observatory')
    expect(appName('fabric-dashboards')).toBe('Fabric Dashboards')
    expect(appName('some-agent')).toBe('some-agent')
    expect(en['links.continue.from']).toContain('names itself')
    expect(appName('Bad App')).toBeNull()
    expect(appName(undefined)).toBeNull()
  })
  // DA-20: a link without `from` is still a link.
  it('a link with no app still continues as a link', async () => {
    const { api } = mount()
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    await waitFor(() => expect(api.machineContinue).toHaveBeenCalledWith(id, {}))
  })
  // ER-22, UX-29: a list that could not be read is not said as «not running».
  it('a list read that failed is said as unread', async () => {
    mount({ machineSessions: vi.fn(async () => { throw new Error('EACCES') }) })
    const ask = await screen.findByTestId('continue-ask')
    await waitFor(() => expect(ask.textContent).toContain(en['links.continue.unread']))
    expect(ask.textContent).not.toContain(en['links.continue.ended'])
  })
  // UX-30, UX-36: a session only Switchboard names whose process runs is not acted on from here: no question, no press.
  it('a running session only Switchboard names is read-only here', async () => {
    mount({ machineSessions: vi.fn(async () => [{ ...row, pid: 0, live: true, source: 'switchboard' }]) })
    const ask = await screen.findByTestId('continue-ask')
    await waitFor(() => expect(ask.textContent).toContain(en['links.continue.viaSwitchboard'].replace('{folder}', 'site')))
    expect(ask.textContent).not.toContain(en['links.continue.ask'])
    expect(screen.queryByRole('button', { name: en['machineSessions.continue'] })).toBeNull()
    expect(screen.getByRole('button', { name: en['links.continue.close'] })).toBeTruthy()
  })
  // UX-33, ER-24: one no process runs (Switchboard's «needs you», ready to continue) is ended: continued from its history.
  it('an ended session only Switchboard names is continued from its history', async () => {
    const { api } = mount({ machineSessions: vi.fn(async () => [{ ...row, pid: 0, live: false, source: 'switchboard', state: 'needs_you' }]) })
    const ask = await screen.findByTestId('continue-ask')
    // UX-40: named by its folder and agent, said as ended.
    await waitFor(() => expect(ask.textContent).toContain(en['links.continue.whichEnded'].replace('{folder}', 'site').replace('{agent}', 'Claude Code')))
    expect(ask.textContent).not.toContain('only through Switchboard')
    const go = screen.getByRole('button', { name: en['machineSessions.continue'] }) as HTMLButtonElement
    expect(go.disabled).toBe(false)
    fireEvent.click(go)
    await waitFor(() => expect(api.machineContinue).toHaveBeenCalledWith(id, {}))
  })
  // UX-34: a continue link that arrived meanwhile is said.
  it('says when another continue link waits behind this one', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { agents: { machineSessions: vi.fn(async () => [row]), machineContinue: vi.fn() } } }))
    render(<I18nProvider locale="en"><ContinueSessionAsk session={id} waiting onOpened={() => {}} onDone={() => {}} /></I18nProvider>)
    expect((await screen.findByTestId('continue-ask')).textContent).toContain(en['links.continue.queued'])
  })
  // DO-22: an id found nowhere is said as not on this computer.
  it('a session found nowhere is said as not on this computer', async () => {
    mount({ machineSessions: vi.fn(async () => []), machineContinue: vi.fn(async () => ({ ok: false, why: 'gone' })) })
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    expect((await screen.findByTestId('continue-refused')).textContent).toContain(en['links.continue.gone'])
  })
})

// UX-37, ER-26, ER-27 (iteration 3, run three).
describe('ContinueSessionAsk after an answer', () => {
  it('UX-37: a half-done answer keeps the retry, even when the next read sees the stopped session as Switchboard\'s running one', async () => {
    const reads = [[row], [{ ...row, pid: 0, live: true, source: 'switchboard' as const }]]
    const { api } = mount({
      machineSessions: vi.fn(async () => reads.shift() ?? [{ ...row, pid: 0, live: true, source: 'switchboard' as const }]),
      machineContinue: vi.fn(async () => ({ ok: false, why: 'stopped-not-continued', resume: { sessionId: id, cwd: '/d/site' } }))
    })
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    await screen.findByTestId('continue-refused')
    await waitFor(() => expect(api.machineSessions).toHaveBeenCalledTimes(2))
    const retry = await screen.findByRole('button', { name: en['machineSessions.resumeFromHistory'] })
    expect((retry as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('continue-ask').textContent).not.toContain('only through Switchboard')
    expect(screen.getByTestId('continue-ask').textContent).not.toContain(en['machineSessions.state.working'])
  })
  it('UX-45: after a half-done answer the stopped session is named from the first read, without the opening question', async () => {
    const reads = [[row], [{ ...row, pid: 0, live: true, source: 'switchboard' as const }]]
    mount({
      machineSessions: vi.fn(async () => reads.shift() ?? []),
      machineContinue: vi.fn(async () => ({ ok: false, why: 'stopped-not-continued', resume: { sessionId: id, cwd: '/d/site' } }))
    })
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    await screen.findByTestId('continue-refused')
    const ask = screen.getByTestId('continue-ask').textContent ?? ''
    expect(ask).toContain(en['links.continue.whichStopped'].replace('{folder}', 'site').replace('{agent}', 'Claude Code'))
    expect(ask).not.toContain(en['links.continue.ask'])
  })
  it('ER-28: a session continued elsewhere after a half-done answer is said as running, and the press is a continue', async () => {
    const reads = [[row], [{ ...row, pid: 777, live: true, source: 'claude' as const, state: 'working' as const }]]
    mount({
      machineSessions: vi.fn(async () => reads.shift() ?? [{ ...row, pid: 777 }]),
      machineContinue: vi.fn(async () => ({ ok: false, why: 'stopped-not-continued', resume: { sessionId: id, cwd: '/d/site' } }))
    })
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    await waitFor(() => expect(screen.getByTestId('continue-ask').textContent).toContain(en['machineSessions.state.working']))
    expect(screen.queryByRole('button', { name: en['machineSessions.resumeFromHistory'] })).toBeNull()
    expect(screen.getByRole('button', { name: en['machineSessions.continue'] })).toBeTruthy()
  })
  it('ER-26: the answer calls the callbacks of the newest render', async () => {
    let answer: (v: unknown) => void = () => {}
    const api = { machineSessions: vi.fn(async () => [row]), machineContinue: vi.fn(() => new Promise((r) => { answer = r })) }
    vi.stubGlobal('window', Object.assign(window, { fabric: { agents: api } }))
    const first = vi.fn(), second = vi.fn()
    const view = render(<I18nProvider locale="en"><ContinueSessionAsk session={id} onOpened={() => {}} onDone={first} /></I18nProvider>)
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    await waitFor(() => expect(api.machineContinue).toHaveBeenCalled())
    view.rerender(<I18nProvider locale="en"><ContinueSessionAsk session={id} waiting onOpened={() => {}} onDone={second} /></I18nProvider>)
    answer({ ok: true, sessionId: 'console-1' })
    await waitFor(() => expect(second).toHaveBeenCalled())
    expect(first).not.toHaveBeenCalled()
  })
  it('ER-27: a Switchboard session whose history Fabric cannot read is not said as «not on this computer»', async () => {
    mount({ machineSessions: vi.fn(async () => [{ ...row, pid: 0, live: false, source: 'switchboard' as const }]), machineContinue: vi.fn(async () => ({ ok: false, why: 'gone' })) })
    const go = await screen.findByRole('button', { name: en['machineSessions.continue'] })
    await waitFor(() => expect((go as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(go)
    const said = (await screen.findByTestId('continue-refused')).textContent ?? ''
    expect(said).toContain(en['links.continue.goneHome'])
    expect(said).not.toContain(en['links.continue.gone'])
  })
})

// DA-21, ER-19: every launch origin the journal can record has its words in both locales.
describe('the launch journal\'s words', () => {
  it('every LAUNCH_BY and LAUNCH_VIA value has a sentence in en and ru', () => {
    for (const dict of [en, ru] as Array<Record<string, string>>) {
      for (const by of LAUNCH_BY) expect(dict[`sessionLaunch.by.${by}`], by).toBeTruthy()
      for (const via of LAUNCH_VIA) expect(dict[`sessionLaunch.via.${via}`], via).toBeTruthy()
    }
  })
})
