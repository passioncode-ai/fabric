#!/usr/bin/env node
// PL-8 (0.3.23 review, iteration 2): fails when a script CI runs directly, or any shell script under scripts/, is not
// tracked as executable (100755) in git (`scripts/lib/script-modes.mjs`).
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { directlyRun, modeProblems, modesOf } from './lib/script-modes.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WORKFLOWS = path.join(ROOT, '.github', 'workflows')
const modes = modesOf(execFileSync('git', ['-C', ROOT, 'ls-files', '-s'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))
const run = new Set()
for (const f of readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f)))
  for (const p of directlyRun(readFileSync(path.join(WORKFLOWS, f), 'utf8'))) run.add(p)
const problems = modeProblems(modes, [...run])
if (problems.length) {
  for (const p of problems) console.error(`FAIL script modes: ${p}`)
  process.exit(1)
}
const checked = [...modes.keys()].filter((p) => /^scripts\/[^/]+\.sh$/.test(p)).length
console.log(`PASS script modes: ${checked} shell scripts under scripts/ and ${run.size} path(s) the workflows run directly are executable in git`)
