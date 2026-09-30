// First-slice plan B4: native views on the owned backend. The actual registry owns a Node backend,
// the actual Stop port holds its input fence, and the actual native view host runs views in node-pty
// (a Python fixture, as in native-view-host.test.mjs). Runs under Node and inside Electron main.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, writeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createOwnedBackendProcessRegistry } from '../src/main/ownedBackendProcessRegistry.ts'
import { createProcessBoundary } from '../src/main/processBoundary.ts'
import { createBackendStopPort } from '../src/main/backendStopPort.ts'
import { createBackendViewAuthority, codexViewRecipe } from '../src/main/backendView.ts'
import { createNativeViewHost } from '../src/main/nativeViewHost.ts'
import { isMeasuredRuntime, runtimeTuple } from '../src/main/runtimeAdmission.ts'
if (process.platform !== 'darwin' || !isMeasuredRuntime()) { console.error('NOT_RUN: requires a measured Darwin runtime: ' + JSON.stringify(runtimeTuple())); process.exit(2) }
const require = createRequire(import.meta.url), pty = require('node-pty'), ptyVersion = require('node-pty/package.json').version
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-backend-view-')))
const node = realpathSync(process.env.FABRIC_BACKEND_NODE ?? process.execPath), nodeHash = createHash('sha256').update(readFileSync(node)).digest('hex')
const python = realpathSync('/usr/bin/python3'), pythonHash = createHash('sha256').update(readFileSync(python)).digest('hex')
const backendScript = path.join(dir, 'backend.mjs'); writeFileSync(backendScript, 'process.on("SIGTERM",()=>process.exit(0));setInterval(()=>{},1000)\n', { mode: 0o600 })
const view = path.join(dir, 'view.py'); writeFileSync(view, `import os,tty\ntty.setraw(0)\nos.write(1,b'READY\\n')\nwhile True:\n data=os.read(0,1024)\n if data==b'exit\\n': break\n os.write(1,b'SEEN:'+data+b'\\n')\n`, { mode: 0o600 })
const stubborn = path.join(dir, 'stubborn.py'); writeFileSync(stubborn, `import os,tty,signal,time\ntty.setraw(0)\nif os.fork()==0:\n signal.signal(signal.SIGTERM,signal.SIG_IGN)\n signal.signal(signal.SIGHUP,signal.SIG_IGN)\n os.write(1,b'CHILD_READY\\n')\n while True: time.sleep(1)\nelse:\n os.write(1,b'READY\\n')\n while True: time.sleep(1)\n`, { mode: 0o600 })
const host = { hostInstanceId: randomUUID(), bootId: randomUUID() }
const boundary = createProcessBoundary(), backends = [], views = [], registries = [], hosts = []
const delay = ms => new Promise(r => setTimeout(r, ms))
const until = async (fn, label, ms = 4000) => { const end = performance.now() + ms; while (performance.now() < end) { if (await fn()) return; await delay(10) } throw Error(label) }
const stamp = fd => { const s = fstatSync(fd); return `${s.dev}/${s.ino}/${s.rdev}/${s.mode}` }
let serial = 10
async function backend() {
  const root = path.join(dir, 'root-' + serial++); mkdirSync(root, { recursive: true, mode: 0o700 })
  const registry = createOwnedBackendProcessRegistry({ rootDir: root, estateId: id(1), recipe: { executable: node, executableSha256: nodeHash, argv: [backendScript], cwd: dir, env: { HOME: dir } },
    timeoutMs: 3000, host, authority: () => ({ personId: id(2), revision: 1 }) },
    { spawn: (...a) => { const c = spawn(...a), t = { child: c, exited: false }; backends.push(t); c.once('exit', () => t.exited = true); c.on('error', () => {}); return c }, boundary, fdIdentity: () => 'fd', write: () => 0 })
  registries.push(registry)
  const n = serial++, session = id(n + 2000), a = { admitted: true, project_id: id(3), task_id: id(n), task_run_id: id(n + 1000), session_id: session, run_ordinal: 1 }
  const s = await registry.start(a, session, async () => true); assert.equal(s.state, 'owned')
  const journal = { append: async e => ({ ...e }) }
  const port = createBackendStopPort({ registry, journal, estateId: id(1), actor: () => ({ kind: 'system', id: 'fixture' }), host })
  port.register({ sessionId: session, optionId: 'codex-cli', startedAt: new Date().toISOString(), projectId: id(3), handle: s.handle })
  const connection = { connectionId: 'controller:' + randomUUID(), closed: null }, authority = { value: { personId: id(2), revision: 1 } }
  const owner = createBackendViewAuthority({ registry, handle: s.handle, sessionId: session, fabric: { estateId: id(1), projectId: id(3), taskId: a.task_id, runId: a.task_run_id, runOrdinal: 1 },
    authority: () => authority.value, connection: () => connection, inputAllowed: sid => port.inputAllowed(sid) })
  return { registry, port, handle: s.handle, session, connection, authority, owner, child: backends[backends.length - 1] }
}
function viewHost(b, script = view) {
  const output = [], calls = { write: 0 }
  const native = { load: () => ({ version: ptyVersion, spawn: (...a) => { const h = pty.spawn(...a), t = { h, exited: false, owned: null }; views.push(t); h.onExit(() => t.exited = true); t.capture = boundary.capture(h.pid).then(o => { t.owned = o }, () => {}); return h } }),
    fdIdentity: stamp, write: (fd, bytes) => { calls.write++; return writeSync(fd, bytes) }, boundary }
  const h = createNativeViewHost({ owner: b.owner.initialOwner(), currentOwner: b.owner.currentOwner,
    recipe: { executable: python, executableSha256: pythonHash, argv: [script], cwd: dir, env: { PATH: '/usr/bin:/bin', HOME: dir }, cols: 80, rows: 24 },
    timeoutMs: 800, onOutput: (t, data) => output.push({ t, data }) }, native)
  hosts.push(h); return { host: h, output, calls }
}
// Learn every view's descendants while its root is alive, so cleanup can reach them later.
const learn = async () => { for (const t of views) { await t.capture; if (t.owned && !t.exited) await boundary.observe(t.owned, false) } }
const attached = async (v, name) => { const r = await v.host.lifecycle.attach(name); assert.equal(r.state, 'attached', JSON.stringify(r)); await until(() => v.output.some(x => x.t.attachment === r.ticket.attachment && x.data.includes('READY')), name + ' ready'); return r }
let count = 0; const test = async (name, fn) => { await fn(); console.log('PASS ' + name); count++ }
try {
  await test('the view owner is the registry\'s backend, its controller epoch and the held authority', async () => {
    const b = await backend(), o = b.owner.currentOwner(), s = b.registry.snapshot(b.handle)
    assert.deepEqual(o.backend, { ownerId: b.handle.ownerId, hostInstanceId: host.hostInstanceId, bootId: host.bootId, processIdentityRef: s.processIdentityRef, connectionId: b.connection.connectionId })
    assert.equal(o.fabric.sessionId, b.session)
    const v = viewHost(b), a = await attached(v, 'tui')
    assert.equal((await v.host.lifecycle.write(a.ticket, 'hello\n')).state, 'attached'); await until(() => v.output.some(x => x.data.includes('SEEN:hello')), 'written')
    await v.host.lifecycle.detach(a.ticket)
  })

  await test('detaching a view is not Stop: the backend stays owned, alive and commandable', async () => {
    const b = await backend(), v = viewHost(b), a = await attached(v, 'tui')
    const d = await v.host.lifecycle.detach(a.ticket); assert.ok(['exited', 'detached'].includes(d.state), JSON.stringify(d))
    assert.equal(b.registry.snapshot(b.handle).physicalState, 'owned'); assert.equal(b.child.exited, false)
    assert.equal(b.port.commandAllowed(b.session), true); assert.equal(b.port.inputAllowed(b.session), true)
    assert.equal((await v.host.lifecycle.reconnect(d.ticket)).state, 'attached', 'the operator may attach again')
  })

  await test('Stop disables input from every view at once', async () => {
    const b = await backend(), v = viewHost(b), one = await attached(v, 'one'), two = await attached(v, 'two'), before = v.calls.write
    b.port.ptys.haltInput(b.session)
    for (const t of [one.ticket, two.ticket]) assert.notEqual((await v.host.lifecycle.write(t, 'late\n')).state, 'attached')
    assert.equal(v.calls.write, before, 'no byte reached any view'); assert.equal(v.host.lifecycle.isAdmissionFenced(), true)
    await assert.rejects(v.host.lifecycle.attach('three'), /owner_fenced/)
    for (const t of [one.ticket, two.ticket]) await v.host.lifecycle.detach(t)
  })

  await test('losing the backend fences every view; the views themselves still close', async () => {
    const b = await backend(), v = viewHost(b), one = await attached(v, 'one'), two = await attached(v, 'two'), before = v.calls.write
    process.kill(b.child.child.pid, 'SIGKILL'); await until(() => b.child.exited, 'backend exit'); await delay(30)
    assert.equal(b.owner.currentOwner(), null)
    for (const t of [one.ticket, two.ticket]) assert.notEqual((await v.host.lifecycle.write(t, 'x\n')).state, 'attached')
    assert.equal(v.calls.write, before)
    for (const t of [one.ticket, two.ticket]) assert.notEqual((await v.host.lifecycle.detach(t)).state, 'attached', 'a local view closes without a backend')
    // The registry's own state decides, even with an input fence that still reads open.
    const lone = createBackendViewAuthority({ registry: b.registry, handle: b.handle, sessionId: b.session, fabric: { estateId: id(1), projectId: id(3), taskId: id(9), runId: id(9), runOrdinal: 1 },
      authority: () => b.authority.value, connection: () => b.connection, inputAllowed: () => true })
    assert.equal(lone.currentOwner(), null)
  })

  await test('a reconnect or lost authority is a different owner; its old views are fenced', async () => {
    const b = await backend(), v = viewHost(b), a = await attached(v, 'tui'), before = v.calls.write
    b.connection.connectionId = 'controller:' + randomUUID()
    assert.notEqual((await v.host.lifecycle.write(a.ticket, 'x\n')).state, 'attached'); assert.equal(v.calls.write, before)
    await v.host.lifecycle.detach(a.ticket)
    const c = await backend(), w = viewHost(c), t = await attached(w, 'tui'); c.authority.value = null
    assert.notEqual((await w.host.lifecycle.write(t.ticket, 'x\n')).state, 'attached'); await w.host.lifecycle.detach(t.ticket)
    const closed = await backend(); closed.connection.closed = 'socket_closed'; assert.equal(closed.owner.currentOwner(), null)
    assert.throws(() => closed.owner.initialOwner(), /backend_view_owner_unavailable/)
  })

  await test('a ticket for one backend cannot touch a newer backend\'s view', async () => {
    const old = await backend(), v = viewHost(old), stale = await attached(v, 'tui')
    const fresh = await backend(), w = viewHost(fresh), current = await attached(w, 'tui'), before = w.calls.write
    await assert.rejects(w.host.lifecycle.write(stale.ticket, 'x\n'), /unknown_view/)
    await assert.rejects(w.host.lifecycle.detach(stale.ticket), /unknown_view/)
    assert.equal(w.calls.write, before); assert.equal((await w.host.lifecycle.write(current.ticket, 'ok\n')).state, 'attached')
    for (const [h, t] of [[v, stale], [w, current]]) await h.host.lifecycle.detach(t.ticket)
  })

  await test('a view whose closure cannot be proved stays unknown, and the backend is untouched', async () => {
    const b = await backend(), v = viewHost(b, stubborn), a = await v.host.lifecycle.attach('tree')
    assert.equal(a.state, 'attached'); await until(() => v.output.some(x => x.data.includes('CHILD_READY')), 'descendant ready'); await learn()
    const d = await v.host.lifecycle.detach(a.ticket)
    assert.equal(d.state, 'outcome_unknown', JSON.stringify(d))
    assert.equal(b.registry.snapshot(b.handle).physicalState, 'owned'); assert.equal(b.child.exited, false)
  })

  await test('the Codex view recipe pins the binary and carries the token only in the variable the flag names', async () => {
    const bin = path.join(dir, 'codex'); writeFileSync(bin, '#!/bin/sh\n', { mode: 0o755 })
    const sha = createHash('sha256').update(readFileSync(bin)).digest('hex'), token = 'a'.repeat(64)
    const r = codexViewRecipe({ binary: bin, binarySha256: sha, threadId: 'a1b2c3d4-0000-4000-8000-000000000001', port: 4242, token, cwd: dir, profile: path.join(dir, 'view-profile'), path: '/usr/bin:/bin' })
    assert.deepEqual(r.argv, ['resume', 'a1b2c3d4-0000-4000-8000-000000000001', '--remote', 'ws://127.0.0.1:4242', '--remote-auth-token-env', 'FABRIC_VIEW_TOKEN'])
    assert.equal(r.env.FABRIC_VIEW_TOKEN, token); assert.ok(!r.argv.join(' ').includes(token), 'never in argv')
    assert.throws(() => codexViewRecipe({ binary: bin, binarySha256: 'b'.repeat(64), threadId: 't', port: 1, token, cwd: dir, profile: dir, path: '' }), /codex_binary_not_pinned/)
    for (const over of [{ port: 0 }, { token: 'short' }, { threadId: 'bad id' }, { cwd: 'relative' }])
      assert.throws(() => codexViewRecipe({ binary: bin, binarySha256: sha, threadId: 't', port: 1, token, cwd: dir, profile: dir, path: '', ...over }), /invalid_codex_view_recipe/)
  })
  console.log(`PASS ${count} native view groups on the owned backend; ${runtimeTuple().runtime} Node ${process.versions.node} node-pty ${ptyVersion}`)
} finally {
  for (const r of registries) r.retire()
  let clean = true
  // Each view's group was captured at spawn, so a descendant that outlives its root is still reached.
  for (const t of views) { try { await t.capture; if (t.owned) { await boundary.signal(t.owned, 'SIGKILL'); await until(async () => (await boundary.observe(t.owned, t.exited)).state === 'quiescent', 'view group cleanup') } else if (!t.exited) clean = false } catch { clean = false } }
  for (const t of backends) { try { if (!t.exited) process.kill(t.child.pid, 'SIGKILL'); await until(() => t.exited, 'backend exit'); t.child.stdout.destroy(); t.child.stdin.destroy(); t.child.stderr.destroy() } catch { clean = false } }
  await delay(300)
  if (clean) rmSync(dir, { recursive: true, force: true }); else { console.error('FAIL cleanup uncertain; fixture retained'); process.exitCode = 1 }
}
