// Fixture: a stdio MCP server standing in for Project Observatory's (`<engine>/mcp/server.py`). Its first start answers
// every call `stale-server`, as a server whose code an update replaced does (OBS-159); every later start answers.
// The file named by the first argument counts the starts; ALWAYS_STALE=1 in the second argument keeps every start stale.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
const [counter, mode] = process.argv.slice(2)
const starts = (existsSync(counter) ? Number(readFileSync(counter, 'utf8')) : 0) + 1
writeFileSync(counter, String(starts))
const stale = mode === 'always-stale' || starts === 1
const server = new McpServer({ name: 'observatory-stand-in', version: '0.0.0' })
server.registerTool('observatory_checkpoint_write', { description: 'stand-in' }, async () => stale
  ? { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'stale-server', detail: 'the installed release is 0.42.1; this server still runs 0.42.0.' }) }] }
  : { content: [{ type: 'text', text: JSON.stringify({ workflowId: 'wf_0123456789abcdef', start: starts }) }] })
await server.connect(new StdioServerTransport())
