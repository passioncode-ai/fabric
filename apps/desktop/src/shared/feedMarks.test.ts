import { describe, expect, it } from 'vitest'
import { NO_MARKS, advance, familyOf, markOf } from './feedMarks.ts'

const ev = (seq: number, type: string): { seq: number; type: string } => ({ seq, type })

describe('a family is what the event type says before the dot', () => {
  it('reads the family off the type', () => {
    expect(familyOf('agent.heartbeat@1')).toBe('agent')
    expect(familyOf('task.moved@1')).toBe('task')
    expect(familyOf('project.repo.attached@1')).toBe('project')
  })

  it('treats a type with no dot as its own family rather than dropping it', () => {
    // Nothing in the vocabulary looks like this today. A reader that silently
    // ignored one would stop refreshing for an event nobody noticed adding.
    expect(familyOf('heartbeat')).toBe('heartbeat')
  })
})

describe('what a batch of events moves', () => {
  it('moves the family it belongs to, and the journal mark', () => {
    const m = advance(NO_MARKS, [ev(7, 'task.created@1')])
    expect(m.all).toBe(7)
    expect(markOf(m, ['task'])).toBe(7)
  })

  it('leaves a family the batch never mentioned at zero', () => {
    // The whole point: a heartbeat must not move the task mark.
    const m = advance(NO_MARKS, [ev(9, 'agent.heartbeat@1')])
    expect(markOf(m, ['agent'])).toBe(9)
    expect(markOf(m, ['task'])).toBe(0)
    expect(m.all).toBe(9)
  })

  it('returns the SAME record when the batch is empty', () => {
    // A React dependency compares by value, so a new object with identical
    // numbers wakes every reader anyway. The identity is the saving.
    const m = advance(NO_MARKS, [ev(3, 'task.created@1')])
    expect(advance(m, [])).toBe(m)
  })

  it('never moves a mark backwards, whatever order the batch arrives in', () => {
    const m = advance(NO_MARKS, [ev(10, 'task.moved@1'), ev(4, 'task.created@1')])
    expect(markOf(m, ['task'])).toBe(10)
    expect(m.all).toBe(10)
  })

  it('accumulates across batches rather than starting again', () => {
    let m = advance(NO_MARKS, [ev(1, 'task.created@1')])
    m = advance(m, [ev(2, 'memory.retrieved@1')])
    expect(markOf(m, ['task'])).toBe(1)
    expect(markOf(m, ['memory'])).toBe(2)
    expect(m.all).toBe(2)
  })
})

describe('what a reader follows', () => {
  const m = advance(NO_MARKS, [
    ev(1, 'task.created@1'),
    ev(2, 'agent.heartbeat@1'),
    ev(3, 'memory.project.recorded@1')
  ])

  it('is the newest of the families it names', () => {
    expect(markOf(m, ['task', 'memory'])).toBe(3)
    expect(markOf(m, ['task'])).toBe(1)
  })

  it('is EVERYTHING when it names nothing', () => {
    // A reader that has not been narrowed must behave as it did. Defaulting the
    // other way would freeze it at zero and it would never refresh at all —
    // refreshing too often costs work, refreshing never costs the truth.
    expect(markOf(m, [])).toBe(m.all)
    expect(markOf(NO_MARKS, [])).toBe(0)
  })

  it('is zero for a family nothing has ever touched, not undefined', () => {
    expect(markOf(m, ['nothing-like-this'])).toBe(0)
  })

  it('does not move when an unrelated family does', () => {
    const later = advance(m, [ev(50, 'agent.heartbeat@1')])
    expect(markOf(later, ['task', 'memory'])).toBe(markOf(m, ['task', 'memory']))
    // And the readers that DO span everything still see it move, which is why
    // narrowing has to be opt-in per reader.
    expect(later.all).toBe(50)
  })

  it('moves for every family a reader named, not only the first', () => {
    const board = ['task', 'work', 'question', 'goal']
    const before = markOf(m, board)
    for (const family of board) {
      const after = advance(m, [ev(99, family + '.something@1')])
      expect(markOf(after, board)).toBe(99)
    }
    expect(before).toBe(1)
  })
})
