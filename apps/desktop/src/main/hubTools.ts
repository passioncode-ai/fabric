// #region hub-tools — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#verification-iteration-2-clarifications--2026-10-04
// The tools an EXTERNAL agent sees (ADR-0115 §1–§2, §5). What a principal may do is decided by which
// server it is given, not by checks inside a shared one: the door token's server has exactly two
// tools, a binding's has four, and neither has any `fabric_*` session tool — so a tool added to the
// session surface tomorrow is not reachable from outside by accident.
//
//   door token  → fabric.access.request, fabric.access.status
//   binding     → fabric.access.request (more, for its own agent), fabric.access.status,
//                 fabric.access.grants, agent.call
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
import { AGENT_ID_PATTERN, CAPABILITY_PATTERN } from '../shared/access.ts'
import type { AccessService, HubPrincipal } from './accessService.ts'
import type { BindingRow } from './accessStore.ts'
import { ops } from './opsSink.ts'

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
}

/** The tool names each principal is given — written down so a test can compare it with what is served. */
export const HUB_TOOLS = {
  door: ['fabric.access.request', 'fabric.access.status'],
  binding: ['agent.call', 'fabric.access.grants', 'fabric.access.request', 'fabric.access.status']
} as const

const requestSchema = z
  .object({
    agentId: z.string().regex(AGENT_ID_PATTERN).describe('Your registry id: a provider id, or a service id with an optional .instance'),
    callee: z.string().min(1).max(63).describe('The product you want to reach through Fabric, e.g. fabric-inbox'),
    capabilities: z.array(z.string().regex(CAPABILITY_PATTERN)).min(1).max(32).describe('The product tools you will call, e.g. read_message'),
    resources: z.array(z.string().min(1).max(400)).min(1).max(64).describe('The mailboxes they are for: cloudflare:<address> or gmail:<id>'),
    reason: z.string().min(1).max(1000).describe('Why, in a sentence or two. The operator reads it as your claim.')
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
  const server = new McpServer({ name: 'fabric-hub', version: '0.1.0' })
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
          ? 'Ask, once, for standing access to a product through Fabric. The operator sees one prompt naming you as the registry knows you, what you ask in the product\'s words and your reason. The answer that creates the request carries a pollSecret, shown only there: poll fabric.access.status with the requestId and that pollSecret; on Allow its first answer carries your credential, once. Asking the same thing again while it waits returns the same requestId and no pollSecret.' + VERIFY_HUB
          : 'Ask for more access for your own agent (a new capability or mailbox). The operator is prompted again; on Allow the grants are added to the credential you already hold.' + VERIFY_HUB,
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
