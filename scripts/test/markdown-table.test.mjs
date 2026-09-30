// The parser that made two counts into one (FA-05).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cell, cells, hasEscapedPipe } from '../lib/markdown-table.mjs'

const ROOT = path.resolve(import.meta.dirname, '..', '..')

test('an escaped pipe is a character in a cell, not a column boundary', () => {
  const row = '| CO-050 | source | a sentence with a \\| in it | evidence | when | owner | open |'
  assert.equal(cells(row).length, 9)
  assert.equal(cell(row, 7).trim(), 'open')
  // The defect this replaces: a bare split reads the wrong column entirely.
  assert.notEqual(row.split('|')[7].trim(), 'open')
})

test('bold status and plain status are the same status', () => {
  assert.equal(cell('| a | b | **shipped** |', 3).trim(), 'shipped')
  assert.equal(cell('| a | b | shipped |', 3).trim(), 'shipped')
})

test('a row with no such column answers empty rather than throwing', () => {
  assert.equal(cell('| a |', 9), '')
})

test('the registers this repository actually keeps contain escaped pipes', () => {
  // A parser rule nothing triggers is a rule nobody tested. These are the two
  // rows the old counter lost, and if they are ever rewritten this fails and
  // says the rule is no longer exercised rather than quietly becoming decoration.
  const carryover = readFileSync(
    path.join(ROOT, 'docs/evidence/specs/2026-08-16-software-fabric-carryover.md'), 'utf8'
  ).split('\n').filter((l) => /^\| CO-\d+ \|/.test(l))
  const escaped = carryover.filter(hasEscapedPipe).map((l) => cell(l, 1).trim())
  assert.ok(escaped.length >= 1, 'no register row exercises the escaped-pipe rule any more')
  for (const row of carryover.filter(hasEscapedPipe))
    assert.match(cell(row, 7).trim().toLowerCase(), /^(open|closed|done|unresolved)/,
      `the status of ${cell(row, 1).trim()} does not parse: ${cell(row, 7).slice(0, 40)}`)
})

test('the two ways of counting the register agree', () => {
  // THE ACCEPTANCE. The backlog published two numbers for one fact and let the
  // reader choose. One parser, one number.
  const rows = readFileSync(
    path.join(ROOT, 'docs/evidence/specs/2026-08-16-software-fabric-carryover.md'), 'utf8'
  ).split('\n').filter((l) => /^\| CO-\d+ \|/.test(l))
  const byParser = rows.filter((l) => /^(open|unresolved)/.test(cell(l, 7).trim().toLowerCase())).length
  const byLastCell = rows.filter((l) => {
    const parts = cells(l).filter((p) => p.trim().length)
    return /^(open|unresolved)/.test((parts[parts.length - 1] ?? '').replace(/^[\s*]+/, '').toLowerCase())
  }).length
  assert.equal(byParser, byLastCell,
    `column 7 says ${byParser} open and the last cell says ${byLastCell} — the register has a shape the parser does not describe`)
})
