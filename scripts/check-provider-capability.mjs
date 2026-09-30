// The capability matrix says what it observed, or it fails.
//
// M199.probe. The nine M199 children build account switching and conversation
// continuity on top of two programs Fabric does not ship, and the card's rule is
// that a capability may not read `supported` because somebody's README said so.
// This gate holds the matrix to that:
//
//  1. Every row is well formed: a provider, a pinned CLI build, a runtime, a
//     date, and an evidence reference proportionate to its claim. A `supported`
//     or `unsupported` row names what was observed; an `unverified` row names
//     the test that would settle it.
//  2. Every capability is answered for every pinned build. A missing row and an
//     `unverified` one look the same to a reader and are not the same thing:
//     one is a measurement nobody took, the other is a question nobody asked.
//  3. The pinned builds are the builds INSTALLED. A capability of somebody
//     else's program is a property of its version, so an upgrade returns the
//     rows about it to unverified rather than carrying yesterday's answer.
//     Checked only when the CLI is present — CI has neither.
//
// It reads no credential and runs no login. `--version` is the only thing it
// executes.

import { execFileSync } from 'node:child_process'
import { CAPABILITY_MATRIX, PINNED_BUILDS } from '../apps/desktop/src/shared/providerCapabilityMatrix.ts'
import { receiptProblems } from '../apps/desktop/src/shared/providerCapability.ts'
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const problems = []

// The capability names the contract declares, read from the union type — one
// list, so a row naming a capability the contract does not have is caught
// rather than counted.
const declared = [
  ...readFileSync(root + 'apps/desktop/src/shared/providerCapability.ts', 'utf8').matchAll(/^\s*\|\s*'([a-z-]+)'$/gm)
].map((m) => m[1])
if (declared.length < 3)
  problems.push('could not read the Capability union from providerCapability.ts — this gate has lost its subject')

const pinned = { ...PINNED_BUILDS }
const rows = CAPABILITY_MATRIX
if (!rows.length) problems.push('the matrix is empty')

// ── 1. every row says what it observed ──────────────────────────────────────
const STATUSES = ['supported', 'unsupported', 'unverified']
for (const row of rows) {
  const where = `${row.provider} ${row.cliBuild} / ${row.capability}`
  if (!STATUSES.includes(row.status)) problems.push(`${where}: status ${JSON.stringify(row.status)} is not one of ${STATUSES.join(', ')}`)
  if (declared.length >= 3 && !declared.includes(row.capability))
    problems.push(`${where}: the contract declares no such capability — ${declared.join(', ')}`)
  // ONE rule, and it lives with the type (R-005): the gate would otherwise be a
  // second opinion about what a well-formed receipt is, and the two would drift.
  for (const p of receiptProblems(row)) problems.push(`${where}: ${p}`)
  const evidence = row.evidenceRef.trim()
  if (row.status === 'supported' && /README|documentation|documented|the docs\b/i.test(evidence))
    problems.push(`${where}: claims supported on the strength of documentation, which is the one thing the card forbids`)
}

// ── 2. no silent hole ───────────────────────────────────────────────────────
for (const [provider, build] of Object.entries(pinned))
  for (const capability of declared) {
    const found = rows.filter((r) => r.provider === provider && r.cliBuild === build && r.capability === capability)
    if (found.length === 0)
      problems.push(
        `${provider} ${build}: no row for ${capability}. A missing row reads like an unverified one and is not the same ` +
          `thing — one is a measurement nobody took, the other a question nobody asked.`
      )
    else if (found.length > 1) problems.push(`${provider} ${build}: ${found.length} rows for ${capability}`)
  }

// ── 3. the pinned builds are the installed builds ───────────────────────────
const INSTALLED = {
  'claude-code': ['claude', ['--version'], /([0-9]+\.[0-9]+\.[0-9]+)/],
  'codex-cli': ['codex', ['--version'], /([0-9]+\.[0-9]+\.[0-9]+)/]
}
const notes = []
for (const [provider, build] of Object.entries(pinned)) {
  const spec = INSTALLED[provider]
  if (!spec) {
    notes.push(`${provider}: no way to read an installed version is declared, so ${build} is taken on trust`)
    continue
  }
  const [bin, args, re] = spec
  let out
  try {
    out = execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20_000 })
  } catch {
    notes.push(`${provider}: not installed here, so the matrix's ${build} rows could not be checked against a build`)
    continue
  }
  const found = (out.match(re) ?? [])[1]
  if (!found) notes.push(`${provider}: \`${bin} ${args.join(' ')}\` printed no version, so ${build} could not be checked`)
  else if (found !== build)
    problems.push(
      `${provider}: the matrix describes ${build} and ${found} is installed. A capability of somebody else's program ` +
        `is a property of its version — re-run the probes and re-pin, rather than carrying yesterday's answer forward.`
    )
  else notes.push(`${provider} ${build} is the installed build`)
}

for (const n of notes) console.log('  ok   ' + n)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' provider-capability problem(s)')
  process.exit(1)
}
const byStatus = STATUSES.map((s) => `${rows.filter((r) => r.status === s).length} ${s}`).join(', ')
console.log(`provider capability: ${rows.length} rows over ${Object.keys(pinned).length} pinned builds — ${byStatus}, each naming what was observed`)
