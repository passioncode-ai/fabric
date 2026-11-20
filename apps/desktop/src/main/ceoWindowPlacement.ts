// #region ceo-window-placement — docs: docs/ux/scenarios.md#scn-110-talk-to-the-floating-ceo-over-any-screen
/**
 * The CEO's window opens where the person left it (the owner, 2026-11-20: «чтобы вот это окошко … можно было по экрану
 * возить, менять размеры»): its bounds are kept in `userData/ceo-window.json` after each move and resize and when it
 * closes, and read back through `shared/windowPlacement.ts#placeWindow`, which keeps it on a display that still exists.
 */
import { app, screen, type BrowserWindow } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ops } from './opsSink.ts'
import { placeWindow, readPlacement, type Rect } from '../shared/windowPlacement.ts'

/** A move or a resize is kept this long after it stops, so a drag writes the file once, not per pixel. */
export const KEEP_AFTER_MS = 400

const placementFile = (): string => path.join(app.getPath('userData'), 'ceo-window.json')

/** Where the CEO's window opens: the kept bounds on a display that shows them, else the default given. */
export function ceoWindowBounds(fallback: Rect, min: { width: number; height: number }): Rect {
  let saved = null
  try {
    saved = readPlacement(JSON.parse(readFileSync(placementFile(), 'utf8')))
  } catch {
    // Nothing kept yet, or a file that is not one: the window opens at its default, which is the right answer for both.
  }
  return placeWindow({ saved, displays: screen.getAllDisplays(), fallback, min })
}

/** Keep the window's bounds as the person moves and resizes it, and once more as it closes. */
export function rememberCeoWindow(w: BrowserWindow): void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const save = (): void => {
    if (w.isDestroyed() || w.isMinimized() || w.isFullScreen()) return
    const b = w.getNormalBounds()
    const file = placementFile()
    try {
      writeFileSync(`${file}.tmp`, JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height }))
      renameSync(`${file}.tmp`, file)
    } catch (e) {
      // A window that cannot remember its place still works; it opens at its default next time.
      ops.failed('ceo.window-place', e, { note: 'the CEO window\'s place was not kept; it opens at its default next time' })
    }
  }
  const later = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; save() }, KEEP_AFTER_MS)
  }
  // `moved` and `resized` end a drag on macOS and Windows; Linux sends only `move` and `resize`, so all four are heard.
  for (const event of ['moved', 'resized', 'move', 'resize'] as const) w.on(event as 'moved', later)
  w.on('close', () => {
    if (timer) clearTimeout(timer)
    timer = null
    save()
  })
}
// #endregion ceo-window-placement
