import type { Translate } from './i18n'
/**
 * How long ago, in the shortest form that is still true.
 *
 * Extracted from `Tasks` when the board took over showing task ages (M146): a
 * formatter copied into a second screen is how two surfaces start disagreeing
 * about what "2m" means.
 */
export function since(iso: string, t?: Translate): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
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
