// #region platform-invocations — docs: docs/evidence/plans/2026-10-10-windows-linux-port.md#req-table
/**
 * What Fabric runs, per OS, where a POSIX tool used to be assumed (0.3.5, CO-238). Pure: each answer is a program
 * and its arguments for `execFile`/`spawn` without a shell, so nothing here concatenates input into a command line
 * except the quit guard's fixed, validated numbers.
 */

type Env = Record<string, string | undefined>
/** `verbatim`: the arguments are a command line already quoted for cmd.exe, passed as written (`execFile`'s
 *  `windowsVerbatimArguments`, node-pty's string form); Node's own quoting escapes an inner quote as `\"`, which cmd
 *  does not read. */
export interface Invocation { file: string; args: string[]; verbatim?: true }

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

/** The file name of an executable path, either OS's separators: what Windows' task list calls its image. */
function imageName(executable: string): string {
  const name = executable.split(/[\\/]/).pop() ?? ''
  // Inside taskkill's quoted filter on a cmd line: nothing that ends the quoting or that cmd expands.
  if (!/^[A-Za-z0-9 ._()-]+\.exe$/i.test(name)) throw new Error(`not an image name the quit guard can filter by: ${JSON.stringify(name)}`)
  return name
}

/** REQ-10: the outside guard that ends this process if quitting outlives its deadline. Detached and shell-less on
 *  Windows (`cmd /c` with numbers and a validated image name only): `ping -n N+1` waits about N seconds where
 *  `timeout` needs a console.
 *
 *  It never ends a process that is not this Fabric (0.3.5 review ER-3): by the time it fires the pid may have been
 *  freed and reused, quickly so on Windows. On POSIX the pid's identity — its start time and command, read by `ps`
 *  while the guard is being armed by the process itself — is read again before `kill -9`, and a pid that names
 *  anything else is left alone. On Windows taskkill is filtered by this executable's image name. */
export function quitReaperInvocation(platform: NodeJS.Platform, pid: number, seconds: number, executable: string): Invocation {
  const p = pidOf(pid)
  const s = Math.max(1, Math.ceil(seconds))
  if (platform === 'win32')
    return { file: 'cmd.exe', args: ['/d', '/s', '/c', `"ping -n ${s + 1} 127.0.0.1 >nul & taskkill /F /FI "IMAGENAME eq ${imageName(executable)}" /PID ${p} >nul 2>&1"`], verbatim: true }
  const identity = `ps -o lstart= -o command= -p ${p} 2>/dev/null`
  return { file: '/bin/sh', args: ['-c', `id=$(${identity}); [ -n "$id" ] || exit 0; sleep ${s}; [ "$(${identity})" = "$id" ] && kill -9 ${p} 2>/dev/null`] }
}

/** REQ-11: stopping a Windows session's whole tree from its root (PL-07: Windows has no process groups). The caller
 *  sends it only while the root's exit has not been observed, so the pid is still the session's own. */
export function processTreeStopInvocation(pid: number, signal: 'SIGTERM' | 'SIGKILL'): Invocation {
  return { file: 'taskkill.exe', args: ['/PID', pidOf(pid), '/T', ...(signal === 'SIGKILL' ? ['/F'] : [])] }
}

/** How a Windows session's tree was stopped, said to the log: `stopped` by a graceful taskkill, `forced` by `/F`,
 *  `pty-closed` by closing the pseudo-console (which ends its console tree), `not-stopped` when none of them could. */
export type WindowsStopOutcome = 'stopped' | 'forced' | 'pty-closed' | 'not-stopped'

/** REQ-11 on Windows (0.3.5 review ER-4). A console process under ConPTY usually refuses a taskkill without `/F`, and
 *  node-pty throws "Signals not supported on windows" whenever `kill` is given a signal, so a Stop never falls back to
 *  `pty.kill(signal)` there: a refused graceful stop is followed by a forced one, then by closing the pseudo-console.
 *  `still` is asked before every step: once the root's exit is observed the pid is no longer the session's.
 *  Asynchronous (0.3.5 review iteration 2, ER-6): `run` answers a promise, bounded by its caller, so a Stop — several
 *  at a quit — never holds the main thread, the in-process quit deadline or a window for a taskkill's seconds. */
export async function stopWindowsTree(
  pid: number,
  signal: 'SIGTERM' | 'SIGKILL',
  run: (how: Invocation) => Promise<void>,
  closePty: () => void,
  still: () => boolean = () => true
): Promise<{ outcome: WindowsStopOutcome; failures: string[] }> {
  const failures: string[] = []
  const said = (e: unknown): string => (e instanceof Error ? e.message : String(e))
  const steps: Array<[WindowsStopOutcome, () => Promise<void> | void]> = [
    ...(signal === 'SIGTERM' ? [['stopped', () => run(processTreeStopInvocation(pid, 'SIGTERM'))] as [WindowsStopOutcome, () => Promise<void>]] : []),
    ['forced', () => run(processTreeStopInvocation(pid, 'SIGKILL'))],
    ['pty-closed', closePty]
  ]
  for (const [outcome, step] of steps) {
    if (!still()) break
    try {
      await step()
      return { outcome, failures }
    } catch (e) {
      // Kept, not dropped: each failed step is returned in `failures` and the caller logs the outcome.
      failures.push(`${outcome}: ${said(e)}`)
    }
  }
  return { outcome: 'not-stopped', failures }
}

