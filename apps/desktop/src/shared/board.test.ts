import { describe, expect, it } from 'vitest'
import { boardEntries, cutBoard, scopeBoard, type BoardQuestion } from './board.ts'
import { attentionOf, type AttentionItem } from './attention.ts'

const now = new Date('2026-09-08T12:00:00Z')
const daysAgo = (n: number): string => new Date(now.getTime() - n * 86_400_000).toISOString()

const question = (over: Partial<BoardQuestion> = {}): BoardQuestion => ({
  id: '11111111-0000-0000-0000-000000000001',
  projectId: 'p1',
  projectName: 'atlas',
  text: 'which database version?',
  kind: 'decision',
  askedAt: daysAgo(1),
  blocks: 0,
  servesActiveGoal: false,
  revision: 1,
  options: [],
  ...over
})

const review = (over: Partial<AttentionItem> = {}): AttentionItem => ({
  kind: 'review',
  ref: { kind: 'task', id: 'task-1' },
  projectId: 'p1',
  projectName: 'atlas',
  title: 'wire the outbox',
  detail: null,
  since: daysAgo(2),
  ...over
})

const weights = { p1: 10, p2: 0 } as Record<string, number>
const build = (q: BoardQuestion[], a: AttentionItem[]) =>
  boardEntries({ questions: q, attention: a, projectWeightOf: (id) => (id ? (weights[id] ?? 0) : 0), now })

describe('the board is one ranked list of two different things', () => {
  it('carries an authored question and a derived obligation in the same list', () => {
    const items = build([question()], [review()])
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.origin).sort()).toEqual(['authored', 'derived'])
  })

  it('gives every entry a canonical ref that addresses exactly one thing', () => {
    const items = build([question()], [review()])
    expect(items.find((i) => i.origin === 'authored')?.ref).toBe(
      'question/question:11111111-0000-0000-0000-000000000001'
    )
    expect(items.find((i) => i.origin === 'derived')?.ref).toBe('review/task:task-1')
  })

  it('puts a BLOCKING question above a review, because one of them costs money hourly', () => {
    const items = build([question({ blocks: 2 })], [review()])
    expect(items[0].origin).toBe('authored')
  })

  it('does not let a hobby project outrank a paying one on kind alone', () => {
    const items = build(
      [question({ id: 'aaaa', projectId: 'p2', projectName: 'hobby' })],
      [review({ ref: { kind: 'task', id: 'task-2' }, projectId: 'p1' })]
    )
    // The review is worth less by kind and more by project weight; the point is
    // that the weight participates at all.
    expect(items[0].projectId).toBe('p1')
  })

  it('orders the same input the same way every time', () => {
    const a = build([question({ id: 'b' }), question({ id: 'a' })], [review()])
    const b = build([question({ id: 'a' }), question({ id: 'b' })], [review()])
    expect(a.map((i) => i.ref)).toEqual(b.map((i) => i.ref))
  })

  it('has no notion of dismissing or marking read', () => {
    // A queue you can mark as read is a queue that lies, and the lie is worst
    // exactly when the list is long (`attention.ts`). The absence is the design.
    const [item] = build([question()], [])
    expect(Object.keys(item)).not.toContain('seen')
    expect(Object.keys(item)).not.toContain('dismissed')
  })
})

