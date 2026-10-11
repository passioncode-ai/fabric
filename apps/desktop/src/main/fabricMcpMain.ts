// #region fabric-mcp-main — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
// Entry of `fabric-mcp` (fabricMcp.ts): an MCP server on stdio for a coding agent, a client of Fabric's hub over
// streamable HTTP. Prints nothing on stdout but MCP. `--runner <id>` names the coding agent as Fabric's runner
// catalogue does (claude-code, codex, kilo, hermes, cline, kimi-code). The agent runs this in its own folder: that
// folder (the process's cwd) is what Fabric resolves to a project. No secret arrives on argv or in the environment.
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { AGENTS } from '../shared/agents.ts'
import { registryDirs } from './agentRegistry.ts'
import { locateHub, readHubDocument, writeAtomic } from './hub.ts'
import { FabricMcpProxy, type HubCall, type SessionLink } from './fabricMcp.ts'

const say = (line: string): void => { process.stderr.write(line + '\n') }
const at = process.argv.indexOf('--runner')
const runner = at >= 0 ? process.argv[at + 1] : undefined
if (!runner || !AGENTS.some((a) => a.id === runner && a.program)) {
  say(`fabric-mcp: --runner must name a coding agent Fabric knows: ${AGENTS.filter((a) => a.program).map((a) => a.id).join(', ')}`)
  process.exit(2)
}

const root = registryDirs().root
const credentialFile = path.join(root, 'enrollments', `${runner}.credential`)
const CREDENTIAL = /^[A-Za-z0-9_-]{43}$/
const status = (e: unknown): unknown => (e as { code?: unknown } | null)?.code

const client = async (url: string, bearer: string): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> => {
  const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${bearer}` } } })
  const c = new Client({ name: 'fabric-mcp', version: '0.4.0' })
  await c.connect(transport)
  return { client: c, transport }
}

const hubCall: HubCall = async (url, bearer, tool, args) => {
  let link: Awaited<ReturnType<typeof client>> | null = null
  try {
    link = await client(url, bearer)
    const r = (await link.client.callTool({ name: tool, arguments: args })) as { isError?: boolean; structuredContent?: Record<string, unknown> }
    return { isError: Boolean(r.isError), value: r.structuredContent ?? {} }
  } catch (e) {
    if (status(e) === 401 || status(e) === 403) return { unauthorized: true }
    throw e
  } finally {
    await link?.client.close().catch(() => {})
  }
}

const proxy = new FabricMcpProxy({
  runner,
  cwd: process.cwd(),
  locate: () => locateHub(root),
  readCredential: () => {
    try {
      const text = readHubDocument(credentialFile)?.trim() ?? null
      return text && CREDENTIAL.test(text) ? text : null
    } catch {
      // No credential file (or an unreadable one) is the ordinary first run: the proxy asks through the door.
      return null
    }
  },
  writeCredential: (credential) => {
    mkdirSync(path.dirname(credentialFile), { recursive: true, mode: 0o700 })
    writeAtomic(credentialFile, credential)
  },
  forgetCredential: () => rmSync(credentialFile, { force: true }),
  hubCall,
  openSession: async (url, bearer): Promise<SessionLink> => {
    const { client: c, transport } = await client(url, bearer)
    const link: SessionLink = {
      listTools: async () => (await c.listTools()).tools,
      callTool: async (name, args) => (await c.callTool({ name, arguments: args })) as Record<string, unknown>,
      close: () => c.close()
    }
    transport.onclose = () => link.onclose?.()
    return link
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  log: say
})

const server = new Server(
  { name: 'fabric', version: '0.4.0' },
  {
    capabilities: { tools: { listChanged: true } },
    instructions: 'Fabric is the harness for this project: call fabric_whoami before anything else; it returns the project, its context, the task and the rules of this session.'
  }
)
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: (await proxy.tools()) as never }))
server.setRequestHandler(CallToolRequestSchema, async (req) => (await proxy.call(req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>)) as never)
proxy.onToolsChanged = () => { void server.sendToolListChanged().catch(() => {}) }

const stop = { stopped: false }
process.stdin.once('end', () => {
  stop.stopped = true
  void proxy.close().finally(() => process.exit(0))
})
await server.connect(new StdioServerTransport())
void proxy.run(stop)
// #endregion fabric-mcp-main
