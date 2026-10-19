// What Fabric runs, per OS, where a POSIX tool used to be assumed (0.3.5, CO-238, REQ-08…REQ-11).
import assert from 'node:assert/strict'
import { defaultShell, whichInvocation, quitReaperInvocation, processTreeStopInvocation, pathAdditions, mergeLaunchPath, shellPathProbe, protectedAclInvocation, executableCandidates, launchFor, cmdCommandLine, stopWindowsTree, killPty, windowsAclAccount, spawnHelper } from '../src/main/platform.ts'

// REQ-08: the OS's own shell.
assert.equal(defaultShell('darwin', { SHELL: '/bin/bash' }), '/bin/bash')
assert.equal(defaultShell('darwin', {}), '/bin/zsh')
assert.equal(defaultShell('linux', { SHELL: '/usr/bin/fish' }), '/usr/bin/fish')
assert.equal(defaultShell('linux', {}), '/bin/bash', 'no zsh assumed on Linux')
assert.equal(defaultShell('win32', { SHELL: '/bin/bash', COMSPEC: 'C:\\Windows\\system32\\cmd.exe' }), 'powershell.exe',
  'Windows starts PowerShell, never a POSIX SHELL left in the environment by a dev tool')
assert.equal(defaultShell('win32', {}), 'powershell.exe')

// REQ-09: finding an executable without a shell, and never through /usr/bin/env on Windows.
assert.deepEqual(whichInvocation('win32', 'claude'), { file: 'where.exe', args: ['claude'] })
assert.deepEqual(whichInvocation('linux', 'claude'), { file: '/usr/bin/env', args: ['which', 'claude'] })
assert.deepEqual(whichInvocation('darwin', 'codex'), { file: '/usr/bin/env', args: ['which', 'codex'] })

// REQ-10: the outside quit guard, with no POSIX shell on Windows — and never a process that is not this Fabric (0.3.5
// review ER-3): the pid may have been reused by the time the guard fires.
const posix = quitReaperInvocation('darwin', 1234, 15, '/Applications/Fabric.app/Contents/MacOS/Fabric')
assert.equal(posix.file, '/bin/sh')
assert.equal(posix.args[0], '-c')
// The identity (start time and command) is read while the pid is surely this process — the guard is armed by it —
// and read again before the kill; a pid that now names another process is left alone.
assert.equal(posix.args[1], 'id=$(ps -o lstart= -o command= -p 1234 2>/dev/null); [ -n "$id" ] || exit 0; sleep 15; ' +
  '[ "$(ps -o lstart= -o command= -p 1234 2>/dev/null)" = "$id" ] && kill -9 1234 2>/dev/null')
assert.deepEqual(quitReaperInvocation('linux', 1234, 15, '/opt/Fabric/passioncode-fabric'), { file: '/bin/sh', args: posix.args })
const win = quitReaperInvocation('win32', 1234, 15, 'C:\\Users\\John Smith\\AppData\\Local\\Programs\\Fabric\\Fabric.exe')
assert.equal(win.file, 'cmd.exe')
assert.equal(win.verbatim, true, 'the line is passed as written: Node\'s quoting of an inner quote is not cmd\'s')
assert.deepEqual(win.args.slice(0, 3), ['/d', '/s', '/c'])
assert.equal(win.args[3], '"ping -n 16 127.0.0.1 >nul & taskkill /F /FI "IMAGENAME eq Fabric.exe" /PID 1234 >nul 2>&1"',
  'waits ~15 s, then ends this pid only while it is still Fabric\'s image')
assert.throws(() => quitReaperInvocation('win32', 1234, 15, 'C:\\x\\Fab"ric.exe'), /image/, 'a name that would break the filter')
assert.throws(() => quitReaperInvocation('win32', 1234, 15, 'C:\\x\\a&b.exe'), /image/)
assert.throws(() => quitReaperInvocation('win32', 1234, 15, 'C:\\x\\100%.exe'), /image/)
assert.throws(() => quitReaperInvocation('win32', 0, 15, 'C:\\Fabric.exe'), /pid/)
assert.throws(() => quitReaperInvocation('linux', 1234.5, 15, '/x'), /pid/)

