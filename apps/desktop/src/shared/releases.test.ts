import { describe, expect, it } from 'vitest'
import { latestVerified, releaseEntries } from './releases'

const row = (id: string, seq: number, extra: Record<string, unknown> = {}) => ({
  id, project_id: 'p1', name: `Atlas ${id}`, environment: 'Demo / local', summary: null, recorded_at: `2026-09-${10 + seq}T10:00:00Z`,
  recorded_seq: seq, task_ids: [], decision_ids: [], rolls_back: null, verified_outcome: null, verification_receipt: null, verified_at: null, ...extra
})
const names = new Map([['p1', 'Atlas']])

describe('release state is derived from the records', () => {
  it('no verification is a candidate; accepted is verified; failed is failed; newest first', () => {
    const e = releaseEntries([row('a', 1, { verified_outcome: 'accepted', verification_receipt: 'demo-check' }), row('b', 2), row('c', 3, { verified_outcome: 'failed', verification_receipt: 'wrong pack' })], names)
    expect(e.map((x) => [x.id, x.status])).toEqual([['c', 'failed'], ['b', 'candidate'], ['a', 'verified']])
    expect(e[2].receipt).toBe('demo-check')
    expect(e[0].projectName).toBe('Atlas')
  })

  it('a later release naming one rolls it back, whatever its verification said; the old record keeps its outcome', () => {
    const e = releaseEntries([row('a', 1, { verified_outcome: 'accepted' }), row('b', 2, { rolls_back: 'a' }), row('c', 3, { rolls_back: 'a' })], names)
    const a = e.find((x) => x.id === 'a')!
    expect(a.status).toBe('rolled_back')
    expect(a.outcome, 'the rolled-back record was rewritten').toBe('accepted')
    expect(a.rolledBackBy, 'the latest rollback is the one that stands').toBe('c')
    expect(e.find((x) => x.id === 'b')!.status).toBe('candidate')
  })

  it('what went in and why keep every reference, with text only when it was read', () => {
    const [e] = releaseEntries([row('a', 1, { task_ids: ['t1', 't2'], decision_ids: ['d1'] })], names, new Map([['t1', 'Link the runs']]), new Map())
    expect(e.tasks).toEqual([{ id: 't1', text: 'Link the runs' }, { id: 't2', text: null }])
    expect(e.decisions, 'an unread decision vanished from the basis').toEqual([{ id: 'd1', text: null }])
  })

  it('the latest verified release is the one that still stands', () => {
    const e = releaseEntries([row('a', 1, { verified_outcome: 'accepted' }), row('b', 2, { verified_outcome: 'accepted' }), row('c', 3, { rolls_back: 'b' })], names)
    expect(latestVerified(e)?.id, 'a rolled-back release was offered as the latest result').toBe('a')
    expect(latestVerified(releaseEntries([row('x', 1)], names))).toBeNull()
  })
})
