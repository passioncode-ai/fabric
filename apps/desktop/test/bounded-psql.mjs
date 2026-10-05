// #region bounded-psql — docs: docs/evidence/specs/2026-08-16-software-fabric-carryover.md#carry-over-ledger--software-fabric
// One way for a DB test to run psql CONCURRENTLY, with a deadline.
//
// 2026-10-05: `ci.sh full` hung for ten minutes in ceo-conversation-db.test.mjs. Its concurrent-SQL helper
// had spawned psql and called `stdin.end(input)`. The backend sat idle in ClientRead and psql waited on a
// stdin that never reached EOF; no helper had a deadline, so the whole tier waited forever. It did not
// reproduce in five isolated runs (9–11 s each) and the host was at load ~100 with 14.7 GB of swap in use,
// so the cause is open (CO-211). What is closed is that a stuck psql can wedge CI: every async psql in the
// DB suites now goes through this function, which ends it at a deadline and fails with a sentence naming
// what was stuck.
import { spawn } from 'node:child_process'

export const PSQL_DEADLINE_MS = 120_000

/**
 * Run psql with `input` on stdin. Resolves `{ code, stdout, stderr }` once psql exits — a non-zero code is
 * the caller's to judge. Rejects only on a spawn error or on the deadline, after SIGKILL.
 */
export function runPsqlAsync(command, args, input, { env, label = 'concurrent SQL', timeoutMs = PSQL_DEADLINE_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = '', settled = false, stdinClosed = false
    const finish = (fn, value) => { if (settled) return; settled = true; clearTimeout(timer); fn(value) }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish(reject, new Error(`${label}: psql did not finish within ${Math.round(timeoutMs / 1000)} s and was killed (stdin ${stdinClosed ? 'closed' : 'still open'}; stderr: ${stderr.trim().slice(0, 300) || 'empty'})`))
    }, timeoutMs)
    child.stdout.on('data', b => { stdout += b })
    child.stderr.on('data', b => { stderr += b })
    child.stdin.on('error', () => { /* psql may exit before reading everything; its exit code says why */ })
    child.stdin.on('finish', () => { stdinClosed = true })
    child.on('error', e => finish(reject, e))
    child.on('close', code => finish(resolve, { code, stdout, stderr }))
    child.stdin.end(input)
  })
}
// #endregion bounded-psql
