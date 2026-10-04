// #region hub-call — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#5-every-forwarded-call-is-narrowed-twice
// `agent.call` (fabric-interop/0.1 C3.5) for a binding credential, routed to a connected product
// (ADR-0115 §5). In order, and each step refuses rather than guessing:
//
//   1. the callee is a product Fabric connects (today, Fabric Inbox);
//   2. every mailbox the input names is read (any `accountId`, the account lists) — one Fabric cannot
//      read refuses the call;
//   3. the caller's LIVE grants cover the capability and every one of those mailboxes — otherwise
//      `access-required`, carrying the fabric.access.request arguments that would ask for it;
//   4. the product is connected, and its secret comes out of the vault for this call only;
//   5. the call is forwarded narrowed to the granted mailboxes (`X-Fabric-Accounts`), or — a workspace
//      setup the grant names as its own capability — without the header, carrying only the created
//      thing's own fields plus each extra (`create_address.forward_to`, …) granted for that address;
//   6. one journal span per hop (`hub.call.forwarded@1`), a child of the caller's `_meta.traceparent`,
//      with the caller's binding, the callee and capability, a hash of the arguments (never the
//      arguments), the grants that allowed it and the outcome — refusals included;
//   7. the answer is the interop result envelope, the product's output inside it.
//
// `idempotencyKey`: a retry with the same key and the same arguments returns the first answer and
// sends nothing; the same key with different arguments is refused. Kept in memory for 24 hours, per
// binding (at most 256 retained keys each; fresh work is refused when full). A remembered answer is
// replayed only while the grant that
// allowed it still covers the call and the product is still connected: revoking stops the next call, a
// retried key included (ER-5, verification iteration 1 for 0.3.1) — and the key is NOT forgotten for it,
// so an Allow given again replays the first answer rather than sending a second time.
//
// A KEY WHOSE CALL MAY HAVE RUN IS NEVER SENT AGAIN (ER-1, verification iteration 2 for 0.3.1). The key
// is not carried to the product — Fabric Inbox honours no per-call key of its own, only its sending tools'
// own `idempotencyKey` argument — so Fabric itself remembers what became of it. A refusal Fabric made
// before forwarding (no grant yet, not connected, no key, a caller gone before the forward) is forgotten
// and re-decided on the retry (security review of PR #7, finding 5). A forward that provably sent nothing
// (`reached: false` — it failed before the tool call left Fabric) is forgotten too. Anything else that
// ended without the product's answer — a cancel, the 60 s deadline, a lost connection, a redirect after
// the call went out, and a forwarder that does not say — MAY HAVE RUN: it is answered `outcome-unknown`,
// typed and final: every later call with that key in this process sends nothing. Unknown keys do not
// expire; restarting Fabric requires caller reconciliation before retry. Before this,
// such a key was forgotten while the tool told the agent to retry with it, and the retry sent the mail a
// second time. The memory lives in this process: after Fabric restarts, a key from before is unknown to
// it. hub.json's startedAt plus pid are observational restart markers, never identity or authority.
// After a restart, reconcile the product effect before retrying a prior call.
//
// THE MEMORY IS BOUNDED IN BYTES AND IN TIME (DA-3). An answer larger than 256 KiB is not kept whole, and
// past 32 MiB across every binding the oldest kept answers are reduced the same way: the key is still
// remembered as having run, and a retry is answered `answer-not-kept` — never replayed whole, never sent
// again. Answered/ran keys expire after 24 hours and are swept at most once a minute; unknown keys
// last for this process. A revoked binding loses its cached answer bodies, while its effect facts
// remain and the binding is retired permanently (`forgetBinding`, called after durable revocation).
//
// THE PRODUCT'S OWN ERROR TEXT IS NOT THE AGENT'S (ER-11). It can echo the request's headers; the agent
// hears one fixed sentence per code, and the product's words — the secret and the client id removed — go
// to the operations log.
//
// EVERY HOP HAS ITS SPAN, a throw included (ER-11): input nested deeper than 16 levels is refused as
// invalid-arguments before anything is hashed, and a failure Fabric could not get past is a `failed`
// span with error_code `hub-unavailable` and a fixed sentence — the cause goes to the operations log.
//
// A CALLER THAT HANGS UP stops the hop (ER-13): the MCP request's signal reaches the forward, nothing is
// read from the vault or sent once it has fired, and the span says `cancelled`.

