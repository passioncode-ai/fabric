// 0.3.7 review ER-1: the login shell's PATH is read at start, before the splash, so its deadline has to hold. Real
// processes, never the operator's own rc: SHELL is a small script per case. A shell that ignores SIGTERM and sleeps,
// and one that waits on stdin, must both let the start go on within the deadline; the shell and what its rc started
// are gone afterwards.
import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir, loadavg, cpus } from 'node:os'

const { readLoginShellPath, LOGIN_SHELL_DEADLINE_MS } = await import(path.resolve(import.meta.dirname, '../src/main/loginShellPath.ts'))

const dir = mkdtempSync(path.join(tmpdir(), 'fabric-login-shell-'))
function shell(name, body) {
  const file = path.join(dir, name)
  writeFileSync(file, `#!/bin/sh\n${body}\n`)
  chmodSync(file, 0o755)
  return file
}
// CO-379: on a machine whose load is above its core count a real shell takes seconds to start, so a test of what the
// shell answers gets a generous deadline of its own, and a test of the deadline allows the load's slack after it.
const BUSY = loadavg()[0] > cpus().length
const SLACK_MS = BUSY ? 3000 : 500
const ANSWER_DEADLINE_MS = 15_000
const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
const waitGone = async (pid, ms = 1000) => { const end = Date.now() + ms; while (alive(pid) && Date.now() < end) await new Promise((r) => setTimeout(r, 20)); return !alive(pid) }

test('the deadline is three seconds', () => assert.equal(LOGIN_SHELL_DEADLINE_MS, 3000))

test('a shell that answers gives its PATH; rc noise around the markers is ignored', async () => {
  const sh = shell('answers.sh', 'echo "rc noise"\nexec /bin/sh -c "$2"')
  const r = await readLoginShellPath(sh, { env: { PATH: '/opt/x/bin:/usr/bin:/bin' }, deadlineMs: ANSWER_DEADLINE_MS })
  assert.deepEqual(r, { path: '/opt/x/bin:/usr/bin:/bin', failure: null })
})

test('a shell whose rc ignores SIGTERM and sleeps 20 s is killed with its group; the answer is null within the deadline', { timeout: 15_000 }, async () => {
  const pidFile = path.join(dir, 'sleeper.pid')
  const sh = shell('sleeps.sh', `trap "" TERM\nsleep 20 &\necho $! > ${pidFile}\nwait`)
  const t0 = Date.now()
  const r = await readLoginShellPath(sh)
  const took = Date.now() - t0
  assert.equal(r.path, null)
  assert.equal(r.failure, 'deadline')
  assert.ok(took < LOGIN_SHELL_DEADLINE_MS + SLACK_MS, `the start waited ${took} ms`)
  assert.ok(existsSync(pidFile), 'the rc ran')
  assert.ok(await waitGone(Number(readFileSync(pidFile, 'utf8'))), 'what the rc started outlived the probe')
})

test('a shell whose rc reads stdin does not wait on it: stdin is closed, the probe goes on within the deadline', { timeout: 15_000 }, async () => {
  // `read` that got input would loop; end-of-file ends it at once and the shell answers.
  const sh = shell('reads.sh', 'while read -r line; do :; done\nexec /bin/sh -c "$2"')
  const t0 = Date.now()
  const r = await readLoginShellPath(sh, { env: { PATH: '/usr/bin:/bin' }, deadlineMs: ANSWER_DEADLINE_MS })
  const took = Date.now() - t0
  // Closed stdin ends the read at once: far below the generous deadline, whatever the load.
  assert.ok(took < ANSWER_DEADLINE_MS / 2, `the start waited ${took} ms on stdin`)
  assert.deepEqual(r, { path: '/usr/bin:/bin', failure: null })
})

test('a shell that reads stdin and then hangs still ends at the deadline', { timeout: 15_000 }, async () => {
  const sh = shell('reads-then-hangs.sh', 'trap "" TERM\nread -r x\nsleep 20')
  const t0 = Date.now()
  const r = await readLoginShellPath(sh)
  assert.ok(Date.now() - t0 < LOGIN_SHELL_DEADLINE_MS + SLACK_MS)
  assert.deepEqual([r.path, r.failure], [null, 'deadline'])
})

test('a shell that fails or prints no markers is null with its reason; a missing shell is a spawn failure', async () => {
  assert.deepEqual(await readLoginShellPath(shell('fails.sh', 'exit 3'), { deadlineMs: ANSWER_DEADLINE_MS }), { path: null, failure: 'exit', detail: 'exit 3' })
  assert.deepEqual(await readLoginShellPath(shell('quiet.sh', 'exit 0'), { deadlineMs: ANSWER_DEADLINE_MS }), { path: null, failure: 'no-markers', detail: 'no PATH between the markers' })
  const missing = await readLoginShellPath(path.join(dir, 'no-such-shell'))
  assert.equal(missing.path, null)
  assert.equal(missing.failure, 'spawn')
  assert.deepEqual(await readLoginShellPath(''), { path: null, failure: null }, 'no shell, no probe')
})

test('the answer settles once even when the deadline and the exit race', async () => {
  const sh = shell('late.sh', 'sleep 0.2\nexec /bin/sh -c "$2"')
  const r = await readLoginShellPath(sh, { deadlineMs: 200, env: { PATH: '/bin' } })
  assert.ok(r.failure === 'deadline' || r.path === '/bin')
})
