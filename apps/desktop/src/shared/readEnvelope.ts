// What a read reports about itself (S14).
//
// THE MODEL ALREADY EXISTED, in one panel. `memoryOverview.ts` says a store's
// count is `number | null` with a `problem` beside it, and that a rate with no
// denominator is UNKNOWN rather than 0%. That is exactly right and it was true
// of six numbers on one screen. Everywhere else a read returns `data ?? []` and
// a failure arrives as an empty list — the same bytes as an empty table and a
// different fact.
//
// Measured before this file existed: `contextPack.ts` destructures `data` from
// four queries and never reads `error`, so a refused `memory_facts` select
// compiles a pack that says the project remembers nothing. `settings.ts` returns
// DEFAULTS when the file will not parse, and the next save merges onto those
// defaults and writes them back — a malformed file destroying the operator's
// workspace path through a save that reports success.
//
// So this lifts the model from one panel to every read, and the lift is where
// the mechanism lives: **availability is DERIVED from the receipts, never
// asserted by the caller** (ADR-0049 — a boundary held by a mechanism). There is
// no way to construct an envelope that claims `complete` while a source failed,
// and no way to construct one at all without naming what was consulted.

/** Why a source is not contributing. Four states, because "error" would merge
 *  the two a surface must tell apart: a retry helps one and a setup step is the
 *  only thing that helps the other. */
export type SourceStatus = 'ok' | 'error' | 'not_configured' | 'not_supported'

/** One consulted source. `CONTEXT.md` calls this an Observation — a measured
 *  fact with a source and a timestamp; this is that noun, plural, attached to
 *  the answer it produced. */
export interface SourceReceipt {
  name: string
  status: SourceStatus
  /** When this source answered, or null when it did not. */
  asOf: string | null
  /** The source's own code or message, already safe to show. Never a stack. */
  errorCode?: string
}

export type Availability = 'complete' | 'partial' | 'unavailable'
export type Freshness = 'fresh' | 'stale' | 'unknown'

/** Something the answer does not include. `count: null` is legitimate and
 *  common: a budget that stopped copying rarely counted what it skipped. */
export interface Omission {
  count: number | null
  reason: string
}

export interface ReadEnvelope<T> {
  /** Forced to null when nothing answered — see `envelope`. */
  data: T | null
  availability: Availability
  freshness: Freshness
  asOf: string | null
  /** Opaque equality token. Compared, never ordered and never arithmetic. */
  revision: string | null
  sources: SourceReceipt[]
  omitted: Omission[]
}

/** An answer with no measurement behind it. Refused rather than defaulted,
 *  because the empty source list is exactly the confident-zero this type
 *  exists to make unwriteable. */
export class NoSources extends Error {
  constructor() {
    super(
      'a ReadEnvelope needs at least one source receipt: an answer carrying no measurement ' +
        'is the confident zero this type exists to prevent'
    )
    this.name = 'NoSources'
  }
}

export function envelope<T>(input: {
  data: T | null
  sources: SourceReceipt[]
  omitted?: Omission[]
  asOf?: string | null
  revision?: string | null
  freshness?: Freshness
}): ReadEnvelope<T> {
  if (input.sources.length === 0) throw new NoSources()

  const answered = input.sources.filter((s) => s.status === 'ok')
  const omitted = input.omitted ?? []

  // Derived, in this order, and the caller has no say in it.
  const availability: Availability =
    answered.length === 0
      ? 'unavailable'
      : answered.length === input.sources.length && omitted.length === 0
        ? 'complete'
        : 'partial'

  return {
    // Nothing answered, so whatever the caller was holding is not an answer.
    data: availability === 'unavailable' ? null : input.data,
    availability,
    // Unknown by default. A read that has not established its own freshness
    // saying `fresh` is the same class of invention as the confident zero.
    freshness: input.freshness ?? 'unknown',
    asOf: input.asOf ?? answered.reduce<string | null>((a, s) => (s.asOf && (!a || s.asOf < a) ? s.asOf : a), null),
    revision: input.revision ?? null,
    sources: input.sources,
    omitted
  }
}

/**
 * The answer, and only when it is the whole answer.
 *
 * A caller that wants a total gets `null` on anything less than `complete` and
 * has to say so on the surface. `.data` is still there for rendering what IS
 * known — the two uses are different and merging them is how a partial read
 * becomes a number somebody quotes.
 */
export function whole<T>(e: ReadEnvelope<T>): T | null {
  return e.availability === 'complete' ? e.data : null
}

/**
 * Which required sources did not contribute.
 *
 * A source ABSENT from the receipts counts as unmet, and that is the case worth
 * the function: a consumer scanning for `status === 'error'` calls a read
 * complete when nobody looked at all.
 */
/**
 * Why nothing answered, or null because something did.
 *
 * The counterpart to `whole`: that one asks whether the answer is complete,
 * this one asks what to SAY when it is not there at all. Kept here rather than
 * in the surface that renders it, because the derivation is a property of the
 * envelope and a second copy in a second panel is a second thing to drift —
 * and because a generic parameter list in a `.tsx` file reads to the
 * interface-string gate as literal text on the screen.
 */
export function refusedBy<T>(e: ReadEnvelope<T>): string | null {
  if (e.availability !== 'unavailable') return null
  const said = e.sources
    .filter((s) => s.status !== 'ok')
    .map((s) => s.errorCode ?? s.status)
    .filter((x) => x.length > 0)
  // A source that refused without a message still refused. Saying "the read
  // did not answer" is worse than a reason and far better than a zero.
  return said.length > 0 ? said.join('; ') : 'the read did not answer'
}

export function unmetMandatory<T>(e: ReadEnvelope<T>, mandatory: string[]): string[] {
  const answered = new Set(e.sources.filter((s) => s.status === 'ok').map((s) => s.name))
  return mandatory.filter((name) => !answered.has(name))
}
