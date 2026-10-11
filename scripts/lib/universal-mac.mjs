// #region universal-mac — docs: docs/launch/release-mac.md#universal-macos
// Operator decision 2026-10-09: every PassionCode product runs natively on Apple silicon and Intel
// Macs, and ships no thin Intel-only Mach-O — macOS reports one as "Support Ending for Intel-Based
// Apps" (Fabric 0.3.2 carried node-pty's darwin-x64 prebuilds that way).
//
// electron-builder's universal pack builds an x64 and an arm64 app and joins them with
// @electron/universal, which lipo's the files that differ. node-pty keeps each architecture in its
// own `prebuilds/darwin-<arch>/` folder, so both builds hold the same two thin files and nothing is
// joined. `universalizeNodePty` replaces each with one universal binary in both folders (node-pty
// still loads `darwin-${process.arch}`); `foreignPrebuilds` names other platforms' prebuilds, which
// the electron-builder `files` filter keeps out (deleting them after packing would leave them in
// app.asar's header and break the join); `thinMachO` finds any Mach-O that still lacks a slice.
import { spawnSync } from 'node:child_process'
import { chmodSync, closeSync, copyFileSync, existsSync, openSync, readdirSync, readSync } from 'node:fs'
import path from 'node:path'

// Thin (32/64-bit, either byte order) and fat (32/64-bit offsets) Mach-O magics.
const MACH_O = new Set([0xcafebabe, 0xcafebabf, 0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe])
const FILES = ['pty.node', 'spawn-helper']

function lipo(args) {
  const r = spawnSync('lipo', args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`lipo ${args.join(' ')} failed: ${(r.stderr || String(r.error)).trim()}`)
  return r.stdout.trim()
}

/** The slices of a Mach-O file, `[]` when it is one lipo cannot read, or null when it is not one. */
export function slices(file) {
  const head = Buffer.alloc(4)
  const fd = openSync(file, 'r')
  try { readSync(fd, head, 0, 4, 0) } finally { closeSync(fd) }
  if (!MACH_O.has(head.readUInt32BE(0))) return null
  const r = spawnSync('lipo', ['-archs', file], { encoding: 'utf8' })
  // Not a pass: a file that claims to be a Mach-O and cannot be read has no slice anyone has seen (0.3.4 i1 ER-5).
  return r.status === 0 ? r.stdout.trim().split(/\s+/).filter(Boolean).sort() : []
}

/** Every Mach-O under `dir` without both arm64 and x86_64, as `relative/path [slices]`. */
export function thinMachO(dir) {
  const found = []
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) { walk(full); continue }
      const archs = slices(full)
      if (archs && !(archs.includes('arm64') && archs.includes('x86_64'))) found.push(`${path.relative(dir, full)} [${archs.length ? archs.join(' ') : 'unreadable'}]`)
    }
  }
  walk(dir)
  return found
}

/** The prebuild folders of `module` that are not macOS's (they must not ship in the Mac app). */
export function foreignPrebuilds(module) {
  const prebuilds = path.join(module, 'prebuilds')
  return existsSync(prebuilds) ? readdirSync(prebuilds).filter(entry => !entry.startsWith('darwin-')).sort() : []
}

/**
 * Rewrites the darwin prebuilds of `<module>` inside a packed app: one universal file per prebuild,
 * placed in both darwin folders. `source` is the installed node-pty, whose thin darwin-arm64 and
 * darwin-x64 files are joined. Idempotent: the universal pack runs it on each architecture's app
 * and again on the joined one, so the two apps carry identical files and nothing is left to lipo.
 */
export function universalizeNodePty(module, source) {
  const prebuilds = path.join(module, 'prebuilds')
  if (!existsSync(prebuilds)) throw new Error(`node-pty has no prebuilds in ${module}`)
  for (const file of FILES) {
    const arm = path.join(source, 'prebuilds', 'darwin-arm64', file)
    const x64 = path.join(source, 'prebuilds', 'darwin-x64', file)
    if (!existsSync(arm) || !existsSync(x64)) throw new Error(`node-pty has no darwin prebuild of ${file} for both architectures`)
    const target = path.join(prebuilds, 'darwin-arm64', file)
    lipo(['-create', arm, x64, '-output', target])
    if (slices(target)?.join(' ') !== 'arm64 x86_64') throw new Error(`node-pty ${file} did not become universal`)
    copyFileSync(target, path.join(prebuilds, 'darwin-x64', file))
    for (const arch of ['arm64', 'x64']) chmodSync(path.join(prebuilds, `darwin-${arch}`, file), file === 'spawn-helper' ? 0o755 : 0o644)
  }
}
// #endregion universal-mac
