// #region hub-tools — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#verification-iteration-2-clarifications--2026-10-04
// The tools an EXTERNAL agent sees (ADR-0115 §1–§2, §5). What a principal may do is decided by which
// server it is given, not by checks inside a shared one: the door token's server has exactly three
// tools, a binding's has five, and neither has any `fabric_*` session tool — so a tool added to the
// session surface tomorrow is not reachable from outside by accident.
//
//   door token  → fabric.access.request, fabric.access.status, fabric.session.enroll (names the project only)
//   binding     → fabric.access.request (more, for its own agent), fabric.access.status,
//                 fabric.access.grants, agent.call, fabric.session.enroll (ADR-0134), fabric.board.join (ADR-0149 §4)
//
// WHICH PROCESS HOLDS THE PORT is not proven by the port. While Fabric is down, any program can listen on
// the hub's port and pose as it, so the descriptions below tell an agent what `hub.ts` says of hub.json:
// re-read it before sending a binding credential, and send only when its pid is alive (port squatting,
// security review of PR #7). The door token alone is worth little to a squatter; a binding credential is not.
// And the origin is used EXACTLY as hub.json writes it (`http://127.0.0.1:<port>`): a `localhost` that
// resolves to another loopback address could reach another program (ER-8, verification iteration 1 for 0.3.1).
const VERIFY_HUB =
  ' Connect to the origin exactly as hub.json writes it (http://127.0.0.1:<port>), never through localhost or another name. Before you send a binding credential, re-read hub.json and check that the pid it names is alive (and is Fabric); if it is not, Fabric is not running — do not send the credential to whatever answers on that port.'

// Every answer carries `structuredContent`, and a refusal is `isError: true` with
// `{error: {code, message, data?}}` — the `fabric-interop/0.1` error shape — never a thrown 500.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { AGENT_ID_PATTERN, CAPABILITY_PATTERN, FABRIC_SELF, PROJECT_RESOLVE, PROJECTS_RESOURCE, SESSION_ENROLL } from '../shared/access.ts'
import type { AccessService, HubPrincipal } from './accessService.ts'
import type { BindingRow } from './accessStore.ts'
import { ops } from './opsSink.ts'
import type { EnrollAnswer } from './sessionEnroll.ts'
import { APP_VERSION } from '../shared/appVersion.ts'

export interface ToolAnswer {
  [key: string]: unknown
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export function answer(value: Record<string, unknown>, isError = false): ToolAnswer {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value, ...(isError ? { isError: true } : {}) }
}

export function refusal(code: string, message: string, data?: Record<string, unknown>): ToolAnswer {
  return answer({ error: { code, message, ...(data ? { data } : {}) } }, true)
}

export interface AgentCallArgs {
  agentId: string
  capability: string
  input: Record<string, unknown>
  idempotencyKey?: string
}

export interface HubToolDeps {
  access: AccessService
  /** `agent.call` itself (S4). Absent, the tool refuses rather than pretending to route. */
  call?: (binding: BindingRow, args: AgentCallArgs, meta: Record<string, unknown> | undefined, signal?: AbortSignal) => Promise<ToolAnswer>
  /** `fabric.session.enroll` (ADR-0134). Absent, the tool refuses: this Fabric admits no coding agent from outside. */
  enroll?: (binding: BindingRow | null, args: { cwd: string; runtimeSessionId?: string; rejoinOnly?: boolean; agentPid?: number }) => Promise<EnrollAnswer>
  /** `fabric.board.join` (ADR-0149 §4). Absent, the tool refuses: this Fabric gives no board sessions. */
  /** `fabric.project.resolve` (F9, DEC-0089): the contract's answer for one folder. Absent, the tool refuses. */
  resolveProject?: (path: string) => Promise<Record<string, unknown>>
  joinBoard?: (binding: BindingRow, args: { projectId: string }) => Promise<
    | { ok: true; session: { bearer: string; sessionId: string; projectId: string; capabilities: string[] } }
    | { ok: false; code: string; message: string }>
}

/** The tool names each principal is given — written down so a test can compare it with what is served. */
export const HUB_TOOLS = {
  door: ['fabric.access.request', 'fabric.access.status', 'fabric.session.enroll'],
  binding: ['agent.call', 'fabric.access.grants', 'fabric.access.request', 'fabric.access.status', 'fabric.board.join', 'fabric.project.resolve', 'fabric.session.enroll']
} as const

