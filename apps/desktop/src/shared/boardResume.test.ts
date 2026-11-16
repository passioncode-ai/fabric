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

  it('waits while Switchboard holds the session that left it on a usage limit, and names the workflow the claim was linked to', () => {
    // The resumed-claims fix (dissy finding, point 4): Switchboard continues that very session with `claude --resume`,
    // which takes its claims back at its enrollment; a run started meanwhile would be a second agent on the same task.
    const left = cand({ lastClaim: { claimedAt: ago(90 * MIN), releasedAt: ago(30 * MIN), how: 'session-ended', runtimeSessionId: 'rt-1', workflowId: 'wf_0123456789abcdef' } })
    expect(resumeItems([left], NOW, { limitStopped: new Set(['rt-1']) })).toEqual([])
    const [i] = resumeItems([left], NOW, { limitStopped: new Set(['rt-other']) })
    expect(i).toMatchObject({ taskId: 't-1', runtimeSessionId: 'rt-1', workflowId: 'wf_0123456789abcdef' })
    // No stop read (Switchboard absent or unread): continued as before.
    expect(resumeItems([left], NOW)).toHaveLength(1)
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

// The turn-end spec §3 and §4.1: a declared wait holds the task until it clears.
import { parseWait, waitCleared, waitLine } from './boardResume'
const Q = '0a0a0a0a-0b0b-4c0c-8d0d-0e0e0e0e0e0e'

describe('parseWait', () => {
  it('keeps a wait that names one checkable thing', () => {
    expect(parseWait({ kind: 'time', until: '2026-11-16T19:00:00Z', why: 'CI run' })).toEqual({ kind: 'time', until: '2026-11-16T19:00:00.000Z', ref: null, why: 'CI run' })
    expect(parseWait({ kind: 'question', ref: Q.toUpperCase() })).toEqual({ kind: 'question', until: null, ref: Q, why: null })
  })
  it('reads a wait that names nothing checkable as no wait', () => {
    for (const raw of [null, 'later', { kind: 'time' }, { kind: 'time', until: 'soon' }, { kind: 'question' }, { kind: 'request', ref: 'abc' }, { kind: 'forever' }])
      expect(parseWait(raw)).toBeNull()
  })
})

describe('waitCleared and resumeItems with a wait', () => {
  const released = ago(30 * MIN)
  it('a time or a limit clears once its time has passed', () => {
    expect(waitCleared({ kind: 'time', until: ago(MIN), ref: null, why: null }, null, NOW)).toBe(true)
    expect(waitCleared({ kind: 'limit', until: new Date(NOW + MIN).toISOString(), ref: null, why: null }, null, NOW)).toBe(false)
  })
  it('a question, grant or request clears only once it reads settled; unread is not cleared', () => {
    const w = { kind: 'question' as const, until: null, ref: Q, why: null }
    expect(waitCleared(w, true, NOW)).toBe(true)
    expect(waitCleared(w, false, NOW)).toBe(false)
    expect(waitCleared(w, null, NOW)).toBe(false)
  })
  it('holds the task while the wait is open, continues it once cleared, and names the wait in the item', () => {
    const lastClaim = { claimedAt: ago(90 * MIN), releasedAt: released, how: 'let-go' }
    const wait = { kind: 'question' as const, until: null, ref: Q, why: 'which plan' }
    expect(resumeItems([cand({ lastClaim, wait, waitSettled: false })], NOW)).toEqual([])
    expect(resumeItems([cand({ lastClaim, wait, waitSettled: null })], NOW)).toEqual([])
    const [i] = resumeItems([cand({ lastClaim, wait, waitSettled: true })], NOW)
    expect(i?.wait).toEqual(wait)
    expect(waitLine(wait)).toMatch(/fabric-question:0a0a0a0a.*which plan.*cleared/)
    const later = { kind: 'time' as const, until: new Date(NOW + 60 * MIN).toISOString(), ref: null, why: null }
    expect(resumeItems([cand({ lastClaim, wait: later })], NOW)).toEqual([])
    expect(resumeItems([cand({ lastClaim, wait: later })], NOW + 61 * MIN)).toHaveLength(1)
  })
})
