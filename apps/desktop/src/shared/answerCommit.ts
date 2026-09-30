// What the operator may submit as an answer (M152.commit).
//
// The database half is S06's `answer_question`: one transaction that resolves
// the question, records the answer as a decision the project remembers, and
// recomputes every blocking set it touched. This is the half in front of it —
// what a person is allowed to send, checked before anything is attempted.
//
// TWO RULES, and both are about a later reader rather than about this moment.
//
//   A chosen option carries its LABEL into the answer text. The answer becomes
//   a decision fact, and a decision that reads `"a"` is a decision nobody can
//   use — the id addresses the option, the label says what was decided.
//
//   An option is matched by ID and never by label. The stale case is the one
//   that matters: the question was revised, the option the operator clicked no
//   longer exists, and matching on the words would answer a DIFFERENT question
//   that happens to say the same thing.

const ANSWER_CAP = 4_000

export interface AnswerOption {
  id: string
  label: string
  consequence?: string
}

export interface ValidatedAnswer {
  answer: string
  chosenOption: string | null
}

export type AnswerResult = { ok: true; value: ValidatedAnswer } | { ok: false; reason: string }

export function validateAnswer(input: {
  answer?: string
  chosenOption?: string
  options: readonly AnswerOption[]
}): AnswerResult {
  const free = (input.answer ?? '').trim()
  const chosen = (input.chosenOption ?? '').trim()

  if (chosen) {
    const option = input.options.find((o) => o.id === chosen)
    if (!option)
      return {
        ok: false,
        reason:
          'that option is not one of the current ones — the question may have been revised. Re-read it and choose again; matching on the words would answer a different question.'
      }
    const answer = free ? `${option.label} — ${free}` : option.label
    if (answer.length > ANSWER_CAP)
      return { ok: false, reason: `that answer is too long (${answer.length} characters); say it shorter` }
    return { ok: true, value: { answer, chosenOption: option.id } }
  }

  if (!free) return { ok: false, reason: 'there is nothing to record — write an answer or choose an option' }
  if (free.length > ANSWER_CAP)
    return { ok: false, reason: `that answer is too long (${free.length} characters); say it shorter` }
  return { ok: true, value: { answer: free, chosenOption: null } }
}
