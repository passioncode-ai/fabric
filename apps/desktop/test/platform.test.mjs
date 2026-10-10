// What Fabric runs, per OS, where a POSIX tool used to be assumed (0.3.5, CO-238, REQ-08…REQ-11).
import assert from 'node:assert/strict'
import { defaultShell, whichInvocation, quitReaperInvocation, processTreeStopInvocation, pathAdditions, protectedAclInvocation, executableCandidates, launchFor } from '../src/main/platform.ts'

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

// REQ-10: the outside quit guard, with no POSIX shell on Windows.
assert.deepEqual(quitReaperInvocation('darwin', 1234, 15), { file: '/bin/sh', args: ['-c', 'sleep 15; kill -9 1234 2>/dev/null'] })
assert.deepEqual(quitReaperInvocation('linux', 1234, 15), { file: '/bin/sh', args: ['-c', 'sleep 15; kill -9 1234 2>/dev/null'] })
const win = quitReaperInvocation('win32', 1234, 15)
assert.equal(win.file, 'cmd.exe')
assert.deepEqual(win.args.slice(0, 2), ['/d', '/c'])
assert.match(win.args[2], /^ping -n 16 127\.0\.0\.1 >nul & taskkill \/F \/PID 1234 >nul 2>&1$/, 'waits ~15 s, then ends this pid')
assert.throws(() => quitReaperInvocation('win32', 0, 15), /pid/)
assert.throws(() => quitReaperInvocation('linux', 1234.5, 15), /pid/)

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
assert.throws(() => protectedAclInvocation('x', 'a:b'), /user/, 'a name that would be read as another grant')

// REQ-09: a program's file names on PATH — Windows adds the extensions installers use (the native installer's .exe,
// npm's .cmd shim), in PATHEXT's order of preference.
assert.deepEqual(executableCandidates('claude', 'linux'), ['claude'])
assert.deepEqual(executableCandidates('claude', 'win32'), ['claude.exe', 'claude.cmd', 'claude.bat', 'claude'])
assert.deepEqual(executableCandidates('codex.cmd', 'win32'), ['codex.cmd'], 'a name with its extension is taken as it is')

// A .cmd or .bat runs through cmd.exe (CreateProcess cannot start one); an .exe and every POSIX program run directly.
assert.deepEqual(launchFor('C:\\Users\\a\\AppData\\Roaming\\npm\\codex.cmd', ['--version'], 'win32'),
  { file: 'cmd.exe', args: ['/d', '/s', '/c', 'C:\\Users\\a\\AppData\\Roaming\\npm\\codex.cmd', '--version'] })
assert.deepEqual(launchFor('C:\\Users\\a\\.local\\bin\\claude.exe', ['--version'], 'win32'), { file: 'C:\\Users\\a\\.local\\bin\\claude.exe', args: ['--version'] })
assert.deepEqual(launchFor('/usr/local/bin/codex', ['--version'], 'linux'), { file: '/usr/local/bin/codex', args: ['--version'] })

console.log('platform: all green')
