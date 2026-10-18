// SCR-81 / SCN-143 — the Comms screen against a stubbed bridge.
//
// The acceptance the scenario sets, held against the render: threads listed by subject
// with participant projects BY NAME; an empty estate is said in words (an empty list is
// a true answer); a board that does not answer is said as UNAVAILABLE with Try again and
// is never rendered as the empty list — those two states looking alike is the defect the
// whole read path exists to prevent.
//
// Wave 4 (SCN-143's wave-4 amendment, SCN-147, SCN-156, SCN-157): the list is a bounded page, newest activity first,
// and its filters are reads the board answers — so the stub below is a small board: it filters and pages the way
// `board_thread_page_operator` does, and every filter a test chooses reaches it as the filter it asks.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CommsScreen } from './CommsScreen'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import type { CommsReadError, CommsThreadFilter, CommsThreadsReply } from '../../../shared/commsRead'
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
  lastAt: '2026-10-11T08:00:00.000Z',
  kinds: ['message', 'request'],
  openRequests: 1,
  providers: ['claude-code']
}

/** A second thread, disjoint on every filter axis: other participant set, another kind, no open request, no agent. */
const THREAD_B = {
  id: '79000000-0000-4000-8000-0000000000d2',
  subject: 'Retention digest',
  participants: ['p2'],
  createdBy: 'p2',
  createdSeq: 5,
  messageCount: 3,
  lastSeq: 41,
  lastAt: '2026-10-11T09:00:00.000Z',
  kinds: ['finding'],
  openRequests: 0,
  providers: [] as string[]
}

type Row = Omit<typeof THREAD, 'providers' | 'subject' | 'lastAt'> & { subject: string | null; lastAt: string | null; providers?: string[] }
const order = (a: { lastSeq: number; id: string }, b: { lastSeq: number; id: string }) => (a.lastSeq !== b.lastSeq ? b.lastSeq - a.lastSeq : a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
/** `board_thread_page_operator` in miniature: the filters as the board applies them, newest first, keyset paging. */
function pageOf(threads: Row[], filter: CommsThreadFilter, before: { lastSeq: number; id: string } | null, limit = 50, textsMissing?: number) {
  const rows = threads.map((t) => ({ ...t, providers: t.providers ?? [] })).filter((t) =>
    (!filter.project || t.participants.includes(filter.project)) &&
    (!filter.kind || t.kinds.includes(filter.kind)) &&
    (!filter.openOnly || t.openRequests > 0) &&
    (!filter.activeSince || (t.lastAt !== null && !Number.isNaN(Date.parse(t.lastAt)) && Date.parse(t.lastAt) >= Date.parse(filter.activeSince))) &&
    (!filter.provider || t.providers.includes(filter.provider)) &&
    (!before || order(t, before) > 0)
  ).sort(order)
  const page = rows.slice(0, limit)
  const last = page[page.length - 1]
  const more = rows.length > limit
  const empty = Object.keys(filter).length === 0 && before === null && page.length === 0
  return { ok: true as const, threads: page, more, before: more && last ? { lastSeq: last.lastSeq, id: last.id } : null, ...(empty && textsMissing ? { textsMissing } : {}) }
}

type Msg = { id: string; seq: number; thread: string; kind: string; sender: { project: string; principal: null }; at: string; digest: string; body?: { text: string }; replyTo?: string; request?: unknown; artifacts?: unknown[] }

/** The bridge, as a small board: `threads` for the page, `msgs` for the thread view, and each wave-4 read overridable. */
function board(cfg: {
  threads?: Row[]
  reply?: CommsThreadsReply | (() => Promise<CommsThreadsReply>)
  msgs?: Msg[]
  over?: Record<string, (...a: never[]) => unknown>
} = {}) {
  const answered = async (): Promise<CommsThreadsReply> => (typeof cfg.reply === 'function' ? cfg.reply() : (cfg.reply ?? { ok: true, threads: cfg.threads ?? [] }))
  const threadPage = vi.fn(async (filter: CommsThreadFilter, before: { lastSeq: number; id: string } | null, limit = 50) => {
    const r = await answered()
    return r.ok ? pageOf(r.threads as Row[], filter, before, limit, r.textsMissing) : r
  })
  const msgs = cfg.msgs ?? []
  const list = vi.fn(async (thread: string, after: number, limit = 50) => {
    const rows = msgs.filter((m) => m.thread === thread && m.seq > after).sort((a, b) => a.seq - b.seq)
    const kept = rows.slice(0, limit)
    return { ok: true as const, messages: kept.map(({ seq: _seq, ...m }) => m), lastSeq: kept.at(-1)?.seq ?? after, more: rows.length > limit }
  })
  const comms = {
    threads: vi.fn(answered),
    threadPage,
    list,
    heads: vi.fn(async () => ({ ok: true as const, heads: (cfg.threads ?? []).map((t) => ({ id: t.id, lastSeq: t.lastSeq })), truncated: false })),
    responders: vi.fn(async () => ({ ok: true as const, responders: [] })),
    facts: vi.fn(async () => ({ ok: true as const, messages: {}, requests: {} })),
    timeline: vi.fn(async () => ({ ok: true as const, steps: [], more: false })),
    related: vi.fn(async () => ({ ok: true as const, threads: [], more: false })),
    search: vi.fn(async () => ({ ok: true as const, hits: [], more: false, stoppedEarly: false, before: null })),
    pending: vi.fn(async () => ({ ok: true as const, projects: [], more: false })),
    openArtifact: vi.fn(async () => ({ ok: true as const })),
    ...(cfg.over ?? {})
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { comms } }))
  return comms
}
/** The older helper's shape: one answer for the page read. */
const stub = (reply: CommsThreadsReply | (() => Promise<CommsThreadsReply>)) => board({ reply })

