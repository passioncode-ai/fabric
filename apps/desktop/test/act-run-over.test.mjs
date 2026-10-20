// CO-327, ADR-0170: «Работа закончена» and its undo as acts. The executors refuse what the Stop's state already
// answers (a settled run, nothing to take back), send the person as the actor, and record each other as the inverse.
import assert from 'node:assert/strict'
import { createRunOverConsole, createRunOverExecutors, runOverRefusal } from '../src/main/actRunExecutors.ts'

const args = { run_id: 'r', session_id: 's', command_id: 'c', task_id: 't' }
function harness(stop, answer, settled) {
  const calls = []
  const ex = createRunOverExecutors({
    estateId: 'e', actor: { kind: 'person', id: 'operator' },
    rpc: async (name, a) => { calls.push({ name, a }); return { data: answer(name), error: null } },
    taskTitle: async () => 'Ship it', projectOf: async () => 'p', stopOf: async () => stop,
    ...(settled ? { settled } : {})
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
  assert.deepEqual(await ex['run.attest'].check(args), { ok: false, why: 'already_attested' })
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
// 0.3.7 review UX-1 / ER-7: «Отменить» on «Работа закончена» puts the console back where it stood. The console's
// termination lives in the main process; before this, only the attestation wrote it, so after the undo the console kept
// «the work is over» and offered dismissal of a session whose Stop was unresolved again.
{
  const terms = new Map()
  const unknown = { sessionId: 's', state: 'outcome_unknown', reasonCode: 'provider_termination_unproved', managed: true, taskId: 't', runId: 'r', commandId: 'c', receiptSeq: 3 }
  terms.set('s', unknown)
  const view = createRunOverConsole({ get: (id) => terms.get(id), set: (t) => terms.set(t.sessionId, t) })
  let seq = 7
  const answer = (name) => name === 'attest_task_run_over' ? { recorded: true, receipt_seq: seq } : { revoked: true, receipt_seq: seq }
  const attest = harness({ state: 'outcome_unknown', basis: null }, answer, view.settled)
  await attest.ex['run.attest'].run(args)
  assert.equal(terms.get('s').state, 'stopped', 'the attestation settles the console')
  assert.equal(terms.get('s').basis, 'attested')
  assert.equal(terms.get('s').receiptSeq, 7)
  seq = 9
  const undo = harness({ state: 'stopped', basis: 'attested' }, answer, view.settled)
  await undo.ex['run.unattest'].run(args)
  const back = terms.get('s')
  assert.equal(back.state, 'outcome_unknown', 'the undo puts the console back to an unknown end')
  assert.equal(back.reasonCode, 'provider_termination_unproved', 'with the reason it had before the attestation')
  assert.equal(back.basis, undefined, 'and no basis: nobody settled it now')
  assert.deepEqual([back.managed, back.taskId, back.runId, back.commandId], [true, 't', 'r', 'c'], 'the run it can be said over for again')
  assert.equal(back.receiptSeq, 9, 'newer than the attestation, so a console that saw it accepts the way back')
  // A redo (undo of the undo, from История) settles the console again.
  seq = 11
  await attest.ex['run.attest'].run(args)
  assert.equal(terms.get('s').state, 'stopped')
  assert.equal(terms.get('s').receiptSeq, 11)
  // Another run's act leaves this console alone.
  await undo.ex['run.unattest'].run({ ...args, command_id: 'other' })
  assert.equal(terms.get('s').state, 'stopped', 'an act on another Stop command does not touch this console')
  // A refused act settles nothing.
  const refused = harness({ state: 'stopped', basis: 'attested' }, () => ({ revoked: false, reason_code: 'task_moved_on' }), view.settled)
  await assert.rejects(refused.ex['run.unattest'].run(args))
  assert.equal(terms.get('s').state, 'stopped', 'a refused undo leaves the settled console as it is')
}
// The attestation's refusal reaches the person as a code the act line words (act.why.<code>), not as an exception.
assert.deepEqual(runOverRefusal({ ok: false, reason: 'failed', says: 'run_still_running' }), { why: 'run_still_running' })
assert.deepEqual(runOverRefusal({ ok: false, reason: 'run_resolved' }), { why: 'run_resolved' })
assert.deepEqual(runOverRefusal({ ok: false, reason: 'failed', says: 'connect ECONNREFUSED 127.0.0.1:54321' }), { why: 'failed', says: 'connect ECONNREFUSED 127.0.0.1:54321' })
console.log('PASS the run-over acts: settled runs refused, the person the actor, each the other\'s inverse (CO-327)')
