// Handing an instruction to an agent (M103 · UX-15).
//
// TWO THINGS WERE WRONG WITH TYPING IT IN, and they are different failures.
//
// THE NEWLINES. The instruction was written straight into the pty with a
// trailing carriage return. Every newline INSIDE it is also a submission, so a
// two-paragraph instruction submitted after the first paragraph and typed the
// rest into whatever the agent showed next. The operator wrote one thing and
// the agent received two, the second out of context. Bracketed paste is the
// terminal's own answer: text between the markers is content, not keystrokes,
// and a program that understands them treats an embedded newline as a line
// break rather than as Enter.
//
// THE TIMER. The old delivery fired 1200ms after spawn — a guess about how long
// an agent takes to be ready. On a cold start, a slow disk, or a first run that
// checks for updates, the instruction was typed into a program that was not
// listening yet and vanished with no trace but the operator's memory of having
// asked.
//
// WHAT THIS FILE OWNS is the encoding, which is pure and therefore testable
// without a terminal. Readiness lives in `PtyManager`, where the output is.
//
// The escapes are written as `\x1b` rather than as literal control characters:
// an invisible byte in a source file is one nobody can review and one a careless
// editor will eat.

/** The terminal's markers for "what follows was pasted, not typed". */
export const PASTE_START = '\x1b[200~'
export const PASTE_END = '\x1b[201~'

/**
 * Wrap an instruction so a terminal program reads it as one paste.
 *
 * The trailing carriage return is OUTSIDE the markers on purpose: inside, it
 * would be part of the pasted content and would submit nothing. Outside, it is
 * the single Enter that sends the whole block — one instruction, one
 * submission.
 *
 * Markers already present in the text are stripped, because a closing marker in
 * the middle of an instruction would end the paste early and turn the rest back
 * into keystrokes — the very failure this exists to prevent.
 */
export function asOnePaste(instruction: string): string {
  const clean = instruction.replaceAll(PASTE_START, '').replaceAll(PASTE_END, '')
  return `${PASTE_START}${clean}${PASTE_END}\r`
}
