#!/usr/bin/env node
// Private data stays out of this public repository (CO-520; ADR-0096, amendment of 2026-11-06).
//
// The organization's checker (org-index `scripts/check_private.py`) scans every tracked file for a
// term from the operator's local denylist (P1), an e-mail address outside the allowed set (P2), an
// absolute home path (P3) and an account id (P4). Its plain output prints the matched text, and the
// denylist is itself private, so this gate reads only its JSON and prints where each finding is:
// the rule, file:line and the fingerprint `.check-private-allow` takes for a reviewed synthetic one.
// The matched text is never printed.
//
// The checker and the denylist live on the operator's machine, not in this repository. Where either
// is missing (a contributor's clone, hosted CI) the gate says NOT_RUN and passes, unless --require
// is given, which a pre-push hook on the operator's machine passes.
//
//   node scripts/check-private.mjs [--require]
//   PASSIONCODE_CHECK_PRIVATE=<checker.py>  PASSIONCODE_PRIVATE_TERMS=<denylist>  override the lookup

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const required = process.argv.includes('--require')

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

const root = git('rev-parse', '--show-toplevel')

function findChecker() {
  if (process.env.PASSIONCODE_CHECK_PRIVATE) return process.env.PASSIONCODE_CHECK_PRIVATE
  // org-index sits beside the main clone; a worktree finds the main clone through its common dir.
  const common = path.resolve(root, git('rev-parse', '--git-common-dir'))
  const candidates = [
    path.join(path.dirname(common), '..', 'org-index', 'scripts', 'check_private.py'),
    path.join(root, '..', 'org-index', 'scripts', 'check_private.py'),
  ]
  return candidates.find((c) => existsSync(c)) ?? null
}

const checker = findChecker()
const terms = process.env.PASSIONCODE_PRIVATE_TERMS ?? path.join(homedir(), '.config', 'passioncode', 'private-terms.txt')

function notRun(why) {
  console.log(`check-private: NOT_RUN: ${why}; nothing was checked`)
  process.exit(required ? 2 : 0)
}

if (!checker || !existsSync(checker)) notRun('no org-index checker (scripts/check_private.py beside this clone)')
if (!existsSync(terms)) notRun('no local denylist')

const run = spawnSync('python3', [checker, root, '--json', '--terms', terms], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
})
if (run.error) notRun(`the checker did not start (${run.error.code ?? 'error'})`)

let report
try {
  report = JSON.parse(run.stdout)
} catch {
  // Its stdout may hold matched text; say only that it was not the JSON this gate reads.
  console.log(`check-private: FAIL: the checker exited ${run.status} without a JSON report`)
  process.exit(1)
}

const findings = Array.isArray(report.findings) ? report.findings : []
const stale = Array.isArray(report.stale_allow_entries) ? report.stale_allow_entries : []
for (const f of findings) console.log(`FINDING ${f.rule} ${f.file}:${f.line}  [${f.fingerprint}]`)
for (const e of stale) console.log(`STALE .check-private-allow entry matches nothing: ${e}`)
const byRule = {}
for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1
const counts = Object.entries(byRule).map(([r, n]) => `${r} ${n}`).join(', ')
if (findings.length || stale.length) {
  console.log(`check-private: FAIL: ${findings.length} finding(s)${counts ? ` (${counts})` : ''}, ${stale.length} stale allow entr(ies). ` +
    'Remove the private text; a reviewed synthetic P2/P3/P4 goes into .check-private-allow by its fingerprint (P1 never does)')
  process.exit(1)
}
console.log('check-private: PASS: no private data in the tracked files')