describe('the ref is what the producer actually emits', () => {
  // THE TEST THAT WAS MISSING. Every fixture above is hand-written, and the
  // board's ref was wrong for four of five kinds for as long as that was true:
  // `boardEntries` computed `${kind}:${item.id}` over ids that `attentionOf`
  // had ALREADY prefixed, so the Board's refs read `review:review:t1` while
  // this file's fixture — `id: 'task-1'` — produced the documented shape and
  // agreed with the comment. A fixture the producer cannot emit tests nothing.
  const fromProducer = attentionOf({
    names: { p1: 'atlas' },
    reviews: [{ id: 't1', project_id: 'p1', title: 'a', instruction: 'x', started_at: daysAgo(1) }],
    expired: [
      { work_id: 'w1', project_id: 'p1', owner_session: 's', expires_at: daysAgo(2), title: null, is_task: false }
    ],
    refusals: [
      { seq: 7, project_id: 'p1', floor_class: 'deletion', target: '/x', reason: 'r', occurred_at: daysAgo(3) }
    ],
    proposals: [{ id: 'pr1', project_id: 'p1', title: 'p', depth: 1, bound: 2, created_at: daysAgo(4) }]
  })

  it('never prefixes a ref twice', () => {
    for (const entry of build([], fromProducer))
      expect(entry.ref.split(':').length).toBe(2)
  })

  it('addresses each obligation exactly once', () => {
    const refs = build([question()], fromProducer).map((e) => e.ref)
    expect(new Set(refs).size).toBe(refs.length)
    expect(refs).toContain('review/task:t1')
    expect(refs).toContain('refused/refusal:7')
    expect(refs).toContain('proposal/proposal:pr1')
    expect(refs).toContain('abandoned/work:w1')
  })

  it('carries the subject unparsed, so no surface has to slice the string', () => {
    const entry = build([], fromProducer).find((e) => e.kind === 'review')
    expect(entry?.subject).toEqual({ kind: 'task', id: 't1' })
  })
})

describe('the cut says what it hid', () => {
  const many = Array.from({ length: 11 }, (_, i) =>
    question({ id: `q${i}`, blocks: i, askedAt: daysAgo(i) })
  )

  it('returns the top N and the exact total', () => {
    const c = cutBoard(build(many, []), 5)
    expect(c.items).toHaveLength(5)
    expect(c.total).toBe(11)
    expect(c.hidden).toBe(6)
  })

  it('hides nothing when everything fits', () => {
    const c = cutBoard(build([question()], []), 5)
    expect(c.hidden).toBe(0)
  })

  it('counts what is waiting per project, so a badge is a measurement', () => {
    const c = cutBoard(
      build([question({ id: 'a', projectId: 'p1' }), question({ id: 'b', projectId: 'p2' })], []),
      1
    )
    // The counts cover the WHOLE board, not the visible slice: a badge built
    // from five visible rows would say five however many are waiting.
    expect(c.countsByProject).toEqual({ p1: 1, p2: 1 })
  })

  it('keeps the top of the list, not an arbitrary five', () => {
    const c = cutBoard(build(many, []), 3)
    const all = build(many, [])
    expect(c.items.map((i) => i.ref)).toEqual(all.slice(0, 3).map((i) => i.ref))
  })
})

describe('scope', () => {
  it('narrows to one project', () => {
    const items = build([question({ id: 'a', projectId: 'p1' }), question({ id: 'b', projectId: 'p2' })], [])
    expect(scopeBoard(items, 'p1').map((i) => i.projectId)).toEqual(['p1'])
  })

  it('keeps an estate-level obligation out of a project view', () => {
    // A refusal with no project belongs to the estate. Showing it inside one
    // project would make it that project's problem, and it is not.
    const items = build([], [review({ ref: { kind: 'refusal', id: '7' }, projectId: null, projectName: null, kind: 'refused' })])
    expect(scopeBoard(items, 'p1')).toEqual([])
    expect(items).toHaveLength(1)
  })
})

describe('what the surface must be able to say', () => {
  it('separates an authored question from a derived obligation on the entry itself', () => {
    // So the surface can offer "answer" on one and never "dismiss" on either,
    // without re-deriving which is which from the kind string.
    const items = build([question()], [review()])
    const byOrigin = Object.fromEntries(items.map((i) => [i.origin, i.kind]))
    expect(byOrigin.authored).toBe('question')
    expect(byOrigin.derived).toBe('review')
  })

  it('carries the act that resolves an obligation, where there is one', () => {
    const [item] = build(
      [],
      [review({ kind: 'refused', ref: { kind: 'refusal', id: '1' }, grantable: { floorClass: 'deletion', target: '/x', askedBecause: 'cleanup' } })]
    )
    // A queue that names a problem and offers no act is a list of complaints.
    expect(item.grantable?.target).toBe('/x')
  })

  it('reports a total that counts what is waiting, not what is shown', () => {
    const c = cutBoard(build([question({ id: 'a' }), question({ id: 'b' })], []), 1)
    expect(c.items).toHaveLength(1)
    expect(c.total).toBe(2)
  })
})
