// App-level settings — theme and locale. Deliberately NOT project settings:
// those are journal events with revisions because they must survive a move to
// another machine; these are this installation's own preferences and live in a
// small JSON in userData. Conflating the two is how a preference ends up in the
// domain record (iteration-1-modules.md §10).

import { DEFAULT_KEEP_AWAKE, type KeepAwake } from './power'
import { localStore } from './localStore.ts'
import type { LocalRead } from './localState.ts'
import { APP_SETTINGS_DEFAULTS } from '../shared/types'
import { validateSettings } from '../shared/appSettings.ts'
import type { AppSettings, SettingsWrite } from '../shared/types'
export type { AppSettings } from '../shared/types'


const DEFAULTS = APP_SETTINGS_DEFAULTS

/**
 * A settings file, validated FIELD BY FIELD rather than spread.
 *
 * The old read did `raw.theme ?? DEFAULTS.theme` and `raw.workspace ?? {...}` —
 * which accepts `theme: 42` and `workspace: "yes"` and hands them to the app,
 * and which lets any unknown property a hand edit introduced survive a save.
 * Each field is now checked against what it may be, and an unrecognised value
 * falls back to the default for THAT field instead of poisoning the object.
 *
 * Returning `null` from here is what makes the file unreadable, which is what
 * makes it quarantined instead of overwritten (`localState.ts`).
 */

const store = localStore<AppSettings>('settings.json', DEFAULTS, validateSettings)

/** The settings as they stand, for the many callers that only need the values. */
export function readSettings(): AppSettings {
  return store.read().value
}

/**
 * The same read, with what happened to it — for the surface that has to say
 * "these are the defaults because your file could not be parsed, and your bytes
 * are in `settings.json.quarantined-…`". Silence there is the failure S14
 * exists to remove.
 */
export function readSettingsState(): LocalRead<AppSettings> {
  return store.read()
}

/**
 * Patch and save, reporting what happened.
 *
 * THE OLD SHAPE DESTROYED DATA. `writeSettings` did
 * `{ ...readSettings(), ...next }` and wrote it, while `readSettings` returned
 * DEFAULTS whenever the file would not parse. So one malformed byte turned the
 * next save — a theme click — into a write that replaced the operator's
 * workspace path, their open tabs and their locale with defaults, and returned
 * the merged object as if it had all been fine.
 *
 * Now the read is typed, the malformed file is quarantined rather than merged
 * onto, and the return value says whether the disk agreed.
 */
export function writeSettings(next: Partial<AppSettings>): SettingsWrite {
  const current = store.read()
  const merged: AppSettings = {
    ...current.value,
    ...next,
    // Nested objects are replaced whole when given and preserved when not — a
    // shallow spread of a partial `workspace` would drop the half not sent.
    workspace: next.workspace ? { ...current.value.workspace, ...next.workspace } : current.value.workspace,
    tabs: next.tabs ? { ...current.value.tabs, ...next.tabs } : current.value.tabs
  }
  const written = store.write(merged, current.revision)
  if (written.status === 'committed') return { settings: written.value, saved: true }
  if (written.status === 'conflict')
    return {
      settings: written.currentValue,
      saved: false,
      reason: 'another window saved settings first'
    }
  return { settings: current.value, saved: false, reason: written.reason }
}
