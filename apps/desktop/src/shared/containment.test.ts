import { describe, expect, it } from 'vitest'
import { containmentFor } from './agents.ts'
import { BYPASS_FLAGS, flooredEffectAllowed } from './containment.ts'

describe('the floor asks whether the asker could be held to it (FA-09)', () => {
  it('lets a below-floor act through whatever the runner is', () => {
    // Gating these on containment would stop an agent reading a file because it
    // could also have read the file.
    for (const containment of ['intercepted', 'runner-gated', 'none'] as const)
      expect(
        flooredEffectAllowed({ containment, floorClass: null, runner: 'shell', permissionMode: null }).allowed
      ).toBe(true)
  })

  it('REFUSES a floored act for a runner nothing stands between and the world', () => {
    const got = flooredEffectAllowed({
      containment: 'none',
      floorClass: 'external-effect',
      runner: 'claude-code',
      permissionMode: 'bypass'
    })
    expect(got.allowed).toBe(false)
    // The sentence has to say WHY it is not merely a stricter rule: the act was
    // available without the grant the whole time.
    expect(got.reason).toContain('was available without a grant the whole time')
    expect(got.remedy).toBeTruthy()
  })

  it('allows a floored act where the runner asks a person before each tool', () => {
    expect(
      flooredEffectAllowed({
        containment: 'runner-gated',
        floorClass: 'external-effect',
        runner: 'claude-code',
        permissionMode: 'ask'
      }).allowed
    ).toBe(true)
  })

  it('reads the bypass mode of the runner this product ships as uncontained', () => {
    expect(containmentFor('claude-code', 'bypass')).toBe('none')
    expect(containmentFor('claude-code', 'ask')).toBe('runner-gated')
    expect(containmentFor('claude-code', 'plan')).toBe('runner-gated')
  })

  it('reads a runner with no gate to ask, and one it cannot name, as uncontained', () => {
    // The safe direction, and the only honest one: the whole question is whether
    // Fabric can be SURE, and a runner it cannot name is one it cannot be sure
    // about.
    expect(containmentFor('shell', null)).toBe('none')
    // A mode the runner does not have. Reached by a stale session record or a
    // flag somebody removed, and the answer must be the safe one — a plant on
    // this fallback walked past the tests until this case existed.
    expect(containmentFor('claude-code', 'a-mode-that-does-not-exist')).toBe('none')
    expect(containmentFor('a-runner-nobody-declared', 'ask')).toBe('none')
    expect(containmentFor('', null)).toBe('none')
  })

  it('falls back to the runner default rather than to permission', () => {
    // A request that names no mode gets the runner's default, and if that
    // default is missing it is uncontained — never contained by omission.
    expect(['runner-gated', 'none']).toContain(containmentFor('claude-code', null))
  })

  it('names the bypass flags, so a new one is added deliberately', () => {
    expect(BYPASS_FLAGS).toContain('--dangerously-skip-permissions')
    expect(BYPASS_FLAGS.length).toBeGreaterThan(1)
  })
})
