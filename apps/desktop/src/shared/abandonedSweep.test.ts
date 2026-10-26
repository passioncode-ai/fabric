// 0.3.13 wave 2, CO-427: the sweep of abandoned work. Spec:
// docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md (SW-1, SW-2, SW-3, SW-5, SW-8).
import { describe, expect, it } from 'vitest'
import { findAbandoned, lapsedTwice, nudgeText, sweepDue, toTell, ABANDONED_KINDS, STILL_MS, TELL_QUIET_MS, TERMINAL_QUIET_MS, TURN_WINDOW_MS, type SweepInput } from './abandonedSweep'

const NOW = Date.parse('2026-10-26T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const MIN = 60_000
const empty: SweepInput = { now: NOW, claims: [], tasks: [], requests: [], terminals: [] }

describe('sweepDue (SW-1)', () => {
  it('sweeps on every third pass of the one-minute cycle, never on the first two', () => {
    expect([1, 2, 3, 4, 5, 6].map(sweepDue)).toEqual([false, false, true, false, false, true])
  })
})

describe('findAbandoned (SW-2, SW-3)', () => {
  it('nothing still, nothing found', () => {
    expect(findAbandoned(empty)).toEqual([])
  })

  it('a claim past its expiry with no sign for ten minutes is silent; one signed a minute ago is not', () => {
    const claim = { claimId: 'c1', taskId: 't1', projectId: 'p1', sessionId: 's1', expiresAt: ago(MIN), claimedAt: ago(60 * MIN), renewedAt: null }
    const found = findAbandoned({ ...empty, claims: [{ ...claim, session: { lastSignAt: NOW - 11 * MIN } }] })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ kind: 'claim-silent', taskId: 't1', projectId: 'p1', sessionId: 's1', key: 'claim-silent:c1' })
    expect(found[0].stillMs).toBe(11 * MIN)
    expect(found[0].nextStep).toMatch(/move it, hand it over or let it go/)
    expect(findAbandoned({ ...empty, claims: [{ ...claim, session: { lastSignAt: NOW - MIN } }] })).toEqual([])
  })

  it('a claim whose session Fabric no longer holds is lapsed', () => {
    const found = findAbandoned({ ...empty, claims: [{ claimId: 'c2', taskId: 't2', projectId: 'p1', sessionId: 's2', expiresAt: ago(-MIN), claimedAt: ago(20 * MIN), renewedAt: null, session: null }] })
    expect(found.map((f) => f.kind)).toEqual(['claim-lapsed'])
  })

  it('a task in running with no live claim, still for three minutes, is unclaimed; a younger one is not', () => {
    expect(findAbandoned({ ...empty, tasks: [{ taskId: 't3', projectId: 'p1', state: 'running', movedAt: ago(STILL_MS), claimed: false }] }).map((f) => f.kind)).toEqual(['task-unclaimed'])
    expect(findAbandoned({ ...empty, tasks: [{ taskId: 't3', projectId: 'p1', state: 'running', movedAt: ago(STILL_MS - 1000), claimed: false }] })).toEqual([])
    expect(findAbandoned({ ...empty, tasks: [{ taskId: 't3', projectId: 'p1', state: 'running', movedAt: ago(STILL_MS), claimed: true }] })).toEqual([])
    expect(findAbandoned({ ...empty, tasks: [{ taskId: 't3', projectId: 'p1', state: 'backlog', movedAt: ago(STILL_MS), claimed: false }] })).toEqual([])
  })

  it('a board request queued for three minutes is unmoved and names its target; an answered one unread by its requester is told to the requester', () => {
    const unmoved = findAbandoned({ ...empty, requests: [{ requestId: 'r1', targetProjectId: 'p2', requesterProjectId: 'p1', state: 'queued', movedAt: ago(STILL_MS), answerUnreadSince: null }] })
    expect(unmoved).toMatchObject([{ kind: 'request-unmoved', requestId: 'r1', projectId: 'p2' }])
    const unread = findAbandoned({ ...empty, requests: [{ requestId: 'r2', targetProjectId: 'p2', requesterProjectId: 'p1', state: 'answered', movedAt: ago(10 * MIN), answerUnreadSince: ago(STILL_MS) }] })
    expect(unread).toMatchObject([{ kind: 'answer-unread', requestId: 'r2', projectId: 'p1' }])
    expect(findAbandoned({ ...empty, requests: [{ requestId: 'r3', targetProjectId: 'p2', requesterProjectId: 'p1', state: 'completed', movedAt: ago(60 * MIN), answerUnreadSince: null }] })).toEqual([])
  })

  it('a Fabric terminal that is stalled while it holds a task is found; a quiet one, or one with no task, is not', () => {
    const t = { sessionId: 's9', projectId: 'p1', taskId: 't9', liveness: 'stalled' as const, since: ago(16 * MIN), lastActivityAt: NOW - 16 * MIN }
    const run = { ...empty, runningTaskIds: ['t9'] }
    expect(findAbandoned({ ...run, terminals: [t] })).toMatchObject([{ kind: 'terminal-stalled', sessionId: 's9', taskId: 't9' }])
    expect(findAbandoned({ ...run, terminals: [{ ...t, liveness: 'quiet' }] })).toEqual([])
    expect(findAbandoned({ ...run, terminals: [{ ...t, taskId: null }] })).toEqual([])
  })
})

