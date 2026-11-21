// M116 — the mark, resolved once for every surface that can show it.
//
// Three different things want the icon and they do NOT share a mechanism:
//
//   * the packaged macOS bundle takes it from `electron-builder.yml`, which
//     converts the staged PNG to an `.icns` at build time: Finder and Launchpad
//     show that one. Since wave I (2026-11-20) the DOCK shows the CEO's face the
//     person chose (`setDockIcon`, drawn by the main window from the same markup
//     as the avatar), kept in `userData/dock-icon.png` so the next start shows it
//     before any window draws; without that file the bundle's icon stays;
//   * `electron-vite dev` has no bundle, so the dock shows Electron's own icon
//     until something sets it — that is the only place this runs on macOS;
//   * Windows and Linux read `BrowserWindow({ icon })` instead, so the window
//     options carry it there and nowhere else.
//
// The resolution order is deliberate: the staged copy first, because it is what
// the packager will ship and therefore what the dev icon should also be, and the
// generated brand pack second, so a checkout that has never run
// `scripts/stage-app-icon.mjs` still shows the right mark instead of failing.

import { app, BrowserWindow, nativeImage, type NativeImage } from 'electron'
import { existsSync, renameSync, writeFileSync } from 'node:fs'
import { isDockIconPng } from '../shared/avatarSvg.ts'
import path from 'node:path'
import { ops } from './opsSink.ts'

/** Built output lives at `out/main`, which is what every path below is relative to. */
const CANDIDATES = (): string[] =>
  app.isPackaged
    ? [path.join(process.resourcesPath, 'icon.png')]
    : [
        path.join(import.meta.dirname, '../../build/icon.png'),
        path.join(
          import.meta.dirname,
          '../../../../assets/brand/app-icon/fabric-icon-1024.png'
        )
      ]

/** The file the mark lives in, or null when this checkout has none. */
export function appIconPath(): string | null {
  return CANDIDATES().find((candidate) => existsSync(candidate)) ?? null
}

let cached: NativeImage | null | undefined

function appIcon(): NativeImage | null {
  if (cached !== undefined) return cached
  const file = appIconPath()
  if (!file) {
    cached = null
    return cached
  }
  const image = nativeImage.createFromPath(file)
  // An unreadable PNG produces an EMPTY image rather than throwing, and an
  // empty image handed to `setIcon` clears the icon instead of setting it —
  // which looks exactly like the bug this milestone fixes.
  cached = image.isEmpty() ? null : image
  return cached
}

/**
 * Set the dock icon where nothing else will. Never throws: an application that
 * refuses to start because its icon is missing is worse than one wearing the
 * wrong icon, and the warning says which command fixes it.
 */
export function applyAppIcon(): void {
  if (process.platform !== 'darwin') return
  // The face kept from the last start, in a packaged build and in development alike (wave I).
  const face = existsSync(facePath()) ? nativeImage.createFromPath(facePath()) : null
  if (face && !face.isEmpty()) { app.dock?.setIcon(face); return }
  if (app.isPackaged) return
  const image = appIcon()
  if (!image) {
    ops.record({
      op: 'appIcon.missing',
      outcome: 'ok',
      level: 'warn',
      detail: { fix: 'node scripts/stage-app-icon.mjs', effect: 'the dock shows the Electron mark' },
      ctx: { correlationId: ops.correlate() }
    })
    return
  }
  app.dock?.setIcon(image)
}

/** Window options carrying the icon on the platforms that read it. */
export function windowIcon(): { icon?: NativeImage } {
  if (process.platform === 'darwin') return {}
  const image = appIcon()
  return image ? { icon: image } : {}
}

// #region dock-icon-main — docs: docs/evidence/plans/2026-11-20-ceo-board-ux/plan.md#wave-i-the-app-icon-is-the-ceos-avatar
const facePath = (): string => path.join(app.getPath('userData'), 'dock-icon.png')

/**
 * The CEO's face, drawn by the main window as a PNG data URL, becomes the app icon: the Dock on macOS, every window's
 * icon on Windows and Linux. Kept for the next start (written beside, then renamed, so a crash leaves the old one).
 * Anything but a bounded PNG is refused and logged without its bytes.
 */
export function setDockIcon(png: unknown): { applied: boolean; reason?: string } {
  const refuse = (reason: string): { applied: false; reason: string } => {
    ops.record({ op: 'appIcon.face', outcome: 'failed', level: 'warn', detail: { reason }, ctx: { correlationId: ops.correlate() } })
    return { applied: false, reason }
  }
  if (!isDockIconPng(png)) return refuse('not a PNG data URL within 4 MB')
  const image = nativeImage.createFromDataURL(png)
  if (image.isEmpty()) return refuse('the PNG did not decode')
  if (process.platform === 'darwin') app.dock?.setIcon(image)
  else for (const w of BrowserWindow.getAllWindows()) w.setIcon(image)
  try {
    const file = facePath()
    writeFileSync(`${file}.tmp`, image.toPNG())
    renameSync(`${file}.tmp`, file)
  } catch (e) {
    // Recorded: refuse() writes `appIcon.face` failed to the ops log, without the image's bytes.
    return refuse(`set, but not kept for the next start: ${e instanceof Error ? e.message : String(e)}`)
  }
  return { applied: true }
}
// #endregion dock-icon-main
