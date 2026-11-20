// #region dock-icon — docs: docs/evidence/plans/2026-11-20-ceo-board-ux/plan.md#wave-i-the-app-icon-is-the-ceos-avatar
// The app icon is the CEO's face (wave I, mockup 08 option A: one setting, no separate switch). The main window draws
// the face the person chose into a 1024 PNG on Apple's icon grid (the 824 tile at 100, a soft shadow below) and hands
// it to the main process, which sets the Dock icon and keeps the PNG for the next start (`main/appIcon.ts`).
// Finder and Launchpad keep the bundle's own icon: changing the bundle would break its signature.

import { useEffect } from 'react'
import { avatarStyle, avatarSvg, avatarTokens } from '../../../shared/avatarSvg.ts'
import type { Persona } from '../../../shared/persona.ts'
import { usePersona } from './persona'

export const ICON_SIZE = 1024, TILE = 824, TILE_AT = 100

/**
 * The face as standalone SVG with its token colours resolved, so it draws outside the page's stylesheet; null when a
 * token does not resolve (a window without the stylesheet): the Dock then keeps the icon it has, never a guessed colour.
 */
export function resolvedAvatarSvg(persona: Pick<Persona, 'seed' | 'style'>, read: (token: string) => string): string | null {
  const colors = avatarTokens(avatarStyle(persona.style)).map((t) => read(t).trim())
  if (colors.some((c) => !c)) return null
  // The face's tile is 116 of its 120 units, from 2; scaled so that tile fills Apple's 824 grid square.
  const scale = TILE / 116, size = 120 * scale, at = TILE_AT - 2 * scale
  return avatarSvg(persona.seed, colors, `width="${size}" height="${size}" x="${at}" y="${at}"`)
}

/** Where the face's 116-unit tile lands on the 1024 canvas, and its corner, in canvas pixels. */
export function iconGeometry(): { at: number; size: number; tileAt: number; radius: number } {
  const scale = TILE / 116
  return { at: TILE_AT - 2 * scale, size: 120 * scale, tileAt: TILE_AT, radius: 36 * scale }
}

/** The PNG: a soft shadow under the tile, then the face clipped to the tile, so nothing of the face overhangs it. */
export async function drawIconPng(svg: string, shadow: string, under: string): Promise<string | null> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  const g = iconGeometry()
  const tile = (): void => { ctx.beginPath(); ctx.roundRect(g.tileAt, g.tileAt, TILE, TILE, g.radius) }
  ctx.save()
  ctx.shadowColor = shadow
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 12
  tile()
  ctx.fillStyle = under
  ctx.fill()
  ctx.restore()
  tile()
  ctx.clip()
  ctx.drawImage(image, g.at, g.at, g.size, g.size)
  return canvas.toDataURL('image/png')
}

/** Keep the Dock icon on the face shown: on start and whenever the person picks another face. Main window only. */
export function useDockIcon(persona: Pick<Persona, 'seed' | 'style'>): void {
  useEffect(() => {
    const set = window.fabric?.persona?.dockIcon
    if (typeof set !== 'function' || typeof document === 'undefined') return
    let alive = true
    const css = getComputedStyle(document.documentElement)
    const read = (t: string): string => css.getPropertyValue(t).trim()
    const svg = resolvedAvatarSvg(persona, read)
    const shadow = read('--avatar-icon-shadow')
    if (!svg || !shadow) return
    // Under the face: its own tile colour, so the shadow is cast by the tile and nothing pale shows at the clip's edge.
    drawIconPng(svg, shadow, read(avatarTokens(avatarStyle(persona.style))[0]))
      .then((png) => (alive && png ? set(png) : undefined))
      // A face that cannot be drawn leaves the bundle's icon; the main process logs what it was given.
      .catch(() => undefined)
    return () => { alive = false }
  }, [persona.seed, persona.style])
}
/** Mounted once inside the main window's persona provider: draws nothing, keeps the Dock on the face. */
export function DockIconFollowsFace(): null {
  useDockIcon(usePersona().persona)
  return null
}
// #endregion dock-icon
