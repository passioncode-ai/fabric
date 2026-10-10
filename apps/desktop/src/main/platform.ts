// #region platform-invocations — docs: docs/evidence/plans/2026-10-10-windows-linux-port.md#req-table
/**
 * What Fabric runs, per OS, where a POSIX tool used to be assumed (0.3.5, CO-238). Pure: each answer is a program
 * and its arguments for `execFile`/`spawn` without a shell, so nothing here concatenates input into a command line
 * except the quit guard's fixed, validated numbers.
 */

type Env = Record<string, string | undefined>
export interface Invocation { file: string; args: string[] }

/** REQ-08: the shell a terminal session starts. Windows starts PowerShell, present on every supported Windows; a
 *  POSIX `SHELL` left in the environment by a developer tool would name a program Windows cannot start. */
export function defaultShell(platform: NodeJS.Platform, env: Env): string {
  if (platform === 'win32') return 'powershell.exe'
  return env.SHELL || (platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
}

/** REQ-09: how to ask whether an executable is on PATH, without a shell. */
export function whichInvocation(platform: NodeJS.Platform, bin: string): Invocation {
  return platform === 'win32' ? { file: 'where.exe', args: [bin] } : { file: '/usr/bin/env', args: ['which', bin] }
}

function pidOf(pid: number): string {
  // 4 is Windows' System process, 1 is init/launchd: never a Fabric-owned root.
  if (!Number.isSafeInteger(pid) || pid <= 4) throw new Error(`not a pid Fabric may stop: ${pid}`)
  return String(pid)
}

/** REQ-10: the outside guard that ends this process if quitting outlives its deadline. Detached and shell-less on
 *  Windows (`cmd /c` with numbers only): `ping -n N+1` waits about N seconds where `timeout` needs a console. */
export function quitReaperInvocation(platform: NodeJS.Platform, pid: number, seconds: number): Invocation {
  const p = pidOf(pid)
  const s = Math.max(1, Math.ceil(seconds))
  if (platform === 'win32') return { file: 'cmd.exe', args: ['/d', '/c', `ping -n ${s + 1} 127.0.0.1 >nul & taskkill /F /PID ${p} >nul 2>&1`] }
  return { file: '/bin/sh', args: ['-c', `sleep ${s}; kill -9 ${p} 2>/dev/null`] }
}

/** REQ-11: stopping a Windows session's whole tree from its root (PL-07: Windows has no process groups). The caller
 *  sends it only while the root's exit has not been observed, so the pid is still the session's own. */
export function processTreeStopInvocation(pid: number, signal: 'SIGTERM' | 'SIGKILL'): Invocation {
  return { file: 'taskkill.exe', args: ['/PID', pidOf(pid), '/T', ...(signal === 'SIGKILL' ? ['/F'] : [])] }
}
/** REQ-05: folders installers put `supabase`, `docker` and the coding agents in, appended to the PATH an app
 *  launched from the Dock, the Start menu or a desktop file inherits. Joined with the OS's own separator by the caller. */
export function pathAdditions(platform: NodeJS.Platform, env: Env, home: string): string[] {
  if (platform === 'win32') {
    const w = (...parts: string[]) => parts.join('\\')
    const local = env.LOCALAPPDATA || w(home, 'AppData', 'Local')
    const roaming = env.APPDATA || w(home, 'AppData', 'Roaming')
    return [w(home, '.local', 'bin'), w(roaming, 'npm'), w(home, 'scoop', 'shims'), w(local, 'Microsoft', 'WinGet', 'Links'),
      w(env.ProgramFiles || 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin')]
  }
  if (platform === 'linux') return ['/usr/local/bin', `${home}/.local/bin`, '/snap/bin', '/home/linuxbrew/.linuxbrew/bin']
  return ['/opt/homebrew/bin', '/usr/local/bin', `${home}/.local/bin`]
}
/** REQ-13: the ACL DEC-0033 asks of a token file Fabric writes on Windows — inheritance off, full control to the
 *  user, SYSTEM (S-1-5-18) and Administrators (S-1-5-32-544), nobody else. Applied to the temporary file before it is
 *  renamed into place, so the published file never has a wider ACL for a moment. */
export function protectedAclInvocation(file: string, user: string): Invocation {
  if (!user || /[:,()\s*]/.test(user)) throw new Error(`not a user name icacls can grant: ${JSON.stringify(user)}`)
  return { file: 'icacls.exe', args: [file, '/inheritance:r', '/grant:r', `${user}:(F)`, '*S-1-5-18:(F)', '*S-1-5-32-544:(F)'] }
}
// #endregion platform-invocations
