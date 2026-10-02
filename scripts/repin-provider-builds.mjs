// Re-pin version-only provider rows to the installed CLI builds (REQ-19, 2026-10-03).
// Usage: node --experimental-strip-types scripts/repin-provider-builds.mjs [--check]
//   --check  print what would change and exit 1 when a re-pin is due; writes nothing.
// Refuses (exit 2) when a current row holds a verified verdict: then the probes must be re-run.
// Runs `--version` and nothing else; reads no credential and performs no login.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { CAPABILITY_MATRIX, PINNED_BUILDS } from '../apps/desktop/src/shared/providerCapabilityMatrix.ts'
import { repinSource } from './lib/repin-provider-builds.mjs'

const FILE = new URL('../apps/desktop/src/shared/providerCapabilityMatrix.ts', import.meta.url)
const INSTALLED = { 'claude-code': 'claude', 'codex-cli': 'codex' }
const measured = {}
for (const [provider, bin] of Object.entries(INSTALLED)) {
  try {
    const v = (execFileSync(bin, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20_000 }).match(/([0-9]+\.[0-9]+\.[0-9]+)/) ?? [])[1]
    if (v) measured[provider] = v
    else console.log(`  skip ${provider}: \`${bin} --version\` printed no version`)
  } catch {
    console.log(`  skip ${provider}: not installed here`)
  }
}
// The local calendar day: an observation made after midnight here is that day's, not UTC's.
const d = new Date()
const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const r = repinSource(readFileSync(FILE, 'utf8'), { pinned: { ...PINNED_BUILDS }, rows: CAPABILITY_MATRIX }, measured, today)
if (!r.ok) { console.error('refused: ' + r.reason); process.exit(2) }
if (!r.changed.length) { console.log('provider builds: the pins match the installed builds'); process.exit(0) }
if (process.argv.includes('--check')) { console.log('re-pin due: ' + r.changed.join('; ')); process.exit(1) }
writeFileSync(FILE, r.source)
console.log('re-pinned: ' + r.changed.join('; ') + ` (checkedAt ${today}); every current row stays unverified`)
