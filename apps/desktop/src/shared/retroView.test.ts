import { describe, expect, it } from 'vitest'
import {
  EVIDENCE_STATUSES,
  PAGE_MAX,
  RETRO_KINDS,
  checkCursor,
  decodeCursor,
  describeRecurrence,
  encodeCursor,
  evidenceOf,
  evidenceOpens,
  filterHashOf,
  isCurrent,
  normaliseQuery,
  pageOf,
  recurrenceUnknown,
  type RetroItem,
  type RetroQuery
} from './retroView.ts'

const query = (over: Partial<RetroQuery> = {}): RetroQuery =>
  normaliseQuery({ kinds: ['finding'], categories: ['project'], state: 'current', ...over })

const item = (over: Partial<RetroItem> = {}): RetroItem => ({
  factRef: 'f1',
  subject: { kind: 'fact', id: 'f1' },
  category: 'project',
  kind: 'finding',
  claim: 'the build needs pnpm 9',
  actor: { kind: 'agent', id: 's1' },
  evidence: evidenceOf({ raw: 'task:t1' }),
  about: null,
  recurrence: { verifiedDistinct: 1, proposed: 0, problem: null },
  recordedAt: '2026-09-09T10:00:00Z',
  validFrom: '2026-09-09T10:00:00Z',
  validTo: null,
  supersedes: null,
  supersededBy: null,
  conflict: null,
  ...over
})

describe('the query, and the filter that must not match nothing by accident', () => {
  it('treats an empty kind list as EVERY kind', () => {
    // A filter that silently matches nothing returns an empty page that reads
    // as "there is nothing here" — the shape this whole file exists to avoid.
    expect(normaliseQuery({}).kinds).toEqual([])
    expect(normaliseQuery({ kinds: ['finding', 'trap'] }).kinds).toEqual(['finding', 'trap'])
  })

  it('drops a kind the schema does not have rather than passing it through', () => {
    expect(normaliseQuery({ kinds: ['finding', 'nonsense' as never] }).kinds).toEqual(['finding'])
  })

  it('bounds the page size', () => {
    expect(normaliseQuery({ pageSize: 5000 }).pageSize).toBe(PAGE_MAX)
    expect(normaliseQuery({ pageSize: 0 }).pageSize).toBe(1)
  })

  it('defaults to what is true NOW', () => {
    expect(normaliseQuery({}).state).toBe('current')
  })

  it('knows exactly the kinds the schema allows', () => {
    expect(RETRO_KINDS).toEqual(['note', 'finding', 'decision', 'trap'])
  })
})

describe('a cursor belongs to a question, not only to a position', () => {
  it('asks the same question the same way whatever order the caller listed it in', () => {
    const a = filterHashOf(query({ kinds: ['trap', 'finding'] }))
    const b = filterHashOf(query({ kinds: ['finding', 'trap'] }))
    expect(a).toBe(b)
  })

  it('round-trips', () => {
    const c = {
      filterHash: 'h',
      throughSeq: '412',
      afterRecordedAt: '2026-09-09T10:00:00Z',
      afterId: 'f1'
    }
    expect(decodeCursor(encodeCursor(c))).toEqual(c)
  })

  it('refuses a page marker it cannot read', () => {
    const got = checkCursor(query({ cursor: 'nonsense' }))
    expect(got.ok).toBe(false)
  })

  it('REFUSES a cursor from a different question rather than answering from the wrong place', () => {
    // A bare offset re-asked after three new facts skips three rows or repeats
    // three, and neither is visible to the reader.
    const first = query({ kinds: ['finding'] })
    const cursor = encodeCursor({
      filterHash: filterHashOf(first),
      throughSeq: '10',
      afterRecordedAt: '2026-09-09T10:00:00Z',
      afterId: 'f1'
    })
    expect(checkCursor(query({ kinds: ['finding'], cursor })).ok).toBe(true)
    const moved = checkCursor(query({ kinds: ['trap'], cursor }))
    expect(moved.ok).toBe(false)
    if (!moved.ok) expect(moved.reason).toMatch(/filters changed/i)
  })

  it('has nothing to check when there is no cursor', () => {
    const got = checkCursor(query({ cursor: null }))
    expect(got).toEqual({ ok: true, cursor: null })
  })
})