// REQ-11: a Windows session's process tree, stopped by its still-owned root.
assert.deepEqual(processTreeStopInvocation(4321, 'SIGTERM'), { file: 'taskkill.exe', args: ['/PID', '4321', '/T'] })
assert.deepEqual(processTreeStopInvocation(4321, 'SIGKILL'), { file: 'taskkill.exe', args: ['/PID', '4321', '/T', '/F'] })
assert.throws(() => processTreeStopInvocation(-4, 'SIGTERM'), /pid/)
assert.throws(() => processTreeStopInvocation(4, 'SIGTERM'), /pid/, 'never the System process')

// REQ-05: where installers put `supabase`, `docker` and the coding agents, per OS, beside the PATH an app launched
// from the Dock, the Start menu or a desktop file inherits.
assert.deepEqual(pathAdditions('darwin', {}, '/Users/a'), ['/opt/homebrew/bin', '/usr/local/bin', '/Users/a/.local/bin'])
assert.deepEqual(pathAdditions('linux', {}, '/home/a'), ['/usr/local/bin', '/home/a/.local/bin', '/snap/bin', '/home/linuxbrew/.linuxbrew/bin'])
assert.deepEqual(pathAdditions('win32', { LOCALAPPDATA: 'C:\\Users\\a\\AppData\\Local', APPDATA: 'C:\\Users\\a\\AppData\\Roaming', ProgramFiles: 'C:\\Program Files' }, 'C:\\Users\\a'), [
  'C:\\Users\\a\\.local\\bin',
  'C:\\Users\\a\\AppData\\Roaming\\npm',
  'C:\\Users\\a\\scoop\\shims',
  'C:\\Users\\a\\AppData\\Local\\Microsoft\\WinGet\\Links',
  'C:\\Program Files\\Docker\\Docker\\resources\\bin'
], 'Claude Code native, npm globals, scoop (supabase), winget links, Docker Desktop')
assert.deepEqual(pathAdditions('win32', {}, 'C:\\Users\\a').slice(-1), ['C:\\Program Files\\Docker\\Docker\\resources\\bin'], 'defaults when the variables are absent')

// REQ-13: a token file Fabric writes on Windows carries DEC-0033's ACL — protected (no inheritance), granting the user,
// SYSTEM and Administrators only, by SID where a SID is fixed.
assert.deepEqual(protectedAclInvocation('C:\\Users\\a\\AppData\\Local\\passioncode-fabric\\hub-door-token.tmp', 'alice'), {
  file: 'icacls.exe',
  args: ['C:\\Users\\a\\AppData\\Local\\passioncode-fabric\\hub-door-token.tmp', '/inheritance:r', '/grant:r', 'alice:(F)', '*S-1-5-18:(F)', '*S-1-5-32-544:(F)']
})
assert.throws(() => protectedAclInvocation('x', ''), /user/)
assert.throws(() => protectedAclInvocation('x', '   '), /user/)
assert.throws(() => protectedAclInvocation('x', 'a:b'), /user/, 'a name that would be read as another grant')
assert.throws(() => protectedAclInvocation('x', 'a,b'), /user/)
assert.throws(() => protectedAclInvocation('x', 'a*'), /user/)
assert.throws(() => protectedAclInvocation('x', 'a\nb'), /user/, 'a control character')
// A Windows account name with a space is common and icacls takes it as one argument (0.3.5 review ER-6).
assert.deepEqual(protectedAclInvocation('C:\\t.tmp', 'John Smith').args, ['C:\\t.tmp', '/inheritance:r', '/grant:r', 'John Smith:(F)', '*S-1-5-18:(F)', '*S-1-5-32-544:(F)'])

