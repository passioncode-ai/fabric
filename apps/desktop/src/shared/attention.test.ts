import { pendingFacts } from './access'
import { describe, expect, it } from 'vitest'
import {
  attentionByProject,
  attentionKey,
  attentionOf,
  obligationReceipts,
  waitingCounts,
  waitingProblem,
  type AttentionItem,
  type AttentionSources
} from './attention.ts'
import { envelope } from './readEnvelope.ts'

const empty: AttentionSources = { reviews: [], expired: [], refusals: [], proposals: [], names: {} }

describe('what needs the operator', () => {
  it('puts a refusal above work in review, and work in review above work nobody is doing', () => {
    const items = attentionOf({
      ...empty,
      reviews: [{ id: 't1', project_id: 'p', title: 'a review', instruction: 'x', started_at: '2026-09-05T10:00:00Z' }],
      expired: [{ work_id: 't2', project_id: 'p', owner_session: 's', expires_at: '2026-09-05T09:00:00Z', title: 'abandoned', is_task: true }],
      refusals: [{ seq: 1, project_id: 'p', floor_class: 'publication', target: 'a domain', reason: 'no grant', occurred_at: '2026-09-05T11:00:00Z' }]
    })
    expect(items.map((i) => i.kind)).toEqual(['refused', 'review', 'abandoned'])
  })

  it('within a kind, the thing waiting longest comes first — neglect is the ordering, not novelty', () => {
    const items = attentionOf({
      ...empty,
      reviews: [
        { id: 'new', project_id: 'p', title: 'newer', instruction: 'x', started_at: '2026-09-05T12:00:00Z' },
        { id: 'old', project_id: 'p', title: 'older', instruction: 'x', started_at: '2026-09-01T12:00:00Z' }
      ]
    })
    expect(items.map((i) => i.title)).toEqual(['older', 'newer'])
  })

  it('names the project each item belongs to, so the estate queue is navigable', () => {
    const items = attentionOf({
      ...empty,
      names: { p1: 'Fabric' },
      reviews: [{ id: 't', project_id: 'p1', title: 'a task', instruction: 'x', started_at: '2026-09-05T10:00:00Z' }]
    })
    expect(items[0].projectName).toBe('Fabric')
  })

  it('an unnamed project is null rather than a uuid pretending to be a name', () => {
    const items = attentionOf({
      ...empty,
      reviews: [{ id: 't', project_id: 'unknown', title: 'a task', instruction: 'x', started_at: '2026-09-05T10:00:00Z' }]
    })
    expect(items[0].projectName).toBeNull()
  })

  it('falls back to the instruction when a task has no title, never to an empty line', () => {
    const items = attentionOf({
      ...empty,
      reviews: [{ id: 't', project_id: 'p', title: null, instruction: 'survey the repository', started_at: '2026-09-05T10:00:00Z' }]
    })
    expect(items[0].title).toBe('survey the repository')
  })

  it('is empty when nothing is waiting — and that is a measurement, not a default', () => {
    expect(attentionOf(empty)).toEqual([])
  })

  it('gives every item a stable id, so the list does not reshuffle under the pointer', () => {
    const sources: AttentionSources = {
      ...empty,
      reviews: [{ id: 't1', project_id: 'p', title: 'a', instruction: 'x', started_at: '2026-09-05T10:00:00Z' }],
      expired: [{ work_id: 't1', project_id: 'p', owner_session: 's', expires_at: '2026-09-05T09:00:00Z', title: 'a', is_task: true }]
    }
    const ids = attentionOf(sources).map(attentionKey)
    expect(ids).toEqual(attentionOf(sources).map(attentionKey))
    // The same task id in two kinds must not collide into one row.
    expect(new Set(ids).size).toBe(2)
  })
})

