#!/usr/bin/env node
// One word, one meaning (S10 · ADR-0045).
//
// WHAT WENT WRONG WITHOUT THIS. ADR-0030 defined **Run** as one execution of one
// graph. ADR-0042 defined it as a session bound to a task. Both were accepted,
// both stood, and `CONTEXT.md` — the glossary the whole product reasons from —
// carried only the first. Nothing was broken and nothing was checkable: two
// documents each correct alone, and the noun underneath every progress surface
// meaning two things.
//
// The same file also BANNED the bare word "Task" while the schema grew
// `project_tasks`, a state ladder, a permission table and a whole surface on it.
// A glossary that forbids the word its own schema is built on is worse than no
// glossary: it teaches people to skip the parts that are still true.
//
// So the vocabulary gets a gate, for the same reason the estate predicate did
// (ADR-0049): a boundary held by a convention is held until somebody is busy.

import { readFileSync } from 'node:fs'
import { cell as tableCell } from './lib/markdown-table.mjs'

const CONTEXT = 'CONTEXT.md'
const CONTRACT = 'docs/architecture/system-contract.md'

/**
 * Terms the identity contract names that the glossary deliberately does NOT yet
 * define, each with the card that will introduce it.
 *
 * An allowlist with a reason per row, not a silence: the glossary describes what
 * the product HAS, and a noun defined before anything can carry it is a promise
 * wearing the clothes of a definition. Removing a card from this list without
 * defining its term fails here, which is the point.
 */
const NOT_YET = {
  ManagerInvocation: 'M194 — the manager seat is a binding; nothing invokes one yet',
  Checkpoint: 'M188 — plan steps and their verdicts arrive with the run model',
  ExecutionSnapshot: 'M188 — no execution is resumable yet, so nothing is snapshotted'
}

const context = readFileSync(CONTEXT, 'utf8')
const contract = readFileSync(CONTRACT, 'utf8')
const problems = []

// ————————————————————————————————————————————————— what the glossary defines
const defined = new Map()
for (const line of context.split('\n')) {
  const m = /^\*\*([A-Za-z][A-Za-z .]*?)\*\* — /.exec(line)
  if (!m) continue
  const term = m[1].trim()
  if (defined.has(term)) problems.push(`${CONTEXT}: "${term}" is defined twice`)
  defined.set(term, line)
}
if (defined.size < 20) problems.push(`${CONTEXT}: only ${defined.size} terms parsed — the parser found nothing to check`)

// ————————————————————————————————————————————————— what the contract names
const identity = []
let inTable = false
for (const line of contract.split('\n')) {
  if (line.startsWith('| Термин | Идентификатор')) {
    inTable = true
    continue
  }
  if (inTable) {
    if (!line.startsWith('|')) break
    // One parser (FA-05): an escaped pipe is a character in a cell, not a
    // column boundary, and three scripts each split rows their own way.
    const cell = tableCell(line, 1).trim()
    if (cell && cell !== '---') identity.push(cell)
  }
}
if (identity.length < 5) problems.push(`${CONTRACT}: the identity table did not parse`)

for (const term of identity) {
  if (defined.has(term)) {
    if (NOT_YET[term])
      problems.push(
        `"${term}" is defined in ${CONTEXT} and still listed as not-yet in check-vocabulary.mjs — remove the exemption`
      )
    continue
  }
  if (!NOT_YET[term])
    problems.push(
      `${CONTRACT} names "${term}" as an identity and ${CONTEXT} does not define it. ` +
        `Define it, or add it to NOT_YET with the card that will introduce it.`
    )
}

// ————————————————————————————————————————————————— a ban and a definition
// The exact contradiction S10 was filed for: the same word forbidden below and
// defined above. A struck-through entry is a RETIRED ban and is exempt.
const banned = context.slice(context.indexOf('## Terms deliberately NOT used'))
for (const line of banned.split('\n')) {
  const m = /^- (~~)?\*\*"([^"]+)"\*\*/.exec(line)
  if (!m || m[1]) continue
  if (defined.has(m[2]))
    problems.push(
      `${CONTEXT}: "${m[2]}" is both defined above and banned below. ` +
        `Retire the ban with ~~strikethrough~~ and say why, or drop the definition.`
    )
}

if (problems.length) {
  console.error(`vocabulary: ${problems.length} problem(s)\n`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}

console.log(
  `vocabulary: ${defined.size} terms defined once each; ` +
    `${identity.length} contract identities, ${Object.keys(NOT_YET).length} of them deliberately not yet defined`
)
