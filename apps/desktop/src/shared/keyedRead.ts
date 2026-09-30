/**
 * A payload that knows whose it is (UX28-02).
 *
 * `ReadEnvelope` already says whether an answer is whole, which sources
 * answered and how fresh it is. What it does not say is **which subject it is
 * about** — and that is the one missing field behind three defects the card
 * names, all of them in the same shape:
 *
 *  * **A new subject inherits the old subject's payload.** Selecting agent B
 *    runs a new read; until it resolves, the component still holds A's history
 *    and renders it as B's. An `alive` flag in the effect stops a LATE write and
 *    does nothing about this: the stale value was written on time, for somebody
 *    else.
 *  * **A late answer for A lands after B.** The mirror image, and the one an
 *    `alive` closure does cover — but only in files that remembered to write it.
 *  * **A failed refresh shows the old value as current.** The catch reports the
 *    error and leaves the payload alone, so the previous answer stays on screen
 *    with no age and no mark.
 *
 * THE FIX IS IN THE DATA, not in a convention. `forSubject` refuses to hand
 * over a payload belonging to another subject, so a component cannot render one
 * by forgetting a check — the same move `sessionEnvironment` and
 * `setProjectBinding` made: take away the path rather than remember the rule.
 */

/** What a keyed read is doing right now. */
export type KeyedState =
  /** No answer for this subject yet. Not an empty answer. */
  | 'loading'
  /** An answer for this subject. */
  | 'ready'
  /** This subject was asked and the read failed. The reason is carried. */
  | 'failed'

export interface KeyedRead<T> {
  /** Whose payload this is. A component compares, never assumes. */
  subject: string
  state: KeyedState
  /** Only ever the value for `subject`. Null while loading or failed. */
  value: T | null
  /** Why it failed, already safe to show. Never a stack. */
  failedWhy: string | null
  /** When the value arrived, for the age a surface must show. */
  asOf: number | null
}

/**
 * One subject out of several parts, with no way for two of them to collide.
 *
 * A read is rarely about one thing. The facts panel asks about a project, a
 * search string, a category and whether superseded facts are shown — four
 * values, and the answer for one combination must never be shown for another.
 * MEASURED: that panel fenced on the search string ALONE, so changing the
 * category with the text unchanged left both requests carrying the same key and
 * whichever answered last won, including the one for the category the operator
 * had left.
 *
 * The parts are LENGTH-PREFIXED rather than joined by a separator, because a
 * separator is a character the data is allowed to contain: `['a|b', 'c']` and
 * `['a', 'b|c']` join to the same string and are two different questions.
 * `usageObservation.ts#keyOf` does this for the same reason.
 */
export function subjectOf(parts: readonly (string | number | boolean | null | undefined)[]): string {
  return parts.map((p) => (p === null || p === undefined ? '~' : String(p))).map((p) => `${p.length}:${p}`).join('')
}

/** A read that has not been asked yet. */
export function pending<T>(subject: string): KeyedRead<T> {
  return { subject, state: 'loading', value: null, failedWhy: null, asOf: null }
}

/**
 * The read for this subject, or a fresh `loading` for it.
 *
 * THIS IS THE MECHANISM. A component holding A's read and asking for B's gets
 * `loading`, because the payload it holds is not about B. There is no branch to
 * forget: the value for another subject is unreachable through this function.
 */
export function forSubject<T>(read: KeyedRead<T> | null, subject: string): KeyedRead<T> {
  if (!read || read.subject !== subject) return pending<T>(subject)
  return read
}

/**
 * Record an answer, or drop it because the subject has moved on.
 *
 * The generation fence, in the data rather than in a closure. A closure works
 * and has to be written in every effect; this one cannot be omitted, because
 * the write goes through it.
 */
export function settled<T>(
  current: KeyedRead<T> | null,
  answer: { subject: string; value: T; at: number }
): KeyedRead<T> | null {
  // `current` names the subject the component is showing. An answer for anyone
  // else is late by definition.
  if (current && current.subject !== answer.subject) return current
  return { subject: answer.subject, state: 'ready', value: answer.value, failedWhy: null, asOf: answer.at }
}

/**
 * Record a failure, and DROP the payload with it.
 *
 * Keeping the old value would put the previous answer on screen as though it
 * were current — the third defect. A surface that wants to keep showing
 * something old must hold it deliberately and label it, which `staleness`
 * below is for.
 */
export function failed<T>(
  current: KeyedRead<T> | null,
  failure: { subject: string; why: string }
): KeyedRead<T> | null {
  if (current && current.subject !== failure.subject) return current
  return { subject: failure.subject, state: 'failed', value: null, failedWhy: failure.why, asOf: null }
}

export type Staleness =
  | { known: false; why: string }
  | { known: true; ageSeconds: number; stale: boolean }

/**
 * How old this answer is, and whether that is too old.
 *
 * Returned rather than baked into the state, because "too old" is a question
 * about the surface: a quota reading goes stale in minutes and a project name
 * does not.
 */
export function staleness<T>(read: KeyedRead<T>, now: number, maxAgeSeconds: number): Staleness {
  if (read.state === 'loading') return { known: false, why: 'nothing has been read for this subject yet' }
  if (read.state === 'failed') return { known: false, why: read.failedWhy ?? 'the read failed' }
  if (read.asOf === null) return { known: false, why: 'the answer carries no timestamp' }
  const ageSeconds = Math.max(0, Math.round((now - read.asOf) / 1000))
  return { known: true, ageSeconds, stale: ageSeconds > maxAgeSeconds }
}

/**
 * Do these reads disagree about whose they are?
 *
 * Two sources for one subject settle INDEPENDENTLY — that is the point of
 * keeping them apart — but they must not be rendered side by side while one is
 * about A and the other about B, which is the defect a shared `Promise.all`
 * hides by making them fail together.
 */
export function sameSubject(reads: readonly KeyedRead<unknown>[]): boolean {
  if (reads.length < 2) return true
  return reads.every((r) => r.subject === reads[0].subject)
}

/** Everything that failed, with its reason — so one failure cannot hide another. */
export function failures(reads: readonly { name: string; read: KeyedRead<unknown> }[]): readonly {
  name: string
  why: string
}[] {
  return reads
    .filter((r) => r.read.state === 'failed')
    .map((r) => ({ name: r.name, why: r.read.failedWhy ?? 'the read failed' }))
}
