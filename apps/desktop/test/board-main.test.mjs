// #region board-main-test — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
// ADR-0195 W2c.1a: the board's entry runs the hub under plain Node. `boardMain.ts#startBoardProcess` is started here
// against a stand-in database (no stack), on an ephemeral hub port under a temporary home, and an agent's call is
// answered over that port; its quit, its consent presenter without a window, its link opener and its project reads are
// driven on their own; and its import graph is read to prove the entry never reaches Electron or the window's module.
import './helpers/ts-resolve.mjs'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

const SRC = path.resolve(import.meta.dirname, '../src/main')
const HOOK = path.resolve(import.meta.dirname, 'helpers/ts-resolve.mjs')
const OPERATOR = '00000000-0000-0000-0000-00000000000a'

async function freePort() {
  const probe = createServer()
  await new Promise((r) => probe.listen(0, '127.0.0.1', r))
  const port = probe.address().port
  await new Promise((r) => probe.close(r))
  return port
}

/** No stack: the operator's identity resolves, every other call is refused, and each one is counted. */
function standInDb() {
  const calls = []
  const refused = (what) => Promise.resolve({ data: null, error: { message: `the stand-in has no ${what}` } })
  return {
    calls,
    rpc(name) {
      calls.push(`rpc:${name}`)
      if (name === 'resolve_subject') return Promise.resolve({ data: { ok: true, person_id: OPERATOR, role: 'owner', revision: 1 }, error: null })
      return refused(`function ${name}`)
    },
    from(table) {
      calls.push(`from:${table}`)
      throw new Error(`the stand-in has no table ${table}`)
    }
  }
}

const rpc = async (origin, token, id, method, params = {}) => {
  const r = await fetch(`${origin}/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  })
  const text = await r.text()
  let body = text
  try { body = JSON.parse(text) } catch { /* a stream frame: kept as text, the assertions below read it */ }
  return { status: r.status, body, text }
}

const opsLines = (userData) => {
  const dir = path.join(userData, 'board', 'logs')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => f.endsWith('.jsonl')).flatMap((f) => readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)))
}

const home = mkdtempSync(path.join(tmpdir(), 'board-main-home-'))
const userData = mkdtempSync(path.join(tmpdir(), 'board-main-data-'))
// The hub's root and its port: registryDirs() reads the home (and XDG on Linux), startHub reads FABRIC_HUB_PORT.
process.env.HOME = home
process.env.XDG_DATA_HOME = path.join(home, '.local/share')
process.env.LOCALAPPDATA = path.join(home, 'AppData', 'Local')
delete process.env.FABRIC_SERVICES_DIR
delete process.env.FABRIC_PROVIDERS_DIR
process.env.FABRIC_HUB_PORT = String(await freePort())
test.after(() => { rmSync(home, { recursive: true, force: true }); rmSync(userData, { recursive: true, force: true }) })

const boardMain = await import(path.join(SRC, 'boardMain.ts'))
const { registryDirs } = await import(path.join(SRC, 'agentRegistry.ts'))

test('(a) the board process starts the hub against a stand-in database and answers an agent over its port', async () => {
  const db = standInDb()
  const exits = []
  const board = await boardMain.startBoardProcess({ userData, db, signals: new EventEmitter(), exit: (code) => exits.push(code) })
  const { root } = registryDirs()
  const hubFile = path.join(root, 'hub.json')
  try {
    assert.equal(board.hub.down, null, `the hub is down: ${board.hub.down}`)
    assert.equal(board.surface.origin, `http://127.0.0.1:${process.env.FABRIC_HUB_PORT}`)
    assert.ok(existsSync(hubFile), 'hub.json is published under the board\'s registry root')
    const published = JSON.parse(readFileSync(hubFile, 'utf8'))
    assert.equal(published.origin, board.surface.origin)
    assert.equal(published.pid, process.pid, 'hub.json names the board\'s own process')
    const token = board.hub.doorToken
    assert.ok(token, 'a door token is published')
    const init = await rpc(board.surface.origin, token, 1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'board-main-test', version: '0' } })
    assert.equal(init.status, 200, init.text)
    const list = await rpc(board.surface.origin, token, 2, 'tools/list')
    assert.equal(list.status, 200, list.text)
    assert.match(list.text, /fabric\.access\.request/, 'the door\'s tools are listed')
    // An unknown bearer is looked up in the database, which the stand-in refuses: the hub says so, it never lets it in.
    assert.equal((await rpc(board.surface.origin, 'x'.repeat(43), 3, 'tools/list')).status, 503, 'an unknown bearer is refused')
    // The operator was established from the database before the hub opened; the window was never asked.
    assert.ok(db.calls.includes('rpc:resolve_subject'))
    // The single operator's actor, as the window's identity names it (`shared/identity.ts#actorOf`).
    assert.deepEqual(board.operator, { kind: 'person', id: 'operator' })
  } finally {
    await board.stop()
  }
  assert.deepEqual(exits, [0], 'a stop ends the process once, with 0')
  assert.equal(existsSync(hubFile), false, 'hub.json is withdrawn at the stop')
  assert.ok(opsLines(userData).some((r) => r.op === 'hub.published'), 'the board writes its own operations log')
})

