// A capability is `supported` only after a run nobody can fake.
//
// M199.acceptance. The card says two things this gate makes mechanical:
// "without test accounts or capability evidence the status stays not executed,
// not passed", and "fixture tests alone cannot pass acceptance". Those are
// sentences in a document until something refuses.
//
// So: every capability row claiming `supported` for a provider CLI must have an
// acceptance receipt behind it, and a receipt only exists where a run happened.
// The rows measured by observation — an identity reader answering, a keychain
// item being where it is — are a different kind of claim and are named here as
// such, because conflating them would either block honest measurements or wave
// through the one claim that needs a live run: that a conversation CONTINUED.
//
// It reads files. It runs nothing and needs no network.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { cell } from './lib/markdown-table.mjs'
import { dispositionOf } from './lib/disposition.mjs'

const root = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(path.join(root, p), 'utf8')

const problems = []
const notes = []

// ── the capabilities that need a LIVE RUN, not an observation ───────────────
//
// `native-resume-ack` is the one: everything else in the matrix is answered by
// asking the installed CLI a question, and this one is answered only by
// switching an account and finding the conversation still there.
const NEEDS_ACCEPTANCE = ['native-resume-ack']

const matrix = read('apps/desktop/src/shared/providerCapabilityMatrix.ts')
const rows = [
  ...matrix.matchAll(
    /provider:\s*'([^']+)',\s*cliBuild:\s*'([^']+)',[\s\S]*?capability:\s*'([^']+)',\s*status:\s*'([^']+)'/g
  )
].map((m) => ({ provider: m[1], cliBuild: m[2], capability: m[3], status: m[4] }))

if (!rows.length) problems.push('no capability rows parsed — this gate has lost its subject')

// ── where a receipt would live ──────────────────────────────────────────────
const RECEIPTS = 'docs/evidence/acceptance'
const receipts = existsSync(path.join(root, RECEIPTS))
  ? readdirSync(path.join(root, RECEIPTS))
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ file: f, body: JSON.parse(read(path.join(RECEIPTS, f))) }))
  : []

notes.push(
  receipts.length
    ? `${receipts.length} acceptance receipt(s) on disk`
    : 'no acceptance receipts on disk, which is the state without authorised test accounts'
)

for (const row of rows) {
  if (!NEEDS_ACCEPTANCE.includes(row.capability)) continue
  const where = `${row.provider} ${row.cliBuild} / ${row.capability}`
  if (row.status !== 'supported') {
    notes.push(`${where} is ${row.status}, which needs no acceptance receipt`)
    continue
  }
  const receipt = receipts.find(
    (r) => r.body.provider === row.provider && r.body.cliBuild === row.cliBuild
  )
  if (!receipt) {
    problems.push(
      `${where} claims \`supported\` and no acceptance receipt names that build. This capability is answered only ` +
        `by switching an account and finding the conversation still there — fixture tests alone cannot pass it.`
    )
    continue
  }
  if (receipt.body.outcome !== 'passed')
    problems.push(`${where} claims \`supported\` and its receipt says ${receipt.body.outcome}`)
  else if (!Array.isArray(receipt.body.independentObservations) || !receipt.body.independentObservations.length)
    problems.push(
      `${where}: the receipt passed with no independent observation. Reading Fabric's own transcript proves what ` +
        `Fabric recorded, not that the provider restored the conversation.`
    )
  else if (!Array.isArray(receipt.body.negativeControls) || !receipt.body.negativeControls.length)
    problems.push(`${where}: the receipt passed with no negative control, so nothing was shown to be refused`)
  else notes.push(`${where} is supported, and ${receipt.file} carries the run behind it`)
}

// ── CO-112 may be closed only by a measured boundary ───────────────────────
const carryover = read('docs/evidence/specs/2026-08-16-software-fabric-carryover.md')
const co112 = carryover.split('\n').find((l) => l.startsWith('| CO-112 |'))
if (!co112) problems.push('CO-112 has no row — this gate has lost half its subject')
else {
  // THE DECLARED VOCABULARY, not a regex of my own. CO-112's status cell reads
  // `open — nine M199 tasks are in the current queue, …`: a token followed by
  // prose, which is exactly the shape FA-10 made readable. A second opinion
  // about what "settled" means would drift from the register's own counter.
  const disposition = dispositionOf(cell(co112, 7))
  if (!disposition) problems.push(`CO-112 carries a disposition nobody declared: ${JSON.stringify(cell(co112, 7).slice(0, 40))}`)
  const settled = disposition ? !disposition.carries : false
  const hasPassed = receipts.some((r) => r.body.outcome === 'passed')
  if (settled && !hasPassed)
    problems.push(
      'CO-112 is marked settled and no acceptance receipt has passed. Its own row says it closes only by a measured ' +
        'boundary, and the boundary is an acceptance run rather than an implementation.'
    )
  else notes.push(settled ? 'CO-112 is settled and a passing receipt exists' : 'CO-112 is open, which matches the evidence')
}

// ── the packet's own status must not read `passed` either ───────────────────
const packet = read('docs/audit/2026-09-09-final/packets/M199.acceptance.md')
const status = packet.match(/^#{3,4} acceptance_status\n([^\n]*)$/m)?.[1]?.trim()
if (!status)
  // The heading level moved once already while this gate was being written, and
  // a status it cannot read is a status it cannot check.
  problems.push('the acceptance packet\'s status field could not be read — this gate has lost part of its subject')
else if (/passed/.test(status) && !receipts.some((r) => r.body.outcome === 'passed'))
  problems.push(`the acceptance packet says \`${status}\` and no receipt has passed`)
else notes.push(`the acceptance packet reads \`${status}\``)

for (const n of notes) console.log('  ok   ' + n)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' acceptance problem(s)')
  process.exit(1)
}
console.log(
  'acceptance: no capability claims a live-run status without a run behind it, and CO-112 matches the evidence'
)
