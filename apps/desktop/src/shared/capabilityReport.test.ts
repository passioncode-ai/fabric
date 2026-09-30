import { describe, expect, it } from 'vitest'
import { AGENTS } from './agents.ts'
import {
  CAPABILITIES,
  declaredCapabilities,
  deriveDegradation,
  isAvailable,
  resolveExecutionMode,
  stateOf,
  withObserved
} from './capabilityReport.ts'

const now = 1_000
const claude = declaredCapabilities({ runnerId: 'claude-code', adapter: 'mcp-config-flag', connectsToSurface: true, now })
const bare = declaredCapabilities({ runnerId: 'codex', adapter: 'none', connectsToSurface: false, now })

describe('a capability is never tested because the runner name is recognised', () => {
  it('reports a declared capability as UNVERIFIED, with no evidence', () => {
    // A descriptor is a sentence somebody wrote. Nothing this returns is ever
    // verified, and the absence of an evidence field is the point.
    expect(stateOf(claude, 'heartbeat')).toBe('supported_unverified')
    expect(claude.capabilities.every((c) => c.evidence === undefined)).toBe(true)
  })

  it('promotes to VERIFIED only when the thing was observed happening', () => {
    const seen = withObserved(claude, 'heartbeat', 'beat #3 received')
    expect(stateOf(seen, 'heartbeat')).toBe('supported_verified')
    expect(seen.capabilities.find((c) => c.name === 'heartbeat')?.evidence).toBe('beat #3 received')
  })

  it('will not promote something the runner cannot do at all', () => {
    const seen = withObserved(bare, 'heartbeat', 'impossible')
    expect(stateOf(seen, 'heartbeat')).toBe('unsupported')
  })

  it('marks EVERY surface capability unsupported on a runner with no surface', () => {
    // The live false alarm this fixes: three of four runners declare adapter
    // `none`, so they cannot beat, acknowledge or trace — and the observer was
    // judging them by the heartbeat threshold anyway.
    for (const c of CAPABILITIES) expect(stateOf(bare, c)).toBe('unsupported')
    expect(isAvailable(bare, 'heartbeat')).toBe(false)
  })

  it('covers every runner the product actually offers', () => {
    // Read from AGENTS rather than a list here, so a runner added tomorrow is
    // classified rather than silently assumed capable.
    for (const a of AGENTS) {
      const r = declaredCapabilities({
        runnerId: a.id,
        adapter: a.surfaceAdapter,
        connectsToSurface: a.connectsToSurface,
        now
      })
      expect(r.capabilities).toHaveLength(CAPABILITIES.length)
    }
    expect(AGENTS.some((a) => a.surfaceAdapter === 'none')).toBe(true)
  })
})

describe('what may run, and how honestly', () => {
  it('BLOCKS on a required capability that is only declared', () => {
    // "The descriptor says so" is exactly the evidence this refuses for
    // anything safety-bearing.
    const got = resolveExecutionMode({ report: claude, required: ['effect_idempotency'], optional: [] })
    expect(got.mode).toBe('blocked_required')
    expect(got.says).toMatch(/not/)
  })

  it('allows it once the capability has been observed', () => {
    const seen = withObserved(claude, 'effect_idempotency', 'key reused across two attempts')
    expect(resolveExecutionMode({ report: seen, required: ['effect_idempotency'], optional: [] }).mode).toBe('full')
  })

  it('degrades rather than blocks on a missing OPTIONAL capability, and names it', () => {
    const got = resolveExecutionMode({ report: bare, required: [], optional: ['heartbeat', 'tool_trace'] })
    expect(got.mode).toBe('degraded_optional')
    expect(got.missingOptional).toEqual(['heartbeat', 'tool_trace'])
    expect(got.says).toMatch(/go unrecorded/)
  })
})

describe('a degraded result is a tuple, never a green boolean', () => {
  it('is complete only when nothing is unverified and nothing was omitted', () => {
    const got = deriveDegradation({ claims: ['ran the sweep'], notVerified: [], omittedInputs: [], sourceReachable: true })
    expect(got.completionAssessment).toBe('complete')
  })

  it('is PARTIAL when something could not be checked, however many steps passed', () => {
    const got = deriveDegradation({
      claims: ['a', 'b', 'c'],
      notVerified: ['the agent never acknowledged'],
      omittedInputs: [],
      sourceReachable: true
    })
    expect(got.completionAssessment).toBe('partial')
    expect(got.notVerified).toHaveLength(1)
  })

  it('is partial when an input was unreachable, so the result is over less than it looks', () => {
    const got = deriveDegradation({ claims: ['a'], notVerified: [], omittedInputs: ['memory'], sourceReachable: true })
    expect(got.completionAssessment).toBe('partial')
  })

  it('is UNKNOWN when the source itself could not be read', () => {
    const got = deriveDegradation({ claims: [], notVerified: [], omittedInputs: [], sourceReachable: false })
    expect(got.completionAssessment).toBe('unknown')
  })
})
