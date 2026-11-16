// #region question-clarity — docs: docs/evidence/specs/2026-11-16-turn-end-waits.md#8-a-question-a-person-understands
/**
 * A question a person answers (the operator, 2026-11-16, over a question written for agents: «вопросы должны быть
 * понятны. Сейчас мне вообще не понятно, что вот у меня тут спрашивают»). The question itself is one short sentence in
 * the person's words that ends with a question mark and holds no machine words; what an agent needs to say besides goes
 * to `whyBlocked` and the options' consequences. Pure: `fabric_question_ask` refuses an unclear question with the fix,
 * and a screen showing one asked before this rule leads with its one clear sentence, the rest behind «Подробнее».
 */

/** The longest question line a person reads at a glance. */
export const QUESTION_MAX = 240

export type ClarityIssue = 'too-long' | 'machine-words' | 'not-a-question'

/** Ids and words of machines: hashes and uuids, ticket ids (CT-336), dotted or slashed identifiers (com.enroll,
 *  contract.change, agent-health/1, src/main), and anything in backticks. Words in Cyrillic never match. */
const MACHINE: readonly RegExp[] = [
  /`[^`]+`/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/i,
  /\b[A-Z]{2,6}-\d{1,5}\b/,
  /\b[A-Za-z][A-Za-z0-9-]+(?:[._/][A-Za-z0-9-]+)+/
]

export function hasMachineWords(text: string): boolean {
  return MACHINE.some((re) => re.test(text))
}

/** What keeps a question from being one a person answers; empty when it is one. */
export function clarityIssues(text: string): ClarityIssue[] {
  const t = text.trim()
  const out: ClarityIssue[] = []
  if ([...t].length > QUESTION_MAX) out.push('too-long')
  if (hasMachineWords(t)) out.push('machine-words')
  if (!/[?？]$/.test(t)) out.push('not-a-question')
  return out
}

/** The refusal's words for the agent: what is wrong and how to ask instead. */
export function clarityAdvice(issues: readonly ClarityIssue[]): string {
  const said = issues.map((i) => i === 'too-long' ? `longer than ${QUESTION_MAX} characters`
    : i === 'machine-words' ? 'machine words in it (ids, hashes, ticket numbers, tool or capability names, paths, code)' : 'not a question (it does not end with ?)')
  return `A person cannot answer this question: ${said.join('; ')}. Ask again with text: one short sentence in the person's working language that says what they decide, ending with ?, with no ids or tool names; put the context in whyBlocked, and give options, each with its consequence in plain words, the one you recommend marked. If nothing needs the person, decide it yourself by the project's decisions and goal instead of asking.`
}

const SENTENCE = /[^.!?？。]+[.!?？。]+/g

/**
 * How a screen leads with a question: the text itself when it is clear; else its first clear question sentence, with
 * the whole text as `more`; else no headline (null), the whole text as `more`, so the screen says the question is the
 * agent's and unclear rather than showing machine words as the question.
 */
export function questionHead(text: string): { headline: string | null; more: string | null } {
  const t = text.trim()
  // A screen judges what a person sees: length and machine words. The question mark is asked of new questions only.
  const readable = (line: string): boolean => [...line].length <= QUESTION_MAX && !hasMachineWords(line)
  if (readable(t)) return { headline: t, more: null }
  for (const s of t.match(SENTENCE) ?? []) {
    const line = s.trim()
    if (/[?？]$/.test(line) && readable(line)) return { headline: line, more: t }
  }
  return { headline: null, more: t }
}
// #endregion question-clarity
