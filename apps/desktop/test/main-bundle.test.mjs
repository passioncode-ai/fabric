// The built main process is the app (0.3.2 release run 37511843198): since 489082c3 the main build named its
// entries through `rollupOptions.input`, and electron-vite then emitted an EMPTY out/main/index.js — every test
// runs the sources, so only electron-builder's asar check noticed, in the release job. This reads the artifact
// the app actually ships, after the build step (`scripts/ci.sh` builds first, like `csp.test.mjs`).
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'out', 'main')
let failures = 0
const check = (ok, message) => { console.log(`${ok ? '  ok  ' : '  FAIL'} ${message}`); if (!ok) failures++ }

// Each entry exists, is not a stub, and carries a symbol only its own source has.
for (const [file, marker, min] of [
  ['index.js', 'requestSingleInstanceLock', 100_000],
  ['acp-shell.js', 'session/request_permission', 5_000],
  ['mcp-bridge.js', 'FABRIC_BRIDGE', 1_000]
]) {
  const p = path.join(OUT, file)
  if (!existsSync(p)) { check(false, `${file} was not built — build the app before probing its bundle`); continue }
  const size = statSync(p).size
  check(size >= min, `${file} is ${size} bytes (at least ${min})`)
  // A bundle may move code into a shared chunk; the entry must still lead to it.
  const text = readFileSync(p, 'utf8')
  const chunks = [...text.matchAll(/from\s+["'](\.\/chunks\/[^"']+)["']/g)].map((m) => readFileSync(path.join(OUT, m[1]), 'utf8'))
  check([text, ...chunks].some((t) => t.includes(marker)), `${file} carries its own code (${marker})`)
}
if (failures) { console.error(`main bundle: ${failures} problem(s)`); process.exit(1) }
console.log('main bundle: every entry is built and carries its code')
