// #region ceo-window-layout — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#amendment-3-2026-11-19-the-ceo-closes-and-arranges-windows-and-opens-dashboards
/**
 * Where a window goes when the owner says so (board requests 07db5c30 and 26989d91, the owner, 2026-11-19: «открой одно
 * окно, второе», halves, the whole screen). Pure: a display's work area and a named area give a rectangle; a number of
 * windows gives the areas they share: up to four apart, more overlap and the caller says so. No Electron here, so the tests read it as it runs.
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

/** The areas windows share; `full`, `fullscreen` and `center` take a screen alone. */
const SHARED_AREAS: WindowArea[] = ['left', 'right', 'top', 'bottom', 'left-third', 'center-third', 'right-third', 'left-two-thirds', 'right-two-thirds', 'top-left', 'top-right', 'bottom-left', 'bottom-right']
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
/** The order a tie keeps: halves before thirds before quarters, left before right (the order the owner reads). */
const PREFER = (a: WindowArea) => SHARED_AREAS.indexOf(a)

/**
 * Areas for `k` windows beside the ones that keep `fixed`, on one screen: none of them covers another or a fixed one,
 * and together they take as much of the screen as can be (PL-1: «открой одно окно, второе» puts the second beside the
 * first). `overlaps` is true when no such areas exist (more windows than a screen holds apart): the windows then take
 * `autoAreas` and the caller says so.
 */