test('0.3.23 review, iteration 1, ER-7: a start that fails after its hub is up withdraws hub.json before it fails, and exits nothing itself', async () => {
  const exits = []
  const { root } = registryDirs()
  const hubFile = path.join(root, 'hub.json')
  await assert.rejects(boardMain.startBoardProcess({ userData, db: standInDb(), signals: new EventEmitter(), exit: (code) => exits.push(code),
    ready: () => { assert.ok(existsSync(hubFile), 'the hub was up'); throw new Error('a later step failed') } }), /a later step failed/)
  assert.equal(existsSync(hubFile), false, 'hub.json is withdrawn: it names no dead process')
  assert.deepEqual(exits, [], 'the caller exits 1 (main), never 0 from the quit')
})

test('(a) an unreadable estate choice stops the start before the hub opens', async () => {
  const bad = mkdtempSync(path.join(tmpdir(), 'board-main-bad-'))
  try {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(path.join(bad, 'active-estate.json'), '{not json')
    await assert.rejects(boardMain.startBoardProcess({ userData: bad, db: standInDb(), signals: new EventEmitter(), exit: () => {} }), /estate/i)
  } finally { rmSync(bad, { recursive: true, force: true }) }
})

test('(b) the quit runs every handler once on SIGTERM, then exits 0; a second signal forces the exit', async () => {
  const signals = new EventEmitter()
  const exits = []
  let shutdowns = 0
  let release
  const quit = boardMain.createBoardQuit({ signals, exit: (code) => exits.push(code), shutdown: () => { shutdowns++; return new Promise((r) => { release = r }) } })
  const ran = []
  quit.onQuit(() => ran.push('a'))
  quit.onQuit(() => { throw new Error('a broken stop') })
  quit.onQuit(() => ran.push('b'))
  assert.equal(quit.quitting, false)
  signals.emit('SIGTERM')
  assert.equal(quit.quitting, true)
  assert.deepEqual(ran, ['a', 'b'], 'each handler ran once; a broken one did not stop the others')
  signals.emit('SIGTERM')
  assert.deepEqual(exits, [boardMain.BOARD_FORCED_EXIT_CODE], 'a second signal while draining forces the exit')
  await new Promise((r) => setImmediate(r))
  release()
  await new Promise((r) => setTimeout(r, 10))
  assert.equal(shutdowns, 1, 'the surface is stopped once')
  quit.onQuit(() => ran.push('late'))
  assert.deepEqual(ran, ['a', 'b', 'late'], 'a handler registered while quitting runs at once')
  assert.deepEqual(exits, [boardMain.BOARD_FORCED_EXIT_CODE], 'the drain that ends after a forced exit does not exit again')
})

test('(b) the quit exits 0 once the drain ends, and at its deadline when the drain stalls', async () => {
  const signals = new EventEmitter()
  const exits = []
  const quit = boardMain.createBoardQuit({ signals, exit: (code) => exits.push(code), shutdown: async () => {} })
  signals.emit('SIGINT')
  await new Promise((r) => setTimeout(r, 10))
  assert.deepEqual(exits, [0], 'a drained quit ends 0, once')
  const stalled = []
  const q2 = boardMain.createBoardQuit({ signals: new EventEmitter(), exit: (code) => stalled.push(code), shutdown: () => new Promise(() => {}), deadlineMs: 30 })
  void q2.quit('stop')
  await new Promise((r) => setTimeout(r, 80))
  assert.deepEqual(stalled, [boardMain.BOARD_FORCED_EXIT_CODE], 'a stalled drain is ended at the deadline')
})

