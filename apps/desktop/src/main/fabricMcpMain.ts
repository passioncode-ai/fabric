// #region fabric-mcp-main — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
// Entry of `fabric-mcp` (fabricMcp.ts): an MCP server on stdio for a coding agent, a client of Fabric's hub over
// streamable HTTP (fabricMcpClient.ts). Prints nothing on stdout but MCP. `--runner <id>` names the coding agent as
// Fabric's runner catalogue does (claude-code, codex, kilo, hermes, cline, kimi-code). The agent runs this in its own
// folder: that folder (the process's cwd) is what Fabric resolves to a project. No secret arrives on argv or in the
// environment.
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { AGENTS } from '../shared/agents.ts'
import { registryDirs } from './agentRegistry.ts'
import { locateHub } from './hub.ts'
import { FabricMcpProxy, RUNTIME_SESSION_ID } from './fabricMcp.ts'
import { fileCredentialStore, makeHubCall, openSessionLink } from './fabricMcpClient.ts'
import { APP_VERSION } from '../shared/appVersion.ts'

const say = (line: string): void => { process.stderr.write(line + '\n') }
const at = process.argv.indexOf('--runner')
const runner = at >= 0 ? process.argv[at + 1] : undefined
if (!runner || !AGENTS.some((a) => a.id === runner && a.program)) {
  say(`fabric-mcp: --runner must name a coding agent Fabric knows: ${AGENTS.filter((a) => a.program).map((a) => a.id).join(', ')}`)
  process.exit(2)
}

// D1: Claude Code gives the MCP servers it starts its own session id (CLAUDE_CODE_SESSION_ID); Fabric keeps it with the
// enrollment, so the session hooks can name that session. D2: `--rejoin-only --runtime-session-id <id>` joins it.
const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const rejoinOnly = process.argv.includes('--rejoin-only')
const runtimeSessionId = flag('--runtime-session-id') ?? (runner === 'claude-code' ? process.env.CLAUDE_CODE_SESSION_ID : undefined) ?? null
if (rejoinOnly && (!runtimeSessionId || !RUNTIME_SESSION_ID.test(runtimeSessionId))) {
  say('fabric-mcp: --rejoin-only needs --runtime-session-id <the coding agent\'s session id>')
  process.exit(2)
}

const root = registryDirs().root
const proxy = new FabricMcpProxy({
  runner,
  cwd: process.cwd(),
  runtimeSessionId,
  rejoinOnly,
  locate: () => locateHub(root),
  store: fileCredentialStore(root, runner),
  hubCall: makeHubCall(),
  openSession: (url, bearer) => openSessionLink(url, bearer),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  log: say
})

const server = new Server(
  { name: 'fabric', version: APP_VERSION },
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