describe('toTell (SW-5)', () => {
  const f = findAbandoned({ ...empty, tasks: [{ taskId: 't3', projectId: 'p1', state: 'running', movedAt: ago(STILL_MS), claimed: false }] })
  it('tells a finding once, not again within thirty minutes, and again after', () => {
    const first = toTell(f, new Map(), NOW)
    expect(first.tell).toHaveLength(1)
    expect(toTell(f, first.told, NOW + 3 * MIN).tell).toHaveLength(0)
    expect(toTell(f, first.told, NOW + TELL_QUIET_MS).tell).toHaveLength(1)
  })
  it('never tells the same key twice in one sweep, and forgets keys no longer found', () => {
    const twice = toTell([...f, ...f], new Map(), NOW)
    expect(twice.tell).toHaveLength(1)
    expect(toTell([], twice.told, NOW + MIN).told.size).toBe(0)
  })
})

describe('lapsedTwice (SW-8)', () => {
  it('a lapsed claim found in two sweeps in a row is released; one seen once is not', () => {
    const claim = { claimId: 'c2', taskId: 't2', projectId: 'p1', sessionId: 's2', expiresAt: ago(-MIN), claimedAt: ago(20 * MIN), renewedAt: null, session: null }
    const sweep = findAbandoned({ ...empty, claims: [claim] })
    const once = lapsedTwice(new Set(), sweep)
    expect(once.release).toEqual([])
    const again = lapsedTwice(once.seen, sweep)
    expect(again.release.map((x) => x.claimId)).toEqual(['c2'])
  })
})

describe('nudgeText (SW-3, SW-4)', () => {
  it('names the item, how long it stood still in whole minutes, and the next step', () => {
    const [f] = findAbandoned({ ...empty, tasks: [{ taskId: 't3', projectId: 'p1', state: 'running', movedAt: ago(7 * MIN + 20_000), claimed: false }] })
    const line = nudgeText(f)
    expect(line).toMatch(/^Fabric: task t3 /)
    expect(line).toMatch(/still for 7 min/)
    expect(line).toContain(f.nextStep)
    const [r] = findAbandoned({ ...empty, requests: [{ requestId: 'r1', targetProjectId: 'p2', requesterProjectId: 'p1', state: 'queued', movedAt: ago(4 * MIN), answerUnreadSince: null }] })
    expect(nudgeText(r)).toMatch(/^Fabric: board request r1 .*still for 4 min/)
  })
})

// Review of 8e43e043 (three-tier): the findings the pure judgement got wrong.
describe('review fixes', () => {
  const stalled = { sessionId: 's9', projectId: 'p1', taskId: 't9', liveness: 'stalled', since: ago(16 * MIN), lastActivityAt: NOW - 16 * MIN }

  it('terminal-stalled needs its task among the running tasks read this sweep (finding 3)', () => {
    expect(findAbandoned({ ...empty, runningTaskIds: ['t9'], terminals: [stalled] }).map((f) => f.kind)).toEqual(['terminal-stalled'])
    expect(findAbandoned({ ...empty, runningTaskIds: ['t-other'], terminals: [stalled] }), 'its task is in review').toEqual([])
    expect(findAbandoned({ ...empty, terminals: [stalled] }), 'running tasks unread: no judgement').toEqual([])
  })

  it('terminal-stalled needs the terminal itself quiet for fifteen minutes, whatever the heartbeat says (finding 3)', () => {
    expect(findAbandoned({ ...empty, runningTaskIds: ['t9'], terminals: [{ ...stalled, lastActivityAt: NOW - MIN }] })).toEqual([])
    expect(findAbandoned({ ...empty, runningTaskIds: ['t9'], terminals: [{ ...stalled, lastActivityAt: NOW - TERMINAL_QUIET_MS + 1000 }] })).toEqual([])
    expect(TERMINAL_QUIET_MS).toBe(15 * MIN)
  })

  it('answer-unread names how to clear it: com.list {unread: true}, then com.read_ack (finding 4)', () => {
    const [f] = findAbandoned({ ...empty, requests: [{ requestId: 'r2', targetProjectId: 'p2', requesterProjectId: 'p1', state: 'answered', movedAt: ago(10 * MIN), answerUnreadSince: ago(STILL_MS) }] })
    expect(f.nextStep).toContain('com.list {unread: true}')
    expect(f.nextStep).toContain('com.read_ack')
  })

  it('a task a person moved to running by hand is not called unclaimed (finding 6)', () => {
    const t = { taskId: 't3', projectId: 'p1', state: 'running', movedAt: ago(30 * MIN), claimed: false }
    expect(findAbandoned({ ...empty, tasks: [{ ...t, movedByKind: 'person' }] })).toEqual([])
    expect(findAbandoned({ ...empty, tasks: [{ ...t, movedByKind: 'agent' }] }).map((f) => f.kind)).toEqual(['task-unclaimed'])
  })

  it('a person\'s move exempts a task only until a claim opens on it after that move (round 2, B2)', () => {
    const t = { taskId: 't3', projectId: 'p1', state: 'running', movedAt: ago(30 * MIN), claimed: false, movedByKind: 'person' }
    expect(findAbandoned({ ...empty, tasks: [{ ...t, lastClaimedAt: ago(20 * MIN) }] }).map((f) => f.kind)).toEqual(['task-unclaimed'])
    expect(findAbandoned({ ...empty, tasks: [{ ...t, lastClaimedAt: ago(40 * MIN) }] })).toEqual([])
    expect(findAbandoned({ ...empty, tasks: [{ ...t, lastClaimedAt: null }] })).toEqual([])
  })

  it('only a queued request is unmoved; claimed and accepted ones are being worked (finding 7)', () => {
    const r = { requestId: 'r1', targetProjectId: 'p2', requesterProjectId: 'p1', movedAt: ago(30 * MIN), answerUnreadSince: null }
    expect(findAbandoned({ ...empty, requests: [{ ...r, state: 'queued' }] }).map((f) => f.kind)).toEqual(['request-unmoved'])
    expect(findAbandoned({ ...empty, requests: [{ ...r, state: 'claimed' }] })).toEqual([])
    expect(findAbandoned({ ...empty, requests: [{ ...r, state: 'accepted' }] })).toEqual([])
  })
})

