// The guard between database probes and the operator's live stack (scripts/lib/test-stack.mjs).
// Pure: no stack is started, nothing connects. The real root config is read, because the live
// ports are whatever that file says — a fixture copy would agree with itself forever.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  REPO_ROOT, PORT_OFFSETS, PORT_BLOCK, DISPOSABLE_ID,
  parseStackConfig, liveStack, disposableConfig, checkTestStack, probeEnv
} from '../lib/test-stack.mjs'
import { assertDisposableDir, stackPlan } from '../test-stack.mjs'

const ROOT_CONFIG = readFileSync(path.join(REPO_ROOT, 'supabase', 'config.toml'), 'utf8')
const live = liveStack()
const disposable = {
  SUPABASE_URL: 'http://127.0.0.1:55421',
  SUPABASE_SERVICE_ROLE_KEY: 'k',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:55422/postgres',
  FABRIC_TEST_STACK: 'fabric_test_abc123'
}

test('the live stack is read from the root config, and 54321/54322 stay forbidden whatever it says', () => {
  assert.equal(live.projectId, 'fabric')
  assert.equal(live.apiPort, parseStackConfig(ROOT_CONFIG).ports['api.port'])
  assert.equal(live.dbPort, parseStackConfig(ROOT_CONFIG).ports['db.port'])
  for (const p of [54321, 54322, live.apiPort, live.dbPort]) assert.ok(live.ports.has(p), `port ${p} is forbidden`)
})

test('a commented-out port is not a port', () => {
  const { ports } = parseStackConfig('[api]\n# port = 1\nport = 2\n[db]\nport = 3 # trailing\n')
  assert.deepEqual(ports, { 'api.port': 2, 'db.port': 3 })
})

test('the disposable config keeps no live port and no live project id', () => {
  const text = disposableConfig(ROOT_CONFIG, { projectId: 'fabric_test_abc123', base: 55420 })
  const parsed = parseStackConfig(text)
  assert.equal(parsed.projectId, 'fabric_test_abc123')
  const values = Object.values(parsed.ports)
  assert.equal(values.length, Object.keys(parseStackConfig(ROOT_CONFIG).ports).length, 'every port was carried over')
  assert.equal(new Set(values).size, values.length, 'no two services share a port')
  for (const p of values) {
    assert.ok(!live.ports.has(p), `port ${p} is a live port`)
    assert.ok(p >= 55420 && p < 55420 + PORT_BLOCK, `port ${p} is outside its block`)
  }
  assert.equal(parsed.ports['api.port'], 55421)
  assert.equal(parsed.ports['db.port'], 55422)
})

test('a port the table does not know still moves into the block', () => {
  const parsed = parseStackConfig(disposableConfig('project_id = "fabric"\n[newthing]\nport = 54399\n[api]\nport = 54321\n', { projectId: 'fabric_test_abc123', base: 55420 }))
  assert.equal(parsed.ports['api.port'], 55421)
  assert.ok(parsed.ports['newthing.port'] >= 55420 && parsed.ports['newthing.port'] < 55430)
  assert.ok(!Object.values(PORT_OFFSETS).includes(parsed.ports['newthing.port'] - 55420))
})

test('only a fabric_test_<hex> id can be made disposable', () => {
  assert.throws(() => disposableConfig(ROOT_CONFIG, { projectId: 'fabric', base: 55420 }))
  assert.ok(!DISPOSABLE_ID.test('fabric'))
  assert.ok(DISPOSABLE_ID.test('fabric_test_abc123'))
})

test('a disposable environment passes', () => {
  assert.deepEqual(checkTestStack(disposable, live), [])
})

test('REFUSED: the API at the live port', () => {
  const r = checkTestStack({ ...disposable, SUPABASE_URL: `http://127.0.0.1:${live.apiPort}` }, live)
  assert.equal(r.length, 1); assert.match(r[0], /SUPABASE_URL points at port \d+, which is the LIVE stack/)
})

