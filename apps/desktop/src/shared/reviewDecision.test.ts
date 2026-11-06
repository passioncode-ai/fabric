import { describe, expect, it } from 'vitest'
import { reviewAsk, reviewDecisionProblem } from './reviewDecision'

const ev = (seq: number, type: string, payload: Record<string, unknown>, kind = 'agent', id = 'a1') =>
  ({ estate_id: 'e', seq, type, actor: { kind, id }, project_id: 'p1', occurred_at: `2026-10-1${seq}T10:00:00Z`, payload })

describe('reviewAsk (SCN-179)', () => {
  it('a task in review says what its agent handed in: the note of the move to review, who and when', () => {
    const ask = reviewAsk('review', [
      ev(1, 'task.created@1', { id: 't' }),
      ev(2, 'work.released@1', { work: 't', how: 'done', note: 'Shipped in v0.6.28 (PR #186).' }),
      ev(3, 'task.moved@1', { task_id: 't', from: 'running', to: 'review', note: 'Released in v0.6.28; open: SB-116.' })
    ])
    expect(ask).toEqual({ said: 'Released in v0.6.28; open: SB-116.', by: 'agent', at: '2026-10-13T10:00:00Z' })
  })

  it('without a note on the move, the done release speaks; with neither, the ask still stands and says nothing was written', () => {
    expect(reviewAsk('review', [
      ev(2, 'work.released@1', { work: 't', how: 'done', note: 'Done: the fix and its test.' }),
      ev(3, 'task.moved@1', { task_id: 't', to: 'review' })
    ])).toEqual({ said: 'Done: the fix and its test.', by: 'agent', at: '2026-10-13T10:00:00Z' })
    expect(reviewAsk('review', [ev(3, 'task.moved@1', { task_id: 't', to: 'review' }, 'system')]))
      .toEqual({ said: null, by: 'system', at: '2026-10-13T10:00:00Z' })
  })

  it('the newest move to review counts: a task returned and handed in again shows the second hand-in, not the first', () => {
    const ask = reviewAsk('review', [
      ev(1, 'task.moved@1', { task_id: 't', to: 'review', note: 'first' }),
      ev(2, 'task.moved@1', { task_id: 't', from: 'review', to: 'running', note: 'Fix the test' }, 'person', 'op'),
      ev(3, 'work.released@1', { work: 't', how: 'done', note: 'second release' }),
      ev(4, 'task.moved@1', { task_id: 't', to: 'review' })
    ])
    expect(ask).toEqual({ said: 'second release', by: 'agent', at: '2026-10-14T10:00:00Z' })
  })

  it('a release that was not done does not speak for the hand-in', () => {
    expect(reviewAsk('review', [
      ev(2, 'work.released@1', { work: 't', how: 'let-go', note: 'gave up' }),
      ev(3, 'task.moved@1', { task_id: 't', to: 'review' })
    ])?.said).toBeNull()
  })

  it('a task not in review asks nothing', () => {
    for (const s of ['backlog', 'running', 'done', 'cancelled']) expect(reviewAsk(s, [ev(1, 'task.moved@1', { task_id: 't', to: 'review', note: 'x' })])).toBeNull()
  })
})

describe('reviewDecisionProblem', () => {
  it('returning or cancelling needs words for the agent; accepting does not', () => {
    expect(reviewDecisionProblem('accept', '')).toBeNull()
    expect(reviewDecisionProblem('return', '  ')).toBe('return-needs-comment')
    expect(reviewDecisionProblem('cancel', '')).toBe('cancel-needs-reason')
    expect(reviewDecisionProblem('return', 'Add the missing test')).toBeNull()
    expect(reviewDecisionProblem('nonsense' as never, 'x')).toBe('unknown-decision')
  })
})
