// 0.3.9 BD-2 (docs/evidence/plans/2026-10-21-core-reliability/2026-10-21-board.md): requests between projects that nobody can
// answer reach the operator on the home, outside Comms. A failed read is said; nothing waiting shows nothing.
// Review i1 UX-1 / DA-8: the home shows only what the operator can act on. Unread deliveries (one per recipient
// project, 3,103 on the operator's data) are not shown here, even when the read carries them: Comms keeps its own counts.
// UX-7: the hint says what answers a request, never to grant something nobody asked for. UX-10: no "1 requests", no "?".
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
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
    await waitFor(() => expect(screen.getByText(/Requests between projects that no agent is answering now: 6\./)).toBeTruthy())
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

  it('the hint, now the kicker\'s hover (the mockup parity), says a reply from the asked project answers; it sends the operator to no grant (UX-7)', async () => {
    stubWaiting(async () => ({ ok: true, requests: 1, oldestRequestAt: days(1) }))
    show('en')
    await waitFor(() => expect(screen.getByTitle(/A reply from the asked project answers/)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/A reply from the asked project|Agent access|allow it/)
    cleanup()
    show('ru')
    await waitFor(() => expect(screen.getByTitle(/Ответ проекта, которого спросили/)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/Доступ агентов|разрешите/)
  })

  // The mockup parity (home gap D11): the requests themselves, one line each, in place of the long paragraph.
  it('lists each request «from → to: subject» with who has not taken it and for how long, at most five, then «N more»', async () => {
    const req = (i: number, subject: string | null = `Narrow the session list ${i}`) => ({ requestId: `r${i}`, threadId: `th${i}`, from: 'fab', to: 'dash', capability: 'ui.fix', subject, at: days(i) })
    stubWaiting(async () => ({ ok: true, requests: 7, oldestRequestAt: days(6), list: [req(1), req(2, null), req(3), req(4), req(5), req(6)], listComplete: true }))
    const onComms = vi.fn()
    render(<I18nProvider locale="ru"><HomeBoardWaiting mark={1} onComms={onComms} nameOf={(id) => ({ fab: 'Fabric', dash: 'Dashboards' })[id] ?? id} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Fabric → Dashboards: «Narrow the session list 1»')).toBeTruthy())
    expect(screen.getByText('Fabric → Dashboards')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getAllByText(/^Dashboards не взял · 1 дн\.|^Dashboards не взял/).length).toBe(5)
    expect(screen.getByText('ещё 2')).toBeTruthy()
    // The whole list is here: the count sentence is not repeated.
    expect(document.body.textContent).not.toMatch(/Запросов между проектами/)
    fireEvent.click(screen.getByRole('button', { name: /Narrow the session list 1/ }))
    expect(onComms).toHaveBeenCalled()
    expect(document.body.textContent).not.toMatch(/\u2014/)
  })

  it('keeps the count sentence when the list is not the whole of what waits', async () => {
    stubWaiting(async () => ({ ok: true, requests: 30, oldestRequestAt: days(2), list: [{ requestId: 'r1', threadId: 't1', from: null, to: 'dash', capability: 'x', subject: 'One', at: days(2) }], listComplete: false }))
    show('en')
    await waitFor(() => expect(screen.getByText('No project → dash: “One”')).toBeTruthy())
    expect(screen.getByText(/no agent is answering now: 30\./)).toBeTruthy()
    expect(screen.queryByText(/more$/)).toBeNull()
  })

  it('UX-16 (0.3.15 review, iteration 2): a request whose time does not parse says who has not taken it, without a dash', async () => {
    stubWaiting(async () => ({ ok: true, requests: 1, oldestRequestAt: null, list: [{ requestId: 'r1', threadId: 't1', from: null, to: 'dash', capability: 'x', subject: 'One', at: 'not a time' }], listComplete: true }))
    show('en')
    await waitFor(() => expect(screen.getByText('No project → dash: “One”')).toBeTruthy())
    const who = document.querySelector('.lh-req-who')?.textContent ?? ''
    expect(who).toBe(en['launch.home.boardWaiting.untaken'].replace('{to}', 'dash').replace(' · {age}', ''))
    expect(document.body.textContent).not.toMatch(/\u2014|NaN/)
  })

  it('one request reads as one, and an unknown age is left out rather than shown as "?" (UX-10)', async () => {
    stubWaiting(async () => ({ ok: true, requests: 1 }))
    show('en')
    await waitFor(() => expect(screen.getByText(/no agent is answering now: 1\./)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/1 requests|\?|waited/)
    cleanup()
    stubWaiting(async () => ({ ok: true, requests: 1, oldestRequestAt: 'not a time' }))
    show('ru')
    await waitFor(() => expect(screen.getByText(/не отвечает ни один агент: 1\./)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/\?|\u2014|ждёт/)
  })

  // 0.3.9 review iteration 2, UX-5: the Russian said «принять» where everything else says answer, and "can" promised
  // more than the count measures (a request whose slot no session holds now): both languages say "answering now".
  it('in Russian too, without an em dash, in the words Comms uses (UX-5, i2)', async () => {
    stubWaiting(async () => ({ ok: true, requests: 2, oldestRequestAt: days(1) }))
    show('ru')
    await waitFor(() => expect(screen.getByText(/Запросов между проектами, на которые сейчас не отвечает ни один агент: 2\./)).toBeTruthy())
    expect(document.body.textContent).not.toMatch(/\u2014|принять/)
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

  it('UX-5: a project no list knows is said so, never printed as its id', async () => {
    stubWaiting(async () => ({ ok: true, requests: 1, oldestRequestAt: days(1), list: [{ requestId: 'r1', threadId: 't1', from: 'p-known', to: '6b1f0c2e-unknown', capability: 'x', subject: 'One', at: days(1) }], listComplete: true }))
    render(<I18nProvider locale="en"><HomeBoardWaiting mark={1} nameOf={(id) => (id === 'p-known' ? 'Known' : null)} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText(`Known → ${en['launch.home.boardWaiting.unknownProject']}: “One”`)).toBeTruthy())
    expect(document.body.textContent).not.toContain('6b1f0c2e')
  })
})