describe('the ref names the SUBJECT, and only when it is navigable', () => {
  it('carries a task ref for a review, not a re-prefixed string', () => {
    const [item] = attentionOf({
      ...empty,
      reviews: [{ id: 't1', project_id: 'p', title: 'a', instruction: 'x', started_at: '2026-09-05T10:00:00Z' }]
    })
    expect(item.ref).toEqual({ kind: 'task', id: 't1' })
  })

  it('calls a lease over work that is NOT a task exactly that', () => {
    // It used to be `lease:<work_id>`, and the panel sliced the prefix off and
    // navigated to it as a task id. The caller already looks the id up in
    // `project_tasks` to find a title; the answer is carried now.
    const [asTask] = attentionOf({
      ...empty,
      expired: [{ work_id: 'w', project_id: 'p', owner_session: 's', expires_at: '2026-09-05T09:00:00Z', title: 'a task', is_task: true }]
    })
    const [notTask] = attentionOf({
      ...empty,
      expired: [{ work_id: 'w', project_id: 'p', owner_session: 's', expires_at: '2026-09-05T09:00:00Z', title: null, is_task: false }]
    })
    expect(asTask.ref).toEqual({ kind: 'task', id: 'w' })
    expect(notTask.ref).toEqual({ kind: 'work', id: 'w' })
  })

  it('keys an obligation by its kind AND its subject', () => {
    // A task in review whose lease also expired is two things waiting.
    const items = attentionOf({
      ...empty,
      reviews: [{ id: 't1', project_id: 'p', title: 'a', instruction: 'x', started_at: '2026-09-05T10:00:00Z' }],
      expired: [{ work_id: 't1', project_id: 'p', owner_session: 's', expires_at: '2026-09-05T09:00:00Z', title: 'a', is_task: true }]
    })
    expect(items.map(attentionKey).sort()).toEqual(['abandoned/task:t1', 'review/task:t1'])
  })
})

describe('what is waiting, per project', () => {
  const item = (kind: AttentionItem['kind'], projectId: string | null): AttentionItem => ({
    kind,
    ref: { kind: 'task', id: `${projectId}:${Math.random()}` },
    projectId,
    projectName: null,
    title: 'x',
    detail: null,
    since: '2026-09-05T00:00:00Z'
  })

  it('counts each kind and the total', () => {
    const counts = attentionByProject([
      item('review', 'a'),
      item('review', 'a'),
      item('refused', 'a'),
      item('abandoned', 'b')
    ])
    expect(counts.a).toEqual({ access: 0, refused: 1, proposal: 0, review: 2, abandoned: 0, total: 3 })
    expect(counts.b).toEqual({ access: 0, refused: 0, proposal: 0, review: 0, abandoned: 1, total: 1 })
  })

  it('counts nothing for a project with nothing waiting — the key is simply absent', () => {
    // Absent rather than a row of zeroes: a card asks "is anything waiting" and
    // gets a straight no, instead of four zeroes to interpret.
    expect(attentionByProject([item('review', 'a')]).b).toBeUndefined()
  })

  it('an item with no project is counted by nobody', () => {
    // A refusal naming no project belongs to the estate. Putting it on an
    // arbitrary card would be inventing a home for it.
    const counts = attentionByProject([item('refused', null), item('review', 'a')])
    expect(Object.keys(counts)).toEqual(['a'])
    expect(counts.a.total).toBe(1)
  })

  it('is derived from the SAME items the panel shows, so the two cannot disagree', () => {
    const items = [item('review', 'a'), item('refused', 'a'), item('abandoned', 'b')]
    const counts = attentionByProject(items)
    const fromPanel = items.filter((i) => i.projectId === 'a').length
    expect(counts.a.total).toBe(fromPanel)
  })

  it('an empty queue produces no rows at all', () => {
    expect(attentionByProject([])).toEqual({})
  })
})