type Heads = { heads: { id: string; lastSeq: number }[]; truncated: boolean } | null
const show = (seen: Record<string, number> = {}, onRead: (marks: Record<string, number>) => void = () => {}, heads?: Heads) =>
  render(
    <I18nProvider locale="en">
      <CommsScreen projects={PROJECTS} seen={seen} onRead={onRead} heads={heads} />
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

  it('after a restore whose board history did not come back, says the texts are missing — never that nothing was said (SCN-146 alt path)', async () => {
    stub({ ok: true, threads: [], textsMissing: 7 })
    show()
    await screen.findByText(en['launch.comms.textsMissing'])
    expect(screen.getByText(en['launch.comms.textsMissingBody'].replace('{count}', '7'))).toBeTruthy()
    expect(screen.queryByText(en['launch.comms.emptyBody'])).toBeNull()
    expect(screen.queryByText(en['launch.comms.empty'])).toBeNull()
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
    board({ over: { threadPage: async () => { throw new Error('the main process went away') } } })
    show()
    await screen.findByRole('alert')
    await waitFor(() => expect(screen.queryByText(en['launch.comms.empty'])).toBeNull())
  })
})

// SCN-143's wave-4 amendment (W4-3): the list is a bounded page, newest activity first, with "Show older threads".
describe('the bounded page', () => {
  const many = (n: number, from = 1000) => Array.from({ length: n }, (_, i) => ({ ...THREAD_B, id: `79000000-0000-4000-8000-${String(i).padStart(12, '0')}`, subject: `thread ${i}`, lastSeq: from - i }))
  const titles = () => screen.getAllByText(/^thread \d+$/, { selector: '.lp-topic-title' }).map((el) => el.textContent)

  it('reads newest activity first, 50 at a time, and offers the older ones', async () => {
    const comms = board({ threads: [THREAD, THREAD_B] })
    show()
    await screen.findByText('Cutover plan')
    const rows = screen.getAllByText(/Cutover plan|Retention digest/, { selector: '.lp-topic-title' }).map((el) => el.textContent)
    expect(rows).toEqual(['Retention digest', 'Cutover plan'])
    expect(comms.threadPage).toHaveBeenCalledWith({}, null, 50)
    expect(screen.queryByRole('button', { name: en['launch.comms.more'] })).toBeNull()
  })

  it('"Show older threads" reads the next page by the same order, without a thread twice', async () => {
    const comms = board({ threads: many(70) })
    show()
    await screen.findByText('thread 0')
    expect(titles()).toHaveLength(50)
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.more'] }))
    await screen.findByText('thread 69')
    expect(titles()).toEqual(Array.from({ length: 70 }, (_, i) => `thread ${i}`))
    expect(comms.threadPage).toHaveBeenCalledWith({}, { lastSeq: 951, id: many(70)[49].id }, 50)
    expect(screen.queryByRole('button', { name: en['launch.comms.more'] })).toBeNull()
  })

  it('an older page that fails says so beside the button, keeps "Show older threads", and a retry reads the same cursor (UX-7)', async () => {
    const rows = many(70)
    let fail = true
    const comms = board({ threads: rows })
    const page = comms.threadPage.getMockImplementation()!
    comms.threadPage.mockImplementation(async (filter, before, limit) => {
      if (before && fail) return { ok: false, error: { code: 'unavailable', message: 'statement timeout' } } as never
      return page(filter, before, limit)
    })
    show()
    await screen.findByText('thread 0')
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.more'] }))
    await screen.findByText(en['launch.comms.moreFailed'])
    expect(screen.getByText('statement timeout')).toBeTruthy()
    expect(titles()).toHaveLength(50)
    fail = false
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.more'] }))
    await screen.findByText('thread 69')
    // The poll clock reads the first page (cursor null) at any moment, so the retry is the last call WITH a cursor.
    const older = comms.threadPage.mock.calls.filter(([, before]) => before !== null)
    expect(older).toHaveLength(2)
    expect(older.at(-1)).toEqual([{}, { lastSeq: 951, id: rows[49].id }, 50])
    expect(screen.queryByText(en['launch.comms.moreFailed'])).toBeNull()
  })

  it('holds at most 200 threads and then says how to reach older ones instead of offering more', async () => {
    board({ threads: many(260) })
    show()
    await screen.findByText('thread 0')
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: en['launch.comms.more'] }))
      await screen.findByText(`thread ${50 * (i + 2) - 1}`)
    }
    expect(titles()).toHaveLength(200)
    expect(screen.queryByRole('button', { name: en['launch.comms.more'] })).toBeNull()
    expect(screen.getByText(en['launch.comms.capped'].replace('{count}', '200'))).toBeTruthy()
  })
})

