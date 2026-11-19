import { describe, expect, it } from 'vitest'
import { DEFAULT_PERSONA, PERSONA_VOICES, validatePersona, variantsOf, voiceGenderOf, xaiVoiceOf } from './persona.ts'

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

describe('the CEO\'s voice (the owner, 2026-11-19)', () => {
  it('reads a look saved before voices existed as male, and keeps a chosen voice', () => {
    expect(voiceGenderOf(validatePersona({ seed: 768, style: 'spark' }))).toBe('male')
    expect(validatePersona({ seed: 768, style: 'spark', voice: 'female' })).toEqual({ seed: 768, style: 'spark', voice: 'female' })
    expect(validatePersona({ seed: 768, style: 'spark', name: 'Atlas', voice: 'male' })).toEqual({ seed: 768, style: 'spark', name: 'Atlas', voice: 'male' })
  })

  it('reads an unknown voice as no voice rather than refusing the look', () => {
    for (const bad of ['robot', '', 1, null, ['male']])
      expect(validatePersona({ seed: 768, style: 'wave', voice: bad }), JSON.stringify(bad)).toEqual({ seed: 768, style: 'wave' })
  })

  it('the character picks which male and which female voice of xAI\'s built-in five', () => {
    expect(xaiVoiceOf(DEFAULT_PERSONA)).toBe('rex')
    expect(xaiVoiceOf(null)).toBe('rex')
    expect(xaiVoiceOf({ style: 'orbit', voice: 'female' })).toBe('eve')
    expect(xaiVoiceOf({ style: 'spark' })).toBe('sal')
    expect(xaiVoiceOf({ style: 'spark', voice: 'female' })).toBe('ara')
    expect(xaiVoiceOf({ style: 'wave' })).toBe('leo')
    const builtIn = new Set(['ara', 'eve', 'leo', 'rex', 'sal'])
    for (const style of Object.keys(PERSONA_VOICES) as Array<keyof typeof PERSONA_VOICES>)
      for (const g of ['male', 'female'] as const) expect(builtIn.has(PERSONA_VOICES[style][g])).toBe(true)
    // Measured pitch: the male voices are below 150 Hz, the female ones above.
    for (const style of Object.keys(PERSONA_VOICES) as Array<keyof typeof PERSONA_VOICES>) {
      expect(['leo', 'rex', 'sal']).toContain(PERSONA_VOICES[style].male)
      expect(['ara', 'eve']).toContain(PERSONA_VOICES[style].female)
    }
  })
})
