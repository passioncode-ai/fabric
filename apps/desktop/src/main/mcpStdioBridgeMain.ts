// Entry of Fabric's stdio bridge process (see mcpStdioBridge.ts). Reads FABRIC_BRIDGE_URL,
// FABRIC_BRIDGE_AUTHORIZATION and the optional FABRIC_BRIDGE_HEADER from its environment; prints
// nothing on stdout but MCP.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { relay } from './mcpStdioBridge.ts'

const url = process.env.FABRIC_BRIDGE_URL
const authorization = process.env.FABRIC_BRIDGE_AUTHORIZATION
// #region mcp-stdio-bridge-header — docs: docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md#2-fabrics-surface-reaches-the-agent-per-session-never-through-its-own-config
// The header the credential travels in: `Authorization` (the session bearer) for Fabric's surface, and
// `x-agw-key` (the hop's role key) for a project's granted server on the machine's gateway — one bridge
// per granted server for an agent without HTTP MCP (audit 2026-10-06 DA-2). A name, never a line: a
// value that is not a bare header token is refused before any request is made.
const header = process.env.FABRIC_BRIDGE_HEADER ?? 'Authorization'
// #endregion mcp-stdio-bridge-header
if (!url || !authorization) {
  process.stderr.write('fabric-bridge: FABRIC_BRIDGE_URL and FABRIC_BRIDGE_AUTHORIZATION are required\n')
  process.exit(2)
}
if (!/^[A-Za-z0-9-]{1,64}$/.test(header)) {
  process.stderr.write('fabric-bridge: FABRIC_BRIDGE_HEADER is not a header name\n')
  process.exit(2)
}
// The credential is read once and removed from the environment this process's children would inherit.
// The kernel's copy of the environment it was started with is not rewritten: `ps -E` by the same user
// still shows it, so this keeps it out of descendants, not out of reach of the user's own processes.
delete process.env.FABRIC_BRIDGE_AUTHORIZATION
delete process.env.FABRIC_BRIDGE_HEADER
const agent = new StdioServerTransport()
const surface = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { [header]: authorization } } })
// The SDK's stdio server transport does not report the agent closing its end (audit 2026-10-05 A6-029):
// the end of stdin is the agent leaving, so the HTTP session is ended and the bridge exits.
process.stdin.once('end', () => { void surface.terminateSession().catch(() => {}).finally(() => agent.close()) })
await relay({ agent, surface }, (line) => process.stderr.write(line + '\n'))
process.exit(0)
