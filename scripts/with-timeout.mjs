#!/usr/bin/env node
// #region with-timeout — docs: README.md#the-disposable-test-stack
// `node scripts/with-timeout.mjs <seconds> -- <command> [args…]`: run a command with a wall-clock limit.
//
// macOS has no `timeout(1)`, and the full tier's probes can hang: on 2026-10-03 planted P14 waited on an
// advisory lock with no limit and `ci.sh full` never ended. The command runs in its own process group;
// past the limit the whole group gets SIGTERM, then SIGKILL ten seconds later, and this exits 124 with
// the command named — so a hang becomes a failure someone reads, not a run nobody finishes. Otherwise
// the command's own exit code (or 128 + signal) is returned.
import { spawn } from 'node:child_process'
import { constants } from 'node:os'

const [limitArg, sep, cmd, ...args] = process.argv.slice(2)
const limit = Number(limitArg)
if (!Number.isFinite(limit) || limit <= 0 || sep !== '--' || !cmd) {
  console.error('usage: node scripts/with-timeout.mjs <seconds> -- <command> [args…]')
  process.exit(2)
}

const child = spawn(cmd, args, { stdio: 'inherit', detached: true })
const group = (signal) => {
  try {
    process.kill(-child.pid, signal)
  } catch {
    // The group is already gone: nothing is left to stop.
  }
}
let timedOut = false
const timer = setTimeout(() => {
  timedOut = true
  console.error(`TIMEOUT after ${limit} s: ${[cmd, ...args].join(' ')}`)
  group('SIGTERM')
  setTimeout(() => group('SIGKILL'), 10_000).unref()
}, limit * 1000)
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { group(s); process.exit(s === 'SIGINT' ? 130 : 143) })
child.on('error', (e) => {
  clearTimeout(timer)
  console.error(`could not start ${cmd}: ${e.message}`)
  process.exit(127)
})
child.on('exit', (code, signal) => {
  clearTimeout(timer)
  // The leader is gone; anything it left behind in its group goes too.
  group('SIGKILL')
  if (timedOut) process.exit(124)
  // 128 + the signal's own number, as a shell reports it: SIGABRT is 134 and SIGINT 130, not "143" for
  // every signal but KILL (release review iteration 2). An unknown name falls back to SIGTERM's number.
  process.exit(code ?? 128 + (constants.signals[signal] ?? constants.signals.SIGTERM))
})
// #endregion with-timeout
