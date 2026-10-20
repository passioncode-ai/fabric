// Reading a settings file field by field (S14).
//
// PURE, so it is tested rather than reasoned about: the binding that knows
// where `userData` lives is `main/settings.ts`, and everything about what a
// valid settings file IS lives here.
//
// THE OLD READ WAS `raw.theme ?? DEFAULTS.theme` per field, which accepts
// `theme: 42`, accepts `workspace: "yes"`, and lets any property a hand edit
// introduced survive the next save. Worse, it never failed — so a file that was
// half rubbish read as settings, and the next save wrote the merge back.
//
// Returning `null` is what makes a file UNREADABLE, which is what makes it
// quarantined instead of overwritten (`main/localState.ts`).

import { APP_SETTINGS_DEFAULTS, type AppSettings, type KeepAwake, type SettingsPatch } from './types'
import type { TabRef } from './tabs.ts'
import { cleanOrder, type FallbackEntry } from './runnerRoute.ts'

export { APP_SETTINGS_DEFAULTS }

// #region settings-patch — docs: docs/ux/scenarios.md#scn-026-follow-the-estate-through-the-journal-feed
/** The keys `settings.write` takes from a window (`types.ts#SettingsPatch`); main keeps the rest. */
/** How many per-thread read marks the settings file holds (SCN-143, the unread slice). */
const COMMS_READ_THROUGH_MAX = 4096

const PATCH_KEYS: readonly (keyof SettingsPatch)[] = ['theme', 'locale', 'keepAwake', 'readThroughSeq', 'commsReadThrough', 'firstRun', 'runnerFallback', 'agentPermissions', 'launchAtLogin']

/**
 * A window's settings write, checked before anything is merged (audit 2026-10-05 A7-008, A7-025). A key a
 * window may not change — `tabs`, `workspace`, anything unknown — refuses the whole write, and so does a
 * value the file could not hold: merged as it was, `theme: 42` would have been written and read back as
 * the default, a change nobody asked for.
 */
export function settingsPatch(raw: unknown): { ok: true; patch: SettingsPatch } | { ok: false; reason: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'a settings write is an object of changes' }
  const given = raw as Record<string, unknown>
  const foreign = Object.keys(given).filter((k) => !(PATCH_KEYS as readonly string[]).includes(k)).sort()
  if (foreign.length > 0) return { ok: false, reason: `a window may not write ${foreign.join(', ')}` }
  // Each value as the file would read it back; one that would not survive the read is refused, not replaced.
  const read = validateSettings({ ...APP_SETTINGS_DEFAULTS, ...given })
  const changed = Object.keys(given).filter((k) => JSON.stringify(read?.[k as keyof AppSettings]) !== JSON.stringify(given[k]))
  if (!read || changed.length > 0) return { ok: false, reason: `not a value the settings file can hold: ${changed.join(', ')}` }
  return { ok: true, patch: given as SettingsPatch }
}
// #endregion settings-patch

