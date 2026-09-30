// What a register row's status MEANS, as a field rather than a sentence.
//
// FA-10. The carry-over register's Status column is prose, and it has been
// disciplined prose: measured 2026-09-10, all 136 rows begin with one of seven
// words. But nothing said so, and the counter knew ONE of them — `open` — so
// the number the plan is steered by was the count of rows whose sentence
// happened to start with that word. Five rows begin `narrowed`, `partially` or
// `deferred`, and three of those say in their own text that work remains:
// CO-038 ("account registration as assets and ad/sending identities remain
// open"), CO-059 ("what stays open is the full Cedar-context mapping"), CO-061
// ("checker-infrastructure and budget-governor failure semantics remain open in
// this row"). Three rows of live work, outside the number.
//
// The prose is not the problem and is not touched. What is added is a FIRST
// TOKEN with a declared meaning: everything after it stays exactly as written,
// and a row whose first token is not in the vocabulary FAILS the gate rather
// than quietly leaving the count. That is the difference between a convention
// and a field — a convention shrinks a number the first time somebody writes
// "still being decided", and nobody finds out.

/**
 * The vocabulary, and what each word says about whether work remains.
 *
 * `carries` is the question the steering number asks: is there something still
 * to do here? It is NOT the same as "unresolved" — a row can be resolved in
 * principle and still carry a remainder, which is exactly what `narrowed` and
 * `partially` were invented to say.
 */
export const DISPOSITIONS = {
  open: { carries: true, means: 'nothing about this has been decided' },
  narrowed: { carries: true, means: 'a decision cut the row down and named what still stands' },
  partially: { carries: true, means: 'part of it is resolved and the rest is named in the row' },
  deferred: { carries: true, means: 'postponed deliberately, with the deadline in its own column' },
  resolved: { carries: false, means: 'decided, with the decision named' },
  closed: { carries: false, means: 'no longer a question — often because the thing it was about is gone' },
  recorded: { carries: false, means: 'held somewhere else now, and that somewhere is named' },
  superseded: { carries: false, means: 'a later row or decision replaced it' }
}

/**
 * The first token of a status cell, lowercased, with markdown emphasis stripped.
 *
 * Emphasis is stripped because half the register writes `**resolved 2026-08-26
 * — ADR-0012.**` and half writes `open`, and a counter that saw `**resolved` as
 * its own word would be back to counting sentences.
 */
export function tokenOf(status) {
  const bare = String(status ?? '')
    .trim()
    .replace(/^[*_\s]+/, '')
    .toLowerCase()
  const m = bare.match(/^[a-z][a-z-]*/)
  return m ? m[0] : ''
}

/**
 * What this status says, or `null` if it says something nobody has declared.
 *
 * Null is the whole point: a caller must decide what to do about a word outside
 * the vocabulary, and the only correct answer for a gate is to refuse. Guessing
 * "probably open" or "probably closed" would reintroduce the silence.
 */
export function dispositionOf(status) {
  const token = tokenOf(status)
  const known = Object.hasOwn(DISPOSITIONS, token) ? DISPOSITIONS[token] : null
  return known ? { token, ...known } : null
}

/** Does this row still carry work? Throws on a word nobody declared. */
export function carriesWork(status) {
  const d = dispositionOf(status)
  if (!d) throw new Error(`undeclared disposition ${JSON.stringify(tokenOf(status))}`)
  return d.carries
}

/** The words a row may begin with, for a gate's error message. */
export function vocabulary() {
  return Object.keys(DISPOSITIONS)
}
