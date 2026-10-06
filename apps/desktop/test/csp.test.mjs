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

import { readFileSync, existsSync } from 'node:fs'
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

if (failures) {
  console.error(`\ncsp: ${failures} probe(s) failed`)
  process.exit(1)
}
console.log('csp: the policy is stamped, the windows are guarded, the bridge checks its caller')
