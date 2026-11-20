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

  // The owner, 2026-11-20: «Пишется, что сообщение не дошло до CEO»; a message to a busy CEO waits, and is said so.
  it('a message the busy CEO did not take yet is said as queued, never as lost, and the box is cleared', async () => {
    setup('popup', vi.fn().mockResolvedValue({ ok: true, queued: true, reason: 'not-delivered', status: { queued: 1 } }))
    const box = screen.getByRole('textbox', { name: 'Напишите CEO' }) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'сделай отчёт' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    expect((await screen.findByRole('status')).textContent).toMatch(/в очереди/)
    expect(screen.queryByText(/не дошло/)).toBeNull()
    expect(box.value).toBe('')
  })

  it('a CEO that is not running is said as not running, never as busy (run four, UX-41)', async () => {
    setup('popup', vi.fn().mockResolvedValue({ ok: true, queued: true, reason: 'not-running', status: { queued: 1 } }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Напишите CEO' }), { target: { value: 'сделай отчёт' } })
    fireEvent.click(screen.getByRole('button', { name: 'Отправить' }))
    const line = (await screen.findByRole('status')).textContent ?? ''
    expect(line).toMatch(/не запущен/)
    expect(line).not.toMatch(/занят/)
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

  it('the home card (the operator, 2026-11-19): the call sits in its head, no form inside another, and ⌘V attaches a file', async () => {
    const { container } = render(<I18nProvider locale="ru"><CeoComposer where="home" /></I18nProvider>)
    expect(screen.getByRole('button', { name: 'Позвонить' })).toBeTruthy()
    expect(container.querySelectorAll('form form').length).toBe(0)
    const box = screen.getByRole('textbox', { name: 'Напишите CEO' }) as HTMLTextAreaElement
    expect(box.placeholder).toContain('⌘V')
    fireEvent.paste(box, { clipboardData: { files: [new File([new Uint8Array([7])], 'note.txt')], types: ['Files'] } })
    await screen.findByText('note.txt')
  })
})
