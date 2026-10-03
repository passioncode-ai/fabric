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
 *
 * ONLY THE ADDRESS'S OWN FIELDS ride along by default (security review of PR #7, finding 4). Fabric's
 * key is an admin key and this call carries no narrowing header, so whatever else the product's tool
 * accepts would run with it unseen. Fabric Inbox's `create_address` (`workers/mcp/tools.ts`) also takes
 * `forwardTo` — every message of the new address copied elsewhere — and `agent` — the reply agent that
 * answers it, and a reply agent sends mail. Each is a capability of its own (`create_address.forward_to`,
 * `create_address.reply_agent`), shown as its own line, granted per address; any other field is refused.
 */
interface SetupSpec {
  resource: (input: Record<string, unknown>) => string | null
  /** Fields that only describe the thing created. */
  own: readonly string[]
  /** Fields that reach further: each needs its own grant, named `<tool>.<suffix>`. */
  extras: Readonly<Record<string, { suffix: string; plain: string }>>
}

const WORKSPACE_SETUP: Record<string, SetupSpec> = {
  create_address: {
    resource: (input) =>
      typeof input.localPart === 'string' && typeof input.domain === 'string'
        ? normaliseInboxAccount(`${input.localPart}@${input.domain}`)
        : null,
    own: ['localPart', 'domain', 'name', 'createRoute'],
    extras: {
      forwardTo: { suffix: 'forward_to', plain: 'forward a copy of its mail to an address the agent chooses' },
      agent: { suffix: 'reply_agent', plain: 'choose the reply agent that answers its mail — a reply agent can send mail' }
    }
  }
}

/** `create_address.forward_to` → its tool and what it allows; null for anything that is not a known extra. */
function setupExtra(capability: string): { tool: string; field: string; plain: string } | null {
  const dot = capability.indexOf('.')
  if (dot < 0) return null
  const spec = WORKSPACE_SETUP[capability.slice(0, dot)]
  if (!spec) return null
  for (const [field, e] of Object.entries(spec.extras))
    if (e.suffix === capability.slice(dot + 1)) return { tool: capability.slice(0, dot), field, plain: e.plain }
  return null
}

/**
 * Plain words for Fabric Inbox's tools, as `workers/mcp/tools.ts` names them (origin/main, read
 * 2026-10-03). A tool that SENDS mail (`sends: true` there) says so in its own words; a tool not
 * listed is named as itself and said to be unknown, never guessed at.
 */
const PLAIN: Record<string, string> = {
  // level read
  list_accounts: 'see which mailboxes exist',
  list_messages: 'list and search mail',
  search_mailbox: 'search mail',
  list_mailbox_messages: 'list a folder',
  read_message: 'read mail',
  read_thread: 'read conversations',
  get_attachment: 'open attachments',
  list_folders: 'see folders',
  get_send_status: 'check what was sent',
  // level mail
  save_draft: 'save drafts',
  send_email: 'send mail',
  reply: 'reply to mail, which sends it',
  forward: 'forward mail, which sends it',
  update_messages: 'mark mail read or starred',
  move_messages: 'move mail',
  mark_spam: 'report mail as spam or not spam',
  delete_message: 'delete mail for good',
  sync_account: 'sync a Gmail account',
  manage_folder: 'create, rename or remove folders',
  approve_rule_run: 'approve a rule’s action, which can send mail',
  dismiss_rule_run: 'dismiss a rule’s action',
  // level admin — the one setup Fabric runs, and the admin tool that sends
  create_address: 'create the address',
  send_test_message: 'send a test message'
}

/** The tools that send mail (`sends: true` in Fabric Inbox's `workers/mcp/tools.ts`). */
export const SENDS_MAIL: ReadonlySet<string> = new Set(['send_email', 'reply', 'forward', 'approve_rule_run', 'send_test_message'])

// Every character that can break a line, reorder what follows it or hide in it: C0/C1 controls, DEL,
// the bidirectional marks, embeddings, overrides and isolates, the Unicode line and paragraph
// separators, zero-width characters and the byte-order mark.
const UNSHOWABLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\u2028\u2029\ufeff]/g

/**
 * Text from outside Fabric — an agent's reason, a registry's name — as ONE line a person can read:
 * every unshowable character is a space, runs of space fold, and it is cut at `max` with an ellipsis.
 * What it cannot do afterwards is start a line of its own, or turn the words after it around.
 */
