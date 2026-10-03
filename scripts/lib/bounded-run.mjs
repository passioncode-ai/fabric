// #region bounded-run — docs: docs/adr/0106-fabric-adopts-the-product-lifecycle-contract.md#3-a-scheduled-job-is-bounded-exclusive-and-observable
// The pieces a scheduled job needs so that it can never wedge (lifecycle LC-02, LC-03, LC-12).
//
// MEASURED 2026-10-03: the workspace sync's publish child failed a gate, then Node deadlocked while
// exiting; the parent waited forever in `execFileSync` (no timeout), and launchd skipped every later
// interval because the job still counted as running — 5 h 27 min of silence. A manual publish and the
// scheduled one also raced each other on the same remotes, and the log grew 20 MB in 2.4 days.
import { spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs'
import path from 'node:path'

const live = new Set()

/** Kill every process group this module started (a watchdog firing, the job being stopped). */
export function killAll(signal = 'SIGKILL') {
  for (const pid of live) {
    try { process.kill(-pid, signal) } catch { /* the group is already gone */ }
  }
}

/**
 * Run a command to completion with a deadline. It runs in its own process group, so a timeout ends
 * everything it started — `ci.sh` and its test processes included — not only the direct child.
 * Rejects like `execFileSync` would: on a non-zero exit, on a signal, and on the deadline (code ETIMEDOUT).
 */
export function boundedRun(bin, args, { cwd, timeoutMs, env, stdio = 'inherit' } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw Error(`boundedRun needs a positive timeoutMs for ${bin}`)
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env, stdio: ['ignore', stdio, stdio], detached: true })
    live.add(child.pid)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      try { process.kill(-child.pid, 'SIGKILL') } catch { /* gone */ }
    }, timeoutMs)
    child.once('error', (e) => { clearTimeout(timer); live.delete(child.pid); reject(e) })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      live.delete(child.pid)
      // Whatever the command left in its group goes with it: no orphan survives a finished step.
      try { process.kill(-child.pid, 'SIGKILL') } catch { /* the group is empty */ }
      const what = `${bin} ${args.join(' ')}`
      if (timedOut) return reject(Object.assign(Error(`TIMEOUT after ${Math.round(timeoutMs / 1000)} s: ${what}`), { code: 'ETIMEDOUT' }))
      if (code !== 0) return reject(Object.assign(Error(`Command failed (${signal ?? 'exit ' + code}): ${what}`), { status: code, signal }))
      resolve()
    })
  })
}

/** Git that can never wait on a person: no terminal prompt, no interactive ssh, a connect deadline. */
export function nonInteractiveGitEnv(base = process.env) {
  return {
    ...base,
    GIT_TERMINAL_PROMPT: '0',
    GIT_SSH_COMMAND: base.GIT_SSH_COMMAND ?? 'ssh -o BatchMode=yes -o ConnectTimeout=15',
    GCM_INTERACTIVE: 'never'
  }
}

const alive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' }
}

/**
 * One holder at a time, across every checkout on this machine. The lock file names its holder's pid and
 * a token; a holder that died is detected by its pid and replaced, so a crash never wedges the lock.
 * A child of the holder passes the token (env) and is admitted as the holder itself.
 * Returns `{ release }` or `null` when someone else holds it.
 */
export function acquireLock(file, { token, now = () => new Date().toISOString(), pid = process.pid } = {}) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, 'wx', 0o600)
      writeSync(fd, JSON.stringify({ pid, token, at: now() }))
      closeSync(fd)
      return { release: () => { try { const held = JSON.parse(readFileSync(file, 'utf8')); if (held.token === token) rmSync(file, { force: true }) } catch { /* already gone */ } } }
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      let held = null
      try { held = JSON.parse(readFileSync(file, 'utf8')) } catch { /* torn or empty: treat as stale */ }
      if (held && token && held.token === token) return { release: () => {} }
      if (held && alive(held.pid)) return null
      rmSync(file, { force: true })
    }
  }
  return null
}

/** Write a small JSON record atomically (temp + rename), owner-only. */
export function writeStatus(file, record) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 })
  renameSync(tmp, file)
}

/** Rotate by size: file → file.1 → … → file.<keep>, the oldest dropped. A missing file is fine. */
export function rotateLog(file, { maxBytes = 5 * 1024 * 1024, keep = 5 } = {}) {
  if (!existsSync(file) || statSync(file).size <= maxBytes) return false
  rmSync(`${file}.${keep}`, { force: true })
  for (let i = keep - 1; i >= 1; i--) if (existsSync(`${file}.${i}`)) renameSync(`${file}.${i}`, `${file}.${i + 1}`)
  renameSync(file, `${file}.1`)
  return true
}
// #endregion bounded-run
