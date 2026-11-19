// The launch journal (board request eef5abeb): who started a console, from where, in which branch, the runner's own
// session id for `--resume`, and how it ended; on disk, one JSON line per event.
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { chainOf, endOf, foldLaunches, parseLaunchLine } from '../src/shared/sessionLaunches.ts'
import { claudeSessionOf, createLaunchJournal, RUNNER_SESSION_EVERY_MS } from '../src/main/sessionLaunches.ts'
import { currentLaunchOrigin, withLaunchOrigin } from '../src/main/launchOrigin.ts'

function journal(over = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'launches-'))
  const timers = []
  const failures = []
  let clock = new Date('2026-11-19T19:00:00.000Z')
  const j = createLaunchJournal({
    dir, machine: 'mac', appVersion: '0.3.25', appPid: 100,
    now: () => clock,
    redact: (t) => t.replace(/sk-[a-z0-9]+/g, '[redacted]'),
    readBranch: async () => 'feat/x',
    readRunnerSession: over.readRunnerSession ?? (async () => null),
    failed: (kind, e) => failures.push([kind, String(e)]),
    setTimer: (fn, ms) => { const t = { fn, ms, cancelled: false, cancel() { t.cancelled = true } }; timers.push(t); return t },
    ...over.deps
  })
  return { j, dir, timers, failures, tick: (ms) => { clock = new Date(clock.getTime() + ms) } }
}
const opened = (over = {}) => ({ sessionId: 's1', projectId: 'p1', cwd: '/d/app', runner: 'claude-code', optionId: 'claude-code', program: 'claude', pid: 4242, origin: { by: 'person', via: 'screen' }, ...over })
const flushTimers = async (timers) => { for (const t of timers.splice(0)) if (!t.cancelled) { t.fn(); await new Promise((r) => setImmediate(r)) } }

test('a start and an end are written as lines and folded into one launch, with branch, origin and outcome', async () => {
  const { j, dir } = journal()
  await j.opened(opened({ origin: { by: 'ceo', via: 'voice', reason: 'restore the site after the reboot, key sk-abc123', parentSessionId: 'ceo-1', requestId: 'r1' } }))
  await j.ended('s1', { exitCode: 0, signal: null, stopRequested: false })
  const files = readdirSync(dir)
  assert.deepEqual(files, ['launches-2026-11.jsonl'])
  assert.equal(statSync(path.join(dir, files[0])).mode & 0o777, 0o600)
  assert.equal(statSync(dir).mode & 0o777, 0o700)
  const raw = readFileSync(path.join(dir, files[0]), 'utf8')
  assert.doesNotMatch(raw, /sk-abc123/, 'a reason is redacted before it is written')
  const [l] = await j.read()
  assert.equal(l.by, 'ceo')
  assert.equal(l.via, 'voice')
  assert.equal(l.parentSessionId, 'ceo-1')
  assert.equal(l.requestId, 'r1')
  assert.equal(l.branch, 'feat/x')
  assert.equal(l.machine, 'mac')
  assert.equal(l.end, 'exited')
  assert.equal(l.pid, 4242)
})

test('the end says why: a stop someone asked for, a crash, Fabric quitting', async () => {
  assert.equal(endOf({ quitting: false, stopRequested: false, signal: null, exitCode: 0 }), 'exited')
  assert.equal(endOf({ quitting: false, stopRequested: false, signal: 9, exitCode: 0 }), 'crashed')
  assert.equal(endOf({ quitting: false, stopRequested: true, signal: 15, exitCode: 0 }), 'stopped')
  assert.equal(endOf({ quitting: true, stopRequested: true, signal: 15, exitCode: 0 }), 'app-quit')
  const { j } = journal()
  await j.opened(opened({ sessionId: 'a' }))
  await j.opened(opened({ sessionId: 'b' }))
  await j.stopAsked('a', 'person', 'done with it')
  j.markQuitting()
  await j.ended('a', { exitCode: 0, signal: 15, stopRequested: true })
  await j.ended('b', { exitCode: 0, signal: 15, stopRequested: true })
  const byId = new Map((await j.read()).map((l) => [l.sessionId, l]))
  assert.equal(byId.get('a').end, 'stopped', 'a stop the person asked for before the quit stays a stop: never restored')
  assert.equal(byId.get('a').stopAskedBy, 'person')
  assert.equal(byId.get('b').end, 'app-quit', 'a console Fabric ended by quitting is one a restore brings back')
})

