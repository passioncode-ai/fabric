// First-slice plan B2a: the Claude control transport over the owned backend's actual stdio. A Node
// peer fixture speaks the SDK control envelope under the real registry; the fault seams are the
// registry's own (fd identity, the native write, authority), never a fake stream.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync, fstatSync, writeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createOwnedBackendProcessRegistry } from '../src/main/ownedBackendProcessRegistry.ts'
import { createProcessBoundary } from '../src/main/processBoundary.ts'
import { joinOwnedClaudeControl } from '../src/main/claudeOwnedStdio.ts'
import { isMeasuredRuntime, runtimeTuple } from '../src/main/runtimeAdmission.ts'
if (!isMeasuredRuntime()) { console.error('NOT_RUN: unmeasured runtime for the owned backend: ' + JSON.stringify(runtimeTuple())); process.exit(2) }

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const estate = id(1), dir = mkdtempSync(path.join(tmpdir(), 'fabric-claude-owned-'))
const executable = realpathSync(process.env.FABRIC_BACKEND_NODE ?? process.execPath), hash = createHash('sha256').update(readFileSync(executable)).digest('hex')
const peer = path.join(dir, 'peer.mjs')
// reply: acks every control request; silent: never answers; exit: leaves mid-turn on the first request.
writeFileSync(peer, `import readline from 'node:readline';const mode=process.argv[2];let seen=0
readline.createInterface({input:process.stdin}).on('line',line=>{const v=JSON.parse(line);if(v.type!=='control_request')return;seen++
if(mode==='exit')process.exit(3);if(mode==='silent')return
process.stdout.write(JSON.stringify({type:'control_response',response:{subtype:'success',request_id:v.request_id,response:{seen}}})+'\\n')})
setInterval(()=>{},1000)\n`, { mode: 0o600 })
const boundary = createProcessBoundary(), tracked = [], registries = [], joined = []
const delay = ms => new Promise(r => setTimeout(r, ms))
const until = async (fn, label) => { const deadline = performance.now() + 4000; while (performance.now() < deadline) { if (await fn()) return; await delay(10) } throw Error(label) }
const stamp = fd => { const s = fstatSync(fd, { bigint: true }); return `${s.dev}/${s.ino}/${s.rdev}/${s.mode}` }
let serial = 10
async function owned({ mode = 'reply', native: over = {}, timeoutMs = 1000 } = {}) {
  const root = path.join(dir, 'root-' + serial++); mkdirSync(root, { recursive: true, mode: 0o700 })
  const state = { authority: { personId: id(2), revision: 1 } }, calls = { write: 0, bytes: [] }, hooks = {}
  const native = {
    spawn: (...args) => { const child = spawn(...args), t = { child, exited: false }; tracked.push(t); child.once('exit', () => t.exited = true); child.on('error', () => {}); return child },
    boundary, fdIdentity: fd => { const r = stamp(fd); hooks.fdIdentity?.(); return r },
    write: (fd, bytes) => { calls.write++; calls.bytes.push(bytes.toString()); return hooks.write ? hooks.write(fd, bytes) : writeSync(fd, bytes) }, ...over,
  }
  const registry = createOwnedBackendProcessRegistry({ rootDir: root, estateId: estate, recipe: { executable, executableSha256: hash, argv: [peer, mode], cwd: dir, env: { HOME: dir } }, timeoutMs: 1200, authority: () => { hooks.authority?.(); return state.authority } }, native)
  registries.push(registry)
  const n = serial++, a = { admitted: true, project_id: id(3), task_id: id(n), task_run_id: id(n + 1000), session_id: id(n + 2000), run_ordinal: 1 }
  const started = await registry.start(a, a.session_id, async () => true); assert.equal(started.state, 'owned', JSON.stringify(started))
  const events = [], control = joinOwnedClaudeControl(registry, started.handle, { onEvent: e => events.push(e), timeoutMs }); joined.push(control)
  return { registry, handle: started.handle, control, state, calls, hooks, events, child: tracked[tracked.length - 1] }
}
const interrupt = { subtype: 'interrupt' }
let count = 0; const test = async (name, fn) => { await fn(); console.log('PASS ' + name); count++ }
try {
  await test('a control request over the owned pipes is acknowledged by the peer', async () => {
    const w = await owned(), r = await w.control.requestControl(interrupt, () => true)
    assert.equal(r.status, 'ack', JSON.stringify(r)); assert.equal(w.calls.write, 1)
    assert.equal(JSON.parse(w.calls.bytes[0]).type, 'control_request')
    assert.equal(w.registry.canWrite(w.handle), true)
  })

  await test('a command fence revoked after the transport\'s check but before the write sends no bytes', async () => {
    const w = await owned(); let allowed = true
    w.hooks.fdIdentity = () => { allowed = false } // runs inside the registry's write edge, after the transport checked
    const r = await w.control.requestControl(interrupt, () => allowed)
    assert.equal(w.calls.write, 0, 'no byte reached the pipe')
    assert.deepEqual([r.status, r.reason], ['not_sent', 'effect_fenced'])
    // A refused command is that command's authority, not the owner's: the channel stays usable.
    w.hooks.fdIdentity = undefined; assert.equal(w.registry.canWrite(w.handle), true)
    assert.equal((await w.control.requestControl(interrupt, () => true)).status, 'ack')
  })

  await test('a fence revoked from inside the registry\'s own authority read is caught at the edge too', async () => {
    const w = await owned(); let allowed = true, armed = false
    w.hooks.authority = () => { if (armed) allowed = false }
    armed = true
    const r = await w.control.requestControl(interrupt, () => allowed)
    assert.equal(w.calls.write, 0); assert.equal(r.status, 'not_sent')
  })

  await test('a throwing or non-boolean fence at the edge refuses', async () => {
    for (const fence of [() => { throw Error('private') }, () => 1, () => Promise.resolve(true)]) {
      const w = await owned(); let first = true
      const r = await w.control.requestControl(interrupt, () => { if (first) { first = false; return true } return fence() })
      assert.equal(w.calls.write, 0); assert.equal(r.status, 'not_sent')
    }
  })

  await test('a fence that re-enters the transport at the edge sends nothing, is unknown and fences the owner', async () => {
    const w = await owned(); let first = true, nested
    const r = await w.control.requestControl(interrupt, () => { if (first) { first = false; return true } nested = w.control.requestControl(interrupt, () => true); return true })
    // The transport cannot tell a nested write it lost from one that went out, so both are unknown — never ack.
    assert.equal(r.status, 'outcome_unknown'); assert.equal((await nested).status, 'outcome_unknown')
    assert.equal(w.calls.write, 0, 'neither request reached the pipe')
    assert.equal(w.registry.canWrite(w.handle), false)
  })

  await test('a timeout is unknown and the request is never resent', async () => {
    const w = await owned({ mode: 'silent', timeoutMs: 150 })
    const r = await w.control.requestControl(interrupt, () => true)
    assert.deepEqual([r.status, r.reason], ['outcome_unknown', 'deadline'])
    await delay(200); assert.equal(w.calls.write, 1, 'no resend')
  })

  await test('the backend exiting mid-turn is unknown and fences the owner', async () => {
    const w = await owned({ mode: 'exit' })
    const r = await w.control.requestControl(interrupt, () => true)
    assert.equal(r.status, 'outcome_unknown', JSON.stringify(r))
    await until(() => w.child.exited, 'backend exit')
    assert.equal(w.registry.canWrite(w.handle), false)
    assert.equal(w.registry.snapshot(w.handle).channelState, 'lost')
    assert.equal((await w.control.requestControl(interrupt, () => true)).status, 'not_sent')
    assert.equal(w.calls.write, 1)
  })

  await test('a partial write or EAGAIN is unknown, fences the owner and is never retried', async () => {
    for (const fault of [(fd, b) => writeSync(fd, b.subarray(0, b.length - 1)), () => { throw Object.assign(Error('EAGAIN'), { code: 'EAGAIN' }) }]) {
      const w = await owned(); w.hooks.write = fault
      const r = await w.control.requestControl(interrupt, () => true)
      assert.equal(r.status, 'outcome_unknown', JSON.stringify(r))
      assert.equal(w.registry.canWrite(w.handle), false)
      assert.equal((await w.control.requestControl(interrupt, () => true)).status, 'not_sent'); assert.equal(w.calls.write, 1)
    }
  })

  await test('connection loss reaches the registry: closing the transport fences the owner', async () => {
    const w = await owned(); w.control.close()
    assert.equal(w.registry.canWrite(w.handle), false)
    assert.equal(w.registry.snapshot(w.handle).channelState, 'lost')
  })

  await test('a second claim or a copied handle cannot reattach', async () => {
    const w = await owned()
    assert.throws(() => joinOwnedClaudeControl(w.registry, w.handle, { onEvent() {} }), /backend_ownership/)
    assert.throws(() => joinOwnedClaudeControl(w.registry, { ...w.handle }, { onEvent() {} }), /backend_ownership/)
    assert.equal((await w.control.requestControl(interrupt, () => true)).status, 'ack', 'the first join is untouched')
  })
  console.log(`PASS ${count} Claude control groups over the owned backend's stdio; ${runtimeTuple().runtime} Node ${process.versions.node}`)
} finally {
  for (const c of joined) c.close()
  for (const registry of registries) registry.retire()
  let clean = true
  for (const t of tracked) {
    try { if (!t.exited) process.kill(t.child.pid, 'SIGKILL'); await until(() => t.exited, 'fixture exit'); t.child.stdout.destroy(); t.child.stdin.destroy(); t.child.stderr.destroy() } catch { clean = false }
  }
  if (clean) rmSync(dir, { recursive: true, force: true }); else { console.error('FAIL cleanup uncertain; fixture retained'); process.exitCode = 1 }
}
