// #region bounded-run — docs: docs/adr/0106-fabric-adopts-the-product-lifecycle-contract.md#3-a-scheduled-job-is-bounded-exclusive-and-observable
// The pieces a scheduled job needs so that it can never wedge (lifecycle LC-02, LC-03, LC-12).
//
// MEASURED 2026-10-03: the workspace sync's publish child failed a gate, then Node deadlocked while
// exiting; the parent waited forever in `execFileSync` (no timeout), and launchd skipped every later
// interval because the job still counted as running — 5 h 27 min of silence. A manual publish and the
// scheduled one also raced each other on the same remotes, and the log grew 20 MB in 2.4 days.
import { execFileSync, spawn } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, truncateSync, writeFileSync } from 'node:fs'
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

/**
 * When a process started, as the kernel reports it — a recycled pid has a different start. Read with a
 * fixed locale and zone: `ps lstart` is text, and the same instant read under another LC_ALL or TZ looked
 * like a different process, so a live holder could be taken over (confirmation review, L2).
 */
function startOf(pid) {
  try {
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', timeout: 5000, env: { ...process.env, LC_ALL: 'C', LANG: 'C', TZ: 'UTC' } }).trim() || null
  } catch { return null }
}
function holderAlive(held) {
  if (!held || !Number.isInteger(held.pid) || held.pid <= 0) return false
  try { process.kill(held.pid, 0) } catch (e) { if (e.code !== 'EPERM') return false }
  // A pid alone is not an identity: a recycled pid kept a dead lock looking held (review finding 6).
  if (!held.started) return true
  const now = startOf(held.pid)
  // `ps` failing to answer says nothing about the holder: a live pid is kept alive (third review).
  return now === null || now === held.started
}
/** The holder record; `{ missing: true }` when the file is gone, `null` when it is there but unreadable. */
function readHolder(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch (e) { return e?.code === 'ENOENT' ? { missing: true } : null }
}
/** Remove our own stray temp files and dead claims older than `ageMs` (killed processes leave them behind). */
function sweepLockDebris(file, ageMs = 10 * 60_000) {
  const dir = path.dirname(file), base = path.basename(file)
  let names = []
  try { names = readdirSync(dir) } catch { return }
  for (const n of names) {
    if (!n.startsWith(base + '.') || n === base) continue
    const full = path.join(dir, n)
    let age = 0
    try { age = Date.now() - statSync(full).mtimeMs } catch { continue }
    if (age < ageMs) continue
    if (n.endsWith('.tmp') || (n.includes('.takeover.') && !holderAlive(readHolder(full)))) rmSync(full, { force: true })
  }
}
/** Create `file` with its content in one step: link a fully written temp file, which fails if it exists. */
function createWithContent(file, record) {
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  writeFileSync(tmp, JSON.stringify(record), { mode: 0o600 })
  try { linkSync(tmp, file); return true } catch (e) { if (e.code === 'EEXIST') return false; throw e } finally { rmSync(tmp, { force: true }) }
}
const GENERATIONS = 16

/**
 * One holder at a time, across every checkout on this machine.
 *
 * - The lock file appears with its holder already written (a link of a complete temp file), so a reader
 *   never sees it empty: open-then-write let a second process read an empty file, call it stale and take
 *   it — both held the lock in 20 of 20 simultaneous starts (review finding 6).
 * - A dead holder is replaced through a TAKEOVER claim named after that holder's token, in generations:
 *   `<lock>.takeover.<token>.<n>`. Exactly one contender creates generation n; a contender that finds n
 *   taken by a live claimer stops, one that finds a dead claimer moves to n+1. No contender ever deletes
 *   another's claim — deleting a claim someone had just made let two contenders both proceed when a
 *   previous taker had died mid-takeover (confirmation review, L1).
 * - The winner re-reads the lock: if it still names the dead holder, it replaces it with one atomic
 *   rename; if it does not, someone completed a takeover first and theirs stands.
 * - Holder identity is pid + start time (read locale-free). A child of the holder passes the token (env)
 *   and is admitted as the holder itself. Returns `{ release }` or `null`.
 */
