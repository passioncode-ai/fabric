// Fabric's look for this operator (SCR-36): a seed and one of three characters. A preference of
// this machine — like the pins — so it is not journalled, and it changes no role and no authority:
// it is how Fabric looks, never what Fabric may do.

export const PERSONA_STYLES = ['orbit', 'spark', 'wave'] as const
export type PersonaStyle = (typeof PERSONA_STYLES)[number]
/**
 * `name` is what the operator calls their Fabric (ADR-0100, SCN-126 step 1). Optional so a look saved
 * before names existed reads unchanged; shown as "Fabric" when absent.
 */
export interface Persona { seed: number; style: PersonaStyle; name?: string; voice?: VoiceGender }

// #region persona-voice — docs: docs/architecture/external-contracts.md#xai-voices
/**
 * The voice the CEO speaks with on a call (the owner, 2026-11-19: «по умолчанию мужской, в настройках выбор мужской или
 * женский, в зависимости от выбранного персонажа»). The person picks male or female; the character picks which of xAI's
 * voices that is. A look saved before voices existed has no field and reads as male.
 */
export const VOICE_GENDERS = ['male', 'female'] as const
export type VoiceGender = (typeof VOICE_GENDERS)[number]
export const DEFAULT_VOICE: VoiceGender = 'male'

/** xAI's built-in voices by character and gender. Gender is measured, not documented: xAI's table gives only a tone, so
 *  the median pitch of each published sample was read on 2026-11-19 (ara 222 Hz, eve 193 Hz, leo 113 Hz, rex 108 Hz,
 *  sal 125 Hz; docs/architecture/external-contracts.md, xAI voices). */
export const PERSONA_VOICES: Readonly<Record<PersonaStyle, Readonly<Record<VoiceGender, string>>>> = Object.freeze({
  orbit: Object.freeze({ male: 'rex', female: 'eve' }),
  spark: Object.freeze({ male: 'sal', female: 'ara' }),
  wave: Object.freeze({ male: 'leo', female: 'eve' })
})

export function voiceGenderOf(p: Pick<Persona, 'voice'> | null | undefined): VoiceGender {
  return p?.voice === 'female' ? 'female' : DEFAULT_VOICE
}

/** The xAI voice id a call opens with. */
export function xaiVoiceOf(p: Pick<Persona, 'style' | 'voice'> | null | undefined): string {
  const style = p && (PERSONA_STYLES as readonly string[]).includes(p.style) ? p.style : DEFAULT_PERSONA.style
  return PERSONA_VOICES[style][voiceGenderOf(p)]
}
// #endregion persona-voice

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
  const voice = (v as Record<string, unknown>).voice
  // An unknown voice costs the voice (it reads as male), never the look.
  const out: Persona = { seed: seed as number, style: style as PersonaStyle }
  if (name) out.name = name
  if ((VOICE_GENDERS as readonly unknown[]).includes(voice)) out.voice = voice as VoiceGender
  return out
}

/** Three variants of a generation: the same arithmetic the design uses, so a variant is reproducible. */
export function variantsOf(generation: number, base = DEFAULT_PERSONA.seed): number[] {
  const g = Math.max(0, Math.floor(generation))
  return [0, 1, 2].map((n) => base + g * 37 + n * 13)
}
