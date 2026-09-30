// A register with a KNOWN answer, so a second count is evidence.
//
// FA-10's acceptance asks for numbers that are "computed and independently
// counted". Writing a second counter is the obvious reading and it is not
// enough: while measuring this card, three ad-hoc second counts of the live
// registers were wrong before one was right — 1011 rows instead of 969 (header
// rows of tables spelled `| Requirement |` counted as data), then 197
// disagreements instead of zero (the empty cell a trailing pipe leaves, read as
// the status), then the same mistake again. Each would have been reported as a
// register defect, and each was a defect in the auditor.
//
// So the second count is checked the only way a count can be: against a fixture
// small enough to count by hand, carrying every shape that has ever hidden a row
// in this repository — a wide id prefix, a prefix with a digit, an escaped pipe
// inside a cell, two header spellings, a malformed row, and an undeclared
// disposition.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classify, tableRows } from '../lib/registers.mjs'
import { DISPOSITIONS, carriesWork, dispositionOf, tokenOf, vocabulary } from '../lib/disposition.mjs'

// ── the fixture, counted by hand ─────────────────────────────────────────────
//
// Verification tables: 2. Data rows: 6. Well formed: 5. Malformed: 1.
// The five are AB-REQ-001, BRAND-REQ-002, HARNESS-REQ-003, FEED2-REQ-004 and
// X9-REQ-005; the malformed one is `not-an-id`.
const FIXTURE = `# A register

Some prose that is not a table at all.

| REQ | Shipped at | How it is checked | Watched failing? | Last verified | Verified by |
| --- | --- | --- | --- | --- | --- |
| AB-REQ-001 | a | checked | yes | 2026-09-10 | probe |
| BRAND-REQ-002 | a | checked | no | 2026-09-10 | probe |

## A second table, headed differently

| Requirement | Shipped at | How it is checked | Watched failing? | Last verified | Verified by |
|---|---|---|---|---|---|
| HARNESS-REQ-003 | a | a pipe \\| inside a cell | no | 2026-09-10 | probe |
| FEED2-REQ-004 | a | checked | YES — watched | 2026-09-10 | probe |
| X9-REQ-005 | a | checked | no | 2026-09-10 | probe |
| not-an-id | a | checked | yes | 2026-09-10 | probe |

| Something | else | entirely |
|---|---|---|
| this table | is not | a register |
`

const isVerificationHeader = (c) => /^(REQ|Requirement)$/i.test(String(c[0] ?? '').trim())
const REQ_ID = /^[A-Za-z][A-Za-z0-9]*-REQ-\d+\w*$/

test('every data row of a declared table is found, whatever the header says', () => {
  const rows = tableRows(FIXTURE, isVerificationHeader)
  assert.equal(rows.length, 6, 'six data rows across the two verification tables')
})

test('a table this register does not declare is not counted', () => {
  const rows = tableRows(FIXTURE, isVerificationHeader)
  assert.ok(!rows.some((r) => r.cells[0] === 'this table'))
})

test('a header row is never counted as data', () => {
  // The mistake that produced 1011 rows for a 969-row register: the second
  // table's header says `Requirement`, and a reader filtering out `| REQ` saw
  // it as a row.
  const rows = tableRows(FIXTURE, isVerificationHeader)
  assert.ok(!rows.some((r) => /^(REQ|Requirement)$/i.test(r.cells[0])))
})

test('a malformed row is RETURNED, never skipped', () => {
  // The whole point. M115 and FA-01 both record a row that was outside every
  // number quoted about the ledger, each found by adding a row and watching the
  // total refuse to move.
  const { wellFormed, malformed } = classify(tableRows(FIXTURE, isVerificationHeader), (id) => REQ_ID.test(id))
  assert.equal(wellFormed.length, 5)
  assert.equal(malformed.length, 1)
  assert.equal(malformed[0].cells[0], 'not-an-id')
})

test('a wide prefix, a prefix with a digit, and a two-letter prefix all parse', () => {
  // The three shapes this repository has actually hidden: BRAND-REQ (five rows,
  // M115), HARNESS-REQ (seven letters, FA-01) and a prefix carrying a digit.
  for (const id of ['AB-REQ-001', 'BRAND-REQ-002', 'HARNESS-REQ-003', 'FEED2-REQ-004', 'X9-REQ-005'])
    assert.ok(REQ_ID.test(id), id + ' must parse')
})

test('an escaped pipe inside a cell does not shift the columns', () => {
  // FA-05's defect, in the other register. The row says `no` in column four and
  // a naive split reads a fragment of column three.
  const rows = tableRows(FIXTURE, isVerificationHeader)
  const row = rows.find((r) => r.cells[0] === 'HARNESS-REQ-003')
  assert.equal(row.cells[2], 'a pipe \\| inside a cell')
  assert.equal(row.cells[3], 'no')
})

test('the never-watched numerator over the fixture is three', () => {
  // Counted by hand: BRAND-REQ-002, HARNESS-REQ-003 and X9-REQ-005 say `no`.
  // FEED2-REQ-004 says `YES — watched`, which must not match.
  const { wellFormed } = classify(tableRows(FIXTURE, isVerificationHeader), (id) => REQ_ID.test(id))
  const never = wellFormed.filter((r) => /^no\b/i.test(r.cells[3])).length
  assert.equal(never, 3)
})

// ── the disposition vocabulary ──────────────────────────────────────────────

test('the first token is read through markdown emphasis', () => {
  assert.equal(tokenOf('**resolved 2026-08-26 — ADR-0012.**'), 'resolved')
  assert.equal(tokenOf('open'), 'open')
  assert.equal(tokenOf('open — narrowed by ADR-0007'), 'open')
  assert.equal(tokenOf('  **narrowed 2026-08-31**  '), 'narrowed')
})

test('a word nobody declared answers null, and never a guess', () => {
  // Guessing "probably open" or "probably closed" is how a convention shrinks a
  // number the first time somebody writes a new sentence.
  assert.equal(dispositionOf('still being decided'), null)
  assert.equal(dispositionOf(''), null)
  assert.throws(() => carriesWork('waiting on the operator'), /undeclared disposition/)
})

test('a decision that left a remainder still carries work', () => {
  // CO-038, CO-059 and CO-061 say so in their own text, and were outside the
  // number the plan is steered by.
  assert.equal(carriesWork('**narrowed 2026-08-31** — what stays open is X'), true)
  assert.equal(carriesWork('**partially resolved 2026-08-29 by ADR-0023.** The rest remains'), true)
  assert.equal(carriesWork('deferred'), true)
})

test('a settled row does not', () => {
  assert.equal(carriesWork('**resolved 2026-08-26 — ADR-0012.**'), false)
  assert.equal(carriesWork('closed'), false)
  assert.equal(carriesWork('recorded'), false)
  assert.equal(carriesWork('**superseded by CO-100**'), false)
})

test('every declared word says what it means, so the vocabulary can be printed', () => {
  for (const word of vocabulary()) {
    assert.equal(typeof DISPOSITIONS[word].carries, 'boolean', word)
    assert.ok(DISPOSITIONS[word].means.length > 10, word + ' must explain itself')
  }
})

test('the two halves of the vocabulary are both non-empty', () => {
  // A vocabulary where everything carries work, or nothing does, is a constant
  // wearing a field's clothes.
  const words = vocabulary()
  assert.ok(words.some((w) => DISPOSITIONS[w].carries))
  assert.ok(words.some((w) => !DISPOSITIONS[w].carries))
})
