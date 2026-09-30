// First-slice plan B3-1: managed Stop accepts an owned backend's own exit receipt, bound to the
// same owner, epoch, process, host and boot as its open, and only with a quiescent process group.
// Trusted-host SQL contract on an owned cluster, not proof of native process containment.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-managed-stop-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = input => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8' }).trim()
assert.equal(sql("select count(*) from supabase_migrations.schema_migrations where version='20260928000067'"), '1')
const uuid = n => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = uuid(1), P = uuid(2), system = `'{"kind":"system","id":"owned-backend-registry"}'`; let n = 10
const call = q => JSON.parse(sql(q))
const lit = v => `'${JSON.stringify(v).replaceAll("'", "''")}'`
sql(`select append_event('${E}','project.created@1',${system},'{"id":"${P}","name":"Backend stop fixture"}','1','${P}')`)
function run() {
  const task = uuid(n++), session = uuid(n++), command = uuid(n++)
  sql(`select append_event('${E}','task.created@1',${system},'{"id":"${task}","title":"Work"}','1','${P}')`)
  const { task_run_id: id } = call(`select admit_task_launch('${E}','${task}',${system},'${session}')`)
  assert.equal(call(`select begin_task_run_launch('${E}','${id}','${session}',${system})`).granted, true)
  return { task, session, command, id }
}
const bind = r => assert.equal(call(`select bind_task_run('${E}','${r.id}','${r.session}',${system})`).bound, true)
const identity = r => ({ session_id: r.session, owner_id: 'owner-' + r.session.slice(-4), channel_epoch: 'epoch-' + r.session.slice(-4), process_ref: 'process:' + 'a'.repeat(64), host_instance_id: 'host-fixture', boot_id: 'boot-fixture' })
const opened = (r, over = {}, actor = system) => sql(`select append_event('${E}','backend.opened@1',${actor},${lit({ ...identity(r), ...over })},'1','${P}')`)
const exited = (r, over = {}, actor = system) => sql(`select append_event('${E}','backend.exited@1',${actor},${lit({ ...identity(r), exit_code: 0, exit_signal: null, process_group: 'quiescent', ...over })},'1','${P}')`)
const request = r => call(`select request_task_run_stop('${E}','${r.id}','${r.session}','${r.command}',${system})`)
const evidence = { rootExited: true, processTreeQuiescent: true, providerQuiescent: true, authorityRevoked: true, transcriptCommitted: true,
  hostInstanceId: 'host-fixture', bootId: 'boot-fixture', processIdentityRef: 'process:' + 'a'.repeat(64), providerObservationRef: 'provider:fixture',
  authorityRevocationRef: 'revoke:fixture', transcriptRef: 'sha256:fixture', outcome: 'cancelled' }
const observe = (r, patch = {}) => call(`select record_task_run_stop_observation('${E}','${r.id}','${r.session}','${r.command}',${lit({ ...evidence, ...patch })})`)
const fail = r => call(`select fail_task_launch('${E}','${r.id}','${r.session}',${system},false)`)
let count = 0; const test = (name, fn) => { fn(); console.log('PASS ' + name); count++ }

test('the backend\'s own exit, matching its open, with a quiescent group, is a stop', () => {
  const r = run(); bind(r); opened(r); request(r); exited(r)
  const o = observe(r)
  assert.equal(o.state, 'stopped', JSON.stringify(o)); assert.equal(o.basis, 'observed')
  const ev = JSON.parse(sql(`select observation from run_stop_commands where command_id='${r.command}'`))
  assert.ok(ev.backendOpenedSeq && ev.backendExitedSeq, 'the receipts are named in the evidence'); assert.equal(ev.backendProcessGroup, 'quiescent')
  assert.equal(ev.terminalClosedSeq, undefined)
  assert.equal(sql(`select state from task_runs where task_run_id='${r.id}'`), 'ended')
})

test('an unknown process group — a descendant that left it — is never a stop', () => {
  const r = run(); bind(r); opened(r); request(r); exited(r, { process_group: 'unknown' })
  assert.equal(observe(r).state, 'outcome_unknown')
  // The descendant's end observed later, as a new exit receipt, settles it.
  exited(r); assert.equal(observe(r).state, 'stopped')
})