// SCN-143's wave-4 amendment: a filter is a read the board answers, five filters combining as AND; "no match" is said
// only from the board's answer, and a filtered read that fails keeps what was last confirmed — never "no match".
describe('the filters are reads the board answers', () => {
  const two = () => board({ threads: [THREAD, THREAD_B] })

  it('by participant project: the board is asked for that project', async () => {
    const comms = two()
    show()
    await screen.findByText('Cutover plan')
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.project']), { target: { value: 'p1' } })
    await waitFor(() => expect(screen.queryByText('Retention digest')).toBeNull())
    expect(screen.getByText('Cutover plan')).toBeTruthy()
    expect(comms.threadPage).toHaveBeenCalledWith({ project: 'p1' }, null, 50)
  })

  it('by kind a thread HOLDS, and only threads with an open request', async () => {
    const comms = two()
    show()
    await screen.findByText('Cutover plan')
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.kind']), { target: { value: 'request' } })
    await waitFor(() => expect(screen.queryByText('Retention digest')).toBeNull())
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.kind']), { target: { value: '' } })
    await screen.findByText('Retention digest')
    fireEvent.click(screen.getByRole('checkbox', { name: en['launch.comms.filters.openRequests'] }))
    await waitFor(() => expect(screen.queryByText('Retention digest')).toBeNull())
    expect(screen.getByText('Cutover plan')).toBeTruthy()
    expect(comms.threadPage).toHaveBeenCalledWith({ openOnly: true }, null, 50)
  })

  it('by the coding agent that took part in the thread\'s requests (the fifth filter)', async () => {
    const comms = two()
    show()
    await screen.findByText('Cutover plan')
    const select = screen.getByLabelText(en['launch.comms.filters.provider']) as HTMLSelectElement
    // Named as the runner registry names it (runnerLabel), never by its raw id; the id stays the filter's value (UX-6).
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([en['launch.comms.filters.allProviders'], 'Claude Code'])
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['', 'claude-code'])
    fireEvent.change(select, { target: { value: 'claude-code' } })
    await waitFor(() => expect(screen.queryByText('Retention digest')).toBeNull())
    expect(comms.threadPage).toHaveBeenCalledWith({ provider: 'claude-code' }, null, 50)
  })

  it('a matchless filter says so in words with a way back, from the board\'s answer, and clearing returns the full list', async () => {
    two()
    show()
    await screen.findByText('Cutover plan')
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.kind']), { target: { value: 'announcement' } })
    await screen.findByText(en['launch.comms.filters.noMatch'])
    expect(screen.queryByText(en['launch.comms.empty'])).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.filters.clear'] }))
    await screen.findByText('Cutover plan')
    expect(screen.getByText('Retention digest')).toBeTruthy()
  })

  it('a filtered read the board does not answer keeps the last confirmed list and says so — NEVER "no match" (P12)', async () => {
    let fail = false
    const comms = board({ threads: [THREAD, THREAD_B] })
    const ok = comms.threadPage.getMockImplementation()!
    comms.threadPage.mockImplementation(async (filter, before, limit) => (fail ? { ok: false as const, error: { code: 'unavailable' as const, message: 'timeout' } } : ok(filter, before, limit)))
    show()
    await screen.findByText('Cutover plan')
    fail = true
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.kind']), { target: { value: 'announcement' } })
    await screen.findByText(en['launch.comms.filters.readFailed'])
    expect(screen.queryByText(en['launch.comms.filters.noMatch'])).toBeNull()
    expect(screen.getByText('Cutover plan')).toBeTruthy()
    expect(screen.getByText('Retention digest')).toBeTruthy()
  })

  it('a selection the filter excludes is closed with the filter change', async () => {
    two()
    show()
    await screen.findByText('Retention digest')
    fireEvent.click(screen.getByText('Retention digest'))
    await screen.findByText(en['launch.comms.threadEmpty'])
    fireEvent.click(screen.getByRole('checkbox', { name: en['launch.comms.filters.openRequests'] }))
    await waitFor(() => expect(screen.queryByText(en['launch.comms.threadEmpty'])).toBeNull())
    expect(screen.getByText(en['launch.comms.aside.title'])).toBeTruthy()
  })
})

// ── the thread view ─────────────────────────────────────────────────────────────────────────────────────────────

const msg = (seq: number, over: Partial<Msg> = {}): Msg => ({
  id: `m-${String(seq).padStart(4, '0')}-0000-4000-8000-000000000000`, seq, thread: THREAD.id, kind: 'message',
  sender: { project: seq % 2 ? 'p1' : 'p2', principal: null }, at: '2026-10-11T08:00:00.000Z', digest: `d${seq}`, body: { text: `message number ${seq}` }, ...over
})
/** The older helper: a board holding `threads` and `msgs`. */
const boardOf = (threads: Row[], msgs: Msg[], over: Record<string, (...a: never[]) => unknown> = {}) => board({ threads, msgs, over })

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
  it('call an answering agent «отвечающий», never «ответчик» (the defendant in a lawsuit)', () => {
    for (const key of Object.keys(ru).filter((k) => k.startsWith('launch.comms.'))) expect(ru[key as keyof typeof ru], key).not.toMatch(/ответчик/i)
    expect(ru['launch.comms.responder.active']).toContain('Отвечающий №{n}')
  })
  it('every wave-4 Comms string exists in both languages', () => {
    for (const key of Object.keys(en).filter((k) => k.startsWith('launch.comms.'))) expect(ru[key as keyof typeof ru], key).toBeTruthy()
  })
})

