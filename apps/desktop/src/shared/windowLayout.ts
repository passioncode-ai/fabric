// #region ceo-window-layout — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-session-control-tools
/**
 * Where a window goes when the owner says so (board requests 07db5c30 and 26989d91, the owner, 2026-11-19: «открой одно
 * окно, второе», halves, the whole screen). Pure: a display's work area and a named area give a rectangle; a number of
 * windows gives the areas they share without covering one another. No Electron here, so the tests read it as it runs.
 */

export interface Rect { x: number; y: number; width: number; height: number }

/** The areas a window can take on one display; `fullscreen` is macOS's own full screen, `full` the whole work area. */
export const WINDOW_AREAS = [
  'full', 'fullscreen', 'center',
  'left', 'right', 'top', 'bottom',
  'left-third', 'center-third', 'right-third', 'left-two-thirds', 'right-two-thirds',
  'top-left', 'top-right', 'bottom-left', 'bottom-right'
] as const
export type WindowArea = (typeof WINDOW_AREAS)[number]

/** A display as Electron's `screen` gives it, narrowed. */
export interface DisplayLike { id: number; bounds: Rect; workArea: Rect; primary: boolean }

/** The rectangle `area` takes in `work` (a display's work area: the menu bar and the Dock left out). */
export function areaRect(work: Rect, area: WindowArea): Rect {
  const { x, y, width: w, height: h } = work
  const half = (n: number) => Math.floor(n / 2)
  const third = Math.floor(w / 3)
  const r = (rx: number, ry: number, rw: number, rh: number): Rect => ({ x: rx, y: ry, width: rw, height: rh })
  switch (area) {
    case 'full': case 'fullscreen': return r(x, y, w, h)
    case 'center': {
      const cw = Math.floor(w * 0.7), ch = Math.floor(h * 0.8)
      return r(x + half(w - cw), y + half(h - ch), cw, ch)
    }
    case 'left': return r(x, y, half(w), h)
    case 'right': return r(x + half(w), y, w - half(w), h)
    case 'top': return r(x, y, w, half(h))
    case 'bottom': return r(x, y + half(h), w, h - half(h))
    case 'left-third': return r(x, y, third, h)
    case 'center-third': return r(x + third, y, third, h)
    case 'right-third': return r(x + 2 * third, y, w - 2 * third, h)
    case 'left-two-thirds': return r(x, y, 2 * third, h)
    case 'right-two-thirds': return r(x + third, y, w - third, h)
    case 'top-left': return r(x, y, half(w), half(h))
    case 'top-right': return r(x + half(w), y, w - half(w), half(h))
    case 'bottom-left': return r(x, y + half(h), half(w), h - half(h))
    case 'bottom-right': return r(x + half(w), y + half(h), w - half(w), h - half(h))
  }
}

/** The areas `n` windows share on one screen when the owner names none: side by side up to three, a grid at four. */
export function autoAreas(n: number): WindowArea[] {
  if (n <= 0) return []
  if (n === 1) return ['full']
  if (n === 2) return ['left', 'right']
  if (n === 3) return ['left-third', 'center-third', 'right-third']
  const grid: WindowArea[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  // Past four the grid repeats: the owner asked for more windows than a screen holds apart.
  return Array.from({ length: n }, (_, i) => grid[i % 4])
}

/** The displays in the order the owner counts them: left to right, then top to bottom; the first is «1». */
export function orderedDisplays<D extends DisplayLike>(displays: readonly D[]): D[] {
  return [...displays].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y)
}

/** The display a request names: `primary`, `other` (the first that is not `current`), a number counted left to right
 *  from 1, or none (`current`, else the primary). Null when the request names a display this computer does not have. */
export function pickDisplay<D extends DisplayLike>(displays: readonly D[], which: string | number | undefined, current: D | null): D | null {
  const ordered = orderedDisplays(displays)
  if (ordered.length === 0) return null
  const primary = ordered.find((d) => d.primary) ?? ordered[0]
  if (which === undefined || which === 'current') return current ?? primary
  if (which === 'primary') return primary
  if (which === 'other') return ordered.find((d) => d.id !== (current ?? primary).id) ?? null
  const n = typeof which === 'number' ? which : /^\d+$/.test(which) ? Number(which) : NaN
  return Number.isInteger(n) && n >= 1 && n <= ordered.length ? ordered[n - 1] : null
}

/** The display holding most of `r`, else the nearest by centre: where a window is now. */
export function displayOf<D extends DisplayLike>(displays: readonly D[], r: Rect): D | null {
  let best: D | null = null
  let bestArea = 0
  for (const d of displays) {
    const ix = Math.max(0, Math.min(r.x + r.width, d.bounds.x + d.bounds.width) - Math.max(r.x, d.bounds.x))
    const iy = Math.max(0, Math.min(r.y + r.height, d.bounds.y + d.bounds.height) - Math.max(r.y, d.bounds.y))
    if (ix * iy > bestArea) { bestArea = ix * iy; best = d }
  }
  if (best) return best
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2
  let near = Infinity
  for (const d of displays) {
    const dx = d.bounds.x + d.bounds.width / 2 - cx, dy = d.bounds.y + d.bounds.height / 2 - cy
    if (dx * dx + dy * dy < near) { near = dx * dx + dy * dy; best = d }
  }
  return best
}

/** The named area closest to `r` on a display with this work area: how a window that stands somewhere is kept. */
export function nearestArea(work: Rect, r: Rect): WindowArea {
  let best: WindowArea = 'full'
  let bestDiff = Infinity
  for (const area of WINDOW_AREAS) {
    if (area === 'fullscreen') continue
    const a = areaRect(work, area)
    const diff = Math.abs(a.x - r.x) + Math.abs(a.y - r.y) + Math.abs(a.width - r.width) + Math.abs(a.height - r.height)
    if (diff < bestDiff) { bestDiff = diff; best = area }
  }
  return best
}

/** One window of a saved layout: by its kind, and for a console by its session and project, so a layout outlives the
 *  console it was saved with (the project's running console takes its place). */
export interface SavedPlacement { window: 'main' | 'ceo' | 'dashboards' | 'session'; session_id?: string; project_id?: string | null; area: WindowArea; display?: number | 'primary' | 'other' }
export interface SavedLayouts { [name: string]: { saved_at: string; placements: SavedPlacement[] } }

const NAME = /^[\p{L}\p{N} _-]{1,40}$/u
/** A layout's name as the owner says it, trimmed and in lower case so «Рабочая» and «рабочая» are one layout. */
export function layoutName(name: string): string | null {
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ')
  return NAME.test(n) ? n : null
}

/** Saved layouts read back: anything that is not a layout is dropped, never trusted. */
export function parseLayouts(text: string): SavedLayouts {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return {} /* an unreadable file holds no layout; the next save writes it whole */ }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: SavedLayouts = {}
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!layoutName(name) || !v || typeof v !== 'object') continue
    const placements = (v as { placements?: unknown }).placements
    if (!Array.isArray(placements)) continue
    const ok = placements.filter((p): p is SavedPlacement => !!p && typeof p === 'object'
      && ['main', 'ceo', 'dashboards', 'session'].includes((p as SavedPlacement).window)
      && (WINDOW_AREAS as readonly string[]).includes((p as SavedPlacement).area))
    if (ok.length) out[name] = { saved_at: String((v as { saved_at?: unknown }).saved_at ?? ''), placements: ok.slice(0, 12) }
  }
  return out
}
// #endregion ceo-window-layout
