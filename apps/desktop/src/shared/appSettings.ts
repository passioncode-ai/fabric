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

import { APP_SETTINGS_DEFAULTS, type AppSettings, type KeepAwake } from './types'
import type { TabRef } from './tabs.ts'

export { APP_SETTINGS_DEFAULTS }

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
        : APP_SETTINGS_DEFAULTS.readThroughSeq
  }
}
