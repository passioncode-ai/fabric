import { describe, expect, it } from 'vitest'
import { restoreTabs, toPersist, type PersistedTabs, type Tab } from './tabs.ts'

const project = (id: string): Tab => ({ kind: 'project', projectId: id })
const ref = (kind: 'project' | 'draft', id: string) => ({ kind, id })

/**
 * A settings file written BEFORE drafts were durable (AX-05).
 *
 * The cases below that use it were the original tests of this module, and they
 * are kept exactly because they now exercise the migration: an existing
 * installation must keep its arrangement across the change, and losing it would
 * be a small silent loss of the operator's own work.
 */
const legacy = (open: string[], active: string | null): PersistedTabs =>
  ({ open, active } as unknown as PersistedTabs)

describe('what survives a restart', () => {
  it('keeps project tabs in order, with the active one', () => {
    const p = toPersist([project('a'), project('b')], project('b'))
    expect(p).toEqual({ tabs: [ref('project', 'a'), ref('project', 'b')], active: ref('project', 'b') })
  })

  it('PERSISTS a draft now, and the reason it used not to is the reason it can', () => {
    // This case asserted the opposite until AX-05, with this reasoning: "a
    // draft holds unsaved work in renderer memory; quitting takes its content
    // whatever this does. Restoring the tab without it shows an empty form
    // claiming to be the operator's draft." That was correct about a loss this
    // module could not prevent — `shared/onboardingDraft.ts` removed the loss,
    // so the premise is gone. The old expectation is kept in the sentence above
    // rather than deleted, because a decision that changed is worth more than
    // one that looks as though it was never made.
    const p = toPersist([project('a'), { kind: 'draft', id: 'd1' }], { kind: 'draft', id: 'd1' })
    expect(p.tabs).toEqual([ref('project', 'a'), ref('draft', 'd1')])
    expect(p.active).toEqual(ref('draft', 'd1'))
  })

  it('collapses a project opened twice into one tab', () => {
    expect(toPersist([project('a'), project('a')], project('a')).tabs).toEqual([ref('project', 'a')])
  })

  it('and a draft opened twice, which the id makes possible', () => {
    const d = { kind: 'draft' as const, id: 'd1' }
    expect(toPersist([d, d], d).tabs).toEqual([ref('draft', 'd1')])
  })

  it('records the home tab as no active tab rather than as one', () => {
    expect(toPersist([project('a')], { kind: 'home' }).active).toBeNull()
  })

  it('and the agents view the same way, because it is a place and not a tab', () => {
    expect(toPersist([project('a')], { kind: 'agents' }).active).toBeNull()
  })
})

describe('reopening what is still there', () => {
  it('restores the set and the tab that was in front', () => {
    const r = restoreTabs(legacy(['a', 'b'], 'b'), ['a', 'b', 'c'])
    expect(r.tabs).toEqual([project('a'), project('b')])
    expect(r.active).toEqual(project('b'))
    expect(r.dropped).toEqual([])
  })

  it('DROPS a tab whose project is gone, and names it', () => {
    // Restoring it shows a broken tab; dropping it quietly loses part of the
    // operator's set without telling them. Neither is acceptable and only one is
    // a sentence.
    const r = restoreTabs(legacy(['a', 'gone'], 'gone'), ['a'])
    expect(r.tabs).toEqual([project('a')])
    expect(r.dropped).toEqual(['gone'])
  })

  it('falls back to home when the active tab was the one that vanished', () => {
    const r = restoreTabs(legacy(['a', 'gone'], 'gone'), ['a'])
    expect(r.active).toEqual({ kind: 'home' })
  })

  it('restores nothing from nothing, without throwing', () => {
    // A first run, and a settings file written by an older version.
    expect(restoreTabs(null, ['a'])).toEqual({ tabs: [], active: { kind: 'home' }, dropped: [] })
    expect(restoreTabs({ tabs: undefined as never, active: null }, ['a']).tabs).toEqual([])
  })

  it('restores a DRAFT tab only when its content is still on disk', () => {
    // One rule for both kinds: a tab comes back if the thing it names still
    // exists. `worthKeeping` writes nothing for a form nobody typed into, so an
    // untouched tab leaves no draft, finds no draft, and is not restored as
    // work — which is what keeps the restoration honest rather than a claim.
    const saved = toPersist([project('a'), { kind: 'draft', id: 'd1' }], { kind: 'draft', id: 'd1' })
    const withContent = restoreTabs(saved, ['a'], ['d1'])
    expect(withContent.tabs).toEqual([project('a'), { kind: 'draft', id: 'd1' }])
    expect(withContent.active).toEqual({ kind: 'draft', id: 'd1' })
    expect(withContent.dropped).toEqual([])

    // The same saved set, with nothing on disk for that draft.
    const without = restoreTabs(saved, ['a'], [])
    expect(without.tabs).toEqual([project('a')])
    expect(without.dropped).toEqual(['d1'])
    expect(without.active).toEqual({ kind: 'home' })
  })

  it('and a legacy file keeps its projects, because losing them is a silent loss', () => {
    // The migration path: a settings file written before AX-05 has project ids
    // in `open` and a bare id in `active`.
    const r = restoreTabs(legacy(['a', 'b'], 'a'), ['a', 'b'], [])
    expect(r.tabs).toEqual([project('a'), project('b')])
    expect(r.active).toEqual(project('a'))
  })

  it('does not resurrect a tab that was closed before quitting', () => {
    // The set is saved on every change, so closing four of five and quitting
    // gives back one. Saved only on quit, a crash would restore all five.
    const afterClosing = toPersist([project('a')], project('a'))
    expect(restoreTabs(afterClosing, ['a', 'b', 'c', 'd', 'e']).tabs).toEqual([project('a')])
  })
})
