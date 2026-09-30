// No shipped path pays for inference (UX28-12).
//
// UX28-12's negative acceptance says the no-provider path "makes no hidden paid
// call". Measured 2026-09-10, it holds — and it holds VACUOUSLY: nothing in
// `apps/desktop/src` calls a model at all. `main/quota.ts` reaches
// `api.anthropic.com/api/oauth/usage`, which reads what has already been spent
// and is FA-03's subject; `shared/redact.ts` merely knows what an API key looks
// like so it can hide one.
//
// A truth that holds because a feature is absent is worth a gate rather than a
// verification row. The eight milestones this card depends on (M153, M158,
// M166, M167, M169, M171, M175, M194) are all unshipped, and they are exactly
// the work that will introduce the first model call: a ModelPort, a provider
// router with a shared attempt budget, and model-usage accounting. On the day
// somebody writes that call, it must go through those — not into whatever
// module needed an answer. This gate is what makes the difference between
// "designed to route through the router" and "routed through the router".
//
// IT ALSO REFUSES WHEN IT LOSES ITS SUBJECT, the same way
// `check-coverage-reads.mjs` does. If a ModelPort appears, this gate's premise
// has changed and it must be rewritten in that same change to check the
// ROUTING rather than the absence — silently passing would leave a gate whose
// name still promises something it no longer looks at.
//
// It reads files. It runs nothing, reaches no network, and reads no credential.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const SRC = path.join(root, 'apps/desktop/src')

/** Endpoints and SDKs that BILL for a generated token. */
const INFERENCE = [
  { name: 'anthropic messages', re: /api\.anthropic\.com\/v1\/(messages|complete)/ },
  { name: 'openai completions', re: /api\.openai\.com\/v1\/(chat\/)?completions/ },
  { name: 'openrouter', re: /openrouter\.ai\/api/ },
  { name: 'anthropic sdk', re: /from\s+['"]@anthropic-ai\/sdk['"]/ },
  { name: 'openai sdk', re: /from\s+['"]openai['"]/ },
  { name: 'vercel ai sdk', re: /from\s+['"]ai['"]/ }
]

/**
 * The one allowed reach, by its EXACT path.
 *
 * Not by host: `api.anthropic.com` also serves the inference endpoint, so
 * allowing the host would allow the thing this gate exists to refuse.
 */
const ALLOWED = [{ file: 'apps/desktop/src/main/quota.ts', url: 'https://api.anthropic.com/api/oauth/usage' }]

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full)
  }
}
walk(SRC)

const problems = []
const notes = []
let scanned = 0

for (const file of files) {
  const where = path.relative(root, file)
  const text = readFileSync(file, 'utf8')
  scanned++
  text.split('\n').forEach((raw, i) => {
    // COMMENTS FIRST. This gate's own subject is discussed in prose in several
    // modules, and a gate that cannot survive being described is a gate nobody
    // may write about.
    if (/^\s*(\/\/|\*|\/\*)/.test(raw)) return
    for (const { name, re } of INFERENCE) {
      if (!re.test(raw)) continue
      if (ALLOWED.some((a) => a.file === where && raw.includes(a.url))) return
      problems.push(
        `${where}:${i + 1} reaches ${name}. UX28-12's negative acceptance is that no path makes a ` +
          `hidden paid call, and the provider router (M169), the ModelPort (M167) and model-usage ` +
          `accounting (M171) are where a model call belongs. If this IS that work, rewrite this gate ` +
          `in the same change to check the routing instead of the absence.`
      )
    }
  })
}

// The subject check: has the work that changes this gate's premise arrived?
const port = files.filter((f) => /ModelPort|modelPort/.test(readFileSync(f, 'utf8')))
if (port.length)
  problems.push(
    `a ModelPort now exists (${port.map((f) => path.relative(root, f)).join(', ')}), so this gate has ` +
      `lost its subject: it checks that NO model call exists, and the question has become whether ` +
      `every model call goes through the port and its usage accounting. Rewrite it in this change ` +
      `and say what it now proves.`
  )

notes.push(`${scanned} source file(s) scanned for a billed inference call`)
notes.push(`${ALLOWED.length} allowed reach: the usage read FA-03 covers, matched by exact URL`)

for (const n of notes) console.log('  ok   ' + n)
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p)
  console.log('\n' + problems.length + ' path(s) that could bill without a router')
  process.exit(1)
}
console.log('no hidden model call: nothing in the shipped tree pays for inference')
