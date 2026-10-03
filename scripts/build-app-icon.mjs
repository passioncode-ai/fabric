#!/usr/bin/env node
// #region app-icon — docs: docs/adr/0100-first-run-and-start-paths.md#app-icon
// The Fabric app icon (ADR-0100 §8, operator's choice 2026-10-03): the PassionCode.ai mark from its
// source SVG, composed on a graphite macOS tile — `assets/brand/app-icon/fabric-icon.svg`. Composed,
// not generated: four Asset Foundry candidates (job_01M3ZC9B3DYDH7ECV6ECECD45T) did not keep the mark
// and the operator chose the exact vector.
//
//   node scripts/build-app-icon.mjs          render the SVG to the 1024 PNG and write the manifest (Electron, transparent)
//   node scripts/build-app-icon.mjs --check  the PNG and the SVG still match what the manifest recorded (any OS)
//
// The manifest binds the PNG to the SVG that produced it, so editing the SVG without rendering — or
// hand-editing the PNG — fails `--check` and `stage-app-icon.mjs`.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const DIR = path.resolve(import.meta.dirname, '../assets/brand/app-icon')
const SVG = path.join(DIR, 'fabric-icon.svg')
const PNG = path.join(DIR, 'fabric-icon-1024.png')
const MANIFEST = path.join(DIR, 'manifest.json')
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex')
const fail = (m) => { console.error('FAIL: ' + m); process.exit(1) }

if (process.argv.includes('--check')) {
  if (!existsSync(MANIFEST)) fail('no app-icon manifest — run: node scripts/build-app-icon.mjs')
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  if (sha(SVG) !== m.sourceSha256) fail('fabric-icon.svg changed since it was rendered — run: node scripts/build-app-icon.mjs')
  // The tile carries the PassionCode mark copied from its source; a changed mark must re-compose the tile.
  if (!m.mark || sha(path.join(DIR, m.mark)) !== m.markSha256) fail(`the PassionCode mark (${m.mark}) changed since the icon was composed — update fabric-icon.svg from it, then run: node scripts/build-app-icon.mjs`)
  const e = m.exports.find((x) => x.path === 'fabric-icon-1024.png')
  if (!e || sha(PNG) !== e.sha256) fail('fabric-icon-1024.png does not match its manifest checksum — render it, never edit it')
  console.log(`ok: app icon ${e.width}×${e.height} rendered from fabric-icon.svg ${m.sourceSha256.slice(0, 12)}`)
  process.exit(0)
}
// Electron's own Chromium, offscreen and transparent: the tile's corners and its shadow keep their alpha
// (QuickLook, tried first, fills the corners white). Electron is already a dependency of the app.
const ELECTRON = path.resolve(import.meta.dirname, '../apps/desktop/node_modules/.bin/electron')
if (!existsSync(ELECTRON)) fail('no Electron at apps/desktop/node_modules — run pnpm install')
const out = mkdtempSync(path.join(tmpdir(), 'fabric-icon-'))
execFileSync(ELECTRON, [path.join(import.meta.dirname, 'lib/render-svg-electron.cjs'), SVG, path.join(out, 'icon.png'), '1024'], { stdio: 'ignore', timeout: 60000 })
renameSync(path.join(out, 'icon.png'), PNG)
const head = readFileSync(PNG)
const width = head.readUInt32BE(16), height = head.readUInt32BE(20)
if (width !== 1024 || height !== 1024) fail(`rendered ${width}×${height}, expected 1024×1024`)
writeFileSync(MANIFEST, JSON.stringify({
  version: 1, brand: 'Fabric', source: 'fabric-icon.svg', sourceSha256: sha(SVG),
  mark: '../favicon/source/passioncode-passion-fruit.svg', markSha256: sha(path.join(DIR, '../favicon/source/passioncode-passion-fruit.svg')),
  renderer: 'Electron offscreen capture, transparent (scripts/lib/render-svg-electron.cjs)',
  exports: [{ path: 'fabric-icon-1024.png', format: 'png', width, height, sha256: sha(PNG) }]
}, null, 2) + '\n')
console.log(`rendered fabric-icon-1024.png ${width}×${height}; manifest written`)
// #endregion app-icon
