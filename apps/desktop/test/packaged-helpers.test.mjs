// Manual native probe (0.4.0 wave 1, fused build): the helper programs a PACKAGED Fabric starts, run from the bundle
// the way the app and an install run them — the app's own binary as Node (`ELECTRON_RUN_AS_NODE=1`) on an entry
// inside `app.asar` (src/main/helperProcess.ts). That path depends on the Electron fuses (runAsNode on, the asar's
// integrity, NODE_OPTIONS off; apps/desktop/electron-builder.yml), which no source-tree test exercises:
//
//   pnpm --dir apps/desktop package
//   FABRIC_APP_EXECUTABLE=apps/desktop/dist/mac-arm64/Fabric.app/Contents/MacOS/Fabric node --test apps/desktop/test/packaged-helpers.test.mjs
//
// - bin/fabric-mcp (ADR-0134): the launcher an install ships answers initialize and lists its waiting tool
//   (scripts/lib/smoke-platform.mjs#packagedMcpCheck, the same check scripts/release-mac.mjs makes);
// - mcp-bridge.js: an MCP client on the packaged bridge reaches a bearer-checking surface's tool;
// - acp-shell.js: the packaged shell drives a fixture ACP agent through its brief turn and exits 0 at the end of
//   input, and its reaper — `<binary> -e <source>` in Node mode — ends the agent when the shell is SIGKILLed.
//
// No stack, no window, no hub: the probe touches no database and runs every helper with a throwaway HOME.
// #region packaged-helpers-probe — docs: docs/launch/release-mac.md#how-a-release-is-made
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import nodeTest from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { packagedMcpCheck } from '../../../scripts/lib/smoke-platform.mjs'

