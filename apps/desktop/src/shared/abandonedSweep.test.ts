// 0.3.13 wave 2, CO-427: the sweep of abandoned work. Spec:
// docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md (SW-1, SW-2, SW-3, SW-5, SW-8).
import { describe, expect, it } from 'vitest'
import { AGENT_ONLY_KINDS, findAbandoned, lapsedTwice, nudgeText, sweepDue, toTell, ABANDONED_KINDS, STILL_MS, TELL_QUIET_MS, TERMINAL_QUIET_MS, TURN_WINDOW_MS, BRIEF_AFTER_MS, type SweepInput } from './abandonedSweep'

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

  it('CO-409 (0.3.16 review, PL-1): a request the dispatcher gave to the operator shows in any open state, at once', () => {
    const r = { requestId: 'r1', targetProjectId: 'p2', requesterProjectId: 'p1', movedAt: ago(MIN), answerUnreadSince: null, toOperator: true }
    for (const state of ['queued', 'claimed', 'accepted', 'in_progress']) {
      const f = findAbandoned({ ...empty, requests: [{ ...r, state }] })
      // UX-3 (0.3.16 review, iteration 3): a kind of its own, never «nobody has picked it up».
      expect(f.map((x) => x.kind)).toEqual(['request-to-operator'])
      expect(f[0].nextStep).toMatch(/waits for the operator/)
    }
    expect(findAbandoned({ ...empty, requests: [{ ...r, state: 'completed' }] })).toEqual([])
  })

  it('CO-559: an inbox item the dispatcher gave to the operator shows as the project\'s unread messages, never as a request', () => {
    const r = { requestId: 'm1', targetProjectId: 'p2', requesterProjectId: '', movedAt: ago(MIN), answerUnreadSince: null, toOperator: true, inbox: true, state: 'queued' }
    const f = findAbandoned({ ...empty, requests: [r] })
    expect(f.map((x) => x.kind)).toEqual(['inbox-to-operator'])
    expect(f[0].projectId).toBe('p2')
    expect(f[0].nextStep).toMatch(/unread board messages/)
    expect(f[0].nextStep).toMatch(/Three runs/)
  })

  it('CO-551: a run on another machine whose result was not posted, or whose machine went quiet, says so in words of its own', () => {
    const r = { requestId: 'r1', targetProjectId: 'p2', requesterProjectId: 'p1', movedAt: ago(MIN), answerUnreadSince: null, toOperator: true, state: 'queued' }
    const unposted = findAbandoned({ ...empty, requests: [{ ...r, remote: 'unposted' as const }] })
    expect(unposted.map((x) => x.kind)).toEqual(['request-to-operator'])
    expect(unposted[0].nextStep).toMatch(/another machine/)
    expect(unposted[0].nextStep).toMatch(/not posted/)
    const lost = findAbandoned({ ...empty, requests: [{ ...r, remote: 'lost' as const }] })
    expect(lost[0].nextStep).toMatch(/has not answered/)
    expect(lost[0].nextStep).toMatch(/closes nothing/)
  })

  it('CO-409: a request a run left outcome_unknown shows at once, in words of its own', () => {
    const r = { requestId: 'r2', targetProjectId: 'p2', requesterProjectId: 'p1', movedAt: ago(MIN), answerUnreadSince: null }
    const f = findAbandoned({ ...empty, requests: [{ ...r, state: 'outcome_unknown' }] })
    expect(f.map((x) => x.kind)).toEqual(['request-outcome-unknown'])
    expect(f[0]).toMatchObject({ requestId: 'r2', projectId: 'p2' })
    expect(f[0].nextStep).toMatch(/com\.reconcile/)
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
    expect(nudgeText(found[0])).toBe('Fabric: this session has been changing files between its turns for 12 min and holds no claim. Claim the task you are working on (fabric_work_claim): its taskId, or a new row with a title and its origin.')
    expect(nudgeText(found[0])).not.toContain('\u2014')
  })

  it('is not found for a session that holds a claim, a managed launch or a Fabric terminal with a task', () => {
    const turns = [turn('s1', 3 * MIN, 3), turn('s1', 2 * MIN, 4)]
    expect(findAbandoned({ ...empty, turns }).map((f) => f.kind)).toEqual(['work-unclaimed'])
    expect(findAbandoned({ ...empty, turns, claims: [live('s1')] })).toEqual([])
    expect(findAbandoned({ ...empty, turns, heldSessions: ['s1'] })).toEqual([])
    expect(findAbandoned({ ...empty, turns, terminals: [{ sessionId: 's1', projectId: 'p1', taskId: 't1', liveness: 'active', since: ago(MIN), lastActivityAt: NOW }] })).toEqual([])
  })

  it('is not found for turns that changed nothing, could not say, or are older than the window', () => {
    expect(findAbandoned({ ...empty, turns: [turn('s1', 2 * MIN, 0), turn('s1', MIN, 0), turn('s2', 2 * MIN, null), turn('s2', MIN, 3),
      turn('s3', TURN_WINDOW_MS + 1000, 5), turn('s3', MIN, 6)] })).toEqual([])
  })

  it('the 0.3.14 review, iteration 1, DA-2: a dirty tree that does not change between turns is not told; a change in its lines is', () => {
    const dirty = [turn('s1', 14 * MIN, 4), turn('s1', 9 * MIN, 4), turn('s1', 4 * MIN, 4), turn('s1', MIN, 4)]
    expect(findAbandoned({ ...empty, turns: dirty })).toEqual([])
    expect(findAbandoned({ ...empty, turns: [turn('s1', 5 * MIN, 4)] }), 'one turn shows no change').toEqual([])
    const lines = [{ ...turn('s1', 5 * MIN, 4), linesAdded: 10, linesRemoved: 0 }, { ...turn('s1', MIN, 4), linesAdded: 12, linesRemoved: 0 }]
    expect(findAbandoned({ ...empty, turns: lines }).map((f) => [f.kind, f.stillMs])).toEqual([['work-unclaimed', 5 * MIN]])
  })

  it('is one finding per session, and every kind is listed for the receipt', () => {
    const found = findAbandoned({ ...empty, turns: [turn('s1', 3 * MIN, 1), turn('s1', 2 * MIN, 2), turn('s1', MIN, 3), turn('s2', 2 * MIN, 1, 'p2'), turn('s2', MIN, 2, 'p2')] })
    expect(found.map((f) => f.key).sort()).toEqual(['work-unclaimed:s1', 'work-unclaimed:s2'])
    expect(ABANDONED_KINDS).toContain('work-unclaimed')
  })
})

