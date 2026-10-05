// Entry of Fabric's stdio bridge process (see mcpStdioBridge.ts). Reads FABRIC_BRIDGE_URL and
// FABRIC_BRIDGE_AUTHORIZATION from its environment; prints nothing on stdout but MCP.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { relay } from './mcpStdioBridge.ts'

const url = process.env.FABRIC_BRIDGE_URL
const authorization = process.env.FABRIC_BRIDGE_AUTHORIZATION
if (!url || !authorization) {
  process.stderr.write('fabric-bridge: FABRIC_BRIDGE_URL and FABRIC_BRIDGE_AUTHORIZATION are required\n')
  process.exit(2)
}
// The credential is read once and removed from this process's environment.
delete process.env.FABRIC_BRIDGE_AUTHORIZATION
await relay({
  agent: new StdioServerTransport(),
  surface: new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: authorization } } })
}, (line) => process.stderr.write(line + '\n'))
process.exit(0)
