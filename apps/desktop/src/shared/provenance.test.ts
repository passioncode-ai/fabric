import { describe, expect, it } from 'vitest'
import { describeMove } from './provenance.ts'

describe('who moved the card, and when that changes what the column says', () => {
  it('says nothing about a task that has never moved', () => {
    // Null is "never moved". Rendering "moved by nobody" would be a claim.
    expect(describeMove('backlog', null)).toBeNull()
    expect(describeMove('review', undefined)).toBeNull()
  })

  it('distinguishes the two meanings of REVIEW', () => {
    // The assertion with teeth. Collapsed into one sentence — "moved to review"
    // — the board loses the difference between an agent saying it is done and a
    // person saying come back to this, which is the difference the whole ladder
    // exists to keep.
    const byAgent = describeMove('review', 'agent')
    const byPerson = describeMove('review', 'person')
    expect(byAgent?.key).not.toBe(byPerson?.key)
    expect(byAgent?.key).toBe('move.reviewByAgent')
    expect(byPerson?.key).toBe('move.reviewByPerson')
  })

  it('SHOWS a terminal state an agent reached, rather than normalising it', () => {
    // `ladder.ts` refuses this in two places and the tool's schema cannot even
    // phrase it. If the journal carries it anyway, something we believe is
    // wrong — and the display is the last place that can be hidden.
    for (const s of ['done', 'cancelled'] as const) {
      const note = describeMove(s, 'agent')
      expect(note?.contradiction).toBe(true)
      expect(note?.tone).toBe('warn')
    }
  })

  it('says nothing when a person closed it — which is the only way it happens', () => {
    // The silence is what makes the warning above loud.
    expect(describeMove('done', 'person')).toBeNull()
    expect(describeMove('cancelled', 'person')).toBeNull()
  })

  it('says nothing for backlog or running, where the lease already says it', () => {
    for (const s of ['backlog', 'running'] as const)
      for (const k of ['person', 'agent'] as const) expect(describeMove(s, k)).toBeNull()
  })
})
