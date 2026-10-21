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
// NAMES: fabric-agent-contract df55c8c54a23251342a7ee57ba95642b7eb39e61 includes underscores in
// the shared capabilityName grammar (`^[a-z][a-z0-9._-]{1,127}$`). The compiled contract regression
// exercises the four normative surfaces and agent.call's real SDK argument validator. Prototype
// segments remain refused by the separate consent policy below; valid shape never grants authority.

import type { AccessActRefusal } from './accessActs.ts'

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

// #region session-enroll-ask — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
/** Fabric itself as a callee (ADR-0134): a coding agent asks to work in one project, and for nothing else. */
export const FABRIC_SELF = 'fabric'
export const SESSION_ENROLL = 'session.enroll'
export const PROJECT_RESOURCE = /^project:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export type AccessCallee = ConnectableProduct | typeof FABRIC_SELF
/** The project a `project:<uuid>` resource names. */
export const projectOfResource = (resource: string): string | null => (PROJECT_RESOURCE.test(resource) ? resource.slice('project:'.length) : null)
// #endregion session-enroll-ask

// #region board-respond-ask — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#2-responding-is-a-standing-grant-of-its-own
/** ADR-0149 §2: answering a Project's requests is a grant of its own — callee `fabric`, capability `board.respond`,
 *  resource `board:<project>/<capability>`, 1 to 8 capabilities of ONE Project per ask. */
export const BOARD_RESPOND = 'board.respond'
/** Folder attribution (ADR-0166, DEC-0089): read-only, of Fabric itself, on the one resource `projects` (0.3.8: Observatory's
 *  live check found no way to ask for it). */
export const PROJECT_RESOLVE = 'project.resolve'
export const PROJECTS_RESOURCE = 'projects'
export const BOARD_RESOURCE = /^board:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([a-z][a-z0-9._-]{1,127})$/
/** The Project and capability a `board:<project>/<capability>` resource names. */
export function boardResourceOf(resource: string): { project: string; capability: string } | null {
  const m = BOARD_RESOURCE.exec(resource)
  return m ? { project: m[1], capability: m[2] } : null
}
// #endregion board-respond-ask

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
      agent: { suffix: 'reply_agent', plain: 'choose the reply agent that answers its mail; a reply agent can send mail' }
    }
  }
}

// OWN PROPERTIES ONLY (ER-7, verification iteration 2 for 0.3.1). Every table here is indexed with agent
// input, and a plain object answers `constructor` from Object.prototype: `resourceArguments('constructor')`
// threw (read as a retryable hub-unavailable), and `constructor` reached the operator's prompt as a tool.
// Lookups go through `own`, and a name that is the prototype's own is refused as invalid wherever it appears.
const own = <T>(table: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined
/** Names an object inherits: never a capability, never an input key Fabric forwards. */
const PROTOTYPE_NAMES: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])
const namesPrototype = (capability: string): boolean => capability.split('.').some((part) => PROTOTYPE_NAMES.has(part))

/** `create_address.forward_to` → its tool and what it allows; null for anything that is not a known extra. */
function setupExtra(capability: string): { tool: string; field: string; plain: string } | null {
  const dot = capability.indexOf('.')
  if (dot < 0) return null
  const spec = own(WORKSPACE_SETUP, capability.slice(0, dot))
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
  approve_rule_run: 'approve what a rule is about to do, which can send mail',
  dismiss_rule_run: 'dismiss what a rule was about to do',
  // level admin — the one setup Fabric runs, and the admin tool that sends
  create_address: 'create the address',
  send_test_message: 'send a test message'
}

/** The tools that send mail (`sends: true` in Fabric Inbox's `workers/mcp/tools.ts`). */
export const SENDS_MAIL: ReadonlySet<string> = new Set(['send_email', 'reply', 'forward', 'approve_rule_run', 'send_test_message'])

/** Every capability Fabric can describe: the product's tools and each setup extra. Each has its own
 *  operator sentence in the i18n registries (`access.cap.<id>`, en and ru). */
