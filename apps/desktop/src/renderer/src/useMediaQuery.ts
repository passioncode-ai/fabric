// #region use-media-query — docs: docs/evidence/plans/2026-10-27-release-1105-plan.md#landed-on-main
import { useEffect, useState } from 'react'

/** Whether a media query matches now, kept current as the window changes. CO-476: a narrow layout puts its columns in
 *  their narrow order in the DOM, so the keyboard and a screen reader walk what the eye sees (WCAG 1.3.2); a CSS
 *  `order` reorders only the picture. Without `matchMedia` (a test without a window) the wide layout is assumed. */
export function useMediaQuery(query: string): boolean {
  const read = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const [matches, setMatches] = useState(read)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const on = (): void => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}
// #endregion use-media-query
