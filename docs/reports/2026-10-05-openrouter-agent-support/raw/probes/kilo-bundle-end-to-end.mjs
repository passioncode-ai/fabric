// P-10 end-to-end probe: the bundle compiler's real KILO_CONFIG_CONTENT, handed to the real `kilo`,
// against a bearer-checking streamable-HTTP MCP server. Run from apps/desktop:
//   node --experimental-strip-types <this file>
import { spawn, execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
const desktop = process.cwd()
const { createBundleCompiler } = await import(path.join(desktop, 'src/main/sessionBundle.ts'))
const { mayLaunch } = await import(path.join(desktop, 'src/shared/agents.ts'))
const port = 48950 + (process.pid % 40), sid = randomUUID(), token = 'tok-' + sid
// The server imports the MCP SDK, which resolves from the desktop package, so it runs from there.
const serverFile = path.join(desktop, '.probe-mcp-server.mjs')
copyFileSync(path.join(import.meta.dirname, 'probe-mcp-server.mjs'), serverFile)
process.on('exit', () => rmSync(serverFile, { force: true }))
const server = spawn(process.execPath, [serverFile], {
  cwd: desktop, env: { ...process.env, PROBE_TOKEN: token, PROBE_PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] })
await new Promise((r) => server.stdout.once('data', r))
const bundles = createBundleCompiler({ root: mkdtempSync(path.join(tmpdir(), 'fabric-kilo-')),
  surface: { endpoint: `http://127.0.0.1:${port}/mcp`, mint: () => ({ token }), revokeSession: () => {} } })
const verdict = mayLaunch('kilo', null)
const bundle = await bundles.compile(sid, randomUUID(), null, 'kilo', 'config-content-env', null, verdict.config)
const run = (env) => execFileSync('perl', ['-e', 'alarm 90; exec @ARGV', 'kilo', 'mcp', 'list'], { cwd: tmpdir(), env: { ...process.env, ...env }, encoding: 'utf8' })
  .replace(/\x1b\[[0-9;]*m/g, '').split('\n').filter((l) => /fabric|server/.test(l)).join(' | ')
console.log('kilo', execFileSync('kilo', ['--version'], { encoding: 'utf8' }).trim())
console.log('bundle args:', JSON.stringify(bundle.args), '· env keys:', Object.keys(bundle.env).join(','))
console.log('with the compiled config:', run(bundle.env))
const forged = JSON.parse(bundle.env.KILO_CONFIG_CONTENT); forged.mcp.fabric.headers.Authorization = 'Bearer revoked'
console.log('with a revoked bearer:', run({ KILO_CONFIG_CONTENT: JSON.stringify(forged) }))
bundles.discard(sid)
server.kill('SIGTERM')
