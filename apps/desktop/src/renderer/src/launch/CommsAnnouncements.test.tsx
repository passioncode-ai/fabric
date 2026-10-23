// Comms' «Объявления» (CO-377): each announcement with who has answered and who has not.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { CommsAnnouncements } from './CommsAnnouncements'

const msg = (id: string, project: string, kind: string, text: string, at: string) =>
  ({ id, thread: 't1', kind, sender: { project, principal: null }, at, digest: 'd', body: { text } })
const thread = { id: 't1', subject: 'Announce', participants: ['ws', 'fabric', 'contract'], createdBy: 'ws', createdSeq: 1, messageCount: 2, lastSeq: 9, lastAt: null, kinds: ['announcement', 'reply'], openRequests: 0, providers: [] }
const names: Record<string, string> = { ws: 'fabric-workspace', fabric: 'Fabric', contract: 'contract' }
const install = (ok = true) => {
  const threadPage = vi.fn(async () => (ok ? { ok: true, threads: [thread], more: false, before: null } : { ok: false, error: { code: 'unavailable', message: 'down' } }))
  const list = vi.fn(async () => ({ ok: true, lastSeq: 9, more: false, messages: [msg('a1', 'ws', 'announcement', 'Announce and answer.', '2026-10-19T15:43:00Z'), msg('r1', 'contract', 'reply', 'adapted: DEC-0098', '2026-10-19T16:00:00Z')] }))
  vi.stubGlobal('window', Object.assign(window, { fabric: { comms: { threadPage, list } } }))
  return { threadPage, list }
}
const show = (onOpen = vi.fn()) => render(<I18nProvider locale="en"><CommsAnnouncements mark={0} nameOf={(id) => names[id] ?? id} onOpen={onOpen} /></I18nProvider>)

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('announcements and who has answered (CO-377)', () => {
  it('shows each announcement with who has not answered and how the others answered', async () => {
    const { threadPage } = install()
    const onOpen = vi.fn()
    show(onOpen)
    await waitFor(() => expect(screen.getByText('Announce and answer.')).toBeTruthy())
    expect(threadPage).toHaveBeenCalledWith({ kind: 'announcement' }, null, 50)
    expect(screen.getByText(/1 of 2 answered/)).toBeTruthy()
    expect(screen.getByText(`Fabric: ${en['launch.comms.ann.waiting']}`)).toBeTruthy()
    expect(screen.getByText(`contract: ${en['launch.comms.ann.adapted']}`)).toBeTruthy()
    fireEvent.click(screen.getByText('Announce and answer.'))
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
  })
  it('says the board did not answer, with Try again, never «nobody owes an answer»', async () => {
    install(false)
    show()
    await waitFor(() => expect(screen.getByText(en['launch.comms.unavailable'])).toBeTruthy())
    expect(screen.getByRole('button', { name: en['launch.comms.tryAgain'] })).toBeTruthy()
    expect(screen.queryByText(en['launch.comms.ann.allAnswered'])).toBeNull()
  })
})
