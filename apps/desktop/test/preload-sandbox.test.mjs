// The preload must survive the sandbox (M196).
//
// MEASURED 2026-09-06, and the brief's guess was wrong twice over. It said
// "sandbox: true is likely compatible"; a real window said
// `SyntaxError: Cannot use import statement outside a module` and
// `window.fabric` was ABSENT — a sandboxed preload has no ES module loader, so
// the renderer would have lost all 27 namespaces silently. Rebuilding the
// preload as CJS then failed a second way: in CJS format the resolver picks the
// `electron` NPM WRAPPER — the one that `spawnSync`s the binary — dragging
// child_process into a context where it does not exist. `external: ['electron']`
// is what makes the sandbox possible at all.
//
// This probe holds both halves without launching Electron: the shipped bundle
// must be CommonJS, and it must not carry a Node builtin that a sandbox refuses.

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const BUNDLE = path.join(HERE, '..', 'out', 'preload', 'index.cjs')

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

console.log('preload against the sandbox')

if (!existsSync(BUNDLE)) {
  fail(`no CJS preload at out/preload/index.cjs — a sandboxed preload cannot be ESM, and .mjs is what the sandbox refuses`)
} else {
  const src = readFileSync(BUNDLE, 'utf8')

  // 1. CommonJS, not ESM. A top-level `import`/`export` statement is what the
  //    sandbox rejects outright.
  if (/^\s*import\s+[\w{*]/m.test(src) || /^\s*export\s+(const|default|\{)/m.test(src))
    fail('the preload bundle carries ESM syntax — a sandboxed preload has no module loader')
  else ok('the preload ships as CommonJS, which is the only form a sandbox will load')

  // 2. No Node builtin a sandbox does not provide. `child_process` is the one
  //    that actually appeared, via the electron npm wrapper.
  const builtins = [...src.matchAll(/require\(["'](?:node:)?([a-z_]+)["']\)/g)].map((m) => m[1])
  const forbidden = builtins.filter((b) => b !== 'electron')
  if (forbidden.length)
    fail(`the preload requires ${[...new Set(forbidden)].join(', ')} — a sandbox provides none of them`)
  else ok('it requires nothing but `electron` — no builtin the sandbox would refuse')

  // 3. It still exposes the bridge. A preload that loads and bridges nothing is
  //    the same blank renderer by another route.
  if (!src.includes('exposeInMainWorld')) fail('the bundle does not expose the bridge at all')
  else ok('and it still exposes the bridge to the renderer')
}

// 4. Every window actually asks for the sandbox. Turning it on in one window and
//    not the others is the failure this line exists to catch.
const MAIN = readFileSync(path.join(HERE, '..', 'src', 'main', 'index.ts'), 'utf8')
const prefs = [...MAIN.matchAll(/webPreferences:\s*\{[^}]*\}/g)].map((m) => m[0])
const unsandboxed = prefs.filter((p) => !/sandbox:\s*true/.test(p))
if (prefs.length === 0) fail('no webPreferences found — this probe is reading the wrong file')
else if (unsandboxed.length)
  fail(`${unsandboxed.length} of ${prefs.length} window(s) do not set sandbox: true`)
else ok(`all ${prefs.length} windows run sandboxed`)

console.log(
  failures === 0
    ? '\nall green: the preload is loadable inside a sandbox, and every window asks for one'
    : `\n${failures} failure(s)`
)
process.exit(failures === 0 ? 0 : 1)
