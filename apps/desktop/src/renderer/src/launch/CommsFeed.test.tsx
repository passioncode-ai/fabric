// Comms as a feed (the operator's walk OF-29, 2026-10-22): the newest posts of every thread first, each saying which
// project wrote it, of what kind, and what it says, with a focus filter.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { CommsFeed } from './CommsFeed'

const msg = (id: string, project: string, kind: string, text: string, at: string) =>
  ({ id, thread: 'th-' + id, kind, sender: { project, principal: null }, at, digest: 'd', body: { text } })
const messages = [
  msg('1', 'p1', 'announcement', 'Fabric 0.3.10 is published.', '2026-10-22T20:28:00Z'),
  msg('2', 'p2', 'request', 'Please add project.resolve to the hub.', '2026-10-22T21:00:00Z'),
  msg('3', 'p1', 'reply', 'Done in 0.3.11.', '2026-10-22T22:00:00Z')
]
const install = (heads = { ok: true, heads: [{ id: 'th-1', lastSeq: 40 }, { id: 'th-2', lastSeq: 42 }], truncated: false }, list = vi.fn(async () => ({ ok: true, messages, lastSeq: 42, more: false }))) => {
  vi.stubGlobal('window', Object.assign(window, { fabric: { comms: { heads: vi.fn(async () => heads), list } } }))
  return list
}
const names: Record<string, string> = { p1: 'Fabric', p2: 'Observatory' }
const show = (onOpen = vi.fn()) => render(<I18nProvider locale="en"><CommsFeed mark={0} nameOf={(id) => names[id] ?? id} onOpen={onOpen} /></I18nProvider>)

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Comms as a feed', () => {
  it('reads the newest posts across threads and shows them newest first, with project, kind and text', async () => {
    const list = install()
    const { container } = show()
    await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
    expect(list).toHaveBeenCalledWith(null, 42 - 100 < 0 ? 0 : 42 - 100, 100)
    const posts = [...container.querySelectorAll('.lc-post')].map((p) => p.textContent ?? '')
    expect(posts[0]).toMatch(/Done in 0\.3\.11/)
    expect(posts[0]).toMatch(/Fabric/)
    expect(posts[0]).toMatch(new RegExp(en['launch.comms.kind.reply']))
    expect(posts.at(-1)).toMatch(/published/)
  })
  it('narrows to one project or to requests, and a post opens its thread', async () => {
    install()
    const onOpen = vi.fn()
    show(onOpen)
    await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.feed.requests'] }))
    expect(screen.queryByText('Done in 0.3.11.')).toBeNull()
    expect(screen.getByText('Please add project.resolve to the hub.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.feed.all'] }))
    fireEvent.change(screen.getByLabelText(en['launch.comms.feed.project']), { target: { value: 'p2' } })
    expect(screen.queryByText('Done in 0.3.11.')).toBeNull()
    fireEvent.click(screen.getByText('Please add project.resolve to the hub.'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: '2', thread: 'th-2' }))
  })
  it('says the board did not answer instead of showing an empty feed', async () => {
    install({ ok: false, error: { code: 'unavailable', message: 'down' } } as never)
    show()
    await waitFor(() => expect(screen.getByText(en['launch.comms.unavailable'])).toBeTruthy())
  })
  it('offers «Try again» after a failed read and reads again on it (ER-4)', async () => {
    let up = false
    const heads = vi.fn(async () => (up ? { ok: true, heads: [{ id: 'th-1', lastSeq: 42 }], truncated: false } : { ok: false, error: { code: 'unavailable', message: 'down' } }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { comms: { heads, list: vi.fn(async () => ({ ok: true, messages, lastSeq: 42, more: false })) } } }))
    show()
    await waitFor(() => expect(screen.getByRole('button', { name: en['launch.comms.tryAgain'] })).toBeTruthy())
    up = true
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.tryAgain'] }))
    await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
  })
  it('is what Comms opens on (OF-29)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(`${process.cwd()}/src/renderer/src/launch/CommsScreen.tsx`, 'utf8')
    expect(src).toMatch(/initialMode\s*=\s*'feed'|mode\s*=\s*'feed'/)
  })
  it('keeps the posts it read when a refresh fails, and never starts a read while one runs (ER-1)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let calls = 0
      let hang: (() => void) | null = null
      const heads = vi.fn(async () => {
        calls++
        if (calls === 1) return { ok: true, heads: [{ id: 'th-1', lastSeq: 42 }], truncated: false }
        if (calls === 2) return { ok: false, error: { code: 'unavailable', message: 'down' } }
        await new Promise<void>((r) => { hang = r })
        return { ok: false, error: { code: 'unavailable', message: 'down' } }
      })
      vi.stubGlobal('window', Object.assign(window, { fabric: { comms: { heads, list: vi.fn(async () => ({ ok: true, messages, lastSeq: 42, more: false })) } } }))
      show()
      await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
      await vi.advanceTimersByTimeAsync(15000)
      await waitFor(() => expect(heads).toHaveBeenCalledTimes(2))
      expect(screen.getByText('Done in 0.3.11.')).toBeTruthy()
      await vi.advanceTimersByTimeAsync(15000)
      await waitFor(() => expect(heads).toHaveBeenCalledTimes(3))
      await vi.advanceTimersByTimeAsync(45000)
      expect(heads).toHaveBeenCalledTimes(3)
      ;(hang as unknown as () => void)?.()
    } finally {
      vi.useRealTimers()
    }
  })
  it('a filter with no match says so with «Show everything», which clears it (V2-16)', async () => {
    install()
    show()
    await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
    fireEvent.change(screen.getByLabelText(en['launch.comms.feed.project']), { target: { value: 'p2' } })
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.feed.requests'] }))
    fireEvent.change(screen.getByLabelText(en['launch.comms.feed.project']), { target: { value: 'p1' } })
    expect(screen.getByText(new RegExp(en['launch.comms.feed.noMatch']))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.feed.showAll'] }))
    expect(screen.getByText('Done in 0.3.11.')).toBeTruthy()
  })
  // 0.3.12 review ER-8: «Waiting for an answer» looked at the newest posts only and said «No post matches» while an older
  // request could still wait.
  it('«Waiting for an answer» with nothing waiting says it looked at the newest posts, and where older ones are', async () => {
    install()
    show()
    await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.feed.waiting'] }))
    const said = screen.getByText(/Among the newest \d+ posts no request is waiting/)
    expect(said.textContent).toContain(en['launch.comms.feed.noWaiting'].replace('{count}', String(messages.length)))
    expect(screen.queryByText(new RegExp(en['launch.comms.feed.noMatch']))).toBeNull()
  })
  it('a failed refresh keeps the posts and says when they were read, with Try again (V2-16)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let n = 0
      const heads = vi.fn(async () => (++n === 1 ? { ok: true, heads: [{ id: 'th-1', lastSeq: 42 }], truncated: false } : { ok: false, error: { code: 'unavailable', message: 'down' } }))
      vi.stubGlobal('window', Object.assign(window, { fabric: { comms: { heads, list: vi.fn(async () => ({ ok: true, messages, lastSeq: 42, more: false })) } } }))
      show()
      await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
      await vi.advanceTimersByTimeAsync(15000)
      await waitFor(() => expect(screen.getByText(/these posts were read at/)).toBeTruthy())
      // The date, not only the time: a feed kept overnight says which day it is from (CO-405, V3-35).
      expect(screen.getByText(/these posts were read at/).textContent).toContain(new Date().toLocaleDateString('en', { dateStyle: 'medium' }))
      expect(screen.getByText('Done in 0.3.11.')).toBeTruthy()
      expect(screen.getByRole('button', { name: en['launch.comms.tryAgain'] })).toBeTruthy()
    } finally { vi.useRealTimers() }
  })
  it('reads under StrictMode, as a development build does (iteration 3, ER-1)', async () => {
    install()
    const { StrictMode } = await import('react')
    render(<StrictMode><I18nProvider locale="en"><CommsFeed mark={0} nameOf={(id) => names[id] ?? id} onOpen={vi.fn()} /></I18nProvider></StrictMode>)
    await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
  })
  it('a first read that never settles is said as failed after 60 s, and a hung board gets one read at a time (VF-3, VF-5)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const heads = vi.fn(() => new Promise<never>(() => {}))
      vi.stubGlobal('window', Object.assign(window, { fabric: { comms: { heads, list: vi.fn() } } }))
      show()
      await act(async () => { await vi.advanceTimersByTimeAsync(50000) })
      expect(screen.queryByText(en['launch.comms.unavailable'])).toBeNull()
      await act(async () => { await vi.advanceTimersByTimeAsync(11000) })
      expect(screen.getByText(en['launch.comms.unavailable'])).toBeTruthy()
      for (let k = 0; k < 30; k++) await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
      expect(heads).toHaveBeenCalledTimes(1)
    } finally { vi.useRealTimers() }
  })
  it('«Try again» pressed while a read runs is read right after it (VF-3)', async () => {
    let n = 0
    let release: (() => void) | null = null
    const heads = vi.fn(async () => {
      n++
      if (n === 1) return { ok: false, error: { code: 'x', message: 'x' } }
      if (n === 2) { await new Promise<void>((r) => { release = r }); return { ok: false, error: { code: 'x', message: 'x' } } }
      return { ok: true, heads: [{ id: 'th-1', lastSeq: 42 }], truncated: false }
    })
    vi.stubGlobal('window', Object.assign(window, { fabric: { comms: { heads, list: vi.fn(async () => ({ ok: true, messages, lastSeq: 42, more: false })) } } }))
    show()
    await waitFor(() => screen.getByRole('button', { name: en['launch.comms.tryAgain'] }))
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.tryAgain'] }))
    await waitFor(() => expect(heads).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.tryAgain'] }))
    await act(async () => { (release as unknown as () => void)() })
    await waitFor(() => expect(heads).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
  })
  it('a project filter whose posts left the read is cleared, not suspended (V2-12, V3-8)', async () => {
    let list = messages
    const heads = vi.fn(async () => ({ ok: true, heads: [{ id: 'th-1', lastSeq: 42 }], truncated: false }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { comms: { heads, list: vi.fn(async () => ({ ok: true, messages: list, lastSeq: 42, more: false })) } } }))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      show()
      await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
      fireEvent.change(screen.getByLabelText(en['launch.comms.feed.project']), { target: { value: 'p2' } })
      expect(screen.queryByText('Done in 0.3.11.')).toBeNull()
      list = messages.filter((m) => m.sender.project === 'p1')
      await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
      await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
      list = messages
      await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
      await waitFor(() => expect(screen.getByText('Please add project.resolve to the hub.')).toBeTruthy())
      expect(screen.getByText('Done in 0.3.11.')).toBeTruthy()
      expect((screen.getByLabelText(en['launch.comms.feed.project']) as HTMLSelectElement).value).toBe('')
    } finally { vi.useRealTimers() }
  })
  it('«Show everything» clears the project filter as well as «Requests only» (V2-16)', async () => {
    install()
    show()
    await waitFor(() => expect(screen.getByText('Done in 0.3.11.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.feed.requests'] }))
    fireEvent.change(screen.getByLabelText(en['launch.comms.feed.project']), { target: { value: 'p1' } })
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.feed.showAll'] }))
    expect((screen.getByLabelText(en['launch.comms.feed.project']) as HTMLSelectElement).value).toBe('')
    expect(screen.getByRole('button', { name: en['launch.comms.feed.all'], pressed: true })).toBeTruthy()
  })
  it("a healthy board is never said stale by an earlier read's deadline (VF2-3)", async () => {
    vi.useFakeTimers()
    try {
      const heads = vi.fn(() => new Promise((r) => setTimeout(() => r({ ok: true, heads: [{ id: 'th-1', lastSeq: 42 }], truncated: false }), 1000)))
      vi.stubGlobal('window', Object.assign(window, { fabric: { comms: { heads, list: vi.fn(async () => ({ ok: true, messages, lastSeq: 42, more: false })) } } }))
      show()
      await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
      expect(screen.getByText('Done in 0.3.11.')).toBeTruthy()
      await act(async () => { await vi.advanceTimersByTimeAsync(58500) })
      expect(screen.queryByRole('button', { name: en['launch.comms.tryAgain'] })).toBeNull()
    } finally { vi.useRealTimers() }
  })
})

