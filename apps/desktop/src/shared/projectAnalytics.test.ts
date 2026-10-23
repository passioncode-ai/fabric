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

describe('a read paged newest first past the gateway\'s 1000 rows (DA-4)', () => {
  const source = (n: number, cap = 1000) => {
    const calls: Array<[number, number]> = []
    const page = async (from: number, to: number) => {
      calls.push([from, to])
      const end = Math.min(to + 1, n, from + cap)
      return { data: Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i), error: null }
    }
    return { page, calls }
  }
  it('reads every row when they fit the bound, even when the gateway answers fewer than a page', async () => {
    const { page } = source(2500, 400)
    const r = await readNewestPaged(page, { maxRows: 5000 })
    expect(r.rows).toHaveLength(2500)
    expect(r.capped).toBe(false)
  })
  it('stops at the bound and says the read was capped only when more rows exist', async () => {
    const capped = await readNewestPaged(source(7000).page, { maxRows: 5000 })
    expect([capped.rows.length, capped.capped]).toEqual([5000, true])
    const exact = await readNewestPaged(source(5000).page, { maxRows: 5000 })
    expect([exact.rows.length, exact.capped]).toEqual([5000, false])
  })
  it('says a refused page, never a shorter list', async () => {
    const r = await readNewestPaged(async (from: number) => (from === 0 ? { data: [1], error: null } : { data: null, error: { message: 'refused' } }), { maxRows: 5000 })
    expect(r.failed).toBe('refused')
    expect(r.rows).toEqual([])
  })
})
