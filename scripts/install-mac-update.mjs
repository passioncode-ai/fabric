#!/usr/bin/env node
// Install a Fabric update on this Mac IN PLACE: one Fabric in /Applications, one Fabric tile in the Dock.
// Why and how: scripts/lib/install-mac-update.mjs; docs/launch/release-mac.md#installing-an-update-on-a-mac.
//
//   node scripts/install-mac-update.mjs --dmg Fabric-0.3.27-universal.dmg          now; refused while Fabric runs
//   node scripts/install-mac-update.mjs --dmg … --wait                             waits until Fabric has ended
// Run it from a Terminal session that has App Management permission (CO-626): macOS refuses a launchd job a change
// inside an app bundle, so the --schedule of 0.3.27 refuses at once since 0.3.28 (the review's iteration 3, DO-25).
//   node scripts/install-mac-update.mjs --tidy                                     no install: other copies, stale
//                                                                                  registrations and the Dock only
// Options: --app <Fabric.app> instead of --dmg, --target <path> (default /Applications/Fabric.app), --force (the same
// or an older version: a way back), --no-dock (leave the Dock alone), --dry-run (say what would happen, change nothing).
// The way back is a zip of the previous `Contents` in ~/Library/Application Support/ai.passioncode.fabric/previous:
// `mkdir -p /tmp/back/Fabric.app && ditto -x -k <zip> /tmp/back/Fabric.app`, then `--app /tmp/back/Fabric.app --force`.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { BUNDLE_ID, DEFAULT_TARGET, LSREGISTER, dedupeDock, fabricRunning, installProblems, rollbackZip, sideCopies, staleRegistrations, stagingDir, swapProbe } from './lib/install-mac-update.mjs'

const say = (m) => console.log(`install: ${m}`)
const fail = (m) => { console.error(`install: ${m}`); process.exit(1) }
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const out = (bin, args, opts = {}) => execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim()
const tryOut = (bin, args) => { try { return out(bin, args) } catch { return null } }

if (process.platform !== 'darwin') fail('this installer is for macOS; Windows and Linux use their installers')

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined }
const opts = {
  dmg: value('--dmg'), app: value('--app'), target: value('--target') ?? DEFAULT_TARGET,
  wait: flag('--wait'), force: flag('--force'), dock: !flag('--no-dock'), dryRun: flag('--dry-run'),
  tidy: flag('--tidy'), schedule: flag('--schedule'), unschedule: value('--unschedule')
}
const home = homedir()
const act = (what, fn) => { if (opts.dryRun) { say(`would ${what}`); return undefined } return fn() }

function bundleInfo(app) {
  if (!existsSync(path.join(app, 'Contents', 'Info.plist'))) return null
  const plist = path.join(app, 'Contents', 'Info.plist')
  const read = (key) => tryOut('plutil', ['-extract', key, 'raw', '-o', '-', plist])
  const described = spawnSync('codesign', ['-dvv', app], { encoding: 'utf8' })
  const team = /^TeamIdentifier=(\S+)/m.exec(described.stderr ?? '')?.[1]
  const verified = spawnSync('codesign', ['--verify', '--deep', '--strict', app], { encoding: 'utf8' }).status === 0
  return { id: read('CFBundleIdentifier'), version: read('CFBundleShortVersionString'), team: team && team !== 'not' ? team : null, signatureOk: verified }
}

/** True when the zip's directory reads whole (`unzip -tq`). */
function zipReads(zip) {
  return existsSync(zip) && spawnSync('unzip', ['-tq', zip], { stdio: 'ignore', timeout: 300_000 }).status === 0
}

/** A zip written to `<zip>.partial`, checked, then renamed onto its name; the reason when it was not, the partial file
 *  removed (the 0.3.28 review, iteration 3, ER-22, DA-19). */
function writeZip(source, zip, keepParent) {
  const partial = `${zip}.partial`
  try {
    mkdirSync(path.dirname(zip), { recursive: true })
    rmSync(partial, { force: true })
    execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', ...(keepParent ? ['--keepParent'] : []), source, partial], { stdio: ['ignore', 'ignore', 'pipe'] })
    if (!zipReads(partial)) throw new Error('the written zip does not read back')
    renameSync(partial, zip)
    return null
  } catch (e) {
    rmSync(partial, { force: true })
    return String(e?.stderr ?? '').trim().slice(0, 200) || e?.message || 'error'
  }
}

