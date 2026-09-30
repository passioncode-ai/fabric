#!/usr/bin/env node
// The corpus is a record of what actually broke here (M176).
//
// THE INVARIANT: "fixture seeds cover previous implementation defects, not
// tests asserting constants". A corpus written from imagination measures
// imagination — it will be green on the day something real ships, because
// nothing in it came from a real failure.
//
// So every fixture names the work that found and fixed the defect it seeds, and
// this script RESOLVES that name against the register. A fixture citing work
// this repository never did is a fixture somebody invented, and it fails here
// rather than sitting in the corpus looking like evidence.
//
// AND EVERY GATE MUST BE SEEDED. A hard violation the evaluator knows about and
// no fixture exercises is a gate nobody has watched fire — the same rule the
// planted-defect discipline applies to tests, applied to the eval itself.

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = new URL('..', import.meta.url).pathname
const CORPUS = 'apps/desktop/src/shared/managerCorpus.ts'
const EVAL = 'apps/desktop/src/shared/managerEval.ts'
const REGISTER = 'docs/evidence/backlog.md'

const corpus = readFileSync(CORPUS, 'utf8')
const evaluator = readFileSync(EVAL, 'utf8')
const register = readFileSync(REGISTER, 'utf8')

const problems = []

// ——— every fixture names work that exists
const seeds = [...corpus.matchAll(/seeds:\s*'([^']+)'/g)].map((m) => m[1])
if (seeds.length === 0) problems.push(`${CORPUS}  no fixture declares what it seeds`)

// BOTH registers. The queue names the foundation nodes (`work-s03-boundary`),
// and the milestone table names everything delivered before them (`| M124 |`).
// A seed is legitimate if either records it — reading only the first would
// refuse a fixture seeded from a defect that predates the queue, which is most
// of what this repository has actually fixed.
const anchors = new Set(
  [...register.matchAll(/<a id="work-([a-z0-9.-]+)"><\/a>/g)].map((m) => m[1].toLowerCase())
)
for (const m of register.matchAll(/^\|\s*(M\d+)\s*\|/gm)) anchors.add(m[1].toLowerCase())
for (const seed of new Set(seeds)) {
  const key = seed.toLowerCase().replace(/\./g, '-')
  if (!anchors.has(key) && !anchors.has(seed.toLowerCase()))
    problems.push(
      `${CORPUS}  a fixture seeds "${seed}", which has no row in ${REGISTER} — ` +
        `a corpus entry citing work this repository never did is one somebody invented`
    )
}

// ——— every hard violation is seeded by something
const block = /export const HARD_VIOLATIONS = \[([\s\S]*?)\] as const/.exec(evaluator)
if (!block) problems.push(`${EVAL}  HARD_VIOLATIONS is not where this gate can read it`)
const declared = new Set(block ? [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : [])
const forbidden = new Set(
  [...corpus.matchAll(/forbidden:\s*\[([^\]]*)\]/g)].flatMap((m) =>
    [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])
  )
)
for (const kind of declared)
  if (!forbidden.has(kind))
    problems.push(
      `${EVAL}  the evaluator knows "${kind}" and no fixture seeds it — a gate nobody has watched fire`
    )

// ——— the report may not become a permission
//
// WIDENED AT AX-09, and the reason is that card's own finding: it constrains a
// manager/settlement activation path that DOES NOT EXIST — `ModelPort`,
// "settlement" and "failover" appear in zero files — so its only durable
// content is this constraint, applied to a module nobody has written yet. The
// rule read ONE hard-coded path, so the day a `managerActivation.ts` appears it
// would be governed by nothing.
//
// COVERAGE, stated rather than implied: every `apps/desktop/src/shared/manager*.ts`
// — two files today, `managerEval.ts` and `managerCorpus.ts` — matched by the
// name of an exported function. It cannot see a grant written as a method, as a
// const arrow, or in a module named otherwise; it is a fence over the family
// this doctrine is about, not a proof about the product.
const scored = readdirSync(path.join(root, 'apps/desktop/src/shared'))
  .filter((f) => /^manager.*\.ts$/.test(f) && !f.includes('.test.'))
  .map((f) => ['apps/desktop/src/shared/' + f, readFileSync(path.join(root, 'apps/desktop/src/shared', f), 'utf8')])
for (const [where, text] of scored)
  for (const m of text.matchAll(/export function ([A-Za-z]+)/g))
    if (/activate|permit|allow|grant|promote/i.test(m[1]))
      problems.push(
        `${where}  \`${m[1]}\` turns a verdict into permission. A score that can grant is a score somebody will move instead of being safe.`
      )

// ——— AND EVERY CRITERION MUST BE ASKED, not merely seeded.
//
// The step beyond "every gate is seeded", and the one AX-10 measured missing:
// every criterion in the evaluator is guarded by the presence of its own
// evidence, so a trajectory carrying none of those fields produces no violation
// and PASSES. A corpus whose trajectories are thin would therefore report a
// clean run over questions nobody put — which is what a real tool trace does
// today, since `toolTrace.ts` records transport outcome and ids and nothing
// else. This RUNS the corpus and refuses a run whose report names an unasked
// criterion.
const { CORPUS: entries } = await import('../apps/desktop/src/shared/managerCorpus.ts')
const { evaluateTrajectory, reportOf } = await import('../apps/desktop/src/shared/managerEval.ts')
const report = reportOf(
  entries.flatMap((e) => [
    evaluateTrajectory(e.fixture, e.clean),
    evaluateTrajectory(e.fixture, e.seeded)
  ]),
  'gate'
)
if (report.unaskedCriteria.length)
  problems.push(
    `${CORPUS}  the corpus never asks ${report.unaskedCriteria.join(', ')} — no trajectory in it carries ` +
      `the evidence those criteria read, so a clean run would be clean about a question nobody put`
  )

if (problems.length) {
  console.error(`eval: ${problems.length} problem(s) with the conformance corpus\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(
  `eval: ${new Set(seeds).size} fixture(s), each seeding work the register names; ` +
    `all ${declared.size} hard violation(s) seeded and ASKED by a trajectory; no verdict grants permission`
)