// 0.3.5 review i2 ER-9: on an Azure AD-joined or domain machine icacls needs the account qualified (AzureAD\name,
// DOMAIN\name); a bare name may not resolve, and then no hub file is ever published. The grant names the logon domain
// Windows sets for the session (%USERDOMAIN%) before the user name; without one, or with one icacls would misread, the
// bare name stays.
assert.equal(windowsAclAccount({ USERDOMAIN: 'AzureAD' }, 'JohnSmith'), 'AzureAD\\JohnSmith')
assert.equal(windowsAclAccount({ USERDOMAIN: 'CORP' }, 'John Smith'), 'CORP\\John Smith')
assert.equal(windowsAclAccount({ USERDOMAIN: 'DESKTOP-1A2B3C' }, 'alice'), 'DESKTOP-1A2B3C\\alice', 'a local account: the computer is its domain')
assert.equal(windowsAclAccount({}, 'alice'), 'alice')
assert.equal(windowsAclAccount({ USERDOMAIN: '  ' }, 'alice'), 'alice')
assert.equal(windowsAclAccount({ USERDOMAIN: 'a:b' }, 'alice'), 'alice', 'a domain icacls would read as a grant is not used')
assert.equal(windowsAclAccount({ USERDOMAIN: 'CORP' }, 'CORP\\alice'), 'CORP\\alice', 'never qualified twice')
assert.equal(protectedAclInvocation('C:\\t.tmp', windowsAclAccount({ USERDOMAIN: 'AzureAD' }, 'John Smith')).args[3], 'AzureAD\\John Smith:(F)')
{
  const { readFileSync } = await import('node:fs')
  const hubSource = readFileSync(new URL('../src/main/hub.ts', import.meta.url), 'utf8')
  assert.match(hubSource, /windowsAclAccount\(process\.env, userInfo\(\)\.username\)/, 'the hub grants the qualified account')
}

// REQ-09: a program's file names on PATH — Windows adds the extensions installers use (the native installer's .exe,
// npm's .cmd shim), in PATHEXT's order of preference.
assert.deepEqual(executableCandidates('claude', 'linux'), ['claude'])
assert.deepEqual(executableCandidates('claude', 'win32'), ['claude.exe', 'claude.cmd', 'claude.bat', 'claude'])
assert.deepEqual(executableCandidates('codex.cmd', 'win32'), ['codex.cmd'], 'a name with its extension is taken as it is')

// A .cmd or .bat runs through cmd.exe (CreateProcess cannot start one); an .exe and every POSIX program run directly.
// cmd.exe's /s strips the outer quote pair and reads the rest as one line, so the line is built here and passed as
// written (0.3.5 review ER-5): a path with a space stays one path, an argument with a metacharacter stays an argument.
assert.deepEqual(launchFor('C:\\Users\\a\\AppData\\Roaming\\npm\\codex.cmd', ['--version'], 'win32'),
  { file: 'cmd.exe', args: ['/d', '/v:off', '/s', '/c', '""C:\\Users\\a\\AppData\\Roaming\\npm\\codex.cmd" --version"'], verbatim: true })
assert.deepEqual(launchFor('C:\\Users\\John Smith\\AppData\\Roaming\\npm\\claude.cmd', ['--mcp-config', 'C:\\Users\\John Smith\\s\\mcp.json', '--permission-mode', 'plan'], 'win32').args[4],
  '""C:\\Users\\John Smith\\AppData\\Roaming\\npm\\claude.cmd" --mcp-config "C:\\Users\\John Smith\\s\\mcp.json" --permission-mode plan"')
assert.deepEqual(launchFor('C:\\Users\\a\\.local\\bin\\claude.exe', ['--version'], 'win32'), { file: 'C:\\Users\\a\\.local\\bin\\claude.exe', args: ['--version'] })
assert.deepEqual(launchFor('/usr/local/bin/codex', ['--version'], 'linux'), { file: '/usr/local/bin/codex', args: ['--version'] })
// cmd's metacharacters stay inside quotes; a percent sign is escaped outside them (cmd expands %…% even in quotes).
assert.equal(cmdCommandLine('C:\\n\\x.cmd', ['a&b', 'x|y', '<in>', '(1)', '', 'plain-arg_1.2:3/4\\5', '--x=1,2;3']),
  '""C:\\n\\x.cmd" "a&b" "x|y" "<in>" "(1)" "" plain-arg_1.2:3/4\\5 "--x=1,2;3""')
assert.equal(cmdCommandLine('C:\\n\\x.cmd', ['50% off', '%PATH%']), '""C:\\n\\x.cmd" "50"^%" off" ""^%"PATH"^%"""')
// What cmd cannot carry is refused loudly, never cut: a line feed ends cmd's command line, and cmd reads an inner
// quote as the end of the quoting that keeps & and | inert.
assert.throws(() => launchFor('C:\\n\\claude.cmd', ['--append-system-prompt', 'brief\n\nYou are running inside Fabric'], 'win32'), /line break/)
assert.throws(() => cmdCommandLine('C:\\n\\x.cmd', ['say "hi" & exit']), /quote/)
assert.throws(() => cmdCommandLine('C:\\n\\x.cmd', ['a\rb']), /line break/)
// An .exe takes a multi-line argument through CreateProcess unharmed: nothing is refused there.
assert.deepEqual(launchFor('C:\\a\\claude.exe', ['--append-system-prompt', 'a\nb'], 'win32'), { file: 'C:\\a\\claude.exe', args: ['--append-system-prompt', 'a\nb'] })

