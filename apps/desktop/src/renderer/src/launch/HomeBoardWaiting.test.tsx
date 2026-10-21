// 0.3.9 BD-2 (docs/evidence/plans/2026-10-21-core-reliability/board.md): requests between projects that nobody can answer,
// and board messages nobody marked read, reach the operator on the home, outside Comms. A failed read is said; nothing
// waiting shows nothing.
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
  it('says how many requests wait with nobody to answer, since when, and the unread count; opens Comms', async () => {
    stubWaiting(async () => ({ ok: true, requests: 6, oldestRequestAt: days(3), unread: 3084, oldestUnreadAt: days(5) }))
    const onComms = show('en')
    await waitFor(() => expect(screen.getByText(/6 requests between projects wait/)).toBeTruthy())
    expect(screen.getByText(/waited 3d/)).toBeTruthy()
    expect(screen.getByText(/3,?084/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Comms/ }))
    expect(onComms).toHaveBeenCalled()
    expect(document.body.textContent).not.toMatch(/\u2014/)
  })

  it('in Russian too, without an em dash', async () => {
    stubWaiting(async () => ({ ok: true, requests: 2, oldestRequestAt: days(1), unread: 0 }))
    show('ru')
    await waitFor(() => expect(screen.getByText(/Запросов между проектами ждут ответа: 2/)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/\u2014/)
  })

  it('nothing waiting shows nothing', async () => {
    const waiting = vi.fn(async () => ({ ok: true, requests: 0, unread: 0 }))
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