const requestSchema = z
  .object({
    agentId: z.string().regex(AGENT_ID_PATTERN).describe('Your registry id: a provider id, or a service id with an optional .instance'),
    callee: z.string().min(1).max(63).describe('The product you want to reach through Fabric, e.g. fabric-inbox'),
    capabilities: z.array(z.string().regex(CAPABILITY_PATTERN)).min(1).max(32).describe('The product tools you will call, e.g. read_message'),
    resources: z.array(z.string().min(1).max(400)).min(1).max(64).describe('The mailboxes they are for: cloudflare:<address> or gmail:<id>'),
    reason: z.string().min(1).max(1000).describe('Why, in a sentence or two. The operator reads it as your claim.'),
    // ADR-0134 amendment 2: Fabric resolves this folder itself and shows the operator its own reading of it.
    folder: z.string().min(1).max(4096).optional().describe('For callee fabric (session.enroll) only: the absolute folder you run in. Fabric resolves it itself, refuses it when it belongs to another project than the one you ask for, and shows the operator the project folder it matched.')
  })
  .strict()

// The poll secret (ER-2, RFC 8628's device_code): returned only by the answer that CREATED a request, and
// required to read it through the door, whose token every agent on this Mac shares.
const POLL_SECRET_TEXT = 'The pollSecret from the fabric.access.request answer that created this request (shown there only)'
const doorStatusSchema = z.object({ requestId: z.string().min(1).max(64), pollSecret: z.string().regex(/^[A-Za-z0-9_-]{43}$/).describe(POLL_SECRET_TEXT) }).strict()
const bindingStatusSchema = z.object({ requestId: z.string().min(1).max(64), pollSecret: z.string().max(64).optional().describe(`${POLL_SECRET_TEXT}; not needed with a binding credential`) }).strict()

// ER-1 (verification iteration 2 for 0.3.1): the text told an agent that gave up on a call to retry it
// with the same key, and the hub forgot exactly those keys — so the retry sent twice. Now a key whose call
// may have run is refused for good, and nothing here advises sending such a call again.
const IDEMPOTENCY_TEXT =
  'Your own id for this call. Sent again with the same arguments, the same key returns the first answer and sends nothing (while your grant still covers the call and the product is connected); the same key with other arguments is refused. If a call may have reached the product without an answer (a timeout, a cancel, a lost connection), the answer is outcome-unknown, and every later call with that key is refused outcome-unknown: it may have run, so Fabric never sends it again — and a new key would act twice. Check its effect with the product\'s own read tools (for mail, get_send_status) before you act again. Fabric retains up to 256 keys per binding and refuses fresh keys when full; answered keys expire after 24 hours, uncertain keys remain for this process lifetime. hub.json\'s startedAt and pid are observational restart markers, not agent identity or authority; a key from before a restart is unknown to Fabric, so reconcile its effect before retrying.'

const callSchema = z
  .object({
    agentId: z.string().regex(AGENT_ID_PATTERN).describe('The callee: a connected product, e.g. fabric-inbox'),
    capability: z.string().regex(CAPABILITY_PATTERN).describe('The product tool to call'),
    input: z.record(z.string(), z.unknown()).describe('The tool arguments, exactly as the product takes them'),
    idempotencyKey: z.string().min(1).max(256).optional().describe(IDEMPOTENCY_TEXT)
  })
  .strict()

