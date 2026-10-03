// #region hub-access — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#3-grants-are-standing-narrow-and-revocable
// What an external agent may ask for, how it is said to a person, and when a call is inside what was
// granted (ADR-0115 §2, §3, §5). Pure: no Node import, so the renderer shows grants in the same words
// the prompt used, and the rules are tested without a server.
//
// THE PRODUCT'S WORDS, NOT OURS. A capability is the product's own MCP tool name (`read_message`),
// and a resource is the product's own account id (`cloudflare:news@example.com`), normalised exactly
// the way the product reads it (`parseAccount` in Fabric Inbox's `workers/mcp/tools.ts`) — so a grant
// for `News@Example.com` and a call naming `cloudflare:news@example.com` are the same mailbox, and a
// spelling cannot carry a call past its grant.
//
// A NOTE ON NAMES, recorded because it departs from the contract's text: `fabric-interop/0.1`'s
// `capabilityName` pattern has no underscore, and Fabric Inbox's tools have one. `agent.call` to a
// connected product takes the product's tool name as it is (`^[a-z][a-z0-9._-]{1,127}$`); the
// contract amendment is a carry-over row, not a silent rename.

export const ACCESS_REQUEST_TTL_MS = 10 * 60 * 1000
/** ADR-0115 §3: an allow's default expiry. A grant without one is refused (§6). */
export const GRANT_TTL_MS = 365 * 24 * 60 * 60 * 1000
/** How long after an Allow the agent has to collect its credential. */
export const CREDENTIAL_CLAIM_WINDOW_MS = 10 * 60 * 1000

export const AGENT_ID_PATTERN = /^[a-z][a-z0-9-]{1,62}(\.[a-z][a-z0-9-]{0,31})?$/
export const CAPABILITY_PATTERN = /^[a-z][a-z0-9._-]{1,127}$/

/** The products an agent can reach through Fabric. One today; each needs its own connect flow (S4). */
export const CONNECTABLE_PRODUCTS = ['fabric-inbox'] as const
export type ConnectableProduct = (typeof CONNECTABLE_PRODUCTS)[number]

/**
 * Capabilities that act on the WORKSPACE rather than inside one mailbox. They run without the
 * narrowing header, so they run only when the operator saw them in the prompt as their own line —
 * and each names the one resource it creates, so the grant still pins what it may touch.
 */
const WORKSPACE_SETUP: Record<string, (input: Record<string, unknown>) => string | null> = {
  create_address: (input) =>
    typeof input.localPart === 'string' && typeof input.domain === 'string'
      ? normaliseInboxAccount(`${input.localPart}@${input.domain}`)
      : null
}

/** Plain words for the product's tools. A tool not listed is named as itself, quoted. */
const PLAIN: Record<string, string> = {
  list_accounts: 'see which mailboxes exist',
  list_messages: 'list mail',
  search_messages: 'search mail',
  list_folder: 'list a folder',
  read_message: 'read mail',
  read_thread: 'read conversations',
  get_attachment: 'open attachments',
  list_folders: 'see folders',
  get_send_status: 'check what was sent',
  save_draft: 'save drafts',
  send_email: 'send mail',
  reply: 'reply to mail',
  forward: 'forward mail',
  mark_messages: 'mark mail read or starred',
  move_messages: 'move mail',
  report_spam: 'report spam',
  delete_message: 'delete mail for good',
  manage_folder: 'manage folders',
  create_address: 'create the address'
}

export interface AccessAsk {
  agentId: string
  callee: ConnectableProduct
  capabilities: string[]
  resources: string[]
  reason: string
}

export type Normalised<T> = { ok: true; value: T } | { ok: false; reason: string }

const ACCOUNT_CF = /^[^@\s/]+@[^@\s/]+$/
const ACCOUNT_GMAIL = /^[A-Za-z0-9_-]{1,128}$/

