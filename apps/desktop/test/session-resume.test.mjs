// The owner, 2026-11-19: «либо новую, либо последнюю» on a project, and the sessions outside Fabric read, closed and
// continued in a Fabric console (board request eef5abeb, point 3).
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { claudeSlug, lastSessionOf, projectForFolder } from '../src/main/projectResume.ts'
import { createMachineSessions, TAKE_OVER_WAIT_MS } from '../src/main/machineSessions.ts'

const id = (n) => `${String(n).repeat(8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`
const USER = JSON.stringify({ type: 'user', message: { role: 'user', content: 'go' } }) + '\n'

test("Claude Code's folder slug: every character but a letter or digit is «-»", () => {
  assert.equal(claudeSlug('/Users/example/DATA/_worktrees/fabric-ceo.x'), '-Users-example-DATA--worktrees-fabric-ceo-x')
})

test('the last session of a project: the newest not running, with a turn of the person, across homes and folders', async () => {
  const a = mkdtempSync(path.join(tmpdir(), 'home-a-'))
  const b = mkdtempSync(path.join(tmpdir(), 'home-b-'))
  const put = (home, folder, n, at, body = USER) => {
    const dir = path.join(home, 'projects', claudeSlug(folder))
    mkdirSync(dir, { recursive: true })
    const f = path.join(dir, `${id(n)}.jsonl`)
    writeFileSync(f, body)
    utimesSync(f, at, at)
  }
  put(a, '/d/app', 1, 1000)
  put(b, '/d/wt', 2, 3000)                       // newest of all, in a worktree and a Switchboard home
  put(a, '/d/app', 3, 4000)                      // newer still, but running now
  put(a, '/d/app', 4, 5000, '{"type":"summary"}\n') // newest, but the person never said anything in it
  put(a, '/d/other', 5, 9000)                    // another project's folder
  const last = await lastSessionOf(['/d/app', '/d/wt'], [a, b], new Set([id(3)]))
  assert.deepEqual({ ...last, at: undefined }, { sessionId: id(2), cwd: '/d/wt', config: b, at: undefined })
  assert.equal(await lastSessionOf(['/d/none'], [a, b], new Set()), null)
})

test('the project of a folder: the deepest repository holding it, else the project of the repository it is a worktree of', async () => {
  const projects = [{ id: 'p1', repo_path: '/d/fabric' }, { id: 'p2', repo_path: '/d/fabric/sub' }, { id: 'p3', repo_path: null }]
  assert.equal((await projectForFolder('/d/fabric/sub/x', projects, async () => null)).id, 'p2')
  assert.equal((await projectForFolder('/d/fabric', projects, async () => null)).id, 'p1')
  assert.equal(await projectForFolder('/d/fabricx', projects, async () => null), null, 'a sibling with the same prefix is not inside')
  assert.equal((await projectForFolder('/w/fabric-launch', projects, async () => '/d/fabric')).id, 'p1')
})

function machine(over = {}) {
  const disk = [{ pid: 501, sessionId: id(1), cwd: '/d/app', name: null, status: 'busy', kind: 'interactive', entrypoint: 'cli', startedAt: null, updatedAt: null, config: '/h' },
    { pid: 502, sessionId: id(2), cwd: '/d/app', name: null, status: null, kind: null, entrypoint: null, startedAt: null, updatedAt: null, config: '/h' }]
  const alive = new Set([501, 502])
  const signals = [], records = [], opened = []
  const m = createMachineSessions({
    live: async () => disk.filter((d) => alive.has(d.pid)),
    fabricRunnerIds: async () => new Set([id(2)]),
    alive: (pid) => alive.has(pid),
    signal: (pid) => { signals.push(pid); if (!over.stubborn) alive.delete(pid) },
    stillNames: async (s) => over.reused ? false : alive.has(s.pid),
    transcript: () => over.transcript ?? null,
    turns: (text) => [{ role: 'user', text }],
    continueInFabric: async (s) => { opened.push(s.sessionId); if (over.openFails) throw new Error('no project'); return { sessionId: 'console-1' } },
    record: (op, d) => records.push([op, d]),
    ...(over.rows !== undefined ? { switchboardRows: async () => { if (over.rows instanceof Error) throw over.rows; return over.rows } } : {}),
    sleep: async () => {}
  })
  return { m, signals, records, opened }
}

