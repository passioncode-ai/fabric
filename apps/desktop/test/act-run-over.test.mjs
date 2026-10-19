// CO-327, ADR-0170: «Работа закончена» and its undo as acts. The executors refuse what the Stop's state already
// answers (a settled run, nothing to take back), send the person as the actor, and record each other as the inverse.
import assert from 'node:assert/strict'
import { createRunOverExecutors } from '../src/main/actRunExecutors.ts'

const args = { run_id: 'r', session_id: 's', command_id: 'c', task_id: 't' }
function harness(stop, answer) {
  const calls = []
  const ex = createRunOverExecutors({
    estateId: 'e', actor: { kind: 'person', id: 'operator' },
    rpc: async (name, a) => { calls.push({ name, a }); return { data: answer(name), error: null } },
    taskTitle: async () => 'Ship it', projectOf: async () => 'p', stopOf: async () => stop
  })
  return { ex, calls }
}

{
  const { ex, calls } = harness({ state: 'outcome_unknown', basis: null }, () => ({ recorded: true, receipt_seq: 7 }))
  assert.deepEqual(await ex['run.attest'].check(args), { ok: true })
  const out = await ex['run.attest'].run(args)
  assert.equal(calls[0].name, 'attest_task_run_over')
  assert.deepEqual(calls[0].a.p_actor, { kind: 'person', id: 'operator' }, 'the person is the actor')
  assert.equal(out.kind, 'run.attest')
  assert.equal(out.refSeq, 7)
  assert.deepEqual(out.inverse, { kind: 'run.unattest', args })
  assert.equal(out.said.key, 'act.run.attest')
  assert.equal(out.said.params.task, 'Ship it')
  assert.deepEqual(await ex['run.unattest'].check(args), { ok: false, why: 'not_attested' })
  assert.deepEqual(await ex['run.attest'].check({ ...args, run_id: '' }), { ok: false, why: 'invalid' })
}
{
  const { ex } = harness({ state: 'stopped', basis: 'observed' }, () => ({}))
  assert.deepEqual(await ex['run.attest'].check(args), { ok: false, why: 'run_resolved' }, 'a Stop the host proved is not the person to attest')
}
{
  const { ex, calls } = harness({ state: 'stopped', basis: 'attested' }, () => ({ revoked: true, receipt_seq: 9 }))
  assert.deepEqual(await ex['run.attest'].check(args), { ok: false, why: 'already_there' })
  assert.deepEqual(await ex['run.unattest'].check(args), { ok: true })
  const out = await ex['run.unattest'].run(args)
  assert.equal(calls[0].name, 'revoke_task_run_attestation')
  assert.deepEqual(out.inverse, { kind: 'run.attest', args })
}
{
  const { ex } = harness({ state: 'stopped', basis: 'attested' }, () => ({ revoked: false, reason_code: 'task_moved_on' }))
  await assert.rejects(ex['run.unattest'].run(args), /task_moved_on/, 'a refused undo says why in its own code')
}
{
  const { ex } = harness(null, () => ({}))
  assert.deepEqual(await ex['run.attest'].check(args), { ok: false, why: 'run_gone' })
}
console.log('PASS the run-over acts: settled runs refused, the person the actor, each the other\'s inverse (CO-327)')
