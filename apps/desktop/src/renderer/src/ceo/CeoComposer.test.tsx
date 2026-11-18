// SCN-182 (ADR-0197): the home composer opens the CEO's popup FIRST, then sends; a pasted file is attached and sent by
// name and bytes; a refusal is said under the box and the words stay; Enter sends and Shift+Enter does not.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CeoComposer } from './CeoComposer'
import { I18nProvider } from '../i18n'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function setup(where: 'home' | 'popup', send = vi.fn().mockResolvedValue({ ok: true, status: {} })) {
  const calls: string[] = []
  const open = vi.fn(async () => { calls.push('open') })
  const wrapped = vi.fn(async (...a: unknown[]) => { calls.push('send'); return send(...a) })
  vi.stubGlobal('window', Object.assign(globalThis.window, { fabric: { ceoAgent: { open, send: wrapped } } }))
  render(<I18nProvider locale="ru"><CeoComposer where={where} /></I18nProvider>)
  return { open, send: wrapped, calls }
}

describe('the CEO composer', () => {
  it('on the home screen: opens the popup, then sends the words, then clears the box', async () => {
    const f = setup('home')
    expect(screen.getByRole('heading', { name: 'Спросить CEO' })).toBeTruthy()
    const box = screen.getByRole('textbox', { name: 'Напишите CEO' }) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'какие сессии сейчас идут' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    await screen.findByText('Отправлено CEO.')
    expect(f.calls).toEqual(['open', 'send'])
    expect(f.send).toHaveBeenCalledWith('какие сессии сейчас идут', [])
    expect(box.value).toBe('')
  })

  it('Enter sends, Shift+Enter does not; the popup does not open another popup', async () => {
    const f = setup('popup')
    const box = screen.getByRole('textbox', { name: 'Напишите CEO' })
    fireEvent.change(box, { target: { value: 'строка' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(f.send).not.toHaveBeenCalled()
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(f.send).toHaveBeenCalledWith('строка', []))
    expect(f.open).not.toHaveBeenCalled()
  })

  it('a pasted picture is attached and sent with its bytes; a refusal is said and the words stay', async () => {
    const f = setup('popup', vi.fn().mockResolvedValue({ ok: false, reason: 'the CEO console is not running', status: {} }))
    const box = screen.getByRole('textbox', { name: 'Напишите CEO' }) as HTMLTextAreaElement
    const file = new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' })
    fireEvent.paste(box, { clipboardData: { files: [file], types: ['Files'] } })
    await screen.findByText('shot.png')
    fireEvent.change(box, { target: { value: 'что тут' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    await screen.findByRole('alert')
    expect(f.send).toHaveBeenCalledWith('что тут', [{ name: 'shot.png', data: 'AQID' }])
    expect(screen.getByRole('alert').textContent).toContain('Сообщение не дошло до CEO. the CEO console is not running')
    expect(box.value).toBe('что тут')
  })
})
