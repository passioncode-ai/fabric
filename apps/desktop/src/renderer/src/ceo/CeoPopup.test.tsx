// The owner, 2026-11-19: the CEO console could not be stopped from its popup. «Остановить» stops it and says so; a
// stopped CEO offers «Запустить»; a stop that failed says it did not stop. The call is a panel inside the chat (SCN-184).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CeoPopup } from './CeoPopup'
import { CallPanel, type VoiceCallState } from './CeoCall'
import { I18nProvider } from '../i18n'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const status = (state: string) => ({ state, sessionId: null, runner: 'claude-code', models: ['anthropic/claude-opus-5.5'], passedOver: [], setAside: [], folder: '/x', problem: null })

function setup(stop = vi.fn().mockResolvedValue({ ok: true, status: status('stopped') })) {
  const restart = vi.fn().mockResolvedValue(status('running'))
  const ceoAgent = {
    ensure: vi.fn().mockResolvedValue(status('running')), takeDraft: vi.fn().mockResolvedValue(null), takeCall: vi.fn().mockResolvedValue(false),
    onChanged: () => () => {}, onDraft: () => () => {}, stop, restart
  }
  vi.stubGlobal('window', Object.assign(globalThis.window, { fabric: { ceoAgent, terminal: { get: vi.fn(), onExit: () => () => {} } } }))
  render(<I18nProvider locale="ru"><CeoPopup /></I18nProvider>)
  return { stop, restart }
}

describe('the CEO popup', () => {
  it('«Остановить» stops the CEO, says it is stopped, and «Запустить» starts it again', async () => {
    const f = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Остановить' }))
    await screen.findByText(/CEO остановлен/)
    expect(f.stop).toHaveBeenCalledOnce()
    const starts = screen.getAllByRole('button', { name: 'Запустить' })
    fireEvent.click(starts[0]!)
    await waitFor(() => expect(f.restart).toHaveBeenCalledOnce())
  })

  it('a stop that leaves the console running says so', async () => {
    setup(vi.fn().mockResolvedValue({ ok: false, reason: 'still-running', status: status('running') }))
    fireEvent.click(await screen.findByRole('button', { name: 'Остановить' }))
    await screen.findByText(/Консоль CEO не остановилась/)
  })

  it('a call the home card asked for starts in the popup', async () => {
    const voice = vi.fn().mockResolvedValue({ ok: false, reason: 'no-key' })
    vi.stubGlobal('window', Object.assign(globalThis.window, { fabric: { ceoAgent: {
      ensure: vi.fn().mockResolvedValue(status('running')), takeDraft: vi.fn().mockResolvedValue(null), takeCall: vi.fn().mockResolvedValue(true),
      onChanged: () => () => {}, onDraft: () => () => {}, voice, voiceTool: vi.fn()
    }, terminal: { get: vi.fn(), onExit: () => () => {} } } }))
    render(<I18nProvider locale="ru"><CeoPopup /></I18nProvider>)
    await waitFor(() => expect(voice).toHaveBeenCalled())
    await screen.findByText(/Нет ключа xAI/)
  })
})

function callState(over: Partial<VoiceCallState> = {}): VoiceCallState {
  return {
    phase: 'listening', why: null, lines: [], spent: { minutes: 1.5, usd: 0.12 }, active: true, history: [],
    start: vi.fn(), hangUp: vi.fn(), say: vi.fn(), levels: () => ({ input: 0, output: 0 }), reset: vi.fn(), muted: false, setMuted: vi.fn(), ...over
  }
}

describe('the call panel in the chat', () => {
  it('nothing before the first call', () => {
    const { container } = render(<I18nProvider locale="ru"><CallPanel call={callState({ phase: 'idle', active: false })} /></I18nProvider>)
    expect(container.textContent).toBe('')
  })

  it('a live call: state, time out of five minutes, price, who said what, words typed, hang-up', () => {
    const call = callState({ lines: [{ who: 'person', text: 'покажи сессии' }, { who: 'tool', text: 'fabric_ceo_sessions' }, { who: 'ceo', text: 'Идут три сессии.' }] })
    render(<I18nProvider locale="ru"><CallPanel call={call} /></I18nProvider>)
    expect(screen.getByText('Слушаю')).toBeTruthy()
    expect(screen.getByText('1:30 из 5:00')).toBeTruthy()
    expect(screen.getByText('$0.12')).toBeTruthy()
    expect(screen.getByText('Идут три сессии.')).toBeTruthy()
    expect(screen.getByText('инструмент: fabric_ceo_sessions')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Сказать текстом' }), { target: { value: 'и что дальше' } })
    fireEvent.submit(screen.getByRole('textbox', { name: 'Сказать текстом' }))
    expect(call.say).toHaveBeenCalledWith('и что дальше')
    fireEvent.click(screen.getByRole('button', { name: 'Положить трубку' }))
    expect(call.hangUp).toHaveBeenCalled()
  })

  it('the CEO\'s voice can be turned off, and the switch says what that voice is', () => {
    const call = callState()
    render(<I18nProvider locale="ru"><CallPanel call={call} /></I18nProvider>)
    expect(screen.getByText(/Голос, который читает ответы и экран сессий в звонке, это CEO/)).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /CEO отвечает вслух/ }))
    expect(call.setMuted).toHaveBeenCalledWith(true)
  })

  it('a past call stays in the chat with its lines', () => {
    const call = callState({ phase: 'ended', active: false, history: [{ id: '1', at: Date.UTC(2026, 10, 19, 18, 40), ms: 151_000, usd: 0.2, end: null, lines: [{ who: 'ceo', text: 'Готово.' }] }] })
    render(<I18nProvider locale="ru"><CallPanel call={call} /></I18nProvider>)
    expect(screen.getByText(/2:31 · \$0.20/)).toBeTruthy()
    expect(screen.getByText('Готово.')).toBeTruthy()
  })
})
