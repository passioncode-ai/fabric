// #region login-shell-path — docs: docs/adr/0169-a-console-runs-with-the-operators-own-setup.md#decision
/**
 * The login shell's PATH, read once at start (CO-326, ADR-0169) with a deadline that actually holds (0.3.7 review
 * ER-1). `execFile`'s `timeout` only sends SIGTERM, which an interactive shell ignores, and it leaves the child's stdin
 * an open pipe, so an rc file that sleeps held the start for its full duration and one that reads stdin held it for
 * ever. Here the shell gets no stdin at all, runs in its own process group, and on the deadline the whole group is
 * killed with SIGKILL and the answer is null. The answer settles exactly once.
 */
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { shellPathProbe } from './platform.ts'

export const LOGIN_SHELL_DEADLINE_MS = 3000

export type ShellPathFailure = 'deadline' | 'spawn' | 'exit' | 'no-markers'
export interface ShellPathReading {
  path: string | null
  /** Why there is no path; null when the shell answered. */
  failure: ShellPathFailure | null
  detail?: string
}

interface Deps {
  deadlineMs?: number
  env?: NodeJS.ProcessEnv
  spawn?: (file: string, args: string[], options: SpawnOptions) => ChildProcess
  /** Kills a process group; injectable so a test can watch it. */
  killGroup?: (pid: number) => void
}

const killGroupDefault = (pid: number): void => {
  try { process.kill(-pid, 'SIGKILL') } catch { /* the group is already gone */ }
}

export function readLoginShellPath(shell: string, deps: Deps = {}): Promise<ShellPathReading> {
  const probe = shellPathProbe(shell)
  if (!probe) return Promise.resolve({ path: null, failure: null })
  const deadlineMs = deps.deadlineMs ?? LOGIN_SHELL_DEADLINE_MS
  const killGroup = deps.killGroup ?? killGroupDefault
  return new Promise((resolve) => {
    let settled = false
    let exitedWith: string | null = null
    let out = ''
    let timer: NodeJS.Timeout | undefined
    let child: ChildProcess
    const settle = (r: ShellPathReading): void => {
      if (settled) return
      settled = true
      resolve(r)
    }
    try {
      child = (deps.spawn ?? nodeSpawn)(probe.file, probe.args, {
        // No stdin: an rc that waits for input reads end-of-file at once instead of waiting for ever.
        stdio: ['ignore', 'pipe', 'ignore'],
        // Its own process group, so the deadline ends the shell and everything its rc started.
        detached: true,
        env: { ...(deps.env ?? process.env), TERM: 'dumb' },
        windowsHide: true
      })
    } catch (e) {
      settle({ path: null, failure: 'spawn', detail: (e as Error).message })
      return
    }
    const pid = child.pid
    timer = setTimeout(() => {
      timer = undefined
      // The group, not only the shell: an rc job holding the pipe would otherwise outlive the probe.
      if (pid) killGroup(pid)
      settle({ path: null, failure: 'deadline', detail: `no answer within ${deadlineMs} ms` })
    }, deadlineMs)
    const stop = (): void => { if (timer) { clearTimeout(timer); timer = undefined } }
    child.on('error', (e) => { stop(); settle({ path: null, failure: 'spawn', detail: e.message }) })
    child.stdout?.on('data', (chunk: Buffer | string) => {
      if (out.length < 1024 * 1024) out += String(chunk)
      // The markers are the answer: an rc job that keeps the pipe open does not hold it back.
      const read = probe.read(out)
      if (read !== null) settle({ path: read, failure: null })
    })
    child.on('exit', (code, signal) => { exitedWith = signal ? `signal ${signal}` : code === 0 ? null : `exit ${code}` })
    // 'close', not 'exit': the output is complete only when the pipe closes.
    child.on('close', () => {
      stop()
      const read = probe.read(out)
      if (read !== null) settle({ path: read, failure: null })
      else if (exitedWith) settle({ path: null, failure: 'exit', detail: exitedWith })
      else settle({ path: null, failure: 'no-markers', detail: 'no PATH between the markers' })
    })
  })
}
// #endregion login-shell-path
