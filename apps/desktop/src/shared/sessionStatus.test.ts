// A session's status from the signals Fabric already has (the operator's second review, 2026-10-26, v2 §4.5, R-19):
// observed first, the agent's own word second; the first that holds wins.
import { describe, expect, it } from 'vitest'
import { sessionStatus, PHASE_FRESH_MS } from './sessionStatus.ts'

const T0 = Date.parse('2026-10-26T12:00:00Z')
const iso = (ms: number): string => new Date(ms).toISOString()
const fresh = { phaseAt: iso(T0 - 60_000), heardAt: iso(T0 - 60_000), now: T0 }

describe('sessionStatus', () => {
  it('is an error when a console ended with a failure or the agent says it is stuck', () => {
    expect(sessionStatus({ terminal: { state: 'ended', exitCode: 1 } })).toBe('error')
    expect(sessionStatus({ stale: false, phase: 'blocked', ...fresh })).toBe('error')
  })
  it('is ended when the console ended cleanly', () => {
    expect(sessionStatus({ terminal: { state: 'ended', exitCode: 0 } })).toBe('ended')
  })
  it('ER-19: a console killed by a signal Fabric did not send is an error; Fabric\'s own stop is ended', () => {
    expect(sessionStatus({ terminal: { state: 'ended', exitCode: 0, exitSignal: 9, stoppedByFabric: false } })).toBe('error')
    expect(sessionStatus({ terminal: { state: 'ended', exitCode: 0, exitSignal: 15, stoppedByFabric: true } })).toBe('ended')
    // ER-27 (iteration 3): an agent that answers Fabric's stop by exiting with a code (143, 130) ended, it did not fail.
    expect(sessionStatus({ terminal: { state: 'ended', exitCode: 143, exitSignal: null, stoppedByFabric: true } })).toBe('ended')
    expect(sessionStatus({ terminal: { state: 'ended', exitCode: 130, exitSignal: null, stoppedByFabric: true } })).toBe('ended')
    expect(sessionStatus({ terminal: { state: 'ended', exitCode: 143, exitSignal: null, stoppedByFabric: false } })).toBe('error')
  })
  it('is waiting only when Fabric observed a wait: the agent\'s fresh heartbeat, or an open question', () => {
    expect(sessionStatus({ stale: false, phase: 'waiting', ...fresh })).toBe('waiting')
    expect(sessionStatus({ stale: false, asking: true })).toBe('waiting')
  })
  it('UX-12 (0.3.15 review, iteration 2): an agent judged not at work is idle on every screen, a wait still says so', () => {
    expect(sessionStatus({ stale: false, atWork: false })).toBe('idle')
    expect(sessionStatus({ stale: false, atWork: true })).toBe('working')
    expect(sessionStatus({ stale: false })).toBe('working')
    expect(sessionStatus({ stale: false, atWork: false, asking: true })).toBe('waiting')
  })
  it('DA-5: a Fabric console silent for a minute is idle, never «waiting»', () => {
    expect(sessionStatus({ stale: false, terminal: { state: 'idle', exitCode: null } })).toBe('idle')
  })
  it('ER-18: a heartbeat older than the agent\'s last sign and past the quiet window falls back to what is observed', () => {
    const old = { phase: 'blocked', phaseAt: iso(T0 - 37 * 3600_000), heardAt: iso(T0 - 60_000), now: T0 }
    expect(sessionStatus({ stale: false, ...old })).toBe('working')
    expect(sessionStatus({ stale: false, phase: 'blocked', phaseAt: iso(T0 - PHASE_FRESH_MS + 1000), heardAt: iso(T0), now: T0 })).toBe('error')
    expect(sessionStatus({ stale: false, phase: 'blocked' }), 'a phase with no time is not trusted').toBe('working')
  })
  it('is working with a recent sign, idle when it has gone quiet', () => {
    expect(sessionStatus({ stale: false, terminal: { state: 'running', exitCode: null } })).toBe('working')
    expect(sessionStatus({ stale: false })).toBe('working')
    expect(sessionStatus({ stale: true })).toBe('idle')
  })
})
