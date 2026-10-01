// First-slice plan B2b-3: the Codex loopback recipe, its per-backend token, the thread producer
// and the owned-loopback turn binding. The producer runs against a scripted client here; the
// same code runs against a real `codex app-server` in codex-loopback-thread-native.test.mjs.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { bindCodexLoopbackTurn, codexLoopbackRecipe, mintLoopbackToken, startCodexThread, writerAllowed, CODEX_LOOPBACK_LISTENER, CODEX_PROFILE_CONFIG } from '../src/main/codexLoopback.ts'
import { statSync } from 'node:fs'

const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'fabric-codex-loopback-')))
const binary = path.join(dir, 'codex'); writeFileSync(binary, '#!/bin/sh\nexit 0\n', { mode: 0o755 })
const pin = createHash('sha256').update(readFileSync(binary)).digest('hex')
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let count = 0; const test = async (name, fn) => { await fn(); console.log('PASS ' + name); count++ }
// The recipe confines Codex with macOS `sandbox-exec` (codexLoopback.ts#codexLoopbackRecipe), and Fabric
// ships for macOS only. On another host — the Linux CI runner — those cases cannot run, and they say so
// by name rather than shrinking the denominator in silence; the rest of the suite is pure and runs.
let notRun = 0; const darwinTest = (name, fn) => process.platform === 'darwin' ? test(name, fn) : (console.log(`NOT_RUN ${name}: needs macOS sandbox-exec; this host is ${process.platform}`), notRun++)
function scripted(replies) {
  const calls = []
  return { calls, client: {
    async request(method, params, fence) { calls.push({ method, params, fence }); const r = replies[method]; return typeof r === 'function' ? r(params) : r },
    async notify(method, params, fence) { calls.push({ method, params, fence, notify: true }); return replies['notify:' + method] ?? { status: 'written' } },
  } }
}
const good = home => ({
  initialize: { status: 'reply', result: { userAgent: 'x', codexHome: home, platformFamily: 'unix', platformOs: 'macos' } },
  'thread/start': { status: 'reply', result: { thread: { id: 'a1b2c3d4-0000-4000-8000-000000000001', sessionId: 'a1b2c3d4-0000-4000-8000-000000000002', turns: [], cliVersion: '0.157.1', path: '/private/secret', cwd: '/x' } } },
})
const bindInput = over => ({ fabric: { estateId: uuid(1), taskId: uuid(2), runId: uuid(3), sessionId: uuid(4) }, build: '0.157.1',
  backend: { epoch: uuid(5), processRef: 'process:' + 'a'.repeat(64) }, connectionId: 'controller:' + uuid(6), threadId: 'thread-1',
  turn: { threadId: 'thread-1', turn: { id: 'turn-1' } }, manifestDigest: 'b'.repeat(64), policyDigest: 'c'.repeat(64), ...over })
