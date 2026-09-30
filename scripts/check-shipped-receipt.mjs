#!/usr/bin/env node
// A row that says shipped names what proves it, or says what is missing (FA-05).
//
// MEASURED 2026-09-10: 113 rows in the queue say `**shipped**` and 25 of them
// name a verification REQ, point at the verification ledger, or declare what is
// not done. The other 88 say shipped and stop. The audit put it more sharply:
// "44 shipped rows contain explicit gaps, and the detailed catalogue remains a
// target spec."
//
// THIS GATE DOES NOT FAIL ON THOSE 88, and that is deliberate. A gate switched on
// against a backlog it fails is a gate somebody turns off within a day, and the
// 88 need reading one at a time — some are foundations genuinely delivered, some
// are consumers never wired, and only a person reading each can say which. They
// leave as a carry-over row with the number, which is the rule this repository
// already has for a deferral.
//
// What it DOES refuse is a row that becomes shipped in THIS change without one.
// The line holds from here rather than retroactively, which is the same shape
// `check-actor.mjs` used when it was turned on: hold the line from before there
// is anything to untangle.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cell } from './lib/markdown-table.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const QUEUE = 'docs/evidence/backlog.md'

const rowsOf = (text) => {
  const out = new Map()
  for (const line of text.split('\n')) {
    const id = /^\|\s*(?:<a id="work-[^"]+"><\/a>)?\s*\**([A-Za-z]+\d+(?:\.[A-Za-z0-9]+)?)\**\s*\|/.exec(line)
    if (id) out.set(id[1], line)
  }
  return out
}

/** Does this row say what proves it, or what is missing? */
const carriesEvidence = (row) =>
  /REQ-\d/.test(row) ||
  /verification\.md/.test(row) ||
  /\bpartial\b/i.test(row) ||
  /частичн/i.test(row) ||
  /Названо, (?:а )?не подразумевается/i.test(row) ||
  /[Nn]amed, not implied/.test(row) ||
  /\bNOT BUILT\b/.test(row) ||
  /\bне построен/i.test(row)

const now = rowsOf(readFileSync(path.join(ROOT, QUEUE), 'utf8'))
let before = new Map()
try {
  before = rowsOf(
    execFileSync('git', ['show', `HEAD:${QUEUE}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  )
} catch {
  // No committed queue yet. Nothing is "new" against nothing, and the standing
  // count below is still reported.
}

const shipped = (row) => /\*\*shipped/i.test(row)
const problems = []
for (const [id, row] of now) {
  if (!shipped(row)) continue
  const was = before.get(id)
  const becameShipped = !was || !shipped(was)
  if (becameShipped && !carriesEvidence(row))
    problems.push(
      `${id} became shipped in this change and names nothing that proves it. ` +
        `Cite a verification REQ, point at the ledger, or say plainly what is NOT done — ` +
        `"shipped" with no receipt is the word doing the work a measurement should.`
    )
}

const standing = [...now.values()].filter((r) => shipped(r) && !carriesEvidence(r)).length
const total = [...now.values()].filter(shipped).length

if (problems.length) {
  console.error(`shipped: ${problems.length} row(s) claim delivery with nothing behind it\n`)
  for (const p of problems) console.error('  ' + p)
  console.error(
    `\n  (${standing} of ${total} shipped rows carry no receipt today. Those are CO-132 and this gate ` +
      `does not fail on them — it holds the line from here.)`
  )
  process.exit(1)
}

console.log(
  `shipped: every row that became shipped in this change names what proves it. ` +
    `${standing} of ${total} pre-existing shipped rows still carry none (CO-132).`
)
