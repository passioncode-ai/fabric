// scripts/residue-report.mjs counts what the probes left in the live database and must never
// change it. Pure: reads the SQL and the source, connects to nothing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from '../lib/test-stack.mjs'
import { reportSql, PROBE_ACTORS, PROBE_ESTATE_NAMES, PROBE_PERSON_NAMES } from '../residue-report.mjs'

const SRC = readFileSync(path.join(REPO_ROOT, 'scripts', 'residue-report.mjs'), 'utf8')

test('the report statement writes nothing', () => {
  const sql = reportSql().replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*/g, '')
  for (const verb of ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate', 'grant', 'revoke', 'merge', 'copy', 'call', 'do'])
    assert.doesNotMatch(sql, new RegExp(`\\b${verb}\\b`, 'i'), `the report contains ${verb}`)
})

test('the session is read-only twice: PGOPTIONS and a read-only transaction that is rolled back', () => {
  assert.match(SRC, /default_transaction_read_only=on/)
  assert.match(SRC, /begin transaction read only;\\n\$\{reportSql\(\)\};\\nrollback;/)
})

test('every marker is written by a probe in this repository', () => {
  const sources = [path.join(REPO_ROOT, 'apps/desktop/test'), path.join(REPO_ROOT, 'packages/schema/test')]
    .flatMap(d => readdirSync(d).filter(f => f.endsWith('.mjs')).map(f => readFileSync(path.join(d, f), 'utf8'))).join('\n')
  for (const marker of [...Object.keys(PROBE_ACTORS), ...Object.keys(PROBE_ESTATE_NAMES), ...Object.keys(PROBE_PERSON_NAMES)])
    assert.ok(sources.includes(`'${marker}'`), `no probe writes '${marker}' — a marker nobody writes would class a person's row as residue`)
})
