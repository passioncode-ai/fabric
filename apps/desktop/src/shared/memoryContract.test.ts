import { describe, expect, it } from 'vitest'
import {
  ABOUT_NAMESPACES,
  CORRECTION_OUTCOMES,
  DEFAULT_CATEGORY,
  INSIGHT_CATEGORIES,
  aboutKey,
  corrected,
  countsTowardRecurrence,
  describeCorrection,
  normaliseAbout,
  occurrenceKey,
  recurrence,
  type Correction,
  type OccurrenceGrouping
} from './memoryContract.ts'

describe('the category is closed, and it is not the kind', () => {
  it('names exactly the five the schema allows', () => {
    expect(INSIGHT_CATEGORIES).toEqual(['project', 'agents', 'harness', 'fabric', 'process'])
  })

  it('defaults to the project, which is what every older fact actually is', () => {
    // Not a guess: the old writer had one subject, the project it ran in.
    expect(DEFAULT_CATEGORY).toBe('project')
    expect(INSIGHT_CATEGORIES).toContain(DEFAULT_CATEGORY)
  })
})

describe('what a fact is ABOUT is a key, never a path', () => {
  it('makes one subject out of the spellings people actually type', () => {
    const forms = ['Claude-Code', 'claude code ', 'claude_code', 'CLAUDE   CODE']
    const keys = forms.map((key) => aboutKey(normaliseAbout({ namespace: 'provider', key })))
    expect(new Set(keys).size).toBe(1)
    expect(keys[0]).toBe('provider:claude-code')
  })

  it('refuses a namespace it does not know rather than inventing one', () => {
    expect(normaliseAbout({ namespace: 'file', key: 'index.ts' })).toBeNull()
    for (const namespace of ABOUT_NAMESPACES)
      expect(normaliseAbout({ namespace, key: 'x' })).toEqual({ namespace, key: 'x' })
  })

  it('is nothing when there is nothing to key on', () => {
    // An unnormalisable subject is no subject. Inventing one merges claims that
    // were never about the same thing.
    expect(normaliseAbout({ namespace: 'provider', key: '   ' })).toBeNull()
    expect(normaliseAbout({ namespace: 'provider', key: '---' })).toBeNull()
    expect(normaliseAbout(null)).toBeNull()
    expect(aboutKey(null)).toBeNull()
  })

  it('caps the key rather than carrying a document into an index', () => {
    const long = normaliseAbout({ namespace: 'skill', key: 'a'.repeat(400) })
    expect(long?.key.length).toBe(256)
  })
})

describe('a correction has an outcome, and the outcome is not the request', () => {
  const of = (status: Correction['status'], reason: string | null = null): Correction => ({
    status,
    reason,
    previousRef: 'f1'
  })

  it('knows the only status that means corrected', () => {
    expect(CORRECTION_OUTCOMES).toEqual([
      'not_requested',
      'superseded',
      'conflict_proposed',
      'rejected'
    ])
    expect(corrected(of('superseded'))).toBe(true)
    for (const s of ['not_requested', 'conflict_proposed', 'rejected'] as const)
      expect(corrected(of(s))).toBe(false)
  })

  it('says the earlier fact still stands, in the sentence, on a conflict', () => {
    // The defect: the tool returned `superseded: <the id it asked for>` after
    // the projector had refused the burial, so the agent believed a fact it can
    // still read had been retired.
    const said = describeCorrection(
      of('conflict_proposed', 'an agent may not bury what a person recorded')
    )
    expect(said).toMatch(/still stands/i)
    expect(said).toMatch(/person/i)
  })

  it('never reads as a correction when none was asked for', () => {
    expect(describeCorrection({ status: 'not_requested', reason: null, previousRef: null })).not.toMatch(
      /stopped answering/i
    )
  })

  it('carries a reason on every outcome the writer did not ask for', () => {
    for (const s of ['conflict_proposed', 'rejected'] as const) {
      const said = describeCorrection(of(s, 'because'))
      expect(said).toMatch(/because/)
    }
  })
})

describe('an occurrence is an incident, not a mention of one', () => {
  const origin = { system: 'fabric.session', sourceId: 's1', episodeKey: 'e1' }

  it('gives three facts about one incident one identity', () => {
    // "Same incident referenced by 3 task runs and 3 memory commands → 1
    // occurrence, not 3." Identity is the capture episode; the fact that cites
    // it is not part of it.
    const keys = [1, 2, 3].map(() => occurrenceKey(origin))
    expect(new Set(keys).size).toBe(1)
  })

  it('keeps three genuinely different episodes apart', () => {
    const keys = ['e1', 'e2', 'e3'].map((episodeKey) => occurrenceKey({ ...origin, episodeKey }))
    expect(new Set(keys).size).toBe(3)
  })

  it('is nothing when any part of the origin is missing', () => {
    expect(occurrenceKey({ ...origin, sourceId: '' })).toBeNull()
    expect(occurrenceKey(null)).toBeNull()
  })

  it('does not let an agent establish distinctness on its own say-so', () => {
    expect(countsTowardRecurrence('host_observed')).toBe(true)
    expect(countsTowardRecurrence('reviewed')).toBe(true)
    expect(countsTowardRecurrence('agent_proposed')).toBe(false)
  })

  it('reports the countable number and the provisional one, never their sum', () => {
    const rows: { key: string; grouping: OccurrenceGrouping }[] = [
      { key: 'a', grouping: 'host_observed' },
      { key: 'b', grouping: 'reviewed' },
      { key: 'c', grouping: 'agent_proposed' },
      { key: 'd', grouping: 'agent_proposed' }
    ]
    expect(recurrence(rows)).toEqual({ counted: 2, provisional: 2 })
  })

  it('stops calling an episode provisional once a host observed it', () => {
    const rows: { key: string; grouping: OccurrenceGrouping }[] = [
      { key: 'a', grouping: 'agent_proposed' },
      { key: 'a', grouping: 'host_observed' }
    ]
    expect(recurrence(rows)).toEqual({ counted: 1, provisional: 0 })
  })
})