// 0.3.14 wave 2: 145 of 149 tasks in the live audit had no brief; a claimed task is reminded of its missing sections.
describe('brief-missing: a claimed task whose brief is not written', () => {
  const claim = (over = {}) => ({ claimId: 'c1', taskId: 't1', projectId: 'p1', sessionId: 's1', expiresAt: ago(-20 * MIN), claimedAt: ago(BRIEF_AFTER_MS), renewedAt: null, session: { lastSignAt: NOW }, ...over })

  it('is found ten minutes after the claim, naming the missing sections and fabric_task_brief', () => {
    const found = findAbandoned({ ...empty, claims: [claim()], briefGaps: { t1: ['why', 'expected'] } })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ kind: 'brief-missing', key: 'brief-missing:c1', sessionId: 's1', taskId: 't1', claimId: 'c1' })
    expect(nudgeText(found[0])).toBe('Fabric: task t1 you claimed has been in work for 10 min with its brief incomplete. Its brief is missing why, expected: write each with fabric_task_brief (what: what should happen; why: why it matters; expected: what is true when it is done), so the operator and the next agent can read the task.')
    expect(nudgeText(found[0])).not.toContain('\u2014')
  })

  it('is not found for a younger claim, a whole brief, a brief not read, or a claim that lapsed or expired', () => {
    expect(findAbandoned({ ...empty, claims: [claim({ claimedAt: ago(BRIEF_AFTER_MS - 1000) })], briefGaps: { t1: ['why'] } })).toEqual([])
    expect(findAbandoned({ ...empty, claims: [claim()], briefGaps: { t1: [] } })).toEqual([])
    expect(findAbandoned({ ...empty, claims: [claim()] })).toEqual([])
    expect(findAbandoned({ ...empty, claims: [claim({ session: null })], briefGaps: { t1: ['why'] } }).map((f) => f.kind)).toEqual(['claim-lapsed'])
    expect(findAbandoned({ ...empty, claims: [claim({ expiresAt: ago(MIN), session: { lastSignAt: NOW } })], briefGaps: { t1: ['why'] } })).toEqual([])
  })
})