// SCN-143, amended 2026-10-12 (COM-07, the unread slice), with the wave-4 heads: a thread whose last message is newer
// than this operator's read mark carries "New"; opening a thread marks it read through its last seq; "mark all read"
// marks every thread the heads name, the ones the page does not hold included — it answers the rail's count.
describe("the operator's own unread marks", () => {
  const two = () => board({ threads: [THREAD, THREAD_B] })
  const HEADS = { heads: [{ id: THREAD_B.id, lastSeq: 41 }, { id: THREAD.id, lastSeq: 40 }, { id: '79000000-0000-4000-8000-0000000000d9', lastSeq: 3 }], truncated: false }
  const rowOf = (title: string) => {
    // The row's title, never the open thread's heading, which repeats the same words.
    const row = screen.getByText(title, { selector: '.lp-topic-title' }).closest('button')
    if (!row) throw new Error(`no row for ${title}`)
    return row
  }

  it('a thread newer than the mark carries "New"; a read one does not; a never-opened one is unread', async () => {
    two()
    show({ [THREAD.id]: THREAD.lastSeq })
    await screen.findByText('Cutover plan')
    expect(rowOf('Cutover plan').textContent).not.toContain(en['launch.comms.new'])
    expect(rowOf('Retention digest').textContent).toContain(en['launch.comms.new'])
  })

  it('opening a thread marks it read through its last seq, once, and the marker clears at once', async () => {
    const onRead = vi.fn()
    two()
    show({}, onRead)
    await screen.findByText('Cutover plan')
    expect(rowOf('Cutover plan').textContent).toContain(en['launch.comms.new'])
    fireEvent.click(screen.getByText('Cutover plan', { selector: '.lp-topic-title' }))
    await screen.findByText(en['launch.comms.threadEmpty'])
    await waitFor(() => expect(onRead).toHaveBeenCalledWith({ [THREAD.id]: THREAD.lastSeq }))
    expect(onRead).toHaveBeenCalledTimes(1)
    expect(rowOf('Cutover plan').textContent).not.toContain(en['launch.comms.new'])
    expect(rowOf('Retention digest').textContent).toContain(en['launch.comms.new'])
  })

  it('mark all read marks every thread the heads name — the ones the page does not hold included — in one merged map', async () => {
    const onRead = vi.fn()
    two()
    show({}, onRead, HEADS)
    await screen.findByText('Cutover plan')
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.markAllRead'] }))
    await waitFor(() => expect(onRead).toHaveBeenCalledWith({ [THREAD_B.id]: 41, [THREAD.id]: 40, '79000000-0000-4000-8000-0000000000d9': 3 }))
    expect(onRead).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(en['launch.comms.new'])).toBeNull()
    expect(screen.queryByRole('button', { name: en['launch.comms.markAllRead'] })).toBeNull()
  })

  it('mark all read is offered while a thread the page does not hold is unread, even when every listed one is read', async () => {
    two()
    show({ [THREAD.id]: 40, [THREAD_B.id]: 41 }, () => {}, HEADS)
    await screen.findByText('Cutover plan')
    expect(screen.queryByText(en['launch.comms.new'])).toBeNull()
    expect(screen.getByRole('button', { name: en['launch.comms.markAllRead'] })).toBeTruthy()
  })

  it('nothing unread means no "mark all read" control at all', async () => {
    two()
    show({ [THREAD.id]: THREAD.lastSeq, [THREAD_B.id]: THREAD_B.lastSeq })
    await screen.findByText('Cutover plan')
    expect(screen.queryByText(en['launch.comms.new'])).toBeNull()
    expect(screen.queryByRole('button', { name: en['launch.comms.markAllRead'] })).toBeNull()
  })
})

