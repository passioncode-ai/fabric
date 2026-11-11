// CO-409, wave 1: the dispatcher's decision. Spec: docs/evidence/specs/2026-11-04-on-demand-sessions.md (§3.1, §3.3,
// §3.4, §3.5, §3.6).
import { describe, expect, it } from 'vitest'
import { sessionLiveForDispatch, checkRunResult, decideDispatch, dispatchTargetOf, dispatchTargetsOf, remoteOwnerOf, targetForOwner, firstLine, packetDeadline, parseFirstLine, refusalCheck, relayText, runEndsAt, PACKET_HORIZON_MS, DISPATCH_DEFAULTS, GRACE_MS, LAUNCH_MARGIN_MS, REMOTE_REFUSALS, RESULT_MAX_BYTES, RUN_END_TO_DEADLINE_MS, type DispatchInput } from './boardDispatch'

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
  it('0.3.16 review (ER-5, DO-2): a project with a live session never gets a second agent, inside the grace or after it', () => {
    expect(decideDispatch(with_({ liveSession: true }, { submittedAt: new Date(NOW - MIN).toISOString() }))).toEqual({ path: 'live-session' })
    expect(decideDispatch(with_({ liveSession: true }, { submittedAt: new Date(NOW - GRACE_MS - 1).toISOString() }))).toEqual({ path: 'live-session' })
    expect(decideDispatch(with_({ liveSession: false }, { submittedAt: new Date(NOW - GRACE_MS - 1).toISOString() })).path).toBe('launch')
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
    expect(decideDispatch(with_({ emptyRuns: 3 }, { state: 'accepted' }))).toEqual({ path: 'to-operator' })
  })
  it('never starts for a settled or expired request, or past the board deadline', () => {
    for (const state of ['completed', 'failed_known', 'expired', 'cancelled', 'answered'] as const)
      expect(decideDispatch(with_({}, { state })).path, state).toBe('none')
    expect(decideDispatch(with_({}, { deadline: new Date(NOW - 1).toISOString() })).path).toBe('none')
  })
  it('starts nothing within five minutes of the deadline; past it an unsettled accepted or in-progress request with nobody on it goes to the operator', () => {
    expect(decideDispatch(with_({}, { deadline: new Date(NOW + LAUNCH_MARGIN_MS - 1).toISOString() })).path).toBe('none')
    expect(decideDispatch(with_({}, { deadline: new Date(NOW + LAUNCH_MARGIN_MS).toISOString() })).path).toBe('launch')
    const past = { deadline: new Date(NOW - 1).toISOString() }
    expect(decideDispatch(with_({}, { ...past, state: 'accepted' }))).toEqual({ path: 'to-operator' })
    expect(decideDispatch(with_({}, { ...past, state: 'in_progress' }))).toEqual({ path: 'to-operator' })
    expect(decideDispatch(with_({}, { ...past, state: 'accepted', holderLive: true })).path).toBe('none')
    // queued and claimed expire by the contract itself.
    expect(decideDispatch(with_({}, { ...past, state: 'queued' })).path).toBe('none')
  })

  it('a run leaves a request accepted only when the deadline is far enough past its end for the next run to start', () => {
    // The latest decision after a run's end: 120 s of silence, a 60 s cycle; it must still leave LAUNCH_MARGIN_MS.
    expect(RUN_END_TO_DEADLINE_MS).toBeGreaterThanOrEqual(120_000 + 60_000 + LAUNCH_MARGIN_MS)
  })

  it('a dispatch in flight is never doubled (idempotent by request)', () => {
    expect(decideDispatch(with_({ inFlight: true }))).toEqual({ path: 'none' })
  })
  it('stops after three empty runs (CO-559) and shows it to the operator, the request unchanged (§3.6, option (b))', () => {
    expect(decideDispatch(with_({ emptyRuns: 2 })).path).toBe('launch')
    expect(decideDispatch(with_({ emptyRuns: 3 }))).toEqual({ path: 'to-operator' })
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

describe('packetDeadline (Observatory refuses a packet deadline more than seven days after its write)', () => {
  const at = (ms: number) => new Date(ms).toISOString()
  it('keeps a deadline within seven days of the write', () => {
    expect(packetDeadline(at(NOW + 3 * 24 * 60 * MIN), NOW)).toBe(at(NOW + 3 * 24 * 60 * MIN))
  })
  it('keeps the board\'s default deadline, 168 hours after the request, once the grace has passed (DA-13, ER-24)', () => {
    const submitted = NOW - GRACE_MS
    expect(packetDeadline(at(submitted + 7 * 24 * 60 * MIN), NOW)).toBe(at(submitted + 7 * 24 * 60 * MIN))
  })
  it('cuts a far deadline to the write plus the horizon, so the workflow opens (986 refusals DeadlineTooFar for 28 requests on 2026-11-09)', () => {
    expect(packetDeadline(at(NOW + 12 * 24 * 60 * MIN), NOW)).toBe(at(NOW + PACKET_HORIZON_MS))
    expect(Date.parse(packetDeadline(at(NOW + 12 * 24 * 60 * MIN), NOW)) - NOW).toBeLessThanOrEqual(7 * 24 * 60 * MIN)
  })
  it('never gives a deadline already past to a request older than a week (DA-14, ER-25)', () => {
    expect(Date.parse(packetDeadline(at(NOW + 20 * 24 * 60 * MIN), NOW))).toBeGreaterThan(NOW)
  })
  it('keeps an unreadable value as it is (the board never sends one; the open then fails and backs off)', () => {
    expect(packetDeadline('not a date', NOW)).toBe('not a date')
  })
})

describe('runEndsAt (§3.4)', () => {
  it('is the earlier of launch plus the limit and the deadline', () => {
    expect(runEndsAt(NOW, 60, new Date(NOW + 7 * 24 * 60 * MIN).toISOString())).toBe(new Date(NOW + 60 * MIN).toISOString())
    expect(runEndsAt(NOW, 60, new Date(NOW + 10 * MIN).toISOString())).toBe(new Date(NOW + 10 * MIN).toISOString())
  })

  it('ends at the limit when the deadline cannot be read, rather than throwing and ending the whole pass (CO-512)', () => {
    expect(runEndsAt(NOW, 60, 'not a date')).toBe(new Date(NOW + 60 * MIN).toISOString())
    expect(runEndsAt(NOW, 60, '')).toBe(new Date(NOW + 60 * MIN).toISOString())
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

// CO-551, stage A: a run on another machine answers through the dispatcher. Its result file, as fabric-switchboard's
// SB-317 writes it (board thread `14d6cb73`, `f75293e0`), is checked against the ids Fabric passed before anything is posted.
describe('the result of a run on another machine (CO-551)', () => {
  const ids = { workflow: 'wf_0123456789abcdef', handoff: 'handoff:0123456789abcdef', request: '11111111-1111-4111-8111-111111111111', launch: 'L-7' }
  const file = (over: Record<string, string | null> = {}): string => {
    const o = { ...ids, outcome: 'answered', branch: 'feat/x', commit: 'abc1234', body: 'Готово.\n\nВторая строка.', ...over }
    return [`fabric-dispatch/1 result workflow=${o.workflow} handoff=${o.handoff} request=${o.request} launch=${o.launch}`,
      `outcome=${o.outcome}`, ...(o.branch ? [`branch=${o.branch}`] : []), ...(o.commit ? [`commit=${o.commit}`] : []), '', o.body ?? ''].join('\n')
  }
  it('a file whose four ids are the ones Fabric passed is read: outcome, branch, commit and the answer', () => {
    expect(checkRunResult(file(), ids)).toEqual({ ok: true, result: { ...ids, outcome: 'answered', branch: 'feat/x', commit: 'abc1234', body: 'Готово.\n\nВторая строка.' } })
    expect(checkRunResult(file({ branch: null, commit: null }), ids)).toMatchObject({ ok: true, result: { branch: null, commit: null } })
    expect(checkRunResult(file().replace(/\n/g, '\r\n'), ids)).toMatchObject({ ok: true, result: { outcome: 'answered' } })
  })
  it('another workflow, hand-over, request or launch is another run, never posted', () => {
    for (const k of ['workflow', 'handoff', 'request', 'launch'] as const) {
      const other = { workflow: 'wf_fedcba9876543210', handoff: 'handoff:fedcba9876543210', request: '33333333-3333-4333-8333-333333333333', launch: 'L-8' }[k]
      expect(checkRunResult(file({ [k]: other }), ids)).toEqual({ ok: false, reason: 'other-run' })
    }
  })
  it('a file in another shape is unreadable; an answer with no text and an outcome it does not know are refused', () => {
    expect(checkRunResult('', ids)).toEqual({ ok: false, reason: 'unreadable' })
    expect(checkRunResult(file().replace('fabric-dispatch/1 result', 'fabric-dispatch/1'), ids)).toEqual({ ok: false, reason: 'unreadable' })
    expect(checkRunResult(` ${file()}`, ids)).toEqual({ ok: false, reason: 'unreadable' })
    expect(checkRunResult(file().replace('outcome=answered\n', ''), ids)).toEqual({ ok: false, reason: 'no-outcome' })
    expect(checkRunResult(file({ outcome: 'done' }), ids)).toEqual({ ok: false, reason: 'no-outcome' })
    expect(checkRunResult(file().replace('branch=feat/x', 'branch=feat/x\nbranch=feat/y'), ids)).toEqual({ ok: false, reason: 'unreadable' })
    expect(checkRunResult(file().replace('branch=feat/x', 'secret=1'), ids)).toEqual({ ok: false, reason: 'unreadable' })
    expect(checkRunResult(file({ body: '  ' }), ids)).toEqual({ ok: false, reason: 'empty-answer' })
    // failed and blocked need no answer text: nothing is posted for them.
    expect(checkRunResult(file({ outcome: 'blocked', body: '' }), ids)).toMatchObject({ ok: true, result: { outcome: 'blocked' } })
    expect(checkRunResult(`${file()}${'x'.repeat(RESULT_MAX_BYTES)}`, ids)).toEqual({ ok: false, reason: 'too-large' })
  })
  it('the relayed reply names the launch and the machine, then carries the answer as written', () => {
    const r = checkRunResult(file(), ids)
    if (!r.ok) throw new Error('unreadable')
    const text = relayText(r.result, 'studio')
    expect(text.startsWith('_Ретрансляция запуска `L-7` с машины `studio`')).toBe(true)
    expect(text).toContain('ветка `feat/x`, коммит `abc1234`')
    expect(text).toContain('агент ответил (`answered`)') // 0.3.19 review UX-10
    expect(text.endsWith('\n\nГотово.\n\nВторая строка.')).toBe(true)
    expect(text.includes('\u2014')).toBe(false)
  })
  it('the refusals that send a run back to this machine are the three agreed on the board', () => {
    expect([...REMOTE_REFUSALS].sort()).toEqual(['not_on_target', 'target_busy', 'target_unreachable'])
  })
  it('the machine named in Settings is an ssh host name, never an option, a space or auto', () => {
    expect(dispatchTargetOf('studio')).toBe('studio')
    expect(dispatchTargetOf('ops@build-host')).toBe('ops@build-host')
    for (const v of ['', 'auto', '-oProxyCommand=x', 'two words', 'a;b', 42, null, undefined, 'x'.repeat(300)]) expect(dispatchTargetOf(v)).toBeNull()
  })
})

describe('sessionLiveForDispatch (CO-559, the scenario walk)', () => {
  it('a running terminal or a session that signed within the window is live; a silent one is not', () => {
    const now = NOW
    expect(sessionLiveForDispatch([], now, 10 * MIN)).toBe(false)
    expect(sessionLiveForDispatch([{ console: true, lastSignAt: now - 60 * MIN, startedAt: now - 90 * MIN }], now, 10 * MIN)).toBe(true)
    expect(sessionLiveForDispatch([{ lastSignAt: now - 5 * MIN, startedAt: now - 90 * MIN }], now, 10 * MIN)).toBe(true)
    expect(sessionLiveForDispatch([{ lastSignAt: now - 11 * MIN, startedAt: now - 90 * MIN }], now, 10 * MIN)).toBe(false)
    expect(sessionLiveForDispatch([{ lastSignAt: null, startedAt: now - 2 * MIN }], now, 10 * MIN)).toBe(true)
  })
})

describe('dispatchTargets: the machine by the owner of the project\'s repository (2026-11-11)', () => {
  it('keeps owner names and ssh hosts, drops anything else, and matches owners without case', () => {
    expect(dispatchTargetsOf({ 'owner-a': 'node-a', 'Owner-C': 'node-b', bad: '-oProxyCommand=x', '': 'h', x: 'auto' }))
      .toEqual({ 'owner-a': 'node-a', 'owner-c': 'node-b' })
    expect(dispatchTargetsOf(['a'])).toEqual({})
    expect(dispatchTargetsOf(null)).toEqual({})
  })
  it('reads the owner of ssh and https remotes', () => {
    expect(remoteOwnerOf('git@github.com:owner-b/fabric.git')).toBe('owner-b')
    expect(remoteOwnerOf('https://github.com/Owner-C/owner-d-data-agent')).toBe('owner-c')
    expect(remoteOwnerOf('https://bitbucket.org/owner-e/esim.git\n')).toBe('owner-e')
    expect(remoteOwnerOf('')).toBeNull()
  })
  it('takes the owner\'s machine, else the one fallback, else this machine', () => {
    const t = { 'owner-a': 'node-a' }
    expect(targetForOwner('owner-a', t, 'node-b')).toBe('node-a')
    expect(targetForOwner('other', t, 'node-b')).toBe('node-b')
    expect(targetForOwner('constructor', t, 'node-b')).toBe('node-b') // PL-17: never an object built-in
    expect(targetForOwner(null, t, null)).toBeNull()
  })
})