// By argv and by the executable itself: launchd's copy runs as `Fabric --background` (0.3.27 review DO-75).
const running = (target) => fabricRunning({ args: tryOut('ps', ['-axo', 'args=']) ?? '', lsof: tryOut('lsof', ['-a', '-d', 'txt', '-Fn', '-c', 'Fabric']) ?? '' }, target)

// ---- --schedule: refused since 0.3.28 (CO-626; the review's iteration 3, DO-25). A launchd job lacks App Management,
// so its swap was the one macOS refused on 2026-11-21; --unschedule below still removes a job an older run left.
if (opts.schedule) fail('--schedule is not offered since 0.3.28: macOS refuses a launchd job a change inside an app bundle (CO-626). Run the install with --wait from a Terminal session that has App Management permission (System Settings → Privacy & Security → App Management): it waits until Fabric has ended')
const unschedule = () => {
  if (!opts.unschedule) return
  rmSync(path.join(home, 'Library', 'LaunchAgents', `${opts.unschedule}.plist`), { force: true })
  // launchd ends this very process on bootout, so it is the last step.
  spawnSync('launchctl', ['bootout', `gui/${process.getuid()}/${opts.unschedule}`], { stdio: 'ignore' })
}
process.on('exit', unschedule)

// ---- the install --------------------------------------------------------------------------------------------------
let mount = null
const cleanup = () => { if (mount) spawnSync('hdiutil', ['detach', mount, '-quiet', '-force'], { stdio: 'ignore' }); mount = null }
process.on('exit', cleanup)

