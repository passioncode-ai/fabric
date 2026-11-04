// CO-409, wave 1: the dispatcher's decision. Spec: docs/evidence/specs/2026-11-04-on-demand-sessions.md (§3.1, §3.3,
// §3.4, §3.5, §3.6).
import { describe, expect, it } from 'vitest'
import { decideDispatch, firstLine, parseFirstLine, refusalCheck, runEndsAt, DISPATCH_DEFAULTS, GRACE_MS, type DispatchInput } from './boardDispatch'

const NOW = Date.parse('2026-11-04T15:00:00Z')
const MIN = 60_000
const base: DispatchInput = {
  now: NOW,
  request: { id: 'r1', state: 'queued', submittedAt: new Date(NOW - 5 * MIN).toISOString(), deadline: new Date(NOW + 7 * 24 * 60 * MIN).toISOString(), urgent: false, holderLive: false, attemptLapsed: false },
  liveResponder: false,
  liveSession: false,
  switchOn: true,
  hasFolder: true,
  runningOnMachine: 0,
  runningInProject: 0,
  dispatchesToday: 0,
  emptyRuns: 0,
  inFlight: false
}
const with_ = (over: Partial<DispatchInput>, req: Partial<DispatchInput['request']> = {}): DispatchInput => ({ ...base, ...over, request: { ...base.request, ...req } })

describe('decideDispatch (§3.1–§3.3)', () => {
  it('a live responder takes it and nothing is started', () => {
    expect(decideDispatch(with_({ liveResponder: true }))).toEqual({ path: 'responder' })
  })
  it('a live session of the project is woken by message inside the grace, and absent after it', () => {
    expect(decideDispatch(with_({ liveSession: true }, { submittedAt: new Date(NOW - MIN).toISOString() }))).toEqual({ path: 'live-session' })
    expect(decideDispatch(with_({ liveSession: true }, { submittedAt: new Date(NOW - GRACE_MS - 1).toISOString() })).path).toBe('launch')
  })
  it('waits for the grace before starting anything, unless the asker marked it urgent', () => {
    const young = { submittedAt: new Date(NOW - MIN).toISOString() }
    expect(decideDispatch(with_({}, young))).toEqual({ path: 'wait', check: 'grace' })
    expect(decideDispatch(with_({}, { ...young, urgent: true })).path).toBe('launch')
  })
  it('starts a session for a queued request with nobody on it', () => {
    expect(decideDispatch(base)).toEqual({ path: 'launch' })
  })
  it('takes a claimed request only when its attempt lapsed, and accepted or in_progress only with no live holder', () => {
    expect(decideDispatch(with_({}, { state: 'claimed' })).path).toBe('none')
    expect(decideDispatch(with_({}, { state: 'claimed', attemptLapsed: true })).path).toBe('launch')
    expect(decideDispatch(with_({}, { state: 'in_progress', holderLive: true })).path).toBe('none')
    expect(decideDispatch(with_({}, { state: 'in_progress' })).path).toBe('launch')
    expect(decideDispatch(with_({}, { state: 'accepted', holderLive: true })).path).toBe('none')
    expect(decideDispatch(with_({}, { state: 'accepted' })).path).toBe('launch')
    // An accepted request left by two empty runs goes to the operator like any other (§3.6, option (b)).
    expect(decideDispatch(with_({ emptyRuns: 2 }, { state: 'accepted' }))).toEqual({ path: 'to-operator' })
  })
  it('never starts for a settled or expired request, or past the board deadline', () => {
    for (const state of ['completed', 'failed_known', 'expired', 'cancelled', 'answered'] as const)
      expect(decideDispatch(with_({}, { state })).path, state).toBe('none')
    expect(decideDispatch(with_({}, { deadline: new Date(NOW - 1).toISOString() })).path).toBe('none')
  })
  it('a dispatch in flight is never doubled (idempotent by request)', () => {
    expect(decideDispatch(with_({ inFlight: true }))).toEqual({ path: 'none' })
  })
  it('stops after two empty runs and shows it to the operator, the request unchanged (§3.6, option (b))', () => {
    expect(decideDispatch(with_({ emptyRuns: 1 })).path).toBe('launch')
    expect(decideDispatch(with_({ emptyRuns: 2 }))).toEqual({ path: 'to-operator' })
  })
  it('checks in the order of §3.3 and names the check that stopped it', () => {
    expect(decideDispatch(with_({ switchOn: false, hasFolder: false }))).toEqual({ path: 'skip', check: 'skipped-off' })
    expect(decideDispatch(with_({ hasFolder: false, runningOnMachine: 9 }))).toEqual({ path: 'skip', check: 'skipped-no-folder' })
    expect(decideDispatch(with_({ runningOnMachine: DISPATCH_DEFAULTS.maxOnMachine, runningInProject: 5 }))).toEqual({ path: 'wait', check: 'deferred-cap' })
    expect(decideDispatch(with_({ runningInProject: DISPATCH_DEFAULTS.maxPerProject, dispatchesToday: 99 }))).toEqual({ path: 'wait', check: 'deferred-project-busy' })
    expect(decideDispatch(with_({ dispatchesToday: DISPATCH_DEFAULTS.maxPerProjectPerDay }))).toEqual({ path: 'skip', check: 'skipped-daily-cap' })
  })
  it('the limits can be set, never below one', () => {
    expect(decideDispatch(with_({ runningOnMachine: 2, limits: { maxOnMachine: 3 } })).path).toBe('launch')
    expect(decideDispatch(with_({ runningOnMachine: 0, limits: { maxOnMachine: 0 } })).path).toBe('launch')
  })
})

