import { describe, expect, it } from 'vitest'
import { DEFAULT_PERSONA, validatePersona, variantsOf } from './persona.ts'

describe('Fabric\'s look (SCR-36)', () => {
  it('keeps a well-formed persona and refuses anything else', () => {
    expect(validatePersona({ seed: 768, style: 'spark' })).toEqual({ seed: 768, style: 'spark' })
    for (const bad of [null, [], {}, { seed: 0, style: 'orbit' }, { seed: 1.5, style: 'orbit' }, { seed: 768, style: 'neon' }, { seed: '768', style: 'wave' }, { seed: 2_000_000, style: 'wave' }])
      expect(validatePersona(bad), JSON.stringify(bad)).toBeNull()
  })

  it('computes the design\'s variants: the first generation starts at the default look', () => {
    expect(variantsOf(0)).toEqual([731, 744, 757])
    expect(variantsOf(1)).toEqual([768, 781, 794])
    expect(variantsOf(0)[0]).toBe(DEFAULT_PERSONA.seed)
    expect(variantsOf(-3)).toEqual(variantsOf(0))
  })

  it('keeps a name the operator gave, and reads a bad one as no name rather than refusing the look (ADR-0100)', () => {
    expect(validatePersona({ seed: 768, style: 'spark', name: '  Atlas ' })).toEqual({ seed: 768, style: 'spark', name: 'Atlas' })
    for (const bad of ['', '   ', 42, 'x'.repeat(41), 'a\u0007b'])
      expect(validatePersona({ seed: 768, style: 'spark', name: bad }), JSON.stringify(bad)).toEqual({ seed: 768, style: 'spark' })
  })
})
