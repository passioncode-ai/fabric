// What a session is told, built from the runtime that enforces it (M177).
//
// TWO GAPS, MEASURED. The rules `fabric_whoami` returns are a hand-written list
// beside the code that enforces them:
//
//   1. Nothing in a session says what TODAY is. A model answers "is this library
//      current" from a training cutoff unless something tells it otherwise, and
//      nothing did — not the preamble, not the pack, not the rules.
//   2. The task vocabulary is enumerated at the TOOL, in a `z.enum` that
//      REFUSES a bad status, and nowhere that TEACHES the good ones. The agent
//      learns the allowed set by guessing and being turned down, which costs a
//      call and reads as the product being strict rather than quiet.
//
// So the vocabulary is derived from `LADDER` and `mayMove` — the same functions
// that refuse — and the rules cannot drift from them, because there is no second
// copy to drift. The `agentMoves` table is computed by asking `mayMove` rather
// than by restating its conditions: a rule change moves the answer here without
// anyone remembering this file exists.
//
// AND IT SAYS WHICH RULES, NOT JUST THE RULES. `protocolHash` covers the rules
// and the vocabulary and deliberately NOT the clock, so "which protocol did this
// session get" has a stable answer and re-serving at a different minute is not a
// different protocol.
//
// WHAT IT WILL NOT CLAIM: that anything was understood. Served, acknowledged and
// understood are three facts, and the audit that merges them cannot say what the
// agent was actually working from. This object carries only the first.

import { LADDER, mayMove, type TaskState } from './ladder.ts'
import { OBLIGATIONS, labelled } from './protocolObligations.ts'

/** Bumped by hand when the SHAPE changes, so a reader can name a change the hash
 *  can only detect. The hash says two protocols differ; the version says how. */
export const PROTOCOL_VERSION = '1'

export interface ProtocolVocabulary {
  taskStates: TaskState[]
  /** Where an agent may move a task FROM each state. Computed by asking the
   *  ladder, so a rung the agent may not use never appears here. */
  agentMoves: Record<string, TaskState[]>
  floorClasses: string[]
}

/** The language every agent writes person-facing text in: the language of Fabric's interface, which the person
 *  chose at the first run or in Settings (P-24). Named in English and in itself, so an agent that reads either
 *  cannot mistake it. */
export interface WorkingLanguage {
  code: 'en' | 'ru'
  name: string
  native: string
}

const WORKING_LANGUAGES: Record<WorkingLanguage['code'], WorkingLanguage> = {
  en: { code: 'en', name: 'English', native: 'English' },
  ru: { code: 'ru', name: 'Russian', native: 'Русский' }
}

/** The settings' locale as a working language; anything unknown is English, as the interface is. */
export function workingLanguage(locale: string | undefined): WorkingLanguage {
  return locale === 'ru' ? WORKING_LANGUAGES.ru : WORKING_LANGUAGES.en
}

export interface Protocol {
  version: string
  now: { utc: string; timeZone: string }
  /** Null when the person switched the working language off (OF-38): agents keep their own language. */
  language: WorkingLanguage | null
  vocabulary: ProtocolVocabulary
  rules: string[]
  /** This protocol was handed over. Whether it was read is a different fact and
   *  is not recorded here. */
  served: true
}

/** The rules that are prose because they are judgement, not enumeration.
 *  Anything an enum can say is derived above instead. */
/**
 * The rules, each saying WHAT KIND of rule it is (M155).
 *
 * These used to be eight flat imperatives, and their force differed completely:
 * "you can only see this project" is refused by the scoped store, and "claim a
 * task before working on it" was checked by nothing. Told in one voice, both
 * read as enforced — and an agent that discovers a rule was advice stops
 * believing the rest.
 *
 * Taken from `OBLIGATIONS`, not restated here: the labels are resolved against
 * the tree by `scripts/check-obligations.mjs`, so a rule cannot keep saying
 * ENFORCED about a symbol nobody kept.
 */
const JUDGEMENT_RULES: readonly string[] = OBLIGATIONS.map(labelled)

export function buildProtocol(input: {
  now: Date
  timeZone: string
  ladder?: Record<string, readonly TaskState[]>
  extraRules?: string[]
  /** The interface's locale (`settings.locale`); English when absent; null when the person switched it off (OF-38). */
  language?: string | null
}): Protocol {
  const language = input.language === null ? null : workingLanguage(input.language)
  const ladder = input.ladder ?? LADDER
  const taskStates = Object.keys(ladder) as TaskState[]

  const agentMoves: Record<string, TaskState[]> = {}
  for (const from of taskStates)
    agentMoves[from] = (ladder[from] ?? []).filter((to) => mayMove('agent', from, to).ok)

  const vocabulary: ProtocolVocabulary = {
    taskStates,
    agentMoves,
    floorClasses: ['money', 'deletion', 'publication']
  }

  const rules = [
    // FIRST, because a model that does not know the date answers every currency
    // question from its training data and sounds certain doing it.
    `Today is ${input.now.toISOString().slice(0, 10)} (${input.now.toISOString()}, ${input.timeZone}). ` +
      'Fabric told you; do not date anything from memory, and do not assume a library, an API or a version you remember is still current.',
    // SECOND (P-24, the operator 2026-10-22: «чтобы агенты репортили данные на том языке, на котором стоит интерфейс»).
    // The tools used to ask for "their language" without naming it, and agents wrote English on a Russian board.
    ...(language ? [
      `[ADVICE] Write everything a person will read in ${language.name} (${language.native}), the language of Fabric's ` +
        'interface, which the person chose: task titles and briefs, stages, notes, questions, board messages and reports. ' +
        "Documents in a project's repository keep the language that project uses (D-2), and code, identifiers, commands, " +
        'paths and quotations stay as they are.'
    ] : []),
    `A task is in one of: ${taskStates.join(', ')}. From where it is now, you may move it to ` +
      taskStates
        .filter((s) => agentMoves[s].length)
        .map((s) => `${s} → ${agentMoves[s].join(' | ')}`)
        .join('; ') +
      `. You cannot move a task to ${taskStates.filter((s) => !taskStates.some((f) => agentMoves[f].includes(s))).join(' or ')} — that is the operator's move.`,
    ...JUDGEMENT_RULES,
    ...(input.extraRules ?? [])
  ]

  return { version: PROTOCOL_VERSION, now: { utc: input.now.toISOString(), timeZone: input.timeZone }, language, vocabulary, rules, served: true }
}

/**
 * Which protocol this was, as a stable token.
 *
 * The clock is EXCLUDED on purpose: serving the same rules a minute later is not
 * a different protocol, and a hash that moved every second could never answer
 * "did this session get the current rules".
 */
export function protocolHash(p: Protocol): string {
  const material = JSON.stringify({
    version: p.version,
    vocabulary: p.vocabulary,
    // The date sentence is regenerated per session and is not part of the rules'
    // identity; every other rule is.
    rules: p.rules.filter((r) => !r.startsWith('Today is '))
  })
  let h = 0x811c9dc5
  for (let i = 0; i < material.length; i++) {
    h ^= material.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
