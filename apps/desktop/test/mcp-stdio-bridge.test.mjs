// P-10 AS-05 (ADR-0119 §2): Fabric's stdio bridge relays MCP to a bearer-checking HTTP surface, and the
// credential travels in the bridge's environment only.
// #region mcp-stdio-bridge — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#2-fabrics-surface-reaches-the-agent-per-session-never-through-its-own-config
import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const HERE = import.meta.dirname
const TOKEN = 'tok-bridge-credential'
const PORT = 47000 + Math.floor(Math.random() * 900)
let server
test.before(async () => {
  server = spawn(process.execPath, [path.join(HERE, 'fixtures/bearer-mcp-server.mjs')], { env: { ...process.env, PROBE_TOKEN: TOKEN, PROBE_PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] })
  await new Promise((resolve) => server.stdout.once('data', resolve))
})
test.after(() => server.kill('SIGTERM'))

const bridge = (authorization) => new StdioClientTransport({
  command: process.execPath,
  args: ['--experimental-strip-types', path.join(HERE, '../src/main/mcpStdioBridgeMain.ts')],
  env: { PATH: process.env.PATH, FABRIC_BRIDGE_URL: `http://127.0.0.1:${PORT}/mcp`, FABRIC_BRIDGE_AUTHORIZATION: authorization },
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
// #endregion mcp-stdio-bridge
