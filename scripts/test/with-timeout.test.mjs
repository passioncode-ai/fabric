// scripts/with-timeout.mjs: a wall-clock limit for a command that can hang (the full tier's probes).
// Found 2026-10-03: planted P14 waited on an advisory lock with no limit, so `ci.sh full` never ended.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const tool = path.resolve(import.meta.dirname, '../with-timeout.mjs')
const run = (...args) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8' })
const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }

test('a command that finishes keeps its own exit code and output', () => {
  const r = run('5', '--', process.execPath, '-e', 'console.log("hi"); process.exit(3)')
  assert.equal(r.status, 3)
  assert.match(r.stdout, /hi/)
})

test('a command past its limit is stopped, named, and exits 124 — with every process it started', () => {
  const started = Date.now()
  // The child starts a grandchild that would outlive it, prints its pid, then hangs.
  const script = 'const c=require("child_process").spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});console.log("GRAND "+c.pid);setInterval(()=>{},1000)'
  const r = run('1', '--', process.execPath, '-e', script)
  assert.equal(r.status, 124, r.stderr)
  assert.match(r.stderr, /TIMEOUT after 1 s/)
  assert.ok(Date.now() - started < 15000, 'it does not wait for the hang')
  const grand = Number(/GRAND (\d+)/.exec(r.stdout)?.[1])
  assert.ok(grand > 0, 'the grandchild reported its pid')
  // SIGKILL is delivered, and the orphan reaped by launchd, asynchronously: at load ~100 the pid still
  // answered kill(0) a moment after the tool returned (ci.sh full, 2026-10-05). Wait up to 5 s for it to
  // go; a grandchild that really survives the limit is still caught.
  const until = Date.now() + 5000
  while (alive(grand) && Date.now() < until) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
  assert.equal(alive(grand), false, 'the grandchild did not survive the limit')
})

test('a usage error is refused, not run without a limit', () => {
  assert.equal(run('soon', '--', 'true').status, 2)
  assert.equal(run('5', 'true').status, 2)
})

// Release review 2026-10-03, iteration 2: every non-KILL signal was reported as 143 (SIGTERM), so a
// command that aborted (SIGABRT, 134) or was interrupted (SIGINT, 130) read as one that was terminated.
test('a command ended by a signal exits 128 + that signal\'s number, as a shell reports it', () => {
  for (const [signal, code] of [['SIGABRT', 134], ['SIGINT', 130], ['SIGTERM', 143], ['SIGKILL', 137]]) {
    const r = run('5', '--', process.execPath, '-e', `process.kill(process.pid, '${signal}'); setInterval(() => {}, 1000)`)
    assert.equal(r.status, code, `${signal} was reported as ${r.status}`)
  }
})