describe('the feed names each post\'s thread and narrows to what waits for an answer (CO-401, OF-29)', () => {
  it('«Waiting for an answer» keeps only open requests; each post names its thread when the screen holds it', async () => {
    const waiting = { ...msg('4', 'p2', 'request', 'Who owns the resolver?', '2026-10-22T23:00:00Z'), request: { id: 'r4', target: 'p1', capability: 'x', state: 'queued', effect: 'none', revision: 1 } }
    const answered = { ...msg('5', 'p2', 'request', 'Is 0.3.11 out?', '2026-10-22T23:30:00Z'), request: { id: 'r5', target: 'p1', capability: 'x', state: 'answered', effect: 'none', revision: 2 } }
    install(undefined, vi.fn(async () => ({ ok: true, messages: [...messages, waiting, answered], lastSeq: 44, more: false })))
    render(<I18nProvider locale="en"><CommsFeed mark={0} nameOf={(id) => names[id] ?? id} threadOf={(id) => (id === 'th-4' ? 'The resolver' : null)} onOpen={vi.fn()} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Who owns the resolver?')).toBeTruthy())
    expect(screen.getByText(en['launch.comms.feed.inThread'].replace('{thread}', 'The resolver'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.feed.waiting'] }))
    expect(screen.getByText('Who owns the resolver?')).toBeTruthy()
    expect(screen.queryByText('Is 0.3.11 out?')).toBeNull()
    expect(screen.queryByText('Please add project.resolve to the hub.')).toBeNull()
  })
})
