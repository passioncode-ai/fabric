import { describe, expect, it } from 'vitest'
import { digestOf, type DigestInput } from './digest.ts'

const empty: DigestInput = { decisions: [], corrections: [], reviews: [], sessions: [] }

/** The journal head a reading was taken at (UX28-03). Fixed here so these
 *  cases stay about WHICH LINES a digest contains; the boundary's own rules are
 *  asserted at the bottom of this file. */
const BOUNDARY = 500

describe('the digest', () => {
  it('says FIRST VISIT rather than "nothing new" when there is no mark', () => {
    // Never having looked and having looked and found nothing are different
    // facts, and only one of them is reassuring.
    expect(digestOf(empty, null, BOUNDARY)).toEqual({ state: 'first-visit', boundary: BOUNDARY })
  })

  it('says nothing-new when it read and found nothing', () => {
    expect(digestOf(empty, 100, BOUNDARY)).toEqual({ state: 'nothing-new', boundary: BOUNDARY })
  })

  it('shows only what happened AFTER the mark', () => {
    const input: DigestInput = {
      ...empty,
      decisions: [
        { id: 'old', claim: 'before you left', recorded_at: '2026-09-01T00:00:00Z', seq: 50 },
        { id: 'new', claim: 'while you were gone', recorded_at: '2026-09-05T00:00:00Z', seq: 150 }
      ]
    }
    const digest = digestOf(input, 100, BOUNDARY)
    expect(digest.state).toBe('lines')
    if (digest.state === 'lines') expect(digest.lines.map((l) => l.text)).toEqual(['while you were gone'])
  })

  it('is CHRONOLOGICAL across kinds — catching up is a story, not a report by category', () => {
    const input: DigestInput = {
      decisions: [{ id: 'd', claim: 'decided', recorded_at: 'x', seq: 30 }],
      corrections: [{ id: 'c', claim: 'corrected', recorded_at: 'x', seq: 10, supersedes: 'old' }],
      reviews: [{ id: 'r', title: 'reviewed', instruction: 'i', at: 'x', seq: 20 }],
      sessions: [{ session_id: 's', annotation: 'ran', ended_at: 'x', seq: 40 }]
    }
    const digest = digestOf(input, 0, BOUNDARY)
    expect(digest.state).toBe('lines')
    if (digest.state === 'lines')
      expect(digest.lines.map((l) => l.text)).toEqual(['corrected', 'reviewed', 'decided', 'ran'])
  })

  it('every line names what opens it — a line that cannot is not a line', () => {
    const input: DigestInput = {
      decisions: [{ id: 'd1', claim: 'a decision', recorded_at: 'x', seq: 1 }],
      corrections: [{ id: 'c1', claim: 'a correction', recorded_at: 'x', seq: 2, supersedes: 'old' }],
      reviews: [{ id: 't1', title: null, instruction: 'a task', at: 'x', seq: 3 }],
      sessions: [{ session_id: 's1', annotation: 'a session', ended_at: 'x', seq: 4 }]
    }
    const digest = digestOf(input, 0, BOUNDARY)
    if (digest.state !== 'lines') throw new Error('expected lines')
    for (const line of digest.lines) {
      expect(line.source.store).toBeTruthy()
      expect(line.source.id).toBeTruthy()
    }
    expect(digest.lines.map((l) => l.source.store)).toEqual([
      'memory_facts',
      'memory_facts',
      'project_tasks',
      'session_transcripts'
    ])
  })

  it('capture time is not an invented ending, including legacy rows', () => {
    const digest = digestOf({ ...empty, sessions: [
      { session_id: 'unknown', annotation: 'partial', ended_at: null, captured_at: '2026-09-27T12:00:00Z', ending_provenance: 'unknown', seq: 1 },
      { session_id: 'legacy', annotation: 'old', ended_at: '2025-01-01T00:00:00Z', captured_at: null, ending_provenance: 'legacy', seq: 2 },
      { session_id: 'observed', annotation: 'done', ended_at: '2026-09-27T11:00:00Z', captured_at: '2026-09-27T12:00:00Z', ending_provenance: 'observed', seq: 3 }
    ] }, 0, BOUNDARY)
    if (digest.state !== 'lines') throw new Error('expected lines')
    expect(digest.lines.map(({kind,at}) => ({kind,at}))).toEqual([
      {kind: 'capture', at: '2026-09-27T12:00:00Z'}, {kind: 'capture', at: null}, {kind: 'session', at: '2026-09-27T11:00:00Z'}
    ])
  })

  it('falls back to a task instruction when it has no title, never to an empty line', () => {
    const digest = digestOf(
      { ...empty, reviews: [{ id: 't', title: null, instruction: 'survey the repo', at: 'x', seq: 5 }] },
      0,
      BOUNDARY
    )
    if (digest.state !== 'lines') throw new Error('expected lines')
    expect(digest.lines[0].text).toBe('survey the repo')
  })

  it('treats the mark as exclusive — what you already saw does not come back', () => {
    const digest = digestOf(
      { ...empty, decisions: [{ id: 'd', claim: 'seen', recorded_at: 'x', seq: 100 }] },
      100,
      BOUNDARY
    )
    expect(digest).toEqual({ state: 'nothing-new', boundary: BOUNDARY })
  })

  // ── the boundary (UX28-03) ───────────────────────────────────────────────
  //
  // The number a reading may acknowledge, carried BY the reading. Without it
  // the renderer asked the journal for its head when the operator left — and
  // it re-reads whenever the mark moves, so the refresh acknowledged the very
  // events that had caused it.

  it('carries the boundary out on every state, including the two empty ones', () => {
    // All three, because the empty states are where sweeping matters most:
    // "nothing happened" must still advance, or a kind the digest does not
    // display piles up forever.
    expect(digestOf(empty, null, 7).boundary).toBe(7)
    expect(digestOf(empty, 100, 7).boundary).toBe(7)
    const withLines = digestOf(
      { ...empty, decisions: [{ id: 'd', claim: 'new', recorded_at: 'x', seq: 101 }] },
      100,
      7
    )
    expect(withLines.boundary).toBe(7)
  })

  it('is the HEAD it was read at, not the highest line it shows', () => {
    // The difference is the whole reason the old always-advance cleanup
    // existed: an event of a kind this digest does not display sits between
    // the last line and the head, and must be swept rather than accumulate.
    const digest = digestOf(
      { ...empty, decisions: [{ id: 'd', claim: 'new', recorded_at: 'x', seq: 101 }] },
      100,
      900
    )
    if (digest.state !== 'lines') throw new Error('expected lines')
    expect(digest.lines.at(-1)?.seq).toBe(101)
    expect(digest.boundary).toBe(900)
  })

  it('passes a null boundary through rather than inventing a number', () => {
    // A head that could not be read is not a boundary of zero: zero would mark
    // "the operator has seen nothing", which is a claim, and null is the
    // absence of one. The renderer acknowledges nothing for it.
    expect(digestOf(empty, 100, null).boundary).toBeNull()
    expect(digestOf(empty, null, null)).toEqual({ state: 'first-visit', boundary: null })
  })
})
