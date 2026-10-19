// CO-327, ADR-0170: a task whose agent run ended with a Stop of unknown outcome is not held for good. The person's
// explicit, journalled «работа закончена» completes that Stop with the basis `attested`; it is refused for anyone but a
// person, while the session's process has not ended, and for a run already resolved; its undo restores the hold unless
// the task has moved on. Trusted-host SQL contract, run by run-managed-stop-db.mjs on a disposable cluster.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
const url = process.env.FABRIC_DISPATCH_TEST_DATABASE_URL
if (!url) { console.error('NOT_RUN: use run-managed-stop-db.mjs'); process.exit(2) }
assert.match(new URL(url).pathname, /^\/fabric_dispatch_test_[a-z0-9_]+$/)
const sql = (input) => execFileSync('psql', [url, '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1'], { input, encoding: 'utf8' }).trim()
const call = (q) => JSON.parse(sql(q))
const uuid = (n) => `50000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = uuid(1), P = uuid(2), system = `'{"kind":"system","id":"owned-host-fixture"}'`, person = `'{"kind":"person","id":"operator"}'`
let n = 10
sql(`select append_event('${E}','project.created@1',${system},'{"id":"${P}","name":"Run over fixture"}','1','${P}')`)

function run() {
  const task = uuid(n++), session = uuid(n++), command = uuid(n++)
  sql(`select append_event('${E}','task.created@1',${system},'{"id":"${task}","title":"Work"}','1','${P}')`)
  const { task_run_id: id } = call(`select admit_task_launch('${E}','${task}',${system},'${session}')`)
  assert.equal(call(`select begin_task_run_launch('${E}','${id}','${session}',${system})`).granted, true)
  assert.equal(call(`select bind_task_run('${E}','${id}','${session}',${system})`).bound, true)
  const D = uuid(n++), C = uuid(n++), digest = 'd'.repeat(32)
  for (const action of ['claim', 'begin', 'written']) call(`select continuation_dispatch('${E}',${system},'${D}','${task}','${id}','${session}','${digest}','${C}','${action}')`)
  assert.equal(call(`select acknowledge_delivery('${E}','${session}','${D}','${digest}')`).accepted, true)
  return { task, session, command, id }
}
const evidence = { rootExited: true, processTreeQuiescent: true, providerQuiescent: false, authorityRevoked: true, transcriptCommitted: true,
  hostInstanceId: 'host-fixture', bootId: 'boot-fixture', processIdentityRef: 'process:fixture', providerObservationRef: 'provider:fixture',
  authorityRevocationRef: 'revoke:fixture', transcriptRef: 'sha256:fixture', outcome: 'completed' }
const stopUnknown = (r) => {
  call(`select request_task_run_stop('${E}','${r.id}','${r.session}','${r.command}',${system})`)
  assert.equal(call(`select record_task_run_stop_observation('${E}','${r.id}','${r.session}','${r.command}','${JSON.stringify(evidence)}')`).state, 'outcome_unknown')
}
const closed = (r) => sql(`select append_event('${E}','terminal.closed@1',${system},'{"session_id":"${r.session}","exit_code":0}','1','${P}')`)
const held = (r) => sql(`select task_has_unresolved_run_at('${E}','${r.task}',null,9223372036854775807)`) === 't'
const attest = (r, a = person) => call(`select attest_task_run_over('${E}','${r.id}','${r.session}','${r.command}',${a})`)
const revoke = (r, a = person) => call(`select revoke_task_run_attestation('${E}','${r.id}','${r.session}','${r.command}',${a})`)

// The reproduction (CO-323): a Stop without a provider receipt holds the task for good.
const a = run()
stopUnknown(a)
assert.equal(held(a), true, 'a Stop of unknown outcome holds the task')
assert.equal(call(`select admit_task_launch('${E}','${a.task}',${system},'${uuid(n++)}')`).reason_code, 'run_unresolved')

// While the session's process has not ended, nobody can say the work is over.
assert.equal(attest(a).reason_code, 'session_running')
closed(a)
// Only a person attests; an agent or the system cannot clear its own hold.
assert.equal(attest(a, system).reason_code, 'person_required')
assert.equal(attest(a, `'{"kind":"agent","id":"claude-code"}'`).reason_code, 'person_required')

const done = attest(a)
assert.equal(done.recorded, true)
assert.equal(done.state, 'stopped')
assert.equal(done.basis, 'attested')
assert.equal(held(a), false, 'the attestation frees the task')
assert.equal(sql(`select status from project_tasks where id='${a.task}'`), 'backlog')
assert.equal(sql(`select count(*) from leases where work_id='${a.task}'`), '0')
assert.equal(sql(`select actor->>'kind' from journal where type='run.stop_attested@1' and payload->>'task_run_id'='${a.id}'`), 'person')
assert.equal(attest(a).repeated, true, 'saying it twice is one attestation')

// Undo restores the hold while nothing has moved on.
const undone = revoke(a)
assert.equal(undone.revoked, true)
assert.equal(held(a), true, 'the undo holds the task again')
assert.equal(sql(`select state from run_stop_commands where command_id='${a.command}'`), 'outcome_unknown')
assert.equal(sql(`select count(*) from journal where type='run.stop_attestation_revoked@1' and payload->>'task_run_id'='${a.id}'`), '1')
assert.equal(revoke(a).reason_code, 'not_attested')

// Once the freed task has a new run, the old attestation can no longer be taken back.
assert.equal(attest(a).recorded, true)
const again = call(`select admit_task_launch('${E}','${a.task}',${system},'${uuid(n++)}')`)
assert.equal(again.admitted, true, 'the freed task admits a new run')
assert.equal(revoke(a).reason_code, 'task_moved_on')

// A run whose Stop was proved by the host is not the person's to attest.
const b = run()
call(`select request_task_run_stop('${E}','${b.id}','${b.session}','${b.command}',${system})`)
closed(b)
assert.equal(call(`select record_task_run_stop_observation('${E}','${b.id}','${b.session}','${b.command}','${JSON.stringify({ ...evidence, providerQuiescent: true })}')`).state, 'stopped')
assert.equal(attest(b).reason_code, 'already_resolved')
assert.equal(revoke(b).reason_code, 'not_attested')

console.log('PASS run over: a person frees a task held by an ended run, undoably, and nobody else can (CO-327)')