/** A Fabric Inbox account id, normalised as the product reads it; null when it is not one. */
export function normaliseInboxAccount(value: string): string | null {
  const v = value.trim()
  if (v.length > 400) return null
  if (v.startsWith('cloudflare:')) return ACCOUNT_CF.test(v.slice(11)) ? `cloudflare:${v.slice(11).toLowerCase()}` : null
  if (v.startsWith('gmail:')) return ACCOUNT_GMAIL.test(v.slice(6)) ? v : null
  if (/^[^@\s]+@[^@\s]+$/.test(v) && !v.includes('/')) return `cloudflare:${v.toLowerCase()}`
  return null
}

/** How a resource is said to a person: the address itself, or which Gmail account. */
export function displayResource(resource: string): string {
  if (resource.startsWith('cloudflare:')) return resource.slice(11)
  if (resource.startsWith('gmail:')) return `the Gmail account ${resource.slice(6)}`
  return resource
}

export function plainCapability(capability: string): string {
  return PLAIN[capability] ?? `use “${capability}”`
}

export function isWorkspaceSetup(capability: string): boolean {
  return Object.prototype.hasOwnProperty.call(WORKSPACE_SETUP, capability)
}

/** Checks and normalises a `fabric.access.request`, or says what a person could not be shown. */
export function normaliseAccessRequest(input: {
  agentId?: unknown
  callee?: unknown
  capabilities?: unknown
  resources?: unknown
  reason?: unknown
}): Normalised<AccessAsk> {
  if (typeof input.agentId !== 'string' || !AGENT_ID_PATTERN.test(input.agentId))
    return { ok: false, reason: 'agentId must be your registry id: a provider id, or a service id with an optional .instance' }
  if (typeof input.callee !== 'string' || !(CONNECTABLE_PRODUCTS as readonly string[]).includes(input.callee))
    return { ok: false, reason: `no product called ${String(input.callee)} is connectable through Fabric (connectable: ${CONNECTABLE_PRODUCTS.join(', ')})` }
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0)
    return { ok: false, reason: 'ask for at least one capability — the product tool you will call' }
  if (input.capabilities.length > 32) return { ok: false, reason: 'ask for at most 32 capabilities in one request' }
  const caps = new Set<string>()
  for (const c of input.capabilities) {
    if (typeof c !== 'string' || !CAPABILITY_PATTERN.test(c)) return { ok: false, reason: `${JSON.stringify(c)} is not a capability name (the product's tool name)` }
    caps.add(c)
  }
  if (!Array.isArray(input.resources) || input.resources.length === 0)
    return { ok: false, reason: 'name at least one resource — the mailbox the capabilities are for (cloudflare:<address> or gmail:<id>)' }
  if (input.resources.length > 64) return { ok: false, reason: 'name at most 64 resources in one request' }
  const res = new Set<string>()
  for (const r of input.resources) {
    const n = typeof r === 'string' ? normaliseInboxAccount(r) : null
    if (!n) return { ok: false, reason: `${JSON.stringify(r)} is not a mailbox: use cloudflare:<address> or gmail:<id>, as list_accounts returns them` }
    res.add(n)
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (!reason || reason.length > 1000) return { ok: false, reason: 'give a reason of 1 to 1000 characters — the operator reads it, as your claim' }
  return {
    ok: true,
    value: { agentId: input.agentId, callee: input.callee as ConnectableProduct, capabilities: [...caps].sort(), resources: [...res].sort(), reason }
  }
}

/**
 * What is asked, one line per resource, in the product's words. A workspace setup is its own line,
 * because it runs without the narrowing header and the operator must see that it does.
 */
export function describeAsk(ask: Pick<AccessAsk, 'capabilities' | 'resources'>): string[] {
  const inside = ask.capabilities.filter((c) => !isWorkspaceSetup(c))
  const setup = ask.capabilities.filter(isWorkspaceSetup)
  const lines: string[] = []
  for (const r of ask.resources) {
    if (inside.length) {
      const verbs = inside.map(plainCapability)
      const said = verbs.length === 1 ? verbs[0] : `${verbs.slice(0, -1).join(', ')} and ${verbs[verbs.length - 1]}`
      lines.push(`${said} in ${displayResource(r)}`)
    }
    for (const c of setup) lines.push(`set up the workspace: ${plainCapability(c)} ${displayResource(r)}`)
  }
  return lines
}

