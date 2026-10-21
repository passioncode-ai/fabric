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
import { homedir } from 'node:os'
import { FabricMcpProxy, RUNTIME_SESSION_ID, leaveOnExit, agentPidOf, claudePidOfSession, claudeSessionOfPid, claudeSessionsDir, runtimeSessionIdOf } from './fabricMcp.ts'
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
// Codex and Kimi Code give their MCP servers no session id (measured; runtimeSessionIdOf says how), so their sessions
// enroll without one and cannot be rejoined until a CLI supplies it.
const rejoinOnly = process.argv.includes('--rejoin-only')
const runtimeSessionId = runtimeSessionIdOf(runner, process.argv, process.env)
if (rejoinOnly && (!runtimeSessionId || !RUNTIME_SESSION_ID.test(runtimeSessionId))) {
  say('fabric-mcp: --rejoin-only needs --runtime-session-id <the coding agent\'s session id>')
  process.exit(2)
}

// #region fabric-mcp-agent-process — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
// TR-1: the agent's process is what a `/clear` does not change. The agent's own fabric-mcp is its child (the bin script
// execs), so its parent pid names the agent; a rejoin, started by the hooks' detached worker, finds the agent's pid in
// Claude Code's session files by the runtime id it was given. The agent's own fabric-mcp also reads, at each
// enrollment, the id its agent has now (its session file), so an enrollment after a /clear names the new id.
const sessionsDir = claudeSessionsDir(process.env, homedir())
const agentPid = runner !== 'claude-code'
  ? (rejoinOnly ? null : agentPidOf(process.ppid))
  : rejoinOnly ? (runtimeSessionId ? claudePidOfSession(sessionsDir, runtimeSessionId) : null) : agentPidOf(process.ppid)
const currentRuntimeSessionId = runner === 'claude-code' && !rejoinOnly && agentPid
  ? () => claudeSessionOfPid(sessionsDir, agentPid)
  : undefined
// #endregion fabric-mcp-agent-process

const root = registryDirs().root
const proxy = new FabricMcpProxy({
  runner,
  cwd: process.cwd(),
  runtimeSessionId,
  rejoinOnly,
  agentPid,
  ...(currentRuntimeSessionId ? { currentRuntimeSessionId } : {}),
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
// TR-11: a rejoin that found no session ends at once (exit 3), so the hook's worker is not held to its deadline.
proxy.onFinal = (state) => {
  say(`fabric-mcp: ${state.kind}; this rejoin ends`)
  process.exitCode = 3
  setImmediate(() => process.exit(3))
}

const stop = { stopped: false }
// ER-2 (i2): stdin's end AND a signal leave the session (the DELETE), bounded, before the process exits.
leaveOnExit({ proc: process, stop, leave: () => proxy.close(), exit: (code) => process.exit(code), log: say })
await server.connect(new StdioServerTransport())
void proxy.run(stop)
// #endregion fabric-mcp-main
