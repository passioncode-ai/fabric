// First-slice plan B2b-1: a loopback backend's listener receipt and per-launch arguments, on the
// actual registry with a Node fixture that serves real HTTP on 127.0.0.1 and announces itself on
// stderr the way `codex app-server --listen ws://127.0.0.1:0` does.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createOwnedBackendProcessRegistry } from '../src/main/ownedBackendProcessRegistry.ts'
import { createProcessBoundary } from '../src/main/processBoundary.ts'
import { isMeasuredRuntime, runtimeTuple } from '../src/main/runtimeAdmission.ts'
if (!isMeasuredRuntime()) { console.error('NOT_RUN: unmeasured runtime for the owned backend: ' + JSON.stringify(runtimeTuple())); process.exit(2) }

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const estate = id(1), dir = mkdtempSync(path.join(tmpdir(), 'fabric-backend-listener-'))
const executable = realpathSync(process.env.FABRIC_BACKEND_NODE ?? process.execPath), hash = createHash('sha256').update(readFileSync(executable)).digest('hex')
const fixture = path.join(dir, 'listener.mjs')
writeFileSync(fixture, `import http from 'node:http';import {writeFileSync as mark} from 'node:fs';const mode=process.argv[2],extra=process.argv.slice(3)
const say=t=>process.stderr.write(t)
if(mode==='exit'){say('starting\\n');setTimeout(()=>process.exit(4),300)}
// The receipt waits for SIGUSR2, which the test sends only once the registry owns this process.
const go=new Promise(r=>process.once('SIGUSR2',r))
// Armed: until the handler exists, SIGUSR2's default action ends the process (CO-174).
mark(new URL('ready-'+process.pid,import.meta.url),'')
if(mode!=='exit'){const server=http.createServer((q,r)=>{r.end(JSON.stringify({argv:extra}))}).listen(0,'127.0.0.1',async()=>{const port=server.address().port
say('noise before — ünïcode\\n')
await go
if(mode==='never')return
if(mode==='bad'){say('listening on: ws://127.0.0.1:99999\\n');return}
if(mode==='long'){say(' '.repeat(20000));await new Promise(r=>setTimeout(r,30));say('listening on: ws://127.0.0.1:1\\n');say(' '.repeat(17000)+'listening on: ws://127.0.0.1:2\\n')}
const line='  listening on: ws://127.0.0.1:'+port+'\\n';say(line.slice(0,12));setTimeout(()=>{say(line.slice(12));if(mode==='twice')say(line);say('secret-partial')},20)})}
setInterval(()=>{},1000)\n`, { mode: 0o600 })
const pattern = /^\s*listening on:\s*ws:\/\/127\.0\.0\.1:(\d+)\s*$/
const boundary = createProcessBoundary(), tracked = [], registries = []
const delay = ms => new Promise(r => setTimeout(r, ms))
const until = async (fn, label) => { const deadline = performance.now() + 4000; while (performance.now() < deadline) { if (await fn()) return; await delay(10) } throw Error(label) }
let serial = 10
function registry({ mode = 'listen', listener = { pattern }, root = path.join(dir, 'root-' + serial++) } = {}) {
  mkdirSync(root, { recursive: true, mode: 0o700 }); const calls = { spawn: 0 }
  const native = { spawn: (...args) => { calls.spawn++; const child = spawn(...args), t = { child, exited: false }; tracked.push(t); child.once('exit', () => t.exited = true); child.on('error', () => {}); return child },
    boundary, fdIdentity: () => 'fd', write: () => 0 }
  const r = createOwnedBackendProcessRegistry({ rootDir: root, estateId: estate, recipe: { executable, executableSha256: hash, argv: [fixture, mode], cwd: dir, env: { HOME: dir } }, timeoutMs: 1500, authority: () => ({ personId: id(2), revision: 1 }), ...(listener ? { listener } : {}) }, native)
  registries.push(r); return { registry: r, calls, root }
}
const admission = () => { const n = serial++; return { admitted: true, project_id: id(3), task_id: id(n), task_run_id: id(n + 1000), session_id: id(n + 2000), run_ordinal: 1 } }
async function owned(w, launch) { const a = admission(), s = await w.registry.start(a, a.session_id, async () => true, launch); assert.equal(s.state, 'owned', JSON.stringify(s))
  // CO-174. This waited a fixed 50 ms and then signalled. A Node fixture under load had not yet
  // installed its handler, so the signal's default action killed it, and the cases read a channel
  // that ended (`owned_channel_end`) instead of the receipt they test. The fixture now says when it
  // is armed, and the signal waits for that.
  const pid = tracked[tracked.length - 1].child.pid
  await until(() => existsSync(path.join(dir, 'ready-' + pid)), 'fixture armed')
  process.kill(pid, 'SIGUSR2'); return s.handle }
