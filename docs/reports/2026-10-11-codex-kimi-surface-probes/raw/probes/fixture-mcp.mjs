// Fixture MCP server (Streamable HTTP, JSON responses) for the Fabric surface probes.
// - requires Authorization: Bearer <EXPECTED_TOKEN> on every POST
// - serves one tool: probe_ping(message) -> echoes
// - appends every request (method, auth ok, rpc method) to LOG_FILE as JSONL
import http from 'node:http'
import fs from 'node:fs'

const PORT = Number(process.env.PORT || 47331)
const EXPECTED_TOKEN = process.env.EXPECTED_TOKEN || 'probe-token-123'
const LOG_FILE = process.env.LOG_FILE || '/tmp/fabric-probes/probe-requests.jsonl'

const log = (entry) => fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n')

const serverInfo = { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fabric-probe-fixture', version: '0.1.0' } }
const tools = [
  {
    name: 'probe_ping',
    description: 'Answers with pong and the message it got. Used to prove an agent can reach this server.',
    inputSchema: {
      type: 'object',
      properties: { message: { type: 'string', description: 'any string' } },
      required: ['message']
    }
  }
]

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url.startsWith('/mcp')) {
    res.writeHead(404).end()
    return
  }
  const auth = req.headers.authorization || ''
  const authOk = auth === `Bearer ${EXPECTED_TOKEN}`
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    let msg
    try {
      msg = JSON.parse(body)
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'bad json' }))
      return
    }
    const rpcMethod = msg.method || null
    log({ rpc: rpcMethod, id: msg.id ?? null, authHeader: auth ? 'present' : 'absent', authOk, params: msg.params ? Object.keys(msg.params) : [] })
    if (!authOk) {
      res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'unknown or revoked credential' }))
      return
    }
    const reply = (result) =>
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }))
    switch (rpcMethod) {
      case 'initialize':
        return reply(serverInfo)
      case 'notifications/initialized':
      case 'notifications/cancelled':
        res.writeHead(202).end()
        return
      case 'ping':
        return reply({})
      case 'tools/list':
        return reply({ tools })
      case 'tools/call': {
        const name = msg.params?.name
        const args = msg.params?.arguments || {}
        if (name !== 'probe_ping')
          return res
            .writeHead(200, { 'content-type': 'application/json' })
            .end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: `unknown tool ${name}` } }))
        return reply({ content: [{ type: 'text', text: `pong: ${args.message ?? ''}` }], isError: false })
      }
      default:
        return res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32601, message: `no such method ${rpcMethod}` } }))
    }
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`fixture mcp on http://127.0.0.1:${PORT}/mcp, token ${EXPECTED_TOKEN}, log ${LOG_FILE}`)
})
