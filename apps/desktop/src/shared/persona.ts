// Fabric's look for this operator (SCR-36): a seed and one of three characters. A preference of
// this machine — like the pins — so it is not journalled, and it changes no role and no authority:
// it is how Fabric looks, never what Fabric may do.

export const PERSONA_STYLES = ['orbit', 'spark', 'wave'] as const
export type PersonaStyle = (typeof PERSONA_STYLES)[number]
/**
 * `name` is what the operator calls their Fabric (ADR-0100, SCN-126 step 1). Optional so a look saved
 * before names existed reads unchanged; shown as "Fabric" when absent.
 */
export interface Persona { seed: number; style: PersonaStyle; name?: string }

export const PERSONA_NAME_MAX = 40

/** A display name: trimmed, 1–40 characters, no control characters; anything else is no name. */
export function personaName(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  if (!s || s.length > PERSONA_NAME_MAX || /[\u0000-\u001f\u007f]/.test(s)) return undefined
  return s
}

export const DEFAULT_PERSONA: Persona = Object.freeze({ seed: 731, style: 'orbit' })

/** A stored value, field by field; anything else is not a persona and reads as null. */
export function validatePersona(v: unknown): Persona | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const { seed, style } = v as Record<string, unknown>
  if (!Number.isSafeInteger(seed) || (seed as number) <= 0 || (seed as number) > 1_000_000) return null
  if (!(PERSONA_STYLES as readonly unknown[]).includes(style)) return null
  const name = personaName((v as Record<string, unknown>).name)
  return name ? { seed: seed as number, style: style as PersonaStyle, name } : { seed: seed as number, style: style as PersonaStyle }
}

/** Three variants of a generation: the same arithmetic the design uses, so a variant is reproducible. */
export function variantsOf(generation: number, base = DEFAULT_PERSONA.seed): number[] {
  const g = Math.max(0, Math.floor(generation))
  return [0, 1, 2].map((n) => base + g * 37 + n * 13)
}