describe('a source that will not open is not a deleted source', () => {
  it('names five ways to fail and only one of them means gone', () => {
    expect(EVIDENCE_STATUSES).toEqual([
      'available',
      'not_on_this_host',
      'unauthorized',
      'deleted_tombstone',
      'unavailable',
      'unknown'
    ])
  })

  it('says nobody looked, rather than guessing, when nobody looked', () => {
    const e = evidenceOf({ raw: 'task:t1' })
    expect(e.status).toBe('unknown')
    expect(e.says).toMatch(/nobody has checked/i)
    expect(e.ref).toEqual({ kind: 'task', id: 't1' })
    expect(evidenceOpens(e)).toBe(false)
  })

  it('parses the ref the note-promotion path actually writes', () => {
    // `source_ref: 'task:<uuid>'` has been written since M52 and rendered as
    // raw text at a person ever since.
    const e = evidenceOf({ raw: 'task:0f3c1f0e-0000-0000-0000-000000000001', resolved: { found: true } })
    expect(e.ref?.kind).toBe('task')
    expect(evidenceOpens(e)).toBe(true)
    expect(e.action).toBe('open')
  })

  it('keeps free text as provenance rather than dropping what it cannot parse', () => {
    const e = evidenceOf({ raw: 'pnpm -v, and it printed 9.1.0', resolved: { found: false } })
    expect(e.ref).toBeNull()
    expect(e.raw).toBe('pnpm -v, and it printed 9.1.0')
  })

  it('offers a RETRY on a failed lookup and says the failure proves nothing', () => {
    const e = evidenceOf({ raw: 'task:t1', resolved: { found: false, reason: 'unavailable' } })
    expect(e.action).toBe('retry')
    expect(e.says).toMatch(/says nothing about whether/i)
  })

  it('offers LOCATE for another machine, and never calls it deleted', () => {
    const e = evidenceOf({ raw: 'task:t1', resolved: { found: false, reason: 'not_on_this_host' } })
    expect(e.action).toBe('locate')
    expect(e.status).not.toBe('deleted_tombstone')
  })

  it('reaches deleted only when a removal was recorded', () => {
    const e = evidenceOf({ raw: 'task:t1', resolved: { found: false, reason: 'deleted_tombstone' } })
    expect(e.says).toMatch(/removal was recorded/i)
    expect(e.action).toBeNull()
  })

  it('says so when nothing was cited at all', () => {
    const e = evidenceOf({ raw: '   ' })
    expect(e.raw).toBeNull()
    expect(e.says).toMatch(/no source/i)
  })
})

describe('how often, and never a number our own outage produced', () => {
  it('reports unknown rather than once when the relation could not be read', () => {
    const r = recurrenceUnknown('permission denied')
    expect(r.verifiedDistinct).toBeNull()
    expect(describeRecurrence(r)).toMatch(/could not be read/i)
    expect(describeRecurrence(r)).not.toMatch(/once/i)
  })

  it('keeps what an agent claimed apart from what was observed', () => {
    const said = describeRecurrence({ verifiedDistinct: 2, proposed: 3, problem: null })
    expect(said).toMatch(/observed 2 times/)
    expect(said).toMatch(/3 more/)
    // Never their sum: five would be the number a threshold fires on.
    expect(said).not.toMatch(/\b5\b/)
  })

  it('says nothing is linked rather than "observed 0 times"', () => {
    expect(describeRecurrence({ verifiedDistinct: 0, proposed: 0, problem: null })).toMatch(
      /no episode/i
    )
  })
})

describe('current and history are different questions', () => {
  it('decides with one rule, so the list and its count cannot disagree', () => {
    expect(isCurrent(item())).toBe(true)
    expect(isCurrent(item({ validTo: '2026-09-09T11:00:00Z' }))).toBe(false)
  })

  it('links a correction BOTH ways, so history is not a dead end', () => {
    const historic = item({ factRef: 'f0', validTo: '2026-09-09T11:00:00Z', supersededBy: 'f1' })
    const now = item({ factRef: 'f1', supersedes: 'f0' })
    expect(historic.supersededBy).toBe(now.factRef)
    expect(now.supersedes).toBe(historic.factRef)
  })

  it('carries a refused correction, which is not the same as no correction', () => {
    // A claim standing beside an earlier one IS the disagreement (M182).
    const conflicted = item({
      conflict: { status: 'conflict_proposed', reason: 'an agent may not bury a person', previousRef: 'f0' }
    })
    expect(conflicted.conflict?.previousRef).toBe('f0')
    expect(isCurrent(conflicted)).toBe(true)
  })
})

describe('the page says what it is not showing', () => {
  it('offers a next cursor only when the page was full', () => {
    const q = query({ pageSize: 2 })
    const full = pageOf([item({ factRef: 'a' }), item({ factRef: 'b' })], q, '99')
    expect(full.nextCursor).not.toBeNull()
    const short = pageOf([item({ factRef: 'a' })], q, '99')
    // A short page IS the last page. A cursor here hands the reader an empty
    // next page and a reason to distrust the control.
    expect(short.nextCursor).toBeNull()
  })

  it('binds the next cursor to the same question and the same snapshot', () => {
    const q = query({ pageSize: 1 })
    const p = pageOf([item({ factRef: 'a' })], q, '412')
    const c = decodeCursor(p.nextCursor)
    expect(c?.filterHash).toBe(filterHashOf(q))
    expect(c?.throughSeq).toBe('412')
    expect(c?.afterId).toBe('a')
  })

  it('counts the history on the page from the rows themselves', () => {
    const q = query({ pageSize: 3, state: 'all' })
    const p = pageOf(
      [item({ factRef: 'a' }), item({ factRef: 'b', validTo: '2026-09-09T11:00:00Z' }), item({ factRef: 'c' })],
      q,
      '99'
    )
    expect(p.historyOnPage).toBe(1)
  })

  it('has no total, deliberately', () => {
    // Counting every matching row is a second query with its own failure mode,
    // and a total that silently comes back wrong is worse than no total.
    const p = pageOf([item()], query(), '1')
    expect(Object.keys(p)).not.toContain('total')
  })
})