describe('runEndsAt (§3.4)', () => {
  it('is the earlier of launch plus the limit and the deadline', () => {
    expect(runEndsAt(NOW, 60, new Date(NOW + 7 * 24 * 60 * MIN).toISOString())).toBe(new Date(NOW + 60 * MIN).toISOString())
    expect(runEndsAt(NOW, 60, new Date(NOW + 10 * MIN).toISOString())).toBe(new Date(NOW + 10 * MIN).toISOString())
  })
})

describe('the first line (§3.5)', () => {
  const ids = { workflow: 'wf_0123456789abcdef', handoff: 'handoff:abc123', request: '1b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d' }
  it('is exact and reads back', () => {
    const line = firstLine(ids)
    expect(line).toBe('fabric-dispatch/1 workflow=wf_0123456789abcdef handoff=handoff:abc123 request=1b8c2a3e-5d6f-4a1b-9c7d-2e3f4a5b6c7d')
    expect(parseFirstLine(line)).toEqual(ids)
  })
  it('refuses a workflow id that is not wf_ and 16 hex digits, and any other order or spacing', () => {
    expect(() => firstLine({ ...ids, workflow: 'wf_xyz' })).toThrow()
    expect(parseFirstLine('fabric-dispatch/1 handoff=h workflow=wf_0123456789abcdef request=r')).toBeNull()
    expect(parseFirstLine('fabric-dispatch/1  workflow=wf_0123456789abcdef handoff=h request=r')).toBeNull()
    expect(parseFirstLine('hello')).toBeNull()
  })
})

describe('refusalCheck (§3.5)', () => {
  it('maps Switchboard refusals onto the checks of §3.3', () => {
    expect(refusalCheck('no_agent')).toBe('deferred-no-agent')
    expect(refusalCheck('not_in_group')).toBe('skipped-no-folder')
    expect(refusalCheck('ceiling_reached')).toBe('deferred-cap')
    expect(refusalCheck('spend_unknown')).toBe('deferred-cap')
    expect(refusalCheck('agent_not_installed')).toBe('failed-to-start')
    expect(refusalCheck('something_new')).toBe('failed-to-start')
  })
})