describe('a source that ANSWERED is named too (UXA-C02)', () => {
  const stamp = '2026-09-11T00:00:00Z'
  const reads = [
    { source: 'reviews', error: null },
    { source: 'refusals', error: { message: 'permission denied for table journal' } },
    { source: 'proposals', error: null }
  ]

  it('produces one receipt per source, not one per failure', () => {
    // A list of FAILURES cannot describe a partial read: `envelope()` compares
    // what answered against what was consulted, and a source it never hears
    // about is a source that did not answer.
    const got = obligationReceipts(reads, stamp)
    expect(got).toHaveLength(3)
    expect(got.map((r) => r.name)).toEqual([
      'obligations/reviews',
      'obligations/refusals',
      'obligations/proposals'
    ])
  })

  it('so one refusal among three leaves the read PARTIAL rather than unavailable', () => {
    // The card's own acceptance: an outage in one source does not hide the
    // other projects. With failures alone this envelope said `unavailable`,
    // which forces `data` to null — every surviving obligation gone.
    const e = envelope({ data: ['kept'], sources: obligationReceipts(reads, stamp), asOf: stamp })
    expect(e.availability).toBe('partial')
    expect(e.data, 'what answered survives').toEqual(['kept'])
  })

  it('and the failure carries the source’s own words, never a bare status', () => {
    const refused = obligationReceipts(reads, stamp)[1]
    expect(refused.status).toBe('error')
    expect(refused.errorCode).toMatch(/permission denied/)
    expect(refused.asOf, 'a source that did not answer has no time of answering').toBeNull()
  })

  it('while all-ok receipts make a COMPLETE read, so the rule can still say yes', () => {
    const ok = obligationReceipts([{ source: 'reviews', error: null }], stamp)
    expect(envelope({ data: [], sources: ok, asOf: stamp }).availability).toBe('complete')
  })
})

describe('what the estate may claim about what is waiting', () => {
  const stamp = '2026-09-11T00:00:00Z'
  const item = (projectId: string): AttentionItem => ({
    kind: 'refused',
    ref: { kind: 'refusal', id: '1' },
    projectId,
    projectName: null,
    title: 't',
    detail: null,
    since: stamp
  })
  const of = (data: AttentionItem[] | null, reads: Parameters<typeof obligationReceipts>[0]) =>
    envelope({ data, sources: obligationReceipts(reads, stamp), asOf: stamp })

  it('says nothing at all before anyone has looked', () => {
    expect(waitingProblem({ read: false })).toBeNull()
    expect(waitingCounts({ read: false }), 'and has no number to show').toBeNull()
  })

  it('says nothing when the read was whole — the rule can say yes', () => {
    const e = of([item('p1')], [{ source: 'reviews', error: null }])
    expect(waitingProblem({ read: true, envelope: e })).toBeNull()
    expect(waitingCounts({ read: true, envelope: e })?.p1.total).toBe(1)
  })

  it('KEEPS the counts on a partial read and says why they are not totals', () => {
    const e = of(
      [item('p1')],
      [
        { source: 'reviews', error: null },
        { source: 'refusals', error: { message: 'permission denied' } }
      ]
    )
    expect(waitingCounts({ read: true, envelope: e })?.p1.total, 'what answered survives').toBe(1)
    const problem = waitingProblem({ read: true, envelope: e })
    expect(problem?.kind).toBe('partial')
    expect(problem?.why).toMatch(/refusals/)
  })

  it('and a CUT window is partial too, though every source answered', () => {
    const e = envelope({
      data: [item('p1')],
      sources: obligationReceipts([{ source: 'refusals', error: null }], stamp),
      omitted: [{ count: null, reason: 'refusals older than the last 50 policy decisions were not read' }],
      asOf: stamp
    })
    expect(waitingProblem({ read: true, envelope: e })?.kind).toBe('partial')
    expect(waitingProblem({ read: true, envelope: e })?.why).toMatch(/older than/)
  })

  it('has NO path from a read that did not answer to a number', () => {
    // Both shapes of "could not say": the envelope that answered and found
    // nothing alive, and the call that never arrived at all.
    const dead = of(null, [{ source: 'reviews', error: { message: 'the store is not answering' } }])
    expect(dead.availability).toBe('unavailable')
    expect(waitingCounts({ read: true, envelope: dead })).toBeNull()
    expect(waitingProblem({ read: true, envelope: dead })?.kind).toBe('unreadable')
    expect(waitingCounts({ read: true, failed: 'the bridge is gone' })).toBeNull()
    expect(waitingProblem({ read: true, failed: 'the bridge is gone' })?.kind).toBe('unreadable')
  })
})

