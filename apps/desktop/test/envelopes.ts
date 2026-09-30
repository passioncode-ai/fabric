// Fixture envelopes, built by the PRODUCT's own constructor (UXA-C02).
//
// `attention.list` answers a `ReadEnvelope` rather than a bare list, because
// the read consults five tables and one of them refusing still leaves the call
// resolving — with a queue missing an entire class of obligation. Every screen
// test that stubs the channel therefore has to hand over an envelope, and nine
// hand-written copies of that shape would be nine places to drift.
//
// Built through `envelope()` on purpose: availability is DERIVED from the
// receipts and the caller has no say in it, so a fixture here cannot be more
// generous than what the main process can produce. Writing `complete` beside a
// failed source is not expressible, in the product or in these.

import { envelope, type ReadEnvelope, type SourceReceipt } from '../src/shared/readEnvelope.ts'

export const FIXTURE_STAMP = '2026-09-11T00:00:00Z'

/** Every source answered: the plain case most screen tests want. */
export function whole<T>(data: T, name = 'fixture'): ReadEnvelope<T> {
  return envelope<T>({
    data,
    sources: [{ name, status: 'ok', asOf: FIXTURE_STAMP }],
    asOf: FIXTURE_STAMP,
    freshness: 'fresh'
  })
}

/** Some answered and some did not — the case a surface must never round off. */
export function partly<T>(data: T, failed: SourceReceipt[]): ReadEnvelope<T> {
  return envelope<T>({
    data,
    sources: [{ name: 'fixture', status: 'ok', asOf: FIXTURE_STAMP }, ...failed],
    asOf: FIXTURE_STAMP,
    freshness: 'fresh'
  })
}