let count = 0; const test = async (name, fn) => { await fn(); console.log('PASS ' + name); count++ }
try {
  await test('the announced port is the backend\'s own listener, and per-launch arguments reached it', async () => {
    const w = registry(), argv = ['--ws-token-sha256', 'a'.repeat(64)], handle = await owned(w, { argv })
    const l = await w.registry.listener(handle)
    assert.equal(l.state, 'listening', JSON.stringify(l))
    const served = await (await fetch(`http://127.0.0.1:${l.port}/`)).json()
    assert.deepEqual(served.argv, argv, 'the listener is the process that received this launch\'s arguments')
    const snap = w.registry.snapshot(handle)
    assert.equal(snap.listenerPort, l.port)
    await delay(50)
    const text = JSON.stringify(w.registry.snapshot(handle))
    assert.ok(!text.includes('noise') && !text.includes('secret-partial') && !text.includes('a'.repeat(64)), 'no stderr text, pending or complete, and no launch argument in the snapshot')
    assert.deepEqual(await w.registry.listener(handle), l, 'a later read returns the same receipt')
    const markers = readdirSync(path.join(w.root, 'backend-processes', estate))
    assert.ok(!readFileSync(path.join(w.root, 'backend-processes', estate, markers[0]), 'utf8').includes('a'.repeat(64)), 'launch arguments are never persisted')
  })

  await test('a second listener receipt fences the owner', async () => {
    const w = registry({ mode: 'twice' }), handle = await owned(w)
    await until(() => w.registry.snapshot(handle).reasonCode === 'duplicate_listener_receipt', 'duplicate fenced')
    assert.deepEqual(await w.registry.listener(handle), { state: 'unknown', reasonCode: 'duplicate_listener_receipt' })
    assert.equal(w.registry.snapshot(handle).physicalState, 'outcome_unknown')
  })

  await test('a malformed port fences the owner; an overlong line is skipped, never matched', async () => {
    const bad = registry({ mode: 'bad' }), h1 = await owned(bad)
    assert.deepEqual(await bad.registry.listener(h1), { state: 'unknown', reasonCode: 'invalid_listener_receipt' })
    const long = registry({ mode: 'long' }), h2 = await owned(long), l = await long.registry.listener(h2)
    assert.equal(l.state, 'listening'); assert.ok(l.port > 2, 'neither receipt hidden in an overlong line was read')
    assert.deepEqual((await (await fetch(`http://127.0.0.1:${l.port}/`)).json()).argv, [])
  })

  await test('no receipt within the deadline is unknown and leaves the owner alone', async () => {
    const w = registry({ mode: 'never', listener: { pattern, timeoutMs: 200 } }), handle = await owned(w)
    assert.deepEqual(await w.registry.listener(handle), { state: 'unknown', reasonCode: 'listener_timeout' })
    assert.equal(w.registry.snapshot(handle).physicalState, 'owned')
  })

  await test('a backend exiting before it listens is unknown, never a port', async () => {
    const w = registry({ mode: 'exit' }), handle = await owned(w), l = await w.registry.listener(handle)
    assert.equal(l.state, 'unknown', JSON.stringify(l)); assert.match(l.reasonCode, /^(backend_root_exit|owned_channel_(end|closed))$/)
    assert.equal(w.registry.snapshot(handle).listenerPort, null)
  })

  await test('malformed per-launch arguments refuse before any reservation or spawn', async () => {
    for (const argv of [[1], ['bad\u0000'], ['line\nbreak'], [''], Array(9).fill('x'), ['x'.repeat(513)]]) {
      const w = registry(), a = admission()
      assert.deepEqual(await w.registry.start(a, a.session_id, async () => true, { argv }), { state: 'refused', reasonCode: 'invalid_launch_args' }, JSON.stringify(argv).slice(0, 40))
      assert.equal(w.calls.spawn, 0); assert.equal(readdirSync(path.join(w.root, 'backend-processes', estate)).length, 0)
    }
    const w = registry(), a = admission()
    assert.equal((await w.registry.start(a, a.session_id, async () => true, { argv: ['ok'], extra: 1 })).reasonCode, 'invalid_launch_args')
  })

  await test('a registry without a listener says so, and a global or non-RegExp pattern is refused', async () => {
    const w = registry({ listener: null }), handle = await owned(w)
    assert.deepEqual(await w.registry.listener(handle), { state: 'unknown', reasonCode: 'listener_not_configured' })
    for (const listener of [{ pattern: /listening (\d+)/g }, { pattern: /x(\d+)/y }, { pattern: 'listening' }, { pattern, timeoutMs: 0 }])
      assert.throws(() => registry({ listener }), /backend_ownership/)
  })
  console.log(`PASS ${count} listener receipt groups over the actual owned backend; ${runtimeTuple().runtime} Node ${process.versions.node}`)
} finally {
  for (const r of registries) r.retire()
  let clean = true
  for (const t of tracked) { try { if (!t.exited) process.kill(t.child.pid, 'SIGKILL'); await until(() => t.exited, 'fixture exit'); t.child.stdout.destroy(); t.child.stdin.destroy(); t.child.stderr.destroy() } catch { clean = false } }
  if (clean) rmSync(dir, { recursive: true, force: true }); else { console.error('FAIL cleanup uncertain; fixture retained'); process.exitCode = 1 }
}