if (!opts.tidy) {
  let source = opts.app && path.resolve(opts.app)
  if (opts.dmg) {
    mount = mkdtempSync(path.join(tmpdir(), 'fabric-dmg-'))
    const attached = spawnSync('hdiutil', ['attach', path.resolve(opts.dmg), '-nobrowse', '-readonly', '-noautoopen', '-mountpoint', mount], { encoding: 'utf8' })
    if (attached.status !== 0) { mount = null; fail(`could not open the DMG: ${attached.stderr.trim()}`) }
    source = readdirSync(mount).filter((n) => n.endsWith('.app')).map((n) => path.join(mount, n)).find((a) => bundleInfo(a)?.id === BUNDLE_ID)
  }
  if (!source) fail('pass --dmg <file> or --app <Fabric.app>')
  const incoming = bundleInfo(source)
  const installed = bundleInfo(opts.target)
  const problems = installProblems({ installed, incoming, force: opts.force })
  if (problems.length) fail(`refused:\n  ${problems.join('\n  ')}`)
  say(`Fabric ${installed?.version ?? '(none)'} → ${incoming.version} at ${opts.target}`)

  const stage = stagingDir(opts.target)
  act(`stage the new Contents in ${stage}`, () => {
    rmSync(stage, { recursive: true, force: true })
    mkdirSync(stage, { recursive: true })
    execFileSync('ditto', [path.join(source, 'Contents'), path.join(stage, 'Contents')], { stdio: 'inherit' })
  })
  cleanup()

  if (running(opts.target)) {
    if (!opts.wait) { act(`remove ${stage}`, () => rmSync(stage, { recursive: true, force: true })); fail('Fabric is running: quit it first, or pass --wait to apply the update once it has ended') }
    say('waiting until Fabric has ended (with «Служба доски» on, turn it off in Settings and Quit; turn it on again after the update); nothing is stopped by this installer')
    // «Перезапустить Fabric» starts it again about 200 ms after it ends (0.3.27 review ER-70): an end counts only when Fabric
    // is still gone 2 s later, so a restart is waited out rather than met by the swap's own check and dropped.
    if (!opts.dryRun) do { while (running(opts.target)) sleep(500); sleep(2000) } while (running(opts.target))
  }

  if (opts.dryRun) say('the swap probe (CO-626) moves a folder inside the bundle, so a dry run does not run it: a run from launchd or without App Management is refused there, with nothing changed')
  act(`swap ${opts.target}/Contents for the staged one, keeping the folder`, () => {
    const outgoing = path.join(stage, 'previous')
    mkdirSync(outgoing, { recursive: true })
    // A folder this run creates is removed again when the run stops before the swap (iteration 3, ER-23).
    const created = !existsSync(opts.target)
    if (created) mkdirSync(opts.target)
    const stop = (why) => { rmSync(stage, { recursive: true, force: true }); if (created) rmSync(opts.target, { recursive: true, force: true }); fail(why) }
    const had = existsSync(path.join(opts.target, 'Contents'))
    // A copy launchd started in the last instant is caught here rather than half-replaced.
    if (running(opts.target)) stop('Fabric started again before the swap; nothing was changed, run the install again')
    // CO-626: macOS may refuse a change inside an app bundle (App Management, a launchd job): probed before anything moves.
    const refused = swapProbe(opts.target, stage, {
      mkdir: (p) => mkdirSync(p, { recursive: true }), rename: (a, b) => renameSync(a, b), rm: (p) => rmSync(p, { recursive: true, force: true })
    })
    if (refused) stop(refused)
    // The way back is written before the swap (CO-626: a failed swap used to leave no zip to go back to), to a partial
    // file checked and then renamed, so the way-back name never holds a cut zip (iteration 3, ER-22, DA-19).
    const zip = had && installed?.version ? rollbackZip(home, installed.version) : null
    if (zip) {
      const why = writeZip(path.join(opts.target, 'Contents'), zip, true)
      if (why) stop(`the way back could not be written (${why}); nothing was changed`)
      say(`the way back, written before the swap: ${zip}`)
      // The zip takes seconds (25 s measured for 0.3.27's bundle): a Fabric started meanwhile is checked for again here,
      // right before anything moves (iteration 3, ER-21, DA-20, UX-32).
      if (running(opts.target)) stop('Fabric started again while the way back was written; nothing was changed, run the install again')
    }
    if (had) renameSync(path.join(opts.target, 'Contents'), path.join(outgoing, 'Contents'))
    // The undo is checked, never assumed (CO-626; both undos since the review's iteration 3, ER-25): when it fails too,
    // say where both copies are and how to go back.
    const undo = () => {
      if (!had) return true
      try { renameSync(path.join(outgoing, 'Contents'), path.join(opts.target, 'Contents')); return existsSync(path.join(opts.target, 'Contents', 'Info.plist')) } catch { return false }
    }
    const lost = (what, newAt) => `${what}: ${opts.target} has no Contents now. The previous Contents is in ${path.join(outgoing, 'Contents')}, the new one in ${newAt}${zip ? `, and the zip of the previous one in ${zip}` : ''}. From a Terminal session with App Management permission: mv "${path.join(outgoing, 'Contents')}" "${path.join(opts.target, 'Contents')}"`
    try {
      renameSync(path.join(stage, 'Contents'), path.join(opts.target, 'Contents'))
    } catch (e) {
      if (undo()) fail(`the swap failed and was undone: ${e.message}`)
      fail(lost(`the swap failed (${e.message}) and so did its undo`, path.join(stage, 'Contents')))
    }
    const after = bundleInfo(opts.target)
    if (!after?.signatureOk || after.version !== incoming.version) {
      try { renameSync(path.join(opts.target, 'Contents'), path.join(stage, 'failed-Contents')) } catch (e) {
        fail(`the swapped bundle did not verify (${after?.version ?? 'unreadable'}) and could not be moved aside (${e.message}); ${opts.target} holds it, the previous Contents is in ${path.join(outgoing, 'Contents')}${zip ? `, its zip in ${zip}` : ''}`)
      }
      if (undo()) fail(`the swapped bundle did not verify (${after?.version ?? 'unreadable'}); the previous Fabric is back, read back from ${path.join(opts.target, 'Contents', 'Info.plist')}`)
      fail(lost(`the swapped bundle did not verify (${after?.version ?? 'unreadable'}) and the undo failed`, path.join(stage, 'failed-Contents')))
    }
    rmSync(stage, { recursive: true, force: true })
    // The folder's date moves so Finder and the Dock read its icon again.
    execFileSync('touch', [opts.target])
    spawnSync(LSREGISTER, ['-f', opts.target], { stdio: 'ignore', timeout: 30_000 })
    say(`installed Fabric ${after.version}`)
  })
}