export function oneLine(text: string, max = 300): string {
  const flat = text.replace(UNSHOWABLE, ' ').replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

export interface AccessAsk {
  agentId: string
  callee: ConnectableProduct
  capabilities: string[]
  resources: string[]
  reason: string
}

export type Normalised<T> = { ok: true; value: T } | { ok: false; reason: string }

// Fabric Inbox's own rule for a Cloudflare mailbox (`cloudflareId` in `workers/mcp/scope.ts`): no "%",
// because its mailbox routes decode their parameter once more; no ":"; a dot in the domain. And no
// ",", because the narrowing header is a comma-separated list — `cloudflare:digest,ceo@corp.com` would
// otherwise reach the product as two mailboxes (security review of PR #7, finding 2).
const ACCOUNT_CF = /^[^@\s/:%,]+@[^@\s/:%,]+\.[^@\s/:%,]+$/
const ACCOUNT_GMAIL = /^[A-Za-z0-9_-]{1,128}$/

/** A Fabric Inbox account id, normalised as the product reads it; null when it is not one. */
export function normaliseInboxAccount(value: string): string | null {
  const v = value.trim()
  if (v.length > 400) return null
  if (v.startsWith('cloudflare:')) return ACCOUNT_CF.test(v.slice(11)) ? `cloudflare:${v.slice(11).toLowerCase()}` : null
  if (v.startsWith('gmail:')) return ACCOUNT_GMAIL.test(v.slice(6)) ? v : null
  if (ACCOUNT_CF.test(v)) return `cloudflare:${v.toLowerCase()}`
  return null
}

/** How a resource is said to a person: the address itself, or which Gmail account — on one line. */
export function displayResource(resource: string): string {
  if (resource.startsWith('cloudflare:')) return oneLine(resource.slice(11), 400)
  if (resource.startsWith('gmail:')) return `the Gmail account ${oneLine(resource.slice(6), 400)}`
  return oneLine(resource, 400)
}

export function plainCapability(capability: string): string {
  const extra = setupExtra(capability)
  if (extra) return extra.plain
  const said = PLAIN[capability]
  if (!said) return `use “${oneLine(capability, 128)}” (a tool Fabric does not know and cannot describe)`
  return SENDS_MAIL.has(capability) && !/\bsend/.test(said) ? `${said}, which sends mail` : said
}

/** A setup tool, or one of its extras: either runs on the workspace, without the narrowing header. */
export function isWorkspaceSetup(capability: string): boolean {
  return Object.prototype.hasOwnProperty.call(WORKSPACE_SETUP, capability) || setupExtra(capability) !== null
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
    const dot = c.indexOf('.')
    if (dot > 0 && WORKSPACE_SETUP[c.slice(0, dot)] && !setupExtra(c))
      return { ok: false, reason: `${c} is not something Fabric can grant for ${c.slice(0, dot)} (it grants: ${Object.values(WORKSPACE_SETUP[c.slice(0, dot)].extras).map((e) => `${c.slice(0, dot)}.${e.suffix}`).join(', ')})` }
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
  // Kept as ONE line: the operator reads it inside quotes, and a line break or a bidirectional override
  // in it could otherwise pass for Fabric's own words (security review of PR #7, finding 3).
  const raw = typeof input.reason === 'string' ? input.reason.trim() : ''
  const reason = raw.length > 1000 ? '' : oneLine(raw, 1000)
  if (!reason) return { ok: false, reason: 'give a reason of 1 to 1000 characters — the operator reads it, as your claim' }
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
    for (const c of setup)
      lines.push(setupExtra(c)
        ? `set up the workspace: when creating ${displayResource(r)}, also ${plainCapability(c)}`
        : `set up the workspace: ${plainCapability(c)} ${displayResource(r)}`)
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
): { ok: true; resources: string[]; workspace: string | null; requires: string[] } | { ok: false; reason: string } {
  const extra = setupExtra(capability)
  if (extra) return { ok: false, reason: `${capability} is a permission Fabric grants, not a tool; call ${extra.tool} with ${extra.field}` }
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
  const requires: string[] = []
  const setup = WORKSPACE_SETUP[capability]
  if (setup) {
    workspace = setup.resource(input)
    if (!workspace) return { ok: false, reason: `${capability} must name the address it creates (localPart and domain)` }
    for (const key of Object.keys(input)) {
      if (setup.own.includes(key)) continue
      const e = setup.extras[key]
      if (!e) return { ok: false, reason: `${capability} through Fabric takes ${[...setup.own, ...Object.keys(setup.extras)].join(', ')}; ${key} is not forwarded, because the operator was not shown it` }
      if (input[key] !== undefined) requires.push(`${capability}.${e.suffix}`)
    }
    found.add(workspace)
  }
  return { ok: true, resources: [...found].sort(), workspace, requires: requires.sort() }
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
  call: { callee: string; capability: string; resources: string[]; workspace: string | null; requires?: string[] },
  grants: readonly GrantLike[],
  now: number
): { ok: true; narrowing: string[] | null; grantIds: string[] } | { ok: false; reason: string; missing: string[]; ask: string[] } {
  const liveFor = (capability: string): GrantLike[] =>
    grants.filter((g) => g.callee === call.callee && g.capability === capability && g.revoked_at === null && Date.parse(g.expires_at) > now)
  const live = liveFor(call.capability)
  if (!live.length) return { ok: false, reason: `no live grant lets you call ${call.capability} on ${call.callee}`, missing: call.resources, ask: [call.capability] }
  const held = new Set(live.map((g) => g.resource))
  const missing = call.resources.filter((r) => !held.has(r))
  if (missing.length) return { ok: false, reason: `your grant for ${call.capability} does not cover ${missing.map(displayResource).join(', ')}`, missing, ask: [call.capability] }
  if (call.workspace) {
    const g = live.find((x) => x.resource === call.workspace)
    if (!g) return { ok: false, reason: `no grant lets you ${plainCapability(call.capability)} ${displayResource(call.workspace)}`, missing: [call.workspace], ask: [call.capability] }
    // Each extra the input uses is its own grant, for this very address.
    const ids = [g.id]
    const lacking: string[] = []
    for (const extra of call.requires ?? []) {
      const e = liveFor(extra).find((x) => x.resource === call.workspace)
      if (e) ids.push(e.id)
      else lacking.push(extra)
    }
    if (lacking.length)
      return { ok: false, reason: `no grant lets you ${lacking.map(plainCapability).join(' or ')} for ${displayResource(call.workspace)}`, missing: [call.workspace], ask: lacking }
    return { ok: true, narrowing: null, grantIds: ids }
  }
  const sorted = [...live].sort((a, b) => a.resource.localeCompare(b.resource))
  return { ok: true, narrowing: [...new Set(sorted.map((g) => g.resource))], grantIds: sorted.map((g) => g.id) }
}

/** The `access-required` answer: not passed through, and it says exactly how to ask (ADR-0115 §6). */
export function accessRefusal(input: { agentId: string; callee: string; capability: string; capabilities?: string[]; resources: string[]; why: string }) {
  return {
    error: {
      code: 'access-required' as const,
      message: `${input.why}. Ask the operator with fabric.access.request; nothing was forwarded.`,
      data: {
        request: {
          agentId: input.agentId,
          callee: input.callee,
          capabilities: input.capabilities?.length ? input.capabilities : [input.capability],
          resources: input.resources,
          reason: 'Say, in one or two sentences, why you need this — the operator reads it as your claim.'
        }
      }
    }
  }
}

export const PRODUCT_NAMES: Record<string, string> = { 'fabric-inbox': 'Fabric Inbox' }
export const productName = (id: string): string => PRODUCT_NAMES[id] ?? id

/** The same-user floor (ADR-0115 §2), said wherever the operator can answer a request. */
export const SAME_USER_FLOOR =
  'Fabric checked that an agent with this id is installed on this Mac. It cannot prove which program sent the request: any program running as you could use that id.'

type RegistrySnapshot = { name?: string; installed_by?: string; repository?: string | null }

/** The agent's name as shown: the registry's, on one line, or its id. */
export function agentName(agentId: string, registry: RegistrySnapshot | null | undefined): string {
  return oneLine(registry?.name ?? '', 80) || agentId
}

/**
 * The facts the native prompt states, as the attention queue and the settings list show them too —
 * so an Allow given from either says what the prompt would have said (security review of PR #7).
 * Everything that came from outside Fabric is one line, with nothing that can break or reorder it.
 */
export function consentFacts(input: { agentId: string; registry: RegistrySnapshot | null | undefined; reason: string; incremental: boolean }): {
  origin: string
  reason: string
  floor: string
  incremental: string | null
} {
  const r = input.registry ?? {}
  const by = oneLine(r.installed_by ?? '', 200)
  const repo = oneLine(r.repository ?? '', 300)
  const where = [by ? `installed by ${by}` : null, repo ? `source ${repo}` : null].filter(Boolean).join('; ')
  return {
    origin: `An agent registered as ${input.agentId}${where ? ` (${where})` : ''}`,
    reason: oneLine(input.reason, 300),
    floor: SAME_USER_FLOOR,
    incremental: input.incremental ? 'This agent already has access through Fabric; this adds to it.' : null
  }
}

/**
 * The words of the native prompt (ADR-0115 §2). The agent is named as the REGISTRY knows it, with
 * where it came from; what it asks is said in the product's words; its reason is quoted as its own
 * claim, on one line; and the same-user floor is said, not implied. Deny is the default and the
 * cancel answer.
 */
export function consentText(input: {
  agentId: string
  registry: RegistrySnapshot
  callee: string
  capabilities: string[]
  resources: string[]
  reason: string
  connected: boolean
  incremental: boolean
}): { title: string; message: string; detail: string; buttons: [string, string]; defaultId: 0; cancelId: 0 } {
  const product = productName(input.callee)
  const name = agentName(input.agentId, input.registry)
  const facts = consentFacts(input)
  const detail = [
    `${facts.origin} asks to:`,
    ...describeAsk(input).map((l) => `• ${l}`),
    '',
    'Its reason, in its own words:',
    `“${facts.reason}”`,
    '',
    facts.floor,
    '',
    facts.incremental ?? `If you allow, the agent gets its own credential for ${product} through Fabric.`,
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
  /** `origin`, `reason`, `floor` and `incremental` are `consentFacts`: the native prompt's own facts. */
  pending: Array<{ requestId: string; agentId: string; name: string; callee: string; lines: string[]; reason: string; origin: string; floor: string; incremental: string | null; requestedAt: string; expiresAt: string }>
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
