// The alias that made a real task look like one that does not exist (FA-05).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { aliasProblems, anchorOf, canonicalFor, contractOf } from '../lib/canonical-id.mjs'

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const catalog = JSON.parse(readFileSync(path.join(ROOT, 'docs/architecture/engineering-specs.json'), 'utf8'))
const ids = catalog.execution_nodes.map((n) => n.id)

test('a dotted id keeps its dot as an identity and flattens it only for an address', () => {
  assert.equal(anchorOf('M152.commit'), 'work-m152-commit')
  assert.equal(contractOf('M152.commit'), 'task-M152-commit')
  // The report's spelling, resolved back to the thing it meant.
  assert.equal(canonicalFor('work-m152-commit', ids), 'M152.commit')
})

test('two ids that flatten to one alias are a collision, not a coincidence', () => {
  const problems = aliasProblems(['M152.commit', 'M152-commit'])
  assert.ok(problems.some((p) => p.includes('both render as')), problems.join('\n'))
})

test('an id that is not canonical is refused by shape', () => {
  for (const bad of ['m152 commit', 'the commit step', 'M152.commit.extra', ''])
    assert.ok(aliasProblems([bad]).length > 0, `${bad} was accepted as canonical`)
})

test('every execution node this repository has is canonical and unambiguous', () => {
  // The measurement, not an example: 18 of the 75 nodes carry a dotted id, and
  // a collision among them would let a queue row be attributed to either.
  assert.ok(ids.filter((i) => i.includes('.')).length >= 10, 'the dotted ids have gone; this rule is untested')
  assert.deepEqual(aliasProblems(ids), [])
})

test('an alias nobody owns resolves to nothing rather than to something near it', () => {
  assert.equal(canonicalFor('work-m999-imaginary', ids), null)
})