/** The same request, whatever its order or spelling — the key a standing denial answers. */
export function requestSignature(ask: Pick<AccessAsk, 'agentId' | 'callee' | 'capabilities' | 'resources'>): string {
  return JSON.stringify([ask.agentId, ask.callee, [...ask.capabilities].sort(), [...ask.resources].sort()])
}

/**
 * Every mailbox a call names, wherever it names it: any `accountId` at any depth, and the account
 * lists (`accounts`, `hide`, `show`). Fails closed on a value it cannot read — an argument Fabric
 * cannot check is not an argument Fabric forwards. A workspace setup names the address it creates.
 */
export function resourceArguments(
  capability: string,
  input: Record<string, unknown>
): { ok: true; resources: string[]; workspace: string | null } | { ok: false; reason: string } {
  const found = new Set<string>()
  let bad: string | null = null
  const visit = (value: unknown, key: string | null, depth: number): void => {
    if (bad || depth > 16) {
      if (!bad && depth > 16) bad = 'the input nests deeper than Fabric checks'
      return
    }
    if (key === 'accountId') {
      const n = typeof value === 'string' ? normaliseInboxAccount(value) : null
      if (!n) bad = `accountId ${JSON.stringify(value)} is not a mailbox Fabric can check`
      else found.add(n)
      return
    }
    if ((key === 'accounts' || key === 'hide' || key === 'show') && Array.isArray(value)) {
      for (const v of value) {
        const n = typeof v === 'string' ? normaliseInboxAccount(v) : null
        if (!n) { bad = `${key} names ${JSON.stringify(v)}, which is not a mailbox Fabric can check`; return }
        found.add(n)
      }
      return
    }
    if (Array.isArray(value)) for (const v of value) visit(v, null, depth + 1)
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, k, depth + 1)
  }
  visit(input, null, 0)
  if (bad) return { ok: false, reason: bad }
  let workspace: string | null = null
  const setup = WORKSPACE_SETUP[capability]
  if (setup) {
    workspace = setup(input)
    if (!workspace) return { ok: false, reason: `${capability} must name the address it creates (localPart and domain)` }
    found.add(workspace)
  }
  return { ok: true, resources: [...found].sort(), workspace }
}

export interface GrantLike {
  id: string
  callee: string
  capability: string
  resource: string
  expires_at: string
  revoked_at: string | null
}

/**
 * Whether a call is inside the caller's live grants, and how it is narrowed at the product.
 * `narrowing` is the header's account list — every mailbox this binding holds the capability for —
 * or null for a workspace setup, which runs on the whole workspace because its own grant said so.
 */
export function coverage(
  call: { callee: string; capability: string; resources: string[]; workspace: string | null },
  grants: readonly GrantLike[],
  now: number
): { ok: true; narrowing: string[] | null; grantIds: string[] } | { ok: false; reason: string; missing: string[] } {
  const live = grants.filter((g) => g.callee === call.callee && g.capability === call.capability && g.revoked_at === null && Date.parse(g.expires_at) > now)
  if (!live.length) return { ok: false, reason: `no live grant lets you call ${call.capability} on ${call.callee}`, missing: call.resources }
  const held = new Set(live.map((g) => g.resource))
  const missing = call.resources.filter((r) => !held.has(r))
  if (missing.length) return { ok: false, reason: `your grant for ${call.capability} does not cover ${missing.map(displayResource).join(', ')}`, missing }
  if (call.workspace) {
    const g = live.find((x) => x.resource === call.workspace)
    return g ? { ok: true, narrowing: null, grantIds: [g.id] } : { ok: false, reason: `no grant lets you ${plainCapability(call.capability)} ${displayResource(call.workspace)}`, missing: [call.workspace] }
  }
  const sorted = [...live].sort((a, b) => a.resource.localeCompare(b.resource))
  return { ok: true, narrowing: [...new Set(sorted.map((g) => g.resource))], grantIds: sorted.map((g) => g.id) }
}

