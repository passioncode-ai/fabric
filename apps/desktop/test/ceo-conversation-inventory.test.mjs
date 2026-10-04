// First-slice plan C3: the local history and cleanup inventory. It lists this Person's kept
// drafts and sends with what each allows — discard, forget, send or reconcile — from the local
// files alone. A server-side conversation list is not in this plan; the limit is stated in the UI.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createCeoConversationService } from '../src/main/ceoConversationService.ts'
import { CEO_DRAFT_LIMITS } from '../src/shared/ceoConversationDraft.ts'

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const E = id(1), U = id(2), V = id(9)
const ctx = { schema: 'CeoContext@1', mode: 'none', selection_revision: 0, project_id: null, project_revision: null, estate_seq: 0 }
const draft = text => ({ text, context: structuredClone(ctx), expected_revision: 0, subject_revision: 1 })
const roots = []
function service(dir, person = U) {
  const held = { estateId: E, personId: person, revision: 1, actor: { kind: 'person', id: person } }
  const rpc = { open: async () => ({ data: null }), read: async () => ({ data: null }), receipt: async () => ({ data: null }), send: () => new Promise(() => {}) }
  // 3 s, not 300 ms: dozens of sequential local saves on a loaded host overran 300 ms and answered
  // local_save_unknown (2026-10-04); the one send that must time out still does, against an RPC that never answers.
  return createCeoConversationService({ rootDir: dir, rpc, online: () => true, timeoutMs: 3000, identity: { held: () => held, guard: async () => held } })
}
const fresh = () => { const dir = mkdtempSync(path.join(tmpdir(), 'fabric-ceo-inventory-')); roots.push(dir); return dir }
let groups = 0
const test = async (name, fn) => { await fn(); groups++; console.log('PASS ' + name) }
try {
  await test('an empty namespace is an empty inventory with its limits, not an error', async () => {
    const r = await service(fresh()).inventory()
    assert.equal(r.ok, true, JSON.stringify(r))
    assert.deepEqual(r.value.capacity, { drafts: 0, draftLimit: CEO_DRAFT_LIMITS.records, unresolved: 0, unresolvedLimit: CEO_DRAFT_LIMITS.unresolved, full: false })
    assert.deepEqual([r.value.drafts, r.value.sends], [[], []])
  })

  await test('at full capacity every draft and every unresolved send is listed with what it allows', async () => {
    const s = service(fresh())
    let revision = (await s.readDraft(id(100))).value.revision
    for (let n = 0; n < CEO_DRAFT_LIMITS.records; n++) {
      const r = await s.saveDraft(id(100 + n), revision, draft(`Черновик номер ${n}`)); assert.equal(r.ok, true, JSON.stringify(r)); revision = r.value.revision
    }
    for (let n = 0; n < CEO_DRAFT_LIMITS.unresolved; n++) {
      const r = await s.freezeSend(id(100 + n), revision, { operationId: id(300 + n), messageId: id(500 + n) }); assert.equal(r.ok, true, JSON.stringify(r)); revision = r.value.revision
    }
    const inv = await s.inventory()
    assert.equal(inv.ok, true)
    assert.equal(inv.value.drafts.length, CEO_DRAFT_LIMITS.records); assert.equal(inv.value.sends.length, CEO_DRAFT_LIMITS.unresolved)
    assert.deepEqual(inv.value.capacity, { drafts: 32, draftLimit: 32, unresolved: 8, unresolvedLimit: 8, full: true })
    const blocked = inv.value.drafts.filter(d => d.blockedBy === 'unresolved_send')
    assert.equal(blocked.length, 8, 'a draft behind an unresolved send cannot be discarded')
    assert.ok(blocked.every(d => d.actions.length === 0))
    assert.ok(inv.value.drafts.filter(d => d.blockedBy === null).every(d => d.actions.join() === 'discard'))
    assert.ok(inv.value.sends.every(x => x.status === 'saved_locally' && x.actions.join() === 'send'), 'a saved send can be sent, never forgotten')
    assert.equal(inv.value.drafts[0].preview, 'Черновик номер 0')
    // The listed ids are exactly the stored ones, in a stable order.
    assert.deepEqual(inv.value.drafts.map(d => d.conversation_id), Array.from({ length: 32 }, (_, n) => id(100 + n)))
  })

  await test('an unknown send must be reconciled: the inventory says so and discard refuses unresolved_send', async () => {
    const s = service(fresh()), C = id(100)
    const r0 = await s.readDraft(C), r1 = await s.saveDraft(C, r0.value.revision, draft('Вопрос с потерянным ответом'))
    const r2 = await s.freezeSend(C, r1.value.revision, { operationId: id(300), messageId: id(500) })
    assert.equal((await s.send(C, id(300))).state, 'commit_unknown')
    const inv = await s.inventory()
    assert.deepEqual(inv.value.sends.map(x => [x.status, x.actions.join()]), [['commit_unknown', 'reconcile']])
    assert.equal(inv.value.drafts[0].blockedBy, 'unresolved_send')
    assert.equal((await s.discardDraft(C, inv.value.revision)).reason_code, 'unresolved_send')
    assert.equal((await s.forgetSettled(C, id(300), inv.value.revision)).reason_code, 'unresolved_send')
    void r2
  })

  await test('an unreadable namespace is local_recovery_required, never an empty inventory', async () => {
    const dir = fresh(), s = service(dir), C = id(100)
    const r = await s.readDraft(C); await s.saveDraft(C, r.value.revision, draft('текст'))
    const ns = path.join(dir, 'ceo-conversations', E, U)
    for (const f of readdirSync(ns)) writeFileSync(path.join(ns, f), '{broken', { mode: 0o600 })
    const inv = await s.inventory()
    assert.deepEqual(inv, { ok: false, state: 'refused', reason_code: 'local_recovery_required' })
  })

  await test("another Person's namespace is never listed", async () => {
    const dir = fresh(), mine = service(dir, U), theirs = service(dir, V)
    const r = await theirs.readDraft(id(100)); await theirs.saveDraft(id(100), r.value.revision, draft('чужой черновик'))
    const inv = await mine.inventory()
    assert.equal(inv.ok, true); assert.deepEqual([inv.value.drafts, inv.value.sends], [[], []])
    assert.doesNotMatch(JSON.stringify(inv), /чужой/)
    assert.equal((await theirs.inventory()).value.drafts.length, 1)
  })
  console.log(`PASS local history and cleanup inventory: ${groups} groups over the real service and its files`)
} finally { for (const dir of roots) rmSync(dir, { recursive: true, force: true }) }