// CO-462: a session Fabric launched for a task holds it with no claim; it is the one that must write the brief.
describe('brief-missing: a task Fabric launched a session for, with no claim', () => {
  const launch = (over = {}) => ({ sessionId: 's9', projectId: 'p1', taskId: 't9', movedAt: ago(BRIEF_AFTER_MS), ...over })

  it('is told to the launched session ten minutes after the task went to running', () => {
    const found = findAbandoned({ ...empty, launches: [launch()], briefGaps: { t9: ['what'] } })
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ kind: 'brief-missing', key: 'brief-missing:launch:t9:s9', sessionId: 's9', taskId: 't9', claimId: null })
    expect(nudgeText(found[0])).toContain('task t9 Fabric started you on has been in work for 10 min')
    expect(nudgeText(found[0])).not.toContain('you claimed')
  })

  it('is not told before ten minutes, for a whole brief, or when the brief was not read', () => {
    expect(findAbandoned({ ...empty, launches: [launch({ movedAt: ago(BRIEF_AFTER_MS - 1000) })], briefGaps: { t9: ['what'] } })).toEqual([])
    expect(findAbandoned({ ...empty, launches: [launch()], briefGaps: { t9: [] } })).toEqual([])
    expect(findAbandoned({ ...empty, launches: [launch()] })).toEqual([])
  })
})

// CO-499: a claim a living session keeps renewing on a task already out of work (review, done, back to the queue).
describe('claim-closed (CO-499)', () => {
  const claim = { claimId: 'c9', taskId: 't9', projectId: 'p1', sessionId: 's9', expiresAt: ago(-30 * MIN), claimedAt: ago(5 * 24 * 60 * MIN), renewedAt: ago(MIN), session: { lastSignAt: NOW - MIN } }
  it('is found for a live claim whose task left work, and is the agent\'s alone', () => {
    for (const taskStatus of ['review', 'done', 'cancelled', 'backlog']) {
      const found = findAbandoned({ ...empty, claims: [{ ...claim, taskStatus, taskMovedAt: ago(MIN) }] })
      expect(found.map((f) => f.kind), taskStatus).toEqual(['claim-closed'])
      expect(found[0]).toMatchObject({ key: 'claim-closed:c9', claimId: 'c9', sessionId: 's9', taskId: 't9' })
      expect(found[0].nextStep).toContain(taskStatus)
    }
    expect(AGENT_ONLY_KINDS.has('claim-closed')).toBe(true)
  })
  it('is not found while the task runs, or when its state was not read or is unknown', () => {
    expect(findAbandoned({ ...empty, claims: [{ ...claim, taskStatus: 'running' }] })).toEqual([])
    expect(findAbandoned({ ...empty, claims: [claim] })).toEqual([])
    expect(findAbandoned({ ...empty, claims: [{ ...claim, taskStatus: 'unknown' }] })).toEqual([])
  })
  it('wins over the claim\'s other judgements, so it is let go at once, not after two sweeps', () => {
    expect(findAbandoned({ ...empty, claims: [{ ...claim, session: null, taskStatus: 'review', taskMovedAt: ago(MIN) }] }).map((f) => f.kind)).toEqual(['claim-closed'])
  })
  it('0.3.16 review, ER-11: a claim taken on a task already in review or backlog is kept; done and cancelled always let go', () => {
    for (const taskStatus of ['review', 'backlog']) {
      expect(findAbandoned({ ...empty, claims: [{ ...claim, taskStatus, taskMovedAt: ago(6 * 24 * 60 * MIN) }] }).map((f) => f.kind), taskStatus).not.toContain('claim-closed')
      expect(findAbandoned({ ...empty, claims: [{ ...claim, taskStatus, taskMovedAt: null }] }).map((f) => f.kind), taskStatus).not.toContain('claim-closed')
    }
    for (const taskStatus of ['done', 'cancelled'])
      expect(findAbandoned({ ...empty, claims: [{ ...claim, taskStatus, taskMovedAt: ago(6 * 24 * 60 * MIN) }] }).map((f) => f.kind)).toEqual(['claim-closed'])
  })
})

