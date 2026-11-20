// #region avatar-svg — docs: docs/evidence/plans/2026-11-20-ceo-board-ux/plan.md#wave-i-the-app-icon-is-the-ceos-avatar
// The CEO's face as SVG markup, from a seed and one of three characters (SCR-36). One source for every place the face
// is drawn: the avatar in the window (`FabricAvatar.tsx`, colours as `var(--avatar-<style>-N)`) and the app icon in the
// Dock (`dockIcon.ts`, the same tokens read as colours), so changing the face changes the icon (the operator,
// 2026-11-20: «иконка аватарки нашего приложения … меняем SEO-иконку … менять аватарку»; mockup 08, option A).
// Only numbers reach the markup: nothing a person typed, so it is safe to set as HTML.

export type AvatarStyle = 'orbit' | 'spark' | 'wave'
export const AVATAR_STYLES: readonly AvatarStyle[] = ['orbit', 'spark', 'wave']
export const DEFAULT_AVATAR_SEED = 731

/** A seed the face can draw: a positive safe integer, else the default. */
export const avatarSeed = (seed: unknown): number => (Number.isSafeInteger(seed) && (seed as number) > 0 ? (seed as number) : DEFAULT_AVATAR_SEED)
/** A character the face can draw, else orbit. */
export const avatarStyle = (style: unknown): AvatarStyle => (AVATAR_STYLES.includes(style as AvatarStyle) ? (style as AvatarStyle) : 'orbit')
/** The four colours of a character as CSS custom properties (tokens.app.css `--avatar-<style>-0…3`). */
export const avatarTokens = (style: AvatarStyle): string[] => [0, 1, 2, 3].map((i) => `--avatar-${style}-${i}`)

/** The face's `<svg>`, 120×120 in its own units; `colors` are four CSS colours (or `var(...)` references). */
export function avatarSvg(seedIn: number, colors: readonly string[], attrs = 'aria-hidden="true"'): string {
  const s = avatarSeed(seedIn)
  const c = colors.map((x) => String(x).replace(/["<>]/g, ''))
  const eye = s % 3, tilt = (s % 9) - 4
  const eyes = eye === 0
    ? `<path d="M40 69q5-8 10 0m20 0q5-8 10 0" fill="none" style="stroke:${c[2]}" stroke-width="4" stroke-linecap="round"/>`
    : `<rect x="41" y="62" width="6" height="${eye === 1 ? 11 : 7}" rx="3" style="fill:${c[2]}"/><rect x="73" y="62" width="6" height="11" rx="3" style="fill:${c[2]}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" ${attrs}>`
    + `<rect x="2" y="2" width="116" height="116" rx="36" style="fill:${c[0]}"/>`
    + `<circle cx="${27 + (s % 12)}" cy="30" r="22" style="fill:${c[2]}"/>`
    + `<circle cx="96" cy="99" r="36" style="fill:${c[1]}" opacity=".2"/>`
    + `<g transform="rotate(${tilt} 60 60)">`
    + `<path d="M27 43Q31 24 60 27Q89 24 93 43L98 79Q95 100 60 103Q25 100 22 79Z" style="fill:${c[1]}"/>`
    + `<path d="M34 43Q60 ${33 + (s % 8)} 86 43M31 50Q60 39 89 50" fill="none" style="stroke:${c[2]}" stroke-width="3" stroke-linecap="round"/>`
    + `<rect x="30" y="55" width="60" height="29" rx="14" style="fill:${c[3]}"/>`
    + eyes
    + `<path d="M50 91q10 6 20 0" fill="none" style="stroke:${c[0]}" stroke-width="3" stroke-linecap="round"/>`
    + `<path d="M59 28v-8" style="stroke:${c[3]}" stroke-width="3"/>`
    + `<circle cx="59" cy="17" r="5" style="fill:${c[2]}"/>`
    + `</g>`
    + `<circle cx="${15 + (s % 9)}" cy="91" r="4" style="fill:${c[2]}"/>`
    + `</svg>`
}

/** The largest PNG data URL the main process takes for the Dock (a 1024 icon is ~150 KB; 4 MB is a defect). */
export const DOCK_ICON_MAX_BYTES = 4 * 1024 * 1024
/** Whether a value is a PNG data URL within the bound, the only shape the Dock icon is taken in. */
export const isDockIconPng = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= DOCK_ICON_MAX_BYTES && /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(v)
// #endregion avatar-svg
