// First-slice plan B0 (proposal T1, ADR-0081): the owned loopback backend has its own runtime
// profile, and the execution root, its structured connection and a view are separate things.
import assert from 'node:assert/strict'
import { validateProviderBinding } from '../src/shared/providerExecution.ts'
import { createExecutionRoot, foldExecutionRoot } from '../src/shared/providerLoopback.ts'
import { createCodexProviderControl } from '../src/main/codexProviderControl.ts'

const digest = 'a'.repeat(64), ref = `sha256:${'c'.repeat(64)}`
const backend = { listener: 'loopback-ws', epoch: 'epoch-1', processRef: 'process:' + 'd'.repeat(16) }
const loopback = { schema: 'ProviderExecution@1', fabric: { estateId: 'estate', taskId: 'task', runId: 'run', sessionId: 'fabric-session' },
  provider: { id: 'codex-cli', build: '0.157.1', runtimeProfile: 'owned-loopback', backend },
  native: { status: 'observed', connectionId: 'controller:connection-1', sessionId: null, threadId: 'thread-1', turnId: 'turn-1' },
  execution: { kind: 'native-turn', id: 'turn-1' }, manifestDigest: digest, policyDigest: 'b'.repeat(64) }
const clone = v => structuredClone(v)
let groups = 0
const test = (name, fn) => { fn(); groups++; console.log('PASS ' + name) }

test('the loopback profile validates only with its own backend fields', () => {
  assert.equal(validateProviderBinding(loopback).ok, true)
  const bare = clone(loopback); delete bare.provider.backend
  assert.equal(validateProviderBinding(bare).reasonCode, 'loopback_backend_required')
  for (const mutate of [b => { b.provider.backend.listener = 'unix-socket' }, b => { b.provider.backend.epoch = '' }, b => { b.provider.backend.processRef = 'pid-42' },
    b => { b.provider.backend.token = 'secret' }])
  { const b = clone(loopback); mutate(b); assert.equal(validateProviderBinding(b).reasonCode, 'loopback_backend_required') }
})

test('a loopback backend can never be labelled owned-stdio (or any other profile) to pass older validators', () => {
  for (const profile of ['owned-stdio', 'owned-pty', 'shared-daemon', 'remote']) {
    const b = clone(loopback); b.provider.runtimeProfile = profile
    assert.equal(validateProviderBinding(b).reasonCode, 'profile_mismatch', profile)
  }
  // And the measured owned-stdio Codex control refuses the loopback profile outright.
  const control = createCodexProviderControl({ binding: loopback, ownership: { binding: loopback, sourceSequence: 0, observationCursor: 0, handles: [] } })
  assert.deepEqual(control, { ok: false, reasonCode: 'unsupported_control_profile' })
})

test('a view identity cannot bind as execution', () => {
  const b = clone(loopback); b.native.connectionId = 'view:tui-1'
  assert.equal(validateProviderBinding(b).reasonCode, 'view_cannot_bind_execution')
  const stdio = clone(loopback); stdio.provider = { id: 'codex-cli', build: '0.157.1', runtimeProfile: 'owned-stdio' }; stdio.native.connectionId = 'view:tui-1'
  assert.equal(validateProviderBinding(stdio).reasonCode, 'view_cannot_bind_execution', 'under every profile')
})

test('a view closing or detaching never ends the execution', () => {
  let s = createExecutionRoot({ processRef: backend.processRef, epoch: 'epoch-1' })
  for (const r of [{ kind: 'view_attached', viewId: 'view:tui-1', epoch: 'epoch-1', evidenceRef: ref }, { kind: 'view_detached', viewId: 'view:tui-1', epoch: 'epoch-1', evidenceRef: ref }]) {
    const f = foldExecutionRoot(s, r); assert.equal(f.accepted, true, f.reasonCode); s = f.state
  }
  assert.equal(s.status, 'running')
  assert.deepEqual(s.views, [])
})

test('a view of an older backend epoch cannot signal the newer backend', () => {
  const s = createExecutionRoot({ processRef: backend.processRef, epoch: 'epoch-2' })
  const f = foldExecutionRoot(s, { kind: 'view_detached', viewId: 'view:tui-1', epoch: 'epoch-1', evidenceRef: ref })
  assert.deepEqual([f.accepted, f.reasonCode], [false, 'stale_epoch'])
  assert.deepEqual(foldExecutionRoot(s, { kind: 'backend_exit', epoch: 'epoch-1', exitCode: 0, evidenceRef: ref }).reasonCode, 'stale_epoch')
})

test('Stop is requested, then settled only by the backend\'s own exit — never by a view', () => {
  let s = createExecutionRoot({ processRef: backend.processRef, epoch: 'epoch-1' })
  s = foldExecutionRoot(s, { kind: 'stop_requested', commandId: 'stop-1', evidenceRef: ref }).state
  assert.equal(s.status, 'stopping')
  s = foldExecutionRoot(s, { kind: 'view_detached', viewId: 'view:tui-1', epoch: 'epoch-1', evidenceRef: ref }).state
  assert.equal(s.status, 'stopping', 'a view leaving is not the backend stopping')
  s = foldExecutionRoot(s, { kind: 'backend_exit', epoch: 'epoch-1', exitCode: 0, evidenceRef: ref }).state
  assert.equal(s.status, 'exited'); assert.equal(s.exit.evidenceRef, ref)
  assert.equal(foldExecutionRoot(s, { kind: 'view_attached', viewId: 'view:tui-2', epoch: 'epoch-1', evidenceRef: ref }).reasonCode, 'execution_ended', 'no view attaches to an ended execution')
})

test('a lost backend turns input off without claiming a stop', () => {
  let s = createExecutionRoot({ processRef: backend.processRef, epoch: 'epoch-1' })
  s = foldExecutionRoot(s, { kind: 'backend_lost', epoch: 'epoch-1', evidenceRef: ref }).state
  assert.equal(s.status, 'backend_lost'); assert.equal(s.inputAllowed, false); assert.equal(s.exit, null)
  s = foldExecutionRoot(s, { kind: 'backend_exit', epoch: 'epoch-1', exitCode: 1, evidenceRef: ref }).state
  assert.equal(s.status, 'exited', 'a later exit receipt is the settlement')
})

test('receipts are closed shapes; the state is frozen', () => {
  const s = createExecutionRoot({ processRef: backend.processRef, epoch: 'epoch-1' })
  for (const bad of [{ kind: 'view_detached', viewId: 'tui-1', epoch: 'epoch-1', evidenceRef: ref }, { kind: 'backend_exit', epoch: 'epoch-1', exitCode: 0, evidenceRef: 'nope' },
    { kind: 'teleport', evidenceRef: ref }, { kind: 'stop_requested', commandId: 'stop-1', evidenceRef: ref, extra: 1 }])
    assert.equal(foldExecutionRoot(s, bad).accepted, false, JSON.stringify(bad))
  assert.ok(Object.isFrozen(s))
  assert.throws(() => createExecutionRoot({ processRef: 'pid', epoch: 'epoch-1' }))
})
console.log(`PASS owned loopback profile and execution root: ${groups} groups`)
