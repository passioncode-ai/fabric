// i18n: one registry per locale, typed keys, interpolation by {name}.
// A missing key renders the key itself rather than an empty string — a visible
// defect beats a blank label, and the gate catches it before that ships.

import { createContext, useContext, useMemo } from 'react'
import { en, type StringKey } from './en'
import { ru } from './ru'

export type Locale = 'en' | 'ru'

/** Locale registries. Bilingual from 2026-09-06 (M197): a NEW key lands in both
 *  in the same change — the ratchet gate in check-design.mjs enforces it — and
 *  the legacy debt lives in `ru-baseline.txt`, which may only shrink. A missing
 *  ru key falls back to en, visibly counted rather than silently absorbed. */
const registries: Record<Locale, Partial<Record<StringKey, string>>> = {
  en,
  ru
}

export type Translate = (key: StringKey, vars?: Record<string, string | number>) => string

function build(locale: Locale): Translate {
  return (key, vars) => {
    const raw = registries[locale][key] ?? registries.en[key] ?? key
    if (!vars) return raw
    return raw.replace(/\{(\w+)\}/g, (m, name: string) =>
      name in vars ? String(vars[name]) : m
    )
  }
}

const I18nContext = createContext<{ locale: Locale; t: Translate }>({
  locale: 'en',
  t: build('en')
})

export function I18nProvider({
  locale,
  children
}: {
  locale: Locale
  children: React.ReactNode
}): React.JSX.Element {
  const value = useMemo(() => ({ locale, t: build(locale) }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): Translate {
  return useContext(I18nContext).t
}

/**
 * The sentence for a journal event, or the raw type when there is none.
 *
 * The fallback is the RAW TYPE rather than the key. `t()` renders a missing key
 * as the key itself, which would put `event.task.moved@1` on screen — the
 * machine identifier a reader could not use, plus a prefix that means nothing.
 *
 * `check-design.mjs` holds every registered event type to having a sentence, so
 * for anything the journal can actually contain this branch is unreachable. It
 * exists for the window between a migration landing and its string being
 * written, and for a journal restored from an estate built on a newer schema.
 */
export function describeEvent(t: Translate, type: string): string {
  const key = `event.${type}`
  return key in en ? t(key as StringKey) : type
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale
}

export const LOCALES: Locale[] = ['en', 'ru']
