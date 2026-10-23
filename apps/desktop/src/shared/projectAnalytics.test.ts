import { describe, expect, it } from 'vitest'
import { projectAnalytics } from './projectAnalytics'

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
})
