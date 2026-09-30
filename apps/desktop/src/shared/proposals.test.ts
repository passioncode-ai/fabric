import { describe, expect, it } from 'vitest'
import {
  CHECKER_VERSION,
  DECISIONS,
  REJECTION_CODES,
  checkProposalDecision,
  checkerUnavailable,
  type ProposalFacts
} from './proposals.ts'

const facts = (over: Partial<ProposalFacts['proposal']> = {}, rest: Partial<ProposalFacts> = {}): ProposalFacts => ({
  id: 'p1',
  proposal: { id: 'p1', project_id: 'proj1', title: 'wire the outbox', decided_at: null, decision: null, ...over },
  projectExists: true,
  ...rest
})
const check = (decision: unknown = 'accepted', f: ProposalFacts = facts()) =>
  checkProposalDecision({ facts: f, decision })

describe('one checker in front of every proposal write', () => {
  it('accepts a live proposal against a project that is still there', () => {
    const got = check()
    expect(got.ok).toBe(true)
    if (got.ok) expect(got.command).toMatchObject({ proposalId: 'p1', decision: 'accepted', projectId: 'proj1' })
  })

  it('refuses a decision string the compiler only checked on one side', () => {
    // The renderer declares this as a union, which its own build enforces and
    // the wire does not. Anything reaching the bridge can send any string.
    const got = check('whatever')
    expect(got.ok).toBe(false)
    if (!got.ok) {
      expect(got.reasonCode).toBe('unknown_decision')
      expect(got.fieldPath).toBe('decision')
    }
  })

  it('refuses a proposal whose PROJECT is gone', () => {
    // The gap the old path had: it read project_id and appended task.created@1
    // against it without asking whether the project still exists. A task in a
    // project nobody has is not visible anywhere.
    const got = check('accepted', facts({}, { projectExists: false }))
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reasonCode).toBe('project_missing')
  })

  it('refuses a second decision rather than overwriting the first', () => {
    const got = check('declined', facts({ decided_at: '2026-09-08T00:00:00Z', decision: 'accepted' }))
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.says).toMatch(/already accepted/)
  })

  it('answers a missing proposal the same way as one in another estate', () => {
    // Deliberately indistinguishable: a different answer would confirm that an
    // id exists somewhere, which is a probe.
    const got = check('accepted', facts({}, { proposal: null }))
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reasonCode).toBe('not_found')
  })
})

describe('a refusal is a receipt, not a thrown error', () => {
  it('carries a remedy on every refusal, because a wall is not an answer', () => {
    for (const d of ['nonsense', 'accepted']) {
      const got = checkProposalDecision({ facts: facts({}, { projectExists: false }), decision: d })
      expect(got.ok).toBe(false)
      if (!got.ok) expect(got.remedy.length).toBeGreaterThan(20)
    }
  })

  it('says which rules produced it, so an old receipt is not re-read as today', () => {
    const got = check('nonsense')
    if (!got.ok) expect(got.checkerVersion).toBe(CHECKER_VERSION)
  })

  it('separates "this will never work" from "try again"', () => {
    // Collapsing the two teaches people to retry what cannot work and to
    // abandon what would have worked next time.
    const decided = check('accepted', facts({ decided_at: '2026-09-08T00:00:00Z' }))
    if (!decided.ok) expect(decided.retryable).toBe(false)
    expect(checkerUnavailable('the database timed out').retryable).toBe(true)
  })

  it('fails CLOSED when the checker could not run, and says the draft survived', () => {
    const got = checkerUnavailable('the database timed out')
    expect(got.ok).toBe(false)
    expect(got.reasonCode).toBe('checker_unavailable')
    expect(got.remedy).toMatch(/draft is intact/i)
  })

  it('enumerates the reason codes, so a surface can act on the class', () => {
    expect(REJECTION_CODES).toContain('checker_unavailable')
    expect(DECISIONS).toEqual(['accepted', 'declined'])
  })
})

describe('what the decision was made against', () => {
  it('carries the input revisions, so a change before commit is superseded rather than overwritten', () => {
    const got = check()
    if (got.ok) expect(got.inputRevisions).toMatchObject({ decided_at: null, project_id: 'proj1' })
  })
})
