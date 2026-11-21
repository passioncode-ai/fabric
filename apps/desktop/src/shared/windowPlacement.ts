// #region window-placement — docs: docs/ux/scenarios.md#scn-110-talk-to-the-floating-ceo-over-any-screen
/**
 * Where a window Fabric remembers opens again (the CEO's window first; the owner, 2026-11-20: «чтобы вот это окошко … можно
 * было по экрану возить, менять размеры»): where the person left it, on whichever display it was, at the size they gave
 * it; never off every screen. Decided here without Electron, so a display unplugged, a smaller screen or a broken file is
 * tested with plain numbers.
 */

export interface Rect { x: number; y: number; width: number; height: number }

/** What is kept between openings: the window's own bounds, nothing else. */
export interface SavedPlacement { x: number; y: number; width: number; height: number }

/** A display as the window sees it: the part of it windows may use (no menu bar, no Dock). */
export interface DisplayArea { workArea: Rect }

/** How much of a remembered window must still be on a display for it to open there: enough of its top to grab it. */
export const GRAB_W = 120
export const GRAB_H = 32

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/** A saved placement read back from disk, or null when it is not one (a hand-edited or half-written file). */
export function readPlacement(raw: unknown): SavedPlacement | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!finite(r.x) || !finite(r.y) || !finite(r.width) || !finite(r.height)) return null
  if (r.width <= 0 || r.height <= 0) return null
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
}

function overlap(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y)
  const r = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height)
  return r > x && bottom > y ? { x, y, width: r - x, height: bottom - y } : null
}

/** The window's grab strip (its top, where the title bar is) on this display, or null. */
function grabbable(saved: Rect, area: Rect): boolean {
  const top: Rect = { x: saved.x, y: saved.y, width: saved.width, height: Math.min(saved.height, GRAB_H) }
  const seen = overlap(top, area)
  return seen !== null && seen.width >= Math.min(GRAB_W, saved.width) && seen.height >= Math.min(GRAB_H, saved.height) - 1
}

/** A rectangle moved and, when it must be, shrunk so it lies wholly inside the area, never under its minimum size. */
export function keepInside(r: Rect, area: Rect, min: { width: number; height: number }): Rect {
  const width = Math.max(Math.min(r.width, area.width), Math.min(min.width, area.width))
  const height = Math.max(Math.min(r.height, area.height), Math.min(min.height, area.height))
  const x = Math.min(Math.max(r.x, area.x), area.x + area.width - width)
  const y = Math.min(Math.max(r.y, area.y), area.y + area.height - height)
  return { x, y, width, height }
}

/**
 * Where the window opens. The remembered bounds when a display still shows its top: kept on that display, shrunk only
 * when that display is now smaller. Otherwise (none remembered, the display gone, the file broken) the default, kept
 * inside the display it falls on, or the first display.
 */
export function placeWindow(opts: {
  saved: SavedPlacement | null
  displays: readonly DisplayArea[]
  fallback: Rect
  min: { width: number; height: number }
}): Rect {
  const { saved, displays, fallback, min } = opts
  if (displays.length === 0) return saved ?? fallback
  if (saved) {
    // The display that shows most of its top, so a window across two screens stays on the one it was grabbed on.
    let best: { area: Rect; seen: number } | null = null
    for (const d of displays) {
      if (!grabbable(saved, d.workArea)) continue
      const seen = overlap(saved, d.workArea)
      const size = seen ? seen.width * seen.height : 0
      if (!best || size > best.seen) best = { area: d.workArea, seen: size }
    }
    if (best) return keepInside(saved, best.area, min)
  }
  const home = displays.find((d) => overlap(fallback, d.workArea) !== null) ?? displays[0]!
  return keepInside(fallback, home.workArea, min)
}
// #endregion window-placement