export function validateSettings(parsed: unknown): AppSettings | null {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const raw = parsed as Record<string, unknown>
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  const workspace = (v: unknown): AppSettings['workspace'] => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return { ...APP_SETTINGS_DEFAULTS.workspace }
    const w = v as Record<string, unknown>
    return {
      path: typeof w.path === 'string' ? w.path : null,
      git: oneOf(w.git, ['yes', 'declined', 'unanswered'] as const, 'unanswered')
    }
  }
  /**
   * The working set, in the current shape or the one before it (AX-05).
   *
   * A settings file written before drafts were durable holds `open: string[]`
   * and a bare project id in `active`. Both are read here and normalised to
   * `TabRef`, so an existing installation keeps its tabs across the change —
   * dropping them would be a small, silent loss of the operator's arrangement,
   * which is the class of thing this pack refuses.
   */
  const tabs = (v: unknown): AppSettings['tabs'] => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return { tabs: [], active: null }
    const t = v as Record<string, unknown>
    const ref = (x: unknown): TabRef | null => {
      if (typeof x !== 'object' || x === null) return null
      const r = x as Record<string, unknown>
      return (r.kind === 'project' || r.kind === 'draft') && typeof r.id === 'string'
        ? { kind: r.kind, id: r.id }
        : null
    }
    const current = Array.isArray(t.tabs)
      ? t.tabs.map(ref).filter((r): r is TabRef => r !== null)
      : null
    const legacy = Array.isArray(t.open)
      ? t.open.filter((x): x is string => typeof x === 'string').map((id) => ({ kind: 'project' as const, id }))
      : []
    return {
      tabs: current ?? legacy,
      active:
        ref(t.active) ??
        (typeof t.active === 'string' ? { kind: 'project' as const, id: t.active } : null)
    }
  }
  /** The fallback order (ADR-0125): known runners only, never the shell, each once, at most 16. */
  const runnerFallback = (v: unknown): AppSettings['runnerFallback'] => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return { order: [] }
    const order = (v as Record<string, unknown>).order
    if (!Array.isArray(order)) return { order: [] }
    const entries: FallbackEntry[] = order.flatMap((x): FallbackEntry[] => {
      if (x === null || typeof x !== 'object' || Array.isArray(x)) return []
      const e = x as Record<string, unknown>
      return typeof e.runner === 'string'
        ? [{ runner: e.runner, session: oneOf(e.session, ['spawn', 'attach-or-spawn', 'attach-only'] as const, 'spawn') }]
        : []
    })
    return { order: cleanOrder(entries).slice(0, 16) }
  }
  return {
    theme: oneOf(raw.theme, ['dark', 'light', 'system'] as const, APP_SETTINGS_DEFAULTS.theme),
    locale: oneOf(raw.locale, ['en', 'ru'] as const, APP_SETTINGS_DEFAULTS.locale),
    keepAwake: oneOf(
      raw.keepAwake,
      ['never', 'while-working', 'always'] as const,
      APP_SETTINGS_DEFAULTS.keepAwake
    ) as KeepAwake,
    workspace: workspace(raw.workspace),
    tabs: tabs(raw.tabs),
    // A read position from a file somebody edited, or from a build that did not
    // have one. Anything that is not a non-negative whole number means nothing
    // has been read — never everything, because that direction hides history
    // (AX-07).
    readThroughSeq:
      typeof raw.readThroughSeq === 'number' &&
      Number.isInteger(raw.readThroughSeq) &&
      raw.readThroughSeq >= 0
        ? raw.readThroughSeq
        : APP_SETTINGS_DEFAULTS.readThroughSeq,
    // Thread id -> last seq this operator has seen (SCN-143, the unread slice). The same
    // direction rule as readThroughSeq: a mark that is not a non-negative whole number, or a
    // shape that is not a plain record of them, reads as NOTHING seen — never as everything,
    // because that direction hides the board. Bounded so a hand-edited or runaway file cannot
    // grow without limit; past the bound the marks read as nothing rather than half-kept.
    commsReadThrough:
      raw.commsReadThrough !== null && typeof raw.commsReadThrough === 'object' && !Array.isArray(raw.commsReadThrough) &&
      Object.keys(raw.commsReadThrough).length <= COMMS_READ_THROUGH_MAX &&
      Object.values(raw.commsReadThrough as Record<string, unknown>).every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0)
        ? { ...(raw.commsReadThrough as Record<string, number>) }
        : APP_SETTINGS_DEFAULTS.commsReadThrough,
    // A completion stamp is an ISO timestamp or nothing; anything else reads as
    // "not finished", which at worst shows the first run to an empty estate again.
    runnerFallback: runnerFallback(raw.runnerFallback),
    agentPermissions: raw.agentPermissions === 'manual' ? 'manual' : 'fewer-prompts',
    launchAtLogin: raw.launchAtLogin !== false,
    firstRun: {
      completedAt:
        raw.firstRun !== null && typeof raw.firstRun === 'object' && !Array.isArray(raw.firstRun) &&
        typeof (raw.firstRun as Record<string, unknown>).completedAt === 'string' &&
        !Number.isNaN(Date.parse((raw.firstRun as Record<string, unknown>).completedAt as string))
          ? ((raw.firstRun as Record<string, unknown>).completedAt as string)
          : null
    }
  }
}