// SCN-143, amended 2026-10-12 (the time-filter slice) and for wave 4: the window is measured back from the injected
// clock, inclusive at its edge, and asked of the board as the instant it starts; an undated thread (no messages, or a
// `lastAt` that does not parse) is in no window.
describe('the activity filter asks the board for a window measured from now', () => {
  const NOW = Date.parse('2026-10-12T12:00:00.000Z')
  const HOUR = 3_600_000
  const at = (ms: number) => new Date(NOW - ms).toISOString()
  const recent = { ...THREAD, lastAt: at(2 * HOUR) }
  const stale = { ...THREAD_B, lastAt: at(72 * HOUR) }
  const undated = { ...THREAD_B, id: '79000000-0000-4000-8000-0000000000d3', subject: 'Empty start', lastAt: null, messageCount: 0, lastSeq: 0 }
  const garbled = { ...THREAD_B, id: '79000000-0000-4000-8000-0000000000d4', subject: 'Garbled clock', lastAt: 'not-a-date' }
  const titled = (id: string, subject: string, lastAt: string | null, lastSeq = 30) => ({ ...THREAD_B, id, subject, lastAt, lastSeq })
  const activity = () => screen.getByLabelText(en['launch.comms.filters.activity']) as HTMLSelectElement
  const choose = (value: 'all' | 'day' | 'week') => fireEvent.change(activity(), { target: { value } })
  const showAt = (now: number = NOW, seen: Record<string, number> = {}, onRead: (marks: Record<string, number>) => void = () => {}) =>
    render(
      <I18nProvider locale="en">
        <CommsScreen projects={PROJECTS} seen={seen} onRead={onRead} now={() => now} />
      </I18nProvider>
    )

  it('offers the windows by what they measure: last 24 hours and last 7 days, never "today" or "the week"', async () => {
    board({ threads: [recent] })
    showAt()
    await screen.findByText('Cutover plan')
    const labels = Array.from(activity().options).map((o) => o.textContent)
    expect(labels).toEqual([en['launch.comms.filters.allTime'], en['launch.comms.filters.day'], en['launch.comms.filters.week']])
    expect(en['launch.comms.filters.day']).toBe('Last 24 hours')
    expect(en['launch.comms.filters.week']).toBe('Last 7 days')
    expect(ru['launch.comms.filters.day']).toBe('За 24 часа')
    expect(ru['launch.comms.filters.week']).toBe('За 7 дней')
  })

  it('the last 24 hours is asked as the instant 24 hours before now, and keeps only what was written since', async () => {
    const comms = board({ threads: [recent, stale] })
    showAt()
    await screen.findByText('Cutover plan')
    choose('day')
    await waitFor(() => expect(screen.queryByText('Retention digest')).toBeNull())
    expect(screen.getByText('Cutover plan')).toBeTruthy()
    expect(comms.threadPage).toHaveBeenCalledWith({ activeSince: at(24 * HOUR) }, null, 50)
    choose('week')
    await screen.findByText('Retention digest')
  })

  it('a write exactly 24 hours ago is inside the day window; one millisecond earlier is outside it', async () => {
    board({ threads: [titled('79000000-0000-4000-8000-0000000000e1', 'On the edge', at(24 * HOUR), 31), titled('79000000-0000-4000-8000-0000000000e2', 'Just past', at(24 * HOUR + 1))] })
    showAt()
    await screen.findByText('On the edge')
    choose('day')
    await waitFor(() => expect(screen.queryByText('Just past')).toBeNull())
    expect(screen.getByText('On the edge')).toBeTruthy()
    choose('week')
    await screen.findByText('Just past')
  })

  it('a write exactly 7 days ago is inside the week window; one millisecond earlier is outside it', async () => {
    board({ threads: [titled('79000000-0000-4000-8000-0000000000e3', 'Week edge', at(7 * 24 * HOUR), 31), titled('79000000-0000-4000-8000-0000000000e4', 'Week past', at(7 * 24 * HOUR + 1))] })
    showAt()
    await screen.findByText('Week edge')
    choose('week')
    await waitFor(() => expect(screen.queryByText('Week past')).toBeNull())
    expect(screen.getByText('Week edge')).toBeTruthy()
    choose('all')
    await screen.findByText('Week past')
  })

  it('the window is measured from the injected clock, not from the machine time the test runs at', async () => {
    // The same thread, two clocks: two hours after its write it is in the day window; three days after, it is not.
    board({ threads: [recent] })
    showAt(NOW + 70 * HOUR)
    await screen.findByText('Cutover plan')
    choose('day')
    await screen.findByText(en['launch.comms.filters.noMatch'])
  })

  it('an undated thread is not "old": no messages yet matches only all time', async () => {
    board({ threads: [recent, undated] })
    showAt()
    await screen.findByText('Cutover plan')
    expect(screen.getByText('Empty start')).toBeTruthy()
    choose('day')
    await waitFor(() => expect(screen.queryByText('Empty start')).toBeNull())
    choose('week')
    await waitFor(() => expect(screen.getByText('Cutover plan')).toBeTruthy())
    expect(screen.queryByText('Empty start')).toBeNull()
    choose('all')
    await screen.findByText('Empty start')
  })

  it('a last write that does not parse is undated too: it matches only all time, never a window', async () => {
    board({ threads: [recent, garbled] })
    showAt()
    await screen.findByText('Garbled clock')
    choose('day')
    await waitFor(() => expect(screen.queryByText('Garbled clock')).toBeNull())
    choose('all')
    await screen.findByText('Garbled clock')
  })

  it('combines with the other filters as AND', async () => {
    const comms = board({ threads: [recent, stale] })
    showAt()
    await screen.findByText('Cutover plan')
    // The only thread HOLDING a finding is the stale one, and it is outside the day window: nothing matches.
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.kind']), { target: { value: 'finding' } })
    choose('day')
    await screen.findByText(en['launch.comms.filters.noMatch'])
    expect(comms.threadPage).toHaveBeenCalledWith({ kind: 'finding', activeSince: at(24 * HOUR) }, null, 50)
    choose('week')
    await screen.findByText('Retention digest')
    expect(screen.queryByText('Cutover plan')).toBeNull()
  })

  it('clearing the filters puts the activity window back to all time', async () => {
    board({ threads: [stale, undated] })
    showAt()
    await screen.findByText('Retention digest')
    choose('day')
    await screen.findByText(en['launch.comms.filters.noMatch'])
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.filters.clear'] }))
    expect(activity().value).toBe('all')
    await screen.findByText('Retention digest')
    expect(screen.getByText('Empty start')).toBeTruthy()
  })
})

// ── W4-4: who answers, how it ended, who read it (SCN-147 steps 1–4) ────────────────────────────────────────────────
const REQ_ID = 'r-0007-0000-4000-8000-000000000000'
const request = (state: string, over: Record<string, unknown> = {}) =>
  msg(7, { id: REQ_ID, kind: 'request', body: { text: 'Please compute retention.' }, request: { id: REQ_ID, target: 'p2', capability: 'analytics.retention', state, effect: state === 'outcome_unknown' ? 'unknown' : 'not_started', revision: 3 }, ...over })
const slot = (over: Record<string, unknown> = {}) => ({ project: 'p2', capability: 'analytics.retention', state: 'active', generation: 2, leaseExpiresAt: '2026-10-11T08:01:00.000Z', agent: 'claude-code', since: '2026-10-11T07:00:00.000Z', ...over })
const openRequest = async (state: string, over: Record<string, (...a: never[]) => unknown> = {}, msgOver: Record<string, unknown> = {}) => {
  const comms = boardOf([{ ...THREAD, createdSeq: 7, lastSeq: 7, messageCount: 1 }], [request(state, msgOver)], over)
  show()
  fireEvent.click(await screen.findByText('Cutover plan'))
  await screen.findByText('Please compute retention.')
  return comms
}
const responderText = () => screen.getByText(en['launch.comms.responder.label']).closest('div')!.textContent ?? ''

