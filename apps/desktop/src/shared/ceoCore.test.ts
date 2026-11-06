// M166's failure tests (docs/audit/2026-09-09-final/packets/M166.md, failure_tests), first slice for CO-522 wave D.
import { describe, expect, it } from 'vitest'
import { planCeoCore, type CoreSnapshot } from './ceoCore.ts'
import { attentionOf } from './attention.ts'
import type { BoardQuestion } from './board.ts'

const NOW = '2026-11-06T12:00:00.000Z'
const daysAgo = (n: number): string => new Date(Date.parse(NOW) - n * 86_400_000).toISOString()

const question = (id: string, over: Partial<BoardQuestion> = {}): BoardQuestion => ({
  id,
  projectId: 'p1',
  projectName: 'atlas',
  text: `question ${id}`,
  kind: 'decision',
  askedAt: daysAgo(1),
  blocks: 0,
  servesActiveGoal: false,
  revision: 1,
  options: [],
  ...over
})

// Built by the producer, as board.test.ts insists: a hand-written item can carry a ref attentionOf never emits.
const attention = attentionOf({
  reviews: [
    { id: 't1', project_id: 'p1', title: 'wire the outbox', instruction: 'x', started_at: daysAgo(5), moved_at: daysAgo(2) },
    { id: 't2', project_id: 'p2', title: 'write the docs', instruction: 'x', started_at: daysAgo(3), moved_at: daysAgo(3) }
  ],
  expired: [],
  refusals: [],
  proposals: [],
  names: {}
})

const snapshot = (over: Partial<CoreSnapshot> = {}): CoreSnapshot => ({
  scope: { estateId: 'e1', projectId: null },
  cursor: 42,
  now: NOW,
  policyRevision: 'r7',
  trust: { estate: 'cited', projectOverride: null },
  questions: [question('q1', { blocks: 2 }), question('q2', { projectId: 'p2' }), question('q3', { askedAt: daysAgo(4) })],
  attention,
  projectSignals: {
    p1: { tier: 'active', blockedTasks: 2, daysSinceOldestOpenQuestion: 1, goalDueWithinWeek: false, ranInLast24h: true }
  },
  digest: {
    input: { decisions: [{ id: 'f1', claim: 'Postgres 17', recorded_at: daysAgo(1), seq: 40 }], corrections: [], reviews: [], sessions: [] },
    sinceSeq: 30,
    boundary: 42
  },
  sources: { questions: 'read', attention: 'read', digest: 'read', facts: 'read' },
  advisor: null,
  ...over
})

const order = (s: CoreSnapshot) => planCeoCore(s).rankedItems.map((e) => [e.ref, e.priority, e.components])

describe('the CEO core is deterministic (M166)', () => {
  it('gives the same ordered plan, components included, for the same rows in another order', () => {
    const a = snapshot()
    const b = snapshot({ questions: [...a.questions].reverse(), attention: [...a.attention].reverse() })
    expect(order(b)).toEqual(order(a))
    expect(planCeoCore(a)).toEqual(planCeoCore(a))
  })

  it('ranks on one scale and says which project it could not weigh', () => {
    const plan = planCeoCore(snapshot())
    expect(plan.rankedItems[0].title).toBe('question q1') // blocking two tasks, in the weighed project
    expect(plan.unweighedProjects).toEqual(['p2'])
    expect(plan.policyRevision).toBe('r7')
  })
})

describe('trust in effect is the estate clamp, and ask settles nothing', () => {
  it('estate ask with a project proposing is ask, and settlement is unavailable for that reason', () => {
    const plan = planCeoCore(snapshot({ trust: { estate: 'ask', projectOverride: 'proposing' } }))
    expect(plan.trust.effective).toBe('ask')
    expect(plan.settlementCandidates).toEqual([])
    expect(plan.unavailable).toContainEqual({ capability: 'settlement', because: 'trust-ask' })
  })

  it('an unknown trust value fails closed to ask', () => {
    const plan = planCeoCore(snapshot({ trust: { estate: 'everything' as never, projectOverride: null } }))
    expect(plan.trust.effective).toBe('ask')
  })
})

describe('without a model the core still works, and says what it cannot do', () => {
  it('ranks and digests, lists advice as not configured, and writes no advice', () => {
    const plan = planCeoCore(snapshot({ advisor: null }))
    expect(plan.rankedItems.length).toBe(5)
    expect(plan.digest).toEqual(expect.objectContaining({ state: 'lines' }))
    expect(plan.unavailable).toContainEqual({ capability: 'advice', because: 'not-configured' })
    expect(Object.keys(plan)).not.toContain('advice')
  })

  it('names hygiene and settlement as not built yet instead of returning an empty list that reads as nothing to do', () => {
    const plan = planCeoCore(snapshot({ advisor: 'configured' }))
    expect(plan.unavailable).toEqual([
      { capability: 'hygiene', because: 'not-built', waitsOn: 'M153' },
      { capability: 'settlement', because: 'not-built', waitsOn: 'M158' }
    ])
  })
})

describe('a failed read is said, and the rest still stands', () => {
  it('a failed fact read disables settlement as source-unknown while ranking stays', () => {
    const plan = planCeoCore(snapshot({ sources: { questions: 'read', attention: 'read', digest: 'read', facts: 'failed' } }))
    expect(plan.unavailable).toContainEqual({ capability: 'settlement', because: 'source-unknown', source: 'facts' })
    expect(plan.rankedItems.length).toBe(5)
  })

  it('a failed question read ranks the obligations alone and names the missing source', () => {
    const plan = planCeoCore(snapshot({ sources: { questions: 'failed', attention: 'read', digest: 'read', facts: 'read' } }))
    expect(plan.rankedItems.map((e) => e.kind)).toEqual(['review', 'review'])
    expect(plan.unavailable).toContainEqual({ capability: 'ranking', because: 'source-unknown', source: 'questions' })
  })

  it('a failed digest read is null, never a quiet day', () => {
    const plan = planCeoCore(snapshot({ sources: { questions: 'read', attention: 'read', digest: 'failed', facts: 'read' } }))
    expect(plan.digest).toBeNull()
    expect(plan.unavailable).toContainEqual({ capability: 'digest', because: 'source-unknown', source: 'digest' })
  })
})