// REQ-11 on Windows (0.3.5 review ER-4): node-pty throws "Signals not supported on windows" whenever kill is given a
// signal, so a Stop never falls back to it there. A graceful taskkill that is refused is followed by a forced one,
// then by closing the pseudo-console (kill with no signal); the outcome is said.
{
  // Asynchronous since 0.3.5 review i2 ER-6: each taskkill step is awaited, so a Stop never blocks the main thread
  // (the quit deadline is a timer there, and so is every window). `run` answers a promise; a refusal rejects it.
  const runs = []
  let closed = 0
  const run = (fail) => async (how) => { runs.push(how.args.join(' ')); await new Promise((r) => setTimeout(r, 1)); if (fail(how)) throw new Error('refused') }
  const close = () => { closed++ }
  assert.deepEqual(await stopWindowsTree(4321, 'SIGTERM', run(() => false), close), { outcome: 'stopped', failures: [] })
  assert.deepEqual(runs.splice(0), ['/PID 4321 /T'])
  const forced = await stopWindowsTree(4321, 'SIGTERM', run((h) => !h.args.includes('/F')), close)
  assert.equal(forced.outcome, 'forced')
  assert.equal(forced.failures.length, 1)
  assert.deepEqual(runs.splice(0), ['/PID 4321 /T', '/PID 4321 /T /F'], 'a refused graceful stop is followed by a forced one')
  const closedPty = await stopWindowsTree(4321, 'SIGTERM', run(() => true), close)
  assert.equal(closedPty.outcome, 'pty-closed')
  assert.equal(closed, 1, 'the pseudo-console is closed when taskkill cannot end the tree')
  runs.length = 0
  assert.equal((await stopWindowsTree(4321, 'SIGKILL', run(() => false), close)).outcome, 'forced')
  assert.deepEqual(runs.splice(0), ['/PID 4321 /T /F'], 'a forced Stop goes straight to /F')
  const none = await stopWindowsTree(4321, 'SIGTERM', run(() => true), () => { throw new Error('gone') })
  assert.equal(none.outcome, 'not-stopped')
  assert.equal(none.failures.length, 3)
  runs.length = 0
  // Not allowed any more (the root's exit was observed meanwhile): nothing further is sent.
  let allowed = true
  const later = await stopWindowsTree(4321, 'SIGTERM', async (how) => { runs.push(how.args.join(' ')); allowed = false; throw new Error('refused') }, close, () => allowed)
  assert.equal(later.outcome, 'not-stopped')
  assert.deepEqual(runs.splice(0), ['/PID 4321 /T'])
  // The main thread goes on while a taskkill runs: a timer fires before the Stop answers.
  let ticked = false
  setTimeout(() => { ticked = true }, 0)
  let release
  const pending = stopWindowsTree(4321, 'SIGTERM', () => new Promise((r) => { release = r }), close)
  assert.ok(pending instanceof Promise, 'a Stop answers a promise')
  await new Promise((r) => setTimeout(r, 5))
  assert.equal(ticked, true, 'the event loop ran while taskkill was out')
  release()
  assert.equal((await pending).outcome, 'stopped')
  // The PTY's Windows Stop runs taskkill asynchronously, with its own bound, never execFileSync on the main thread.
  const { readFileSync } = await import('node:fs')
  const pty = readFileSync(new URL('../src/main/pty.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(pty, /execFileSync/)
  assert.match(pty, /stopWindowsTree\([^]*?runBounded\(how\.file, how\.args, 5000\)/)
}
{
  const seen = []
  const pty = { kill(...a) { seen.push(a) } }
  killPty(pty, 'win32', 'SIGTERM')
  killPty(pty, 'darwin', 'SIGTERM')
  killPty(pty, 'linux', 'SIGKILL')
  assert.deepEqual(seen, [[], ['SIGTERM'], ['SIGKILL']], 'no signal reaches node-pty on Windows')
}

// The line built for cmd reaches it as written: node-pty takes a string as the command line, execFile takes
// windowsVerbatimArguments; an array would be quoted again by node-pty's or Node's own rules (ER-5).
{
  const { readFileSync } = await import('node:fs')
  const src = (f) => readFileSync(new URL(`../src/main/${f}`, import.meta.url), 'utf8')
  assert.match(src('pty.ts'), /args: how\.verbatim \? how\.args\.join\(' '\) : how\.args/)
  assert.match(src('executorDetect.ts'), /windowsVerbatimArguments: how\.verbatim === true/)
  // ER-4: no PTY of a Windows session is killed with a signal, on the Stop path or the launch-failure path.
  assert.doesNotMatch(src('pty.ts'), /pty\.kill\('SIGTERM'\)/)
}

// 0.3.5 review i2 ER-10: a helper Fabric starts on Windows (the version probe's taskkill, the quit reaper's cmd.exe)
// that cannot start (ENOENT on an unusual PATH, EMFILE) emits 'error' on its ChildProcess; with no listener that is an
// uncaught exception in the main process. spawnHelper attaches the listener before anything can emit, reports the
// failure, and answers null for a spawn that threw at once.
{
  const { EventEmitter } = await import('node:events')
  const seen = []
  const failing = () => {
    const c = new EventEmitter()
    c.unref = () => c
    queueMicrotask(() => c.emit('error', Object.assign(new Error('spawn taskkill.exe ENOENT'), { code: 'ENOENT' })))
    return c
  }
  const child = spawnHelper(failing, { file: 'taskkill.exe', args: ['/PID', '1', '/T', '/F'] }, { stdio: 'ignore' }, (e) => seen.push(e.code))
  assert.ok(child, 'the child is handed back')
  await new Promise((r) => setTimeout(r, 5))
  assert.deepEqual(seen, ['ENOENT'], 'reported, not thrown')
  const none = spawnHelper(() => { throw new Error('spawn EMFILE') }, { file: 'cmd.exe', args: [] }, {}, (e) => seen.push(e.message))
  assert.equal(none, null)
  assert.deepEqual(seen, ['ENOENT', 'spawn EMFILE'])
  const passed = []
  spawnHelper((file, args, options) => { passed.push([file, args, options]); const c = new EventEmitter(); return c }, { file: 'cmd.exe', args: ['/c', 'x'], verbatim: true }, { detached: true }, () => {})
  assert.deepEqual(passed, [['cmd.exe', ['/c', 'x'], { detached: true }]])
  const { readFileSync } = await import('node:fs')
  const read = (f) => readFileSync(new URL(`../src/main/${f}`, import.meta.url), 'utf8')
  assert.match(read('executorDetect.ts'), /spawnHelper\(spawn, stop, \{ stdio: 'ignore', windowsHide: true \},/)
  assert.match(read('quit.ts'), /spawnHelper\(spawn, how, \{ detached: true,/)
}

console.log('platform: all green')

// CO-326: an app started from the Dock inherits a bare PATH, so appending the installers' folders put /opt/homebrew/bin
// before ~/.local/bin and launched a brew Claude Code 2.1.299 beside the native 2.1.300 the terminal runs. The login
// shell's order comes first; what the process inherited and the installers' folders follow, each folder once.
assert.equal(
  mergeLaunchPath('/Users/a/.local/bin:/opt/homebrew/bin:/usr/bin', '/usr/bin:/bin', ['/opt/homebrew/bin', '/usr/local/bin', '/Users/a/.local/bin'], ':'),
  '/Users/a/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/local/bin'
)
assert.equal(mergeLaunchPath(null, '/usr/bin:/bin', ['/opt/homebrew/bin'], ':'), '/usr/bin:/bin:/opt/homebrew/bin', 'no shell reading: as before')
assert.equal(mergeLaunchPath('', '/usr/bin', [], ':'), '/usr/bin')
assert.equal(mergeLaunchPath('relative/bin:/ok', '/usr/bin', [], ':'), '/ok:/usr/bin', 'a relative entry from an rc file is not trusted')
const probe = shellPathProbe('/bin/zsh')
assert.equal(probe.file, '/bin/zsh')
assert.deepEqual(probe.args.slice(0, 1), ['-ilc'])
assert.equal(probe.read('noise from an rc file\n__FABRIC_PATH__/a:/b__FABRIC_PATH__\nmore'), '/a:/b')
assert.equal(probe.read('no markers at all'), null)
assert.equal(shellPathProbe(''), null, 'no shell, no probe')
console.log('PASS the launch PATH follows the login shell first (CO-326)')
