// Comms as a feed (the operator's walk OF-29, 2026-10-22): the newest posts of every thread first, each saying which
// project wrote it, of what kind, and what it says, with a focus filter.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
})
