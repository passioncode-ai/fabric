// «Отключить» and «Пустить снова» (ADR-0160 §3, SCN-167; 0.3.7 wave 3): disconnecting a coding agent revokes every
// credential it holds and keeps it out until the person lets it back in; letting it in is the disconnect's inverse,
// and the disconnect is let-in's. Both are acts with their undo, recorded with the person as actor. Pure: no Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createActs } from '../src/main/acts.ts'
import { createAgentExecutors, createKeptOut } from '../src/main/keptOut.ts'
import { validateKeptOutFile } from '../src/shared/keptOut.ts'

const ME = { kind: 'person', id: 'operator' }

function memoryStore(initial = {}) {
  let value = initial, revision = 0
  return {
    read: () => ({ value, revision: String(revision), status: 'ready', lastGoodAt: null }),
    update: (change) => { value = change(value); revision++; return { status: 'committed', revision: String(revision) } }
  }
}
function memoryLog() {
  const rows = []
  let seq = 0
  return {
    rows,
    async append(record, projectId, actor) { const row = { seq: ++seq, occurredAt: new Date().toISOString(), actor, projectId, record }; rows.push(row); return { seq: row.seq } },
    async page() { return [...rows].reverse() },
    async reversersOf(seqs) { return rows.filter((r) => seqs.includes(r.record.undoes)) },
    async get(seq) { return rows.find((r) => r.seq === seq) ?? null }
  }
}
function harness() {
  const bindings = new Map([['b1', 'codex'], ['b2', 'codex'], ['b3', 'claude-code']])
  const revoked = []
  const kept = createKeptOut(memoryStore(), () => '2026-10-18T10:00:00Z')
  const log = memoryLog()
  const acts = createActs({
    log, actor: ME, onRecordFailed: (k, e) => { throw e },
    executors: createAgentExecutors({
      keptOut: kept,
      liveBindingsOf: async (agentId) => [...bindings].filter(([, a]) => a === agentId).map(([id]) => id),
      revoke: async (bindingId) => { revoked.push(bindingId); bindings.delete(bindingId); return { ok: true } },
      nameOf: (agentId) => ({ codex: 'Codex', 'claude-code': 'Claude Code' })[agentId] ?? null
    })
  })
  return { acts, kept, log, revoked, bindings }
}

test('Отключить revokes every credential the agent holds and keeps it out, with «Пустить снова» as its undo', async () => {
  const h = harness()
  const r = await h.acts.perform('agent.disconnect', { agent_id: 'codex' })
  assert.equal(r.ok, true)
  assert.deepEqual(h.revoked.sort(), ['b1', 'b2'])
  assert.equal(h.kept.has('codex'), true)
  assert.equal(h.kept.has('claude-code'), false)
  const rec = h.log.rows[0]
  assert.deepEqual(rec.actor, ME)
  assert.equal(rec.record.kind, 'agent.disconnect')
  assert.deepEqual(rec.record.inverse, { kind: 'agent.let_in', args: { agent_id: 'codex' } })
  assert.equal(rec.record.said.params.agent, 'Codex')
  assert.equal(rec.record.why_not, null, 'the disconnect is no longer «credential_gone»: it has a real inverse')
})

test('«Отменить» on the disconnect lets the agent back in, and that undo can itself be undone', async () => {
  const h = harness()
  await h.acts.perform('agent.disconnect', { agent_id: 'codex' })
  const undo = await h.acts.undo(h.log.rows[0].seq)
  assert.equal(undo.ok, true)
  assert.equal(h.kept.has('codex'), false)
  assert.equal(h.log.rows[1].record.kind, 'agent.let_in')
  assert.equal(h.log.rows[1].record.undoes, h.log.rows[0].seq)
  const redo = await h.acts.undo(h.log.rows[1].seq)
  assert.equal(redo.ok, true)
  assert.equal(h.kept.has('codex'), true, 'redone: kept out again')
})

test('disconnecting twice or letting in an agent that is not out is refused with a reason, never doubled', async () => {
  const h = harness()
  assert.deepEqual(await h.acts.perform('agent.let_in', { agent_id: 'codex' }), { ok: false, reason: 'already_in' })
  await h.acts.perform('agent.disconnect', { agent_id: 'codex' })
  assert.deepEqual(await h.acts.perform('agent.disconnect', { agent_id: 'codex' }), { ok: false, reason: 'already_out' })
  assert.deepEqual(await h.acts.perform('agent.disconnect', { agent_id: '' }), { ok: false, reason: 'invalid' })
})

test('an agent with no credential can still be kept out', async () => {
  const h = harness()
  const r = await h.acts.perform('agent.disconnect', { agent_id: 'kimi-code' })
  assert.equal(r.ok, true)
  assert.equal(h.kept.has('kimi-code'), true)
  assert.deepEqual(h.revoked, [])
})

test('the kept-out list says who and since when, and its file is validated', async () => {
  const h = harness()
  await h.acts.perform('agent.disconnect', { agent_id: 'codex' })
  assert.deepEqual(h.kept.list(), [{ agentId: 'codex', name: 'Codex', at: '2026-10-18T10:00:00Z' }])
  assert.equal(validateKeptOutFile([]), null)
  assert.equal(validateKeptOutFile({ codex: { at: 3 } }), null)
  assert.deepEqual(validateKeptOutFile({ codex: { name: null, at: 'x' } }), { codex: { name: null, at: 'x' } })
})

test('a kept-out file that cannot be read keeps NO agent out and says so (fail-open, the act stays recorded)', () => {
  const kept = createKeptOut({ read: () => ({ value: {}, revision: '0', status: 'unreadable', lastGoodAt: null, error: 'x' }), update: () => ({ status: 'failed' }) })
  assert.equal(kept.has('codex'), false)
  assert.equal(kept.readable(), false)
})
