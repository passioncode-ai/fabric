// SCR-81 / SCN-143 — the Comms screen against a stubbed bridge.
//
// The acceptance the scenario sets, held against the render: threads listed by subject
// with participant projects BY NAME; an empty estate is said in words (an empty list is
// a true answer); a board that does not answer is said as UNAVAILABLE with Try again and
// is never rendered as the empty list — those two states looking alike is the defect the
// whole read path exists to prevent.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CommsScreen } from './CommsScreen'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import type { CommsThreadsReply } from '../../../shared/commsRead'
import type { ProjectRow } from '../../../shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const PROJECTS = [
  { id: 'p1', name: 'Atlas', status: 'active' },
  { id: 'p2', name: 'Beacon', status: 'active' }
] as unknown as ProjectRow[]

const THREAD = {
  id: '79000000-0000-4000-8000-0000000000d1',
  subject: 'Cutover plan',
  participants: ['p1', 'p2'],
  createdBy: 'p1',
  createdSeq: 3,
  messageCount: 12,
  lastSeq: 40,
  lastAt: '2026-10-11T08:00:00.000Z'
}

function stub(reply: CommsThreadsReply | (() => Promise<CommsThreadsReply>)) {
  const threads = vi.fn(typeof reply === 'function' ? reply : async () => reply)
  const list = vi.fn(async () => ({ ok: true as const, messages: [], lastSeq: 0, more: false }))
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { comms: { threads, list } } }))
  return { threads, list }
}

const show = () =>
  render(
    <I18nProvider locale="en">
      <CommsScreen projects={PROJECTS} />
    </I18nProvider>
  )

describe('the thread list', () => {
  it('lists threads by subject with the participant projects by name, the count and the last write', async () => {
    stub({ ok: true, threads: [THREAD] })
    show()
    await screen.findByText('Cutover plan')
    expect(screen.getByText('Atlas, Beacon')).toBeTruthy()
    expect(screen.getByText(en['launch.comms.messageCount'].replace('{count}', '12'))).toBeTruthy()
  })

  it('a count of one is never "1 messages" (UX-13)', async () => {
    stub({ ok: true, threads: [{ ...THREAD, messageCount: 1 }] })
    show()
    await screen.findByText('Cutover plan')
    expect(screen.queryByText(/\b1 messages\b/)).toBeNull()
    expect(screen.getByText(en['launch.comms.messageCount'].replace('{count}', '1'))).toBeTruthy()
  })

  it('says an empty estate in words — an empty list is a true answer', async () => {
    stub({ ok: true, threads: [] })
    show()
    await screen.findByText(en['launch.comms.empty'])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a board that does not answer is unavailable with Try again, NEVER the empty list', async () => {
    stub({ ok: false, error: { code: 'unavailable', message: 'timeout' } })
    show()
    await screen.findByRole('alert')
    // UX-10: a sentence in the operator's language; the machine's words are a secondary line, never the sentence.
    expect(screen.getByText(en['launch.comms.unavailable'])).toBeTruthy()
    expect(en['launch.comms.unavailable']).not.toContain('{reason}')
    expect(screen.getByText('timeout').className).toContain('error-detail')
    expect(screen.getByRole('button', { name: en['launch.comms.tryAgain'] })).toBeTruthy()
    expect(screen.queryByText(en['launch.comms.empty'])).toBeNull()
  })

  it('a rejected invoke is unavailable too, not the empty list', async () => {
    stub(async () => {
      throw new Error('the main process went away')
    })
    show()
    await screen.findByRole('alert')
    await waitFor(() => expect(screen.queryByText(en['launch.comms.empty'])).toBeNull())
  })
})

// ── the thread view ─────────────────────────────────────────────────────────────────────────────────────────────

type Msg = { id: string; seq: number; thread: string; kind: string; sender: { project: string; principal: null }; at: string; digest: string; body?: { text: string }; replyTo?: string }

