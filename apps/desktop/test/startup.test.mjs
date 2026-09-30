// Where the local stack's configuration lives, and why the check exists (M100).
//
// `execFileSync` reports a missing WORKING DIRECTORY and a missing BINARY with
// the identical message — `spawnSync <cmd> ENOENT`, measured on this machine
// 2026-09-05 against both. So before this file existed, a FABRIC_REPO pointing
// at nothing produced a startup dialog reading "the Supabase command-line tool
// is not installed": the operator is sent to install software they already
// have, and the actual cause — one wrong environment variable — is never named.
//
// Read without Electron, the same way `menuTemplate.ts` is: the decision is
// pure, and only the call site needs an app.

import { chooseRepoRoot } from '../src/main/repoRoot.ts'

let failures = 0
const ok = (m) => console.log(`  ok   ${m}`)
const fail = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}
const threw = (fn) => {
  try {
    fn()
    return null
  } catch (e) {
    return e.message
  }
}

console.log('where the fabric repository is')

const exists = (set) => (p) => set.includes(p)

{
  const r = chooseRepoRoot({
    fromEnv: '/w/fabric',
    packaged: true,
    appPath: '/A',
    home: '/h',
    exists: exists(['/w/fabric'])
  })
  if (r !== '/w/fabric') fail(`an existing FABRIC_REPO was not used (got ${r})`)
  else ok('an existing FABRIC_REPO wins over everything else')
}

{
  const m = threw(() =>
    chooseRepoRoot({ fromEnv: '/w/gone', packaged: true, appPath: '/A', home: '/h', exists: exists([]) })
  )
  if (!m) fail('FABRIC_REPO pointing at nothing was accepted — ENOENT will be blamed on the CLI')
  else if (!m.includes('/w/gone'))
    fail(`the refusal did not name the path it was told to use: ${m}`)
  else if (!/Cannot locate the fabric repository/.test(m))
    fail(`the refusal is not the one the classifier recognises: ${m}`)
  else ok('FABRIC_REPO pointing at nothing is refused BY NAME, not left to look like a missing CLI')
}

{
  const r = chooseRepoRoot({
    fromEnv: undefined,
    packaged: false,
    appPath: '/repo/apps/desktop',
    home: '/h',
    exists: exists([])
  })
  if (r !== '/repo') fail(`unpackaged should resolve two levels up, got ${r}`)
  else ok('unpackaged, the checkout is two levels above the app path')
}

{
  const r = chooseRepoRoot({
    fromEnv: undefined,
    packaged: true,
    appPath: '/A',
    home: '/h',
    exists: exists(['/h/DATA/fabric'])
  })
  if (r !== '/h/DATA/fabric') fail(`the packaged fallback was not used (got ${r})`)
  else ok('packaged with no variable, the known location is used when it is there')

  const b = chooseRepoRoot({ fromEnv: undefined, packaged: true, appPath: '/A', home: '/h', exists: exists(['/h/DATA/fabric']), bundled: '/data/stack' })
  if (b !== '/data/stack') fail(`the stack the app ships was not preferred (got ${b})`)
  else ok('packaged, the stack project the app ships wins over any checkout')
  const e = chooseRepoRoot({ fromEnv: '/w/fabric', packaged: true, appPath: '/A', home: '/h', exists: exists(['/w/fabric']), bundled: '/data/stack' })
  if (e !== '/w/fabric') fail(`FABRIC_REPO no longer overrides the bundled stack (got ${e})`)
  else ok('an explicit FABRIC_REPO still overrides the bundled stack')

  const m = threw(() =>
    chooseRepoRoot({ fromEnv: undefined, packaged: true, appPath: '/A', home: '/h', exists: exists([]) })
  )
  if (!m) fail('a packaged app with no repository anywhere started regardless')
  else if (!/Set FABRIC_REPO/.test(m)) fail(`the refusal does not say what to do: ${m}`)
  else ok('and with nothing anywhere it refuses, saying what to set')
}

// The classifier must recognise BOTH refusals above — a message the dialog
// cannot place becomes "we do not know why", which is exactly the silence M100
// is about.
const { classifyStartupFailure } = await import('../src/shared/startupFailure.ts')
for (const message of [
  'Cannot locate the fabric repository (needed for the local Supabase stack). FABRIC_REPO is set to /w/gone, and there is nothing there.',
  'Cannot locate the fabric repository (needed for the local Supabase stack). Set FABRIC_REPO.'
]) {
  const c = classifyStartupFailure({ message }).cause
  if (c !== 'repository-not-found') fail(`classified as ${c}, so the dialog would not name the cause`)
  else ok('the dialog names it as a missing repository, not as an unknown failure')
}

console.log(
  failures === 0
    ? '\nall green: the repository is located deliberately, and every refusal it can make is one the dialog can name'
    : `\n${failures} failure(s)`
)
process.exit(failures === 0 ? 0 : 1)
