// Migration 75: a projector is not a door, and a command written for the trusted host is not open to a
// signed-in member. A sweep over pg_proc on the fully migrated chain, with Supabase's default privileges
// in force (`run-function-privileges-db.mjs` passes `supabaseDefaults`), so a grant that exists only on
// Supabase fails here, not after release.
//
// The finding (independent verifier, 2026-10-03): `apply_releases(journal)` and
// `apply_question_deferrals(journal)` were SECURITY DEFINER with a NULL ACL — EXECUTE to PUBLIC — so
// `set role anon; select apply_releases(row(…)::journal)` rewrote a release with no journal row. The same
// audit found `decide_proposal`, `release_grant_reservation` and `import_declared_snapshot` executable by
// authenticated under Supabase's defaults. To WATCH this suite fail, run the runner with
// FABRIC_SKIP_MIGRATION=20261003000075_projectors_are_not_public.sql.
// #region projectors-are-not-public — docs: docs/adr/0103-an-id-belongs-to-one-estate-at-the-write-boundary.md#decision
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-function-privileges-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-F', '|', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
const rows = input => { const out = sql(input); return out ? out.split('\n') : [] }
// Every case runs and the suite fails once at the end, so a watched-failure run shows each finding, not the first.
let count = 0; const failed = []
const test = (name, fn) => {
  try { fn(); console.log('PASS ' + name); count++ } catch (e) { failed.push(name); console.log(`FAIL ${name}\n  ${String(e.message).split('\n')[0]}`) }
}

// The API roles. `public` is every role, present and future; the other three are Supabase's.
const API = ['public', 'anon', 'authenticated']
// SECURITY DEFINER functions a signed-in member may call, each for a stated reason. Anything else
// SECURITY DEFINER in `public` is for the service role or for the database itself.
const MEMBER_DEFINERS = new Map([
  ['schema_version()', 'the build compares the applied schema with its window (migration 51, S07); it reads a count'],
])
const fns = (where) => `select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and ${where} order by 1`
const executableBy = (role, where) => rows(`${fns(where).replace('order by 1', '')} and has_function_privilege('${role}', p.oid, 'execute') order by 1`)

test('the sweep is not vacuous: Supabase\'s default privileges are in force, so a new function is open to every API role', () => {
  // Inside a transaction that is rolled back: nothing is left behind.
  const got = sql(`begin;
create function public.zz_default_privilege_probe() returns int language sql as 'select 1';
select string_agg(r || '=' || has_function_privilege(r, 'public.zz_default_privilege_probe()', 'execute'), ',' order by r)
  from unnest(array['anon','authenticated','service_role']) r;
rollback;`)
  assert.equal(got, 'anon=true,authenticated=true,service_role=true', 'the runner did not put Supabase\'s defaults in force; this sweep would pass on a cluster Supabase is not')
})

test('no projector (apply_*) is executable by public, anon, authenticated or the service role', () => {
  const all = rows(fns(`p.proname like 'apply\\_%' escape '\\'`))
  assert.ok(all.length >= 24, `expected the chain's projectors, found ${all.length}`)
  for (const name of ['apply_releases(journal)', 'apply_question_deferrals(journal)', 'apply_projections(journal)', 'apply_task_link(journal)'])
    assert.ok(all.includes(name), `${name} is not in the sweep`)
  const open = [...API, 'service_role'].flatMap(role => executableBy(role, `p.proname like 'apply\\_%' escape '\\'`).map(f => `${role}: ${f}`))
  assert.deepEqual(open, [], `projector(s) callable around the journal — ${open.join('; ')}`)
})

test('no SECURITY DEFINER function in public is executable by public or anon, and authenticated only where stated', () => {
  const definers = rows(fns('p.prosecdef'))
  assert.ok(definers.length >= 80, `expected the chain's definer functions, found ${definers.length}`)
  const open = API.flatMap(role => executableBy(role, 'p.prosecdef')
    .filter(f => !(role === 'authenticated' && MEMBER_DEFINERS.has(f))).map(f => `${role}: ${f}`))
  assert.deepEqual(open, [], `SECURITY DEFINER function(s) open to an API role — ${open.join('; ')}`)
})

test('the commands of the audit stay callable by the service role, the caller they were written for', () => {
  for (const f of ['decide_proposal(uuid,uuid,text,jsonb,uuid,integer)', 'release_grant_reservation(uuid,uuid,jsonb,text)',
                   'import_declared_snapshot(uuid,uuid,text,jsonb,jsonb)', 'record_release(uuid,uuid,uuid,uuid,text,text,text,uuid[],uuid[],uuid,jsonb)',
                   'defer_question(uuid,uuid,uuid,uuid,text,jsonb)', 'append_event(uuid,text,jsonb,jsonb,text,uuid,uuid,uuid)']) {
    assert.equal(sql(`select has_function_privilege('service_role', '${f}', 'execute')`), 't', `${f} is not callable by the service role`)
    for (const role of API) assert.equal(sql(`select has_function_privilege('${role}', '${f}', 'execute')`), 'f', `${f} is callable by ${role}`)
  }
})

test('the projector still runs where it belongs: an append projects a release through the owner, not through a grant', () => {
  const E = '75000000-0000-4000-8000-00000000000a', P = '75000000-0000-4000-8000-00000000000b', R = '75000000-0000-4000-8000-00000000000c'
  const person = `'{"kind":"person","id":"operator"}'`
  sql(`set role service_role; select append_event('${E}','project.created@1',${person},'{"id":"${P}","name":"Atlas"}','1','${P}')`)
  const got = sql(`set role service_role; select record_release('${E}','${P}','${R}','75000000-0000-4000-8000-00000000000d','Atlas 1','Demo','s',array[]::uuid[],array[]::uuid[],null,${person})->>'repeated'`)
  assert.equal(got, 'false')
  assert.equal(sql(`select name from releases where id='${R}'`), 'Atlas 1', 'revoking the projector broke the append that runs it')
})

if (failed.length) { console.log(JSON.stringify({ status: 'FAIL', passed: count, failed })); process.exit(1) }
console.log(JSON.stringify({ status: 'PASS', cases: count }))
// #endregion projectors-are-not-public
