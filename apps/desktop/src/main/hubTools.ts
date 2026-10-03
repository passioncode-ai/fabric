// #region hub-tools — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#2-an-agent-is-admitted-by-device-style-consent-not-by-a-pasted-key
// The tools an EXTERNAL agent sees (ADR-0115 §1–§2, §5). What a principal may do is decided by which
// server it is given, not by checks inside a shared one: the door token's server has exactly two
// tools, a binding's has four, and neither has any `fabric_*` session tool — so a tool added to the
// session surface tomorrow is not reachable from outside by accident.
//
//   door token  → fabric.access.request, fabric.access.status
//   binding     → fabric.access.request (more, for its own agent), fabric.access.status,
//                 fabric.access.grants, agent.call
//
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
  call?: (binding: BindingRow, args: AgentCallArgs, meta: Record<string, unknown> | undefined) => Promise<ToolAnswer>
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

const statusSchema = z.object({ requestId: z.string().min(1).max(64) }).strict()

const callSchema = z
  .object({
    agentId: z.string().regex(AGENT_ID_PATTERN).describe('The callee: a connected product, e.g. fabric-inbox'),
    capability: z.string().regex(CAPABILITY_PATTERN).describe('The product tool to call'),
    input: z.record(z.string(), z.unknown()).describe('The tool arguments, exactly as the product takes them'),
    idempotencyKey: z.string().min(1).max(256).optional().describe('Your own id for this call; a retry with the same key returns the same answer')
  })
  .strict()

export function hubServerFor(principal: HubPrincipal, deps: HubToolDeps): McpServer {
  const server = new McpServer({ name: 'fabric-hub', version: '0.1.0' })
  const guard = async (op: string, fn: () => Promise<ToolAnswer>): Promise<ToolAnswer> => {
    try {
      return await fn()
    } catch (e) {
      // A failure Fabric could not get past is said as one: a refusal with its cause, never a
      // silent empty answer and never a grant assumed.
      ops.failed(`hub.${op}`, e, { principal: principal.kind })
      return refusal('hub-unavailable', `Fabric could not complete this: ${(e as Error).message}`)
    }
  }

  server.registerTool(
    'fabric.access.request',
    {
      title: 'Ask the operator for access',
      description:
        principal.kind === 'door'
          ? 'Ask, once, for standing access to a product through Fabric. The operator sees one prompt naming you as the registry knows you, what you ask in the product\'s words and your reason. Poll fabric.access.status; on Allow its first answer carries your credential, once.'
          : 'Ask for more access for your own agent (a new capability or mailbox). The operator is prompted again; on Allow the grants are added to the credential you already hold.',
      inputSchema: requestSchema
    },
    async (args) =>
      guard('access.request', async () => {
        const r = await deps.access.request(principal, args as Record<string, unknown>)
        return r.ok ? answer({ requestId: r.requestId, status: r.status, expiresAt: r.expiresAt, note: r.note }) : refusal('refused', r.refused)
      })
  )

  server.registerTool(
    'fabric.access.status',
    {
      title: 'Read an access request',
      description: 'pending, allowed, denied or expired. The first read after Allow carries the binding credential exactly once; store it in your vault.',
      inputSchema: statusSchema
    },
    async ({ requestId }) =>
      guard('access.status', async () => {
        const r = await deps.access.status(principal, requestId)
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
          'fabric-interop/0.1 C3.5. Fabric checks your grant, narrows the call to the mailboxes you were granted, forwards it with the product\'s own credential (which you never see) and journals the hop. Without a grant the answer is access-required, carrying the fabric.access.request arguments to ask with.',
        inputSchema: callSchema
      },
      async (args, extra) =>
        guard('agent.call', async () => {
          if (!deps.call) return refusal('hub-unavailable', 'this hub forwards no calls yet')
          return deps.call(binding, args as AgentCallArgs, (extra as { _meta?: Record<string, unknown> })._meta)
        })
    )
  }
  return server
}
// #endregion hub-tools
