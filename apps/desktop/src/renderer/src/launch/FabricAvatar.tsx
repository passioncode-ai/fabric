// Fabric's persona face (SCR-36 · the launch prototype's fabricAvatar, 2026-09-25). A generated
// SVG from a seed and one of three palettes; no image is fetched and nothing is stored here —
// the chosen seed and style are the persona's, read by whoever renders it. The markup is
// `shared/avatarSvg.ts`'s, the same the Dock icon is drawn from (wave I, 2026-11-20).

import { avatarSeed, avatarStyle, avatarSvg, avatarTokens, type AvatarStyle } from '../../../shared/avatarSvg.ts'
import { usePersona } from './persona'

export type { AvatarStyle }

export function FabricAvatar({ seed: seedProp, style: styleProp, size = 'small', label }: {
  seed?: number
  style?: AvatarStyle
  size?: 'tiny' | 'small' | 'large'
  label: string
}): React.JSX.Element {
  // The operator's look unless a caller draws a specific one (a variant being chosen).
  const { persona } = usePersona()
  const s = avatarSeed(seedProp ?? persona.seed), style = styleProp ?? persona.style
  // The palette lives in tokens.app.css; an SVG attribute cannot read a custom property, so each colour is a style.
  const colors = avatarTokens(avatarStyle(style)).map((t) => `var(${t})`)
  return (
    <span className={`fp-face fp-face-${size}`} role="img" aria-label={label} data-avatar-seed={s} data-avatar-style={style}
      dangerouslySetInnerHTML={{ __html: avatarSvg(s, colors) }} />
  )
}