/** A board holding `msgs`, answering `board_list_operator`'s contract: seq > after, oldest first, at most limit. */
function boardOf(threads: unknown[], msgs: Msg[]) {
  const threadsFn = vi.fn(async () => ({ ok: true as const, threads }))
  const list = vi.fn(async (thread: string, after: number, limit = 50) => {
    const rows = msgs.filter((m) => m.thread === thread && m.seq > after).sort((a, b) => a.seq - b.seq)
    const kept = rows.slice(0, limit)
    return { ok: true as const, messages: kept.map(({ seq: _seq, ...m }) => m), lastSeq: kept.at(-1)?.seq ?? after, more: rows.length > limit }
  })
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { comms: { threads: threadsFn, list } } }))
  return { list }
}
const msg = (seq: number, over: Partial<Msg> = {}): Msg => ({
  id: `m-${String(seq).padStart(4, '0')}-0000-4000-8000-000000000000`, seq, thread: THREAD.id, kind: 'message',
  sender: { project: seq % 2 ? 'p1' : 'p2', principal: null }, at: '2026-10-11T08:00:00.000Z', digest: `d${seq}`, body: { text: `message number ${seq}` }, ...over
})

describe('the thread view', () => {
  it('Earlier walks back without a gap and says "the beginning" only at the thread\'s first message (UX-1)', async () => {
    // 120 messages at seqs 1–120: the first page is 71–120, then Earlier must bring 21–70 and 1–20 — not 1–50.
    const all = Array.from({ length: 120 }, (_, i) => msg(i + 1))
    boardOf([{ ...THREAD, createdSeq: 1, lastSeq: 120, messageCount: 120 }], all)
    show()
    fireEvent.click(await screen.findByText('Cutover plan'))
    await screen.findByText('message number 120')
    expect(screen.queryByText('message number 70')).toBeNull()
    expect(screen.queryByText(en['launch.comms.historyStart']), 'not the beginning while seqs 1–70 are unread').toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.earlier'] }))
    await screen.findByText('message number 70')
    expect(screen.getByText('message number 21')).toBeTruthy()
    expect(screen.queryByText(en['launch.comms.historyStart']), 'seqs 1–20 are still unread').toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.earlier'] }))
    await screen.findByText('message number 1')
    await screen.findByText(en['launch.comms.historyStart'])
    const shown = screen.getAllByText(/^message number \d+$/).map((el) => Number(el.textContent!.split(' ').pop()))
    expect(shown, 'every message, once, oldest first').toEqual(all.map((m) => m.seq))
  })

  it('a thread created after the first page starts says "the beginning" at once, with no Earlier', async () => {
    boardOf([{ ...THREAD, createdSeq: 90, lastSeq: 120, messageCount: 3 }], [msg(90), msg(100), msg(120)])
    show()
    fireEvent.click(await screen.findByText('Cutover plan'))
    await screen.findByText('message number 120')
    expect(screen.getByText(en['launch.comms.historyStart'])).toBeTruthy()
    expect(screen.queryByRole('button', { name: en['launch.comms.earlier'] })).toBeNull()
  })

  it('an untitled thread is headed by its first words, and a reply names what it answers in words (UX-11)', async () => {
    const first = msg(5, { body: { text: 'Can Beacon take the cutover window on Friday?' } })
    const reply = msg(6, { replyTo: first.id, body: { text: 'Yes.' } })
    const late = msg(7, { replyTo: 'f0000000-0000-4000-8000-0000000000aa', body: { text: 'About the earlier one.' } })
    boardOf([{ ...THREAD, subject: null, createdSeq: 5, lastSeq: 7, messageCount: 3 }], [first, reply, late])
    show()
    fireEvent.click(await screen.findByText('Can Beacon take the cutover window on Friday?', { selector: '.lp-topic-title' }))
    await screen.findByText('Yes.')
    expect(screen.getByRole('heading', { level: 3, name: 'Can Beacon take the cutover window on Friday?' })).toBeTruthy()
    expect(screen.queryByText(/Thread [0-9a-f]{8}…/)).toBeNull()
    expect(screen.getByText(en['launch.comms.replyTo'].replace('{sender}', 'Atlas').replace('{words}', 'Can Beacon take the cutover window on Friday?'))).toBeTruthy()
    expect(screen.getByText(en['launch.comms.replyToEarlier'])).toBeTruthy()
    expect(screen.queryByText(/answers m-0005|answers f0000000/)).toBeNull()
  })
})

describe('the Russian words', () => {
  it('say «пространство», never the English "estate" (UX-12)', () => {
    for (const key of Object.keys(ru).filter((k) => k.startsWith('launch.comms.'))) expect(ru[key as keyof typeof ru], key).not.toMatch(/estate/i)
  })
})
