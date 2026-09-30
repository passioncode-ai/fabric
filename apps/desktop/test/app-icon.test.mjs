// M116 — the mark reaches the application, and keeps reaching it.
//
// The failure this guards is silent by construction: an app with no icon does
// not crash, it just wears somebody else's mark on the operator's own dock, and
// that is exactly the state this repository shipped in until now. So the probe
// asserts the whole chain rather than any one link — the generated asset still
// matches its manifest, the packager is told where it is, the runtime resolves
// it from the directory the BUILD OUTPUT lives in (not the source tree), and
// both call sites in the main process are still there.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const APP = path.resolve(import.meta.dirname, '..')
const ROOT = path.resolve(APP, '../..')
const EXPORT_PATH = 'png/transparent/passioncode-icon-1024.png'

let failed = 0
const check = (ok, message) => {
  if (ok) return
  console.log(`FAIL: ${message}`)
  failed++
}

// 1. the generated asset is the one the manifest recorded
const manifestPath = path.join(ROOT, 'assets/brand/brand-pack/manifest.json')
check(existsSync(manifestPath), 'no brand manifest — the pack was never generated')
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const entry = manifest.exports.find((e) => e.path === EXPORT_PATH)
  check(Boolean(entry), `the manifest does not describe ${EXPORT_PATH}`)
  if (entry) {
    const file = path.join(path.dirname(manifestPath), entry.path)
    check(existsSync(file), `${entry.path} is described by the manifest and missing on disk`)
    if (existsSync(file)) {
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
      check(hash === entry.sha256, `${entry.path} no longer matches its manifest checksum`)
      check(entry.width === 1024 && entry.height === 1024, 'the staged export is not 1024×1024')
    }
  }
}

// 2. the packager is told about it, and ships it into the bundle
const builder = readFileSync(path.join(APP, 'electron-builder.yml'), 'utf8')
check(/^\s+icon: build\/icon\.png$/m.test(builder), 'electron-builder.yml names no mac icon')
check(/from: build\/icon\.png/.test(builder), 'the icon is not carried into the bundle resources')

// 3. staging is not optional — it runs before both dev and package
const pkg = JSON.parse(readFileSync(path.join(APP, 'package.json'), 'utf8'))
for (const script of ['dev', 'package'])
  check(
    pkg.scripts[script].includes('stage-app-icon'),
    `the ${script} script can run without staging the icon`
  )

// 4. the runtime path arithmetic is right — this is the link that silently rots.
//    `import.meta.dirname` at runtime is out/main, NOT src/main, and a fallback
//    computed from the wrong one resolves to nothing and warns forever.
const OUT_MAIN = path.join(APP, 'out/main')
const source = readFileSync(path.join(APP, 'src/main/appIcon.ts'), 'utf8')
const relatives = [...source.matchAll(/'(\.\.\/[^']*(?:icon\.png|passioncode-icon-1024\.png))'/g)].map(
  (m) => m[1]
)
check(relatives.length === 2, `expected two dev candidates in appIcon.ts, found ${relatives.length}`)
const staged = relatives.find((r) => r.endsWith('build/icon.png'))
const packAsset = relatives.find((r) => r.endsWith('passioncode-icon-1024.png'))
check(
  staged !== undefined && path.resolve(OUT_MAIN, staged) === path.join(APP, 'build/icon.png'),
  `the staged-icon candidate does not resolve to apps/desktop/build/icon.png from out/main`
)
check(
  packAsset !== undefined &&
    path.resolve(OUT_MAIN, packAsset) ===
      path.join(ROOT, 'assets/brand/brand-pack', EXPORT_PATH),
  'the brand-pack fallback does not resolve to the generated export from out/main'
)

// 5. both call sites survive a refactor of index.ts
const index = readFileSync(path.join(APP, 'src/main/index.ts'), 'utf8')
check(/applyAppIcon\(\)/.test(index), 'nothing sets the dock icon in the main process')
check(/\.\.\.windowIcon\(\)/.test(index), 'the main window does not carry the icon')

if (failed > 0) {
  console.log(`\n${failed} app-icon check(s) failed`)
  process.exit(1)
}
console.log('ok: the brand mark reaches the packager, the bundle and the runtime')
