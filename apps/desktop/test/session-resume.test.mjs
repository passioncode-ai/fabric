// The owner, 2026-11-19: «либо новую, либо последнюю» on a project, and the sessions outside Fabric read, closed and
// continued in a Fabric console (board request eef5abeb, point 3).
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { claudeSlug, lastSessionOf, projectForFolder } from '../src/main/projectResume.ts'
import { continueOrigin, createMachineSessions, linkOriginOf, readTail, transcriptCwd, TAKE_OVER_WAIT_MS } from '../src/main/machineSessions.ts'
import { defaultTranscriptRoots, findTranscript, redactedTurns } from '../src/main/ceoTools.ts'
import { claudeConfigDirs } from '../src/main/diskSessions.ts'

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
    fabricRunnerIds: async () => new Set(over.runnerIds ?? [id(2)]),
    ...(over.fabricPids ? { fabricPids: async () => new Set(over.fabricPids) } : {}),
    ...('parents' in over ? { parents: async () => (over.parents ? new Map(over.parents) : null) } : {}),
    ...('project' in over ? { projectFor: async () => over.project } : {}),
    ...(over.resumeEnded ? { resumeEnded: over.resumeEnded } : {}),
    alive: (pid) => alive.has(pid),
    signal: (pid) => { signals.push(pid); if (!over.stubborn) alive.delete(pid) },
    stillNames: async (s) => over.reused ? false : alive.has(s.pid),
    transcript: () => over.transcript ?? null,
    turns: (text) => [{ role: 'user', text }],
    continueInFabric: async (s, _p, link) => { opened.push(link ? [s.sessionId, link.from ?? null] : s.sessionId); if (over.gate) await over.gate; if (over.openFails) throw new Error('no project'); return { sessionId: 'console-1' } },
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
  // UX-1 (0.3.26 review, iteration 1): a console that failed after the stop says so, with how to go on by hand.
  const fails = machine({ openFails: true })
  assert.deepEqual(await fails.m.continueInFabric(id(1)), { ok: false, why: 'stopped-not-continued', resume: { sessionId: id(1), cwd: '/d/app' } })
})

test('continue in Fabric: a folder in no project is refused BEFORE anything is stopped (0.3.26 review, UX-1)', async () => {
  const none = machine({ project: null })
  assert.deepEqual(await none.m.continueInFabric(id(1)), { ok: false, why: 'no-project' })
  assert.deepEqual(none.signals, [], 'the person\'s session is left running')
  assert.deepEqual(none.opened, [])
  const found = machine({ project: 'p-1' })
  assert.deepEqual(await found.m.continueInFabric(id(1)), { ok: true, sessionId: 'console-1' })
  assert.deepEqual(found.signals, [501])
})

test('a Fabric console is never «outside»: by its pid, or a parent pid, before the journal names its runner session (ER-3, UX-2)', async () => {
  // 501 runs under 400, a console Fabric holds; the journal does not name it yet.
  const under = machine({ runnerIds: [], fabricPids: [400], parents: [[501, 450], [450, 400], [400, 1]] })
  assert.deepEqual((await under.m.list()).map((s) => s.pid), [502])
  assert.deepEqual(await under.m.close(id(1)), { ok: false, why: 'gone' })
  assert.deepEqual(under.signals, [], 'Fabric\'s own console is never signalled from here')
  // The process table not read: only the pid itself is Fabric's.
  const itself = machine({ runnerIds: [], fabricPids: [501], parents: null })
  assert.deepEqual((await itself.m.list()).map((s) => s.pid), [502])
})

test('the process table not read: no act runs on a process whose owner could not be checked (0.3.26 review, iteration 2, ER-14)', async () => {
  const blind = machine({ runnerIds: [], fabricPids: [400], parents: null, project: 'p-1' })
  assert.deepEqual(await blind.m.close(id(1)), { ok: false, why: 'unknown-owner' })
  assert.deepEqual(await blind.m.continueInFabric(id(1)), { ok: false, why: 'unknown-owner' })
  assert.deepEqual(blind.signals, [], 'nothing is signalled')
  assert.equal((await blind.m.list()).some((x) => x.sessionId === id(1)), true, 'the list still shows it')
})

