// The translator, without React: the registries and the interpolation rule, so the main process can say
// the native consent prompt in the operator's language with the very keys the renderer uses (UX-2,
// verification iteration 1 for 0.3.1), and so the crash boundary can speak when the settings — or this
// registry's own context — are what failed. `index.tsx` builds its context from this; nothing else may.

import { en, type StringKey } from './en.ts'
import { ru } from './ru.ts'

export type Locale = 'en' | 'ru'

export type Translate = (key: StringKey, vars?: Record<string, string | number>) => string

/** Locale registries. A missing ru key falls back to en, visibly counted by the ratchet gate. */
const registries: Record<Locale, Partial<Record<StringKey, string>>> = { en, ru }

export function translator(locale: Locale): Translate {
  return (key, vars) => {
    const raw = registries[locale][key] ?? registries.en[key] ?? key
    if (!vars) return raw
    return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
  }
}
