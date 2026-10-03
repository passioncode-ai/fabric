// The reads that only the REAL gateway can judge (release review 2026-10-03, iteration 3, harness finding 4).
//
// `search-read.test.mjs`, `list-reads.test.mjs` and `chain-advance-reads.test.mjs` drive the real
// scoped store against a FAKE database, so they prove which filters the code builds — not what
// PostgREST does with them. Three things depend on PostgREST's own grammar and limits, and the
// iteration-3 reviewer checked them by hand on a disposable stack (correct that day), but no tier did:
//
//   1. `searchRead.ts#substringFilter` escapes a search inside `or=(…)`: a comma splits the list, `%`
//      and `_` are LIKE wildcards, `*` is PostgREST's own wildcard, `"` and `\` quote and escape.
//      Each probe below must find EXACTLY its own project — a decoy that a broken escape would also
//      match sits beside each one.
//   2. `scopedStore.ts#selectAll` reads past the gateway's `max_rows` (1000, supabase/config.toml):
//      1 212 projects, all of them, while a plain select is cut at 1 000 (proving the cap is there).
//   3. The journal's `payload->>id` filter, which `chainAdvance.ts#launchesExhausted` counts with.
//
// And one measurement migration 73 rests on: the Supabase image folds case under `pg_c_utf8` the way the
// owned cluster does, and the agent-name rule refuses ÄRZT beside ärzt through `append_event` there.
//
// Runs only against a disposable stack (`probeEnv`), in the full tier through the desktop `test` chain.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { probeEnv } from '../../../scripts/lib/test-stack.mjs'
import { createScopedStore } from '../src/main/scopedStore.ts'
import { searchFor } from '../src/main/searchRead.ts'

