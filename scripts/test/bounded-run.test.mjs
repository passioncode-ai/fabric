// scripts/lib/bounded-run.mjs: a scheduled job can never wedge (lifecycle LC-02, LC-03, LC-12).
// Real processes, real files; no network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { boundedRun, acquireLock, writeStatus, rotateLog, nonInteractiveGitEnv } from '../lib/bounded-run.mjs'

const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const tmp = () => mkdtempSync(path.join(tmpdir(), 'fabric-bounded-'))

test('a command that hangs is ended at its deadline, with everything it started', async () => {
  const dir = tmp()
  const mark = path.join(dir, 'grand.pid')
  // The child starts a grandchild that ignores SIGTERM and records its pid, then hangs: the shape of
  // the publish step that deadlocked on exit with test processes under it.
  const script = `const c=require("child_process").spawn(process.execPath,["-e","process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{stdio:"ignore"});require("fs").writeFileSync(${JSON.stringify(mark)},String(c.pid));setInterval(()=>{},1000)`
  const started = Date.now()
  await assert.rejects(boundedRun(process.execPath, ['-e', script], { timeoutMs: 1500, stdio: 'ignore' }), (e) => e.code === 'ETIMEDOUT')
  assert.ok(Date.now() - started < 6000, 'the deadline did not end the command')
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(alive(Number(readFileSync(mark, 'utf8'))), false, 'a grandchild outlived the timed-out step')
  rmSync(dir, { recursive: true, force: true })
})

test('a failing command rejects with its exit status; a passing one resolves', async () => {
  await boundedRun(process.execPath, ['-e', 'process.exit(0)'], { timeoutMs: 10_000, stdio: 'ignore' })
  await assert.rejects(boundedRun(process.execPath, ['-e', 'process.exit(3)'], { timeoutMs: 10_000, stdio: 'ignore' }), (e) => e.status === 3)
})

test('a command with no deadline is refused before it starts', () => {
  assert.throws(() => boundedRun(process.execPath, ['-e', '0'], {}), /positive timeoutMs/)
})

test('the lock admits one holder; a second is refused; a dead holder is replaced; the holder\'s child is admitted', async () => {
  const dir = tmp()
  const file = path.join(dir, 'publish.lock')
  const a = acquireLock(file, { token: 'run-a' })
  assert.ok(a, 'the first holder was refused')
  assert.equal(acquireLock(file, { token: 'run-b' }), null, 'a second publisher was admitted while the first held the lock')
  assert.ok(acquireLock(file, { token: 'run-a' }), 'the holder\'s own child (same token) was refused')
  a.release()
  assert.equal(existsSync(file), false)
  // A holder that died without releasing: its pid is gone, so the lock is taken over.
  const dead = spawn(process.execPath, ['-e', '0'])
  await new Promise((r) => dead.once('exit', r))
  writeFileSync(file, JSON.stringify({ pid: dead.pid, token: 'crashed', at: 'x' }))
  assert.ok(acquireLock(file, { token: 'run-c' }), 'a crashed holder wedged the lock')
  rmSync(dir, { recursive: true, force: true })
})

test('the status record is written atomically and owner-only', () => {
  const dir = tmp()
  const file = path.join(dir, 'status.json')
  writeStatus(file, { outcome: 'running' })
  writeStatus(file, { outcome: 'published' })
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).outcome, 'published')
  assert.equal(statSync(file).mode & 0o777, 0o600)
  rmSync(dir, { recursive: true, force: true })
})

test('the log rotates past its cap and keeps a bounded number of generations', () => {
  const dir = tmp()
  const file = path.join(dir, 'sync.log')
  for (let i = 0; i < 4; i++) { writeFileSync(file, 'x'.repeat(200)); rotateLog(file, { maxBytes: 100, keep: 2 }) }
  assert.equal(existsSync(file), false)
  assert.ok(existsSync(`${file}.1`) && existsSync(`${file}.2`))
  assert.equal(existsSync(`${file}.3`), false, 'more generations were kept than the cap')
  writeFileSync(file, 'small')
  assert.equal(rotateLog(file, { maxBytes: 100, keep: 2 }), false)
  rmSync(dir, { recursive: true, force: true })
})

test('git is run so that it can never wait on a person', () => {
  const env = nonInteractiveGitEnv({ PATH: '/usr/bin' })
  assert.equal(env.GIT_TERMINAL_PROMPT, '0')
  assert.match(env.GIT_SSH_COMMAND, /BatchMode=yes/)
  assert.match(env.GIT_SSH_COMMAND, /ConnectTimeout=\d+/)
})

// The scheduled sync is the job that wedged; its source keeps every guarantee in place.
test('workspace.mjs runs no command without a deadline, and the sync is locked, watched and recorded', () => {
  const src = readFileSync(path.resolve(import.meta.dirname, '../workspace.mjs'), 'utf8')
  assert.doesNotMatch(src, /import\s*\{[^}]*\b(execFileSync|spawnSync|execSync)\b/, 'an unbounded child-process call is back in workspace.mjs')
  assert.match(src, /boundedRun\(/)
  assert.match(src, /holdPublication\(\)[\s\S]*if\(!process\.env\.FABRIC_WORKSPACE_SYNC_CHECKOUT/, 'the sync takes the publication lock before it moves its checkout')
  assert.match(src, /FABRIC_WORKSPACE_SYNC_DEADLINE_MS/, 'the sync has no watchdog')
  assert.match(src, /writeStatus\(statusFile/, 'the sync writes no status record')
  assert.match(src, /rotateLog\(log\)/, 'the sync log is never rotated')
})