describe('an external agent waiting on consent (ADR-0115)', () => {
  const facts = pendingFacts({
    id: 'r1', agent_id: 'example-agent.default', callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['cloudflare:news@example.com'],
    reason: 'summarise the newsletter', asked_by_binding: null, requested_at: '2026-10-03T10:00:00Z', expires_at: '2026-10-03T10:10:00Z',
    registry: { name: 'Example agent', installed_by: 'example-installer', repository: null }
  }, false)
  it('is an estate-level item, first in the queue, carrying the act and leaving no project count', () => {
    const items = attentionOf({
      reviews: [{ id: 't1', project_id: 'p1', title: 'x', instruction: 'x', started_at: '2026-10-01T00:00:00Z' }],
      expired: [], refusals: [], proposals: [], names: { p1: 'One' },
      access: [facts]
    })
    expect(items[0]).toMatchObject({ kind: 'access', ref: { kind: 'access-request', id: 'r1' }, projectId: null, since: '2026-10-03T10:00:00Z', access: facts })
    expect(attentionByProject(items).p1).toEqual({ access: 0, refused: 0, proposal: 0, review: 1, abandoned: 0, total: 1 })
  })
  it('UX-2: carries no English sentence — its title is the agent\'s name, phrased by the screen that shows it', () => {
    const [item] = attentionOf({ reviews: [], expired: [], refusals: [], proposals: [], names: {}, access: [facts] })
    expect(item.title).toBe('Example agent')
    expect(item.detail).toBeNull()
    expect(JSON.stringify(item)).not.toMatch(/asks to use|registered as|mail in/)
  })
})

// Audit 2026-10-05 A1-001: a refusal leaves the queue once what it asked for has been given.
describe('a granted refusal is resolved', () => {
  const refusal = (seq: number, over: Partial<AttentionSources['refusals'][number]> = {}) =>
    ({ seq, project_id: 'p', floor_class: 'deletion', target: '/repo/a.md', reason: 'no grant', occurred_at: `2026-10-05T10:0${seq}:00Z`, ...over })
  const grant = (seq: number, over: Partial<NonNullable<AttentionSources['resolutions']>[number]> = {}) =>
    ({ seq, project_id: 'p', floor_class: 'deletion', target: '/repo/a.md', ...over })

  it('a later grant for the same act and target removes it', () => {
    expect(attentionOf({ ...empty, refusals: [refusal(1)], resolutions: [grant(2)] })).toEqual([])
  })

  it('an estate-wide grant resolves a project refusal; a grant for another project, act, target or an earlier one does not', () => {
    expect(attentionOf({ ...empty, refusals: [refusal(1)], resolutions: [grant(2, { project_id: null })] })).toEqual([])
    for (const other of [grant(2, { project_id: 'q' }), grant(2, { floor_class: 'money' }), grant(2, { target: '/repo/b.md' }), grant(0)])
      expect(attentionOf({ ...empty, refusals: [refusal(1)], resolutions: [other] })).toHaveLength(1)
  })

  it('a refusal after the grant (it expired unused, or was spent) is open again', () => {
    expect(attentionOf({ ...empty, refusals: [refusal(3), refusal(1)], resolutions: [grant(2)] }).map((i) => i.ref.id)).toEqual(['3'])
  })

  it('repeated refusals of one act are one obligation, the newest, dated from the first', () => {
    const items = attentionOf({ ...empty, refusals: [refusal(3), refusal(2), refusal(1)] })
    expect(items).toHaveLength(1)
    expect(items[0].ref.id).toBe('3')
    expect(items[0].since).toBe('2026-10-05T10:01:00Z')
    expect(attentionByProject(items).p.refused).toBe(1)
  })

  it('with no resolutions read, every refusal stays open', () => {
    expect(attentionOf({ ...empty, refusals: [refusal(1), refusal(2, { target: '/repo/b.md' })] })).toHaveLength(2)
  })
})
