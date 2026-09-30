import { describe, expect, it } from 'vitest'
import { SEARCH_CAP, coverageOfStore, outcomeOf, type SearchGroup, type SearchHit } from './search.ts'

const hit = (id: string): SearchHit => ({
  id,
  projectId: 'p',
  projectName: 'Fabric',
  text: 'something',
  at: '2026-09-05T00:00:00Z'
})
const group = (store: SearchGroup['store'], hits: SearchHit[]): SearchGroup => ({
  store,
  method: store === 'tasks' ? 'substring' : 'ranked',
  hits,
  problem: null,
  // Built the way the reader builds it, from the row count — a hand-written
  // coverage would let a group claim a completeness its own length denies.
  coverage: coverageOfStore(hits.length),
  labelProblem: null
})
const failed = (store: SearchGroup['store']): SearchGroup => ({
  store,
  method: 'ranked',
  hits: [],
  problem: 'permission denied',
  coverage: coverageOfStore(0),
  labelProblem: null
})

describe('the outcome of a search', () => {
  it('counts what was found across the stores that answered', () => {
    expect(outcomeOf([group('facts', [hit('a'), hit('b')]), group('tasks', [hit('c')])])).toEqual({
      state: 'found',
      total: 3,
      partial: false
    })
  })

  it('says NOTHING only when every store answered', () => {
    expect(outcomeOf([group('facts', []), group('transcripts', []), group('tasks', [])])).toEqual({
      state: 'nothing'
    })
  })

  it('is INCONCLUSIVE when a store was silent and nothing else matched', () => {
    // "We looked everywhere and found nothing" and "we looked in two of three
    // places" are different answers, and only one of them settles the question.
    expect(outcomeOf([group('facts', []), failed('transcripts')])).toEqual({
      state: 'inconclusive',
      silent: ['transcripts']
    })
  })

  it('a store that returned rows AND failed still contributes nothing', () => {
    // The guard's real case, and it is DEFENSIVE: PostgREST sets `data` to null
    // when it errors, so today a failed group is empty anyway and the filter
    // changes no total. Found by planting its removal and watching nothing
    // fail. It is kept and pinned here because it encodes the rule rather than
    // the current shape of one client — a store that one day returns a partial
    // page with an error must not have that page counted as an answer.
    const halfRead: SearchGroup = {
      store: 'transcripts',
      method: 'ranked',
      hits: [hit('partial')],
      problem: 'connection reset mid-page',
      coverage: coverageOfStore(1),
      labelProblem: null
    }
    expect(outcomeOf([group('facts', []), halfRead])).toEqual({
      state: 'inconclusive',
      silent: ['transcripts']
    })
  })

  it('a failed store contributes NOTHING to the total, not zero', () => {
    // Counting it as zero would make the total a measurement of our luck
    // rather than of the estate.
    const withFailure = outcomeOf([group('facts', [hit('a')]), failed('tasks')])
    expect(withFailure).toEqual({ state: 'found', total: 1, partial: true })
  })

  it('marks a result set PARTIAL when something was found but a store stayed silent', () => {
    const outcome = outcomeOf([group('facts', [hit('a')]), failed('transcripts')])
    expect(outcome.state === 'found' && outcome.partial).toBe(true)
  })

  it('names every silent store, not just the first', () => {
    const outcome = outcomeOf([group('facts', []), failed('transcripts'), failed('tasks')])
    expect(outcome).toEqual({ state: 'inconclusive', silent: ['transcripts', 'tasks'] })
  })

  it('calls a store that came back FULL incomplete, not complete', () => {
    // Measured before this existed: all three stores were queried with a bare
    // `.limit(20)` and the group said nothing about it, so a search for a
    // common word reported "60 found" with `partial: false` — a completeness
    // claim made by a list that had been cut three times.
    const full = group('facts', Array.from({ length: SEARCH_CAP }, (_, i) => hit(`h${i}`)))
    expect(full.coverage.truncated).toBe(true)
    const outcome = outcomeOf([full])
    expect(outcome).toEqual({ state: 'found', total: SEARCH_CAP, partial: true })
  })

  it('knows a short answer is the whole answer', () => {
    // Below the cap the count IS the total: a query capped at twenty that
    // returned three returned all three. Reporting that as unknown would make
    // every ordinary search look uncertain, which teaches the reader to ignore
    // the warning that matters.
    expect(coverageOfStore(3).truncated).toBe(false)
    expect(outcomeOf([group('facts', [hit('a')])])).toEqual({
      state: 'found',
      total: 1,
      partial: false
    })
  })

  it('still says NOTHING when a store was cut off and returned no rows', () => {
    // A cut list with zero rows is an empty list — truncation cannot hide a hit
    // that would have been in the first twenty.
    expect(outcomeOf([group('facts', []), group('transcripts', []), group('tasks', [])])).toEqual({
      state: 'nothing'
    })
  })

  it('keeps the search METHOD with its group — a ranked hit and a substring hit are different promises', () => {
    const groups = [group('facts', [hit('a')]), group('tasks', [hit('b')])]
    expect(groups.map((g) => g.method)).toEqual(['ranked', 'substring'])
  })
})
