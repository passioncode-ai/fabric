// #region install-mac-update — docs: docs/launch/release-mac.md#installing-an-update-on-a-mac
// Installing a Fabric update on a Mac IN PLACE, so the Dock, Launchpad and Finder keep one Fabric icon.
//
// What broke (the operator, 2026-11-20: «после обновления приложения у меня фабрик постоянно новая иконка появляется,
// старая куда-то что-то остаётся, пропадает»), measured on the operator's Mac the same evening:
//   * the 0.3.26 apply script renamed the running bundle away (`mv /Applications/Fabric.app <worktree>/Fabric-0.3.24.app`)
//     and renamed the staged one in. The Dock keeps a bookmark to the bundle FOLDER, and a bookmark follows the folder it
//     was made for, so the Dock tile went with the old copy into the worktree while the new Fabric showed up as a second,
//     running icon; `defaults read com.apple.dock persistent-apps` held two `ai.passioncode.desktop` tiles. Deleting the
//     old copy later turns its tile into a question mark, or makes it vanish;
//   * the staged bundle sat in /Applications (`/Applications/.Fabric-0.3.26.app`) and an earlier way back stayed there as
//     `/Applications/Fabric-0.3.20.app`: Launchpad and Spotlight list every bundle with the id as another Fabric, and
//     LaunchServices may answer `open -b ai.passioncode.desktop` with any of them;
//   * rollout copies in worktrees (`Fabric-0.3.14.app`, `Fabric-0.3.24.app`, …) stayed registered with LaunchServices.
//
// The fix: the folder /Applications/Fabric.app is never moved. Its `Contents` is swapped for the new one by two renames
// on one volume, the new `Contents` staged beside it in a folder that is not a bundle (no `.app`, so nothing registers
// it); the old `Contents` becomes a zip (the way back, which LaunchServices does not see). Then LaunchServices is told
// about the bundle again, every other registration of the same id is removed, other `Fabric-*.app` copies in the same
// folder are zipped away, and the Dock keeps exactly one Fabric tile, pointing at the bundle's path.

import path from 'node:path'

export const BUNDLE_ID = 'ai.passioncode.desktop'
export const DEFAULT_TARGET = '/Applications/Fabric.app'
export const LSREGISTER = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'

/** Numeric parts of a version, a pre-release suffix ignored for ordering ("0.3.26-rc.1" → [0, 3, 26]). */
function parts(v) {
  return String(v ?? '').split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0)
}

/** -1, 0 or 1, as a compares to b by their numeric parts. */
export function compareVersions(a, b) {
  const x = parts(a), y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d < 0 ? -1 : 1
  }
  return 0
}

/**
 * Why the incoming bundle must not replace the installed one; an empty list when it may.
 * `installed` is null when nothing is installed at the target. Each side: { id, version, team } (team null = unsigned).
 * A downgrade or a reinstall of the same version needs `force` (a way back is a deliberate act, never an accident).
 */
export function installProblems({ installed, incoming, bundleId = BUNDLE_ID, force = false }) {
  const problems = []
  if (!incoming) return ['the update holds no Fabric.app']
  if (incoming.id !== bundleId) problems.push(`the update's bundle id is ${incoming.id ?? 'missing'}, not ${bundleId}`)
  if (!incoming.signatureOk) problems.push('the update\'s signature does not verify (codesign --verify --deep --strict)')
  if (installed) {
    if (installed.id && installed.id !== bundleId) problems.push(`the installed bundle's id is ${installed.id}, not ${bundleId}; refusing to overwrite another app`)
    if (installed.team && incoming.team !== installed.team) problems.push(`the update is signed by team ${incoming.team ?? 'none'}, the installed Fabric by ${installed.team}`)
    const order = compareVersions(incoming.version, installed.version)
    if (order < 0 && !force) problems.push(`the update (${incoming.version}) is older than the installed Fabric (${installed.version}); pass --force for a way back`)
    if (order === 0 && !force) problems.push(`Fabric ${installed.version} is already installed; pass --force to install it again`)
  }
  return problems
}

/**
 * The bundles LaunchServices knows under `bundleId` other than `target` (and the helpers inside it), read from
 * `lsregister -dump`: each record is a block of `key: value` lines between rules of dashes.
 */
export function staleRegistrations(dump, { bundleId = BUNDLE_ID, target = DEFAULT_TARGET } = {}) {
  const out = new Set()
  for (const block of String(dump).split(/\n-{10,}\n/)) {
    const pathLine = /^path:\s+(.+?)(?: \(0x[0-9a-f]+\))?$/m.exec(block)
    const idLine = /^identifier:\s+(\S+)/m.exec(block)
    if (!pathLine || !idLine || idLine[1] !== bundleId) continue
    const p = pathLine[1].trim()
    if (p === target || p.startsWith(`${target}/`)) continue
    out.add(p)
  }
  return [...out].sort()
}

