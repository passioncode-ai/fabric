import { describe, expect, it } from 'vitest'
import { memoryChoice } from './memoryChoice.ts'
import type { MemoryBackendOption } from './types.ts'

const local: MemoryBackendOption = { id: 'local', available: true, reason: null }
const cloud: MemoryBackendOption = { id: 'cloud', available: false, reason: 'hosted-estates-not-built' }

describe('what the operator is shown about where memory lives', () => {
  it('an unavailable backend IS shown, with its reason', () => {
    // M99 removed it, and the operator overturned that on 2026-09-05: a
    // roadmap the product states out loud is worth more than the cost of a
    // radio nobody can press. Recorded here rather than in a comment nobody
    // reads, because the removal had a test and the restoration needs one too.
    const c = memoryChoice([local, cloud])
    expect(c.shown.map((b) => b.id)).toEqual(['local', 'cloud'])
    expect(c.shown.find((b) => b.id === 'cloud')?.reason).toBe('hosted-estates-not-built')
  })

  it('more than one declared backend is a radiogroup, whatever their availability', () => {
    expect(memoryChoice([local, cloud]).kind).toBe('choice')
  })

  it('a SINGLE declared backend is a statement — there is nothing to choose between', () => {
    // The half of M99 that survives: a radiogroup of one is not a choice. It
    // just never happens while a second backend is declared.
    expect(memoryChoice([local]).kind).toBe('statement')
  })

  it('NO available backend says so rather than rendering an unusable form', () => {
    const c = memoryChoice([{ ...local, available: false, reason: 'no-database' }, cloud])
    expect(c.kind).toBe('none')
    // The unavailable ones are still shown: they are what EXPLAINS the refusal.
    expect(c.shown.length).toBe(2)
  })

  it('and an empty list is "not read yet", not "nothing available"', () => {
    // The list arrives over IPC. Rendering "no memory backend" while the answer
    // is still in flight is the M108 defect in a new place.
    expect(memoryChoice([]).kind).toBe('unread')
    expect(memoryChoice(null).kind).toBe('unread')
  })

  it('a backend can only be PICKED when it is available', () => {
    expect(memoryChoice([local, cloud]).selectable.map((b) => b.id)).toEqual(['local'])
  })
})
