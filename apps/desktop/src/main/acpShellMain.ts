// Entry of the ACP terminal shell (see acpShell.ts). Fabric starts it in the session's PTY as
//   <runtime> acp-shell -- <agent program> <agent args…>
// with the session in FABRIC_ACP_SESSION (environment only: it carries the session credential).
// #region acp-shell-process — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#amendment-4--2026-10-06-what-the-032-verification-changed-and-what-is-not-built-yet
import { spawn, type ChildProcess } from 'node:child_process'
import { runAcpShell, type AcpSessionSpec } from './acpShell.ts'

const separator = process.argv.indexOf('--')
const command = separator >= 0 ? process.argv.slice(separator + 1) : []
const raw = process.env.FABRIC_ACP_SESSION
if (!command.length || !raw) {
  process.stderr.write('acp-shell: expected FABRIC_ACP_SESSION and `-- <agent command>`\n')
  process.exit(2)
}
const spec = JSON.parse(raw) as AcpSessionSpec
// Neither the agent nor anything it starts inherits the session document, nor the switch that made
// Electron's binary run this shell as Node (an Electron-based tool the agent starts would break).
// This removes the copy in this process's environment that children inherit; the kernel's copy of
// the environment this process was started with is not rewritten (`ps -E` by the same user shows it).
delete process.env.FABRIC_ACP_SESSION
const runsAsNode = process.env.ELECTRON_RUN_AS_NODE
delete process.env.ELECTRON_RUN_AS_NODE

/**
 * The reaper (audit 2026-10-06 ER-2(a)): a stop that SIGKILLs the PTY's group — Fabric's Force stop,
 * at about 0.8 s — ends this shell before any of its cleanup runs, and the agent sits in its own
 * group, which that signal never reaches. So the shell starts this small watcher in a session of its
 * own, holding only a pipe from the shell. When the pipe closes without the shell's "swept" — the
 * shell died, however — it ends the agent's group: SIGTERM, then SIGKILL after the grace. Inline
 * source, so the built app needs no extra entry.
 */
const REAPER = `
const pgid = Number(process.argv[process.argv.length - 1])
let swept = false
const alive = () => { try { process.kill(-pgid, 0); return true } catch (e) { /* ESRCH: none left; EPERM: one is, not ours */ return e.code === 'EPERM' } }
const signal = (s) => { try { process.kill(-pgid, s) } catch { /* the group is gone */ } }
process.stdin.on('data', (b) => { if (String(b).includes('swept')) swept = true })
const reap = () => {
  if (swept || !alive()) process.exit(0)
  signal('SIGTERM')
  const deadline = Date.now() + 3000
  const tick = setInterval(() => {
    if (!alive()) process.exit(0)
    if (Date.now() > deadline) { signal('SIGKILL'); clearInterval(tick); setTimeout(() => process.exit(0), 100) }
  }, 50)
}
process.stdin.on('end', reap)
process.stdin.on('error', reap)
process.stdin.resume()
`

let reaper: ChildProcess | null = null
const code = await runAcpShell(spec, {
  input: process.stdin,
  output: process.stdout,
  onInterrupt(listener) { process.on('SIGINT', listener) },
  // A stop or a quit signals the PTY's group, which the agent is not in: the shell ends it.
  onTerminate(listener) { process.on('SIGTERM', listener); process.on('SIGHUP', listener) },
  spawnAgent() {
    // Its own process group: Ctrl-C at the terminal reaches the shell, which cancels the turn.
    const child = spawn(command[0], command.slice(1), { cwd: spec.cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'], detached: true })
    if (child.pid) {
      reaper = spawn(process.execPath, ['-e', REAPER, String(child.pid)], {
        detached: true,
        stdio: ['pipe', 'ignore', 'ignore'],
        env: runsAsNode ? { ...process.env, ELECTRON_RUN_AS_NODE: runsAsNode } : process.env
      })
      // A reaper that could not start leaves the shell's own cleanup in force; it must not end the shell.
      reaper.on('error', () => { reaper = null })
      reaper.stdin?.on('error', () => { /* the reaper is gone: nothing left to tell it */ })
      reaper.unref()
    }
    // The agent's group by its leader's pid: it outlives the leader for as long as any member runs.
    const group = (signal: NodeJS.Signals | 0): boolean => {
      try {
        if (child.pid) process.kill(-child.pid, signal)
        else if (signal !== 0) child.kill(signal)
        return Boolean(child.pid)
      } catch (error) {
        // ESRCH: nothing of the group is left. EPERM: something is, and is not ours to signal.
        return (error as NodeJS.ErrnoException).code === 'EPERM'
      }
    }
    return {
      stdin: child.stdin, stdout: child.stdout, stderr: child.stderr,
      // The whole group: the agent's own children (tools, the stdio bridge) end with it.
      kill: (signal) => { group(signal ?? 'SIGTERM') },
      alive: () => group(0),
      onExit: (listener) => {
        child.on('exit', (c) => listener(c))
        child.on('error', (e) => {
          // Spawning failed (no such program, not executable): said here, because no exit follows.
          process.stdout.write(`\nFabric could not start the agent \`${command[0]}\`: ${e.message}\n`)
          listener(127)
        })
      }
    }
  }
})
// The shell swept the agent's group itself; the reaper is told so before the pipe closes, so it does
// not signal a group id that may by then belong to someone else.
const told = reaper as ChildProcess | null
if (told?.stdin?.writable) await new Promise<void>((resolve) => { told.stdin!.end('swept\n', () => resolve()); setTimeout(resolve, 200) })
process.exit(code)
// #endregion acp-shell-process
