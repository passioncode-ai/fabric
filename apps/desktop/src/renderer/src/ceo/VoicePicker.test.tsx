// SCN-186: male by default; the character decides which voice; «Послушать» asks main for that voice's sample and plays
// it through Web Audio; no key, no sample button; a failed sample is said and the choice still works.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { VoicePicker } from './VoicePicker'
import { I18nProvider } from '../i18n'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function setup(props: Partial<Parameters<typeof VoicePicker>[0]> = {}, sample = vi.fn().mockResolvedValue({ ok: true, data: btoa('mp3') })) {
  const started: string[] = []
  class FakeContext {
    destination = {}
    decodeAudioData = vi.fn(async () => ({ duration: 1 }))
    createBufferSource = () => ({ buffer: null, connect: vi.fn(), start: () => started.push('start'), stop: vi.fn(), onended: null })
    close = vi.fn(async () => {})
  }
  vi.stubGlobal('AudioContext', FakeContext)
  vi.stubGlobal('window', Object.assign(globalThis.window, { fabric: { ceoAgent: { voiceSample: sample } } }))
  const onChange = vi.fn()
  render(<I18nProvider locale="ru"><VoicePicker style="orbit" value={undefined} onChange={onChange} canSample {...props} /></I18nProvider>)
  return { sample, onChange, started }
}

describe('the CEO voice picker', () => {
  it('reads no choice as male and offers both, each with the character\'s own tone', () => {
    setup()
    expect((screen.getByRole('radio', { name: /Мужской/ }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('radio', { name: /Женский/ }) as HTMLInputElement).checked).toBe(false)
    expect(screen.getByText('уверенный и чёткий')).toBeTruthy()
    expect(screen.getByText('энергичный и бодрый')).toBeTruthy()
  })

  it('a choice is handed up', () => {
    const f = setup()
    fireEvent.click(screen.getByRole('radio', { name: /Женский/ }))
    expect(f.onChange).toHaveBeenCalledWith('female')
  })

  it('«Послушать» asks for the voice the character speaks with, and plays it', async () => {
    const f = setup({ style: 'spark' })
    fireEvent.click(screen.getByRole('button', { name: 'Послушать: Женский' }))
    await waitFor(() => expect(f.started).toEqual(['start']))
    expect(f.sample).toHaveBeenCalledWith('ara')
    expect(screen.getByRole('button', { name: 'Стоп: Женский' }).textContent).toContain('Стоп')
  })

  it('without a key there is no sample to ask for', () => {
    setup({ canSample: false })
    expect(screen.queryByRole('button', { name: /Послушать/ })).toBeNull()
    expect(screen.getByText(/Послушать можно, когда подключён ключ xAI/)).toBeTruthy()
  })

  it('a refused sample is said, and the choice still works', async () => {
    const f = setup({}, vi.fn().mockResolvedValue({ ok: false, reason: 'refused' }))
    fireEvent.click(screen.getByRole('button', { name: 'Послушать: Мужской' }))
    await screen.findByText(/xAI не принял ключ/)
    fireEvent.click(screen.getByRole('radio', { name: /Женский/ }))
    expect(f.onChange).toHaveBeenCalledWith('female')
  })
})
