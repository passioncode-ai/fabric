// What an agent may ask, and what it does not get to decide (M149).
//
// A QUESTION IS THE ONE THING AN AGENT AUTHORS THAT REACHES A PERSON. Everything
// else it writes — a note, a fact, a stage report — is read by another agent or
// sits on a screen. A question interrupts somebody. So the shape is checked here,
// before anything is appended, and the fields that decide how loudly it
// interrupts are not the asker's to set.
//
// WHAT THE CLIENT NEVER SETS, and each is a way to jump the queue:
//   priority   — the CEO's, computed from the blocking set and the project tier
//   estate     — the credential's, and a caller naming one is naming a request
//   the author — the session's; an agent claiming to be the operator is the
//                difference between a question and an instruction
//
// WHY `kind: 'process'` IS REFUSED while `topic: 'process'` is accepted: M184
// turns a recurring trap into a question, and that question is a DECISION about
// process. A fifth kind would change every priority weight that switches on
// kind — for a label. The topic is the label; the kind is the mechanics.

export const QUESTION_KINDS = ['decision', 'access', 'priority', 'fact', 'approval'] as const
export type QuestionKind = (typeof QUESTION_KINDS)[number]

/** Long enough for a real question with its consequences; short enough that the
 *  operator's board is a board rather than a document. */
const TEXT_CAP = 4_000
const LABEL_CAP = 200

export interface AskOption {
  id: string
  label: string
  consequence?: string
}

export interface NormalisedAsk {
  text: string
  kind: QuestionKind
  /** What it is about, as a stable key. A decision fact carrying the same key
   *  can settle it without a model (ADR-0036). */
  about: string | null
  /** Beside the kind, not instead of it. */
  topic: string | null
  whyBlocked: string | null
  taskId: string | null
  options: AskOption[]
  blocks: string[]
}

export type AskResult = { ok: true; value: NormalisedAsk } | { ok: false; reason: string }

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function normaliseAsk(input: {
  text?: string
  kind?: string
  about?: string
  topic?: string
  whyBlocked?: string
  taskId?: string
  options?: { id?: string; label?: string; consequence?: string }[]
  blocks?: string[]
}): AskResult {
  const text = clean(input.text)
  if (!text) return { ok: false, reason: 'a question needs its text — an empty one cannot be answered' }
  if (text.length > TEXT_CAP)
    return {
      ok: false,
      reason: `that question is too long (${text.length} characters); say it shorter and put the detail in the options' consequences`
    }

  const kind = (input.kind ?? 'decision') as QuestionKind
  if (!QUESTION_KINDS.includes(kind))
    return {
      ok: false,
      reason: `kind must be one of ${QUESTION_KINDS.join(', ')}. A question about process is kind=decision with topic=process.`
    }

  const options: AskOption[] = []
  const seen = new Set<string>()
  for (const [i, raw] of (input.options ?? []).entries()) {
    const label = clean(raw?.label)
    if (!label) return { ok: false, reason: `option ${i + 1} has no label, and an unlabelled choice is not a choice` }
    const id = clean(raw?.id) || `opt-${i + 1}`
    if (seen.has(id))
      return {
        ok: false,
        reason: `two options share the id "${id}". The answer names one option by id, and two of them makes the answer ambiguous exactly when it matters.`
      }
    seen.add(id)
    options.push({
      id,
      label: label.slice(0, LABEL_CAP),
      ...(clean(raw?.consequence) ? { consequence: clean(raw.consequence).slice(0, TEXT_CAP) } : {})
    })
  }

  return {
    ok: true,
    value: {
      text,
      kind,
      about: clean(input.about) || null,
      topic: clean(input.topic) || null,
      whyBlocked: clean(input.whyBlocked) || null,
      taskId: clean(input.taskId) || null,
      options,
      // A question that blocks nothing is legitimate: an agent may want a
      // decision without being stuck on it, and refusing that teaches it to
      // invent a blocked task to get a hearing.
      blocks: [...new Set((input.blocks ?? []).map(clean).filter(Boolean))]
    }
  }
}