/** The `access-required` answer: not passed through, and it says exactly how to ask (ADR-0115 §6). */
export function accessRefusal(input: { agentId: string; callee: string; capability: string; resources: string[]; why: string }) {
  return {
    error: {
      code: 'access-required' as const,
      message: `${input.why}. Ask the operator with fabric.access.request; nothing was forwarded.`,
      data: {
        request: {
          agentId: input.agentId,
          callee: input.callee,
          capabilities: [input.capability],
          resources: input.resources,
          reason: 'Say, in one or two sentences, why you need this — the operator reads it as your claim.'
        }
      }
    }
  }
}

export const PRODUCT_NAMES: Record<string, string> = { 'fabric-inbox': 'Fabric Inbox' }
export const productName = (id: string): string => PRODUCT_NAMES[id] ?? id

/**
 * The words of the native prompt (ADR-0115 §2). The agent is named as the REGISTRY knows it, with
 * where it came from; what it asks is said in the product's words; its reason is quoted as its own
 * claim; and the same-user floor is said, not implied. Deny is the default and the cancel answer.
 */
export function consentText(input: {
  agentId: string
  registry: { name?: string; installed_by?: string; repository?: string | null }
  callee: string
  capabilities: string[]
  resources: string[]
  reason: string
  connected: boolean
  incremental: boolean
}): { title: string; message: string; detail: string; buttons: [string, string]; defaultId: 0; cancelId: 0 } {
  const product = productName(input.callee)
  const name = input.registry.name?.trim() || input.agentId
  const origin = [
    input.registry.installed_by ? `installed by ${input.registry.installed_by}` : null,
    input.registry.repository ? `source ${input.registry.repository}` : null
  ].filter(Boolean).join('; ')
  const detail = [
    `An agent registered as ${input.agentId}${origin ? ` (${origin})` : ''} asks to:`,
    ...describeAsk(input).map((l) => `• ${l}`),
    '',
    'Its reason, in its own words:',
    `“${input.reason}”`,
    '',
    'Fabric checked that an agent with this id is installed on this Mac. It cannot prove which program sent the request: any program running as you could use that id.',
    '',
    input.incremental
      ? 'This agent already has access through Fabric; this adds to it.'
      : `If you allow, the agent gets its own credential for ${product} through Fabric.`,
    'Access lasts a year unless you revoke it in Settings → Agent access.',
    ...(input.connected ? [] : ['', `${product} is not connected to Fabric yet. Allow also opens ${product}, which asks you to connect it.`])
  ].join('\n')
  return {
    title: `Allow ${name} to use ${product}?`,
    message: `${name} asks to use ${product} through Fabric`,
    detail,
    buttons: ['Deny', input.connected ? 'Allow' : `Allow and connect ${product}`],
    defaultId: 0,
    cancelId: 0
  }
}

/** What the operator's Agent access list shows (Settings → Agent access). */
export interface HubOverview {
  hub: { listening: true; origin: string } | { listening: false; reason: string }
  products: Array<{
    product: string
    name: string
    connection: { server: string; level: string; connectedAt: string; keyExpiresAt: string | null } | null
    lastAttempt: { outcome: 'waiting' | 'connected' | 'denied' | 'failed'; at: string; reason?: string } | null
  }>
  pending: Array<{ requestId: string; agentId: string; name: string; callee: string; lines: string[]; reason: string; requestedAt: string; expiresAt: string }>
  agents: Array<{
    bindingId: string
    agentId: string
    name: string
    since: string
    grants: Array<{ grantId: string; callee: string; capability: string; resource: string; line: string; expiresAt: string }>
  }>
  denials: Array<{ requestId: string; agentId: string; name: string; callee: string; lines: string[]; deniedAt: string | null }>
}

export type HubActResult = { ok: true } | { ok: false; reason: string }
// #endregion hub-access