/** A PTY's own kill: with the signal on POSIX, with none on Windows, where node-pty refuses every signal and closing
 *  the pseudo-console is the only stop it has (0.3.5 review ER-4). */
export function killPty(pty: { kill(signal?: string): void }, platform: NodeJS.Platform, signal: 'SIGTERM' | 'SIGKILL'): void {
  if (platform === 'win32') pty.kill()
  else pty.kill(signal)
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
  // A name with a space is an ordinary Windows account and travels as one argument (0.3.5 review ER-6); refused are
  // only the characters icacls would read as another grant or permission, and control characters.
  // eslint-disable-next-line no-control-regex
  if (!user.trim() || /[:,()*\x00-\x1f\x7f]/.test(user)) throw new Error(`not a user name icacls can grant: ${JSON.stringify(user)}`)
  return { file: 'icacls.exe', args: [file, '/inheritance:r', '/grant:r', `${user}:(F)`, '*S-1-5-18:(F)', '*S-1-5-32-544:(F)'] }
}
/** The account a Windows token file's ACL grants (0.3.5 review iteration 2, ER-9). icacls resolves a bare name on a
 *  local account, but on an Azure AD-joined or domain machine it needs the account qualified — `AzureAD\name`,
 *  `DOMAIN\name` — and a bare name may not resolve, so no hub file would ever be published. Windows sets the logon
 *  domain of the session in %USERDOMAIN% (the computer's name for a local account, which icacls takes as well). A
 *  name already qualified, or a domain icacls would read as another grant, keeps the bare name. Not proven on a
 *  domain or Azure AD host yet (CO-267's on-host proof). */
export function windowsAclAccount(env: Env, username: string): string {
  const domain = (env.USERDOMAIN ?? '').trim()
  // eslint-disable-next-line no-control-regex
  if (!domain || username.includes('\\') || /[\\/:,()*\x00-\x1f\x7f]/.test(domain)) return username
  return `${domain}\\${username}`
}

/** A helper process Fabric starts and does not wait on (a taskkill, the quit reaper): its failure to start — spawn's
 *  'error' (ENOENT on an unusual PATH, EMFILE), or a throw from spawn itself — goes to `onError`, never an uncaught
 *  exception in the main process (0.3.5 review iteration 2, ER-10). The listener is attached before anything can emit.
 *  Null when spawn threw. */
export function spawnHelper<C extends { on(event: 'error', listener: (e: Error) => void): unknown }, O>(
  start: (file: string, args: string[], options: O) => C,
  how: Invocation,
  options: O,
  onError: (e: Error) => void
): C | null {
  let child: C
  try {
    child = start(how.file, how.args, options)
  } catch (e) {
    // Reported to the caller's log through onError; the caller degrades (no helper) and says so there.
    onError(e instanceof Error ? e : new Error(String(e)))
    return null
  }
  child.on('error', onError)
  return child
}

/** REQ-09: the file names a program can have on PATH. Windows tries the extensions its installers use, in
 *  PATHEXT's order of preference: the native installer's .exe before npm's .cmd shim. */
export function executableCandidates(program: string, platform: NodeJS.Platform): string[] {
  if (platform !== 'win32' || /\.(?:exe|cmd|bat|com)$/i.test(program)) return [program]
  return [`${program}.exe`, `${program}.cmd`, `${program}.bat`, program]
}

/** How to start a found program: CreateProcess cannot start a .cmd or .bat, so those run through cmd.exe
 *  (`/d` no AutoRun, `/v:off` no `!` expansion, `/s /c` the rest as one command), on a command line built for cmd
 *  (`cmdCommandLine`) and passed as written; everything else runs directly. */
export function launchFor(file: string, args: string[], platform: NodeJS.Platform): Invocation {
  if (platform === 'win32' && /\.(?:cmd|bat)$/i.test(file)) return { file: 'cmd.exe', args: ['/d', '/v:off', '/s', '/c', cmdCommandLine(file, args)], verbatim: true }
  return { file, args }
}

/** An argument cmd.exe passes on unread: no space, no metacharacter, no delimiter. */
const CMD_BARE = /^[A-Za-z0-9_\-.:/\\+@]+$/

/** The line `cmd /s /c` runs, wrapped in the outer quote pair `/s` strips (0.3.5 review ER-5): the file quoted, so a
 *  path with a space stays one path; every other argument bare when cmd would leave it alone, else quoted, with each
 *  `%` escaped outside the quotes (cmd expands `%…%` even inside them). Refused loudly rather than cut: a line break,
 *  which ends cmd's line and would drop everything after it, and an inner quote, which cmd reads as the end of the
 *  quoting that keeps `&` and `|` inert. */
export function cmdCommandLine(file: string, args: string[]): string {
  const check = (s: string, what: string): void => {
    if (/[\r\n\0]/.test(s)) throw new Error(`${what} has a line break, which cmd.exe cannot carry: it would be cut there; launch the program's .exe instead of its .cmd shim`)
    if (s.includes('"')) throw new Error(`${what} has a double quote, which cmd.exe cannot carry safely; launch the program's .exe instead of its .cmd shim`)
  }
  check(file, 'the program path')
  const quoted = (a: string): string => `"${a.split('%').join('"^%"')}"`
  const parts = [`"${file}"`, ...args.map((a, i) => { check(a, `argument ${i + 1}`); return CMD_BARE.test(a) ? a : quoted(a) })]
  return `"${parts.join(' ')}"`
}
// #endregion platform-invocations
