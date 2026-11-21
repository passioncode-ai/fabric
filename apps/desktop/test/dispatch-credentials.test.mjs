// CO-619 (board request 8eb58906, 2026-11-21): a board run's packet names the slots the target project declares for the
// request's capability, so Observatory can hand them to the run (`credentials`, names only, opening write alone).
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'

const { declaredSlots, packetCredentials, SLOTS_MAX } = await import(path.resolve(import.meta.dirname, '../src/shared/dispatchCredentials.ts'))
const { createBoardDispatch } = await import(path.resolve(import.meta.dirname, '../src/main/boardDispatchRun.ts'))

const decl = (caps) => JSON.stringify({ kind: 'dispatch-credentials/1', capabilities: caps })
const slot = (over = {}) => ({ env: 'prod', name: 'SERVICE_KEY', purpose: 'update the consumers list', ...over })

test('a declaration names the capability\'s slots, deduplicated, and nothing for a capability it does not name', () => {
  assert.deepEqual(declaredSlots(decl({ 'access.client-key': [slot(), slot(), slot({ name: 'CONSUMERS_LIST' })] }), 'access.client-key'),
    { ok: true, slots: [slot(), slot({ name: 'CONSUMERS_LIST' })] })
  assert.deepEqual(declaredSlots(decl({ 'access.client-key': [slot()] }), 'change.request'), { ok: true, slots: [] })
  // An inherited key is not a declaration.
  assert.deepEqual(declaredSlots(decl({}), 'constructor'), { ok: true, slots: [] })
})

test('a malformed declaration names nothing and says why; a slot of another project cannot be named', () => {
  assert.equal(declaredSlots('{', 'a.b').why, 'not-json')
  assert.equal(declaredSlots(JSON.stringify({ kind: 'other', capabilities: {} }), 'a.b').why, 'kind')
  assert.equal(declaredSlots(decl([]), 'a.b').why, 'capabilities')
  assert.equal(declaredSlots(decl({ 'a.b': [slot({ project: 'another-project' })] }), 'a.b').why, 'slot-field')
  assert.equal(declaredSlots(decl({ 'a.b': [slot({ name: 'lower' })] }), 'a.b').why, 'slot-name')
  assert.equal(declaredSlots(decl({ 'a.b': [slot({ env: 'Prod Env' })] }), 'a.b').why, 'slot-env')
  assert.equal(declaredSlots(decl({ 'a.b': [slot({ purpose: ' ' })] }), 'a.b').why, 'slot-purpose')
  assert.equal(declaredSlots(decl({ 'a.b': Array.from({ length: SLOTS_MAX + 1 }, (_, i) => slot({ name: `K${i}` })) }), 'a.b').why, 'slots')
  assert.equal(declaredSlots('x'.repeat(70 * 1024), 'a.b').why, 'too-large')
})

test('packetCredentials fills in the target project as Observatory resolved it', () => {
  assert.deepEqual(packetCredentials('project:target', [slot()]), [{ project: 'project:target', ...slot() }])
})

// The dispatcher, with the stand-ins of board-dispatch-run.test.mjs reduced to what the opening write needs.
const T0 = Date.parse('2026-11-05T10:00:00Z')
function world(declared, over = {}) {
  const w = { calls: [], logs: [], asked: [] }
  w.deps = {
    now: () => T0, switchOn: () => true,
    readRequests: async () => [{ id: '11111111-1111-4111-8111-111111111111', thread: '22222222-2222-4222-8222-222222222222', state: 'queued',
      target: 'p-target', capability: 'access.client-key', submittedAt: new Date(T0 - 5 * 60_000).toISOString(), deadline: new Date(T0 + 3 * 86_400_000).toISOString(), ...over }],
    responderLive: async () => false, sessionLive: () => false, folderOf: async () => '/work/target', defaultProvider: async () => 'claude-code',
    observatory: async (name, args) => {
      w.calls.push([name, args])
      if (name === 'observatory_resolve') return { canonical: 'project:target' }
      if (name === 'observatory_checkpoint_write') return args.workflowId ? { workflowId: args.workflowId, revision: 2 } : { workflowId: 'wf_0123456789abcdef', leaseId: 'lease-1' }
      if (name === 'observatory_handoff_create') return { handoffId: 'handoff:0000000000000001' }
      return {}
    },
    launch: async () => ({ launchId: 'L1' }), runState: async () => 'running', requestState: async () => 'queued',
    load: () => [], save: () => {}, log: (op, outcome, detail) => w.logs.push({ op, outcome, detail }),
    ...(declared === undefined ? {} : { declaredCredentials: async (p, c) => { w.asked.push([p, c]); if (declared instanceof Error) throw declared; return declared } })
  }
  return w
}
const opening = (w) => w.calls.find(([n, a]) => n === 'observatory_checkpoint_write' && !a.workflowId)[1]

test('the opening write names the target\'s declared slots for the request\'s capability as credentials', async () => {
  const w = world({ ok: true, slots: [slot()] })
  await createBoardDispatch(w.deps).onPass()
  assert.deepEqual(w.asked, [['p-target', 'access.client-key']])
  assert.deepEqual(opening(w).body.credentials, [{ project: 'project:target', env: 'prod', name: 'SERVICE_KEY', purpose: 'update the consumers list' }])
})

test('no declaration, an empty one, a failed read or an inbox run: no credentials, and the run still starts', async () => {
  for (const declared of [undefined, { ok: true, slots: [] }, { ok: false, why: 'kind' }, new Error('EACCES')]) {
    const w = world(declared)
    await createBoardDispatch(w.deps).onPass()
    assert.equal('credentials' in opening(w).body, false)
    assert.ok(w.calls.some(([n]) => n === 'observatory_handoff_create'))
    if (declared && (declared instanceof Error || declared.ok === false)) assert.ok(w.logs.some((l) => l.op === 'board.dispatch.credentials' && l.outcome === 'failed'))
  }
})