test('0.3.23 review, iteration 2, ER-8: a failed start\'s release ends at the quit\'s deadline when the shutdown stalls, and exits nothing', async () => {
  const exits = []
  const ran = []
  const q = boardMain.createBoardQuit({ signals: new EventEmitter(), exit: (code) => exits.push(code), shutdown: () => new Promise(() => {}), deadlineMs: 30 })
  q.onQuit(() => ran.push('stop'))
  const settled = await Promise.race([q.release().then(() => 'released'), new Promise((r) => setTimeout(() => r('stalled'), 1000).unref())])
  assert.equal(settled, 'released', 'the release returns at the deadline, so the start-failure catch reaches its rethrow')
  assert.deepEqual(ran, ['stop'], 'the stops ran')
  assert.equal(q.quitting, true)
  assert.deepEqual(exits, [], 'the release exits nothing: main exits with BOARD_START_FAILED_EXIT_CODE')
})

test('(c) the presenter without a window never throws and says the pending consent in the operations log', async () => {
  // The log of this file's board (the start refused above pointed the sink at a folder it then removed).
  const { createOps } = await import(path.join(SRC, 'ops.ts'))
  const { useOps } = await import(path.join(SRC, 'opsSink.ts'))
  useOps(createOps({ dir: boardMain.boardLogDir(userData) }))
  const decided = []
  const presenter = boardMain.headlessPresenter({
    access: () => ({ decide: async (id, d) => { decided.push([id, d]); return { ok: true } } }),
    accessStore: { request: async () => null, liveConnection: async () => null },
    connector: { begin: async () => ({ ok: true }) },
    operator: { kind: 'person', id: OPERATOR }
  })
  const row = {
    id: 'req-1', agent_id: 'example-agent.default', callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['cloudflare:news@example.com'],
    reason: 'summarise the newsletter', registry: { name: 'Example agent', installed_by: 'example-installer', repository: null },
    asked_by_binding: null, requested_at: new Date().toISOString(), expires_at: new Date(Date.now() + 600_000).toISOString(), status: 'pending'
  }
  assert.doesNotThrow(() => presenter.present({ row, connected: false }))
  assert.doesNotThrow(() => presenter.resume())
  assert.doesNotThrow(() => presenter.bringForward())
  await new Promise((r) => setTimeout(r, 20))
  assert.deepEqual(decided, [], 'nothing is decided without a person')
  const lines = opsLines(userData)
  assert.ok(lines.some((r) => r.op === 'board.consent.pending' && r.outcome === 'unknown'), 'the pending request is said in the board\'s log')
  assert.ok(lines.some((r) => r.op === 'hub.consent.notified' && r.detail?.request_id === 'req-1' && r.detail?.shown === false))
})

test('(c) links: only http(s) is opened, with `open` and no shell on macOS, and said but not opened elsewhere', async () => {
  const runs = []
  const fakeSpawn = (cmd, args, options) => {
    runs.push([cmd, args, options.shell])
    const child = new EventEmitter()
    setImmediate(() => child.emit('exit', 0))
    return child
  }
  await boardMain.openWithSystem('https://example.com/sign-in?x=1', { platform: 'darwin', spawn: fakeSpawn })
  assert.deepEqual(runs, [['open', ['https://example.com/sign-in?x=1'], false]])
  await assert.rejects(boardMain.openWithSystem('/Applications/Calculator.app', { platform: 'darwin', spawn: fakeSpawn }), /http/)
  await assert.rejects(boardMain.openWithSystem('-a Calculator', { platform: 'darwin', spawn: fakeSpawn }), /http/)
  const failing = () => { const c = new EventEmitter(); setImmediate(() => c.emit('exit', 1)); return c }
  await assert.rejects(boardMain.openWithSystem('https://example.com', { platform: 'darwin', spawn: failing }), /exited 1/)
  await boardMain.openWithSystem('https://example.com', { platform: 'linux', spawn: fakeSpawn })
  assert.equal(runs.length, 1, 'nothing is spawned off macOS')
})

test('(c) the project reads answer from the store and throw a failed read', async () => {
  const { createProjectReads } = await import(path.join(SRC, 'projectReads.ts'))
  const rows = { projects: [{ id: 'p1', name: 'One' }], project_repos: [{ path: '/r/one', project_id: 'p1', is_primary: true }] }
  const q = (data, error = null) => {
    const b = { eq: () => b, order: () => b, maybeSingle: () => Promise.resolve({ data: data[0] ?? null, error }), then: (ok, ko) => Promise.resolve({ data, error }).then(ok, ko) }
    return b
  }
  let broken = false
  const store = {
    select: (table) => broken ? q([], { message: 'down' }) : q(rows[table] ?? []),
    selectAll: async (table) => broken ? { failed: 'down', rows: [] } : { failed: null, rows: rows[table] ?? [] }
  }
  const reads = createProjectReads({ store: () => store, originOf: async () => 'git@example.com:o/one.git', lsRemote: async () => [] })
  assert.deepEqual(await reads.enroll('p1'), { id: 'p1', name: 'One' })
  assert.deepEqual(await reads.reposWithRemotes('p1'), [{ path: '/r/one', remote: 'git@example.com:o/one.git' }])
  assert.deepEqual([...(await reads.readImported()).keys()].length, 1)
  broken = true
  await assert.rejects(reads.enroll('p1'), /down/)
  await assert.rejects(reads.listRemovals(), /down/)
})

