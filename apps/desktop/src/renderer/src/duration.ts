import type { Translate } from './i18n'
/**
 * How long ago, in the shortest form that is still true.
 *
 * Extracted from `Tasks` when the board took over showing task ages (M146): a
 * formatter copied into a second screen is how two surfaces start disagreeing
 * about what "2m" means.
 */
export function since(iso: string, t?: Translate): string {
  const at = new Date(iso).getTime()
  // A time that does not parse is unknown, never "NaN days" (0.3.6 review i3 ER-6).
  if (!Number.isFinite(at)) return '—'
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  const [n, unit] = unitOf(s)
  // The unit is a word of the operator's language ("3 ч", not "3h" in a Russian sentence);
  // without a translator it keeps the compact English form the tests were written against.
  return t ? t(`duration.${unit}` as 'duration.s', { n }) : `${n}${unit}`
}

/** How long until, in the same units as `since`. */
export function until(iso: string, t?: Translate): string {
  const s = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000))
  const [n, unit] = unitOf(s)
  return t ? t(`duration.${unit}` as 'duration.s', { n }) : `${n}${unit}`
}

/** Seconds as the shortest true unit. From two days on, days: "59h" is arithmetic, not an age. */
function unitOf(s: number): [number, 's' | 'm' | 'h' | 'd'] {
  return s < 60 ? [s, 's'] : s < 3600 ? [Math.round(s / 60), 'm'] : s < 172_800 ? [Math.round(s / 3600), 'h'] : [Math.round(s / 86_400), 'd']
}

/**
 * How long something has been held, to the minute under two days («1 ч 44 мин», «38 мин»), as the approved mockup says a
 * claim's age (the mockup parity, home gap D9); from two days on, whole days, as `since` says them. Unknown: «—».
 */
export function heldFor(iso: string, t?: Translate, now = Date.now()): string | null {
  const at = new Date(iso).getTime()
  // An unreadable time says nothing, never a dash in its place (the 0.3.15 review, iteration 1, UX-10).
  if (!Number.isFinite(at)) return null
  const s = Math.max(0, Math.round((now - at) / 1000))
  const say = (n: number, unit: 's' | 'm' | 'h' | 'd'): string => (t ? t(`duration.${unit}` as 'duration.s', { n }) : `${n}${unit}`)
  if (s < 60) return say(s, 's')
  if (s >= 172_800) return say(Math.round(s / 86_400), 'd')
  const minutes = Math.floor(s / 60)
  const h = Math.floor(minutes / 60), m = minutes % 60
  return h === 0 ? say(m, 'm') : m === 0 ? say(h, 'h') : `${say(h, 'h')} ${say(m, 'm')}`
}