test('no exit, an exit before the open, and an exit naming another owner, epoch, process, host or boot stay unknown', () => {
  const none = run(); bind(none); opened(none); request(none); assert.equal(observe(none).state, 'outcome_unknown')
  const early = run(); bind(early); exited(early); opened(early); request(early); assert.equal(observe(early).state, 'outcome_unknown')
  for (const k of ['owner_id', 'channel_epoch', 'process_ref', 'host_instance_id', 'boot_id']) {
    const r = run(); bind(r); opened(r); request(r); exited(r, { [k]: k === 'process_ref' ? 'process:' + 'b'.repeat(64) : 'someone-else' })
    assert.equal(observe(r).state, 'outcome_unknown', k)
  }
})

test('a view\'s terminal.closed is never read as the backend\'s exit', () => {
  const r = run(); bind(r); opened(r); request(r)
  sql(`select append_event('${E}','terminal.closed@1',${system},'{"session_id":"${r.session}","exit_code":0}','1','${P}')`)
  const o = observe(r); assert.equal(o.state, 'outcome_unknown')
  assert.equal(JSON.parse(sql(`select observation from run_stop_commands where command_id='${r.command}'`)).terminalClosedSeq, undefined)
})

test('the observation must name the backend\'s own process, host and boot', () => {
  for (const patch of [{ processIdentityRef: 'process:' + 'c'.repeat(64) }, { hostInstanceId: 'other-host' }, { bootId: 'other-boot' }]) {
    const r = run(); bind(r); opened(r); request(r); exited(r)
    assert.equal(observe(r, patch).state, 'outcome_unknown', JSON.stringify(patch))
  }
})

test('receipts from an untrusted actor and a malformed open never stop anything', () => {
  const agent = `'{"kind":"agent","id":"not-the-registry"}'`
  const a = run(); bind(a); opened(a); request(a); exited(a, {}, agent); assert.equal(observe(a).state, 'outcome_unknown', 'an agent cannot report the backend\'s exit')
  const b = run(); bind(b); opened(b, {}, agent); request(b)
  sql(`select append_event('${E}','terminal.closed@1',${system},'{"session_id":"${b.session}","exit_code":0}','1','${P}')`)
  assert.equal(observe(b).state, 'stopped', 'an agent-written open does not turn a PTY session into a backend one')
  const c = run(); bind(c); opened(c, { process_ref: 'pid 42; drop' }); request(c); exited(c, { process_ref: 'pid 42; drop' })
  assert.equal(observe(c).state, 'outcome_unknown')
})

test('a launch with an owned backend can never be relabelled never-spawned', () => {
  for (const kind of ['opened', 'exited']) {
    const r = run()
    if (kind === 'opened') opened(r); else { opened(r); exited(r) }
    const f = fail(r); assert.equal(f.compensated, false, kind); assert.equal(f.reason_code, 'process_evidence', kind)
  }
  const clean = run(); assert.equal(fail(clean).compensated, true, 'no receipt, no process evidence: the old path is unchanged')
})

test('a PTY session without any backend receipt still stops by terminal.closed', () => {
  const r = run(); bind(r); request(r)
  sql(`select append_event('${E}','terminal.closed@1',${system},'{"session_id":"${r.session}","exit_code":0}','1','${P}')`)
  const o = observe(r); assert.equal(o.state, 'stopped')
  assert.ok(JSON.parse(sql(`select observation from run_stop_commands where command_id='${r.command}'`)).terminalClosedSeq)
})

test('the backend receipts are registered types, and the helper is not granted out', () => {
  assert.equal(sql(`select count(*) from event_types where type in ('backend.opened@1','backend.exited@1') and projects=false`), '2')
  assert.equal(sql(`select has_function_privilege('authenticated','backend_exit_evidence(uuid,uuid,bigint)','execute')`), 'f')
  assert.equal(sql(`select has_function_privilege('anon','backend_exit_evidence(uuid,uuid,bigint)','execute')`), 'f')
})
console.log(`PASS ${count} backend exit receipt groups on the full migration chain`)
