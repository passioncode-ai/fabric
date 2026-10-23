import { describe, expect, it } from 'vitest'
import { taskMoves } from './taskMoves'

const ev = (seq: number, type: string, payload: Record<string, unknown>, kind = 'agent') =>
  ({ estate_id: 'e', seq, type, actor: { kind, id: 'x' }, project_id: 'p1', occurred_at: `2026-10-2${seq}T10:00:00Z`, payload })

describe('taskMoves (SCN-174, CO-401)', () => {
  it('lists the moves newest first with from, to and who; other events and moves without a target are left out', () => {
    const moves = taskMoves([
      ev(1, 'task.created@1', { task_id: 't' }, 'person'),
      ev(2, 'task.moved@1', { task_id: 't', from: 'backlog', to: 'running' }),
      ev(3, 'task.moved@1', { task_id: 't', to: 'review' }, 'system'),
      ev(4, 'task.moved@1', { task_id: 't' }, 'person')
    ])
    expect(moves).toEqual([
      { seq: 3, at: '2026-10-23T10:00:00Z', from: null, to: 'review', by: 'system' },
      { seq: 2, at: '2026-10-22T10:00:00Z', from: 'backlog', to: 'running', by: 'agent' }
    ])
  })
})
