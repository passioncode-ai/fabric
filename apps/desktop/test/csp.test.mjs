// The built page carries its Content-Security-Policy, and the windows carry their guard
// (ADR-0020 makes the CSP a host obligation; audit 2026-10-05 A7-002).
//
// WHY A PROBE RATHER THAN A CODE REVIEW. The renderer is the only place the preload's whole
// bridge (`terminal.write`, `files.write`, `hub.decide`) stands, and the policy is what keeps
// that document the only script that can run there. Three facts hold it, and each can rot
// silently: the build must STAMP the meta (the dev page deliberately has none — a policy
// loosened for development is the one that ships), the main process must wire the navigation
// guard, and the IPC wrappers must refuse a sender that is not Fabric's renderer. The pure
// rules themselves — which document is the app's, which link leaves — are covered by
// `navigation-guard.test.mjs`.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const PAGE = path.join(HERE, '..', 'out', 'renderer', 'index.html')
const MAIN = readFileSync(path.join(HERE, '..', 'src', 'main', 'index.ts'), 'utf8')

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

console.log('the renderer policy and the window guard')

// 1. The BUILT page carries the policy, with the directives that do the work.
if (!existsSync(PAGE)) {
  fail('no built page at out/renderer/index.html — build the renderer before probing its policy')
} else {
  const html = readFileSync(PAGE, 'utf8')
  const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)
  if (!meta) fail('the built page has no Content-Security-Policy meta — the dev page has none by design; the built one MUST')
  else {
    const policy = meta[1]
    for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "frame-src 'none'", "base-uri 'none'"])
      if (!policy.includes(directive)) fail(`the policy lacks ${directive}`)
    if (policy.includes("script-src 'self' 'unsafe-inline'") || policy.includes("'unsafe-eval'"))
      fail('the policy lets scripts it does not own run — unsafe-inline or unsafe-eval in script-src')
    if (failures === 0) ok(`the built page carries its policy: ${policy}`)
  }
}

// 2. Every window is kept on Fabric's own renderer document, and new windows go to the
//    person's browser instead of opening in-app with the bridge.
if (/contents\.on\('will-navigate'/.test(MAIN) && /setWindowOpenHandler/.test(MAIN))
  ok('the navigation guard is wired: will-navigate refuses elsewhere, window.open leaves for the browser')
else fail('src/main/index.ts wires no will-navigate guard or no setWindowOpenHandler — a window may hold any document, with the bridge')

// 3. The IPC wrappers refuse a sender that is not Fabric's renderer: the navigation guard is
//    the first wall, this the second — a window that somehow left the app document still gets
//    no bridge calls through.
if (/senderFrame\?\.url/.test(MAIN) && /function listen\(/.test(MAIN) && /function senderAllowed/.test(MAIN))
  ok('handle() and listen() check the sender frame against the app document')
else fail('the IPC wrappers do not check senderFrame — any document that reached the window may drive the bridge')

// 4. ADR-0197 §4: the CEO popup's document is the ONE that may reach outside the app, and only xAI's realtime socket;
//    the main page still reaches nothing. The microphone is the CEO window's alone.
const CEO_PAGE = path.join(HERE, '..', 'out', 'renderer', 'ceo.html')
if (!existsSync(CEO_PAGE)) fail('no built page at out/renderer/ceo.html — the CEO popup has no document of its own')
else {
  const ceo = readFileSync(CEO_PAGE, 'utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? ''
  const main = existsSync(PAGE) ? (readFileSync(PAGE, 'utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '') : ''
  const ceoConnect = ceo.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src')) ?? ''
  if (ceoConnect !== "connect-src 'self' wss://api.x.ai") fail(`the CEO page's connect-src is «${ceoConnect}», not exactly 'self' and wss://api.x.ai`)
  else if (!ceo.includes("script-src 'self'") || ceo.includes("'unsafe-eval'")) fail('the CEO page loosened its script-src')
  else if (main.includes('api.x.ai')) fail('the main page may reach xAI: only the CEO popup may')
  else ok(`the CEO popup alone reaches wss://api.x.ai (${ceoConnect})`)
}
if (/setPermissionRequestHandler/.test(MAIN) && /permission !== 'media'/.test(MAIN) && /kind === 'ceo'/.test(MAIN))
  ok('the microphone is granted to the CEO window alone')
else fail('src/main/index.ts does not keep the microphone to the CEO window')

// 5. ADR-0201 §2: the canvas's document carries the renderer's own policy, unchanged (it reaches nothing outside the app),
//    and Excalidraw's fonts ship beside the pages, and the editor's fallback to esm.sh is taken out of the build.
const CANVAS_PAGE = path.join(HERE, '..', 'out', 'renderer', 'canvas.html')
if (!existsSync(CANVAS_PAGE)) fail('no built page at out/renderer/canvas.html — the canvas has no document of its own')
else {
  const canvas = readFileSync(CANVAS_PAGE, 'utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? ''
  const main = existsSync(PAGE) ? (readFileSync(PAGE, 'utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '') : ''
  if (!canvas || canvas !== main) fail(`the canvas page's policy is not the renderer's: «${canvas}»`)
  else ok('the canvas page carries the renderer\'s own policy')
  const fonts = path.join(HERE, '..', 'out', 'renderer', 'excalidraw-assets', 'fonts', 'Excalifont')
  if (!existsSync(fonts)) fail('Excalidraw\'s fonts were not copied beside the pages (out/renderer/excalidraw-assets/fonts)')
  else ok('Excalidraw\'s fonts ship as the app\'s own files')
  // The editor's own fallback origin is taken out of the bundle (ADR-0201 §2, `electron.vite.config.ts#excalidrawNoFallback`):
  // shipped fonts alone do not stop it, the editor still tried esm.sh for every face and the policy refused each one.
  const assets = path.join(HERE, '..', 'out', 'renderer', 'assets')
  const naming = existsSync(assets) ? readdirSync(assets).filter((f) => f.endsWith('.js') && readFileSync(path.join(assets, f), 'utf8').includes('esm.sh')) : null
  if (naming === null) fail('no built scripts at out/renderer/assets')
  else if (naming.length) fail(`the built renderer still names esm.sh, Excalidraw's font fallback (${naming.join(', ')})`)
  else ok('no built script names esm.sh: the editor has no fallback origin to try')
  const index = readFileSync(PAGE, 'utf8')
  if (/canvas|mount-/.test(index.match(/<script[^>]*src="([^"]+)"/)?.[1] ?? '')) fail('the main page loads the canvas\'s entry')
}
if (/APP_ENTRY[\s\S]{0,900}renderer\/canvas\.html/.test(MAIN)) ok('the canvas page is one of the app\'s own documents for the navigation guard')
else fail('src/main/index.ts does not name canvas.html among the app\'s documents')

if (failures) {
  console.error(`\ncsp: ${failures} probe(s) failed`)
  process.exit(1)
}
console.log('csp: the policy is stamped, the windows are guarded, the bridge checks its caller')