export const KNOWN_CAPABILITIES: readonly string[] = [
  ...Object.keys(PLAIN),
  ...Object.entries(WORKSPACE_SETUP).flatMap(([tool, spec]) => Object.values(spec.extras).map((e) => `${tool}.${e.suffix}`))
]

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
  callee: AccessCallee
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

// PRINTABLE ASCII ONLY (verification iteration 1 for 0.3.1, ER-9). Fabric Inbox's account ids are ASCII
// (Cloudflare addresses, Gmail ids; its `create_address` localPart is `[a-z0-9._+-]`), and a zero-width
// space, a word joiner, a soft hyphen or a look-alike letter is removed or invisible when the prompt
// shows it — so the operator would allow a string they were not shown. Refused instead: the string shown
// and the string granted are byte-identical.
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/

/** A Fabric Inbox account id, normalised as the product reads it; null when it is not one. */
export function normaliseInboxAccount(value: string): string | null {
  const v = value.trim()
  if (v.length > 400 || !PRINTABLE_ASCII.test(v)) return null
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
  const said = own(PLAIN, capability)
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
  if (input.callee === FABRIC_SELF) return normaliseEnrollAsk(input)
  if (Array.isArray(input.capabilities) && input.capabilities.includes(SESSION_ENROLL))
    return { ok: false, reason: `${SESSION_ENROLL} is asked of Fabric itself (callee ${FABRIC_SELF}), never of a product` }
  if (typeof input.callee !== 'string' || !(CONNECTABLE_PRODUCTS as readonly string[]).includes(input.callee))
    return { ok: false, reason: `no product called ${String(input.callee)} is connectable through Fabric (connectable: ${CONNECTABLE_PRODUCTS.join(', ')})` }
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0)
    return { ok: false, reason: 'ask for at least one capability — the product tool you will call' }
  if (input.capabilities.length > 32) return { ok: false, reason: 'ask for at most 32 capabilities in one request' }
  const caps = new Set<string>()
  for (const c of input.capabilities) {
    if (typeof c !== 'string' || !CAPABILITY_PATTERN.test(c) || namesPrototype(c)) return { ok: false, reason: `${JSON.stringify(c)} is not a capability name (the product's tool name)` }
    const dot = c.indexOf('.')
    const setupOf = dot > 0 ? own(WORKSPACE_SETUP, c.slice(0, dot)) : undefined
    if (setupOf && !setupExtra(c))
      return { ok: false, reason: `${c} is not something Fabric can grant for ${c.slice(0, dot)} (it grants: ${Object.values(setupOf.extras).map((e) => `${c.slice(0, dot)}.${e.suffix}`).join(', ')})` }
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

/** A product tool as the operator is shown it: its id, and whether Fabric has words for it. */
export interface CapabilityRef { id: string; known: boolean }
/** A resource as the operator is shown it: an address, a Gmail account, or (never expected) the raw id. */
export type ResourceRef = { kind: 'address'; address: string } | { kind: 'gmail'; id: string } | { kind: 'other'; text: string }
/**
 * One line of what is asked, as FACTS — the renderer and the native prompt phrase it through the i18n
 * registries (verification iteration 1 for 0.3.1, UX-2): never an English sentence carried from main.
 * `setup` and `setup-extra` run on the workspace without the narrowing header, so each is its own line.
 */
export type AskLine =
  | { kind: 'inside'; capabilities: CapabilityRef[]; resource: ResourceRef }
  | { kind: 'setup' | 'setup-extra'; capability: CapabilityRef; resource: ResourceRef }
  /** ADR-0134: a coding agent asks to work in one project — said as the project, never as `session.enroll` or
   *  `project:<uuid>`. `name` is null when the facts carry none (a grant's line is built from the grant alone). */
  | { kind: 'enroll'; project: { id: string; name: string | null } }
  /** ADR-0149 §2: an agent asks to answer one Project's requests for these capabilities. */
  | { kind: 'respond'; project: { id: string; name: string | null }; capabilities: string[] }
  /** A product asks to read which Fabric project a folder belongs to (`project.resolve` on `projects`; 0.3.8). */
  | { kind: 'resolve' }

export function capabilityRef(id: string): CapabilityRef {
  const known = Object.prototype.hasOwnProperty.call(PLAIN, id) || setupExtra(id) !== null
  return { id: known ? id : oneLine(id, 128), known }
}

export function resourceRef(resource: string): ResourceRef {
  if (resource.startsWith('cloudflare:')) return { kind: 'address', address: oneLine(resource.slice(11), 400) }
  if (resource.startsWith('gmail:')) return { kind: 'gmail', id: oneLine(resource.slice(6), 400) }
  return { kind: 'other', text: oneLine(resource, 400) }
}

/** What is asked, one line per resource, as facts. A workspace setup is its own line. An enrollment (ADR-0134) is
 *  one line per project, named from the request's registry snapshot when it carries that project. */
export function askLines(ask: Pick<AccessAsk, 'capabilities' | 'resources'> & { registry?: RegistrySnapshot | null }): AskLine[] {
  // #region enroll-words — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
  if (ask.capabilities.includes(SESSION_ENROLL)) {
    const known = enrollProjectOf(ask.registry)
    return ask.resources.flatMap((r) => {
      const id = projectOfResource(r)
      return id ? [{ kind: 'enroll' as const, project: { id, name: known && (known.id === null || known.id === id) ? known.name : null } }] : []
    })
  }
  // #endregion enroll-words
  // #region board-respond-words — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#2-responding-is-a-standing-grant-of-its-own
  if (ask.capabilities.includes(BOARD_RESPOND)) {
    const parts = ask.resources.map(boardResourceOf).filter((x): x is { project: string; capability: string } => x !== null)
    if (!parts.length) return []
    const id = parts[0].project
    const known = enrollProjectOf(ask.registry)
    return [{ kind: 'respond' as const, project: { id, name: known && (known.id === null || known.id === id) ? known.name : null },
      capabilities: [...new Set(parts.filter((x) => x.project === id).map((x) => oneLine(x.capability, 128)))].sort() }]
  }
  // #endregion board-respond-words
  // #region project-resolve-request — docs: docs/adr/0166-one-attribution-of-folders-to-projects-across-fabric-switchboard-and-observatory.md#amendments
  if (ask.capabilities.includes(PROJECT_RESOLVE) && ask.resources.includes(PROJECTS_RESOURCE)) return [{ kind: 'resolve' as const }]
  // #endregion project-resolve-request
  const inside = ask.capabilities.filter((c) => !isWorkspaceSetup(c))
  const setup = ask.capabilities.filter(isWorkspaceSetup)
  const lines: AskLine[] = []
  for (const r of ask.resources) {
    const resource = resourceRef(r)
    if (inside.length) lines.push({ kind: 'inside', capabilities: inside.map(capabilityRef), resource })
    for (const c of setup) lines.push({ kind: setupExtra(c) ? 'setup-extra' : 'setup', capability: capabilityRef(c), resource })
  }
  return lines
}

/** The same request, whatever its order or spelling — the key a standing denial answers. */
/** ADR-0134: exactly `session.enroll` on exactly one `project:<uuid>`; whether the agentId is a coding agent on
 *  this Mac is the service's question (the runner catalogue), not this shape check's. */
function normaliseEnrollAsk(input: { agentId?: unknown; capabilities?: unknown; resources?: unknown; reason?: unknown }): Normalised<AccessAsk> {
  if (typeof input.agentId !== 'string' || !AGENT_ID_PATTERN.test(input.agentId))
    return { ok: false, reason: 'agentId must be your coding agent\'s catalogue id, e.g. claude-code' }
  if (Array.isArray(input.capabilities) && input.capabilities.length === 1 && input.capabilities[0] === BOARD_RESPOND) return normaliseRespondAsk(input)
  if (Array.isArray(input.capabilities) && input.capabilities.length === 1 && input.capabilities[0] === PROJECT_RESOLVE) {
    if (!Array.isArray(input.resources) || input.resources.length !== 1 || input.resources[0] !== PROJECTS_RESOURCE)
      return { ok: false, reason: `name exactly one resource, ${PROJECTS_RESOURCE}: folder attribution reads Fabric's projects` }
    const raw = typeof input.reason === 'string' ? input.reason.trim() : ''
    const reason = raw.length > 1000 ? '' : oneLine(raw, 1000)
    if (!reason) return { ok: false, reason: 'give a reason of 1 to 1000 characters — the operator reads it, as your claim' }
    return { ok: true, value: { agentId: input.agentId, callee: FABRIC_SELF, capabilities: [PROJECT_RESOLVE], resources: [PROJECTS_RESOURCE], reason } }
  }
  if (!Array.isArray(input.capabilities) || input.capabilities.length !== 1 || input.capabilities[0] !== SESSION_ENROLL)
    return { ok: false, reason: `of Fabric itself an agent asks exactly one capability, ${SESSION_ENROLL}, ${BOARD_RESPOND} or ${PROJECT_RESOLVE}` }
  if (!Array.isArray(input.resources) || input.resources.length !== 1 || typeof input.resources[0] !== 'string' || !PROJECT_RESOURCE.test(input.resources[0]))
    return { ok: false, reason: 'name exactly one project: project:<id>, as fabric.session.enroll answered it' }
  const raw = typeof input.reason === 'string' ? input.reason.trim() : ''
  const reason = raw.length > 1000 ? '' : oneLine(raw, 1000)
  if (!reason) return { ok: false, reason: 'give a reason of 1 to 1000 characters — the operator reads it, as your claim' }
  return { ok: true, value: { agentId: input.agentId, callee: FABRIC_SELF, capabilities: [SESSION_ENROLL], resources: [input.resources[0]], reason } }
}

/** ADR-0149 §2: exactly `board.respond` on 1 to 8 `board:<project>/<capability>` resources, all of one Project. */
function normaliseRespondAsk(input: { agentId?: unknown; resources?: unknown; reason?: unknown }): Normalised<AccessAsk> {
  if (!Array.isArray(input.resources) || input.resources.length < 1 || input.resources.length > 8)
    return { ok: false, reason: 'name 1 to 8 resources board:<project id>/<capability>, all of one project' }
  const res = new Set<string>()
  let project: string | null = null
  for (const r of input.resources) {
    const parts = typeof r === 'string' ? boardResourceOf(r) : null
    if (!parts || namesPrototype(parts.capability)) return { ok: false, reason: `${JSON.stringify(r)} is not board:<project id>/<capability>` }
    if (project !== null && parts.project !== project) return { ok: false, reason: 'one ask names one project; ask again for another' }
    project = parts.project
    res.add(r as string)
  }
  const raw = typeof input.reason === 'string' ? input.reason.trim() : ''
  const reason = raw.length > 1000 ? '' : oneLine(raw, 1000)
  if (!reason) return { ok: false, reason: 'give a reason of 1 to 1000 characters — the operator reads it, as your claim' }
  return { ok: true, value: { agentId: input.agentId as string, callee: FABRIC_SELF, capabilities: [BOARD_RESPOND], resources: [...res].sort(), reason } }
}

export function requestSignature(ask: Pick<AccessAsk, 'agentId' | 'callee' | 'capabilities' | 'resources'>): string {
  return JSON.stringify([ask.agentId, ask.callee, [...ask.capabilities].sort(), [...ask.resources].sort()])
}

/**
 * Keys that name a mailbox when Fabric does not read them (ER-6, verification iteration 2 for 0.3.1),
 * compared lower-case with `_` and `-` removed. Fabric reads a mailbox ONLY as `accountId` (that exact
 * key, a string) and the account lists `accounts`, `hide`, `show` (arrays). Before, a call naming its
 * mailbox under any other key — `address`, `account`, a string `accounts`, `AccountId`, `forwardTo` —
 * named no resource, was "covered" by any grant of the capability and went out with the admin key,
 * narrowed only by a header a Fabric Inbox server before 0.9.0 ignores. Now such a key is refused: what
 * Fabric cannot check, it does not forward. A workspace setup's own fields and extras (`create_address`'s
 * `forwardTo`) are read by the setup rule below, not here.
 */
const MAILBOX_KEYS: ReadonlySet<string> = new Set([
  'account', 'accounts', 'accountid', 'address', 'addresses', 'email', 'emails', 'mailbox', 'mailboxes',
  'mailboxid', 'forwardto', 'hide', 'show'
])
const READ_AS_LIST: ReadonlySet<string> = new Set(['accounts', 'hide', 'show'])
const keyShape = (key: string): string => key.toLowerCase().replace(/[_-]/g, '')

/**
 * Every mailbox a call names, wherever it names it: any `accountId` at any depth, and the account
 * lists (`accounts`, `hide`, `show`). Fails closed on a value it cannot read — an argument Fabric
 * cannot check is not an argument Fabric forwards — and on a mailbox named under any other key (ER-6).
 * A workspace setup names the address it creates.
 */
export function resourceArguments(
  capability: string,
  input: Record<string, unknown>
): { ok: true; resources: string[]; workspace: string | null; requires: string[] } | { ok: false; reason: string } {
  if (namesPrototype(capability)) return { ok: false, reason: `${capability} is not a capability name (the product's tool name)` }
  const extra = setupExtra(capability)
  if (extra) return { ok: false, reason: `${capability} is a permission Fabric grants, not a tool; call ${extra.tool} with ${extra.field}` }
  const setup = own(WORKSPACE_SETUP, capability)
  const found = new Set<string>()
  let bad: string | null = null
  const visit = (value: unknown, key: string | null, depth: number, top: boolean): void => {
    if (bad || depth > 16) {
      if (!bad && depth > 16) bad = 'the input nests deeper than Fabric checks'
      return
    }
    if (key !== null && PROTOTYPE_NAMES.has(key)) {
      bad = `the input carries a key named ${key}, which Fabric does not forward`
      return
    }
    if (key === 'accountId') {
      const n = typeof value === 'string' ? normaliseInboxAccount(value) : null
      if (!n) bad = `accountId ${JSON.stringify(value)} is not a mailbox Fabric can check`
      else found.add(n)
      return
    }
    if (key !== null && READ_AS_LIST.has(key)) {
      if (!Array.isArray(value)) {
        bad = `${key} must be a list of mailboxes (cloudflare:<address> or gmail:<id>); Fabric cannot check ${JSON.stringify(value)}`
        return
      }
      for (const v of value) {
        const n = typeof v === 'string' ? normaliseInboxAccount(v) : null
        if (!n) { bad = `${key} names ${JSON.stringify(v)}, which is not a mailbox Fabric can check`; return }
        found.add(n)
      }
      return
    }
    // A setup's own fields and extras are its rule's to read (below); anything else naming a mailbox is refused.
    const setupField = top && setup && key !== null && (setup.own.includes(key) || Object.prototype.hasOwnProperty.call(setup.extras, key))
    if (key !== null && !setupField && MAILBOX_KEYS.has(keyShape(key))) {
      bad = `${key} names a mailbox under a key Fabric does not read; name it as accountId (or the accounts list) so Fabric can check it against your grant`
      return
    }
    if (Array.isArray(value)) for (const v of value) visit(v, null, depth + 1, false)
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, k, depth + 1, depth === 0)
  }
  visit(input, null, 0, true)
  if (bad) return { ok: false, reason: bad }
  let workspace: string | null = null
  const requires: string[] = []
  if (setup) {
    workspace = setup.resource(input)
    if (!workspace) return { ok: false, reason: `${capability} must name the address it creates (localPart and domain)` }
    for (const key of Object.keys(input)) {
      if (setup.own.includes(key)) continue
      const e = own(setup.extras, key)
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

/**
 * The server that first applies `X-Fabric-Accounts`, as it names itself at initialize (ER-6, verification
 * iteration 2 for 0.3.1). Fabric Inbox's MCP server answers `serverInfo` {name: 'fabric-inbox', version:
 * <its package version>} (`workers/mcp/handler.ts`); the narrowing header arrived with fabric-inbox#18,
 * before the 0.9.0 version bump — every source that says 0.9.0 or later carries it, 0.8.2 does not. A
 * narrowed call is forwarded only to a server that says it is at least this; anything else, a pre-release
 * of it included, is refused before the tool call is sent.
 */
export const NARROWING_SINCE: Readonly<Record<string, { server: string; version: string }>> = {
  'fabric-inbox': { server: 'fabric-inbox', version: '0.9.0' }
}
export const narrowingSinceOf = (product: string): { server: string; version: string } | undefined => own(NARROWING_SINCE, product)

/** Whether `version` is at least `min` (x.y.z); a pre-release counts as below its release, anything unreadable as below. */
export function versionAtLeast(version: unknown, min: string): boolean {
  const parse = (v: string): [number, number, number, boolean] | null => {
    const m = /^(\d{1,9})\.(\d{1,9})\.(\d{1,9})(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.exec(v)
    return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined] : null
  }
  const a = typeof version === 'string' ? parse(version) : null
  const b = parse(min)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return (a[i] as number) > (b[i] as number)
  return !a[3]
}
export const productName = (id: string): string => PRODUCT_NAMES[id] ?? id

/** The request's registry snapshot (accessService writes it). `kind: 'runner'` is a coding agent of the runner
 *  catalogue (ADR-0134); `project` is the project it asks to work in, as Fabric resolved it — read defensively,
 *  because its `root` and `how` arrive later than its `id` and `name`. */
type RegistrySnapshot = { name?: string; installed_by?: string; repository?: string | null; kind?: string; project?: unknown }

/** Who is asking, as the registry knows it — every field from outside Fabric on one line, or null.
 *  `codingAgent`: a coding agent of the runner catalogue (ADR-0134), said as such — never by its registry id. */
export interface AgentFacts { agentId: string; name: string | null; installedBy: string | null; repository: string | null; codingAgent?: boolean }

export function agentFacts(agentId: string, registry: RegistrySnapshot | null | undefined): AgentFacts {
  const r = registry ?? {}
  return {
    agentId,
    name: oneLine(r.name ?? '', 80) || null,
    installedBy: oneLine(r.installed_by ?? '', 200) || null,
    repository: oneLine(r.repository ?? '', 300) || null,
    ...(r.kind === 'runner' ? { codingAgent: true } : {})
  }
}

// #region enroll-words — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
/** How Fabric matched the agent's folder to the project (`folderResolver.ts`): the admitted folder itself, a folder
 *  inside it, a worktree, a remote clone, or a newly admitted repository. */
export type FolderHow = 'exact' | 'ancestor' | 'worktree' | 'remote' | 'create'
const FOLDER_HOWS: readonly string[] = ['exact', 'ancestor', 'worktree', 'remote', 'create']

/** The project an enrollment snapshot names; every value from the snapshot on one line, or null. */
function enrollProjectOf(registry: RegistrySnapshot | null | undefined): { id: string | null; name: string | null; root: string | null; how: FolderHow | null } | null {
  const p = registry?.project
  if (!p || typeof p !== 'object') return null
  const o = p as Record<string, unknown>
  const text = (v: unknown, max: number): string | null => (typeof v === 'string' ? oneLine(v, max) || null : null)
  return {
    id: typeof o.id === 'string' ? o.id : null,
    name: text(o.name, 120),
    root: text(o.root, 1000),
    how: typeof o.how === 'string' && FOLDER_HOWS.includes(o.how) ? (o.how as FolderHow) : null
  }
}

// A person's home folder on macOS, Linux and Windows. Shared code has no `os.homedir()`, and on a Mac that one
// person uses this is where every project lives; a caller that knows the home passes it instead.
const HOME = /^(\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)(?=$|[/\\])/

/**
 * A folder as a person reads it on one line: the home folder as `~`, and a path longer than `max` kept to its
 * start and its last two folders (`~/…/client/atlas`), so the end — the folder's own name — is never cut off.
 */
export function shortFolder(path: string, home?: string, max = 60): string {
  const flat = oneLine(path, 1000)
  const at = home && (flat === home || flat.startsWith(`${home}/`) || flat.startsWith(`${home}\\`)) ? home.length : (HOME.exec(flat)?.[0].length ?? -1)
  const shown = at >= 0 ? `~${flat.slice(at)}` : flat
  if (shown.length <= max) return shown
  const sep = shown.includes('\\') && !shown.includes('/') ? '\\' : '/'
  const parts = shown.split(sep)
  if (parts.length <= 3) return oneLine(shown, max)
  const tail = parts.slice(-2).join(sep)
  return `${parts[0]}${sep}…${sep}${tail}`
}

/** An enrollment as the operator's screens say it (ADR-0134): the project's name, and — when Fabric resolved it —
 *  the folder the project was found by, already shortened for a person (`shortFolder`). */
export interface EnrollFacts { projectName: string; folder?: { root: string; how: FolderHow | null } }
// #endregion enroll-words
/** ADR-0149 §2: an ask to answer one Project's requests, as the operator's screens say it. */
export interface RespondFacts { projectName: string; capabilities: string[] }

/** The agent's name as shown: the registry's, on one line, or its id. A value, not a sentence. */
export function agentName(agentId: string, registry: RegistrySnapshot | null | undefined): string {
  return agentFacts(agentId, registry).name ?? agentId
}

/**
 * Why connecting a product did not happen, as a CODE the operator's screens phrase (en/ru). `detail` is
 * the machine's own words (Observatory's refusal, the open error) — shown as a secondary detail only.
 * `previousLost`: a Reconnect whose new key was withdrawn after it had already replaced the old record.
 */
export const CONNECT_PROBLEM_CODES = [
  'hub-off', 'already-connected', 'connection-changed', 'busy', 'live-unreadable', 'not-installed', 'no-flow', 'late', 'no-answer',
  'no_server', 'sign_in_required', 'mint_failed', 'unknown', 'invalid-delivery', 'record-failed', 'vault',
  'deadline', 'withdrawn', 'withdraw-failed', 'not-connected', 'vault-unavailable'
] as const
export type ConnectProblemCode = (typeof CONNECT_PROBLEM_CODES)[number]
export interface ConnectProblem { code: ConnectProblemCode; detail?: string; previousLost?: boolean }

/** A request as the operator decides it: the native prompt's facts, structured (UX-2). */
export interface PendingRequestFacts {
  requestId: string
  agent: AgentFacts
  callee: string
  /** The product's display name (a proper name, the same in every language). */
  product: string
  /** Whether the product is connected; when not, Allow also opens its connect flow (UX-4). Always true for an
   *  enrollment: Fabric itself has no connect flow, so its Allow is only Allow (ADR-0134). */
  connected: boolean
  ask: AskLine[]
  /** The agent's own words, one line — shown quoted, as its claim. */
  reason: string
  /** This adds to access the agent already holds. */
  incremental: boolean
  /** ADR-0134: a coding agent asks Fabric itself to work in this project (the name as Fabric read it, and the
   *  folder Fabric resolved it by, when the snapshot carries it). */
  enroll?: EnrollFacts
  /** ADR-0149 §2: an agent asks to answer this Project's requests for these capabilities. */
  respond?: RespondFacts
  requestedAt: string
  expiresAt: string
}

/** A stored request, as much of it as the operator's facts need (accessStore's row, structurally). */
export interface RequestRowLike {
  id: string
  agent_id: string
  callee: string
  capabilities: string[]
  resources: string[]
  reason: string
  asked_by_binding: string | null
  requested_at: string
  expires_at: string
  registry: RegistrySnapshot | null
}

/** One waiting request as facts, for the queue and Settings → Agent access alike (UX-2, UX-4). `home`, when the
 *  caller knows it, is shown as `~` in an enrollment's folder. */
export function pendingFacts(r: RequestRowLike, connected: boolean, home?: string): PendingRequestFacts {
  return {
    requestId: r.id,
    agent: agentFacts(r.agent_id, r.registry),
    callee: r.callee,
    product: productName(r.callee),
    // #region enroll-words — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
    // Fabric itself is never a product to connect: main asks the hub for a connection to every callee, finds none
    // for 'fabric' and passes false, which offered "Allow and connect Fabric" (blind review, 0.4.0 wave 1).
    connected: r.callee === FABRIC_SELF ? true : connected,
    // #endregion enroll-words
    ask: askLines(r),
    reason: oneLine(r.reason, 300),
    incremental: r.asked_by_binding !== null,
    ...(r.callee === FABRIC_SELF && r.capabilities.includes(BOARD_RESPOND) ? { respond: respondFacts(r) } : r.callee === FABRIC_SELF && r.capabilities.includes(SESSION_ENROLL) ? { enroll: enrollFacts(r.registry, home) } : {}),
    requestedAt: r.requested_at,
    expiresAt: r.expires_at
  }
}

function respondFacts(r: RequestRowLike): RespondFacts {
  const line = askLines(r).find((l) => l.kind === 'respond')
  return { projectName: line?.kind === 'respond' ? (line.project.name ?? '') : '', capabilities: line?.kind === 'respond' ? line.capabilities : [] }
}

function enrollFacts(registry: RegistrySnapshot | null, home: string | undefined): EnrollFacts {
  const p = enrollProjectOf(registry)
  return { projectName: p?.name ?? '', ...(p?.root ? { folder: { root: shortFolder(p.root, home), how: p.how } } : {}) }
}

/** What the operator's Agent access list shows (Settings → Agent access). No sentence crosses IPC. */
/** Why the hub is not listening: the port setting is invalid, a registered agent claims the port, another
 *  program holds it, or the surface could not start for another reason. */
export type HubDownCode = 'port-setting' | 'port-claimed' | 'port-taken' | 'not-started'

export interface HubOverview {
  /** `reason` is the machine's own words (with Fabric's English instruction, as sessions are told).
   *  `code` says which cause, so the panel phrases the remedy in the operator's language, and `fact` is the
   *  machine's observation with no instruction in it — the panel's second line (iteration 2, DO-14, UX-5). */
  hub: { listening: true; origin: string } | { listening: false; reason: string; code?: HubDownCode; fact?: string }
  products: Array<{
    product: string
    name: string
    connection: { server: string; level: string; connectedAt: string; keyExpiresAt: string | null } | null
    lastAttempt: { outcome: 'waiting' | 'connected' | 'denied' | 'failed'; at: string; problem?: ConnectProblem; reconnect?: boolean } | null
  }>
  pending: PendingRequestFacts[]
  agents: Array<{
    bindingId: string
    agent: AgentFacts
    since: string
    grants: Array<{ grantId: string; callee: string; capability: string; resource: string; line: AskLine; expiresAt: string }>
  }>
  denials: Array<{ requestId: string; agent: AgentFacts; callee: string; ask: AskLine[]; deniedAt: string | null }>
  /** The coding agents the person disconnected («Отключить», ADR-0160 §3): out of every project until let back in.
   *  `readable: false` says the list could not be read, so nobody is kept out now (fail-open, `keptOut.ts`). */
  keptOut?: { readable: boolean; agents: Array<{ agentId: string; name: string | null; at: string }> }
}

/**
 * The answer to an operator's act. Refused: a code the screen phrases (an `AccessActRefusal`, or a
 * connect `problem`), with `reason` kept for the operations log. Allowed but the product's connect
 * flow could not start: `connect.problem` (UX-5) — the Allow stands.
 */
export type HubActResult =
  | { ok: true; connect?: { problem: ConnectProblem } }
  | { ok: false; reason: string; code?: AccessActRefusal; problem?: ConnectProblem }
// #endregion hub-access
