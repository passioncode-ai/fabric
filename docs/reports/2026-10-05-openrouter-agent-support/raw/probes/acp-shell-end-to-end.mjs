// P-10 end-to-end probe: Fabric's ACP shell drives a REAL agent (`hermes acp`, `cline --acp`, `kilo acp`),
// whose session/new carries Fabric's surface (HTTP when declared, else the stdio bridge), against a
// bearer-checking MCP server. No model call is needed to see the agent connect: the server counts
// the authorised requests the agent's MCP client made. Run from apps/desktop:
//   node --experimental-strip-types <this file> <agent> [args…]
import { spawn } from 'node:child_process'
import { copyFileSync, rmSync } from 'node:fs'
import path from 'node:path'
const desktop = process.cwd(), [agent, ...agentArgs] = process.argv.slice(2)
const token = 'tok-e2e-' + process.pid, port = 47900 + (process.pid % 90)
const serverFile = path.join(desktop, '.probe-mcp-server.mjs')
copyFileSync(path.join(import.meta.dirname, 'probe-mcp-server.mjs'), serverFile)
const server = spawn(process.execPath, [serverFile], { cwd: desktop, env: { ...process.env, PROBE_TOKEN: token, PROBE_PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] })
await new Promise((r) => server.stdout.once('data', r))
const url = `http://127.0.0.1:${port}/mcp`
const spec = {
  http: { type: 'http', name: 'fabric', url, headers: [{ name: 'Authorization', value: 'Bearer ' + token }] },
  stdio: { name: 'fabric', command: process.execPath, args: ['--experimental-strip-types', path.join(desktop, 'src/main/mcpStdioBridgeMain.ts')],
    env: [{ name: 'FABRIC_BRIDGE_URL', value: url }, { name: 'FABRIC_BRIDGE_AUTHORIZATION', value: 'Bearer ' + token }, { name: 'PATH', value: process.env.PATH }] },
  brief: 'Fabric probe: reply with the single word ready.',
  mode: 'ask'
}
const shell = spawn(process.execPath, ['--experimental-strip-types', path.join(desktop, 'src/main/acpShellMain.ts'), '--', agent, ...agentArgs], {
  cwd: '/tmp', env: { ...process.env, FABRIC_ACP_SESSION: JSON.stringify(spec), HERMES_ACP_SKIP_CONFIGURED_MCP: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
let shown = ''
shell.stdout.on('data', (c) => { shown += c }); shell.stderr.on('data', (c) => { shown += c })
await new Promise((r) => setTimeout(r, Number(process.env.PROBE_WAIT_MS ?? 25000)))
shell.stdin.end()
const code = await new Promise((r) => { shell.on('exit', r); setTimeout(() => { shell.kill('SIGKILL'); r('killed') }, 15000) })
let counters = ''
server.stdout.on('data', (c) => { counters += c })
server.kill('SIGTERM')
await new Promise((r) => server.on('exit', r))
rmSync(serverFile, { force: true })
const clean = shown.replace(/\x1b\[[0-9;]*m/g, '').replace(new RegExp(token, 'g'), '<token>')
console.log(`agent: ${agent} ${agentArgs.join(' ')}\nshell exit: ${code}\nshell output (tail):\n${clean.split('\n').filter((l) => l.trim()).slice(-12).join('\n')}\nserver: ${counters.trim().split('\n').pop()}`)
