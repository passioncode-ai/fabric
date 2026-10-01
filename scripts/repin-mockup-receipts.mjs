#!/usr/bin/env node
// Re-review a mockup receipt whose file moved, and re-pin only if the CLAIM
// still holds.
//
// WHY THIS IS A SCRIPT AND NOT A HABIT. `resolution-matrix.json` pins a SHA-256
// of every evidence file, and each receipt's claim is about one cited line —
// `docs/evidence/backlog.md:656 | M131 |`, say. Any unrelated edit anywhere else
// in that file invalidates the digest, so on a repository where the ledgers are
// touched every iteration the gate fires constantly, and the response becomes a
// mechanical re-pin. A digest re-pinned without reading anything is a ritual
// wearing a check's clothes: it reports "reviewed" about a review that did not
// happen.
//
// So this does the review the digest stands for, and refuses when it cannot.
// The claim is that the CITED LINE says what it said. If that line is unchanged
// against the committed version, the receipt is re-pinned and what happened is
// printed. If the line itself moved, nothing is written: that is a real
// re-review, and it belongs to a person.
//
// Usage: node scripts/repin-mockup-receipts.mjs [--check]
//   --check  report what is stale and exit 1; write nothing.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { locateClaim } from './lib/public-history.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MATRIX = path.join(ROOT, 'docs/evidence/plans/2026-09-07-mockup-completeness/resolution-matrix.json')
const checkOnly = process.argv.includes('--check')

const raw = readFileSync(MATRIX, 'utf8')
const matrix = JSON.parse(raw)
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

const committed = (file) => {
  try {
    return execFileSync('git', ['show', `HEAD:${file}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

const stale = []
for (const row of matrix.rows ?? [])
  for (const receipt of row.evidence ?? []) {
    if (!receipt.sha256) continue
    const bytes = readFileSync(path.join(ROOT, receipt.file))
    const now = sha(bytes)
    if (now !== receipt.sha256) stale.push({ row: row.id, receipt, now, bytes })
  }

if (!stale.length) {
  console.log('receipts: every pinned mockup source is byte-identical to its reviewed version')
  process.exit(0)
}

let text = raw
const refused = []
const repinned = []
for (const { row, receipt, now } of stale) {
  const before = committed(receipt.file)
  const after = readFileSync(path.join(ROOT, receipt.file), 'utf8')
  const line = receipt.line
  const beforeLines = before === null ? [] : before.split('\n')
  const afterLines = after.split('\n')
  // THE CLAIM IS THE ROW, NOT ITS POSITION (2026-09-12). This compared line N of
  // the committed file with line N of the working one, so ANY insertion above a
  // citation refused — and a refusal that fires on a pure insertion is one that
  // gets worked around by hand, which is the opposite of what it is for. A
  // moved claim and an edited claim are now told apart by CONTENT: the cited
  // text is looked for, and a single unambiguous match is a move.
  let cited = line > 0 && line <= beforeLines.length ? beforeLines[line - 1] : null
  let named = cited !== null && (!receipt.symbol || cited.includes(receipt.symbol))
  // A LINE NUMBER CAN GO STALE INSIDE HEAD, not only between HEAD and the working
  // tree (2026-09-12). This read the cited text at the recorded line of the COMMITTED
  // file, so once a previous commit had moved the row, the recorded line named some
  // OTHER row and every later change refused — with a message about an edited claim,
  // about a claim nobody had edited. The symbol is what names the row; fall back to it,
  // and only when it appears exactly once, because two matches cannot say which one
  // the reviewer read.
  if (!named && receipt.symbol) {
    const inCommitted = beforeLines.flatMap((text, i) => (text.includes(receipt.symbol) ? [i] : []))
    if (inCommitted.length === 1) { cited = beforeLines[inCommitted[0]]; named = true }
  }
  let movedTo = null
  let claimHolds = false
  if (named) {
    // Exactly one. Two identical lines cannot say which one the reviewer read,
    // and guessing is the confident answer this receipt exists to prevent. The
    // rule is shared with repin-public-history.mjs, so the two cannot drift.
    const found = locateClaim(afterLines, [cited], line)
    if (found.line) {
      claimHolds = true
      if (found.moved) movedTo = found.line
    }
  }

  if (!claimHolds) {
    refused.push(`${row}: ${receipt.file}:${line} — the CITED LINE changed. Re-read the claim; this does not re-pin it.`)
    continue
  }
  repinned.push(
    movedTo === null
      ? `${row}: ${receipt.file}:${line} (${receipt.symbol ?? 'no symbol'}) unchanged — ${receipt.sha256.slice(0, 12)} → ${now.slice(0, 12)}`
      : `${row}: ${receipt.file} (${receipt.symbol ?? 'no symbol'}) MOVED ${line} → ${movedTo}, text unchanged — ${receipt.sha256.slice(0, 12)} → ${now.slice(0, 12)}`
  )
  // Written on the PARSED receipt, not by replacing text (2026-09-12). Two things were
  // wrong with the textual swap. A moved `line` was mutated on the parsed object and then
  // discarded, because the file written back was a FRESH parse of the string — SRC-02 was
  // reported "MOVED 658 → 671" and stayed at 658, so the next change refused for the same
  // reason all over again. And several receipts citing ONE file legitimately share its
  // digest, which made a blind single replace ambiguous and refused normal work by hand.
  if (movedTo !== null) receipt.line = movedTo
  if (!checkOnly) receipt.sha256 = now
}

for (const r of repinned) console.log((checkOnly ? '  would re-pin  ' : '  re-pinned     ') + r)
for (const r of refused) console.error('  REFUSED       ' + r)

// A round-trip of this file is byte-stable (verified 2026-09-12 against HEAD), so writing
// the parsed object back is the same bytes plus the digests and lines this run verified.
if (!checkOnly && repinned.length && !refused.length)
  writeFileSync(MATRIX, JSON.stringify(matrix, null, 2) + '\n')
process.exit(refused.length || checkOnly ? 1 : 0)
