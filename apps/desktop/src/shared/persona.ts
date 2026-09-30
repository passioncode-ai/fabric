// Fabric's look for this operator (SCR-36): a seed and one of three characters. A preference of
// this machine — like the pins — so it is not journalled, and it changes no role and no authority:
// it is how Fabric looks, never what Fabric may do.

export const PERSONA_STYLES = ['orbit', 'spark', 'wave'] as const
export type PersonaStyle = (typeof PERSONA_STYLES)[number]
export interface Persona { seed: number; style: PersonaStyle }

export const DEFAULT_PERSONA: Persona = Object.freeze({ seed: 731, style: 'orbit' })

/** A stored value, field by field; anything else is not a persona and reads as null. */
export function validatePersona(v: unknown): Persona | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const { seed, style } = v as Record<string, unknown>
  if (!Number.isSafeInteger(seed) || (seed as number) <= 0 || (seed as number) > 1_000_000) return null
  if (!(PERSONA_STYLES as readonly unknown[]).includes(style)) return null
  return { seed: seed as number, style: style as PersonaStyle }
}

/** Three variants of a generation: the same arithmetic the design uses, so a variant is reproducible. */
export function variantsOf(generation: number, base = DEFAULT_PERSONA.seed): number[] {
  const g = Math.max(0, Math.floor(generation))
  return [0, 1, 2].map((n) => base + g * 37 + n * 13)
}
