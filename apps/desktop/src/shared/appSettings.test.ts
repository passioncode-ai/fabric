import { describe, expect, it } from 'vitest'
import { APP_SETTINGS_DEFAULTS, validateSettings } from './appSettings.ts'

describe('validateSettings', () => {
  it('accepts a complete, valid file unchanged', () => {
    const file = {
      theme: 'light',
      locale: 'ru',
      keepAwake: 'never',
      workspace: { path: '/w', git: 'yes' },
      tabs: { tabs: [{ kind: 'project', id: 'a' }, { kind: 'draft', id: 'd1' }], active: { kind: 'draft', id: 'd1' } },
      // A saved read position must survive validation unchanged, or marking
      // things read would not outlive a restart (AX-07).
      readThroughSeq: 42,
      firstRun: { completedAt: '2026-10-03T10:00:00.000Z' }
    }
    expect(validateSettings(file)).toEqual(file)
  })

  it('and MIGRATES a file written before drafts were durable (AX-05)', () => {
    // The old shape held project ids in `open` and a bare id in `active`. An
    // existing installation must keep its arrangement across the change:
    // dropping it would be a small silent loss of the operator's own set, which
    // is the class of thing this pack refuses.
    const got = validateSettings({ tabs: { open: ['a', 'b'], active: 'b' } })
    expect(got?.tabs).toEqual({
      tabs: [
        { kind: 'project', id: 'a' },
        { kind: 'project', id: 'b' }
      ],
      active: { kind: 'project', id: 'b' }
    })
  })

  it('refuses a file that is not an object, so it can be quarantined', () => {
    // `null` is what makes the file unreadable, and unreadable is what stops it
    // being overwritten by defaults — the path that destroyed data.
    expect(validateSettings(null)).toBeNull()
    expect(validateSettings([1, 2])).toBeNull()
    expect(validateSettings('dark')).toBeNull()
  })

  it('falls back per FIELD, so one bad value does not poison the object', () => {
    const got = validateSettings({ theme: 42, locale: 'ru', keepAwake: 'yes please' })
    expect(got?.theme).toBe(APP_SETTINGS_DEFAULTS.theme)
    expect(got?.locale).toBe('ru')
    expect(got?.keepAwake).toBe(APP_SETTINGS_DEFAULTS.keepAwake)
  })

  it('drops an unknown property instead of carrying it into the next save', () => {
    const got = validateSettings({ theme: 'dark', sneaked: 'through' })
    expect(got).not.toHaveProperty('sneaked')
  })

  it('repairs a nested object rather than accepting a string in its place', () => {
    const got = validateSettings({ workspace: 'yes', tabs: 7 })
    expect(got?.workspace).toEqual(APP_SETTINGS_DEFAULTS.workspace)
    expect(got?.tabs).toEqual({ tabs: [], active: null })
  })

  it('keeps only the well-formed entries of a hand-edited tab list', () => {
    // The legacy array, hand-edited: non-strings out.
    expect(validateSettings({ tabs: { open: ['a', 3, null, 'b'], active: 9 } })?.tabs).toEqual({
      tabs: [
        { kind: 'project', id: 'a' },
        { kind: 'project', id: 'b' }
      ],
      active: null
    })
    // And the current array: an entry with an unknown kind or a missing id is
    // not a tab, and a file naming one is not a reason to lose the rest.
    expect(
      validateSettings({
        tabs: {
          tabs: [{ kind: 'project', id: 'a' }, { kind: 'sideways', id: 'x' }, { kind: 'draft' }],
          active: { kind: 'project', id: 'a' }
        }
      })?.tabs
    ).toEqual({ tabs: [{ kind: 'project', id: 'a' }], active: { kind: 'project', id: 'a' } })
  })

  it('reads an unanswered workspace question as unanswered, not as declined', () => {
    // Three states, not two: `unanswered` means nobody asked and `declined`
    // means somebody answered. Collapsing them either nags a person who said no
    // or quietly never asks.
    expect(validateSettings({ workspace: { path: null, git: 'maybe' } })?.workspace.git).toBe(
      'unanswered'
    )
  })
})

describe('a read position is normalised on the way in', () => {
  // It comes off a file somebody can edit, and from builds that did not have
  // the field at all. Every unusable value means NOTHING read — never
  // everything, because that direction hides the history rather than repeating
  // it (AX-07).
  it('treats a missing, negative or fractional position as nothing read', () => {
    for (const bad of [undefined, -1, 1.5, 'twelve', null, NaN]) {
      const got = validateSettings({ readThroughSeq: bad })
      expect(got?.readThroughSeq, `${String(bad)} should read as nothing read`).toBe(0)
    }
  })

  it('but keeps a real one', () => {
    expect(validateSettings({ readThroughSeq: 7 })?.readThroughSeq).toBe(7)
    expect(validateSettings({ readThroughSeq: 0 })?.readThroughSeq).toBe(0)
  })

  it('keeps a first-run completion stamp and reads anything else as not finished (ADR-0100)', () => {
    expect(validateSettings({ firstRun: { completedAt: '2026-10-03T10:00:00.000Z' } })?.firstRun.completedAt).toBe('2026-10-03T10:00:00.000Z')
    for (const bad of [undefined, null, 'yes', { completedAt: 42 }, { completedAt: 'not a date' }, []]) {
      expect(validateSettings({ firstRun: bad })?.firstRun.completedAt, String(JSON.stringify(bad))).toBeNull()
    }
  })
})
