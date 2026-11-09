// CO-522 wave C: the person's words to a running session, and whether it read them.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { SayToAgent } from './SayToAgent'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('SayToAgent', () => {
  it('sends the words for this session, clears the field, and lists them as not read, then read', async () => {
    let list = [] as Array<{ id: string; text: string; at: number; readAt: number | null }>
    const say = vi.fn(async ({ text }: { text: string }) => { list = [...list, { id: 'm1', text, at: Date.now(), readAt: null }]; return { ok: true, id: 'm1' } })
    const messages = vi.fn(async () => list)
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { say, messages } } }))
    const { rerender, container } = render(<I18nProvider locale="en"><SayToAgent sessionId="s-1" mark={0} /></I18nProvider>)
    const field = container.querySelector('textarea')!
    fireEvent.change(field, { target: { value: 'Stop changing the hub' } })
    fireEvent.click(screen.getByRole('button', { name: en['say.send'] }))
    await waitFor(() => expect(say).toHaveBeenCalledWith({ sessionId: 's-1', text: 'Stop changing the hub' }))
    expect(await screen.findByText(/not read yet/)).toBeTruthy()
    expect((field as HTMLTextAreaElement).value).toBe('')
    list = list.map((m) => ({ ...m, readAt: Date.now() }))
    rerender(<I18nProvider locale="en"><SayToAgent sessionId="s-1" mark={1} /></I18nProvider>)
    expect(await screen.findByText(/read /)).toBeTruthy()
  })
  it('a refusal is said and the words stay in the field', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { say: vi.fn(async () => ({ ok: false, reason: 'Fabric is still starting' })), messages: vi.fn(async () => []) } } }))
    const { container } = render(<I18nProvider locale="en"><SayToAgent sessionId="s-1" /></I18nProvider>)
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: en['say.send'] }))
    expect(await screen.findByText(/Not sent: Fabric is still starting/)).toBeTruthy()
    expect((container.querySelector('textarea') as HTMLTextAreaElement).value).toBe('x')
  })
  it('CO-544: a list that cannot be read is said, and sending still works', async () => {
    const messages = vi.fn(async () => { throw new Error('ipc closed') })
    const say = vi.fn(async () => ({ ok: true, id: 'm1' }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { say, messages } } }))
    const { container } = render(<I18nProvider locale="en"><SayToAgent sessionId="s-1" /></I18nProvider>)
    expect(await screen.findByText(en['say.unreadable'])).toBeTruthy()
    fireEvent.change(container.querySelector('textarea')!, { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: en['say.send'] }))
    await waitFor(() => expect(say).toHaveBeenCalled())
  })
  it('CO-544: a late answer for the previous session does not replace this session\'s lines', async () => {
    let releaseOld: (v: unknown) => void = () => {}
    const messages = vi.fn((id: string) => id === 's-old'
      ? new Promise((r) => { releaseOld = r })
      : Promise.resolve([{ id: 'n1', text: 'for the new one', at: Date.now(), readAt: null }]))
    vi.stubGlobal('window', Object.assign(window, { fabric: { work: { say: vi.fn(), messages } } }))
    const { rerender } = render(<I18nProvider locale="en"><SayToAgent sessionId="s-old" /></I18nProvider>)
    rerender(<I18nProvider locale="en"><SayToAgent sessionId="s-new" /></I18nProvider>)
    expect(await screen.findByText('for the new one')).toBeTruthy()
    releaseOld([{ id: 'o1', text: 'for the old one', at: Date.now(), readAt: null }])
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByText('for the old one')).toBeNull()
    expect(screen.getByText('for the new one')).toBeTruthy()
  })
})