test("outside sessions: a Fabric console's own Claude process is not listed; a close signals only the process that still names it", async () => {
  const { m, signals, records } = machine()
  assert.deepEqual((await m.list()).map((s) => s.pid), [501])
  assert.equal((await m.list())[0].config, undefined, 'the Claude home is not sent to the screen')
  assert.deepEqual(await m.close(id(1)), { ok: true })
  assert.deepEqual(signals, [501])
  assert.equal(records[0][0], 'agents.machine-close')
  assert.deepEqual(await m.close(id(1)), { ok: false, why: 'gone' })
  const reused = machine({ reused: true })
  assert.deepEqual(await reused.m.close(id(1)), { ok: false, why: 'changed' })
  assert.deepEqual(reused.signals, [], 'a pid now naming another session is never signalled')
})

test('continue in Fabric: stop it outside, wait for it to end, then the console; one that does not end is said, never killed', async () => {
  const ok = machine()
  assert.deepEqual(await ok.m.continueInFabric(id(1)), { ok: true, sessionId: 'console-1' })
  assert.deepEqual(ok.opened, [id(1)])
  const stubborn = machine({ stubborn: true })
  assert.deepEqual(await stubborn.m.continueInFabric(id(1)), { ok: false, why: 'still-running' })
  assert.deepEqual(stubborn.opened, [])
  assert.deepEqual(stubborn.signals, [501], 'one SIGTERM, no SIGKILL')
  assert.ok(TAKE_OVER_WAIT_MS >= 5000)
  const fails = machine({ openFails: true })
  assert.deepEqual(await fails.m.continueInFabric(id(1)), { ok: false, why: 'no project' })
})

test('read: the last turns from its transcript; null when the transcript is not here', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tr-'))
  writeFileSync(path.join(dir, 't.jsonl'), 'hello')
  assert.deepEqual(await machine({ transcript: path.join(dir, 't.jsonl') }).m.read(id(1)), { turns: [{ role: 'user', text: 'hello' }] })
  assert.equal(await machine().m.read(id(1)), null)
})

// The operator, 2026-11-20: «в дашборде вот вижу сессии а в фабрике не вижу». Fabric Dashboards lists Switchboard's
// rows; a session whose Claude home is not one Fabric reads was missing here.
test("every session of this Mac: Switchboard's running, waiting and needs-you rows join the files' sessions, never twice, never Fabric's own", async () => {
  const rows = [
    { session_id: id(1), agent: 'claude-code', folder: '/w/a', group: 'running', why: null },
    { session_id: id(2), agent: 'claude-code', folder: '/w/fabric', group: 'running', why: null },
    { session_id: id(7), agent: 'claude-code', folder: '/w/studio-agent', group: 'running', why: null },
    { session_id: id(8), agent: 'codex', folder: '/w/riffly', group: 'waiting', why: null },
    { session_id: id(9), agent: 'claude-code', folder: '/w/copy', group: 'needs_you', why: 'duplicate' },
    { session_id: null, agent: 'claude-code', folder: '/w/gone', group: 'needs_you', why: 'gone' },
    { session_id: id(6), agent: 'claude-code', folder: '/w/old', group: 'ended', why: null }
  ]
  const { m } = machine({ rows })
  const list = await m.list()
  assert.deepEqual(list.map((s) => [s.sessionId, s.source, s.state]), [
    [id(9), 'switchboard', 'needs_you'],
    [id(1), 'claude', 'working'],
    [id(7), 'switchboard', 'working'],
    [id(8), 'switchboard', 'waiting']
  ])
  assert.equal(list.find((s) => s.sessionId === id(8)).agent, 'codex')
  assert.equal(list.find((s) => s.sessionId === id(7)).cwd, '/w/studio-agent')
  // A session only Switchboard names is not acted on from here: its process is not known.
  assert.deepEqual(await m.close(id(7)), { ok: false, why: 'gone' })
  // Switchboard not answering leaves the files' sessions.
  assert.deepEqual((await machine({ rows: null }).m.list()).map((s) => s.sessionId), [id(1)])
  assert.deepEqual((await machine({ rows: new Error('timed out') }).m.list()).map((s) => s.sessionId), [id(1)])
})
