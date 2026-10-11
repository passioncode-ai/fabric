// #region grants-from-the-journal — docs: docs/adr/0028-one-effects-algebra-and-the-floor-lives-in-the-schema.md#decision
// The 0.3.2 audit's grant-plane findings, attempted against the whole migration chain on an owned PostgreSQL
// (L8, ADR-0084; never the operator's stack):
//   A7-014 / A2-015  a grant is a projection of grant.issued@1, written inside the append; a grant the table
//                    would refuse leaves no event behind; service_role can no longer write the table around it;
//                    a rebuild reproduces it, consumption included.
//   A7-015           the grant carries the project it was given for, and serves no other project.
//   A7-016           reserve_effect reserves exactly the grant presented, or refuses by name (revoked included).
//   A7-020           every event type flagged `projects` is named by some apply_* projector.
//   A7-022           rebuild_estate_projections takes the estate lock, under lock_timeout, as append_event does.
// Restored history (a seq at or below a restore boundary) issues no live grant: an archive is a file, and a
// grant read out of a file is a forgery (shared/archive.ts NOT_RESTORED.grants).
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { withOwnedPostgres } from './helpers/owned-postgres.mjs'

const checks = ({ url, bin }) => {
  // withOwnedPostgres stops the cluster when the body RETURNS, so the body stays synchronous.
  const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
  const sql = (input) => execFileSync(bin + '/psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  const j = (v) => "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb"
  const id = (n) => `91000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const E = id(1), P = id(2), Q = id(3)
  const actor = j({ kind: 'person', id: id(9) })
  const append = (type, payload, project = null) =>
    sql(`set role service_role; select seq from append_event('${E}','${type}',${actor},${j(payload)},'1',${project ? `'${project}'` : 'null'})`)
  const refused = (fn, pattern) => assert.throws(fn, (e) => pattern.test(String(e.stderr)), `expected a refusal matching ${pattern}`)
  const inHour = () => new Date(Date.now() + 3600_000).toISOString()
  const issued = (grant, over = {}) => ({ grant_id: grant, floor_class: 'deletion', target: 'urn:t:' + grant, expires_at: inHour(), issued_by: id(9), ...over })
  const reserve = (grant, target, project, command, action = 'project.delete') =>
    sql(`set role service_role; select grant_id from reserve_effect('${E}',${project ? `'${project}'` : 'null'},'${action}','deletion','${target}','${command}','${grant}')`)

  sql(`set role service_role; select append_event('${E}','estate.created@1',${actor},${j({ name: 'grants' })})`)
  sql(`set role service_role; select append_event('${E}','project.created@1',${actor},${j({ id: P, name: 'P' })})`)
  sql(`set role service_role; select append_event('${E}','project.created@1',${actor},${j({ id: Q, name: 'Q' })})`)

  let failed = 0
  const test = (name, fn) => { try { fn(); console.log('PASS ' + name) } catch (e) { failed++; console.log('FAIL ' + name + ': ' + (e.stderr ?? e.message)) } }

  test('A7-014 grant.issued@1 projects the grant row, in the same append, with its project and action', () => {
    const G = id(11)
    append('grant.issued@1', issued(G, { action_class: 'project.delete' }), P)
    assert.equal(sql(`select estate_id||'|'||project_id||'|'||action_class||'|'||floor_class||'|'||target from grants where id='${G}'`),
      `${E}|${P}|project.delete|deletion|urn:t:${G}`)
    assert.equal(sql(`select (g.created_at = j.occurred_at)::text from grants g join journal j on j.estate_id=g.estate_id and j.type='grant.issued@1' and j.payload->>'grant_id'=g.id::text where g.id='${G}'`), 'true')
  })

  test('A2-015 a grant the table refuses (an unknown floor class) leaves no event in the journal', () => {
    const before = sql(`select count(*) from journal where estate_id='${E}' and type='grant.issued@1'`)
    refused(() => append('grant.issued@1', issued(id(12), { floor_class: 'everything' }), P), /floor_class|check constraint/)
    assert.equal(sql(`select count(*) from journal where estate_id='${E}' and type='grant.issued@1'`), before)
    assert.equal(sql(`select count(*) from grants where id='${id(12)}'`), '0')
  })

  test('A7-014 service_role cannot write grants around the journal', () => {
    refused(() => sql(`set role service_role; insert into grants(estate_id,floor_class,target,expires_at) values('${E}','deletion','x',now()+interval '1 hour')`), /permission denied/)
    refused(() => sql(`set role service_role; update grants set expires_at=now()+interval '9 years' where estate_id='${E}'`), /permission denied/)
    refused(() => sql(`set role service_role; delete from grants where estate_id='${E}'`), /permission denied/)
  })

  test('A7-014 grant.consumed@1 spends the grant, and a rebuild reproduces it spent', () => {
    const G = id(13)
    append('grant.issued@1', issued(G), P)
    append('grant.consumed@1', { grant_id: G, command_id: id(91) }, P)
    const spent = sql(`select consumed_at from grants where id='${G}'`)
    assert.notEqual(spent, '')
    // Lost, as a projection may be: the rebuild brings it back from the journal alone.
    sql(`delete from grants where id='${G}'`)
    sql(`select rebuild_estate_projections('${E}')`)
    assert.equal(sql(`select consumed_at from grants where id='${G}'`), spent)
    assert.equal(sql(`select project_id from grants where id='${G}'`), P)
  })

  test('A7-015 a grant given for project P is refused for project Q and serves P', () => {
    const G = id(14), T = 'urn:t:' + G
    append('grant.issued@1', issued(G), P)
    refused(() => reserve(G, T, Q, id(92)), /another project|no live grant/)
    assert.equal(reserve(G, T, P, id(93)), G)
  })

  test('A7-016 reserve_effect reserves exactly the presented grant, not the oldest live one', () => {
    const OLD = id(15), NEW = id(16), T = 'urn:t:shared'
    append('grant.issued@1', issued(OLD, { target: T }), P)
    append('grant.issued@1', issued(NEW, { target: T }), P)
    assert.equal(reserve(NEW, T, P, id(94)), NEW)
    // The same command asking again keeps the authority it already has.
    assert.equal(reserve(NEW, T, P, id(94)), NEW)
    // Another command presenting the held grant is refused, although OLD sits live beside it.
    refused(() => reserve(NEW, T, P, id(95)), /already reserved/)
  })

  test('A7-016 a presented grant that is revoked, spent, expired, for another act or another estate is refused by name', () => {
    const R = id(17), S = id(18), X = id(19), A = id(20)
    for (const g of [R, S, X, A]) append('grant.issued@1', issued(g, g === A ? { action_class: 'file.overwrite' } : {}), P)
    sql(`update grants set revoked_at=now() where id='${R}'`)
    refused(() => reserve(R, 'urn:t:' + R, P, id(96)), /revoked/)
    append('grant.consumed@1', { grant_id: S, command_id: id(97) }, P)
    refused(() => reserve(S, 'urn:t:' + S, P, id(98)), /spent/)
    sql(`update grants set expires_at=now()-interval '1 minute' where id='${X}'`)
    refused(() => reserve(X, 'urn:t:' + X, P, id(99)), /expired/)
    refused(() => reserve(A, 'urn:t:' + A, P, id(100)), /authorises|action/)
    refused(() => reserve(id(11), 'urn:t:other', P, id(101)), /does not authorise|target/)
    refused(() => reserve(id(4242), 'urn:t:none', P, id(102)), /no such grant/)
  })

  test('restored history issues no live grant', () => {
    const T2 = id(30), G = id(31)
    const ev = (seq, type, payload) => ({ seq, type, schema_rev: '1', actor: { kind: 'person', id: id(9) }, project_id: null, run_id: null, node_id: null, payload, occurred_at: new Date().toISOString() })
    sql(`insert into estates(id,name) values('${T2}','restored');insert into estate_restore_boundaries(target_estate_id,source_estate_id,watermark_seq,event_count,owner_event_seqs) values('${T2}','${E}',1,1,'{}');select restore_estate_events('${T2}',${j([ev(1, 'grant.issued@1', issued(G, { expires_at: '2099-01-01T00:00:00Z' }))])})`)
    assert.equal(sql(`select count(*) from grants where id='${G}'`), '0')
    sql(`select rebuild_estate_projections('${T2}')`)
    assert.equal(sql(`select count(*) from grants where id='${G}'`), '0')
  })

  test('a grant.issued@1 written before grants were projected (no grant_id) still appends, and projects nothing', () => {
    const before = sql(`select count(*) from grants where estate_id='${E}'`)
    append('grant.issued@1', { floor_class: 'deletion', target: 'urn:t:legacy', expires_at: inHour(), issued_by: id(9) }, P)
    assert.equal(sql(`select count(*) from grants where estate_id='${E}'`), before)
  })

  test('A7-020 every event type flagged as projecting is named by an apply_* projector', () => {
    const unhandled = sql(`select string_agg(t.type, ', ' order by t.type) from event_types t where t.projects
      and not exists (select 1 from pg_proc p where p.proname like 'apply\\_%' and p.proname <> 'apply_projections'
                      and position(''''||t.type||'''' in p.prosrc) > 0)`)
    assert.equal(unhandled, '', `flagged projects=true with no projector: ${unhandled}`)
  })

  test('A7-022 a rebuild waits for the estate lock and gives up under lock_timeout, as append_event does', () => {
    const held = () => sql(`select count(*) from pg_locks where locktype='advisory' and granted`) !== '0'
    // Through -c, not stdin: this body is synchronous, so a pipe written from here would never be flushed.
    spawn(bin + '/psql', [url, '-X', '-q', '-c', `begin; select pg_advisory_xact_lock(hashtextextended('${E}'::text, 4242)); select pg_sleep(6); commit;`], { stdio: 'ignore' })
    try {
      for (let i = 0; i < 50 && !held(); i++) sleep(100)
      assert.ok(held(), 'the holder never took the estate lock')
      refused(() => sql(`select rebuild_estate_projections('${E}')`), /lock timeout/)
    } finally { for (let i = 0; i < 100 && held(); i++) sleep(100) }
  })

  if (failed) throw new Error(failed + ' grant-plane test(s) failed')
}

if (process.env.FABRIC_DISPATCH_TEST_DATABASE_URL) {
  assert.match(new URL(process.env.FABRIC_DISPATCH_TEST_DATABASE_URL).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
  checks({ url: process.env.FABRIC_DISPATCH_TEST_DATABASE_URL, bin: process.env.FABRIC_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin' })
} else withOwnedPostgres({ name: 'grants_journal', port: 58493, supabaseDefaults: true }, checks)
// #endregion grants-from-the-journal