// ---- tidy: other copies beside the target, stale registrations, the Dock -----------------------------------------
const folder = path.dirname(opts.target)
for (const name of sideCopies(readdirSync(folder), { target: opts.target })) {
  const copy = path.join(folder, name)
  const info = bundleInfo(copy)
  if (info?.id !== BUNDLE_ID) continue
  act(`zip ${copy} away (it shows as another Fabric in Launchpad and Spotlight)`, () => {
    const zip = rollbackZip(home, info.version ?? name.replace(/\.app$/, '').replace(/^\.?Fabric-/, ''))
    mkdirSync(path.dirname(zip), { recursive: true })
    // A zip already there is checked before the copy goes (iteration 3, ER-22): a cut one is written again first.
    if (!zipReads(zip)) { const why = writeZip(copy, zip, false); if (why) fail(`${copy} was kept: its zip could not be written (${why})`) }
    spawnSync(LSREGISTER, ['-u', copy], { stdio: 'ignore', timeout: 30_000 })
    rmSync(copy, { recursive: true, force: true })
    say(`moved ${name} into ${zip}`)
  })
}
const dump = spawnSync(LSREGISTER, ['-dump'], { encoding: 'utf8', maxBuffer: 1 << 30, timeout: 120_000 }).stdout ?? ''
for (const stale of staleRegistrations(dump, { target: opts.target })) {
  // Registrations only: a copy in a worktree or an archive is another task's file and stays where it is.
  act(`unregister ${stale}`, () => { spawnSync(LSREGISTER, ['-u', stale], { stdio: 'ignore', timeout: 30_000 }); say(`unregistered ${stale}`) })
}

if (opts.dock) {
  // The Dock's preferences hold bookmarks (binary data), which JSON cannot carry: python's plistlib reads and writes
  // them, and the decision itself is dedupeDock's, tested in scripts/test/install-mac-update.test.mjs.
  const py = String.raw`
import base64, datetime, json, plistlib, subprocess, sys
mode = sys.argv[1]
def enc(o):
    if isinstance(o, bytes): return {"__data": base64.b64encode(o).decode()}
    if isinstance(o, dict): return {k: enc(v) for k, v in o.items()}
    if isinstance(o, list): return [enc(v) for v in o]
    if hasattr(o, "isoformat"): return {"__date": o.isoformat()}
    return o
def dec(o):
    if isinstance(o, dict) and set(o) == {"__data"}: return base64.b64decode(o["__data"])
    if isinstance(o, dict) and set(o) == {"__date"}: return datetime.datetime.fromisoformat(o["__date"])
    if isinstance(o, dict): return {k: dec(v) for k, v in o.items()}
    if isinstance(o, list): return [dec(v) for v in o]
    return o
raw = subprocess.run(["defaults", "export", "com.apple.dock", "-"], capture_output=True, check=True).stdout
prefs = plistlib.loads(raw)
if mode == "read":
    print(json.dumps(enc(prefs.get("persistent-apps", []))))
else:
    prefs["persistent-apps"] = dec(json.load(sys.stdin))
    subprocess.run(["defaults", "import", "com.apple.dock", "-"], input=plistlib.dumps(prefs, fmt=plistlib.FMT_BINARY), check=True)
`
  const read = spawnSync('python3', ['-I', '-c', py, 'read'], { encoding: 'utf8' })
  if (read.status !== 0) say(`could not read the Dock's preferences; left alone: ${read.stderr.trim()}`)
  else {
    const { apps, changed, removed } = dedupeDock(JSON.parse(read.stdout), { target: opts.target })
    if (!changed) say('the Dock holds one Fabric tile already')
    else act(`keep one Fabric tile in the Dock (removing ${removed}) and restart the Dock`, () => {
      const wrote = spawnSync('python3', ['-I', '-c', py, 'write'], { input: JSON.stringify(apps), encoding: 'utf8' })
      if (wrote.status !== 0) fail(`could not write the Dock's preferences: ${wrote.stderr.trim()}`)
      spawnSync('killall', ['Dock'], { stdio: 'ignore' })
      say(`the Dock holds one Fabric tile (${removed} removed)`)
    })
  }
}
