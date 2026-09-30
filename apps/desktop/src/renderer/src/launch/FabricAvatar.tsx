// Fabric's persona face (SCR-36 · the launch prototype's fabricAvatar, 2026-09-25). A generated
// SVG from a seed and one of three palettes; no image is fetched and nothing is stored here —
// the chosen seed and style are the persona's, read by whoever renders it.

import { usePersona } from './persona'

export type AvatarStyle = 'orbit' | 'spark' | 'wave'
const STYLES: readonly AvatarStyle[] = ['orbit', 'spark', 'wave']
/** The palette lives in tokens.app.css (`--avatar-<style>-0…3`); an SVG attribute cannot read a
 *  custom property, so each colour is applied as a style. */
const palette = (style: AvatarStyle): string[] => [0, 1, 2, 3].map((i) => `var(--avatar-${style}-${i})`)

export function FabricAvatar({ seed: seedProp, style: styleProp, size = 'small', label }: {
  seed?: number
  style?: AvatarStyle
  size?: 'tiny' | 'small' | 'large'
  label: string
}): React.JSX.Element {
  // The operator's look unless a caller draws a specific one (a variant being chosen).
  const { persona } = usePersona()
  const seed = seedProp ?? persona.seed, style = styleProp ?? persona.style
  const s = Number.isSafeInteger(seed) && seed > 0 ? seed : 731
  const c = palette(STYLES.includes(style) ? style : 'orbit')
  const eye = s % 3, tilt = (s % 9) - 4
  return (
    <span className={`fp-face fp-face-${size}`} role="img" aria-label={label} data-avatar-seed={s} data-avatar-style={style}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <rect x="2" y="2" width="116" height="116" rx="36" style={{ fill: c[0] }} />
        <circle cx={27 + (s % 12)} cy="30" r="22" style={{ fill: c[2] }} />
        <circle cx="96" cy="99" r="36" style={{ fill: c[1] }} opacity=".2" />
        <g transform={`rotate(${tilt} 60 60)`}>
          <path d="M27 43Q31 24 60 27Q89 24 93 43L98 79Q95 100 60 103Q25 100 22 79Z" style={{ fill: c[1] }} />
          <path d={`M34 43Q60 ${33 + (s % 8)} 86 43M31 50Q60 39 89 50`} fill="none" style={{ stroke: c[2] }} strokeWidth="3" strokeLinecap="round" />
          <rect x="30" y="55" width="60" height="29" rx="14" style={{ fill: c[3] }} />
          {eye === 0
            ? <path d="M40 69q5-8 10 0m20 0q5-8 10 0" fill="none" style={{ stroke: c[2] }} strokeWidth="4" strokeLinecap="round" />
            : <><rect x="41" y="62" width="6" height={eye === 1 ? 11 : 7} rx="3" style={{ fill: c[2] }} /><rect x="73" y="62" width="6" height="11" rx="3" style={{ fill: c[2] }} /></>}
          <path d="M50 91q10 6 20 0" fill="none" style={{ stroke: c[0] }} strokeWidth="3" strokeLinecap="round" />
          <path d="M59 28v-8" style={{ stroke: c[3] }} strokeWidth="3" />
          <circle cx="59" cy="17" r="5" style={{ fill: c[2] }} />
        </g>
        <circle cx={15 + (s % 9)} cy="91" r="4" style={{ fill: c[2] }} />
      </svg>
    </span>
  )
}