test('(e) the entry runs only as the process entry, and refuses to start without its folder or its database', () => {
  const run = (args, env) => spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--import', HOOK, path.join(SRC, 'boardMain.ts'), ...args], {
    env: { PATH: process.env.PATH, HOME: home, ELECTRON_RUN_AS_NODE: '1', ...env }, encoding: 'utf8', timeout: 30_000
  })
  const noFolder = run([], { SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_SERVICE_ROLE_KEY: 'planted-value-never-printed' })
  assert.equal(noFolder.status, 2, noFolder.stderr)
  assert.match(noFolder.stderr, /--user-data/)
  const noDb = run(['--user-data', userData], {})
  assert.equal(noDb.status, 2, noDb.stderr)
  assert.match(noDb.stderr, /SUPABASE_URL/)
  assert.match(noDb.stderr, /SUPABASE_SERVICE_ROLE_KEY/)
  for (const r of [noFolder, noDb]) assert.doesNotMatch(r.stdout + r.stderr, /planted-value-never-printed/, 'no value is printed')
  // Not the entry (no ELECTRON_RUN_AS_NODE): loading the file starts nothing and ends at once.
  const loaded = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--import', HOOK, path.join(SRC, 'boardMain.ts')], { env: { PATH: process.env.PATH, HOME: home }, encoding: 'utf8', timeout: 30_000 })
  assert.equal(loaded.status, 0, loaded.stderr)
  assert.equal(loaded.stderr, '')
})

// #region board-main-closure — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
/** The static import closure of a source file: relative imports followed, `import type` and `export type` skipped. */
function closure(entry) {
  const seen = new Set()
  const walk = (file) => {
    if (seen.has(file)) return
    seen.add(file)
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
      if (m[1] || !m[2].startsWith('.')) continue
      const base = path.resolve(path.dirname(file), m[2])
      const found = [base, base.replace(/\.js$/, '.ts'), `${base}.ts`, path.join(base, 'index.ts')].find((c) => existsSync(c) && /\.(ts|tsx|json)$/.test(c))
      assert.ok(found, `${path.relative(SRC, file)} imports ${m[2]}, which does not resolve`)
      if (found.endsWith('.ts') || found.endsWith('.tsx')) walk(found)
    }
  }
  walk(entry)
  return [...seen]
}
// #endregion board-main-closure

test('(d) the entry\'s static import closure never reaches env.ts, index.ts or a top-level Electron import', () => {
  const files = closure(path.join(SRC, 'boardMain.ts'))
  assert.ok(files.some((f) => f.endsWith('/main/board.ts')), 'the closure is read through board.ts')
  for (const f of files) {
    const rel = path.relative(path.resolve(SRC, '..'), f)
    assert.ok(!/(^|\/)main\/(env|index)\.ts$/.test(rel), `${rel} is the window's module`)
    const text = readFileSync(f, 'utf8')
    assert.doesNotMatch(text, /^\s*import\s[^;]*?\bfrom\s+['"]electron['"]/m, `${rel} imports Electron at its top level`)
    assert.doesNotMatch(text, /^\s*import\s+['"]electron['"]/m, `${rel} imports Electron for its effect`)
    assert.doesNotMatch(text, /^(?:const|let|var|export)\b[^\n]*require\(\s*['"]electron['"]\s*\)/m, `${rel} requires Electron at its top level`)
  }
})

test('the window gives the hub an operator it has established, not one assigned later', () => {
  const index = readFileSync(path.join(SRC, 'index.ts'), 'utf8')
  const hubCall = index.indexOf('await startBoardHub({')
  assert.ok(hubCall > 0)
  const firstAssign = index.indexOf('OPERATOR_ACTOR = identity.actor()')
  assert.ok(firstAssign > 0 && firstAssign < hubCall, 'OPERATOR_ACTOR is assigned from the established identity before startBoardHub reads it')
})
// #endregion board-main-test