test('REFUSED: the database at the live port', () => {
  const r = checkTestStack({ ...disposable, DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${live.dbPort}/postgres` }, live)
  assert.equal(r.length, 1); assert.match(r[0], /DATABASE_URL points at port \d+, which is the LIVE stack/)
})

test('REFUSED: 54321/54322 even when the root config has moved the live stack elsewhere', () => {
  const moved = liveStack(path.join(REPO_ROOT, 'does-not-exist'))
  for (const p of [54321, 54322]) assert.ok(moved.ports.has(p))
  assert.ok(checkTestStack({ ...disposable, SUPABASE_URL: 'http://localhost:54321' }, moved).length > 0)
  assert.ok(checkTestStack({ ...disposable, DATABASE_URL: 'postgresql://x@127.0.0.1:54322/postgres' }, moved).length > 0)
})

test('REFUSED: the live project id, or no id at all', () => {
  assert.ok(checkTestStack({ ...disposable, FABRIC_TEST_STACK: 'fabric' }, live).some(r => /live project/.test(r)))
  const { FABRIC_TEST_STACK, ...noId } = disposable
  assert.ok(checkTestStack(noId, live).some(r => /FABRIC_TEST_STACK is not set/.test(r)))
})

test('REFUSED: nothing set — there is no fallback to `supabase status`', () => {
  assert.equal(checkTestStack({}, live).length, 4)
})

test('REFUSED: a stack that is not on this machine', () => {
  assert.ok(checkTestStack({ ...disposable, SUPABASE_URL: 'http://10.0.0.5:55421' }, live).some(r => /not loopback/.test(r)))
})

test('probeEnv exits 1 before returning anything when it refuses', () => {
  let code = null
  const lines = []
  const out = probeEnv({ env: { ...disposable, DATABASE_URL: 'postgresql://p@127.0.0.1:54322/postgres' }, live, exit: c => { code = c }, log: l => lines.push(l) })
  assert.equal(code, 1)
  assert.equal(out, null)
  assert.ok(lines.every(l => l.startsWith('  FAIL ')))
  assert.deepEqual(probeEnv({ env: disposable, live, exit: () => assert.fail('exited') }), disposable)
})

test('teardown refuses any directory that is not a disposable stack', () => {
  assert.throws(() => assertDisposableDir(REPO_ROOT), /not a disposable stack/)
  assert.throws(() => assertDisposableDir('/'), /not a disposable stack/)
})

test('the plan for a base on the live ports is refused before anything starts', () => {
  assert.throws(() => stackPlan({ base: 54320, projectId: 'fabric_test_abc123', live }), /LIVE stack/)
  const ok = stackPlan({ base: 55420, projectId: 'fabric_test_abc123', live })
  assert.equal(ok.apiPort, 55421)
  assert.equal(ok.dbPort, 55422)
})

// ── the database address as the pg client reads it (release review 2026-10-03, iteration 2) ──
//
// The guard read DATABASE_URL with `new URL`, while the probes connect with `pg`, which reads it with
// pg-connection-string and the libpq variables. Three addresses passed the guard and reached the live
// database: a port in the query string (`?port=54322` overrides the URL's port), a host in the query
// string, and a URL with no port at all — pg then takes PGPORT, which may be 54322.
test('REFUSED: a host or port in the query string, whatever the URL itself says', () => {
  for (const q of ['port=54322', 'host=127.0.0.1', 'host=/tmp', 'hostaddr=127.0.0.1'])
    assert.ok(checkTestStack({ ...disposable, DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:55422/postgres?${q}` }, live)
      .some(r => /query string/.test(r)), q)
})

test('REFUSED: no port in the URL while PGPORT names the live database — pg would use it', () => {
  const env = { ...disposable, DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1/postgres', PGPORT: String(live.dbPort) }
  assert.ok(checkTestStack(env, live).some(r => new RegExp(`port ${live.dbPort}`).test(r)), 'PGPORT reached the live database')
  // And without PGPORT the address is pg's default, 5432 — not the live stack's, so not refused for that.
  assert.ok(!checkTestStack({ ...env, PGPORT: undefined }, live).some(r => /LIVE/.test(r)))
})

test('REFUSED: no host in the URL while PGHOST names another machine — pg would use it', () => {
  const env = { ...disposable, DATABASE_URL: 'postgresql:///postgres', PGHOST: 'db.example.com', PGPORT: '55422' }
  assert.ok(checkTestStack(env, live).some(r => /db\.example\.com.*not loopback/.test(r)))
})

// ── two runs started at once do not pick the same block (release review 2026-10-03, iteration 2) ──
//
// `chooseBase` asked whether a block's ports were free, and `supabase start` bound them tens of seconds
// later; two concurrent `up`s both found 55420 free and the second start failed on a taken port. A block
// is now CLAIMED (an exclusive lock file holding the claimant's pid) from the choice until the start
// has bound its ports; a claim whose holder is gone is taken over.
test('a block another live run has claimed is skipped; a dead claimant\'s block is taken over', async () => {
  const { claimBlock, chooseBase } = await import('../test-stack.mjs')
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-port-claims-'))
  try {
    const release = claimBlock(55420, { dir, pid: 111, alive: () => true })
    assert.equal(typeof release, 'function', 'the first claim was refused')
    assert.equal(claimBlock(55420, { dir, pid: 222, alive: () => true }), null, 'two runs claimed one block')
    const chosen = await chooseBase(live, { dir, free: async () => true, alive: () => true })
    assert.equal(chosen.base, 55430, `a second run chose ${chosen.base}, the block the first one holds`)
    chosen.release()
    // The holder of 55420 died without releasing: its claim is stale and is taken over.
    const taken = claimBlock(55420, { dir, pid: 333, alive: (pid) => pid !== 111 })
    assert.equal(typeof taken, 'function', 'a dead claimant\'s block stayed claimed forever')
    taken()
    assert.equal(typeof claimBlock(55420, { dir, pid: 444, alive: () => true }), 'function', 'release did not free the block')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a disposable stack whose start fails is stopped and started exactly once more', async () => {
  const { startWithOneRetry } = await import('../test-stack.mjs')
  const calls = []
  const ok = startWithOneRetry(() => { calls.push('start'); return { status: calls.length === 1 ? 1 : 0 } }, () => calls.push('stop'))
  assert.deepEqual(calls, ['start', 'stop', 'start'])
  assert.equal(ok.status, 0)
  const twice = []
  assert.equal(startWithOneRetry(() => { twice.push('start'); return { status: 1 } }, () => twice.push('stop')).status, 1, 'a second failure is the failure')
  assert.deepEqual(twice, ['start', 'stop', 'start'], 'never a third start')
  const once = []
  startWithOneRetry(() => { once.push('start'); return { status: 0 } }, () => once.push('stop'))
  assert.deepEqual(once, ['start'], 'a good start is not repeated')
})
