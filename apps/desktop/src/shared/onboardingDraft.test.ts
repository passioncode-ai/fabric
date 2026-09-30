// A half-described project survives quitting (AX-05).
//
// The onboarding draft lived in `useState`, so an operator part-way through
// describing a project lost the name, the purpose and the repositories they had
// picked when the app closed. `shared/tabs.ts` knew — its header says draft tabs
// are not restored because "quitting takes its content whatever this file does"
// — and chose the honest half of a bad pair: hide the tab rather than show an
// empty form claiming to be the operator's work.
//
// These cases are about the two rules that decide whether restoring is honest:
// what is worth keeping, and what a file is allowed to contain.

import { describe, expect, it } from 'vitest'
import {
  EMPTY_DRAFT,
  isStarted,
  validateDraftFile,
  worthKeeping,
  type Draft
} from './onboardingDraft'

const draft = (over: Partial<Draft> = {}): Draft => ({ ...EMPTY_DRAFT, ...over })

describe('an untouched form is not work', () => {
  it('does not count a freshly opened tab as a draft', () => {
    // `projectId` is minted when the tab opens, before a keystroke. Counting it
    // would restore a tab nobody typed into — the same false claim from the
    // other direction.
    expect(isStarted(draft({ projectId: 'p-1' }))).toBe(false)
    expect(isStarted(draft())).toBe(false)
  })

  it('but counts a name, a purpose or a chosen repository', () => {
    expect(isStarted(draft({ name: 'Atlas' }))).toBe(true)
    expect(isStarted(draft({ purpose: 'keep the ledger' }))).toBe(true)
    expect(isStarted(draft({ repoPaths: ['/atlas'] }))).toBe(true)
  })

  it('and whitespace is not a name', () => {
    // Otherwise a stray space in a field restores a tab that looks empty and
    // claims to hold work.
    expect(isStarted(draft({ name: '   ', purpose: '\n' }))).toBe(false)
  })

  it('so only started drafts are kept', () => {
    const kept = worthKeeping({
      'tab-1': draft({ projectId: 'a', name: 'Atlas' }),
      'tab-2': draft({ projectId: 'b' })
    })
    expect(Object.keys(kept)).toEqual(['tab-1'])
  })
})

describe('a file this product wrote, or nothing', () => {
  it('accepts what it writes', () => {
    const file = { 'tab-1': draft({ projectId: 'p', name: 'Atlas', repoPaths: ['/a'] }) }
    expect(validateDraftFile(file)).toEqual(file)
  })

  it('rejects the whole file when ONE draft is wrong, rather than dropping it', () => {
    // A half-restored set of drafts is a set the operator cannot reason about:
    // they would see three tabs where they left four and have no way to know
    // which is missing or why.
    const good = draft({ projectId: 'p', name: 'Atlas' })
    expect(validateDraftFile({ ok: good, bad: { ...good, memory: 'floppy' } })).toBeNull()
    expect(validateDraftFile({ ok: good, bad: { ...good, repoPaths: 'not a list' } })).toBeNull()
    expect(validateDraftFile({ ok: good, bad: { ...good, repoPaths: [1, 2] } })).toBeNull()
    expect(validateDraftFile({ ok: good, bad: { ...good, name: null } })).toBeNull()
  })

  it('and rejects the shapes a hand-edited file takes', () => {
    // `localStore` demands a validator in these words: "it parsed" is not "it is
    // what we asked for", and a list turned into an object once reached the
    // renderer and broke the estate home.
    expect(validateDraftFile(null)).toBeNull()
    expect(validateDraftFile([])).toBeNull()
    expect(validateDraftFile('{}')).toBeNull()
    expect(validateDraftFile(42)).toBeNull()
    expect(validateDraftFile({ '': draft() })).toBeNull()
  })

  it('but an empty file is valid, because no drafts is a real state', () => {
    expect(validateDraftFile({})).toEqual({})
  })
})