export function acquireLock(file, { token, now = () => new Date().toISOString(), pid = process.pid } = {}) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const record = { pid, token, started: startOf(pid), at: now() }
  const release = () => {
    const held = readHolder(file)
    if (held && held.token === token) rmSync(file, { force: true })
  }
  sweepLockDebris(file)
  let held
  for (let attempt = 0; ; attempt++) {
    if (createWithContent(file, record)) return { release }
    held = readHolder(file)
    // Gone between our create and our read — its holder released it. That is not a dead holder to take
    // over: create again. Taking the vanished file for a dead holder let a run overwrite a fresh holder
    // that created the lock in that instant (third lifecycle review).
    if (held?.missing) { if (attempt < 5) continue; return null }
    break
  }
  if (held && token && held.token === token) return { release: () => {} }
  if (held && holderAlive(held)) return null
  const staleToken = String(held?.token ?? 'unreadable').replace(/[^\w.-]/g, '_').slice(0, 80)
  for (let n = 0; n < GENERATIONS; n++) {
    const claim = `${file}.takeover.${staleToken}.${n}`
    if (!createWithContent(claim, record)) {
      if (holderAlive(readHolder(claim))) return null
      continue
    }
    const again = readHolder(file)
    const sameStale = !again?.missing && (again?.token ?? 'unreadable') === (held?.token ?? 'unreadable') && !holderAlive(again)
    if (!sameStale) { rmSync(claim, { force: true }); return null }
    const tmp = `${file}.${process.pid}.${Date.now()}.win.tmp`
    writeFileSync(tmp, JSON.stringify(record), { mode: 0o600 })
    renameSync(tmp, file)
    // The lock now names us; claims for the old holder are spent and can go.
    for (let k = 0; k < GENERATIONS; k++) rmSync(`${file}.takeover.${staleToken}.${k}`, { force: true })
    return { release }
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

/**
 * Rotate by size: file → file.1 → … → file.<keep>, the oldest dropped. A missing file is fine.
 * `copyTruncate` is for a file another process holds open for appending (launchd's StandardOutPath): the
 * content is copied to `.1` and the file truncated in place, so the writer keeps writing into the live file
 * and every generation stays bounded — renaming it moved the writer, unbounded, into `.1` (review m7).
 * Every generation is owner-only.
 */
export function rotateLog(file, { maxBytes = 5 * 1024 * 1024, keep = 5, copyTruncate = false } = {}) {
  if (!existsSync(file)) return false
  try { chmodSync(file, 0o600) } catch { /* not ours to change */ }
  if (statSync(file).size <= maxBytes) return false
  rmSync(`${file}.${keep}`, { force: true })
  for (let i = keep - 1; i >= 1; i--) if (existsSync(`${file}.${i}`)) renameSync(`${file}.${i}`, `${file}.${i + 1}`)
  if (copyTruncate) { copyFileSync(file, `${file}.1`); truncateSync(file, 0) } else renameSync(file, `${file}.1`)
  try { chmodSync(`${file}.1`, 0o600) } catch { /* gone */ }
  return true
}

/**
 * Supervise one run of a scheduled job (lifecycle LC-03): a status record from start to end, a watchdog
 * below the job's interval, signals and errors each ending as a named outcome, and an exit that really
 * ends the process. `body` returns `{ outcome, reason }`; an error with code ELOCKED is "locked" (exit 0:
 * another run is doing the work), any other error "failed" (exit 1), the watchdog "timeout" (exit 124), a
 * signal "stopped" (exit 143). `guard` runs before the first status write, so a run that refuses to start
 * (a wrong checkout) never overwrites the record of the job that owns it (review m6).
 */
export async function superviseJob({ name, statusFile, watchdogMs, log, guard = () => {} }, body) {
  const startedAt = new Date().toISOString()
  const say = (m) => console.log(`== ${name} ${m} · ${new Date().toISOString()}`)
  try { guard() } catch (e) { console.error(String(e?.message || e)); exitWithin(1); return }
  if (log) rotateLog(log, { copyTruncate: true })
  const status = (outcome, reason) => writeStatus(statusFile, { schema: 'JobRun@1', job: name, pid: process.pid, started_at: startedAt, ended_at: outcome === 'running' ? null : new Date().toISOString(), outcome, reason: reason ?? null })
  let ended = false
  const finish = (outcome, reason, code) => {
    if (ended) return
    ended = true
    try { status(outcome, reason) } catch (e) { console.error('status not written: ' + (e?.message || e)) }
    say(outcome + (reason ? ': ' + reason : ''))
    exitWithin(code)
  }
  const fail = (e) => { killAll(); const locked = e?.code === 'ELOCKED'; finish(locked ? 'locked' : 'failed', String(e?.message || e).split('\n')[0], locked ? 0 : 1) }
  setTimeout(() => { killAll(); finish('timeout', `the run passed its ${Math.round(watchdogMs / 60000)} min watchdog; every step it started was ended`, 124) }, watchdogMs).unref()
  for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => { killAll(); finish('stopped', 'received ' + sig, 143) })
  process.on('uncaughtException', fail)
  process.on('unhandledRejection', fail)
  say('start · pid ' + process.pid)
  status('running')
  try {
    const { outcome, reason } = await body()
    finish(outcome, reason, 0)
  } catch (e) { fail(e) }
}
// #endregion bounded-run
