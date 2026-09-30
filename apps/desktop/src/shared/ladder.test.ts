// The ladder's contract (M146 step 4).
//
// Pure and therefore cheap, which matters: this table is asked on every card
// render AND on every IPC call, and it is the only thing standing between an
// agent and marking its own work done. A rule enforced in two places must be
// tested in neither of them — it must be tested where it lives.

import { describe, expect, it } from 'vitest'
import { LADDER, TERMINAL, mayMove, type TaskState } from './ladder.ts'

const ALL: TaskState[] = ['backlog', 'running', 'review', 'done', 'cancelled']

describe('the ladder', () => {
  it('lets an agent move work forward but never close it', () => {
    expect(mayMove('agent', 'running', 'review').ok).toBe(true)
    expect(mayMove('agent', 'running', 'done').ok).toBe(false)
    expect(mayMove('agent', 'review', 'done').ok).toBe(false)
    expect(mayMove('agent', 'backlog', 'cancelled').ok).toBe(false)
  })

  it('says WHY, in words the interface can show without inventing an explanation', () => {
    const verdict = mayMove('agent', 'review', 'done')
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) {
      expect(verdict.reason).toContain('review')
      expect(verdict.reason).toContain('operator')
    }
  })

  it('lets a person accept and cancel', () => {
    expect(mayMove('person', 'review', 'done').ok).toBe(true)
    expect(mayMove('person', 'running', 'cancelled').ok).toBe(true)
  })

  it('refuses every move out of a closed state, for everyone, and SAYS it is closed', () => {
    // Asserting `ok === false` alone was not enough, and finding that out cost
    // a planted defect that failed to fail. Remove the terminal branch and the
    // move is still refused — by the empty row in LADDER — but the sentence
    // becomes "done does not lead to running — from here a task goes to ",
    // trailing off into nothing. In a product whose refusals are read by a
    // person, the explanation IS the feature, so the test asserts the words.
    for (const from of TERMINAL)
      for (const to of ALL)
        for (const who of ['agent', 'person'] as const) {
          const verdict = mayMove(who, from, to)
          expect(verdict.ok).toBe(false)
          if (!verdict.ok && from !== to) expect(verdict.reason).toContain('closed state')
        }
  })

  it('refuses a move to where the task already is', () => {
    for (const state of ALL) expect(mayMove('person', state, state).ok).toBe(false)
  })

  it('names the legal destinations when a move is not one of them', () => {
    const verdict = mayMove('person', 'backlog', 'review')
    expect(verdict.ok).toBe(false)
    if (!verdict.ok) expect(verdict.reason).toContain('running')
  })

  it('every destination the table lists is reachable by SOMEONE — a row nobody can use is a rule nobody wrote', () => {
    for (const from of ALL)
      for (const to of LADDER[from])
        expect(
          mayMove('agent', from, to).ok || mayMove('person', from, to).ok
        ).toBe(true)
  })
})
