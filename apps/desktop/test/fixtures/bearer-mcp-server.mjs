// Fixture: streamable-HTTP MCP that answers 401 unless the credential matches PROBE_TOKEN (P-10 probes and tests).
// PROBE_HEADER names the header the credential arrives in, as a gateway's `x-agw-key` (the value is then
// PROBE_TOKEN itself); without it, `Authorization: Bearer <PROBE_TOKEN>`. PROBE_STATEFUL=1 keeps MCP
// sessions (a session id per client) and prints `DELETE <session id>` when a client ends its session.
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
const token = process.env.PROBE_TOKEN, port = Number(process.env.PROBE_PORT)
const header = (process.env.PROBE_HEADER ?? 'authorization').toLowerCase()
const expected = process.env.PROBE_HEADER ? token : 'Bearer ' + token
const stateful = process.env.PROBE_STATEFUL === '1'
const sessions = new Map()
let refused = 0, served = 0
const serverFor = () => {
  const server = new McpServer({ name: 'fabric-probe', version: '0.0.0' })
  server.registerTool('fabric_whoami', { description: 'probe tool' }, async () => ({ content: [{ type: 'text', text: 'probe' }] }))
  return server
}
const http = createServer(async (req, res) => {
  if (req.headers[header] !== expected) { refused++; res.writeHead(401).end(); return }
  served++
  let body = ''
  req.on('data', (c) => { body += c })
  await new Promise((resolve) => req.on('end', resolve))
  const parsed = body ? JSON.parse(body) : undefined
  if (!stateful) {
    const server = serverFor()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => { transport.close(); server.close() })
    await server.connect(transport)
    return transport.handleRequest(req, res, parsed)
  }
  const sid = req.headers['mcp-session-id']
  if (req.method === 'DELETE' && sid) console.log('DELETE ' + sid)
  let transport = sid ? sessions.get(sid) : undefined
  if (!transport) {
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID, onsessioninitialized: (id) => sessions.set(id, transport) })
    await serverFor().connect(transport)
  }
  return transport.handleRequest(req, res, parsed)
})
http.listen(port, '127.0.0.1', () => console.log('listening'))
process.on('SIGTERM', () => { console.log(JSON.stringify({ refused, served })); process.exit(0) })
