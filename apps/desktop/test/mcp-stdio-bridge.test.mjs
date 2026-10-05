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
// #endregion mcp-stdio-bridge
