// i18n: one registry per locale, typed keys, interpolation by {name}.
// A missing key renders the key itself rather than an empty string — a visible
// defect beats a blank label, and the gate catches it before that ships.

import { createContext, useContext, useMemo } from 'react'
import { en, type StringKey } from './en'
import { translator, type Locale, type Translate } from './translate.ts'
import { REVIEW_DEFAULT_ACTOR } from '../../../shared/board.ts'

export type { Locale, Translate, PluralForm } from './translate.ts'
export { pluralForm } from './translate.ts'

/** Locale registries live in `translate.ts` (bilingual from 2026-09-06, M197): a NEW key lands in both
 *  in the same change — the ratchet gate in check-design.mjs enforces it — and the legacy debt lives in
 *  `ru-baseline.txt`, which may only shrink. A missing ru key falls back to en, visibly counted rather
 *  than silently absorbed. */
const build = (locale: Locale): Translate => translator(locale)

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

/**
 * The sentence for one journal row, where who acted changes what happened: a task the system closed because its review
 * waited more than three days (CO-537) was accepted by default, not closed by the person, and the history says so
 * (the 0.3.18 review, iteration 1, UX-2). Every other row is `describeEvent`'s.
 */
export function describeFeedEvent(t: Translate, e: { type: string; actor: { kind: string; id: string } }): string {
  if (e.type === 'task.closed@1' && e.actor.kind === 'system' && e.actor.id === REVIEW_DEFAULT_ACTOR) return t('journal.reviewAcceptedByDefault')
  return describeEvent(t, e.type)
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale
}

export const LOCALES: Locale[] = ['en', 'ru']
