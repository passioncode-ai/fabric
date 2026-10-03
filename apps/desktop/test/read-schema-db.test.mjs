// The main process's reads, asked of the schema the migrations actually build
// (release review 2026-10-03 · UX finding 1).
//
// `digestRead.ts` selected and filtered `memory_facts.supersedes`, a column no
// migration creates — migration 50 made `supersedes_requested`. `tsc` cannot
// see it, because a column list is a string, and `digest-boundary.test.mjs`
// could not either, because its database is a literal that answers whatever it
// was written to answer. The first person to see it was the operator: a red
// "the digest could not be read: column memory_facts.supersedes does not exist"
// on the first project they created, in English on a Russian screen.
//
// So the read runs HERE against the owned cluster with the whole chain applied,
// through the REAL `createScopedStore`, with only the transport replaced
// (`helpers/psql-rest.mjs` renders the builder calls into SQL; R-007). A column,
// a table or a filter the schema refuses comes back as the error the gateway
// would return, and the read either answers or throws by name.
//
// The second half is the same question asked wholesale: every literal
// `.select('<table>', '<columns>')` in the main process, checked column by
// column against `information_schema` of the migrated database. A read of a
// column that does not exist is a defect whether or not a probe happens to
// drive that read.
//
// Run through `run-read-schema-db.mjs`, which owns the cluster.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { createScopedStore } from '../src/main/scopedStore.ts'
import { digestFor } from '../src/main/digestRead.ts'
import { createPsqlRest } from './helpers/psql-rest.mjs'

const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-read-schema-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = (input) =>
  execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()

let failures = 0
const test = async (name, fn) => {
  try { await fn(); console.log('PASS ' + name) } catch (e) { failures++; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').join('\n     ')) }
}

const uuid = (n) => `71000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = uuid(1), P = uuid(2), DECISION = uuid(3), OLD = uuid(4), FIX = uuid(5), TASK = uuid(6), SESSION = uuid(7)
const person = `'{"kind":"person","id":"operator"}'`
const append = (type, payload, actor = person) =>
  sql(`select append_event('${E}','${type}',${actor},'${JSON.stringify(payload)}','1','${P}')`)

append('project.created@1', { id: P, name: 'Atlas' })
append('memory.project.recorded@1', { id: DECISION, claim: 'History belongs to the project', kind: 'decision' })
append('memory.project.recorded@1', { id: OLD, claim: 'The digest reads three stores', kind: 'note' })
append('memory.project.recorded@1', { id: FIX, claim: 'The digest reads four stores', kind: 'note', supersedes: OLD })
append('task.created@1', { id: TASK, title: 'Look at the digest', instruction: 'look' })
append('task.moved@1', { task_id: TASK, to: 'review' })
append('transcript.captured@1', { session_id: SESSION, annotation: 'a session ended', sha256: 'a'.repeat(64), bytes: 1, lines: 1 })

const store = () => createScopedStore(createPsqlRest(url), { kind: 'estate', estateId: E })

await test('the digest reads against the migrated schema, all four stores, and names the correction', async () => {
  const digest = await digestFor(store(), E, P, 0)
  assert.equal(digest.state, 'lines', 'the digest found nothing on a project with four kinds of news')
  const kinds = digest.lines.map((l) => `${l.kind}:${l.source.id}`)
  assert.ok(kinds.includes(`decision:${DECISION}`), 'the decision is missing: ' + kinds)
  assert.ok(kinds.includes(`correction:${FIX}`), 'the correction is missing: ' + kinds)
  assert.ok(kinds.includes(`review:${TASK}`), 'the review is missing: ' + kinds)
  assert.ok(kinds.some((k) => k.endsWith(SESSION)), 'the session is missing: ' + kinds)
  assert.ok(!kinds.includes(`correction:${OLD}`), 'the corrected fact was reported as a correction')
  assert.equal(typeof digest.boundary, 'number', 'the reading carries no boundary')
})

await test('a correction that did NOT land is not reported as one', async () => {
  // An agent may not bury a person's fact (migration 50): the claim is written
  // beside it as a conflict. "Corrected" would be a request restated as an outcome.
  const ATTEMPT = uuid(8)
  append('memory.project.recorded@1', { id: ATTEMPT, claim: 'History belongs to the agent', kind: 'note', supersedes: DECISION },
    `'{"kind":"agent","id":"session-1"}'`)
  assert.equal(sql(`select correction_outcome from memory_facts where id='${ATTEMPT}'`), 'conflict_proposed')
  const digest = await digestFor(store(), E, P, 0)
  assert.ok(!digest.lines.some((l) => l.kind === 'correction' && l.source.id === ATTEMPT), 'a refused burial was reported as a correction')
})

await test('every literal column list the main process selects exists in the migrated schema', async () => {
  const columns = new Map()
  for (const line of sql(`select table_name||'.'||column_name from information_schema.columns where table_schema='public'`).split('\n')) {
    const [t, c] = line.split('.')
    if (!columns.has(t)) columns.set(t, new Set())
    columns.get(t).add(c)
  }
  const main = new URL('../src/main/', import.meta.url).pathname
  const files = []
  const walk = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); statSync(p).isDirectory() ? walk(p) : f.endsWith('.ts') && !f.endsWith('.test.ts') && files.push(p) } }
  walk(main)
  const problems = []
  let checked = 0
  // `.select('table', 'a,b:c')` on the scoped store, and `.from('table').select('a,b')`
  // on a client. Only literal strings are checked; a computed list is named, not guessed.
  const patterns = [
    /\.select\(\s*'([a-z_]+)'\s*,\s*'([^']*)'/g,
    /\.from\(\s*'([a-z_]+)'\s*\)\s*\.select\(\s*'([^']*)'/g,
    /\.selectIn\(\s*'([a-z_]+)'\s*,\s*'([^']*)'/g
  ]
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const re of patterns)
      for (const m of text.matchAll(re)) {
        const [, table, list] = m
        const line = text.slice(0, m.index).split('\n').length
        const where = `${path.relative(main, file)}:${line}`
        if (!columns.has(table)) { problems.push(`${where} — table ${table} does not exist`); continue }
        for (const raw of list.split(',')) {
          const entry = raw.trim()
          if (!entry || entry === '*' || entry.includes('(')) continue
          const column = entry.includes(':') ? entry.split(':')[1].trim() : entry
          checked++
          if (!columns.get(table).has(column)) problems.push(`${where} — ${table}.${column} does not exist`)
        }
      }
  }
  assert.ok(checked > 100, `only ${checked} columns were found to check — the extraction is broken, not the schema`)
  assert.deepEqual(problems, [], `${problems.length} read(s) of a column the schema does not have`)
  console.log(`     ${checked} selected columns checked against the migrated schema`)
})

if (failures) { console.log(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall green: the reads name columns the schema has')
