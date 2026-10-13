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
  lastAt: '2026-10-11T08:00:00.000Z',
  kinds: ['message', 'request'],
  openRequests: 1
}

/** A second thread, disjoint on every filter axis: other participant set, another kind, no open request. */
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
  openRequests: 0
}

function stub(reply: CommsThreadsReply | (() => Promise<CommsThreadsReply>)) {
  const threads = vi.fn(typeof reply === 'function' ? reply : async () => reply)
  const list = vi.fn(async () => ({ ok: true as const, messages: [], lastSeq: 0, more: false }))
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { comms: { threads, list } } }))
  return { threads, list }
}

const show = (seen: Record<string, number> = {}, onRead: (marks: Record<string, number>) => void = () => {}) =>
  render(
    <I18nProvider locale="en">
      <CommsScreen projects={PROJECTS} seen={seen} onRead={onRead} />
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
    stub(async () => {
      throw new Error('the main process went away')
    })
    show()
    await screen.findByRole('alert')
    await waitFor(() => expect(screen.queryByText(en['launch.comms.empty'])).toBeNull())
  })
})

// SCN-143, amended 2026-10-11 (COM-07, the filter slice): three filters, AND-combined, each "all"
// by default. They narrow the list the board already answered — a filter NEVER re-queries the board,
// so it can never make an unanswered board look empty; and a matchless narrowing says so in words
// with the way back, which is neither the estate's empty answer nor the board's silence.
describe('the filters narrow the list the board already answered, never re-querying it', () => {
  const two = () => stub({ ok: true, threads: [THREAD, THREAD_B] })

  it('by participant project', async () => {
    const { threads } = two()
    show()
    await screen.findByText('Cutover plan')
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.project']), { target: { value: 'p1' } })
    expect(screen.queryByText('Retention digest')).toBeNull()
    expect(screen.getByText('Cutover plan')).toBeTruthy()
    await waitFor(() => expect(threads).toHaveBeenCalledTimes(1), { timeout: 300 })
  })

  it('by kind a thread HOLDS, and only threads with an open request', async () => {
    two()
    show()
    await screen.findByText('Cutover plan')
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.kind']), { target: { value: 'request' } })
    expect(screen.queryByText('Retention digest')).toBeNull()
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.kind']), { target: { value: '' } })
    expect(screen.getByText('Retention digest')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: en['launch.comms.filters.openRequests'] }))
    expect(screen.queryByText('Retention digest')).toBeNull()
    expect(screen.getByText('Cutover plan')).toBeTruthy()
  })

  it('a matchless narrowing says so in words with a way back, and clearing returns the full list', async () => {
    two()
    show()
    await screen.findByText('Cutover plan')
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.kind']), { target: { value: 'announcement' } })
    await screen.findByText(en['launch.comms.filters.noMatch'])
    expect(screen.queryByText(en['launch.comms.empty'])).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.filters.clear'] }))
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

// SCN-143, amended 2026-10-12 (COM-07, the unread slice): a thread whose last message is newer
// than this operator's read mark carries "New"; opening a thread marks it read through its last
// seq (and messages arriving while it is open move the mark by the same effect, on the next list
// poll); "mark all read" clears the board in one act. The marks are the operator's own and
// machine-local — the board never learns them, and a failed settings write never zeroes them.
describe("the operator's own unread marks", () => {
  const two = () => stub({ ok: true, threads: [THREAD, THREAD_B] })
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

  it('mark all read writes one merged mark map and clears every marker; hidden when nothing is unread', async () => {
    const onRead = vi.fn()
    two()
    show({}, onRead)
    await screen.findByText('Cutover plan')
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.markAllRead'] }))
    await waitFor(() => expect(onRead).toHaveBeenCalledWith({ [THREAD.id]: THREAD.lastSeq, [THREAD_B.id]: THREAD_B.lastSeq }))
    expect(onRead).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(en['launch.comms.new'])).toBeNull()
    expect(screen.queryByRole('button', { name: en['launch.comms.markAllRead'] })).toBeNull()
  })

  it('nothing unread means no "mark all read" control at all', async () => {
    two()
    show({ [THREAD.id]: THREAD.lastSeq, [THREAD_B.id]: THREAD_B.lastSeq })
    await screen.findByText('Cutover plan')
    expect(screen.queryByText(en['launch.comms.new'])).toBeNull()
    expect(screen.queryByRole('button', { name: en['launch.comms.markAllRead'] })).toBeNull()
  })
})

// SCN-143, amended 2026-10-12 (COM-07, the time-filter slice): the window reads `lastAt` — a fact
// the board already answered with — so it narrows the answered list and never re-queries it; an
// undated thread (no messages yet, or a `lastAt` that does not parse) is not "old" and matches only
// "all time". The clock is injected, so every boundary is held against a fixed instant.
describe('the activity filter narrows by last write, never re-querying', () => {
  const NOW = Date.parse('2026-10-12T12:00:00.000Z')
  const HOUR = 3_600_000
  const at = (ms: number) => new Date(NOW - ms).toISOString()
  const recent = { ...THREAD, lastAt: at(2 * HOUR) }
  const stale = { ...THREAD_B, lastAt: at(72 * HOUR) }
  const undated = { ...THREAD_B, id: '79000000-0000-4000-8000-0000000000d3', subject: 'Empty start', lastAt: null, messageCount: 0 }
  const garbled = { ...THREAD_B, id: '79000000-0000-4000-8000-0000000000d4', subject: 'Garbled clock', lastAt: 'not-a-date' }
  const titled = (id: string, subject: string, lastAt: string | null) => ({ ...THREAD_B, id, subject, lastAt })
  const activity = () => screen.getByLabelText(en['launch.comms.filters.activity']) as HTMLSelectElement
  const choose = (value: 'all' | 'day' | 'week') => fireEvent.change(activity(), { target: { value } })
  const showAt = (now: number = NOW, seen: Record<string, number> = {}, onRead: (marks: Record<string, number>) => void = () => {}) =>
    render(
      <I18nProvider locale="en">
        <CommsScreen projects={PROJECTS} seen={seen} onRead={onRead} now={() => now} />
      </I18nProvider>
    )

  it('offers the windows by what they measure: last 24 hours and last 7 days, never "today" or "the week"', async () => {
    stub({ ok: true, threads: [recent] })
    showAt()
    await screen.findByText('Cutover plan')
    const labels = Array.from(activity().options).map((o) => o.textContent)
    expect(labels).toEqual([en['launch.comms.filters.allTime'], en['launch.comms.filters.day'], en['launch.comms.filters.week']])
    expect(en['launch.comms.filters.day']).toBe('Last 24 hours')
    expect(en['launch.comms.filters.week']).toBe('Last 7 days')
    expect(ru['launch.comms.filters.day']).toBe('За 24 часа')
    expect(ru['launch.comms.filters.week']).toBe('За 7 дней')
  })

  it('the last 24 hours keeps what was written in them and hides what was not, without asking the board again', async () => {
    const { threads } = stub({ ok: true, threads: [recent, stale] })
    showAt()
    await screen.findByText('Cutover plan')
    choose('day')
    expect(screen.queryByText('Retention digest')).toBeNull()
    expect(screen.getByText('Cutover plan')).toBeTruthy()
    await waitFor(() => expect(threads).toHaveBeenCalledTimes(1), { timeout: 300 })
    choose('week')
    expect(screen.getByText('Retention digest')).toBeTruthy()
  })

  it('a write exactly 24 hours ago is inside the day window; one millisecond earlier is outside it', async () => {
    stub({ ok: true, threads: [titled('79000000-0000-4000-8000-0000000000e1', 'On the edge', at(24 * HOUR)), titled('79000000-0000-4000-8000-0000000000e2', 'Just past', at(24 * HOUR + 1))] })
    showAt()
    await screen.findByText('On the edge')
    choose('day')
    expect(screen.getByText('On the edge')).toBeTruthy()
    expect(screen.queryByText('Just past')).toBeNull()
    choose('week')
    expect(screen.getByText('Just past')).toBeTruthy()
  })

  it('a write exactly 7 days ago is inside the week window; one millisecond earlier is outside it', async () => {
    stub({ ok: true, threads: [titled('79000000-0000-4000-8000-0000000000e3', 'Week edge', at(7 * 24 * HOUR)), titled('79000000-0000-4000-8000-0000000000e4', 'Week past', at(7 * 24 * HOUR + 1))] })
    showAt()
    await screen.findByText('Week edge')
    choose('week')
    expect(screen.getByText('Week edge')).toBeTruthy()
    expect(screen.queryByText('Week past')).toBeNull()
    choose('all')
    expect(screen.getByText('Week past')).toBeTruthy()
  })

  it('the window is measured from the injected clock, not from the machine time the test runs at', async () => {
    // The same thread, two clocks: two hours after its write it is in the day window; three days after, it is not.
    stub({ ok: true, threads: [recent] })
    showAt(NOW + 70 * HOUR)
    await screen.findByText('Cutover plan')
    choose('day')
    expect(screen.queryByText('Cutover plan', { selector: '.lp-topic-title' })).toBeNull()
    choose('week')
    expect(screen.getByText('Cutover plan')).toBeTruthy()
  })

  it('an undated thread is not "old": no messages yet matches only all time', async () => {
    stub({ ok: true, threads: [recent, undated] })
    showAt()
    await screen.findByText('Cutover plan')
    expect(screen.getByText('Empty start')).toBeTruthy()
    choose('day')
    expect(screen.queryByText('Empty start')).toBeNull()
    choose('week')
    expect(screen.queryByText('Empty start')).toBeNull()
    expect(screen.getByText('Cutover plan')).toBeTruthy()
    choose('all')
    expect(screen.getByText('Empty start')).toBeTruthy()
  })

  it('a last write that does not parse is undated too: it matches only all time, never a window', async () => {
    stub({ ok: true, threads: [recent, garbled] })
    showAt()
    await screen.findByText('Garbled clock')
    choose('day')
    expect(screen.queryByText('Garbled clock')).toBeNull()
    choose('week')
    expect(screen.queryByText('Garbled clock')).toBeNull()
    choose('all')
    expect(screen.getByText('Garbled clock')).toBeTruthy()
  })

  it('combines with the other filters as AND', async () => {
    stub({ ok: true, threads: [recent, stale] })
    showAt()
    await screen.findByText('Cutover plan')
    // The only thread HOLDING a finding is the stale one, and it is outside the day window: nothing matches.
    fireEvent.change(screen.getByLabelText(en['launch.comms.filters.kind']), { target: { value: 'finding' } })
    choose('day')
    await screen.findByText(en['launch.comms.filters.noMatch'])
    choose('week')
    expect(screen.getByText('Retention digest')).toBeTruthy()
    expect(screen.queryByText('Cutover plan')).toBeNull()
  })

  it('clearing the filters puts the activity window back to all time', async () => {
    stub({ ok: true, threads: [stale, undated] })
    showAt()
    await screen.findByText('Retention digest')
    choose('day')
    await screen.findByText(en['launch.comms.filters.noMatch'])
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.filters.clear'] }))
    expect(activity().value).toBe('all')
    expect(screen.getByText('Retention digest')).toBeTruthy()
    expect(screen.getByText('Empty start')).toBeTruthy()
  })

  it('mark all read marks every thread of the board, the ones a filter hides included — it answers the rail count', async () => {
    const onRead = vi.fn()
    stub({ ok: true, threads: [recent, stale] })
    showAt(NOW, {}, onRead)
    await screen.findByText('Cutover plan')
    choose('day')
    expect(screen.queryByText('Retention digest')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['launch.comms.markAllRead'] }))
    await waitFor(() => expect(onRead).toHaveBeenCalledWith({ [recent.id]: recent.lastSeq, [stale.id]: stale.lastSeq }))
    expect(onRead).toHaveBeenCalledTimes(1)
  })

  it('mark all read is offered while a hidden thread is unread, even when every visible one is read', async () => {
    stub({ ok: true, threads: [recent, stale] })
    showAt(NOW, { [recent.id]: recent.lastSeq })
    await screen.findByText('Cutover plan')
    choose('day')
    expect(screen.queryByText(en['launch.comms.new'])).toBeNull()
    expect(screen.getByRole('button', { name: en['launch.comms.markAllRead'] })).toBeTruthy()
  })
})
