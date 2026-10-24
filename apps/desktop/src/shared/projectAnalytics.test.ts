import { describe, expect, it } from 'vitest'
import { projectAnalytics, readNewestPaged } from './projectAnalytics'

const now = Date.parse('2026-10-23T12:00:00Z')
const at = (daysAgo: number, hours = 0) => new Date(now - daysAgo * 86_400_000 + hours * 3_600_000).toISOString()

describe('how work goes in a project, from the journal (OF-39)', () => {
  it('counts tasks done per week, oldest week first, and the medians of lead time and review time', () => {
    const a = projectAnalytics({
      moves: [
        { taskId: 't1', from: 'running', to: 'review', at: at(2) },
        { taskId: 't1', from: 'review', to: 'done', at: at(2, 4) },
        { taskId: 't2', from: 'running', to: 'done', at: at(20) },
        { taskId: 'old', from: 'running', to: 'done', at: at(90) }
      ],
      createdAt: new Map([['t1', at(3)], ['t2', at(21)]]),
      openQuestions: [],
      now
    })
    expect(a.donePerWeek).toHaveLength(8)
    expect(a.donePerWeek[7]).toBe(1)
    expect(a.donePerWeek[5]).toBe(1)
    expect(a.donePerWeek.reduce((s, x) => s + x, 0)).toBe(2)
    expect(a.leadHours).toBe((28 + 24) / 2)
    expect(a.reviewHours).toBe(4)
  })

  it('names the share of reviewed tasks sent back to work, and the questions waiting with the oldest', () => {
    const a = projectAnalytics({
      moves: [
        { taskId: 'a', from: 'running', to: 'review', at: at(5) },
        { taskId: 'a', from: 'review', to: 'running', at: at(4) },
        { taskId: 'b', from: 'running', to: 'review', at: at(3) }
      ],
      createdAt: new Map(),
      openQuestions: [{ askedAt: at(1) }, { askedAt: at(6) }],
      now
    })
    expect(a.reopenedShare).toBe(0.5)
    expect(a.questionsWaiting).toBe(2)
    expect(a.oldestQuestionAt).toBe(at(6))
  })

  it('says nothing it cannot know: no done task, no review, no question', () => {
    const a = projectAnalytics({ moves: [], createdAt: new Map(), openQuestions: [], now })
    expect([a.leadHours, a.reviewHours, a.reopenedShare, a.oldestQuestionAt]).toEqual([null, null, null, null])
    expect(a.donePerWeek).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('counts a task the person closed as done, with its lead time and its time in review (DA-1)', () => {
    // The only way a task reaches done in this build: the person's close, journaled as task.closed@1 (main/index.ts,
    // tasks.close). An agent moves it to review; no task.moved@1 ever names done.
    const a = projectAnalytics({
      moves: [
        { taskId: 't1', from: 'queued', to: 'running', at: at(4) },
        { taskId: 't1', from: 'running', to: 'review', at: at(3) }
      ],
      closes: [
        { taskId: 't1', outcome: 'done', at: at(2) },
        { taskId: 't2', outcome: 'cancelled', at: at(1) }
      ],
      createdAt: new Map([['t1', at(5)], ['t2', at(5)]]),
      openQuestions: [],
      now
    })
    expect(a.donePerWeek.reduce((s, x) => s + x, 0)).toBe(1)
    expect(a.donePerWeek[7]).toBe(1)
    expect(a.leadHours).toBe(72)
    expect(a.reviewHours).toBe(24)
  })

  it('counts the open questions past the read\'s bound, and says when the journal read was capped (DA-4)', () => {
    const a = projectAnalytics({ moves: [], createdAt: new Map(), openQuestions: [{ askedAt: at(9) }], questionCount: 1500, capped: true, now })
    expect(a.questionsWaiting).toBe(1500)
    expect(a.capped).toBe(true)
    expect(projectAnalytics({ moves: [], createdAt: new Map(), openQuestions: [], now }).capped).toBe(false)
  })
})

describe('a read paged newest first past the gateway\'s 1000 rows (DA-4), by keyset (0.3.12 review i2 ER-5, DA-3)', () => {
  // A journal of `n` rows numbered 1..n by seq, read newest first; `grow` appends rows after a page is answered.
  const source = (n: number, cap = 1000, grow: (call: number) => number = () => 0) => {
    let top = n
    const calls: Array<[number | null, number]> = []
    const page = async (before: number | null, limit: number) => {
      calls.push([before, limit])
      const below = before === null ? top : Math.min(before - 1, top)
      const take = Math.min(limit, cap, below)
      const data = Array.from({ length: Math.max(0, take) }, (_, i) => ({ seq: below - i }))
      top += grow(calls.length)
      return { data, error: null }
    }
    return { page, calls }
  }
  const key = (r: { seq: number }) => r.seq
  it('reads every row when they fit the bound, even when the gateway answers fewer than a page', async () => {
    const { page } = source(2500, 400)
    const r = await readNewestPaged(page, { maxRows: 5000, key })
    expect(r.rows).toHaveLength(2500)
    expect(r.capped).toBe(false)
  })
  it('stops at the bound and says the read was capped only when more rows exist', async () => {
    const capped = await readNewestPaged(source(7000).page, { maxRows: 5000, key })
    expect([capped.rows.length, capped.capped]).toEqual([5000, true])
    const exact = await readNewestPaged(source(5000).page, { maxRows: 5000, key })
    expect([exact.rows.length, exact.capped]).toEqual([5000, false])
  })
  it('says a refused page, never a shorter list', async () => {
    const r = await readNewestPaged(async (before: number | null) => (before === null ? { data: [{ seq: 9 }], error: null } : { data: null, error: { message: 'refused' } }), { maxRows: 5000, key })
    expect(r.failed).toBe('refused')
    expect(r.rows).toEqual([])
  })
  it('a row appended between two pages is neither read twice nor pushes another out (probe 3 of the review)', async () => {
    // 1 500 closes; one new journal row lands at the top after the first page is answered.
    const { page, calls } = source(1500, 1000, (call) => (call === 1 ? 1 : 0))
    const r = await readNewestPaged(page, { maxRows: 5000, key })
    const seqs = r.rows.map((x) => x.seq)
    expect(new Set(seqs).size).toBe(seqs.length)
    expect(seqs).toHaveLength(1500)
    expect(Math.min(...seqs)).toBe(1)
    expect(calls[1][0]).toBe(501)
    const done = projectAnalytics({ moves: [], closes: r.rows.map((x) => ({ taskId: `t${x.seq}`, outcome: 'done', at: '2026-10-20T00:00:00Z' })), createdAt: new Map(), openQuestions: [], now: Date.parse('2026-10-24T00:00:00Z') })
    expect(done.donePerWeek.reduce((a, b) => a + b, 0)).toBe(1500)
  })
  it('a source that ignores the cursor is a failure, never a loop or a double count', async () => {
    const r = await readNewestPaged(async () => ({ data: [{ seq: 3 }, { seq: 2 }], error: null }), { maxRows: 5000, key })
    expect(r.failed).toMatch(/did not move past 2/)
  })
})
