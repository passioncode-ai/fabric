// Entry of the ACP terminal shell (see acpShell.ts). Fabric starts it in the session's PTY as
//   <runtime> acp-shell -- <agent program> <agent args…>
// with the session in FABRIC_ACP_SESSION (environment only: it carries the session credential).
import { spawn } from 'node:child_process'
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
delete process.env.FABRIC_ACP_SESSION
delete process.env.ELECTRON_RUN_AS_NODE
const code = await runAcpShell(spec, {
  input: process.stdin,
  output: process.stdout,
  onInterrupt(listener) { process.on('SIGINT', listener) },
  spawnAgent() {
    // Its own process group: Ctrl-C at the terminal reaches the shell, which cancels the turn.
    const child = spawn(command[0], command.slice(1), { cwd: spec.cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'], detached: true })
    return {
      stdin: child.stdin, stdout: child.stdout, stderr: child.stderr,
      kill: (signal) => { try { child.kill(signal) } catch { /* already gone */ } },
      onExit: (listener) => { child.on('exit', (c) => listener(c)); child.on('error', () => listener(127)) }
    }
  }
})
process.exit(code)