export function hubServerFor(principal: HubPrincipal, deps: HubToolDeps): McpServer {
  const server = new McpServer({ name: 'fabric-hub', version: APP_VERSION })
  const guard = async (op: string, fn: () => Promise<ToolAnswer>): Promise<ToolAnswer> => {
    try {
      return await fn()
    } catch (e) {
      // A failure Fabric could not get past is said as one: a refusal, never a silent empty answer and
      // never a grant assumed. Its cause goes to the operations log only — a store error's text is not
      // the agent's to read (ER-11, verification iteration 1 for 0.3.1).
      ops.failed(`hub.${op}`, e, { principal: principal.kind })
      return refusal('hub-unavailable', 'Fabric could not complete this just now; nothing was decided or sent. Try again later; the operator can see why in Fabric\'s operations log.')
    }
  }

  server.registerTool(
    'fabric.access.request',
    {
      title: 'Ask the operator for access',
      description:
        principal.kind === 'door'
          ? 'Ask, once, for standing access to a product through Fabric. The operator sees one prompt naming you as the registry knows you, what you ask in the product\'s words and your reason. On the operator\'s own machine two asks of Fabric itself are allowed at once and recorded as your act instead: session.enroll (a coding agent working in a project) and project.resolve on the resource projects (read which Fabric project a folder belongs to; a registered service or a coding agent). Other products still prompt. The answer that creates the request carries a pollSecret, shown only there: poll fabric.access.status with the requestId and that pollSecret; on Allow its first answer carries your credential, once. Asking the same thing again while it waits returns the same requestId and no pollSecret.' + VERIFY_HUB
          : 'Ask for more access for your own agent (a new capability or mailbox). The operator is prompted again, except for the two asks of Fabric itself allowed at once on the operator\'s own machine (session.enroll and project.resolve on projects); on Allow the grants are added to the credential you already hold.' + VERIFY_HUB,
      inputSchema: requestSchema
    },
    async (args) =>
      guard('access.request', async () => {
        const r = await deps.access.request(principal, args as Record<string, unknown>)
        return r.ok
          ? answer({ requestId: r.requestId, status: r.status, expiresAt: r.expiresAt, ...(r.pollSecret ? { pollSecret: r.pollSecret } : {}), note: r.note })
          : refusal('refused', r.refused)
      })
  )

  server.registerTool(
    'fabric.access.status',
    {
      title: 'Read an access request',
      description:
        'pending, allowed, denied or expired. Through the door, send the requestId with the pollSecret of the answer that created it; a wrong or missing pollSecret reads as an unknown request. The first read after Allow carries the binding credential exactly once, and only within 10 minutes of the decision; store it in your vault.' + VERIFY_HUB,
      inputSchema: principal.kind === 'door' ? doorStatusSchema : bindingStatusSchema
    },
    async (args: Record<string, unknown>, extra: unknown) =>
      guard('access.status', async () => {
        const { requestId, pollSecret } = args as { requestId: string; pollSecret?: string }
        const r = await deps.access.status(principal, requestId, pollSecret, (extra as { signal?: AbortSignal } | undefined)?.signal)
        if (!r.ok) return refusal('unknown-request', r.refused)
        const { ok: _ok, ...rest } = r
        return answer(rest as Record<string, unknown>)
      })
  )

  // #region hub-session-enroll — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
  server.registerTool(
    'fabric.session.enroll',
    {
      title: 'Work in the project of this folder',
      description:
        'For a coding agent: name the absolute folder you run in. Through the door this names or proposes the project (needs-grant); an eligible unknown Git repository is admitted through the normal fabric.access.request path, never by this read alone. With a binding credential: when it holds the operator\'s session.enroll grant on the project, the answer carries a one-session bearer — use it as a session Fabric started would (Authorization: Bearer, then call fabric_whoami first); it is spent by one MCP initialize. needs-grant names the resource to ask for with fabric.access.request (callee fabric, capability session.enroll, and this same folder as folder); no-project says the folder is non-Git, broad, detached or ambiguous and was not automatically registered.' + VERIFY_HUB,
      inputSchema: z.object({
        cwd: z.string().min(1).max(4096),
        runtimeSessionId: z.string().min(1).max(128).optional(),
        rejoinOnly: z.boolean().optional().describe('With runtimeSessionId: join the live session that coding-agent session already holds here, or be told there is none (no-session) — never ask the operator, never start a session'),
        agentPid: z.number().int().min(2).max(2 ** 31 - 1).optional().describe('The coding agent\'s process id. At enrollment: the agent this fabric-mcp serves. With rejoinOnly: the process the runtime session id belongs to now, so a session whose runtime id changed (/clear) is still found')
      }).strict()
    },
    async (args) =>
      guard('session.enroll', async () => {
        if (!deps.enroll) return refusal('hub-unavailable', 'this Fabric admits no coding agent from outside')
        const r = await deps.enroll(principal.kind === 'binding' ? principal.binding : null, args as { cwd: string; runtimeSessionId?: string; rejoinOnly?: boolean; agentPid?: number })
        return r.ok ? answer({ session: r.session }) : refusal(r.code, r.message, r.code === 'needs-grant' ? { projectId: r.projectId, projectName: r.projectName, resource: r.resource } : undefined)
      })
  )
  // #endregion hub-session-enroll

  if (principal.kind === 'binding') {
    const binding = principal.binding
    server.registerTool(
      'fabric.access.grants',
      {
        title: 'What this credential may do',
        description: 'Your live grants: each a product tool on one mailbox, with its expiry. Revoked or expired grants are not listed.',
        inputSchema: z.object({}).strict()
      },
      async () =>
        guard('access.grants', async () => {
          const grants = await deps.access.liveGrantsOf(binding)
          return answer({
            agentId: binding.agent_id,
            grants: grants.map((g) => ({ callee: g.callee, capability: g.capability, resource: g.resource, expiresAt: g.expires_at }))
          })
        })
    )


    // #region hub-board-join — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#4-service-agents-join-with-a-board-session
    server.registerTool(
      'fabric.board.join',
      {
        title: 'Take part in a Project\'s board',
        description:
          'For a service agent that answers a Project\'s requests (fabric-project-comms/0.1): with a live board.respond grant on that Project (ask with fabric.access.request, callee fabric, capability board.respond, resource board:<project id>/<capability>), the answer carries a board session — a one-session bearer whose MCP server has the com.* tools and nothing else — and the capabilities you may answer. ' +
          'Use it as Authorization: Bearer against this hub; it is spent by one MCP initialize, and revoking any of those grants ends it. Without a grant the answer is not_authorized.' + VERIFY_HUB,
        inputSchema: z.object({ projectId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) }).strict()
      },
      async (args) =>
        guard('board.join', async () => {
          if (!deps.joinBoard) return refusal('hub-unavailable', 'this Fabric gives no board sessions')
          const r = await deps.joinBoard(binding, { projectId: (args as { projectId: string }).projectId.toLowerCase() })
          return r.ok ? answer({ session: r.session }) : refusal(r.code, r.message)
        })
    )
    // #endregion hub-board-join

    // #region hub-project-resolve — docs: docs/adr/0166-one-attribution-of-folders-to-projects-across-fabric-switchboard-and-observatory.md#decision
    server.registerTool(
      'fabric.project.resolve',
      {
        title: 'Which Project a folder belongs to',
        description:
          'Folder attribution (fabric-agent-contract DEC-0089 and DEC-0092, folder-attribution.schema.json $defs/resolveAnswer) for one absolute folder on this computer, decided by the contract\'s own rules over what Fabric knows: the Projects\' folders with their Git facts, the folders a person detached, the temporary roots. ' +
          'The answer is {outcome: "attached", project, rule}, {outcome: "new", root}, {outcome: "refused", reason}, {outcome: "ambiguous", rule, projects} or {fault: "input-invalid"} (also for a relative path); project ids are Fabric\'s. ' +
          'While a Git probe the answer needs failed or timed out (which is not "no Git") it is {outcome: "pending", reason: "git-unreadable", retryable: true}: no Project is named; attribute nothing, ask again later with backoff, and show a lasting pending as degraded. It reads only and records nothing. It needs a live grant: project.resolve on the resource projects (ask fabric.access.request with callee fabric, capabilities ["project.resolve"], resources ["projects"] and a reason; allowed at once for a registered service or a coding agent on the operator\'s own machine), or session.enroll for a coding agent working in a project; without one the answer is access-required.' + VERIFY_HUB,
        inputSchema: z.object({ path: z.string().min(1).max(4096).describe('The absolute folder, as the coding agent runs in it') }).strict()
      },
      async (args) =>
        guard('project.resolve', async () => {
          if (!deps.resolveProject) return refusal('hub-unavailable', 'this Fabric does not resolve folders')
          // 0.3.8 review i2 ER-1: a binding resolves folders while it holds a live grant to: project.resolve (a
          // product's ask), or session.enroll (a coding agent working in a project). Revoking either in Settings
          // ends it, as the card says.
          const grants = await deps.access.liveGrantsOf(binding)
          if (!grants.some((g) => g.callee === FABRIC_SELF && (g.capability === PROJECT_RESOLVE || g.capability === SESSION_ENROLL)))
            return refusal('access-required', 'this credential holds no grant to read folder attribution; ask for it with fabric.access.request',
              { request: { callee: FABRIC_SELF, capabilities: [PROJECT_RESOLVE], resources: [PROJECTS_RESOURCE] } })
          return answer(await deps.resolveProject((args as { path: string }).path))
        })
    )
    // #endregion hub-project-resolve

    server.registerTool(
      'agent.call',
      {
        title: 'Call a connected product through Fabric',
        description:
          'fabric-interop/0.1 C3.5. Fabric checks your grant, narrows the call to the mailboxes you were granted, forwards it with the product\'s own credential (which you never see) and journals the hop. The answer is the interop result envelope, the product\'s output in `output` (isError when the product answered with an error); a refusal is isError with {error: {code, message, data?}}. Without a grant the code is access-required, carrying the fabric.access.request arguments to ask with. Cancelling your request stops the call if it has not reached the product yet. A call that may have reached the product without an answer is outcome-unknown (data.mayHaveRun): do not send it again — not with the same idempotencyKey (refused) and not with a new one (it would act twice); check its effect with the product\'s read tools first.',
        inputSchema: callSchema
      },
      async (args, extra) =>
        guard('agent.call', async () => {
          if (!deps.call) return refusal('hub-unavailable', 'this hub forwards no calls yet')
          return deps.call(binding, args as AgentCallArgs, (extra as { _meta?: Record<string, unknown> })._meta, (extra as { signal?: AbortSignal }).signal)
        })
    )
  }
  return server
}
// #endregion hub-tools
