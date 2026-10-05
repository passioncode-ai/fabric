// Fixture: streamable-HTTP MCP that answers 401 unless the bearer matches PROBE_TOKEN (P-10 probes and tests).
import { createServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
const token = process.env.PROBE_TOKEN, port = Number(process.env.PROBE_PORT)
let refused = 0, served = 0
const http = createServer(async (req, res) => {
  if (req.headers.authorization !== 'Bearer ' + token) { refused++; res.writeHead(401).end(); return }
  served++
  const server = new McpServer({ name: 'fabric-probe', version: '0.0.0' })
  server.registerTool('fabric_whoami', { description: 'probe tool' }, async () => ({ content: [{ type: 'text', text: 'probe' }] }))
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => { transport.close(); server.close() })
  await server.connect(transport)
  let body = ''; req.on('data', c => body += c); req.on('end', () => transport.handleRequest(req, res, body ? JSON.parse(body) : undefined))
})
http.listen(port, '127.0.0.1', () => console.log('listening'))
process.on('SIGTERM', () => { console.log(JSON.stringify({ refused, served })); process.exit(0) })