// 0.3.13 review, iteration 1, ER-4: a stalled terminal is still since it went quiet, not since it was marked stalled.
describe('terminal-stalled counts from the terminal\'s own quiet (ER-4)', () => {
  it('says 16 minutes for a terminal quiet 16 minutes and marked stalled a minute ago', () => {
    const [f] = findAbandoned({ ...empty, runningTaskIds: ['t9'], terminals: [{ sessionId: 's9', projectId: 'p1', taskId: 't9', liveness: 'stalled', since: ago(MIN), lastActivityAt: NOW - 16 * MIN }] })
    expect(f.stillMs).toBe(16 * MIN)
    expect(nudgeText(f)).toMatch(/still for 16 min/)
  })
})

// 0.3.14 wave 2: in the live audit of 2026-10-26, 18 of the 19 sessions that changed files in a day held no claim.
describe('work-unclaimed: a session changing files with no claim', () => {
  const turn = (sessionId: string, agoMs: number, filesChanged: number | null, projectId = 'p1') => ({ sessionId, projectId, at: ago(agoMs), filesChanged })
  const live = (sessionId: string) => ({ claimId: `c-${sessionId}`, taskId: 't1', projectId: 'p1', sessionId, expiresAt: ago(-10 * MIN), claimedAt: ago(5 * MIN), renewedAt: null, session: { lastSignAt: NOW } })

  it('is found for a session whose turns in the last fifteen minutes changed files while it holds no claim', () => {
    const found = findAbandoned({ ...empty, turns: [turn('s1', 12 * MIN, 3), turn('s1', 2 * MIN, 4)] })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ kind: 'work-unclaimed', key: 'work-unclaimed:s1', sessionId: 's1', projectId: 'p1', taskId: null })
    expect(found[0].stillMs).toBe(12 * MIN)
    expect(nudgeText(found[0])).toBe('Fabric: this session has changed files for 12 min and holds no claim. Claim the task you are working on (fabric_work_claim): its taskId, or a new row with a title and its origin.')
    expect(nudgeText(found[0])).not.toContain('\u2014')
  })

  it('is not found for a session that holds a claim, a managed launch or a Fabric terminal with a task', () => {
    const turns = [turn('s1', 2 * MIN, 3)]
    expect(findAbandoned({ ...empty, turns, claims: [live('s1')] })).toEqual([])
    expect(findAbandoned({ ...empty, turns, heldSessions: ['s1'] })).toEqual([])
    expect(findAbandoned({ ...empty, turns, terminals: [{ sessionId: 's1', projectId: 'p1', taskId: 't1', liveness: 'active', since: ago(MIN), lastActivityAt: NOW }] })).toEqual([])
  })

  it('is not found for turns that changed nothing, could not say, or are older than the window', () => {
    expect(findAbandoned({ ...empty, turns: [turn('s1', 2 * MIN, 0), turn('s2', 2 * MIN, null), turn('s3', TURN_WINDOW_MS + 1000, 5)] })).toEqual([])
  })

  it('is one finding per session, and every kind is listed for the receipt', () => {
    const found = findAbandoned({ ...empty, turns: [turn('s1', 2 * MIN, 1), turn('s1', MIN, 2), turn('s2', MIN, 1, 'p2')] })
    expect(found.map((f) => f.key).sort()).toEqual(['work-unclaimed:s1', 'work-unclaimed:s2'])
    expect(ABANDONED_KINDS).toContain('work-unclaimed')
  })
})