describe('who answers a request (SCN-147 step 1)', () => {
  it('says "checking" until the responders are read — never "absent"', async () => {
    await openRequest('queued', { responders: () => new Promise(() => {}) })
    expect(responderText()).toContain(en['launch.comms.responder.checking'])
    expect(responderText()).not.toContain('No agent answers')
  })

  it('a failed responders read says who answers is not known — never "absent" (P11)', async () => {
    await openRequest('queued', { responders: async () => ({ ok: false, error: { code: 'unavailable', message: 'down' } }) })
    await waitFor(() => expect(responderText()).toContain(en['launch.comms.responder.unknown']))
    expect(responderText()).not.toContain('No agent answers')
  })

  it('active names responder #n, the agent by its name (never its raw runner id) and since when (UX-6)', async () => {
    await openRequest('claimed', { responders: async () => ({ ok: true, responders: [slot()] }) })
    await waitFor(() => expect(responderText()).toMatch(/Responder #2 · Claude Code · since /))
    expect(responderText()).not.toContain('claude-code')
  })

  it('stale says the lease lapsed and that this says nothing about whether it worked — never absent', async () => {
    await openRequest('claimed', { responders: async () => ({ ok: true, responders: [slot({ state: 'stale' })] }) })
    await waitFor(() => expect(responderText()).toContain('That says nothing about whether it worked.'))
    expect(responderText()).not.toContain('No agent answers')
  })

  it('absent names the capability and project, and why the last one left when it is known', async () => {
    await openRequest('queued', { responders: async () => ({ ok: true, responders: [slot({ state: 'absent', agent: undefined, releasedCause: 'revoked', releasedAt: '2026-10-11T07:30:00.000Z' })] }) })
    await waitFor(() => expect(responderText()).toContain('No agent answers analytics.retention requests for Beacon now.'))
    expect(responderText()).toMatch(/The last one's permission was revoked, .+ ago\./)
  })

  it('a capability nobody ever answered is absent, with no cause invented', async () => {
    await openRequest('queued', { responders: async () => ({ ok: true, responders: [] }) })
    await waitFor(() => expect(responderText()).toContain('No agent answers analytics.retention requests for Beacon now.'))
    expect(responderText()).not.toMatch(/The last one/)
  })
})

describe('how a request ended (SCN-147 steps 2–3)', () => {
  const facts = (outcomes: unknown[]) => async () => ({ ok: true, messages: {}, requests: { [REQ_ID]: { attemptLive: false, outcomes } } })

  it('a completed request shows what the responder reported, with its evidence', async () => {
    await openRequest('completed', { facts: facts([{ kind: 'outcome', summary: 'Retention is 41%.', evidence: [], at: '2026-10-11T08:00:00.000Z', settledBy: 'responder' }]) })
    await screen.findByText(en['launch.comms.outcome.summary'])
    expect(screen.getByText('Retention is 41%.')).toBeTruthy()
  })

  it('a cancelled request labels the requester\'s reason as the requester\'s', async () => {
    await openRequest('cancelled', { facts: facts([{ kind: 'cancel_reason', summary: 'Not needed any more.', evidence: [], at: '2026-10-11T08:00:00.000Z' }]) })
    await screen.findByText(en['launch.comms.outcome.cancelReason'])
    expect(screen.queryByText(en['launch.comms.outcome.summary'])).toBeNull()
  })

  it('"No summary was given" only when the facts were read and hold none; a failed read says the outcome could not be read', async () => {
    await openRequest('completed', { facts: facts([]) })
    await screen.findByText(en['launch.comms.outcome.none'])
    cleanup()
    await openRequest('completed', { facts: async () => ({ ok: false, error: { code: 'unavailable', message: 'down' } }) })
    await screen.findByText(en['launch.comms.outcome.unavailable'])
    expect(screen.queryByText(en['launch.comms.outcome.none'])).toBeNull()
  })

  it('outcome_unknown never reads as success, and names who can settle it (P15)', async () => {
    await openRequest('outcome_unknown', { responders: async () => ({ ok: true, responders: [slot()] }) })
    await screen.findByText(en['launch.comms.request.state.outcome_unknown'])
    expect(en['launch.comms.request.state.outcome_unknown']).toBe('may have happened — awaiting reconciliation')
    expect(en['launch.comms.request.state.outcome_unknown']).not.toMatch(/\b(done|completed|succeeded|success)\b/i)
    expect(ru['launch.comms.request.state.outcome_unknown']).not.toMatch(/успешно|завершено/i)
    await screen.findByText(en['launch.comms.unknown.settledBy'].replace('{capability}', 'analytics.retention'))
  })

  it('outcome_unknown with nobody answering says nothing settles it until an agent does — and offers no settle control', async () => {
    await openRequest('outcome_unknown', { responders: async () => ({ ok: true, responders: [slot({ state: 'absent' })] }) })
    await screen.findByText(en['launch.comms.unknown.nobody'].replace('{capability}', 'analytics.retention'))
    expect(screen.queryByRole('button', { name: /settle|закрыть/i })).toBeNull()
  })
})

describe('who marked a message read (SCN-147 step 4)', () => {
  it('names the participants that marked it read, never the sender; nothing when none has', async () => {
    await openRequest('queued', { facts: async () => ({ ok: true, messages: { [REQ_ID]: { readBy: ['p2'] } }, requests: {} }) })
    await screen.findByText(en['launch.comms.readBy'].replace('{projects}', 'Beacon'))
    cleanup()
    await openRequest('queued', { facts: async () => ({ ok: true, messages: { [REQ_ID]: { readBy: [] } }, requests: {} }) })
    await waitFor(() => expect(screen.queryByText(/Marked read by/)).toBeNull())
  })
})

// ── W4-5: artifacts, the timeline, related threads, search (SCN-147 steps 5 and 7, SCN-156) ─────────────────────────
describe('artifacts as the sender stated them (SCN-147 step 5)', () => {
  const HASH = 'sha256:' + 'ab'.repeat(32)
  it('an https link opens through main; a javascript: one is text that does not open (P13)', async () => {
    const comms = await openRequest('queued', {}, { artifacts: [{ id: 'https://example.org/report.pdf', contentHash: HASH, label: 'report.pdf' }, { id: 'javascript:alert(1)', contentHash: HASH, label: 'trap' }] })
    const link = await screen.findByRole('button', { name: 'report.pdf' })
    fireEvent.click(link)
    await waitFor(() => expect(comms.openArtifact).toHaveBeenCalledWith('https://example.org/report.pdf'))
    expect(screen.queryByRole('button', { name: 'trap' })).toBeNull()
    const trap = screen.getByText('trap')
    expect(trap.closest('[data-comms-artifact]')?.getAttribute('data-comms-artifact')).toBe('text')
    expect(within(trap.closest('li')!).getByText(en['launch.comms.artifact.notOpened'], { exact: false })).toBeTruthy()
    expect(comms.openArtifact).toHaveBeenCalledTimes(1)
  })
  it('shows the short hash "as the sender stated it", and Copy takes the whole hash', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await openRequest('queued', {}, { artifacts: [{ id: 'https://example.org/a.csv', contentHash: HASH }] })
    await screen.findByText(en['launch.comms.artifact.hash'].replace('{hash}', HASH.slice(0, 19) + '…'), { exact: false })
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.artifact.copy'] }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(HASH))
    await screen.findByText(en['launch.comms.artifact.copied'], { exact: false })
  })
  it('a Copy the clipboard refuses says it did not copy — never a silent nothing (UX-7)', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async () => { throw new Error('denied') }) } })
    await openRequest('queued', {}, { artifacts: [{ id: 'https://example.org/a.csv', contentHash: HASH }] })
    fireEvent.click(await screen.findByRole('button', { name: en['launch.comms.artifact.copy'] }))
    await screen.findByText(en['launch.comms.artifact.copyFailed'], { exact: false })
    expect(screen.queryByText(en['launch.comms.artifact.copied'], { exact: false })).toBeNull()
  })
})

