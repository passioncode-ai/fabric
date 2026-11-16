import { describe, expect, it } from 'vitest'
import { turnChanged, turnVerdict, type HeldTask, type TurnFacts } from './turnVerdict'

const NOW = Date.parse('2026-11-16T22:00:00Z')
const held = (over: Partial<HeldTask> = {}): HeldTask => ({ taskId: 't1', title: 'Ship the verdict', status: 'running', expiresAt: '2026-11-16T22:30:00Z', ...over })
const turn = (files: number | null, added: number | null = 0, head: string | null = 'a'.repeat(40)): TurnFacts => ({ head, filesChanged: files, linesAdded: added, linesRemoved: 0 })

describe('turnChanged', () => {
  it('a first turn has nothing to compare and counts as a change', () => expect(turnChanged(turn(0), undefined)).toBe(true))
  it('a new HEAD is a change, the same counts on the same HEAD are not', () => {
    expect(turnChanged(turn(0, 0, 'b'.repeat(40)), turn(0))).toBe(true)
    expect(turnChanged(turn(2, 5), turn(2, 5))).toBe(false)
  })
  it('other counts are a change; an unknown fact on either side is not', () => {
    expect(turnChanged(turn(3, 5), turn(2, 5))).toBe(true)
    expect(turnChanged(turn(null, null, null), turn(2, 5))).toBe(false)
  })
})

describe('turnVerdict', () => {
  it('a held open task, no wait and a changing turn: continue, naming the task', () => {
    const v = turnVerdict([held()], false, [turn(2), turn(1)], NOW)
    expect(v).toMatchObject({ next: 'continue', task_id: 't1' })
    expect(v?.reason).toContain('«Ship the verdict»')
  })
  it('a declared wait stops it', () => expect(turnVerdict([held()], true, [turn(2), turn(1)], NOW)).toBeNull())
  it('no claim, a lapsed claim or a task no longer open stops it', () => {
    expect(turnVerdict([], false, [turn(2), turn(1)], NOW)).toBeNull()
    expect(turnVerdict([held({ expiresAt: '2026-11-16T21:59:00Z' })], false, [turn(2), turn(1)], NOW)).toBeNull()
    for (const status of ['review', 'done', 'cancelled']) expect(turnVerdict([held({ status })], false, [turn(2), turn(1)], NOW)).toBeNull()
  })
  it('one quiet turn after a change still goes on; two quiet turns in a row stop the loop', () => {
    expect(turnVerdict([held()], false, [turn(2), turn(2), turn(1)], NOW)).not.toBeNull()
    expect(turnVerdict([held()], false, [turn(2), turn(2), turn(2)], NOW)).toBeNull()
  })
  it('no recorded turn: nothing to judge', () => expect(turnVerdict([held()], false, [], NOW)).toBeNull())
  it('of several held tasks it names the one held longest ahead', () => {
    const v = turnVerdict([held({ taskId: 'a', expiresAt: '2026-11-16T22:10:00Z' }), held({ taskId: 'b', expiresAt: '2026-11-16T23:00:00Z' })], false, [turn(1)], NOW)
    expect(v?.task_id).toBe('b')
  })
})