import { createHash, randomBytes } from 'node:crypto'
import { accessRefusal, coverage, narrowingSinceOf, productName, resourceArguments, CONNECTABLE_PRODUCTS } from '../shared/access.ts'
import type { AccessService } from './accessService.ts'
import type { AccessActor, AccessStore, BindingRow, ConnectionRow } from './accessStore.ts'
import type { AgentCallArgs, ToolAnswer } from './hubTools.ts'
import { answer, refusal } from './hubTools.ts'
import type { VaultPort } from './observatoryVault.ts'
import type { ForwardAnswer, ForwardRequest } from './productForwarder.ts'
import { ops } from './opsSink.ts'

const TRACEPARENT = /^(?!ff)([0-9a-f]{2})-(?!0{32})([0-9a-f]{32})-(?!0{16})([0-9a-f]{16})-([0-9a-f]{2})$/
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
/** Per binding: one binding's keys can never push another binding's out. */
const IDEMPOTENCY_MAX_PER_BINDING = 256
/** An answer larger than this is not kept whole; its key is remembered as having run (DA-3). */
export const MAX_KEPT_ANSWER_BYTES = 256 * 1024
/** Every binding's kept answers together; past it the oldest are reduced to "ran, answer not kept" (DA-3). */
export const MAX_KEPT_TOTAL_BYTES = 32 * 1024 * 1024
const SWEEP_EVERY_MS = 60_000

/** What becomes of an idempotency key once its call is answered. */
type Keep = 'answer' | 'unknown' | 'forget'
interface Outcome { answer: ToolAnswer; keep: Keep }
interface Remembered {
  argsHash: string
  at: number
  state: 'inflight' | 'answered' | 'ran' | 'unknown'
  /** The answer replayed (`answered`), or the outcome-unknown refusal (`unknown`). */
  kept: ToolAnswer | null
  bytes: number
  settled: Promise<unknown>
}
const HUB_ACTOR: AccessActor = { kind: 'system', id: 'fabric-hub' }

export interface HubCallDeps {
  access: Pick<AccessService, 'liveGrantsOf'>
  store: Pick<AccessStore, 'liveConnection' | 'append'>
  vault: Pick<VaultPort, 'read'>
  forward: (req: ForwardRequest) => Promise<ForwardAnswer>
  estateId: string
  now?: () => number
  random?: (n: number) => Buffer
}

/** Deeper than this, an input is refused before it is hashed or read (the same bound `resourceArguments` holds). */
const MAX_INPUT_DEPTH = 16

/** Whether a JSON value nests deeper than `limit` — iterative, so an absurd input cannot exhaust the stack. */
export function nestsDeeperThan(value: unknown, limit: number): boolean {
  const stack: Array<[unknown, number]> = [[value, 0]]
  while (stack.length) {
    const [v, d] = stack.pop() as [unknown, number]
    if (!v || typeof v !== 'object') continue
    if (d >= limit) return true
    for (const child of Array.isArray(v) ? v : Object.values(v as Record<string, unknown>)) stack.push([child, d + 1])
  }
  return false
}

/** Canonical JSON (keys sorted), so one argument set has one hash however it was spelled. Call only on bounded input. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(value ?? null)
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')

/** One line of at most 300 characters with control characters removed, for the operations log. */
const logLine = (text: string): string => text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').trim().slice(0, 300)

