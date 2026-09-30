import { describe, expect, it } from 'vitest'
import {
  NoSources,
  envelope,
  unmetMandatory,
  whole,
  type SourceReceipt
} from './readEnvelope.ts'

const ok = (name: string): SourceReceipt => ({ name, status: 'ok', asOf: '2026-09-08T00:00:00Z' })
const broke = (name: string, code: string): SourceReceipt => ({
  name,
  status: 'error',
  asOf: null,
  errorCode: code
})

describe('availability is derived, never asserted', () => {
  it('is complete when every source answered', () => {
    const e = envelope({ data: [1, 2], sources: [ok('facts'), ok('repos')] })
    expect(e.availability).toBe('complete')
    expect(e.data).toEqual([1, 2])
  })

  it('is partial when one source failed, and keeps what the others gave', () => {
    const e = envelope({ data: [1], sources: [ok('facts'), broke('misses', '42501')] })
    expect(e.availability).toBe('partial')
    expect(e.data).toEqual([1])
    expect(e.sources.filter((s) => s.status !== 'ok').map((s) => s.name)).toEqual(['misses'])
  })

  it('forces the data to null when nothing answered', () => {
    // Otherwise a caller ships a value it could not read. This is the whole
    // point of the type: `[]` from a failed query and `[]` from an empty table
    // are the same bytes and different facts.
    const e = envelope({ data: [1, 2, 3], sources: [broke('facts', 'ECONNREFUSED')] })
    expect(e.availability).toBe('unavailable')
    expect(e.data).toBeNull()
  })

  it('refuses an envelope with no sources at all', () => {
    // An answer carrying no measurement is the thing this type exists to make
    // unwriteable — a confident zero with nothing behind it.
    expect(() => envelope({ data: 0, sources: [] })).toThrow(NoSources)
  })

  it('treats a source nobody configured as absent, not as broken and not as ok', () => {
    const e = envelope({
      data: null,
      sources: [ok('facts'), { name: 'cloudflare', status: 'not_configured', asOf: null }]
    })
    expect(e.availability).toBe('partial')
    // The distinction is load-bearing for the surface: one offers a retry, the
    // other offers a setup step, and calling both "error" loses that.
    expect(e.sources.find((s) => s.name === 'cloudflare')?.status).toBe('not_configured')
  })

  it('defaults freshness to unknown rather than to fresh', () => {
    expect(envelope({ data: 1, sources: [ok('a')] }).freshness).toBe('unknown')
    expect(envelope({ data: 1, sources: [ok('a')], freshness: 'fresh' }).freshness).toBe('fresh')
  })

  it('carries an omission whose size is itself unknown', () => {
    const e = envelope({
      data: [1],
      sources: [ok('facts')],
      omitted: [{ count: null, reason: 'the budget cut the tail and did not count it' }]
    })
    expect(e.omitted[0].count).toBeNull()
    expect(e.availability).toBe('partial')
  })
})

describe('whole', () => {
  it('hands back the answer only when the read was complete', () => {
    expect(whole(envelope({ data: 0, sources: [ok('facts')] }))).toBe(0)
  })

  it('withholds it on a partial read, so a caller cannot treat it as the total', () => {
    // Zero is a measurement. A caller that wants the total gets null and has to
    // say so; the partial data is still on `.data` for rendering what is known.
    const e = envelope({ data: 0, sources: [ok('facts'), broke('misses', 'x')] })
    expect(whole(e)).toBeNull()
    expect(e.data).toBe(0)
  })
})

describe('mandatory sources', () => {
  it('names the mandatory sources that did not answer', () => {
    const e = envelope({
      data: null,
      sources: [ok('project'), broke('facts', '42501'), ok('repos')]
    })
    expect(unmetMandatory(e, ['project', 'facts'])).toEqual(['facts'])
  })

  it('counts a mandatory source that was never consulted as unmet', () => {
    // Absent from the receipts is worse than failed: nobody even looked, and a
    // consumer checking only for errors would call this complete.
    const e = envelope({ data: null, sources: [ok('project')] })
    expect(unmetMandatory(e, ['project', 'facts'])).toEqual(['facts'])
  })

  it('is empty when every mandatory source answered, even if an optional one failed', () => {
    const e = envelope({ data: [1], sources: [ok('project'), broke('cloudflare', 'x')] })
    expect(unmetMandatory(e, ['project'])).toEqual([])
    expect(e.availability).toBe('partial')
  })
})
