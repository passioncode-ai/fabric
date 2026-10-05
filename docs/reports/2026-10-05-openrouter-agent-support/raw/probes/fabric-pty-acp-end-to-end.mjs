// P-10 end-to-end probe of the launch path itself: Fabric's bundle compiler builds the session for a
// catalogue runner (`hermes`, `cline`), node-pty starts the bundle's command exactly as PtyManager
// does, and a bearer-checking MCP server counts what the agent's MCP client reached. Run from
// apps/desktop:  node --experimental-strip-types <this file> <runner id>
import { spawn } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
const pty = await import(path.join(process.cwd(), 'node_modules/node-pty/lib/index.js')).then((m) => m.default ?? m)
const desktop = process.cwd(), runner = process.argv[2]
const { createBundleCompiler } = await import(path.join(desktop, 'src/main/sessionBundle.ts'))
const { mayLaunch } = await import(path.join(desktop, 'src/shared/agents.ts'))
const sid = randomUUID(), token = 'tok-' + sid, port = 48100 + (process.pid % 400)
const serverFile = path.join(desktop, '.probe-mcp-server.mjs')
copyFileSync(path.join(import.meta.dirname, 'probe-mcp-server.mjs'), serverFile)
const server = spawn(process.execPath, [serverFile], { cwd: desktop, env: { ...process.env, PROBE_TOKEN: token, PROBE_PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] })
await new Promise((r) => server.stdout.once('data', r))
const bundles = createBundleCompiler({ root: mkdtempSync(path.join(tmpdir(), 'fabric-acp-')),
  surface: { endpoint: `http://127.0.0.1:${port}/mcp`, mint: () => ({ token }), revokeSession: () => {} } })
const verdict = mayLaunch(runner, null)
const bundle = await bundles.compile(sid, randomUUID(), null, runner, 'acp-session', null, verdict.config)
const term = pty.spawn(bundle.command.program, bundle.command.args, { name: 'xterm-256color', cols: 120, rows: 32, cwd: tmpdir(), env: { ...process.env, ...bundle.env } })
let shown = '', exited = null
term.onData((d) => { shown += d })
const exit = new Promise((r) => term.onExit(({ exitCode }) => { exited = exitCode; r(exitCode) }))
await Promise.race([exit, new Promise((r) => setTimeout(r, Number(process.env.PROBE_WAIT_MS ?? 60000)))])
if (exited === null) term.write('\x04')
const code = await Promise.race([exit, new Promise((r) => setTimeout(() => { term.kill(); r('killed') }, 15000))])
let counters = ''
server.stdout.on('data', (c) => { counters += c })
server.kill('SIGTERM'); await new Promise((r) => server.on('exit', r))
rmSync(serverFile, { force: true }); bundles.discard(sid)
const clean = shown.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replaceAll(token, '<token>').replace(/org_[A-Za-z0-9]+/g, '<org-id>')
if (process.env.PROBE_FULL) console.log(clean)
console.log(`runner: ${runner} (mode ${verdict.config?.acpMode})\ncommand: ${path.basename(bundle.command.program)} ${bundle.command.args.map((a) => path.basename(a)).join(' ')}\npty exit: ${code}\nterminal (Fabric lines):\n${clean.split(/\r?\n/).filter((l) => /Fabric:|sign in|Sign in|did not|exited|not opened|number/.test(l)).slice(-6).join('\n')}\nserver: ${counters.trim().split('\n').pop()}`)
