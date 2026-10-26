// 0.3.13 SW-9: the sweep of abandoned work reaches the operator's queue as `abandoned` items, one per finding key, gone
// when the finding is gone, and the notifier tells each once. Spec: docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md.
import { describe, expect, it } from 'vitest'
import type { AbandonedKind, Finding } from './abandonedSweep.ts'
import { attentionKey, attentionOf, sweptSources, type AttentionSources } from './attention.ts'
import { boardEntries, cutBoard, reviewCounts } from './board.ts'
import { decideNotification, rememberTold } from './notify.ts'

const empty: AttentionSources = { reviews: [], expired: [], refusals: [], proposals: [], names: { p1: 'Atlas' } }
const T = Date.parse('2026-10-26T12:00:00Z')

const finding = (kind: AbandonedKind, id: string, over: Partial<Finding> = {}): Finding & { stillSince: number } => {
  const onTask = kind === 'claim-silent' || kind === 'claim-lapsed' || kind === 'task-unclaimed' || kind === 'terminal-stalled'
  return {
    kind, key: `${kind}:${id}`, projectId: 'p1', taskId: onTask ? `t-${id}` : null, requestId: onTask ? null : `r-${id}`,
    sessionId: null, claimId: null, stillMs: 5 * 60_000, nextStep: 'x', stillSince: T - 5 * 60_000, ...over
  }
}
const KINDS: AbandonedKind[] = ['claim-silent', 'claim-lapsed', 'task-unclaimed', 'request-unmoved', 'answer-unread', 'terminal-stalled']
const queue = (findings: (Finding & { stillSince: number })[], titles: Record<string, string> = {}) =>
  attentionOf({ ...empty, swept: sweptSources(findings, titles, new Set(Object.keys(titles))) })

describe('the sweep\'s findings in the operator\'s queue (SW-9)', () => {
  it('each of the six kinds appears as abandoned work, keyed by its finding, with its kind and how long it stood still', () => {
    const items = queue(KINDS.map((k) => finding(k, k)), { 't-claim-silent': 'Fix the login' })
    expect(items).toHaveLength(6)
    expect(items.every((i) => i.kind === 'abandoned')).toBe(true)
    expect(items.map((i) => i.swept?.kind).sort()).toEqual([...KINDS].sort())
    expect(new Set(items.map(attentionKey)).size).toBe(6)
    const silent = items.find((i) => i.swept?.kind === 'claim-silent')!
    expect(silent).toMatchObject({ title: 'Fix the login', projectName: 'Atlas', ref: { kind: 'task', id: 't-claim-silent' }, since: new Date(T - 5 * 60_000).toISOString() })
    // A task the read did not find is not navigable as a task; a request opens its project.
    expect(items.find((i) => i.swept?.kind === 'task-unclaimed')!.ref).toEqual({ kind: 'work', id: 't-task-unclaimed' })
    expect(items.find((i) => i.swept?.kind === 'request-unmoved')!.ref).toEqual({ kind: 'project', id: 'p1' })
  })

  it('disappears when the sweep no longer finds it, and the rest stay', () => {
    const before = queue([finding('claim-silent', 'a'), finding('answer-unread', 'b')])
    const after = queue([finding('answer-unread', 'b')])
    expect(before.map(attentionKey).sort()).toEqual(['abandoned/answer-unread:b', 'abandoned/claim-silent:a'])
    expect(after.map(attentionKey)).toEqual(['abandoned/answer-unread:b'])
    expect(queue([])).toEqual([])
  })

  it('keeps two findings over one task, and an expired lease over it, as three obligations', () => {
    const items = attentionOf({
      ...empty,
      expired: [{ work_id: 't-x', project_id: 'p1', owner_session: 's', expires_at: '2026-10-26T11:00:00Z', title: 'X', is_task: true }],
      swept: sweptSources([finding('claim-silent', 'x', { taskId: 't-x' }), finding('terminal-stalled', 'x', { taskId: 't-x' })], { 't-x': 'X' }, new Set(['t-x']))
    })
    expect(new Set(items.map(attentionKey)).size).toBe(3)
    const board = boardEntries({ questions: [], attention: items, projectWeightOf: () => 1, now: new Date(T) })
    expect(new Set(board.map((e) => e.ref)).size).toBe(3)
  })

  it('counts on «На проверке» and carries its kind to the board row', () => {
    const items = queue([finding('task-unclaimed', 'a'), finding('request-unmoved', 'b')])
    const whole = cutBoard(boardEntries({ questions: [], attention: items, projectWeightOf: () => 1, now: new Date(T) }), 100)
    const mine = cutBoard([], 100)
    expect(reviewCounts(whole, mine)).toEqual({ total: 2, byProject: { p1: 2 } })
    expect(whole.items.map((e) => e.swept?.kind).sort()).toEqual(['request-unmoved', 'task-unclaimed'])
  })

  it('a finding key read twice is one row', () => {
    expect(queue([finding('claim-lapsed', 'a'), finding('claim-lapsed', 'a')])).toHaveLength(1)
  })
})

describe('the notifier tells each finding once (SW-9, the notifier\'s `told`)', () => {
  /** The notifier's pass as `index.ts` runs it: decide, forget what left, remember what was shown. */
  const pass = (items: ReturnType<typeof queue>, told: Set<string>): string[] => {
    const d = decideNotification(items.map((i) => ({ id: attentionKey(i), title: i.title, projectName: i.projectName })), told, false)
    const live = new Set(items.map(attentionKey))
    for (const id of told) if (!live.has(id)) told.delete(id)
    if (!d.notify) return []
    for (const id of rememberTold(d, { shown: true }).told) told.add(id)
    return d.ids
  }

  it('tells a finding on the first pass and never again while the sweep keeps finding it', () => {
    const told = new Set<string>()
    const items = queue(KINDS.map((k) => finding(k, k)))
    expect(pass(items, told)).toHaveLength(6)
    expect(pass(items, told)).toEqual([])
    expect(pass(queue(KINDS.map((k) => finding(k, k))), told)).toEqual([])
  })

  it('tells only the new finding when one more appears, and a finding that left and came back is waiting again', () => {
    const told = new Set<string>()
    pass(queue([finding('claim-silent', 'a')]), told)
    expect(pass(queue([finding('claim-silent', 'a'), finding('answer-unread', 'b')]), told)).toEqual(['abandoned/answer-unread:b'])
    pass(queue([finding('answer-unread', 'b')]), told)
    expect(pass(queue([finding('claim-silent', 'a'), finding('answer-unread', 'b')]), told)).toEqual(['abandoned/claim-silent:a'])
  })
})