/** Product output is untrusted JSON. Bound traversal before recursive JSON serialization. */
const MAX_PRODUCT_DEPTH = 64
const MAX_PRODUCT_NODES = 100_000
const MAX_PRODUCT_BYTES = 4 * 1024 * 1024
const scrubProductText = (text: string, secret: string, clientId: string): string => {
  let clean = secret ? text.split(secret).join('«redacted»') : text
  if (clientId) clean = clean.split(clientId).join('«client id»')
  return clean
}
function boundedProductOutput(value: unknown, secret: string, clientId: string): unknown {
  let nodes = 0, bytes = 0
  const seen = new WeakSet<object>()
  const copy = (v: unknown, depth: number): unknown => {
    if (++nodes > MAX_PRODUCT_NODES || depth > MAX_PRODUCT_DEPTH) throw new Error('product answer exceeds its structural bound')
    if (v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) { bytes += 8; return v }
    if (typeof v === 'string') {
      bytes += Buffer.byteLength(JSON.stringify(v), 'utf8')
      if (bytes > MAX_PRODUCT_BYTES) throw new Error('product answer exceeds its byte bound')
      return scrubProductText(v, secret, clientId)
    }
    if (typeof v !== 'object' || seen.has(v)) throw new Error('product answer is not JSON')
    seen.add(v)
    // Bound keys/array lengths before allocating their copy; each member must consume a node.
    const keys = Object.keys(v)
    if (keys.length > MAX_PRODUCT_NODES - nodes) throw new Error('product answer exceeds its node bound')
    const out: unknown[] | Record<string, unknown> = Array.isArray(v) ? [] : {}
    for (const key of keys) {
      bytes += Buffer.byteLength(JSON.stringify(key), 'utf8') + 8
      if (bytes > MAX_PRODUCT_BYTES) throw new Error('product answer exceeds its byte bound')
      Object.defineProperty(out, scrubProductText(key, secret, clientId), { value: copy((v as Record<string, unknown>)[key], depth + 1), enumerable: true, configurable: true, writable: true })
    }
    seen.delete(v)
    return out
  }
  return copy(value, 0)
}

/** The agent's sentence for a forward that provably sent nothing (ER-11): fixed per code, never the product's text. */
function notSent(code: string, callee: string, capability: string): string {
  const name = productName(callee)
  switch (code) {
    case 'product-refused':
      return `${name} refused Fabric's key before ${capability} ran, so nothing ran. The operator can see why in Fabric's operations log; if the key was revoked in ${name}, reconnecting it in Settings → Agent access fixes that.`
    case 'product-outdated':
      return `${name}'s server is older than 0.9.0, so it cannot narrow a call to the mailboxes you were granted; Fabric sent nothing. The operator must update the ${name} server (and then reconnect it in Settings → Agent access).`
    case 'product-unreachable':
      return `${name} could not be reached for ${capability}, and nothing reached it. A retry can succeed later.`
    default:
      return `${name} could not take ${capability}, and nothing ran. The operator can see why in Fabric's operations log.`
  }
}

/** The answer to a call that may have run (ER-1): typed, final, and it says how to find out. */
function outcomeUnknown(callee: string, capability: string, cause: string): ToolAnswer {
  const name = productName(callee)
  return refusal(
    'outcome-unknown',
    `${capability} may have run in ${name}: the call may have reached it and no usable answer is available (${cause}). Do not send it again — this idempotencyKey is refused from now on, and a new key would act twice. Check its effect with ${name}'s own read tools (for mail, get_send_status) before you act again.`,
    { cause, mayHaveRun: true }
  )
}

