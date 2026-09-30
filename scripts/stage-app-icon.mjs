#!/usr/bin/env node
// M116 — put the mark where the packager and the runtime can actually find it.
//
// The passion-fruit family is generated into assets/brand/ and bound to
// assets/brand/brand-pack/manifest.json by checksum. Nothing consumed it: the
// packaged app wore the stock Electron icon, and `electron-builder.yml` named
// no icon at all. This script is the one seam between the generated brand pack
// and the application bundle, and it refuses to be a copy that drifts:
//
//   * the export it stages must still hash to what the manifest recorded, so a
//     hand-edited PNG fails here rather than shipping;
//   * `--check` asserts the staged copy is byte-identical to that export, which
//     is what CI and `pnpm test` can run without writing anything.
//
// The transparent 1024 variant is the staged one on purpose: macOS does not
// mask an application icon, and the mark's silhouette is the identity.

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const MANIFEST = path.join(ROOT, 'assets/brand/brand-pack/manifest.json')
const EXPORT_PATH = 'png/transparent/passioncode-icon-1024.png'
const STAGED = path.join(ROOT, 'apps/desktop/build/icon.png')
const CHECK = process.argv.includes('--check')

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')
const fail = (message) => {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

if (!existsSync(MANIFEST)) fail(`no brand manifest at ${path.relative(ROOT, MANIFEST)} — run scripts/build-brand-pack.mjs`)
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const entry = manifest.exports.find((e) => e.path === EXPORT_PATH)
if (!entry) fail(`the manifest does not describe ${EXPORT_PATH}`)

const source = path.join(path.dirname(MANIFEST), entry.path)
if (!existsSync(source)) fail(`the manifest describes ${entry.path} and the file is missing`)

const sourceHash = sha256(source)
if (sourceHash !== entry.sha256)
  fail(
    `${entry.path} does not match its manifest checksum — the brand pack was edited by hand ` +
      `or is stale. Regenerate with scripts/build-brand-pack.mjs rather than staging this file.`
  )

if (CHECK) {
  if (!existsSync(STAGED))
    fail(`the app icon is not staged at ${path.relative(ROOT, STAGED)} — run: node scripts/stage-app-icon.mjs`)
  if (sha256(STAGED) !== entry.sha256)
    fail(`the staged app icon differs from ${entry.path} — re-run: node scripts/stage-app-icon.mjs`)
  console.log(`ok: the staged app icon is ${entry.path} at ${entry.width}×${entry.height}`)
  process.exit(0)
}

mkdirSync(path.dirname(STAGED), { recursive: true })
copyFileSync(source, STAGED)
console.log(`staged ${entry.path} (${entry.width}×${entry.height}) → ${path.relative(ROOT, STAGED)}`)
