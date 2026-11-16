import { describe, expect, it } from 'vitest'
import { RESUME_GRACE_MS, RESUME_WINDOW_MS, resumeItems, resumeStateOf, type ResumeCandidate } from './boardResume'

// §3.11 of the on-demand spec: the board supervisor continues work a session left open.
const NOW = Date.parse('2026-11-16T18:00:00Z')
const MIN = 60_000
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const cand = (over: Partial<ResumeCandidate> = {}): ResumeCandidate => ({
  taskId: 't-1', projectId: 'p-1', title: 'Вторая волна правок', status: 'backlog',
  movedAt: ago(30 * MIN), movedByKind: 'system',
  lastClaim: { claimedAt: ago(90 * MIN), releasedAt: ago(30 * MIN), how: 'session-ended' }, openQuestion: false, ...over
})

describe('resumeItems', () => {
  it('takes an open task whose session ended without finishing it, past the grace', () => {
    const [i] = resumeItems([cand()], NOW)
    expect(i).toMatchObject({ taskId: 't-1', projectId: 'p-1', how: 'session-ended', releasedAt: ago(30 * MIN) })
    expect(Date.parse(i!.deadline)).toBe(NOW - 30 * MIN + RESUME_WINDOW_MS)
  })

  it('leaves a task alone inside the grace, past the week, or released by done or by a person', () => {
    expect(resumeItems([cand({ lastClaim: { claimedAt: ago(20 * MIN), releasedAt: ago(RESUME_GRACE_MS - MIN), how: 'let-go' } })], NOW)).toEqual([])
    expect(resumeItems([cand({ lastClaim: { claimedAt: ago(RESUME_WINDOW_MS + 2 * MIN), releasedAt: ago(RESUME_WINDOW_MS + MIN), how: 'let-go' } })], NOW)).toEqual([])
    for (const how of ['done', 'operator', null]) expect(resumeItems([cand({ lastClaim: { claimedAt: ago(90 * MIN), releasedAt: ago(30 * MIN), how } })], NOW)).toEqual([])
  })

  it('leaves a task that is held, never claimed, finished, without a project or waiting on a question to a person', () => {
    expect(resumeItems([cand({ lastClaim: { claimedAt: ago(5 * MIN), releasedAt: null, how: null } })], NOW)).toEqual([])
    expect(resumeItems([cand({ lastClaim: null })], NOW)).toEqual([])
    for (const status of ['review', 'done', 'cancelled']) expect(resumeItems([cand({ status })], NOW)).toEqual([])
    expect(resumeItems([cand({ projectId: null })], NOW)).toEqual([])
    expect(resumeItems([cand({ openQuestion: true })], NOW)).toEqual([])
  })

  it('never overrides a person who moved the task after the release; an agent or the sweep moving it is the release\'s own step', () => {
    expect(resumeItems([cand({ movedByKind: 'person', movedAt: ago(10 * MIN) })], NOW)).toEqual([])
    expect(resumeItems([cand({ movedByKind: 'person', movedAt: ago(60 * MIN) })], NOW)).toHaveLength(1)
    expect(resumeItems([cand({ movedByKind: 'agent', movedAt: ago(10 * MIN) })], NOW)).toHaveLength(1)
  })

  it('continues every way of leaving work: a lapsed claim, a let-go and a hand-over nobody took', () => {
    for (const how of ['session-ended', 'lapsed', 'let-go', 'handed-over'])
      expect(resumeItems([cand({ lastClaim: { claimedAt: ago(90 * MIN), releasedAt: ago(30 * MIN), how } })], NOW)).toHaveLength(1)
  })

  it('orders the oldest release first', () => {
    const items = resumeItems([cand({ taskId: 'new', lastClaim: { claimedAt: ago(90 * MIN), releasedAt: ago(20 * MIN), how: 'let-go' } }),
      cand({ taskId: 'old', lastClaim: { claimedAt: ago(9 * 60 * MIN), releasedAt: ago(8 * 60 * MIN), how: 'lapsed' } })], NOW)
    expect(items.map((i) => i.taskId)).toEqual(['old', 'new'])
  })
})

describe('resumeStateOf', () => {
  const released = ago(30 * MIN)
  it('reads queued while nobody took the task since the release', () => {
    expect(resumeStateOf({ status: 'backlog', lastClaimedAt: ago(90 * MIN), movedAt: ago(30 * MIN), movedByKind: 'system' }, released)).toBe('queued')
  })
  it('reads answered once a claim opened after the release, the task moved on, or a person moved it since', () => {
    expect(resumeStateOf({ status: 'backlog', lastClaimedAt: ago(5 * MIN), movedAt: ago(30 * MIN), movedByKind: 'agent' }, released)).toBe('answered')
    for (const status of ['review', 'done', 'cancelled']) expect(resumeStateOf({ status, lastClaimedAt: ago(90 * MIN), movedAt: null, movedByKind: null }, released)).toBe('answered')
    expect(resumeStateOf({ status: 'backlog', lastClaimedAt: ago(90 * MIN), movedAt: ago(5 * MIN), movedByKind: 'person' }, released)).toBe('answered')
  })
  it('reads null when the task could not be read', () => {
    expect(resumeStateOf(null, released)).toBeNull()
  })
})
