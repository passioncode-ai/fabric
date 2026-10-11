// CO-199: no migration filename sorts below one a database may already have applied, and an applied
// migration's text is never edited (scripts/lib/migration-ledger.mjs).
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { LEDGER_SCHEMA, digest, ledgerProblems, recordNew } from '../lib/migration-ledger.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const f = (name, text = `-- ${name}\n`) => ({ name, text })
const L = (...fs) => ({ schema: LEDGER_SCHEMA, migrations: fs.map((x) => ({ file: x.name, sha256: digest(x.text) })) })
const a = f('20261004000077_hub_access_at_the_door.sql'), b = f('20261004000080_hub_authority_boundaries.sql'), c = f('20261005000081_project_board.sql')

test('the repository\'s migrations agree with its ledger', () => {
  const dir = path.join(ROOT, 'supabase', 'migrations')
  const files = readdirSync(dir).filter((x) => x.endsWith('.sql')).map((name) => ({ name, text: readFileSync(path.join(dir, name), 'utf8') }))
  const ledger = JSON.parse(readFileSync(path.join(ROOT, 'supabase', 'migration-ledger.json'), 'utf8'))
  assert.deepEqual(ledgerProblems({ files, ledger }), [])
  assert.equal(ledger.migrations.length, files.length)
})

test('the 0.3.1 hazard: a reserved 78 merged after 80 is refused, with the number to renumber past', () => {
  const late = f('20261004000078_reserved_elsewhere.sql')
  const problems = ledgerProblems({ files: [a, b, c, late], ledger: L(a, b, c) })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /20261004000078_reserved_elsewhere\.sql sorts below 20261005000081_project_board\.sql.*renumber it past 20261005000081/)
  assert.throws(() => recordNew({ files: [a, b, c, late], ledger: L(a, b, c) }), /sort below/)
})

test('a new file that sorts after the newest is refused until it is recorded, then passes', () => {
  const next = f('20261011000082_write_rules_at_the_door.sql')
  assert.match(ledgerProblems({ files: [a, b, c, next], ledger: L(a, b, c) })[0], /is not recorded: append it/)
  const recorded = recordNew({ files: [a, b, c, next], ledger: L(a, b, c) })
  assert.deepEqual(recorded.migrations.map((m) => m.file), [a.name, b.name, c.name, next.name])
  assert.deepEqual(ledgerProblems({ files: [a, b, c, next], ledger: recorded }), [])
})

test('an applied migration edited in place, or removed, is refused', () => {
  assert.match(ledgerProblems({ files: [a, { ...b, text: b.text + 'select 1;\n' }, c], ledger: L(a, b, c) })[0], /differs from the bytes recorded/)
  assert.match(ledgerProblems({ files: [a, c], ledger: L(a, b, c) })[0], /is not in supabase\/migrations\/ — an applied migration is never removed/)
})

test('a ledger whose order was rewritten to hide a late file is refused', () => {
  const late = f('20261004000078_reserved_elsewhere.sql')
  // Recorded after 81 (the merge order), yet sorting before it.
  const ledger = { schema: LEDGER_SCHEMA, migrations: [...L(a, b, c).migrations, { file: late.name, sha256: digest(late.text) }] }
  assert.match(ledgerProblems({ files: [a, b, c, late], ledger }).join('\n'), /is recorded after 20261005000081_project_board\.sql but sorts before it/)
  // Inserted where it sorts, behind the base's back: the base's ledger is no longer a prefix.
  const rewritten = L(a, late, b, c)
  assert.deepEqual(ledgerProblems({ files: [a, b, c, late], ledger: rewritten }), [], 'sorted, it looks consistent on its own')
  assert.match(ledgerProblems({ files: [a, b, c, late], ledger: rewritten, base: L(a, b, c) })[0], /the ledger is appended to, never rewritten/)
})

test('one version per file, a well-formed name, and a ledger of the right schema', () => {
  const twin = f('20261005000081_another_board.sql')
  assert.match(ledgerProblems({ files: [c, twin], ledger: L(c, twin) }).join('\n'), /share the version 20261005000081/)
  assert.match(ledgerProblems({ files: [a, f('82_short.sql')], ledger: L(a) })[0], /is not <14-digit version>_<name>\.sql/)
  assert.match(ledgerProblems({ files: [a], ledger: { migrations: [] } })[0], /is not a FabricMigrationLedger@1 document/)
})

test('line endings do not change a migration\'s recorded bytes (a Windows checkout hashes the same)', () => {
  assert.equal(digest('select 1;\r\nselect 2;\r\n'), digest('select 1;\nselect 2;\n'))
  assert.notEqual(digest('select 1;\n'), digest('select 2;\n'))
})
