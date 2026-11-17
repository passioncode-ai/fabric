import { describe, expect, it } from 'vitest'
import { HANDBACK_HOWS, claimsToHandBack, type LeftClaim, type HandBackTask } from './resumedClaims'
import { RESUME_WINDOW_MS } from './boardResume'

// The resumed-claims fix (on-demand spec §3.12): a coding-agent session resumed after a usage limit under the same
// runtime session id takes back the claims its earlier Fabric session left when it ended.
const NOW = Date.parse('2026-11-16T22:00:00Z')
const MIN = 60_000
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const left = (over: Partial<LeftClaim> = {}): LeftClaim => ({
  claimId: 'c-1', taskId: 't-1', ownerSession: 's-old', releasedAt: ago(5 * 60 * MIN), how: 'session-ended', touches: ['src/a.ts'], workflowId: null, ...over
})
const task = (over: Partial<HandBackTask> = {}): HandBackTask => ({
  id: 't-1', status: 'backlog', movedAt: ago(5 * 60 * MIN), movedByKind: 'system', newestClaimId: 'c-1', runHeld: false, ...over
})
const run = (claims: LeftClaim[], tasks: HandBackTask[], earlier = ['s-old']) =>
  claimsToHandBack({ earlierSessions: new Set(earlier), left: claims, tasks: new Map(tasks.map((t) => [t.id, t])), now: NOW })

describe('claimsToHandBack', () => {
  it('gives back a claim an earlier session of the same runtime session left when it ended or lapsed', () => {
    for (const how of HANDBACK_HOWS) expect(run([left({ how })], [task()]).map((c) => c.claimId)).toEqual(['c-1'])
    expect(run([left()], [task({ status: 'running' })])).toHaveLength(1)
  })

  it('never gives back work the session let go, handed over, finished or the operator released', () => {
    for (const how of ['let-go', 'handed-over', 'done', 'operator', null]) expect(run([left({ how })], [task()])).toEqual([])
  })

  it('never gives back a claim of another session, one older than the week, or a task taken, closed, held by a run or moved by a person since', () => {
    expect(run([left({ ownerSession: 's-stranger' })], [task()])).toEqual([])
    expect(run([left({ releasedAt: ago(RESUME_WINDOW_MS + MIN) })], [task()])).toEqual([])
    expect(run([left()], [task({ newestClaimId: 'c-later' })]), 'someone claimed it after the release').toEqual([])
    for (const status of ['review', 'done', 'cancelled']) expect(run([left()], [task({ status })])).toEqual([])
    expect(run([left()], [task({ runHeld: true })])).toEqual([])
    expect(run([left()], [task({ movedByKind: 'person', movedAt: ago(MIN) })])).toEqual([])
    expect(run([left()], [task({ movedByKind: 'person', movedAt: ago(6 * 60 * MIN) })]), 'a person\'s move before the release decides nothing').toHaveLength(1)
    expect(run([left()], []), 'a task that cannot be read').toEqual([])
  })

  it('gives each task back once, the oldest release first', () => {
    const r = run([left({ claimId: 'c-2', taskId: 't-2', releasedAt: ago(60 * MIN) }), left()],
      [task(), task({ id: 't-2', newestClaimId: 'c-2' })])
    expect(r.map((c) => c.taskId)).toEqual(['t-1', 't-2'])
  })
})