const env = probeEnv()
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const psql = (input) => execFileSync('psql', [env.DATABASE_URL, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'],
  { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const lit = (v) => `convert_from(decode('${Buffer.from(String(v)).toString('hex')}','hex'),'UTF8')`
const system = `'{"kind":"system","id":"gateway-reads-probe"}'::jsonb`

let failures = 0
const test = async (name, fn) => {
  try { await fn(); console.log('  ok   ' + name) } catch (e) { failures++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').join('\n       ')) }
}

const SEARCH_ESTATE = randomUUID(), PAGED_ESTATE = randomUUID(), NAME_ESTATE = randomUUID()
const createProject = (estate, id, name) =>
  psql(`select append_event('${estate}','project.created@1',${system},jsonb_build_object('id','${id}','name',${lit(name)}),'1','${id}')`)

try {
  for (const e of [SEARCH_ESTATE, PAGED_ESTATE, NAME_ESTATE])
    psql(`select append_event('${e}','estate.created@1',${system},'{"name":"gateway-reads probe"}'::jsonb)`)

  // ── 1 · the search filter, escaped, through the real gateway ─────────────────
  // Each probe, and the decoy an unescaped probe would ALSO match.
  const probes = [
    ['auth, billing', ['auth', 'billing']],                // a comma splits or=(…)
    ['50%_off', ['50 cents xoff']],                         // % and _ are LIKE wildcards
    ['a.b:c(d)', ['a b c d']],                              // . : ( ) are PostgREST grammar
    ['say "hi"', ['say hi']],                               // a quote ends the quoted value
    ['back\\slash', ['backslash', 'back/slash']],           // a backslash escapes the next character
    ['*', ['plain name']]                                   // PostgREST turns * into %
  ]
  const ids = new Map()
  for (const [name, decoys] of probes) {
    for (const n of [name, ...decoys]) {
      if (ids.has(n)) continue
      const id = randomUUID()
      ids.set(n, id)
      createProject(SEARCH_ESTATE, id, n)
    }
  }
  const store = createScopedStore(db, { kind: 'estate', estateId: SEARCH_ESTATE })
  for (const [name] of probes) {
    await test(`a search for ${JSON.stringify(name)} finds exactly its own project`, async () => {
      const groups = await searchFor(store, name)
      const projects = groups.find((g) => g.store === 'projects')
      assert.ok(projects, 'no projects group came back')
      assert.equal(projects.problem, null, `the gateway refused the filter: ${projects.problem}`)
      assert.deepEqual(projects.hits.map((h) => h.id), [ids.get(name)],
        `found ${JSON.stringify(projects.hits.map((h) => h.text))}`)
    })
  }

  // ── 2 · selectAll reads past max_rows ────────────────────────────────────────
  const PAGED = 1212
  // In three statements, so no one transaction holds 1 212 identity locks (migration 73).
  for (let from = 1; from <= PAGED; from += 404)
    psql(`select count(append_event('${PAGED_ESTATE}','project.created@1',${system},jsonb_build_object('id',s.id,'name','paged '||s.g),'1',s.id))
            from (select gen_random_uuid() id, g from generate_series(${from}, ${Math.min(from + 403, PAGED)}) g) s`)
  const paged = createScopedStore(db, { kind: 'estate', estateId: PAGED_ESTATE })
  await test(`selectAll returns all ${PAGED} projects, past the gateway's cap of 1 000`, async () => {
    const plain = await paged.select('projects', 'id')
    assert.equal(plain.error, null, plain.error?.message)
    assert.equal(plain.data.length, 1000, `a plain select returned ${plain.data.length}: the cap this read exists for is not there`)
    const all = await paged.selectAll('projects', 'id', { orderBy: ['id'] })
    assert.equal(all.failed, null, all.failed)
    assert.equal(all.rows.length, PAGED)
    assert.equal(new Set(all.rows.map((r) => r.id)).size, PAGED, 'a page boundary repeated a row')
  })

  // ── 3 · the journal's payload->>id filter ────────────────────────────────────
  await test('the journal is counted by payload->>id through the gateway', async () => {
    const id = ids.get('*')
    const { count, error } = await store.select('journal', 'seq', { count: 'exact', head: true })
      .eq('type', 'project.created@1').eq('payload->>id', id)
    assert.equal(error, null, error?.message)
    assert.equal(count, 1)
  })

  // ── 4 · the case fold migration 73 relies on, on the Supabase image ──────────
  await test('the Supabase image folds case under pg_c_utf8 as the owned cluster does', async () => {
    assert.equal(psql(`select lower(${lit('ÄRZT')} collate pg_c_utf8)||'|'||lower(${lit('ΟΔΟΣ')} collate pg_c_utf8)||'|'||lower(${lit('İ')} collate pg_c_utf8)`),
      'ärzt|οδοσ|i')
  })
  await test('and the agent-name rule refuses ärzt beside ÄRZT through append_event there', async () => {
    const project = randomUUID()
    createProject(NAME_ESTATE, project, 'clinic')
    const agent = (name) => `select append_event('${NAME_ESTATE}','agent.registered@1',${system},
      jsonb_build_object('id','${randomUUID()}','project_id','${project}','name',${lit(name)},'runner_id','claude-code','instructions','see patients'),'1','${project}')`
    psql(agent('ÄRZT'))
    let said = null
    try { psql(agent('ärzt')) } catch (e) { said = String(e.stderr ?? e.message) }
    assert.ok(said, 'a second agent called ärzt was created beside ÄRZT')
    assert.match(said, /already has an agent called/)
  })
} finally {
  // The stack is disposable, and still: leave nothing a later probe could trip on.
  for (const e of [SEARCH_ESTATE, PAGED_ESTATE, NAME_ESTATE]) {
    try {
      psql(`delete from journal where estate_id='${e}'; select rebuild_estate_projections('${e}'); delete from estates where id='${e}';`)
    } catch (err) {
      console.log(`  NOTE cleanup of estate ${e} failed (the stack is removed with its volumes): ${String(err.message).split('\n')[0]}`)
    }
  }
}

console.log(failures ? `\n${failures} failure(s)` : '\nall green: the real gateway escapes the search, pages past its cap and filters the journal by payload')
process.exit(failures ? 1 : 0)
