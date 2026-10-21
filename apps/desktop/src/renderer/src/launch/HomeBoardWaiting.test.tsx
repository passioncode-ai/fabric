// 0.3.9 BD-2 (docs/evidence/plans/2026-10-21-core-reliability/2026-10-21-board.md): requests between projects that nobody can
// answer reach the operator on the home, outside Comms. A failed read is said; nothing waiting shows nothing.
// Review i1 UX-1 / DA-8: the home shows only what the operator can act on. Unread deliveries (one per recipient
// project, 3,103 on the operator's data) are not shown here, even when the read carries them: Comms keeps its own counts.
// UX-7: the hint says what answers a request, never to grant something nobody asked for. UX-10: no "1 requests", no "?".
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { HomeBoardWaiting } from './HomeBoardWaiting'

const days = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString()
const stubWaiting = (answer: () => Promise<unknown>) => vi.stubGlobal('fabric', { comms: { waiting: vi.fn(answer) } })
const show = (locale: 'en' | 'ru', onComms = vi.fn()) => {
  render(<I18nProvider locale={locale}><HomeBoardWaiting mark={1} onComms={onComms} /></I18nProvider>)
  return onComms
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('home: what waits on the board', () => {
  it('says how many requests wait with nobody to answer, since when; opens Comms', async () => {
    stubWaiting(async () => ({ ok: true, requests: 6, oldestRequestAt: days(3) }))
    const onComms = show('en')
    await waitFor(() => expect(screen.getByText(/Requests between projects that no agent can answer now: 6\./)).toBeTruthy())
    expect(screen.getByText(/waited 3d/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Comms/ }))
    expect(onComms).toHaveBeenCalled()
    expect(document.body.textContent).not.toMatch(/\u2014/)
  })

  it('shows no unread-deliveries figure, even when the read carries one (UX-1, DA-8)', async () => {
    stubWaiting(async () => ({ ok: true, requests: 2, oldestRequestAt: days(1), unread: 3103, oldestUnreadAt: days(5) }))
    show('en')
    await waitFor(() => expect(screen.getByText(/: 2\./)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/3,?103/)
    expect(document.body.textContent).not.toMatch(/board messages|marked read/)
  })

  it('unread deliveries alone show nothing: there is nothing on the home to act on', async () => {
    const waiting = vi.fn(async () => ({ ok: true, requests: 0, unread: 3103, oldestUnreadAt: days(5) }))
    vi.stubGlobal('fabric', { comms: { waiting } })
    const { container } = render(<I18nProvider locale="en"><HomeBoardWaiting mark={1} /></I18nProvider>)
    await waitFor(() => expect(waiting).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toBe('')
  })

  it('the hint says a reply from the asked project answers; it sends the operator to no grant (UX-7)', async () => {
    stubWaiting(async () => ({ ok: true, requests: 1, oldestRequestAt: days(1) }))
    show('en')
    await waitFor(() => expect(screen.getByText(/A reply from the asked project answers/)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/Agent access|allow it/)
    cleanup()
    show('ru')
    await waitFor(() => expect(screen.getByText(/Ответ проекта, которого спросили/)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/Доступ агентов|разрешите/)
  })

  it('one request reads as one, and an unknown age is left out rather than shown as "?" (UX-10)', async () => {
    stubWaiting(async () => ({ ok: true, requests: 1 }))
    show('en')
    await waitFor(() => expect(screen.getByText(/no agent can answer now: 1\./)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/1 requests|\?|waited/)
    cleanup()
    stubWaiting(async () => ({ ok: true, requests: 1, oldestRequestAt: 'not a time' }))
    show('ru')
    await waitFor(() => expect(screen.getByText(/не может принять ни один агент: 1\./)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/\?|\u2014|ждёт/)
  })

  it('in Russian too, without an em dash', async () => {
    stubWaiting(async () => ({ ok: true, requests: 2, oldestRequestAt: days(1) }))
    show('ru')
    await waitFor(() => expect(screen.getByText(/Запросов между проектами, которые сейчас не может принять ни один агент: 2\./)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/\u2014/)
  })

  it('nothing waiting shows nothing', async () => {
    const waiting = vi.fn(async () => ({ ok: true, requests: 0 }))
    vi.stubGlobal('fabric', { comms: { waiting } })
    const { container } = render(<I18nProvider locale="en"><HomeBoardWaiting mark={1} /></I18nProvider>)
    await waitFor(() => expect(waiting).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('a read that fails is said, never shown as nothing waiting', async () => {
    stubWaiting(async () => ({ ok: false, error: { code: 'unavailable', message: 'the board answered with something that is not what waits on the board' } }))
    show('en')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not be read/))
    stubWaiting(async () => { throw new Error('no handler') })
    cleanup()
    show('en')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/no handler/))
  })
})
