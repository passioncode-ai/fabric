// The main-side chat binding (first-slice plan C1) over the REAL conversation service and a
// fake RPC. No Electron, no database, no provider: the binding is the renderer-facing edge of
// trusted main, and this checks what it lets through.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createCeoConversationService } from '../src/main/ceoConversationService.ts'
import { createCeoChatBinding, CEO_CHAT_METHODS } from '../src/main/ceoChatBinding.ts'
import { canonicalCeoSend } from '../src/shared/ceoConversation.ts'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = id(1), U = id(2), C = id(3), C2 = id(30)
const ctx = { schema: 'CeoContext@1', mode: 'none', selection_revision: 0, project_id: null, project_revision: null, estate_seq: 0 }
const draft = (text = 'Что изменилось в Atlas?') => ({ text, context: structuredClone(ctx), expected_revision: 0, subject_revision: 1 })
const roots = []
const later = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

function fixture({ dir = mkdtempSync(path.join(tmpdir(), 'fabric-ceo-binding-')), active = true } = {}) {
  if (!roots.includes(dir)) roots.push(dir)
  const held = { estateId: E, personId: U, revision: 1, actor: { kind: 'person', id: U } }
  const state = { valid: true, active, send: null, read: null }, calls = []
  const receipt = p => ({ ok: true, conversation_id: p.conversation_id, operation_id: p.operation_id, message_id: p.message_id, request_id: id(90),
    revision: p.expected_revision + 1, receipt_seq: 10, canonical_digest: createHash('sha256').update(canonicalCeoSend(E, U, p)).digest('hex'),
    state: 'accepted_pending', dispatch: 'unavailable', repeated: false })
  const rpc = {
    open: async a => { calls.push('open'); return { data: { ok: true, conversation_id: a.p_conversation_id, revision: 0, receipt_seq: 1, repeated: false } } },
    send: async (a, f) => { calls.push('send'); return state.send ? state.send(a, f) : { data: receipt(a.p_envelope) } },
    receipt: async () => { calls.push('receipt'); return { data: { ok: false, reason_code: 'not_found' } } },
    read: async a => { calls.push('read'); return state.read ? state.read(a) : { data: { ok: true, conversation_id: a.p_conversation_id, revision: 0,
      subject: { kind: 'global', id: a.p_conversation_id, owner_project_id: null, current: { revision: 0, project_id: null, active: true } }, messages: [], next_ordinal: null } } },
  }
  // The real host allows ONE identity check at a time and answers a concurrent one with null
  // (ceoConversationHost.ts, pendingGuard). The fixture keeps that rule, or the queue proves nothing.
  let checking = false
  const guard = async () => { if (checking) return null; checking = true; try { await new Promise(r => setTimeout(r, 5)); return state.valid && !state.revokedAtCheck ? held : null } finally { checking = false } }
  const service = createCeoConversationService({ rootDir: dir, rpc, online: () => true, timeoutMs: 400,
    identity: { held: () => state.valid ? held : null, guard } })
  const serviceCalls = []
  const counted = Object.fromEntries(Object.entries(service).map(([k, fn]) => [k, (...a) => { serviceCalls.push(k); return fn(...a) }]))
  const binding = createCeoChatBinding({ service: counted, activation: () => state.active ? { active: true, reason: null } : { active: false, reason: 'private_recovery_unavailable' } })
  return { dir, state, calls, serviceCalls, binding }
}
const call = (f, method, args) => f.binding.call(method, args)
async function frozen(f, cid = C, op = id(4), msg = id(5), text) {
  const r = await call(f, 'readDraft', { conversationId: cid })
  const s = await call(f, 'saveDraft', { conversationId: cid, expectedRevision: r.value.revision, draft: draft(text) })
  assert.equal(s.ok, true, JSON.stringify(s))
  const z = await call(f, 'freezeSend', { conversationId: cid, expectedRevision: s.value.revision, operationId: op, messageId: msg })
  assert.equal(z.ok, true, JSON.stringify(z))
  return z
}
let groups = 0
const test = async (name, fn) => { await fn(); groups++; console.log('PASS ' + name) }
try {
  await test('an unknown method, an extra field, or any identity, RPC or credential field refuses with no effect', async () => {
    const f = fixture()
    assert.deepEqual(await call(f, 'deleteEverything', {}), { ok: false, state: 'refused', reason_code: 'invalid_input' })
    assert.deepEqual(await call(f, 'readDraft', { conversationId: C, extra: 1 }), { ok: false, state: 'refused', reason_code: 'invalid_input' })
    for (const forged of [{ estateId: E }, { personId: U }, { p_person_id: U }, { url: 'http://x' }, { serviceKey: 'k' }])
      assert.deepEqual(await call(f, 'saveDraft', { conversationId: C, expectedRevision: null, draft: { ...draft(), ...forged } }),
        { ok: false, state: 'refused', reason_code: 'invalid_input' }, JSON.stringify(forged))
    for (const bad of [null, [], 'x', Object.create({ conversationId: C })])
      assert.deepEqual(await call(f, 'readDraft', bad), { ok: false, state: 'refused', reason_code: 'invalid_input' })
    let touched = false; const getter = {}; Object.defineProperty(getter, 'conversationId', { enumerable: true, get() { touched = true; return C } })
    assert.equal((await call(f, 'readDraft', getter)).reason_code, 'invalid_input'); assert.equal(touched, false, 'no accessor runs')
    assert.deepEqual(f.serviceCalls, []); assert.deepEqual(f.calls, [])
    assert.ok(Object.isFrozen(CEO_CHAT_METHODS))
  })

  await test('a closed gate refuses every RPC-bearing call with zero RPC; drafts stay local and keep working', async () => {
    const f = fixture({ active: false })
    assert.deepEqual(f.binding.status(), { active: false, reason: 'private_recovery_unavailable' })
    const r = await call(f, 'readDraft', { conversationId: C }); assert.equal(r.ok, true)
    const s = await call(f, 'saveDraft', { conversationId: C, expectedRevision: r.value.revision, draft: draft() }); assert.equal(s.ok, true)
    for (const [method, args] of [['freezeSend', { conversationId: C, expectedRevision: s.value.revision, operationId: id(4), messageId: id(5) }],
      ['send', { conversationId: C, operationId: id(4) }], ['reconcile', { conversationId: C, operationId: id(4) }], ['retry', { conversationId: C, operationId: id(4) }],
      ['open', { operationId: id(6), conversationId: C, subjectKind: 'global', subjectId: C }], ['read', { conversationId: C, afterOrdinal: 0, limit: 50 }]])
      assert.deepEqual(await call(f, method, args), { ok: false, state: 'refused', reason_code: 'private_recovery_unavailable', conversation_id: C }, method)
    assert.deepEqual(f.calls, [], 'no RPC while the gate is closed')
    assert.equal((await call(f, 'readDraft', { conversationId: C })).value.draft.text, 'Что изменилось в Atlas?')
  })

  await test('denied or revoked authority is a uniform unavailable that carries no content', async () => {
    const f = fixture(); await frozen(f); f.state.valid = false
    for (const [method, args] of [['readDraft', { conversationId: C }], ['send', { conversationId: C, operationId: id(4) }], ['read', { conversationId: C, afterOrdinal: 0, limit: 50 }]]) {
      const r = await call(f, method, args)
      assert.equal(r.ok, false); assert.equal(r.reason_code, 'unavailable', method)
      assert.doesNotMatch(JSON.stringify(r), /Atlas|draft|text/, method + ' leaks content')
    }
  })

  await test('authority revoked between the held reading and the check is the same uniform unavailable', async () => {
    const f = fixture(); f.state.revokedAtCheck = true
    const r = await call(f, 'readDraft', { conversationId: C })
    assert.deepEqual(r, { ok: false, state: 'refused', reason_code: 'unavailable', conversation_id: C }, 'the service says authority_changed; the renderer is told only unavailable')
  })

  await test('the gate is checked when a call reaches the head of the queue, and a closed gate is answered before the queue', async () => {
    const f = fixture(), gate = later()
    f.state.read = async a => { await gate.promise; return { data: { ok: true, conversation_id: a.p_conversation_id, revision: 0,
      subject: { kind: 'global', id: a.p_conversation_id, owner_project_id: null, current: { revision: 0, project_id: null, active: true } }, messages: [], next_ordinal: null } } }
    const first = call(f, 'read', { conversationId: C, afterOrdinal: 0, limit: 50 })
    const waiting = call(f, 'open', { operationId: id(6), conversationId: C, subjectKind: 'global', subjectId: C })
    const filler = Array.from({ length: 30 }, () => call(f, 'readDraft', { conversationId: C }))
    while (!f.calls.includes('read')) await new Promise(r => setTimeout(r, 5)) // the first call is really running
    f.state.active = false
    assert.equal((await call(f, 'send', { conversationId: C, operationId: id(4) })).reason_code, 'private_recovery_unavailable', 'a full queue with a closed gate says why, not busy')
    gate.resolve()
    const firstResult = await first; assert.equal(firstResult.ok, true, JSON.stringify(firstResult))
    assert.deepEqual(await waiting, { ok: false, state: 'refused', reason_code: 'private_recovery_unavailable', conversation_id: C }, 'the gate closed while it waited')
    await Promise.all(filler)
    assert.ok(!f.calls.includes('open'), 'no RPC after the gate closed')
  })

  await test('the inventory is local: it answers behind a closed gate and takes no arguments', async () => {
    const f = fixture({ active: false })
    const r = await call(f, 'inventory', {}); assert.equal(r.ok, true, JSON.stringify(r)); assert.deepEqual(r.value.drafts, [])
    assert.equal((await call(f, 'inventory', { personId: U })).reason_code, 'invalid_input')
    assert.deepEqual(f.calls, [])
  })

  await test('a stale draft is draft_conflict and the newer text survives', async () => {
    const f = fixture(), r = await call(f, 'readDraft', { conversationId: C })
    const first = await call(f, 'saveDraft', { conversationId: C, expectedRevision: r.value.revision, draft: draft('новый текст') })
    assert.equal(first.ok, true)
    const stale = await call(f, 'saveDraft', { conversationId: C, expectedRevision: r.value.revision, draft: draft('старый текст') })
    assert.equal(stale.reason_code, 'draft_conflict')
    assert.equal((await call(f, 'readDraft', { conversationId: C })).value.draft.text, 'новый текст')
  })

  await test('an autosave during a send settles, in order, instead of failing as authority_changed', async () => {
    const f = fixture(), z = await frozen(f), gate = later()
    f.state.send = async a => { await gate.promise; return { data: { ok: true, conversation_id: a.p_envelope.conversation_id, operation_id: a.p_envelope.operation_id,
      message_id: a.p_envelope.message_id, request_id: id(90), revision: 1, receipt_seq: 10,
      canonical_digest: createHash('sha256').update(canonicalCeoSend(E, U, a.p_envelope)).digest('hex'), state: 'accepted_pending', dispatch: 'unavailable', repeated: false } } }
    const sending = call(f, 'send', { conversationId: C, operationId: id(4) })
    const autosave = call(f, 'saveDraft', { conversationId: C2, expectedRevision: z.value.revision, draft: draft('черновик другого разговора') })
    setTimeout(() => gate.resolve(), 50)
    const [sent, saved] = await Promise.all([sending, autosave])
    assert.equal(sent.state, 'accepted_pending', JSON.stringify(sent))
    // The send rewrote the local file, so the autosave's revision is stale: draft_conflict is the
    // honest answer. What it must never be is a false authority refusal from a concurrent check.
    assert.ok(saved.ok || saved.reason_code === 'draft_conflict', JSON.stringify(saved))
    assert.notEqual(saved.reason_code, 'authority_changed')
    const fresh = await call(f, 'readDraft', { conversationId: C2 })
    assert.equal((await call(f, 'saveDraft', { conversationId: C2, expectedRevision: fresh.value.revision, draft: draft('черновик другого разговора') })).ok, true)
  })

  await test('a bounded queue: past its limit a call is refused busy, never silently dropped', async () => {
    const f = fixture(), gate = later()
    f.state.read = async a => { await gate.promise; return { data: { ok: true, conversation_id: a.p_conversation_id, revision: 0,
      subject: { kind: 'global', id: a.p_conversation_id, owner_project_id: null, current: { revision: 0, project_id: null, active: true } }, messages: [], next_ordinal: null } } }
    const queued = Array.from({ length: 32 }, () => call(f, 'read', { conversationId: C, afterOrdinal: 0, limit: 50 }))
    assert.deepEqual(await call(f, 'readDraft', { conversationId: C }), { ok: false, state: 'refused', reason_code: 'busy', conversation_id: C })
    gate.resolve()
    assert.ok((await Promise.all(queued)).every(r => r.ok))
  })

  await test('after a restart over the same files the frozen send is still there, and reconcile asks, it does not resend', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'fabric-ceo-binding-'))
    const before = fixture({ dir }); await frozen(before)
    before.state.send = () => new Promise(() => {}) // the reply is lost
    assert.equal((await call(before, 'send', { conversationId: C, operationId: id(4) })).state, 'commit_unknown')
    const after = fixture({ dir })
    const r = await call(after, 'readDraft', { conversationId: C })
    assert.equal(r.value.intents.length, 1); assert.equal(r.value.intents[0].status, 'commit_unknown')
    await call(after, 'reconcile', { conversationId: C, operationId: id(4) })
    assert.deepEqual(after.calls, ['receipt'], 'reconcile reads the receipt and never sends')
  })

  await test('a late reply for a conversation the operator has left is dropped, not shown', async () => {
    const f = fixture(), gate = later()
    f.state.read = async a => { await gate.promise; return { data: { ok: true, conversation_id: a.p_conversation_id, revision: 0,
      subject: { kind: 'global', id: a.p_conversation_id, owner_project_id: null, current: { revision: 0, project_id: null, active: true } }, messages: [], next_ordinal: null } } }
    f.binding.select(C)
    const late = call(f, 'read', { conversationId: C, afterOrdinal: 0, limit: 50 })
    f.binding.select(C2); gate.resolve()
    assert.deepEqual(await late, { ok: false, state: 'refused', reason_code: 'superseded', conversation_id: C })
    f.binding.select(C2)
    assert.equal((await call(f, 'read', { conversationId: C2, afterOrdinal: 0, limit: 50 })).ok, true, 'the current conversation still reads')
    assert.throws(() => f.binding.select('not-an-id'), /invalid_input/)
  })

  console.log(`PASS ceo chat binding: ${groups} groups over the real conversation service and a fake RPC; no Electron, database or provider`)
} finally { for (const dir of roots) rmSync(dir, { recursive: true, force: true }) }