/** Other copies of Fabric beside the target (`Fabric-0.3.20.app`, `.Fabric-0.3.26.app`), by name; ids are checked by the caller. */
export function sideCopies(names, { target = DEFAULT_TARGET } = {}) {
  const own = path.basename(target)
  return names.filter((n) => n !== own && /^\.?Fabric-\d[\w.-]*\.app$/.test(n)).sort()
}

const fileUrl = (p) => `file://${encodeURI(p.endsWith('/') ? p : `${p}/`)}`

/**
 * The Dock's `persistent-apps` with exactly one tile for `bundleId`, pointing at `target`.
 * The first such tile is kept where it stands. When there was more than one, or its URL is not the target, its URL is
 * set to the target and its bookmark (`book`) dropped: that bookmark is what followed the old folder away, and with no
 * bookmark the Dock resolves the URL (as dockutil's tiles do). Every later tile of the id is removed. A single tile
 * already at the target is left exactly as it is. Answers { apps, changed, removed }.
 */
export function dedupeDock(persistentApps, { bundleId = BUNDLE_ID, target = DEFAULT_TARGET } = {}) {
  const url = fileUrl(target)
  const list = persistentApps ?? []
  const ours = list.filter((t) => t?.['tile-data']?.['bundle-identifier'] === bundleId)
  const first = ours[0]
  if (!first || (ours.length === 1 && first['tile-data']['file-data']?._CFURLString === url)) {
    return { apps: list, changed: false, removed: 0 }
  }
  const { book: _stale, ...data } = first['tile-data']
  const repaired = { ...first, 'tile-data': { ...data, 'file-data': { ...(data['file-data'] ?? {}), _CFURLString: url, _CFURLStringType: 15 } } }
  const apps = list.filter((t) => t === first || !ours.includes(t)).map((t) => (t === first ? repaired : t))
  return { apps, changed: true, removed: ours.length - 1 }
}

/** The zip that keeps the way back, outside every folder LaunchServices scans as applications. */
export function rollbackZip(home, version) {
  return path.join(home, 'Library', 'Application Support', 'ai.passioncode.fabric', 'previous', `Fabric-${version}.zip`)
}

/** The staging folder: beside the target, on its volume, hidden, and not a bundle (no `.app`). */
export function stagingDir(target = DEFAULT_TARGET) {
  return path.join(path.dirname(target), `.${path.basename(target, '.app')}-update`)
}
// #endregion install-mac-update

/**
 * Whether the Fabric at `target` runs, from `ps -axo args=` and `lsof -a -d txt -Fn -c Fabric` (0.3.27 review DO-75).
 * The copy launchd starts runs as `Fabric --background`: its argv names no path, so only the executable `lsof` reports
 * (`n<path>` lines) tells it. Either source naming the target's executable is enough.
 */
export function fabricRunning({ args = '', lsof = '' }, target = DEFAULT_TARGET) {
  const exe = `${target}/Contents/MacOS/Fabric`
  if (args.split('\n').some((l) => l === exe || l.startsWith(`${exe} `))) return true
  return lsof.split('\n').some((l) => l === `n${exe}`)
}

/**
 * CO-626 (the 0.3.27 install of 2026-11-21): from a launchd job, macOS App Management refused the rename of the staged
 * `Contents` into the bundle (EPERM), and the undo was the same forbidden rename, which left `/Applications/Fabric.app`
 * empty. Before anything moves, a scratch folder is renamed into the bundle and out again: a refusal ends the install
 * with nothing changed. Answers null when the bundle takes a rename, else why not. `fs` is injected for the tests.
 */
export function swapProbe(target, stage, fs) {
  const scratch = path.join(stage, 'probe')
  const inside = path.join(target, '.fabric-update-probe')
  try {
    fs.rm(inside)
    fs.mkdir(scratch)
    fs.rename(scratch, inside)
  } catch (e) {
    try { fs.rm(scratch) } catch { /* the probe's own folder; the stage is removed by the caller */ }
    return `macOS refused a change inside ${target} (${e?.code ?? e?.message ?? 'error'}): run the install from a Terminal session that has App Management permission (System Settings → Privacy & Security → App Management), never from a launchd job`
  }
  try { fs.rename(inside, scratch); fs.rm(scratch) } catch (e) {
    return `a probe folder could be moved into ${target} but not out again (${e?.code ?? e?.message ?? 'error'}); remove ${inside} by hand and run the install from a Terminal session`
  }
  return null
}