describe('a request\'s timeline and related threads (SCN-147 step 7)', () => {
  it('the timeline is collapsed, reads when opened, and says each step oldest first', async () => {
    const timeline = vi.fn(async () => ({ ok: true, more: false, steps: [
      { op: 'claim', from: 'queued', to: 'claimed', cause: 'responder', generation: 2, at: '2026-10-11T08:00:00.000Z' },
      { op: 'cancel', from: 'claimed', to: 'cancelled', cause: 'requester', at: '2026-10-11T08:05:00.000Z' }] }))
    await openRequest('cancelled', { timeline })
    expect(timeline).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.timeline.title'] }))
    const steps = await screen.findAllByRole('listitem')
    const texts = steps.map((s) => s.textContent ?? '').filter((s) => s.includes('→'))
    expect(texts[0]).toMatch(/queued → claimed · by the responder · responder #2$/)
    expect(texts[1]).toMatch(/claimed → cancelled · by the requester$/)
    expect(timeline).toHaveBeenCalledWith(REQ_ID)
  })
  it('a timeline that cannot be read says so where it would be', async () => {
    await openRequest('queued', { timeline: async () => ({ ok: false, error: { code: 'unavailable', message: 'down' } }) })
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.timeline.title'] }))
    await screen.findByText(en['launch.comms.unavailable'])
  })
  it('related threads say why each is related, and open on a click', async () => {
    const related = vi.fn(async () => ({ ok: true, more: false, threads: [{ id: THREAD_B.id, subject: 'Retention digest', why: 'shared-artifact', lastAt: null, participants: ['p2'], createdSeq: 5, lastSeq: 41 }] }))
    await openRequest('queued', { related })
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.related.title'] }))
    const item = await screen.findByRole('button', { name: 'Retention digest' })
    expect(item.closest('li')!.textContent).toContain(en['launch.comms.related.shared-artifact'])
    fireEvent.click(item)
    await screen.findByRole('heading', { level: 3, name: 'Retention digest' })
  })
})

describe('history search (SCN-156)', () => {
  const field = () => screen.getByLabelText(en['launch.comms.search.label'], { selector: 'input' })
  const search = (q: string) => { fireEvent.change(field(), { target: { value: q } }); fireEvent.click(screen.getByRole('button', { name: en['launch.comms.search.submit'] })) }
  const HIT = { message: REQ_ID, thread: THREAD.id, seq: 7, at: '2026-10-11T08:00:00.000Z', sender: 'p1', snippet: 'Please compute retention.', subject: 'Cutover plan', participants: ['p1', 'p2'], createdSeq: 3 }

  it('finds messages by their words and opens the thread at the hit', async () => {
    const searchFn = vi.fn(async () => ({ ok: true, hits: [HIT], more: false, stoppedEarly: false, before: null }))
    boardOf([THREAD], [request('queued')], { search: searchFn })
    show()
    await screen.findByText('Cutover plan')
    search('retention')
    expect(searchFn).toHaveBeenCalledWith('retention', null)
    fireEvent.click(await screen.findByRole('button', { name: 'Please compute retention.' }))
    await screen.findByRole('heading', { level: 3, name: 'Cutover plan' })
  })
  it('"no message contains these words" only from an answered search; a failed one says Comms did not answer', async () => {
    board({ threads: [THREAD] })
    show()
    await screen.findByText('Cutover plan')
    search('nothing like it')
    await screen.findByText(en['launch.comms.search.none'])
    cleanup()
    board({ threads: [THREAD], over: { search: async () => ({ ok: false, error: { code: 'unavailable', message: 'down' } }) } })
    show()
    await screen.findByText('Cutover plan')
    search('anything')
    await screen.findByText(en['launch.comms.search.unavailable'])
    expect(screen.queryByText(en['launch.comms.search.none'])).toBeNull()
    // The machine's words stand apart from the sentence, on their own line (UX-5).
    expect(screen.getByText(en['launch.comms.search.unavailable']).textContent).toBe(en['launch.comms.search.unavailable'])
    expect(screen.getByText('down')).toBeTruthy()
  })
  it('a search that stopped early says so, with what it found; more results read on from the cursor', async () => {
    const searchFn = vi.fn(async (_q: string, before: number | null) => (before === null
      ? { ok: true, hits: [HIT], more: true, stoppedEarly: false, before: 7 }
      : { ok: true, hits: [{ ...HIT, message: 'm-2', seq: 3, snippet: 'an older retention note' }], more: false, stoppedEarly: true, before: null }))
    board({ threads: [THREAD], over: { search: searchFn } })
    show()
    await screen.findByText('Cutover plan')
    search('retention')
    fireEvent.click(await screen.findByRole('button', { name: en['launch.comms.search.more'] }))
    await screen.findByText(en['launch.comms.search.stoppedEarly'])
    expect(searchFn).toHaveBeenLastCalledWith('retention', 7)
    expect(screen.getByRole('button', { name: 'an older retention note' })).toBeTruthy()
  })
  it('a page of more results that fails keeps what was found AND "More results", says Comms did not answer, and a retry reads on from the same cursor (UX-7, ER-8)', async () => {
    let fail = true
    const searchFn = vi.fn(async (_q: string, before: number | null) => {
      if (before === null) return { ok: true, hits: [HIT], more: true, stoppedEarly: false, before: 7 }
      if (fail) return { ok: false, error: { code: 'unavailable', message: 'connection reset by peer' } }
      return { ok: true, hits: [{ ...HIT, message: 'm-2', seq: 3, snippet: 'an older retention note' }], more: false, stoppedEarly: false, before: null }
    })
    board({ threads: [THREAD], over: { search: searchFn } })
    show()
    await screen.findByText('Cutover plan')
    search('retention')
    fireEvent.click(await screen.findByRole('button', { name: en['launch.comms.search.more'] }))
    const said = await screen.findByText(en['launch.comms.search.moreFailed'])
    // Our sentence, with the machine's words apart on their own line (UX-5).
    expect(said.textContent).toBe(en['launch.comms.search.moreFailed'])
    expect(screen.getByText('connection reset by peer')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Please compute retention.' })).toBeTruthy()
    const more = screen.getByRole('button', { name: en['launch.comms.search.more'] })
    expect(screen.queryByText(en['launch.comms.search.none'])).toBeNull()
    fail = false
    fireEvent.click(more)
    await screen.findByRole('button', { name: 'an older retention note' })
    expect(searchFn).toHaveBeenLastCalledWith('retention', 7)
    expect(screen.queryByText(en['launch.comms.search.moreFailed'])).toBeNull()
  })
  it('fewer than two characters is not searched', async () => {
    const comms = board({ threads: [THREAD] })
    show()
    await screen.findByText('Cutover plan')
    search('x')
    await screen.findByText(en['launch.comms.search.tooShort'])
    expect(comms.search).not.toHaveBeenCalled()
  })
})

// ── W4-6: what waits for a project (SCN-157) ────────────────────────────────────────────────────────────────────
describe('what waits for a project (SCN-157)', () => {
  const ROW = { project: 'p2', unread: 3, oldestAt: '2026-10-11T06:00:00.000Z', findings: 1, requests: 2, requestsWithAbsentResponder: 1 }
  it('lists each project with what waits, and opening one narrows the list to it', async () => {
    const comms = board({ threads: [THREAD, THREAD_B], over: { pending: async () => ({ ok: true, more: false, projects: [ROW] }) } })
    show()
    const row = await screen.findByRole('button', { name: /^Beacon: unread 3, the oldest .+ ago; findings 1, requests 2$/ })
    expect(row.closest('li')!.textContent).toContain(en['launch.comms.pending.noResponder'].replace('{count}', '1'))
    fireEvent.click(row)
    await waitFor(() => expect(comms.threadPage).toHaveBeenCalledWith({ project: 'p2' }, null, 50))
    expect((screen.getByLabelText(en['launch.comms.filters.project']) as HTMLSelectElement).value).toBe('p2')
  })
  it('a board that holds more than the 100 projects it answered says so — the list is never read as the whole (ER-9)', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ ...ROW, project: `px-${i}` }))
    board({ threads: [THREAD], over: { pending: async () => ({ ok: true, more: true, projects: rows }) } })
    show()
    await screen.findByText(en['launch.comms.pending.capped'].replace('{count}', '100'))
    cleanup()
    board({ threads: [THREAD], over: { pending: async () => ({ ok: true, more: false, projects: [ROW] }) } })
    show()
    await screen.findByRole('button', { name: /^Beacon: unread 3/ })
    expect(screen.queryByText(/more projects/i)).toBeNull()
  })
  it('says nothing waits when nothing does, and that it could not be read when it could not — the list is unaffected', async () => {
    board({ threads: [THREAD] })
    show()
    await screen.findByText(en['launch.comms.pending.none'])
    cleanup()
    board({ threads: [THREAD], over: { pending: async () => ({ ok: false, error: { code: 'unavailable', message: 'down' } as CommsReadError }) } })
    show()
    await screen.findByText(en['launch.comms.pending.unavailable'])
    expect(screen.getByText('Cutover plan')).toBeTruthy()
  })
})