export function fitAreas(work: Rect, fixed: readonly WindowArea[], k: number): { areas: WindowArea[]; overlaps: boolean } {
  if (k <= 0) return { areas: [], overlaps: false }
  const taken = fixed.map((a) => areaRect(work, a))
  if (fixed.length === 0 && k <= 4) return { areas: autoAreas(k), overlaps: false }
  const free = SHARED_AREAS.filter((a) => !taken.some((t) => overlap(t, areaRect(work, a))))
  let best: WindowArea[] | null = null
  let bestArea = -1
  let bestOrder = Infinity
  const pick = (start: number, chosen: WindowArea[]): void => {
    if (chosen.length === k) {
      const rects = chosen.map((a) => areaRect(work, a))
      const total = rects.reduce((s, r) => s + r.width * r.height, 0)
      const order = chosen.reduce((s, a) => s * 16 + PREFER(a), 0)
      if (total > bestArea || (total === bestArea && order < bestOrder)) { best = [...chosen]; bestArea = total; bestOrder = order }
      return
    }
    for (let i = start; i < free.length; i++) {
      const r = areaRect(work, free[i])
      if (chosen.some((c) => overlap(areaRect(work, c), r))) continue
      chosen.push(free[i]); pick(i + 1, chosen); chosen.pop()
    }
  }
  pick(0, [])
  if (best) {
    // Left to right, then top to bottom: the first window named takes the leftmost place.
    const sorted = (best as WindowArea[]).sort((a, b) => { const ra = areaRect(work, a), rb = areaRect(work, b); return ra.x - rb.x || ra.y - rb.y })
    return { areas: sorted, overlaps: false }
  }
  return { areas: autoAreas(k + fixed.length).slice(fixed.length, fixed.length + k).concat(autoAreas(k)).slice(0, k), overlaps: true }
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
export interface SavedPlacement { window: 'main' | 'ceo' | 'dashboards' | 'session'; session_id?: string; project_id?: string | null; area: WindowArea; display?: number | 'primary' | 'other'; dashboard?: string }
export interface SavedLayouts { [name: string]: { saved_at: string; placements: SavedPlacement[] } }

const NAME = /^[\p{L}\p{N} _-]{1,40}$/u
/** Names an object already answers for: never a layout's (0.3.26 review, DA-2). */
const RESERVED = new Set(['__proto__', 'constructor', 'prototype', 'hasownproperty', 'tostring', 'valueof'])
/** At most this many layouts are kept; the oldest go first. */
export const MAX_LAYOUTS = 50
/** A layouts file larger than this is not read (the owner's few layouts are a few kilobytes). */
export const MAX_LAYOUTS_BYTES = 256 * 1024
/** A layout's name as the owner says it, trimmed and in lower case so «Рабочая» and «рабочая» are one layout. */
export function layoutName(name: string): string | null {
  const n = name.trim().toLowerCase().replace(/\s+/g, ' ')
  return NAME.test(n) && !RESERVED.has(n) ? n : null
}

const ID = /^[A-Za-z0-9-]{1,128}$/
/** One placement rebuilt from its checked fields only; null when its window or area is not one of ours. */
function placementOf(p: unknown): SavedPlacement | null {
  if (!p || typeof p !== 'object') return null
  const x = p as Record<string, unknown>
  if (typeof x.window !== 'string' || !['main', 'ceo', 'dashboards', 'session'].includes(x.window)) return null
  if (typeof x.area !== 'string' || !(WINDOW_AREAS as readonly string[]).includes(x.area)) return null
  const out: SavedPlacement = { window: x.window as SavedPlacement['window'], area: x.area as WindowArea }
  if (typeof x.display === 'number' && Number.isInteger(x.display) && x.display >= 1 && x.display <= 8) out.display = x.display
  else if (x.display === 'primary' || x.display === 'other') out.display = x.display
  if (out.window === 'dashboards' && typeof x.dashboard === 'string' && /^[a-z0-9][a-z0-9._-]{0,159}$/.test(x.dashboard)) out.dashboard = x.dashboard
  if (out.window === 'session') {
    out.session_id = typeof x.session_id === 'string' && ID.test(x.session_id) ? x.session_id : undefined
    out.project_id = typeof x.project_id === 'string' && ID.test(x.project_id) ? x.project_id : null
    if (!out.session_id && !out.project_id) return null
  }
  return out
}

/** Keep the newest `MAX_LAYOUTS`, by when each was saved. */
export function boundLayouts(all: SavedLayouts): SavedLayouts {
  const names = Object.keys(all)
  if (names.length <= MAX_LAYOUTS) return all
  const keep = names.sort((a, b) => all[b].saved_at.localeCompare(all[a].saved_at)).slice(0, MAX_LAYOUTS)
  const out: SavedLayouts = Object.create(null)
  for (const n of keep) out[n] = all[n]
  return out
}

/** Saved layouts read back: anything that is not a layout is dropped, never trusted, and each placement is rebuilt
 *  from its checked fields (0.3.26 review, DA-2, DA-4). The result has no prototype, so no name reaches Object's. */
export function parseLayouts(text: string): SavedLayouts {
  return readLayouts(text).layouts
}

/** The same, saying whether the text was damaged (not JSON, not an object, too large), so the reader moves it aside
 *  and says so instead of the next save writing over it (ER-17, DA-9). */
export function readLayouts(text: string): { layouts: SavedLayouts; damaged: boolean } {
  const out: SavedLayouts = Object.create(null)
  if (Buffer.byteLength(text, 'utf8') > MAX_LAYOUTS_BYTES) return { layouts: out, damaged: true }
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { layouts: out, damaged: true } }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { layouts: out, damaged: true }
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    if (layoutName(name) !== name || !v || typeof v !== 'object') continue
    const placements = (v as { placements?: unknown }).placements
    if (!Array.isArray(placements)) continue
    const ok = placements.slice(0, 12).map(placementOf).filter((p): p is SavedPlacement => p !== null)
    const at = (v as { saved_at?: unknown }).saved_at
    if (ok.length) out[name] = { saved_at: typeof at === 'string' && !Number.isNaN(Date.parse(at)) ? at : '', placements: ok }
  }
  // A file with entries none of which reads as a layout (another version's shape) is damaged too (DA-14, DO-19).
  const entries = Object.keys(raw as Record<string, unknown>).length
  return { layouts: boundLayouts(out), damaged: entries > 0 && Object.keys(out).length === 0 }
}
// #endregion ceo-window-layout