export function createAgentCall(deps: HubCallDeps) {
  const now = deps.now ?? Date.now
  const random = deps.random ?? randomBytes
  // binding id → idempotencyKey → what became of it.
  const remembered = new Map<string, Map<string, Remembered>>()
  const retiredBindings = new Set<string>()
  // Every kept answer, oldest first, across bindings: the order the byte bound reduces them in (DA-3).
  const keptOrder = new Set<Remembered>()
  let keptBytes = 0
  let lastSweep = now()

  const span = async (fields: Record<string, unknown>): Promise<boolean> => {
    try {
      await deps.store.append('hub.call.forwarded@1', HUB_ACTOR, fields)
      return true
    } catch (e) {
      // The call's answer stands; the missing span is said in the envelope's notVerified and here.
      ops.failed('hub.call.span', e, { callee: fields.callee, capability: fields.capability })
      return false
    }
  }

  const envelope = (input: {
    callId: string; outcome: 'succeeded' | 'failed'; binding: BindingRow; callee: string; capability: string
    narrowing: string[] | null; grantIds: string[]; output: unknown; wallMs: number; traceparent: string; spanWritten: boolean
  }): Record<string, unknown> => {
    const createdAt = new Date(now()).toISOString()
    return {
      id: `urn:fabric:hub-call:${input.callId}`,
      contractVersion: '0.1.0',
      outcome: input.outcome,
      done: input.outcome === 'succeeded' ? [{ claimId: 'FORWARDED', statement: `${input.callee} answered ${input.capability}` }] : [],
      proof: [],
      scope: {
        project: `urn:fabric:estate:${deps.estateId}`,
        run: `urn:fabric:hub-call:${input.callId}`,
        node: `urn:fabric:callee:${input.callee}`,
        binding: { id: `urn:fabric:binding:${input.binding.id}`, revision: 1, contentHash: `sha256:${sha256(input.grantIds.slice().sort().join(','))}` },
        writeScopes: input.narrowing ?? ['workspace']
      },
      notVerified: [
        { claim: `what ${input.callee} did`, reason: 'Fabric forwarded the call and carries the product\'s answer; it did not observe the effect itself' },
        ...(input.spanWritten ? [] : [{ claim: 'the journal span of this hop', reason: 'the span could not be written; see the operations log' }])
      ],
      artifacts: [],
      output: input.output,
      usage: { inputTokens: 0, outputTokens: 0, wallMs: input.wallMs },
      trace: { traceparent: input.traceparent },
      createdAt,
      producer: { id: 'urn:fabric:hub', revision: 1, contentHash: `sha256:${sha256('fabric-hub/0.1')}` }
    }
  }

  /**
   * The answer, and what the idempotency memory keeps of it. `replay` is a remembered answer: the call is
   * decided again (grants, connection) and, where it would have been forwarded, answered from memory.
   */
  async function perform(binding: BindingRow, args: AgentCallArgs, meta: Record<string, unknown> | undefined, signal?: AbortSignal, replay?: ToolAnswer): Promise<Outcome> {
    const before = (a: ToolAnswer): Outcome => ({ answer: a, keep: 'forget' })
    const callId = random(16).toString('hex')
    const incoming = typeof meta?.traceparent === 'string' ? TRACEPARENT.exec(meta.traceparent) : null
    const traceId = incoming ? incoming[2] : random(16).toString('hex')
    const parentSpanId = incoming ? incoming[3] : null
    const spanId = random(8).toString('hex')
    const traceparent = `00-${traceId}-${spanId}-01`
    const tooDeep = nestsDeeperThan(args.input, MAX_INPUT_DEPTH)
    const base = {
      trace_id: traceId, span_id: spanId, parent_span_id: parentSpanId, trace_incomplete: !incoming,
      caller: { binding_id: binding.id, agent_id: binding.agent_id }, callee: args.agentId, capability: args.capability,
      args_hash: tooDeep ? null : `sha256:${sha256(canonical(args.input))}`
    }
    const started = now()
    if (tooDeep) {
      await span({ ...base, outcome: 'refused', error_code: 'invalid-arguments', grant_ids: [], wall_ms: 0 })
      return before(refusal('invalid-arguments', `the input nests deeper than ${MAX_INPUT_DEPTH} levels; nothing was sent`))
    }
    const effect = { mayHaveRun: false }
    try {
      return await hop(binding, args, base, started, callId, traceparent, signal, replay, effect)
    } catch (e) {
      // Not the product's answer and not a refusal Fabric decided: a read or a write here failed. The
      // agent hears one fixed sentence; the cause (which may name tables, paths or a stack) is logged.
      // A forward or result-processing exception proves no absence of effect. Never expose its raw
      // text: it may echo the credential that was just sent.
      ops.failed('hub.call', effect.mayHaveRun ? new Error('forward or product answer processing failed') : e, { callee: args.agentId, capability: args.capability })
      if (effect.mayHaveRun) {
        await span({ ...base, outcome: 'failed', error_code: 'outcome-unknown', grant_ids: [], wall_ms: now() - started })
        return { answer: outcomeUnknown(args.agentId, args.capability, 'product-error'), keep: 'unknown' }
      }
      await span({ ...base, outcome: 'failed', error_code: 'hub-unavailable', grant_ids: [], wall_ms: now() - started })
      return before(refusal('hub-unavailable', 'Fabric could not complete this call just now. Nothing was sent. The operator can see why in Fabric\'s operations log; try again later.'))
    }
  }

  /** A caller that hung up before the forward: nothing left Fabric, so the key is forgotten. */
  const cancelledBefore = async (base: Record<string, unknown>, grantIds: string[], started: number): Promise<Outcome> => {
    await span({ ...base, outcome: 'cancelled', error_code: 'cancelled', grant_ids: grantIds, wall_ms: now() - started })
    return { answer: refusal('cancelled', 'the call was cancelled by its caller before it reached the product; nothing was sent', { mayHaveRun: false }), keep: 'forget' }
  }

  async function hop(
    binding: BindingRow, args: AgentCallArgs, base: Record<string, unknown>, started: number,
    callId: string, traceparent: string, signal: AbortSignal | undefined, replay: ToolAnswer | undefined, effect: { mayHaveRun: boolean }
  ): Promise<Outcome> {
    const before = (a: ToolAnswer): Outcome => ({ answer: a, keep: 'forget' })
    if (signal?.aborted) return cancelledBefore(base, [], started)

    if (!(CONNECTABLE_PRODUCTS as readonly string[]).includes(args.agentId)) {
      await span({ ...base, outcome: 'refused', error_code: 'unknown-callee', grant_ids: [], wall_ms: 0 })
      return before(refusal('unknown-callee', `Fabric routes agent.call to connected products only (${CONNECTABLE_PRODUCTS.join(', ')}); ${args.agentId} is not one`))
    }
    const read = resourceArguments(args.capability, args.input)
    if (!read.ok) {
      await span({ ...base, outcome: 'refused', error_code: 'invalid-arguments', grant_ids: [], wall_ms: 0 })
      return before(refusal('invalid-arguments', read.reason))
    }
    const grants = await deps.access.liveGrantsOf(binding)
    let cover = coverage({ callee: args.agentId, capability: args.capability, resources: read.resources, workspace: read.workspace, requires: read.requires }, grants, now())
    if (!cover.ok) {
      await span({ ...base, outcome: 'refused', error_code: 'access-required', grant_ids: [], wall_ms: 0 })
      const r = accessRefusal({ agentId: binding.agent_id, callee: args.agentId, capability: args.capability, capabilities: cover.ask, resources: cover.missing, why: cover.reason })
      return before(answer(r, true))
    }
    let connection: ConnectionRow | null
    connection = await deps.store.liveConnection(args.agentId)
    if (!connection) {
      await span({ ...base, outcome: 'refused', error_code: 'product-not-connected', grant_ids: cover.grantIds, wall_ms: 0 })
      return before(refusal('product-not-connected', `${args.agentId} is not connected to Fabric. Ask the operator to connect it (Settings → Agent access → Connect); nothing was sent.`))
    }
    // Still covered and still connected: a remembered answer is given again, and nothing is sent.
    if (replay) {
      ops.record({ op: 'hub.call.replayed', outcome: 'ok', detail: { callee: args.agentId, capability: args.capability }, ctx: { correlationId: ops.correlate() } })
      return { answer: replay, keep: 'answer' }
    }
    if (signal?.aborted) return cancelledBefore(base, cover.grantIds, started)
    const secret = await deps.vault.read(connection.secret_ref, { signal })
    if (!secret.ok) {
      if (signal?.aborted) return cancelledBefore(base, cover.grantIds, started)
      await span({ ...base, outcome: 'failed', error_code: 'product-credential-unavailable', grant_ids: cover.grantIds, wall_ms: now() - started })
      // The vault's reason can carry its tool's own output — paths, slot names, a traceback. The operator
      // reads it in the operations log; the agent is told only what happened and what to do.
      ops.record({ op: 'hub.call', outcome: 'failed', level: 'warn', detail: { callee: args.agentId, capability: args.capability, code: 'product-credential-unavailable', reason: logLine(secret.reason) }, ctx: { correlationId: ops.correlate() } })
      return before(refusal('product-credential-unavailable', `Fabric could not read ${args.agentId}'s key from its vault. Nothing was sent. The operator can see why in Fabric's operations log; try again later.`))
    }
    if (signal?.aborted) return cancelledBefore(base, cover.grantIds, started)
    // The vault may have queued this call for seconds. Re-decide against live authority and the
    // exact connection whose credential was read, immediately before entering the forwarder.
    const [currentGrants, currentConnection] = await Promise.all([
      deps.access.liveGrantsOf(binding), deps.store.liveConnection(args.agentId)
    ])
    if (retiredBindings.has(binding.id)) return before(refusal('binding-revoked', 'This binding was revoked while Fabric read the product key. Nothing was sent.'))
    cover = coverage({ callee: args.agentId, capability: args.capability, resources: read.resources, workspace: read.workspace, requires: read.requires }, currentGrants, now())
    if (!cover.ok) {
      await span({ ...base, outcome: 'refused', error_code: 'access-required', grant_ids: [], wall_ms: now() - started })
      return before(answer(accessRefusal({ agentId: binding.agent_id, callee: args.agentId, capability: args.capability, capabilities: cover.ask, resources: cover.missing, why: cover.reason }), true))
    }
    if (!currentConnection || currentConnection.id !== connection.id || currentConnection.mcp_url !== connection.mcp_url || currentConnection.client_id !== connection.client_id || canonical(currentConnection.secret_ref) !== canonical(connection.secret_ref)) {
      await span({ ...base, outcome: 'refused', error_code: 'product-not-connected', grant_ids: cover.grantIds, wall_ms: now() - started })
      return before(refusal('product-not-connected', 'The product connection changed while Fabric read its key. Nothing was sent; retry against the current connection.'))
    }
    if (signal?.aborted) return cancelledBefore(base, cover.grantIds, started)
    effect.mayHaveRun = true // No exception from this point proves that the tool did not run.
    const forwarded = await deps.forward({
      mcpUrl: connection.mcp_url, clientId: connection.client_id, clientSecret: secret.value,
      narrowing: cover.narrowing, narrowingSince: narrowingSinceOf(args.agentId), capability: args.capability, input: args.input, traceparent, signal
    })
    const narrowing = cover.narrowing
    if (!forwarded.ok) {
      effect.mayHaveRun = forwarded.reached !== false
      const productText = logLine(scrubProductText(forwarded.message, secret.value, connection.client_id))
      // A forwarder that does not say whether the call left Fabric is read as "it may have" — fail closed.
      const mayHaveRun = forwarded.reached !== false
      const hungUp = forwarded.code === 'cancelled' || signal?.aborted === true
      const written = await span({
        ...base, outcome: hungUp ? 'cancelled' : 'failed', error_code: mayHaveRun ? 'outcome-unknown' : forwarded.code,
        grant_ids: cover.grantIds, narrowing: narrowing ?? 'workspace', wall_ms: forwarded.wallMs
      })
      ops.record({ op: 'hub.call', outcome: 'failed', level: 'warn', detail: { callee: args.agentId, capability: args.capability, code: forwarded.code, may_have_run: mayHaveRun, product_said: productText, span_written: written }, ctx: { correlationId: ops.correlate() } })
      if (mayHaveRun) return { answer: outcomeUnknown(args.agentId, args.capability, hungUp ? 'cancelled' : forwarded.code), keep: 'unknown' }
      if (hungUp) return { answer: refusal('cancelled', 'the call was cancelled by its caller before it reached the product; nothing was sent', { mayHaveRun: false }), keep: 'forget' }
      // Nothing left Fabric: a retry, with this key or another, must reach the product again.
      return before(refusal(forwarded.code, notSent(forwarded.code, args.agentId, args.capability), { mayHaveRun: false }))
    }
    // Tool errors carry fixed text, never product debug output. Success is copied only after its
    // depth, node and byte bounds are checked, with credential echoes removed from every string.
    const output = forwarded.result.isError
      ? { error: { code: 'product-error', message: 'The product reported an error. Check its effect with the product’s read tools before retrying.' } }
      : boundedProductOutput(forwarded.result.structuredContent ?? { content: forwarded.result.content ?? [] }, secret.value, connection.client_id)
    const outcome = forwarded.result.isError ? 'failed' : 'succeeded'
    const written = await span({ ...base, outcome, error_code: forwarded.result.isError ? 'product-error' : null, grant_ids: cover.grantIds, narrowing: narrowing ?? 'workspace', wall_ms: forwarded.wallMs })
    ops.record({ op: 'hub.call', outcome: 'ok', detail: { callee: args.agentId, capability: args.capability, product_outcome: outcome, wall_ms: forwarded.wallMs, span_written: written }, ctx: { correlationId: ops.correlate() } })
    return { answer: answer(envelope({ callId, outcome, binding, callee: args.agentId, capability: args.capability, narrowing, grantIds: cover.grantIds, output, wallMs: forwarded.wallMs, traceparent, spanWritten: written }), forwarded.result.isError === true), keep: 'answer' }
  }

  // ── the idempotency memory (ER-1, DA-3) ─────────────────────────────────────────────────────────────
  const drop = (entry: Remembered): void => {
    if (keptOrder.delete(entry)) keptBytes -= entry.bytes
    entry.bytes = 0
  }
  const remove = (bindingId: string, key: string, entry: Remembered): void => {
    const mine = remembered.get(bindingId)
    if (mine?.get(key) !== entry) return
    mine.delete(key)
    drop(entry)
    if (mine.size === 0) remembered.delete(bindingId)
  }
  /** The oldest kept answers are reduced to "ran" until the whole memory is under its byte bound. */
  const reduceToBound = (): void => {
    for (const e of keptOrder) {
      if (keptBytes <= MAX_KEPT_TOTAL_BYTES) break
      drop(e)
      e.kept = null
      e.state = 'ran'
    }
  }
  const sweep = (t: number): void => {
    if (t - lastSweep < SWEEP_EVERY_MS) return
    lastSweep = t
    for (const [bindingId, mine] of remembered)
      for (const [key, e] of mine) if (e.state !== 'inflight' && e.state !== 'unknown' && t - e.at > IDEMPOTENCY_TTL_MS) remove(bindingId, key, e)
  }
  const settle = (bindingId: string, key: string, entry: Remembered, o: Outcome): void => {
    if (o.keep === 'forget') return remove(bindingId, key, entry)
    if (retiredBindings.has(bindingId) && o.keep !== 'unknown') {
      drop(entry)
      entry.state = 'ran'
      entry.kept = null
      return
    }
    if (o.keep === 'unknown') {
      entry.state = 'unknown'
      entry.kept = o.answer
      return
    }
    const bytes = Buffer.byteLength(JSON.stringify(o.answer), 'utf8')
    if (bytes > MAX_KEPT_ANSWER_BYTES) {
      entry.state = 'ran'
      entry.kept = null
      return
    }
    entry.state = 'answered'
    entry.kept = o.answer
    entry.bytes = bytes
    keptOrder.add(entry)
    keptBytes += bytes
    reduceToBound()
  }
  const notKept = (callee: string, capability: string): ToolAnswer =>
    refusal(
      'answer-not-kept',
      `this idempotencyKey's call already ran: ${productName(callee)} answered ${capability}, and the answer was too large for Fabric to keep, so it is not given again and the call is not sent again. Read the result with the product's own read tools; use a new key only for a new call.`,
      { mayHaveRun: true }
    )

  async function agentCall(binding: BindingRow, args: AgentCallArgs, meta: Record<string, unknown> | undefined, signal?: AbortSignal): Promise<ToolAnswer> {
    if (retiredBindings.has(binding.id)) return refusal('binding-revoked', 'This binding was revoked by the operator. Nothing was sent; request new access with a new binding.')
    // Too deep to hash: refused (with its span) before the idempotency memory hashes it.
    if (!args.idempotencyKey || nestsDeeperThan(args.input, MAX_INPUT_DEPTH)) return (await perform(binding, args, meta, signal)).answer
    const key = args.idempotencyKey
    const t = now()
    sweep(t)
    const argsHash = sha256(canonical({ agentId: args.agentId, capability: args.capability, input: args.input }))
    for (;;) {
      const seen = remembered.get(binding.id)?.get(key)
      if (!seen) break
      if (t - seen.at > IDEMPOTENCY_TTL_MS && seen.state !== 'inflight' && seen.state !== 'unknown') {
        remove(binding.id, key, seen)
        break
      }
      if (seen.argsHash !== argsHash)
        return refusal('idempotency-conflict', 'this idempotencyKey was already used for a different call; use a new key for a new call')
      // A retry while the first is in flight waits for it rather than sending twice, then reads what it left.
      if (seen.state === 'inflight') {
        await seen.settled
        continue
      }
      if (seen.state === 'unknown') return seen.kept as ToolAnswer
      // Decided again against the live grants and connection; where it would be forwarded, the memory
      // answers instead. Whatever this answers, the key keeps what it knows: it ran.
      const replay = seen.state === 'answered' && seen.kept ? seen.kept : notKept(args.agentId, args.capability)
      return (await perform(binding, args, meta, signal, replay)).answer
    }
    let mine = remembered.get(binding.id)
    if (!mine) {
      mine = new Map()
      remembered.set(binding.id, mine)
    }
    // Capacity is an admission limit, not permission to forget a possible effect. Inflight, unknown,
    // answered and answer-not-kept keys all occupy slots. Existing-key replay was handled above.
    if (mine.size >= IDEMPOTENCY_MAX_PER_BINDING)
      return refusal('idempotency-capacity', 'Fabric cannot safely remember another call for this binding. Nothing was sent. Reconcile prior outcomes before making more calls.', { mayHaveRun: false })
    const entry: Remembered = { argsHash, at: t, state: 'inflight', kept: null, bytes: 0, settled: Promise.resolve() }
    mine.set(key, entry)
    const answering = perform(binding, args, meta, signal)
    entry.settled = answering.then((o) => {
      try { settle(binding.id, key, entry, o) } catch {
        drop(entry)
        entry.state = 'unknown'
        entry.kept = outcomeUnknown(args.agentId, args.capability, 'product-error')
      }
    }, () => {
      entry.state = 'unknown'
      entry.kept = outcomeUnknown(args.agentId, args.capability, 'product-error')
    })
    const o = await answering
    await entry.settled
    return o.answer
  }

  /** Called after durable, irreversible binding revocation: release output, never erase effect facts. */
  function forgetBinding(bindingId: string): void {
    retiredBindings.add(bindingId)
    const mine = remembered.get(bindingId)
    if (!mine) return
    for (const e of mine.values()) {
      drop(e)
      if (e.state === 'answered') { e.state = 'ran'; e.kept = null }
    }
  }

  /** What the memory holds now — for the operations log and the tests. */
  function memory(): { keys: number; bytes: number; bindings: number } {
    let keys = 0
    for (const mine of remembered.values()) keys += mine.size
    return { keys, bytes: keptBytes, bindings: remembered.size }
  }

  return Object.assign(agentCall, { forgetBinding, memory })
}
// #endregion hub-call
