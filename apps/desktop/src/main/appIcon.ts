// M116 — the mark, resolved once for every surface that can show it.
//
// Three different things want the icon and they do NOT share a mechanism:
//
//   * the packaged macOS bundle takes it from `electron-builder.yml`, which
//     converts the staged PNG to an `.icns` at build time — nothing at runtime
//     is involved, and calling `dock.setIcon` there would fight the bundle;
//   * `electron-vite dev` has no bundle, so the dock shows Electron's own icon
//     until something sets it — that is the only place this runs on macOS;
//   * Windows and Linux read `BrowserWindow({ icon })` instead, so the window
//     options carry it there and nowhere else.
//
// The resolution order is deliberate: the staged copy first, because it is what
// the packager will ship and therefore what the dev icon should also be, and the
// generated brand pack second, so a checkout that has never run
// `scripts/stage-app-icon.mjs` still shows the right mark instead of failing.

import { app, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'node:fs'
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
  if (process.platform !== 'darwin' || app.isPackaged) return
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
