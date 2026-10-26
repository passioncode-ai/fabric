#!/usr/bin/env node
// The migration-order gate (CO-199): supabase/migrations/ against supabase/migration-ledger.json.
// Rules and why: scripts/lib/migration-ledger.mjs.
//
//   node scripts/check-migration-order.mjs                 check; exit 1 naming each problem
//   node scripts/check-migration-order.mjs --base <ref>    also: the ledger at <ref> is a prefix of this one
//   node scripts/check-migration-order.mjs --record        append new files that sort after the newest, then check
//   node scripts/check-migration-order.mjs --history       also: every commit that changed the ledger kept the one before
//                                                          it as a prefix (CO-342), and this tree keeps HEAD's
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { historyProblems, ledgerProblems, recordNew } from './lib/migration-ledger.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'supabase', 'migrations')
const LEDGER = path.join(ROOT, 'supabase', 'migration-ledger.json')
const argv = process.argv.slice(2)
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).map((name) => ({ name, text: readFileSync(path.join(DIR, name), 'utf8') }))
let ledger
try { ledger = JSON.parse(readFileSync(LEDGER, 'utf8')) } catch (e) { console.error(`FAIL migration order: ${LEDGER} could not be read: ${e.message}`); process.exit(1) }

if (argv.includes('--record')) {
  try { ledger = recordNew({ files, ledger }) } catch (e) { console.error(`FAIL migration order: ${e.message}`); process.exit(1) }
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n')
}

let base = null
const at = argv.indexOf('--base')
if (at >= 0) {
  const ref = argv[at + 1]
  if (!ref) { console.error('usage: --base <ref>'); process.exit(2) }
  try {
    base = JSON.parse(execFileSync('git', ['-C', ROOT, 'show', `${ref}:supabase/migration-ledger.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
  } catch {
    // Not silence: said, and the rest of the gate still runs. A base older than the ledger has nothing to compare.
    console.log(`NOT_CHECKED migration order: ${ref} has no supabase/migration-ledger.json to be a prefix of this one`)
  }
}

const problems = ledgerProblems({ files, ledger, base })

// CO-342: the ledger's history on this branch, oldest first, then the working tree. A clone without the history (a
// shallow checkout) says so and checks what it has.
let history = 0
if (argv.includes('--history')) {
  const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const commits = git('log', '--first-parent', '--format=%H', '--', 'supabase/migration-ledger.json').trim().split('\n').filter(Boolean).reverse()
    const steps = []
    for (const c of commits) {
      try { steps.push({ commit: c.slice(0, 8), ledger: JSON.parse(git('show', `${c}:supabase/migration-ledger.json`)) }) } catch { /* a commit that removed it: nothing to compare */ }
    }
    steps.push({ commit: 'the working tree', ledger })
    history = steps.length
    problems.push(...historyProblems(steps))
  } catch (e) {
    console.log(`NOT_CHECKED migration order: the ledger's history could not be read (${String(e.message).split('\n')[0]})`)
  }
}
if (problems.length) {
  for (const p of problems) console.error(`FAIL migration order: ${p}`)
  process.exit(1)
}
console.log(`PASS migration order: ${ledger.migrations.length} applied migration(s) recorded in merge order with their bytes; nothing sorts below ${ledger.migrations.at(-1)?.file ?? 'the start'}${base ? '; the base ledger is a prefix' : ''}${history ? `; ${history} ledger versions in history, each a prefix of the next` : ''}`)
