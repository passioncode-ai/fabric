// Named starting actions beside the blank field (M121).
//
// Three presets already existed and all three were CONSTANTS: a label and a
// fixed sentence. The milestone asks for the other kind — "continue from the
// backlog", "known bugs" — and those are not constants at all. A preset that
// reads the project is a BRIEFING rather than a slogan: it hands the agent what
// Fabric already knows, so the session does not open by rediscovering it.
//
// Three rules decide the shape, and the third is the one with teeth.
//
// 1. A constant preset is always offered.
// 2. A data-backed preset with an EMPTY source is not offered at all. "Continue
//    from the backlog" with an empty backlog sends an agent to do nothing, and
//    an offer that cannot be honoured is worse than no offer. This is not the
//    "absent renders as zero" trap: the list is a set of OFFERS, not a report,
//    and the project's own board is where an empty backlog is stated.
// 3. The items are BOUNDED, and a truncated list says so. Pasting two hundred
//    rows into an instruction is how a preset becomes unusable; pasting the
//    first eight and saying nothing is how an agent concludes the backlog holds
//    eight things. Silent truncation reads as completeness — so the count is
//    always the TRUE count, and what was left out is named.

/** A preset that reads the project's state, and what it reads. */
export type PresetSource = 'backlog' | 'bugs'

export interface TaskPreset {
  id: string
  labelKey: string
  instructionKey: string
  /** Absent means a constant offer that needs nothing from the project. */
  source?: PresetSource
}

export interface PresetItem {
  id: string
  title: string | null
  instruction: string
}

export type PresetInput = Partial<Record<PresetSource, PresetItem[]>>

export interface ResolvedPreset {
  id: string
  labelKey: string
  instructionKey: string
  /** The TRUE size of the source — never the size of what was listed. */
  count: number
  /** Interpolated into both the label and the instruction. */
  vars: { count: number; items: string }
}

/** How many rows an instruction may carry. Eight is what fits a glance; the
 *  number matters less than the fact that going over it is SAID. */
export const MAX_ITEMS = 8

const name = (i: PresetItem): string => (i.title?.trim() || i.instruction).slice(0, 100)

export function resolvePresets(presets: readonly TaskPreset[], input: PresetInput): ResolvedPreset[] {
  const out: ResolvedPreset[] = []
  for (const p of presets) {
    if (!p.source) {
      out.push({ ...p, count: 0, vars: { count: 0, items: '' } })
      continue
    }
    const all = input[p.source] ?? []
    if (all.length === 0) continue
    const shown = all.slice(0, MAX_ITEMS)
    const lines = shown.map((i) => `- ${name(i)}`)
    // The remainder is a sentence in the list, not a number beside it: whatever
    // reads this is a language model reading an instruction, and a bare "(+195)"
    // is exactly the kind of token it will drop.
    if (all.length > shown.length)
      lines.push(`- …and ${all.length - shown.length} more not listed here; ask Fabric for the rest`)
    out.push({ ...p, count: all.length, vars: { count: all.length, items: lines.join('\n') } })
  }
  return out
}
