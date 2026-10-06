// P-10 AS-05 (ADR-0119 §2): Fabric's stdio bridge relays MCP to a bearer-checking HTTP surface, and the
// credential travels in the bridge's environment only.
// #region mcp-stdio-bridge — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#2-fabrics-surface-reaches-the-agent-per-session-never-through-its-own-config
import assert from 'node:assert/strict'
import nodeTest from 'node:test'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const HERE = import.meta.dirname
// Every case is bounded: a bridge that never ends (the defect some of these plant) fails the case
// instead of hanging the run.
const test = Object.assign((name, fn) => nodeTest(name, { timeout: 20_000 }, fn), { before: nodeTest.before, after: nodeTest.after })
const TOKEN = 'tok-bridge-credential'
const PORT = 47000 + Math.floor(Math.random() * 900)
// A granted server on the machine's gateway (role key in `x-agw-key`), and a surface that keeps MCP
// sessions and says when one is ended.
const GATEWAY_PORT = PORT + 1000
const STATEFUL_PORT = PORT + 2000
const ROLE_KEY = 'role-key-for-the-hop'
let server, gateway, stateful
let statefulOut = ''
const fixture = async (env) => {
  const child = spawn(process.execPath, [path.join(HERE, 'fixtures/bearer-mcp-server.mjs')], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((resolve) => child.stdout.once('data', resolve))
  return child
}
test.before(async () => {
  server = await fixture({ PROBE_TOKEN: TOKEN, PROBE_PORT: String(PORT) })
  gateway = await fixture({ PROBE_TOKEN: ROLE_KEY, PROBE_PORT: String(GATEWAY_PORT), PROBE_HEADER: 'x-agw-key' })
  stateful = await fixture({ PROBE_TOKEN: TOKEN, PROBE_PORT: String(STATEFUL_PORT), PROBE_STATEFUL: '1' })
  stateful.stdout.on('data', (c) => { statefulOut += c })
})
test.after(() => { for (const child of [server, gateway, stateful]) child?.kill('SIGTERM') })

const BRIDGE = path.join(HERE, '../src/main/mcpStdioBridgeMain.ts')
const bridge = (authorization, extra = {}) => new StdioClientTransport({
  command: process.execPath,
  args: ['--experimental-strip-types', BRIDGE],
  env: { PATH: process.env.PATH, FABRIC_BRIDGE_URL: `http://127.0.0.1:${PORT}/mcp`, FABRIC_BRIDGE_AUTHORIZATION: authorization, ...extra },
  stderr: 'pipe'
})

test('an MCP client on the bridge reaches the surface\'s tools with the session bearer', async () => {
  const transport = bridge('Bearer ' + TOKEN)
  const client = new Client({ name: 'agent-under-test', version: '0.0.0' })
  await client.connect(transport)
  const tools = await client.listTools()
  assert.deepEqual(tools.tools.map((t) => t.name), ['fabric_whoami'])
  const called = await client.callTool({ name: 'fabric_whoami', arguments: {} })
  assert.equal(called.content[0].text, 'probe')
  await client.close()
})

test('a wrong bearer reaches nothing: the surface\'s refusal is the bridge\'s answer', async () => {
  const client = new Client({ name: 'agent-under-test', version: '0.0.0' })
  await assert.rejects(() => client.connect(bridge('Bearer revoked')))
  await client.close().catch(() => {})
})

test('the bridge refuses to start without its environment, and takes no credential argument', async () => {
  const child = spawn(process.execPath, ['--experimental-strip-types', path.join(HERE, '../src/main/mcpStdioBridgeMain.ts')], { env: { PATH: process.env.PATH }, stdio: ['pipe', 'pipe', 'pipe'] })
  let err = ''
  child.stderr.on('data', (c) => { err += c })
  const code = await new Promise((resolve) => child.on('exit', resolve))
  assert.equal(code, 2)
  assert.match(err, /FABRIC_BRIDGE_URL and FABRIC_BRIDGE_AUTHORIZATION are required/)
})
// Audit 2026-10-05 A6-007: a failed relay is that request's error; only a refused credential ends the bridge.
test('a surface error answers that request and keeps the bridge; a 401 closes it', async () => {
  const { relay } = await import('../src/main/mcpStdioBridge.ts')
  const end = () => {
    const sent = []
    let closed = false
    return { sent, closed: () => closed, t: { start: async () => {}, close: async () => { closed = true }, send: async (m) => { sent.push(m) } } }
  }
  const agent = end(), surface = end()
  let failWith = { code: 500, message: 'Streamable HTTP error: 500' }
  surface.t.send = async (m) => { if (failWith) throw Object.assign(new Error(failWith.message), { code: failWith.code }); surface.sent.push(m) }
  const finished = relay({ agent: agent.t, surface: surface.t })
  await new Promise((r) => setTimeout(r, 10))
  agent.t.onmessage({ jsonrpc: '2.0', id: 7, method: 'tools/list' })
  await new Promise((r) => setTimeout(r, 10))
  assert.deepEqual(agent.sent, [{ jsonrpc: '2.0', id: 7, error: { code: -32603, message: "Fabric's surface did not take this request: Streamable HTTP error: 500" } }])
  assert.equal(agent.closed(), false, 'one 5xx does not end the bridge')
  failWith = null
  agent.t.onmessage({ jsonrpc: '2.0', id: 8, method: 'tools/list' })
  await new Promise((r) => setTimeout(r, 10))
  assert.equal(surface.sent.length, 1, 'the next request goes through')
  failWith = { code: 401, message: 'Streamable HTTP error: 401' }
  agent.t.onmessage({ jsonrpc: '2.0', id: 9, method: 'tools/list' })
  await finished
  assert.equal(agent.closed() && surface.closed(), true, 'a refused credential ends both sides')
})

// Audit 2026-10-06 DA-2: an agent without HTTP MCP reaches the project's granted servers through a bridge
// of its own per server, carrying the gateway's role key in the header the gateway reads.
test('a bridge for a granted server presents its credential in the header it is told, and reaches that server', async () => {
  const client = new Client({ name: 'agent-under-test', version: '0.0.0' })
  await client.connect(bridge(ROLE_KEY, { FABRIC_BRIDGE_URL: `http://127.0.0.1:${GATEWAY_PORT}/mcp`, FABRIC_BRIDGE_HEADER: 'x-agw-key' }))
  assert.deepEqual((await client.listTools()).tools.map((t) => t.name), ['fabric_whoami'])
  await client.close()
  const refused = new Client({ name: 'agent-under-test', version: '0.0.0' })
  await assert.rejects(() => refused.connect(bridge(ROLE_KEY, { FABRIC_BRIDGE_URL: `http://127.0.0.1:${GATEWAY_PORT}/mcp` })), 'the same key as a bearer is not the gateway\'s header')
  await refused.close().catch(() => {})
})

test('a header name that is not one refuses the bridge before any request', async () => {
  const child = spawn(process.execPath, ['--experimental-strip-types', BRIDGE], { env: { PATH: process.env.PATH, FABRIC_BRIDGE_URL: `http://127.0.0.1:${GATEWAY_PORT}/mcp`, FABRIC_BRIDGE_AUTHORIZATION: ROLE_KEY, FABRIC_BRIDGE_HEADER: 'x-agw-key: injected\r\nx' }, stdio: ['pipe', 'pipe', 'pipe'] })
  let err = ''
  child.stderr.on('data', (c) => { err += c })
  assert.equal(await new Promise((resolve) => child.on('exit', resolve)), 2)
  assert.match(err, /FABRIC_BRIDGE_HEADER is not a header name/)
})

// Audit 2026-10-06 DA-7 / ER-7: A6-029 — the agent closing the bridge's stdin ends the HTTP session
// (`DELETE` with its session id) and the bridge exits. No test reached that line before.
test('the agent closing the bridge\'s input ends the HTTP session and the bridge', async () => {
  const child = spawn(process.execPath, ['--experimental-strip-types', BRIDGE], { env: { PATH: process.env.PATH, FABRIC_BRIDGE_URL: `http://127.0.0.1:${STATEFUL_PORT}/mcp`, FABRIC_BRIDGE_AUTHORIZATION: 'Bearer ' + TOKEN }, stdio: ['pipe', 'pipe', 'pipe'] })
  let out = '', err = ''
  child.stdout.on('data', (c) => { out += c }); child.stderr.on('data', (c) => { err += c })
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)))
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'agent-under-test', version: '0' } } }) + '\n')
  for (let i = 0; i < 200 && !out.includes('"id":1'); i++) await new Promise((r) => setTimeout(r, 25))
  assert.match(out, /"id":1,"result"/, 'the session opened through the bridge: ' + err)
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
  await new Promise((r) => setTimeout(r, 100))
  const started = Date.now()
  child.stdin.end()
  const outcome = await Promise.race([exited, new Promise((r) => setTimeout(() => r('still running'), 5000))])
  if (outcome === 'still running') child.kill('SIGKILL')
  assert.equal(outcome, 0, 'the bridge exits when its input ends: ' + err)
  assert.ok(Date.now() - started < 5000)
  for (let i = 0; i < 40 && !statefulOut.includes('DELETE '); i++) await new Promise((r) => setTimeout(r, 25))
  assert.match(statefulOut, /DELETE [0-9a-f-]{36}/, 'the surface saw its MCP session ended')
  assert.match(err, /the agent closed the bridge/)
})
// #endregion mcp-stdio-bridge
