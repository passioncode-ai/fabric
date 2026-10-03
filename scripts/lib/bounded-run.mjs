// #region bounded-run — docs: docs/adr/0106-fabric-adopts-the-product-lifecycle-contract.md#3-a-scheduled-job-is-bounded-exclusive-and-observable
// The pieces a scheduled job needs so that it can never wedge (lifecycle LC-02, LC-03, LC-12).
//
// MEASURED 2026-10-03: the workspace sync's publish child failed a gate, then Node deadlocked while
// exiting; the parent waited forever in `execFileSync` (no timeout), and launchd skipped every later
// interval because the job still counted as running — 5 h 27 min of silence. A manual publish and the
// scheduled one also raced each other on the same remotes, and the log grew 20 MB in 2.4 days.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const live = new Set()
// Inside a bounded run, commands stay in the run's process group instead of opening their own: a
// nested group escaped the outer kill, and a timed-out publish left its `ci.sh` and git steps running
// under ppid 1 (lifecycle review 2026-10-03, finding 5). The outer run's group kill now reaches them all.
const NESTED = process.env.FABRIC_BOUNDED_RUN === '1'

/** Every descendant of `pid`, from one process-table snapshot (deepest first). */
export function descendants(pid, table = processTable()) {
  const kids = new Map()
  for (const [p, pp] of table) { if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p) }
  const out = []
  const walk = (q) => { for (const c of kids.get(q) ?? []) { walk(c); out.push(c) } }
  walk(pid)
  return out
}
function processTable() {
  try {
    return execFileSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8', timeout: 5000 })
      .split('\n').map((l) => l.trim().split(/\s+/).map(Number)).filter(([a, b]) => a > 0 && b >= 0)
  } catch { return [] }
}
/** End a process and everything under it, whatever group each part is in. */
export function killTree(pid, signal = 'SIGKILL') {
  for (const d of descendants(pid)) { try { process.kill(d, signal) } catch { /* already gone */ } }
  try { process.kill(-pid, signal) } catch { /* not a group leader */ }
  try { process.kill(pid, signal) } catch { /* already gone */ }
}

/** Kill everything this module started (a watchdog firing, the job being stopped). */
export function killAll(signal = 'SIGKILL') {
  for (const pid of live) killTree(pid, signal)
}

/**
 * Exit, and make sure the process really ends. Node 26.8.2 was measured deadlocking INSIDE its own exit
 * after an uncaught error (main thread and a V8 worker each waiting on the other, 2026-10-03) — so a
 * watchdog that ended with `process.exit` could hang exactly where the job it guards had hung (review
 * finding 4). A detached reaper ends this pid a few seconds later if the exit has not completed; the
 * outcome was already written by the caller, so nothing is lost when it fires.
 */
export function exitWithin(code, { graceSeconds = 5 } = {}) {
  try {
    spawn('/bin/sh', ['-c', `sleep ${graceSeconds}; kill -9 ${process.pid} 2>/dev/null`], { detached: true, stdio: 'ignore' }).unref()
  } catch { /* no reaper: the plain exit below is still the first resort */ }
  process.exit(code)
}

/**
 * Run a command to completion with a deadline. It runs in its own process group, so a timeout ends
 * everything it started — `ci.sh` and its test processes included — not only the direct child.
 * Rejects like `execFileSync` would: on a non-zero exit, on a signal, and on the deadline (code ETIMEDOUT).
 */
export function boundedRun(bin, args, { cwd, timeoutMs, env, stdio = 'inherit' } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw Error(`boundedRun needs a positive timeoutMs for ${bin}`)
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env: { ...(env ?? process.env), FABRIC_BOUNDED_RUN: '1' }, stdio: ['ignore', stdio, stdio], detached: !NESTED })
    live.add(child.pid)
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child.pid)
    }, timeoutMs)
    child.once('error', (e) => { clearTimeout(timer); live.delete(child.pid); reject(e) })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      live.delete(child.pid)
      // Whatever the command left in its own group goes with it: no orphan survives a finished step. A
      // nested command shares the outer run's group, which the outer run ends.
      if (!NESTED) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* the group is empty */ } }
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

/** When a process started, as the kernel reports it — a recycled pid has a different start. */
function startOf(pid) {
  try { return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', timeout: 5000 }).trim() || null } catch { return null }
}
function holderAlive(held) {
  if (!held || !Number.isInteger(held.pid) || held.pid <= 0) return false
  try { process.kill(held.pid, 0) } catch (e) { if (e.code !== 'EPERM') return false }
  // A pid alone is not an identity: a recycled pid kept a dead lock looking held (review finding 6).
  return !held.started || startOf(held.pid) === held.started
}
function readHolder(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}
/** Create `file` with its content in one step: link a fully written temp file, which fails if it exists. */
function createWithContent(file, record) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(record), { mode: 0o600 })
  try { linkSync(tmp, file); return true } catch (e) { if (e.code === 'EEXIST') return false; throw e } finally { rmSync(tmp, { force: true }) }
}

/**
 * One holder at a time, across every checkout on this machine.
 *
 * The lock file appears with its holder already written (a link of a complete temp file), so a reader
 * never sees it empty: the old open-then-write let a second process read an empty file, call it stale and
 * take it — both held the lock in 20 of 20 simultaneous starts (review finding 6). A dead holder is
 * replaced only through a second exclusive file, `<lock>.takeover`, so two processes cannot both replace
 * it; the holder is identified by pid AND process start time. A child of the holder passes the token
 * (env) and is admitted as the holder itself. Returns `{ release }` or `null` when someone else holds it.
 */
export function acquireLock(file, { token, now = () => new Date().toISOString(), pid = process.pid } = {}) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const record = { pid, token, started: startOf(pid), at: now() }
  const release = () => { const held = readHolder(file); if (held && held.token === token) rmSync(file, { force: true }) }
  if (createWithContent(file, record)) return { release }
  const held = readHolder(file)
  if (held && token && held.token === token) return { release: () => {} }
  if (held && holderAlive(held)) return null
  // The holder is gone (or the file is unreadable). Take it over exclusively.
  const takeover = `${file}.takeover`
  if (!createWithContent(takeover, record)) {
    if (holderAlive(readHolder(takeover))) return null
    rmSync(takeover, { force: true })
    if (!createWithContent(takeover, record)) return null
  }
  try {
    const again = readHolder(file)
    // Someone else completed a takeover between our read and our claim: theirs stands.
    if (again && holderAlive(again)) return null
    renameSync(takeover, file)
    return { release }
  } finally {
    const left = readHolder(takeover)
    if (left && left.token === token) rmSync(takeover, { force: true })
  }
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
