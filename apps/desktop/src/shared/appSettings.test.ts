import { describe, expect, it } from 'vitest'
import { APP_SETTINGS_DEFAULTS, settingsPatch, validateSettings } from './appSettings.ts'

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
      // Per-thread board marks survive the same way (SCN-143, the unread slice).
      commsReadThrough: { '79000000-0000-4000-8000-0000000000d1': 40 },
      firstRun: { completedAt: '2026-10-03T10:00:00.000Z' },
      runnerFallback: { order: [{ runner: 'claude-code', session: 'attach-only' }, { runner: 'hermes', session: 'spawn' }] },
      agentPermissions: 'manual',
      launchAtLogin: false
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

  it('keeps per-thread comms read marks, and reads an unusable one as nothing seen (SCN-143)', () => {
    expect(validateSettings({ commsReadThrough: { t1: 40, t2: 0 } })?.commsReadThrough).toEqual({ t1: 40, t2: 0 })
    for (const bad of [undefined, null, [], 'read', { t1: -1 }, { t1: 1.5 }, { t1: 'forty' }]) {
      const got = validateSettings({ commsReadThrough: bad })
      expect(got?.commsReadThrough, String(JSON.stringify(bad))).toEqual({})
    }
  })

  it('keeps a fallback order of known runners only, each once, never the shell (ADR-0125)', () => {
    const read = validateSettings({ runnerFallback: { order: [
      { runner: 'claude-code', session: 'attach-only' }, { runner: 'shell', session: 'spawn' },
      { runner: 'hermes', session: 'weird' }, { runner: 'claude-code', session: 'spawn' }, 'x', { runner: 42 }
    ] } })
    expect(read?.runnerFallback).toEqual({ order: [{ runner: 'claude-code', session: 'attach-only' }, { runner: 'hermes', session: 'spawn' }] })
    expect(validateSettings({ runnerFallback: 'yes' })?.runnerFallback).toEqual({ order: [] })
  })
})

// Audit 2026-10-05 A7-008 / A7-025: a window changes only the preferences it shows.
describe('settingsPatch', () => {
  it('accepts each key a window may change, as sent', () => {
    const patch = {
      theme: 'light', locale: 'ru', keepAwake: 'always', readThroughSeq: 7,
      commsReadThrough: { '79000000-0000-4000-8000-0000000000d1': 40 },
      firstRun: { completedAt: '2026-10-11T10:00:00.000Z' },
      runnerFallback: { order: [{ runner: 'claude-code', session: 'spawn' }] }
    }
    expect(settingsPatch(patch)).toEqual({ ok: true, patch })
  })

  it('refuses the whole settings object — what "Mark read" used to send — naming tabs and workspace', () => {
    const got = settingsPatch({ ...APP_SETTINGS_DEFAULTS, readThroughSeq: 9 })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reason).toMatch(/tabs, workspace/)
  })

  it('refuses a workspace path from a window: only the folder picker or an import sets it (A7-025)', () => {
    expect(settingsPatch({ workspace: { path: '/etc', git: 'yes' } }).ok).toBe(false)
  })

  it('refuses a value the file could not hold, instead of writing a default in its place', () => {
    expect(settingsPatch({ theme: 42 }).ok).toBe(false)
    expect(settingsPatch({ readThroughSeq: -1 }).ok).toBe(false)
    expect(settingsPatch({ locale: 'xx' }).ok).toBe(false)
    expect(settingsPatch({ firstRun: { completedAt: 'soon' } }).ok).toBe(false)
    expect(settingsPatch({ commsReadThrough: { t1: -1 } }).ok).toBe(false)
  })

  it('refuses what is not an object', () => {
    expect(settingsPatch(null).ok).toBe(false)
    expect(settingsPatch([]).ok).toBe(false)
  })

  it('keeps one permission choice for every agent, fewer prompts unless the person chose manual checks (ADR-0168)', () => {
    expect(APP_SETTINGS_DEFAULTS.agentPermissions).toBe('fewer-prompts')
    expect(validateSettings({})?.agentPermissions).toBe('fewer-prompts')
    expect(validateSettings({ agentPermissions: 'manual' })?.agentPermissions).toBe('manual')
    expect(validateSettings({ agentPermissions: 'yolo' })?.agentPermissions).toBe('fewer-prompts')
    expect(settingsPatch({ agentPermissions: 'manual' })).toEqual({ ok: true, patch: { agentPermissions: 'manual' } })
    expect(settingsPatch({ agentPermissions: 'yolo' }).ok).toBe(false)
  })

  it('starts Fabric at login unless the person turned it off (CO-322)', () => {
    expect(APP_SETTINGS_DEFAULTS.launchAtLogin).toBe(true)
    expect(validateSettings({})?.launchAtLogin).toBe(true)
    expect(validateSettings({ launchAtLogin: false })?.launchAtLogin).toBe(false)
    expect(validateSettings({ launchAtLogin: 'no' })?.launchAtLogin).toBe(true)
    expect(settingsPatch({ launchAtLogin: false })).toEqual({ ok: true, patch: { launchAtLogin: false } })
    expect(settingsPatch({ launchAtLogin: 'no' }).ok).toBe(false)
  })
})