test("the runner's own session id is read after the start and again while it runs, written once per change", async () => {
  const ids = ['', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']
  let call = 0
  const { j, timers } = journal({ readRunnerSession: async () => ids[Math.min(call++, ids.length - 1)] || null })
  await j.opened(opened())
  for (let i = 0; i < 4; i++) await flushTimers(timers)
  assert.equal(timers.at(-1)?.ms, RUNNER_SESSION_EVERY_MS, 'after the first minute it looks every five minutes')
  await j.flush()
  const [l] = await j.read()
  assert.equal(l.runnerSessionId, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'after /clear the newest id wins')
  await j.ended('s1', { exitCode: 0, signal: null, stopRequested: false })
  assert.ok(timers.every((t) => t.cancelled), 'the end stops the look')
})

test('an end written before its opening still folds, and starts no watch', async () => {
  let looked = 0
  const { j, timers } = journal({ readRunnerSession: async () => { looked++; return null } })
  const ended = j.ended('s1', { exitCode: 1, signal: null, stopRequested: false })
  await j.opened(opened())
  await ended
  assert.equal(timers.length, 0)
  assert.equal(looked, 0)
  const [l] = await j.read()
  assert.equal(l.end, 'exited')
  assert.equal(l.exitCode, 1)
})

test('a torn or foreign line is skipped and the rest still read; a line without its opening is dropped', async () => {
  const { j, dir } = journal()
  await j.opened(opened())
  appendFileSync(path.join(dir, 'launches-2026-11.jsonl'), '{"v":1,"at":"x","event":"opened"\nnot json\n{"v":2}\n')
  appendFileSync(path.join(dir, 'launches-2026-11.jsonl'), JSON.stringify({ v: 1, at: '2026-11-19T19:01:00Z', event: 'ended', session_id: 'ghost', exit_code: 0, signal: null, end: 'exited' }) + '\n')
  const all = await j.read()
  assert.deepEqual(all.map((l) => l.sessionId), ['s1'])
  assert.equal(parseLaunchLine('{"v":1,"at":"x","session_id":"s","event":"opened","by":"nobody"}'), null, 'an unknown origin is refused, never guessed')
})

test('a read filters by session (Fabric id or the runner id), by project; files older than 13 months are pruned', async () => {
  const { j, dir, tick } = journal({ readRunnerSession: async () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })
  writeFileSync(path.join(dir, 'launches-2025-09.jsonl'), '')
  writeFileSync(path.join(dir, 'launches-2025-11.jsonl'), '')
  writeFileSync(path.join(dir, 'notes.txt'), 'kept')
  await j.opened(opened({ sessionId: 'x', projectId: 'p2' }))
  tick(1000)
  await j.opened(opened({ sessionId: 'y' }))
  assert.deepEqual((await j.read({ projectId: 'p2' })).map((l) => l.sessionId), ['x'])
  assert.deepEqual((await j.read()).map((l) => l.sessionId), ['y', 'x'], 'newest first')
  assert.deepEqual(await j.prune(), ['launches-2025-09.jsonl'])
  assert.ok(readdirSync(dir).includes('notes.txt'))
  assert.ok(readdirSync(dir).includes('launches-2025-11.jsonl'))
})

test('the chain above a launch: the CEO console above the session it started, a cycle cut', () => {
  const lines = [
    { v: 1, at: '2026-11-19T19:00:00Z', event: 'opened', session_id: 'ceo', project_id: 'p', cwd: '/c', branch: null, runner: 'claude-code', option_id: 'claude-code', program: 'claude', by: 'fabric', via: null, reason: null, parent_session_id: null, task_id: null, request_id: null, machine: 'm', app_pid: 1, app_version: 'v', pid: 1 },
    { v: 1, at: '2026-11-19T19:01:00Z', event: 'opened', session_id: 'b', project_id: 'p', cwd: '/c', branch: null, runner: 'codex', option_id: 'codex', program: 'codex', by: 'ceo', via: 'voice', reason: 'r', parent_session_id: 'ceo', task_id: null, request_id: null, machine: 'm', app_pid: 1, app_version: 'v', pid: 2 }
  ]
  const all = foldLaunches(lines)
  const map = new Map(all.map((l) => [l.sessionId, l]))
  assert.deepEqual(chainOf(map.get('b'), map).map((l) => l.sessionId), ['ceo'])
  map.get('ceo').parentSessionId = 'b'
  assert.deepEqual(chainOf(map.get('b'), map).map((l) => l.sessionId), ['ceo'], 'a cycle stops at the start')
})

test('the origin travels through awaits to the spawn; none is Fabric\'s own, never the person\'s', async () => {
  assert.deepEqual(currentLaunchOrigin(), { by: 'fabric' })
  const seen = await withLaunchOrigin({ by: 'ceo', reason: 'x' }, async () => {
    await new Promise((r) => setTimeout(r, 1))
    return currentLaunchOrigin()
  })
  assert.equal(seen.by, 'ceo')
  assert.deepEqual(currentLaunchOrigin(), { by: 'fabric' })
})

test("Claude Code's session file: the id when the pid matches, null for another runner or a mismatch", async () => {
  const config = mkdtempSync(path.join(tmpdir(), 'claude-'))
  mkdirSync(path.join(config, 'sessions'))
  writeFileSync(path.join(config, 'sessions', '77.json'), JSON.stringify({ pid: 77, sessionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }))
  writeFileSync(path.join(config, 'sessions', '78.json'), JSON.stringify({ pid: 99, sessionId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }))
  assert.equal(await claudeSessionOf('claude-code', 77, { CLAUDE_CONFIG_DIR: config }), 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')
  assert.equal(await claudeSessionOf('claude-code', 78, { CLAUDE_CONFIG_DIR: config }), null)
  assert.equal(await claudeSessionOf('claude-code', 79, { CLAUDE_CONFIG_DIR: config }), null)
  assert.equal(await claudeSessionOf('codex', 77, { CLAUDE_CONFIG_DIR: config }), null)
})

// Point 4 of eef5abeb: a `switchboard` call that gave no exit code says why, a read is tried once more, an act never.
import { readOnlySwitchboardCall, switchboardFailure, withOneRetry } from '../src/main/switchboardSessions.ts'
import { liveClaudeSessions } from '../src/main/diskSessions.ts'
import { execFile } from 'node:child_process'

test('a switchboard call killed by its deadline or a signal is named, never «Command failed»', async () => {
  const killed = await new Promise((r) => execFile(process.execPath, ['-e', 'setTimeout(()=>{},5000)'], { timeout: 50 }, (err) => r(err)))
  const f = switchboardFailure(killed, 10_000)
  assert.match(f.reason, /did not answer within 10 s/)
  assert.equal(f.retry, true)
  assert.match(switchboardFailure({ code: 'ENOENT', message: 'spawn x ENOENT' }, 1).reason, /not where it was found/)
  assert.equal(switchboardFailure({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }, 1).retry, false)
  assert.match(switchboardFailure({ signal: 'SIGKILL', killed: false, message: 'Command failed: x' }, 1).reason, /ended by SIGKILL/)
})

test('only a read is tried twice, a second later with twice the deadline; an act is never repeated', async () => {
  assert.equal(readOnlySwitchboardCall(['--json', 'sessions', '--rows']), true)
  assert.equal(readOnlySwitchboardCall(['--json', 'recovery']), true)
  assert.equal(readOnlySwitchboardCall(['sessions', 'end', 'l1']), false)
  assert.equal(readOnlySwitchboardCall(['--json', 'sessions', 'continue', 'x']), false)
  const deadlines = []
  const slept = []
  const ok = await withOneRetry(async (d) => { deadlines.push(d); if (deadlines.length === 1) throw Object.assign(new Error('late'), { retry: true }); return 'rows' }, 10_000, async (ms) => { slept.push(ms) })
  assert.equal(ok, 'rows')
  assert.deepEqual(deadlines, [10_000, 20_000])
  assert.deepEqual(slept, [1000])
  let calls = 0
  await assert.rejects(withOneRetry(async () => { calls++; throw new Error('exit 2') }, 10, async () => {}), /exit 2/)
  assert.equal(calls, 1, 'a failure a second try cannot cure is not tried again')
})

test("the machine's Claude Code sessions from Claude Code's own files: live ones, valid ones, each process once", async () => {
  const a = mkdtempSync(path.join(tmpdir(), 'cfg-a-'))
  const b = mkdtempSync(path.join(tmpdir(), 'cfg-b-'))
  for (const c of [a, b]) mkdirSync(path.join(c, 'sessions'))
  const row = (pid, extra = {}) => JSON.stringify({ pid, sessionId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', cwd: '/d/x', startedAt: 1795113564080, updatedAt: 1795113564080 + pid, status: 'busy', name: 'x', ...extra })
  writeFileSync(path.join(a, 'sessions', '11.json'), row(11))
  writeFileSync(path.join(a, 'sessions', '12.json'), row(12))
  writeFileSync(path.join(a, 'sessions', '13.json'), row(99))
  writeFileSync(path.join(a, 'sessions', '14.json'), row(14, { cwd: 'relative' }))
  writeFileSync(path.join(a, 'sessions', '15.json'), '{"pid":15')
  writeFileSync(path.join(a, 'sessions', '11.abc.key'), 'x')
  writeFileSync(path.join(b, 'sessions', '16.json'), row(16, { sessionId: 'not-a-uuid' }))
  const live = await liveClaudeSessions([a, b, path.join(a, 'missing')], (pid) => pid !== 12)
  assert.deepEqual(live.map((s) => s.pid), [11], 'gone, renamed, relative, torn and invalid files are skipped')
  assert.equal(live[0].startedAt, new Date(1795113564080).toISOString())
})