try {
  await darwinTest('the recipe pins the binary, confines writes to its own root and exposes no token', async () => {
    const root = path.join(dir, 'scope-a'), { recipe, listener, codexHome } = codexLoopbackRecipe({ binary, binarySha256: pin, root, path: '/usr/bin:/bin' })
    assert.equal(recipe.executable, '/usr/bin/sandbox-exec'); assert.match(recipe.executableSha256, /^[a-f0-9]{64}$/)
    assert.deepEqual(recipe.argv.slice(2), [binary, 'app-server', '--listen', 'ws://127.0.0.1:0', '--ws-auth', 'capability-token'])
    assert.equal(recipe.env.CODEX_HOME, codexHome); assert.ok(codexHome.startsWith(realpathSync(root) + path.sep))
    const sb = readFileSync(recipe.argv[1], 'utf8')
    assert.ok(sb.includes('(deny network*)') && sb.includes('(allow network-bind (local ip "localhost:*"))') && sb.includes(`(allow file-write* (subpath ${JSON.stringify(realpathSync(root))}))`))
    assert.ok(sb.includes('.codex') && sb.includes('Keychains'), 'operator provider homes are unreadable')
    assert.equal(listener.pattern, CODEX_LOOPBACK_LISTENER); assert.ok(CODEX_LOOPBACK_LISTENER.test('  listening on: ws://127.0.0.1:4242'))
    assert.ok(!JSON.stringify(recipe).includes('token-sha256'), 'the token digest is a per-launch argument, not the recipe')
    // The shell snapshot runs in its own session, outside the backend's group; the owned profile turns it off.
    assert.equal(readFileSync(path.join(codexHome, 'config.toml'), 'utf8'), '[features]\nshell_snapshot = false\n'); assert.equal(CODEX_PROFILE_CONFIG, '[features]\nshell_snapshot = false\n')
    assert.equal(statSync(path.join(codexHome, 'config.toml')).mode & 0o777, 0o600)
  })

  await darwinTest('an unpinned, writable or relative binary and a shared root are refused', async () => {
    assert.throws(() => codexLoopbackRecipe({ binary, binarySha256: 'd'.repeat(64), root: path.join(dir, 's1'), path: '/usr/bin' }), /codex_binary_not_pinned/)
    const loose = path.join(dir, 'loose'); writeFileSync(loose, '#!/bin/sh\n', { mode: 0o777 }); chmodSync(loose, 0o777)
    assert.throws(() => codexLoopbackRecipe({ binary: loose, binarySha256: createHash('sha256').update(readFileSync(loose)).digest('hex'), root: path.join(dir, 's2'), path: '/usr/bin' }), /codex_binary_not_pinned/)
    assert.throws(() => codexLoopbackRecipe({ binary: 'codex', binarySha256: pin, root: path.join(dir, 's3'), path: '/usr/bin' }), /invalid_codex_loopback_recipe/)
    const shared = path.join(dir, 'shared'); mkdirSync(shared, { mode: 0o755 }); chmodSync(shared, 0o755)
    assert.throws(() => codexLoopbackRecipe({ binary, binarySha256: pin, root: shared, path: '/usr/bin' }), /codex_loopback_root_not_private/)
  })

  await darwinTest('model access links the existing login instead of copying it, and opens only 443 and DNS', async () => {
    const login = path.join(dir, 'auth.json'); writeFileSync(login, '{}', { mode: 0o600 })
    const root = path.join(dir, 'scope-model'), { recipe, codexHome } = codexLoopbackRecipe({ binary, binarySha256: pin, root, path: '/usr/bin', modelAccess: { authFile: login } })
    const link = path.join(codexHome, 'auth.json')
    assert.equal((await import('node:fs')).lstatSync(link).isSymbolicLink(), true, 'a link, never a copy'); assert.equal(realpathSync(link), realpathSync(login))
    const sb = readFileSync(recipe.argv[1], 'utf8')
    assert.ok(sb.includes(`(allow file-read* file-write* (literal ${JSON.stringify(realpathSync(login))}))`))
    assert.ok(sb.includes('(allow network-outbound (remote tcp "*:443"))') && sb.includes('mDNSResponder'))
    assert.ok(sb.indexOf('(deny file-read*') < sb.indexOf('(allow file-read* file-write* (literal'), 'the one-file allowance comes after the home denial, so it wins')
    // Rebuilding the same scope with the same login is idempotent; another login is refused.
    codexLoopbackRecipe({ binary, binarySha256: pin, root, path: '/usr/bin', modelAccess: { authFile: login } })
    const other = path.join(dir, 'other.json'); writeFileSync(other, '{}', { mode: 0o600 })
    assert.throws(() => codexLoopbackRecipe({ binary, binarySha256: pin, root, path: '/usr/bin', modelAccess: { authFile: other } }), /codex_profile_login_conflict/)
    const loose = path.join(dir, 'loose.json'); writeFileSync(loose, '{}', { mode: 0o644 }); chmodSync(loose, 0o644)
    assert.throws(() => codexLoopbackRecipe({ binary, binarySha256: pin, root: path.join(dir, 'scope-loose'), path: '/usr/bin', modelAccess: { authFile: loose } }), /codex_login_not_private/)
    const plain = codexLoopbackRecipe({ binary, binarySha256: pin, root: path.join(dir, 'scope-plain'), path: '/usr/bin' })
    const psb = readFileSync(plain.recipe.argv[1], 'utf8'); assert.ok(!psb.includes('network-outbound') && !psb.includes('mDNSResponder'), 'without model access the backend reaches nothing')
  })

  await test('the token stays in main; the backend receives only its digest', async () => {
    const a = mintLoopbackToken(), b = mintLoopbackToken()
    assert.match(a.token, /^[a-f0-9]{64}$/); assert.notEqual(a.token, b.token)
    assert.deepEqual(a.launch, { argv: ['--ws-token-sha256', createHash('sha256').update(a.token).digest('hex')] })
    assert.ok(!JSON.stringify(a.launch).includes(a.token))
  })

  await test('initialize, initialized and thread/start run under the caller\'s fence and yield the thread', async () => {
    const home = '/owned/profile', s = scripted(good(home)), fence = () => true
    const r = await startCodexThread(s.client, { codexHome: home, cwd: '/work', stillAllowed: fence })
    assert.deepEqual(r, { ok: true, threadId: 'a1b2c3d4-0000-4000-8000-000000000001', sessionId: 'a1b2c3d4-0000-4000-8000-000000000002', cliVersion: '0.157.1' })
    assert.deepEqual(s.calls.map(c => c.method), ['initialize', 'initialized', 'thread/start'])
    assert.ok(s.calls.every(c => c.fence === fence), 'every effect carries the caller\'s own fence')
    assert.deepEqual(s.calls[2].params, { cwd: '/work' })
    assert.ok(!JSON.stringify(r).includes('secret'), 'only ids leave the producer')
  })

  await test('a foreign profile, another platform, a lost or refused step and a malformed thread each stop the producer', async () => {
    const home = '/owned/profile'
    const cases = [
      [{ initialize: { status: 'reply', result: { codexHome: '/Users/example/.codex', platformOs: 'macos' } } }, 'foreign_profile'],
      [{ initialize: { status: 'reply', result: { codexHome: home, platformOs: 'linux' } } }, 'unexpected_platform'],
      [{ initialize: { status: 'not_sent', reason: 'effect_fenced' } }, 'initialize_not_sent'],
      [{ initialize: { status: 'outcome_unknown', reason: 'deadline' } }, 'initialize_outcome_unknown'],
      [{ 'notify:initialized': { status: 'not_sent', reason: 'effect_fenced' } }, 'initialized_not_sent'],
      [{ 'thread/start': { status: 'error', code: 'provider_rpc_error' } }, 'thread_start_error'],
      [{ 'thread/start': { status: 'reply', result: { thread: { id: 't', turns: [{}], cliVersion: '0.157.1' } } } }, 'invalid_thread'],
      [{ 'thread/start': { status: 'reply', result: { thread: { id: 'bad id', turns: [], cliVersion: '0.157.1' } } } }, 'invalid_thread'],
      [{ 'thread/start': { status: 'reply', result: {} } }, 'invalid_thread'],
    ]
    for (const [over, reasonCode] of cases) {
      const s = scripted({ ...good(home), ...over })
      assert.deepEqual(await startCodexThread(s.client, { codexHome: home, cwd: '/w', stillAllowed: () => true }), { ok: false, reasonCode }, reasonCode)
    }
    const s = scripted({ ...good(home), initialize: { status: 'reply', result: { codexHome: '/elsewhere', platformOs: 'macos' } } })
    await startCodexThread(s.client, { codexHome: home, cwd: '/w', stillAllowed: () => true })
    assert.deepEqual(s.calls.map(c => c.method), ['initialize'], 'nothing further is sent to a foreign profile')
  })

  await test('a turn of this thread binds as owned-loopback; a foreign thread or a missing turn refuses', async () => {
    const ok = bindCodexLoopbackTurn(bindInput())
    assert.equal(ok.ok, true, JSON.stringify(ok))
    assert.equal(ok.value.provider.runtimeProfile, 'owned-loopback'); assert.deepEqual(ok.value.execution, { kind: 'native-turn', id: 'turn-1' })
    assert.equal(bindCodexLoopbackTurn(bindInput({ turn: { threadId: 'thread-2', turn: { id: 'turn-1' } } })).reasonCode, 'foreign_thread')
    assert.equal(bindCodexLoopbackTurn(bindInput({ turn: null })).reasonCode, 'codex_thread_turn_required')
    for (const turn of [{}, { threadId: 'thread-1' }, { threadId: 'thread-1', turn: {} }, 'turn-1'])
      assert.equal(bindCodexLoopbackTurn(bindInput({ turn })).reasonCode, 'invalid_turn_scope', JSON.stringify(turn))
    assert.equal(bindCodexLoopbackTurn(bindInput({ connectionId: 'view:tui-1' })).reasonCode, 'view_cannot_bind_execution')
    assert.equal(bindCodexLoopbackTurn(bindInput({ backend: { epoch: uuid(5), processRef: 'pid-42' } })).reasonCode, 'loopback_backend_required')
  })

  await test('only the bound connection writes for a binding; a reconnect or a closed client does not', async () => {
    const b = bindCodexLoopbackTurn(bindInput()).value
    assert.equal(writerAllowed(b, { connectionId: 'controller:' + uuid(6), closed: null }), true)
    assert.equal(writerAllowed(b, { connectionId: 'controller:' + uuid(7), closed: null }), false, 'a reconnect is a new writer')
    assert.equal(writerAllowed(b, { connectionId: 'controller:' + uuid(6), closed: 'socket_closed' }), false)
  })
  console.log(`PASS ${count} Codex loopback recipe, thread and binding groups` + (notRun ? `; NOT_RUN ${notRun} recipe groups (not macOS)` : ''))
} finally { rmSync(dir, { recursive: true, force: true }) }
