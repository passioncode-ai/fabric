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
// binding (at most 256 keys each), and only for answers the PRODUCT produced — a refusal Fabric made
// before forwarding is re-decided on the retry (security review of PR #7, finding 5).

import { createHash, randomBytes } from 'node:crypto'
import { accessRefusal, coverage, resourceArguments, CONNECTABLE_PRODUCTS } from '../shared/access.ts'
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

/** Canonical JSON (keys sorted), so one argument set has one hash however it was spelled. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.keys(value as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(value ?? null)
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')

/** One line of at most 300 characters with control characters removed, for the operations log. */
const logLine = (text: string): string => text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').trim().slice(0, 300)

export function createAgentCall(deps: HubCallDeps) {
  const now = deps.now ?? Date.now
  const random = deps.random ?? randomBytes
  // binding id → idempotencyKey → the first answer to it.
  const remembered = new Map<string, Map<string, { argsHash: string; at: number; answer: Promise<{ answer: ToolAnswer; produced: boolean }> }>>()

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

  /** The answer, and whether the PRODUCT produced it — only such an answer is replayed for a retry. */
  async function perform(binding: BindingRow, args: AgentCallArgs, meta: Record<string, unknown> | undefined): Promise<{ answer: ToolAnswer; produced: boolean }> {
    const before = (a: ToolAnswer) => ({ answer: a, produced: false })
    const callId = random(16).toString('hex')
    const incoming = typeof meta?.traceparent === 'string' ? TRACEPARENT.exec(meta.traceparent) : null
    const traceId = incoming ? incoming[2] : random(16).toString('hex')
    const parentSpanId = incoming ? incoming[3] : null
    const spanId = random(8).toString('hex')
    const traceparent = `00-${traceId}-${spanId}-01`
    const base = {
      trace_id: traceId, span_id: spanId, parent_span_id: parentSpanId, trace_incomplete: !incoming,
      caller: { binding_id: binding.id, agent_id: binding.agent_id }, callee: args.agentId, capability: args.capability,
      args_hash: `sha256:${sha256(canonical(args.input))}`
    }
    const started = now()

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
    const cover = coverage({ callee: args.agentId, capability: args.capability, resources: read.resources, workspace: read.workspace, requires: read.requires }, grants, now())
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
    const secret = await deps.vault.read(connection.secret_ref)
    if (!secret.ok) {
      await span({ ...base, outcome: 'failed', error_code: 'product-credential-unavailable', grant_ids: cover.grantIds, wall_ms: now() - started })
      // The vault's reason can carry its tool's own output — paths, slot names, a traceback. The operator
      // reads it in the operations log; the agent is told only what happened and what to do.
      ops.record({ op: 'hub.call', outcome: 'failed', level: 'warn', detail: { callee: args.agentId, capability: args.capability, code: 'product-credential-unavailable', reason: logLine(secret.reason) }, ctx: { correlationId: ops.correlate() } })
      return before(refusal('product-credential-unavailable', `Fabric could not read ${args.agentId}'s key from its vault. Nothing was sent. The operator can see why in Fabric's operations log; try again later.`))
    }
    const forwarded = await deps.forward({
      mcpUrl: connection.mcp_url, clientId: connection.client_id, clientSecret: secret.value,
      narrowing: cover.narrowing, capability: args.capability, input: args.input, traceparent
    })
    const narrowing = cover.narrowing
    if (!forwarded.ok) {
      const written = await span({ ...base, outcome: 'failed', error_code: forwarded.code, grant_ids: cover.grantIds, narrowing: narrowing ?? 'workspace', wall_ms: forwarded.wallMs })
      ops.record({ op: 'hub.call', outcome: 'failed', level: 'warn', detail: { callee: args.agentId, capability: args.capability, code: forwarded.code, span_written: written }, ctx: { correlationId: ops.correlate() } })
      // Not the product's answer: unreachable, refused at the door, or a transport failure. A retry with
      // the same key must reach the product again rather than be told this for a day.
      return before(refusal(forwarded.code, `${args.agentId} could not be reached for ${args.capability}: ${forwarded.message}`))
    }
    const outcome = forwarded.result.isError ? 'failed' : 'succeeded'
    const written = await span({ ...base, outcome, error_code: forwarded.result.isError ? 'product-error' : null, grant_ids: cover.grantIds, narrowing: narrowing ?? 'workspace', wall_ms: forwarded.wallMs })
    ops.record({ op: 'hub.call', outcome: 'ok', detail: { callee: args.agentId, capability: args.capability, product_outcome: outcome, wall_ms: forwarded.wallMs, span_written: written }, ctx: { correlationId: ops.correlate() } })
    const output = forwarded.result.structuredContent ?? { content: forwarded.result.content ?? [] }
    return { answer: answer(envelope({ callId, outcome, binding, callee: args.agentId, capability: args.capability, narrowing, grantIds: cover.grantIds, output, wallMs: forwarded.wallMs, traceparent, spanWritten: written }), forwarded.result.isError === true), produced: true }
  }

  return async function agentCall(binding: BindingRow, args: AgentCallArgs, meta: Record<string, unknown> | undefined): Promise<ToolAnswer> {
    if (!args.idempotencyKey) return (await perform(binding, args, meta)).answer
    const t = now()
    let mine = remembered.get(binding.id)
    if (mine) {
      for (const [k, v] of mine) if (t - v.at > IDEMPOTENCY_TTL_MS) mine.delete(k)
    } else {
      mine = new Map()
      remembered.set(binding.id, mine)
    }
    const argsHash = sha256(canonical({ agentId: args.agentId, capability: args.capability, input: args.input }))
    const seen = mine.get(args.idempotencyKey)
    if (seen) {
      if (seen.argsHash !== argsHash)
        return refusal('idempotency-conflict', 'this idempotencyKey was already used for a different call; use a new key for a new call')
      return (await seen.answer).answer
    }
    // The oldest of THIS binding's keys goes; another binding's never does.
    if (mine.size >= IDEMPOTENCY_MAX_PER_BINDING) mine.delete(mine.keys().next().value as string)
    const answering = perform(binding, args, meta)
    const key = args.idempotencyKey
    const entry = { argsHash, at: t, answer: answering }
    mine.set(key, entry) // a retry while this one is in flight waits for it rather than sending twice
    const forget = (): void => {
      if (mine.get(key) === entry) mine.delete(key)
      if (mine.size === 0 && remembered.get(binding.id) === mine) remembered.delete(binding.id)
    }
    // Only an answer the product produced is kept: a refusal made before forwarding (no grant yet, not
    // connected, no key, unreachable) is the state of Fabric at that moment, and the retry after the
    // operator acts must be checked again. A call that THREW is no answer either.
    answering.then((r) => { if (!r.produced) forget() }, forget)
    return (await answering).answer
  }
}
// #endregion hub-call
