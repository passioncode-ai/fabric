// CO-198: the pure half of the upgrade rehearsal — what a dump must hold, the verdict, the receipt, the arguments.
// #region rehearse-upgrade — docs: docs/launch/release-mac.md#upgrading-an-existing-database
import assert from 'node:assert/strict'
import test from 'node:test'
import { isPgMajor, dumpProblems, restoreList, judge, receipt } from '../lib/rehearse-upgrade.mjs'
import { parseArgs } from '../rehearse-upgrade.mjs'

const state = (schemaVersion, journal, tables) => ({ schemaVersion, journal, tables })

test('only a PostgreSQL 17 client is accepted (the stack runs 17; pg_dump refuses a newer server)', () => {
  assert.equal(isPgMajor('pg_restore (PostgreSQL) 17.6 (Homebrew)'), true)
  assert.equal(isPgMajor('pg_dump (PostgreSQL) 14.24'), false)
  assert.equal(isPgMajor('nonsense'), false)
})

test('a dump without the journal or the migration ledger is refused before any stack starts', () => {
  const good = '; Archive created\n123; 1259 1 TABLE public journal postgres\n124; 1259 2 TABLE supabase_migrations schema_migrations postgres\n'
  assert.deepEqual(dumpProblems(good), [])
  assert.equal(dumpProblems('124; 1259 2 TABLE supabase_migrations schema_migrations postgres').length, 1)
  assert.equal(dumpProblems('123; 1259 1 TABLE public journal postgres').length, 1)
})

test('the restore list leaves out only the default privileges of Supabase roles, and names them', () => {
  const toc = ['2790; 826 16630 DEFAULT ACL extensions DEFAULT PRIVILEGES FOR TABLES supabase_admin',
    '2797; 826 16640 DEFAULT ACL public DEFAULT PRIVILEGES FOR SEQUENCES supabase_admin',
    '2799; 826 16700 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES postgres',
    '123; 1259 1 TABLE public journal postgres'].join('\n')
  const { list, skipped } = restoreList(toc)
  assert.deepEqual(skipped, ['DEFAULT ACL public DEFAULT PRIVILEGES FOR SEQUENCES supabase_admin'], 'only a restored schema counts')
  assert.ok(list.includes('FOR TABLES postgres') && list.includes('TABLE public journal'))
  assert.ok(!list.includes('supabase_admin'), 'no Supabase-role default privilege is restored')
})

test('a clean upgrade passes; new tables and backfills are notes, not failures', () => {
  const v = judge({ dumpVersion: 75, expected: 78,
    before: state(75, 12, { journal: 12, projects: 5 }),
    after: state(78, 12, { journal: 12, projects: 5, access_requests: 0 }) })
  assert.equal(v.ok, true)
  assert.deepEqual(v.failures, [])
  assert.deepEqual(v.notes, ['table access_requests is new (0 rows)'])
})

test('a wrong target, lost history, a lost table or lost rows each fail with its own sentence', () => {
  const v = judge({ dumpVersion: 75, expected: 78,
    before: state(75, 12, { journal: 12, projects: 5, notes: 3 }),
    after: state(77, 11, { journal: 11, projects: 4 }) })
  assert.equal(v.ok, false)
  assert.ok(v.failures.some((f) => f.includes('schema is 77, the candidate admits 78')))
  assert.ok(v.failures.some((f) => f.includes('journal held 12 events before the migrations and 11 after')))
  assert.ok(v.failures.some((f) => f.includes('table notes existed before the migrations and is gone after')))
  assert.ok(v.failures.some((f) => f.includes('table projects lost rows: 5 → 4')))
  assert.equal(judge({ dumpVersion: 74, expected: 78, before: state(75, 1, {}), after: state(78, 1, {}) }).failures[0],
    'the restored database reports schema 75, the dump was taken at 74')
})

test('the receipt carries numbers and hashes, never a table row', () => {
  const v = judge({ dumpVersion: 75, expected: 78, before: state(75, 2, { journal: 2 }), after: state(78, 2, { journal: 2 }) })
  const r = receipt({ dump: { file: 'pre.dump', sha256: 'ab', bytes: 9 }, candidate: { ref: 'v0.3.1', commit: 'c0', count: 78, expected: 78 },
    stack: { projectId: 'fabric_test_x', kept: false }, before: state(75, 2, { journal: 2 }), after: state(78, 2, { journal: 2 }), verdict: v,
    timings: { stack: 1 }, tools: { client: 'pg_restore (PostgreSQL) 17.6' } })
  assert.equal(r.format, 'FabricUpgradeRehearsal@1'); assert.equal(r.verdict, 'PASS')
  assert.deepEqual(r.before, { schemaVersion: 75, journal: 2, tables: 1 })
  assert.ok(r.notCovered.length >= 2, 'what the rehearsal does not prove is said in the receipt')
  assert.ok(!JSON.stringify(r).includes('"rows"'))
})

test('arguments: a dump to rehearse, or a fixture to make; anything else is refused', () => {
  assert.deepEqual(parseArgs(['--dump', 'a.dump', '--ref', 'v0.3.1', '--from', '75']), { mode: 'rehearse', keep: false, dump: 'a.dump', ref: 'v0.3.1', from: 75 })
  assert.deepEqual(parseArgs(['--make-fixture', '75', '--out', 'f.dump']), { mode: 'fixture', keep: false, count: 75, out: 'f.dump' })
  assert.throws(() => parseArgs([]), /usage: --dump/)
  assert.throws(() => parseArgs(['--make-fixture', '0', '--out', 'f']), /usage: --make-fixture/)
  assert.throws(() => parseArgs(['--dump', 'a', '--from', 'x']), /--from takes a schema number/)
  assert.throws(() => parseArgs(['--wat']), /unknown argument/)
})
// #endregion rehearse-upgrade