const HERE = import.meta.dirname
const exe = process.env.FABRIC_APP_EXECUTABLE ? path.resolve(process.env.FABRIC_APP_EXECUTABLE) : null
if (!exe || !existsSync(exe)) {
  console.error(JSON.stringify({ status: 'NOT_RUN', reason: 'set FABRIC_APP_EXECUTABLE to a packaged Fabric binary (pnpm --dir apps/desktop package)' }))
  process.exit(2)
}
/** The bundle's main entries: macOS Contents/Resources/app.asar/out/main, Linux and Windows resources/app.asar/out/main. */
const resources = process.platform === 'darwin' ? path.join(path.dirname(path.dirname(exe)), 'Resources') : path.join(path.dirname(exe), 'resources')
const entry = (name) => path.join(resources, 'app.asar', 'out', 'main', name)
const test = (name, fn) => nodeTest(name, { timeout: 90_000 }, fn)
const home = mkdtempSync(path.join(tmpdir(), 'fabric-packaged-home-'))
const live = new Set()
nodeTest.after(() => { for (const end of live) end(); rmSync(home, { recursive: true, force: true }) })
const waitFor = async (fn, ms) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)) } return fn() }
const pidAlive = (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
// The environment the app gives its helpers: Node mode on, nothing of the operator's home.
const helperEnv = (extra = {}) => {
  const env = { ...process.env, HOME: home, ELECTRON_RUN_AS_NODE: '1', ...extra }
  delete env.NODE_OPTIONS
  return env
}

test('bin/fabric-mcp from the bundle answers initialize and lists fabric_whoami, then exits 0', async () => {
  const v = await packagedMcpCheck({ exe })
  assert.equal(v.pass, true, `${v.why}\n${v.stderr ?? ''}`)
})

test('mcp-bridge.js from the bundle relays an MCP client to the surface with the bearer', async () => {
  const token = 'tok-packaged-bridge', port = 47000 + Math.floor(Math.random() * 900)
  const surface = spawn(process.execPath, [path.join(HERE, 'fixtures/bearer-mcp-server.mjs')], { env: { ...process.env, PROBE_TOKEN: token, PROBE_PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] })
  live.add(() => surface.kill('SIGKILL'))
  await new Promise((resolve) => surface.stdout.once('data', resolve))
  const transport = new StdioClientTransport({
    command: exe,
    args: [entry('mcp-bridge.js')],
    env: { PATH: process.env.PATH, HOME: home, ELECTRON_RUN_AS_NODE: '1', FABRIC_BRIDGE_URL: `http://127.0.0.1:${port}/mcp`, FABRIC_BRIDGE_AUTHORIZATION: `Bearer ${token}` },
    stderr: 'pipe'
  })
  let stderr = ''
  transport.stderr?.on('data', (d) => { stderr += d })
  const client = new Client({ name: 'packaged-probe', version: '0.0.0' })
  try {
    await client.connect(transport)
    assert.deepEqual((await client.listTools()).tools.map((t) => t.name), ['fabric_whoami'], stderr)
    const called = await client.callTool({ name: 'fabric_whoami', arguments: {} })
    assert.equal(called.content[0].text, 'probe')
  } catch (e) {
    throw new Error(`${e.message}\n${stderr}`)
  } finally {
    await client.close().catch(() => {})
    surface.kill('SIGTERM')
  }
})

const AGENT = path.join(HERE, 'fixtures/acp-fake-agent.mjs')
const session = {
  cwd: tmpdir(),
  http: { type: 'http', name: 'fabric', url: 'http://127.0.0.1:1/mcp', headers: [{ name: 'Authorization', value: 'Bearer tok-packaged-shell' }] },
  stdio: { name: 'fabric', command: '/usr/bin/false', args: ['bridge'], env: [{ name: 'FABRIC_BRIDGE_AUTHORIZATION', value: 'Bearer tok-packaged-shell' }] },
  brief: 'BRIEF: call fabric_whoami first.',
  mode: 'ask'
}
/** The shell as Fabric starts it in a PTY: `<binary> acp-shell.js -- <agent>`, the session in its environment. */
function shell(agentEnv = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'fabric-packaged-acp-'))
  const pidFile = path.join(dir, 'agent.pid')
  // The agent is a Node fixture; it runs under this Node, as a person's agent runs under its own runtime.
  const proc = spawn(exe, [entry('acp-shell.js'), '--', process.execPath, AGENT], {
    env: helperEnv({ FABRIC_ACP_SESSION: JSON.stringify(session), FAKE_ACP_HTTP: '1', FAKE_ACP_PID: pidFile, ...agentEnv }),
    stdio: ['pipe', 'pipe', 'pipe']
  })
  let shown = ''
  proc.stdout.on('data', (c) => { shown += c }); proc.stderr.on('data', (c) => { shown += c })
  let ended = false
  const exit = new Promise((resolve) => proc.on('exit', (code, signal) => { ended = true; resolve({ code, signal }) }))
  const agent = () => (existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8')) : null)
  live.add(() => { try { proc.kill('SIGKILL') } catch { /* gone */ } const p = agent(); if (p) { try { process.kill(p, 'SIGKILL') } catch { /* gone */ } } rmSync(dir, { recursive: true, force: true }) })
  return { proc, exit, shown: () => shown, agent, ended: () => ended }
}

test('acp-shell.js from the bundle drives the agent through its brief turn and exits 0 at the end of input', async () => {
  const sh = shell()
  // A shell that exits first (a missing entry, a binary that will not run as Node) fails at once, not at the bound.
  assert.ok(await waitFor(() => sh.shown().includes('echo:BRIEF') || sh.ended(), 30_000) && sh.shown().includes('echo:BRIEF'), `no brief turn from the packaged shell:\n${sh.shown()}`)
  sh.proc.stdin.end()
  assert.deepEqual(await sh.exit, { code: 0, signal: null }, sh.shown())
})

test('acp-shell.js from the bundle: its reaper (<binary> -e, Node mode) ends the agent when the shell is SIGKILLed', async () => {
  const sh = shell({ FAKE_ACP_STUBBORN: '1' })
  assert.ok(await waitFor(() => (sh.shown().includes('echo:BRIEF') && sh.agent()) || sh.ended(), 30_000) && sh.agent() && !sh.ended(), `no brief turn from the packaged shell:\n${sh.shown()}`)
  const agent = sh.agent()
  sh.proc.kill('SIGKILL')
  await sh.exit
  assert.ok(await waitFor(() => !pidAlive(agent), 15_000), `agent ${agent} outlived the packaged shell: the reaper did not run`)
})
// #endregion packaged-helpers-probe
