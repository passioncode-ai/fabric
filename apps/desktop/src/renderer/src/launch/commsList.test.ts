// SCN-143's wave-4 amendment (W4-3): the thread list is a bounded page, newest activity first, its filters read by the
// board. These are the list's pure rules — the filter the board is asked, how a polled first page and an older page
// merge into what the screen holds, the 200-thread bound, and the rail's count from the heads.
import { describe, expect, it } from 'vitest'
import type { CommsPageThread } from '../../../shared/commsRead'
import { ALL_THREADS, MAX_HELD, appendOlder, boardFilterOf, cursorOf, mergeFirstPage, unreadOf } from './commsList'

const row = (n: number, lastSeq = n): CommsPageThread => ({
  id: `79000000-0000-4000-8000-${String(n).padStart(12, '0')}`, subject: `t${n}`, participants: ['p1'], createdBy: 'p1', createdSeq: 1,
  messageCount: 1, lastSeq, lastAt: '2026-10-13T08:00:00.000Z', kinds: ['message'], openRequests: 0, providers: []
})
const ids = (rows: CommsPageThread[]) => rows.map((r) => r.subject)

describe('the filter the board is asked', () => {
  const NOW = Date.parse('2026-10-13T12:00:00.000Z')
  it('is empty at the widest, and each choice becomes one member', () => {
    expect(boardFilterOf(ALL_THREADS, NOW)).toEqual({})
    expect(boardFilterOf({ ...ALL_THREADS, project: 'p1', kind: 'finding', openOnly: true, provider: 'codex' }, NOW)).toEqual({ project: 'p1', kind: 'finding', openOnly: true, provider: 'codex' })
  })
  it('turns an activity window into the instant it starts, measured from the given clock, inclusive', () => {
    expect(boardFilterOf({ ...ALL_THREADS, activity: 'day' }, NOW)).toEqual({ activeSince: '2026-10-12T12:00:00.000Z' })
    expect(boardFilterOf({ ...ALL_THREADS, activity: 'week' }, NOW)).toEqual({ activeSince: '2026-10-06T12:00:00.000Z' })
  })
})

describe('what the screen holds', () => {
  it('a first page that holds everything is the whole list, and nothing older is offered', () => {
    expect(mergeFirstPage(null, { threads: [row(3), row(2)], more: false })).toEqual({ rows: [row(3), row(2)], more: false })
  })
  it('a polled first page replaces its own window and keeps the older pages already read; a thread that moved up is held once', () => {
    const held = [row(9), row(8), row(7), row(6), row(5), row(4)]
    // Thread 5 got a new message (seq 20) and leads now; 9 and 8 were pushed down; the page holds three.
    const merged = mergeFirstPage({ rows: held, more: true }, { threads: [row(5, 20), row(9), row(8)], more: true })
    expect(ids(merged.rows)).toEqual(['t5', 't9', 't8', 't7', 't6', 't4'])
    expect(merged.more).toBe(true)
  })
  it('a thread inside the first page\'s window that the board no longer returns is dropped (it no longer matches)', () => {
    const merged = mergeFirstPage({ rows: [row(9), row(8), row(7), row(2)], more: false }, { threads: [row(9), row(7)], more: true })
    expect(ids(merged.rows)).toEqual(['t9', 't7', 't2'])
  })
  it('an older page appends below, by the same order, without a thread twice', () => {
    const next = appendOlder({ rows: [row(9), row(8)], more: true }, { threads: [row(8), row(7), row(6)], more: false })
    expect(ids(next.rows)).toEqual(['t9', 't8', 't7', 't6'])
    expect(next.more).toBe(false)
  })
  it('holds at most 200 threads: past the bound the oldest go, and the board still has older ones', () => {
    const many = Array.from({ length: 190 }, (_, i) => row(1000 - i))
    const next = appendOlder({ rows: many, more: true }, { threads: Array.from({ length: 50 }, (_, i) => row(500 - i)), more: true })
    expect(next.rows).toHaveLength(MAX_HELD)
    expect(next.rows.at(-1)?.lastSeq).toBe(491)
    expect(next.more).toBe(true)
    const polled = mergeFirstPage(next, { threads: Array.from({ length: 50 }, (_, i) => row(5000 - i)), more: true })
    expect(polled.rows).toHaveLength(MAX_HELD)
    expect(polled.rows[0].lastSeq).toBe(5000)
    expect(polled.more).toBe(true)
  })
  it('names the next page by the oldest thread it holds', () => {
    expect(cursorOf([row(9), row(4)])).toEqual({ lastSeq: 4, id: row(4).id })
    expect(cursorOf([])).toBeNull()
  })
})

describe('the rail\'s count, from the heads', () => {
  it('counts threads newer than the mark, and says "at least" when the board cut the heads', () => {
    const heads = [{ id: 'a', lastSeq: 5 }, { id: 'b', lastSeq: 3 }, { id: 'c', lastSeq: 1 }]
    expect(unreadOf({ heads, truncated: false }, { a: 5, b: 3 })).toEqual({ count: 1, atLeast: false })
    expect(unreadOf({ heads, truncated: true }, {})).toEqual({ count: 3, atLeast: true })
    expect(unreadOf(null, {})).toBeNull()
  })
})