test('one continue of a session at a time; the link\'s app reaches the console (iteration 2, DA-16, ER-12, DA-15)', async () => {
  let open = () => {}
  const gate = new Promise((r) => { open = r })
  const two = machine({ project: 'p-1', gate })
  const first = two.m.continueInFabric(id(1), { from: 'observatory.default' })
  assert.deepEqual(await two.m.continueInFabric(id(1)), { ok: false, why: 'busy' })
  assert.deepEqual(await two.m.close(id(1)), { ok: false, why: 'busy' })
  open()
  assert.deepEqual(await first, { ok: true, sessionId: 'console-1' })
  assert.deepEqual(two.signals, [501], 'one signal')
  assert.deepEqual(two.opened, [[id(1), 'observatory.default']], 'the link and its app, in the contract\'s name.instance form, reach the console')
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

// DEC-0189 SL-5: a session that ended is continued from its history; one not here says so.
test('continue a session that no longer runs: from its transcript, through resumeEnded; without it, gone', async () => {
  const asked = []
  const ended = machine({ resumeEnded: async (sid) => { asked.push(sid); return { ok: true, sessionId: 'console-9' } } })
  assert.deepEqual(await ended.m.continueInFabric(id(7)), { ok: true, sessionId: 'console-9' })
  assert.deepEqual(asked, [id(7)])
  assert.deepEqual(ended.signals, [], 'nothing runs, so nothing is signalled')
  assert.deepEqual(await machine().m.continueInFabric(id(7)), { ok: false, why: 'gone' })
})

test("a transcript's folder is its first absolute cwd; the tail read starts at a whole line (ER-8)", async () => {
  assert.equal(transcriptCwd('{"type":"summary"}\n{"cwd":"/w/app","type":"user"}\n'), '/w/app')
  assert.equal(transcriptCwd('{"cwd":"relative"}\n{"cwd":"/w/b"'), null)
  const dir = mkdtempSync(path.join(tmpdir(), 'tail-'))
  const file = path.join(dir, 't.jsonl')
  writeFileSync(file, 'line-one-is-long\nline-two\nline-three\n')
  assert.equal(await readTail(file, 18), 'line-three\n')
  assert.equal(await readTail(file, 1000), 'line-one-is-long\nline-two\nline-three\n')
})

test('another session\'s turns are redacted whole before they are cut: a key across the cut leaves nothing (iteration 2, DA-13, DA-14)', () => {
  // An Anthropic-shaped key built at run time, starting 10 characters before the 700-character cut.
  const key = 'sk-ant-' + 'api03-' + 'x'.repeat(40)
  const text = 'a'.repeat(689) + ' ' + key + ' tail'
  const line = JSON.stringify({ type: 'user', message: { role: 'user', content: text } })
  const [turn] = redactedTurns(line, 12)
  assert.equal(turn.text.length <= 700, true)
  assert.equal(turn.text.includes('sk-ant-'), false, 'not even the prefix stays')
  assert.equal(/x{8}/.test(turn.text), false, 'no part of the key body stays')
})

test('a continue\'s origin: a link is a link with its app in the contract\'s grammar, a press is a screen (iteration 3, ER-25, DA-24)', () => {
  assert.deepEqual(linkOriginOf({ from: 'observatory.default' }), { from: 'observatory.default' }, 'name.instance is kept (DA-19)')
  assert.deepEqual(linkOriginOf({ from: 'Bad App' }), {}, 'outside the grammar: a link with no app')
  assert.deepEqual(linkOriginOf({}), {})
  assert.equal(linkOriginOf(undefined), undefined, 'no object: a press on a screen')
  assert.equal(linkOriginOf('observatory'), undefined)
  assert.deepEqual(continueOrigin('moved', { from: 'observatory.default' }), { reason: 'Перенесена в Fabric по ссылке из observatory.default', via: 'link' })
  assert.deepEqual(continueOrigin('resumed', {}), { reason: 'Продолжена в Fabric по ссылке из другого приложения', via: 'link' }, 'a link with no app is still a link (DA-20)')
  assert.deepEqual(continueOrigin('resumed'), { reason: 'Продолжена в Fabric из её истории', via: 'screen' })
  assert.deepEqual(continueOrigin('moved'), { reason: 'Перенесена в Fabric из терминала вне Fabric', via: 'screen' })
})

test('Switchboard\'s account homes are Claude homes: their sessions are read and continued from history (iteration 3, run four, UX-42)', async () => {
  const home = mkdtempSync(path.join(tmpdir(), 'sb-home-'))
  const data = path.join(home, 'Library/Application Support/ai.passioncode.fabric-switchboard')
  const acct = path.join(data, 'homes', 'h-account')
  mkdirSync(path.join(acct, 'projects', '-d-site'), { recursive: true })
  mkdirSync(path.join(data, 'runtimes', 'r-1'), { recursive: true })
  writeFileSync(path.join(acct, 'projects', '-d-site', `${id(7)}.jsonl`), USER)
  const dirs = await claudeConfigDirs(home)
  assert.ok(dirs.includes(acct), 'an account home is read for live sessions')
  assert.ok(dirs.includes(path.join(data, 'runtimes', 'r-1')), 'runtimes still are')
  const file = findTranscript(defaultTranscriptRoots(home), id(7))
  assert.equal(file, path.join(acct, 'projects', '-d-site', `${id(7)}.jsonl`), 'its transcript is found')
  assert.equal(path.resolve(file, '..', '..', '..'), acct, 'and continued in its own home')
})