describe('claim-overlap (CO-522 wave B): two live claims that run into each other are told to both sessions', () => {
  const live = (id: string, session: string, related: Array<{ claimId: string; taskId: string; sessionId: string; why: string }> = []) => ({ claimId: id, taskId: `t-${id}`, projectId: 'p1', sessionId: session,
    expiresAt: new Date(NOW + 30 * MIN).toISOString(), claimedAt: ago(5 * MIN), renewedAt: null, session: { lastSignAt: NOW - MIN }, related })
  it('each holder is told whose task overlaps its own and why, once per pair; agent-only, never the person\'s queue', () => {
    const found = findAbandoned({ ...empty, claims: [
      live('a', 's-a', [{ claimId: 'b', taskId: 't-b', sessionId: 's-b', why: 'you touch src/main and they touch src/main/hub.ts' }]),
      live('b', 's-b', [{ claimId: 'a', taskId: 't-a', sessionId: 's-a', why: 'you touch src/main/hub.ts and they touch src/main' }])
    ] }).filter((f) => f.kind === 'claim-overlap')
    expect(found.map((f) => [f.sessionId, f.key])).toEqual([['s-a', 'claim-overlap:a:b'], ['s-b', 'claim-overlap:b:a']])
    expect(found[0]!.nextStep).toMatch(/t-b.*s-b.*src\/main\/hub\.ts/)
    expect(found[0]!.nextStep).toMatch(/askHandover|fabric_task_link/)
    expect(AGENT_ONLY_KINDS.has('claim-overlap')).toBe(true)
    expect(ABANDONED_KINDS).toContain('claim-overlap')
  })
  it('a claim whose session Fabric no longer holds, or that expired, is not told', () => {
    const rel = [{ claimId: 'b', taskId: 't-b', sessionId: 's-b', why: 'the same backlog row, B-1 (BACKLOG.md)' }]
    expect(findAbandoned({ ...empty, claims: [{ ...live('a', 's-a', rel), session: null }] }).filter((f) => f.kind === 'claim-overlap')).toEqual([])
    expect(findAbandoned({ ...empty, claims: [{ ...live('a', 's-a', rel), expiresAt: ago(MIN) }] }).filter((f) => f.kind === 'claim-overlap')).toEqual([])
  })
})

describe('overlap-unsettled (CO-522 wave B part 2): an overlap that stands is the person\'s to decide', () => {
  const at = (min: number) => ago(min * MIN)
  const pair = (aMin: number, bMin: number) => [
    { claimId: 'a', taskId: 't-a', projectId: 'p1', sessionId: 's-a', expiresAt: new Date(NOW + 30 * MIN).toISOString(), claimedAt: at(aMin), renewedAt: null,
      session: { lastSignAt: NOW - MIN }, related: [{ claimId: 'b', taskId: 't-b', sessionId: 's-b', why: 'the same task', claimedAt: at(bMin) }] },
    { claimId: 'b', taskId: 't-b', projectId: 'p1', sessionId: 's-b', expiresAt: new Date(NOW + 30 * MIN).toISOString(), claimedAt: at(bMin), renewedAt: null,
      session: { lastSignAt: NOW - MIN }, related: [{ claimId: 'a', taskId: 't-a', sessionId: 's-a', why: 'the same task', claimedAt: at(aMin) }] }
  ]
  it('after fifteen minutes one item for the pair, on the session that came second; never before', () => {
    const found = findAbandoned({ ...empty, claims: pair(40, 20) }).filter((f) => f.kind === 'overlap-unsettled')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ key: 'overlap-unsettled:a:b', sessionId: 's-b', taskId: 't-b', claimId: 'b' })
    expect(AGENT_ONLY_KINDS.has('overlap-unsettled')).toBe(false)
    expect(findAbandoned({ ...empty, claims: pair(40, 10) }).filter((f) => f.kind === 'overlap-unsettled')).toEqual([])
  })
  it('once decided, no item; each session is told the decision under a new key, the second one what it does', () => {
    const found = findAbandoned({ ...empty, claims: pair(40, 20), decidedOverlaps: new Map([['a:b', 'wait']]) })
    expect(found.filter((f) => f.kind === 'overlap-unsettled')).toEqual([])
    const told = found.filter((f) => f.kind === 'claim-overlap')
    expect(told.map((f) => f.key)).toEqual(['claim-overlap:a:b:wait', 'claim-overlap:b:a:wait'])
    expect(told.find((f) => f.sessionId === 's-b')!.nextStep).toMatch(/decided you wait.*t-a/)
    expect(told.find((f) => f.sessionId === 's-a')!.nextStep).toMatch(/s-b waits for you/)
  })
})
