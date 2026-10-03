// #region hub-consent — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#2-an-agent-is-admitted-by-device-style-consent-not-by-a-pasted-key
// Device-style consent for a registered agent (ADR-0115 §2–§3): the agent asks, the operator decides
// once, the agent collects a binding credential exactly once, and every later call is checked against
// standing grants the operator can revoke.
//
// WHAT IS TRUSTED, AND WHAT IS ONLY CLAIMED. The registry entry is read by Fabric from disk; the
// request's `reason` is the agent's own words and is shown as such. Every process on this Mac runs as
// the same user, so Fabric can prove that an agent with this id is INSTALLED and cannot prove which
// process is asking — the prompt says "an agent registered as <id>" for exactly that reason.
//
// FAIL CLOSED, EVERYWHERE. An unknown agent is refused before any prompt. A read that fails refuses
// rather than reading as "no grant". A decision on an expired request is refused. A credential is
// minted on the first status read after an Allow (32 random bytes; Fabric keeps the sha256) and never
// again — two reads cannot both win, because every write here runs one at a time and the projector
// refuses a second claim.

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import {
  ACCESS_REQUEST_TTL_MS,
  CREDENTIAL_CLAIM_WINDOW_MS,
  GRANT_TTL_MS,
  normaliseAccessRequest,
  requestSignature,
  type AccessAsk
} from '../shared/access.ts'
import type { AccessActor, AccessRequestRow, AccessStore, BindingRow, GrantRow } from './accessStore.ts'
import type { Resolution } from './agentRegistry.ts'
import { ops } from './opsSink.ts'

/** Who is speaking to the hub: the door token (may only ask), or a binding (may call). */
export type HubPrincipal = { kind: 'door' } | { kind: 'binding'; binding: BindingRow }

export type RequestAnswer =
  | { ok: true; requestId: string; status: 'pending' | 'denied'; expiresAt: string; note: string }
  | { ok: false; refused: string }

export type StatusAnswer =
  | {
      ok: true
      requestId: string
      status: 'pending' | 'allowed' | 'denied' | 'expired'
      expiresAt: string
      credential?: string
      bindingId?: string
      grants?: Array<{ capability: string; resource: string; expiresAt: string }>
      note: string
    }
  | { ok: false; refused: string }

export interface ConsentRequest {
  row: AccessRequestRow
  /** Whether the callee is connected to Fabric; when not, Allow also starts the product's connect flow. */
  connected: boolean
}

export interface AccessServiceDeps {
  store: AccessStore
  registry: { refresh(): unknown; resolve(agentId: string): Resolution }
  /** Shows the request to the operator (dialog, or notification + queue). Never awaited by the agent. */
  present: (request: ConsentRequest) => void
  /** Whether a product is connected; a read that fails throws. */
  connected: (product: string) => Promise<boolean>
  now?: () => number
  random?: (bytes: number) => Buffer
  /** Bounds on waiting requests, so an agent in a loop cannot bury the operator in prompts. */
  maxPendingPerAgent?: number
  maxPending?: number
}

const HUB_ACTOR: AccessActor = { kind: 'system', id: 'fabric-hub' }
const CREDENTIAL = /^[A-Za-z0-9_-]{43}$/

export function verifierOf(credential: string): string {
  return createHash('sha256').update(credential, 'utf8').digest('hex')
}

/** Constant-time comparison of two tokens of any length. */
export function sameToken(a: string, b: string): boolean {
  const x = createHash('sha256').update(a, 'utf8').digest()
  const y = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(x, y) && a.length === b.length
}

export class AccessService {
  private deps: AccessServiceDeps
  private now: () => number
  private random: (bytes: number) => Buffer
  private chain: Promise<unknown> = Promise.resolve()

  // Assigned in the body: Node's type-stripping loader rejects parameter properties.
  constructor(deps: AccessServiceDeps) {
    this.deps = deps
    this.now = deps.now ?? Date.now
    this.random = deps.random ?? randomBytes
  }

  /** Every write runs one at a time: two answers to one request cannot both land. */
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn)
    this.chain = run.catch(() => undefined) // the caller sees the failure; the chain must not stop on it
    return run
  }

  /** The binding a presented credential names, or null. A revoked binding authenticates nothing. */
  async authenticate(credential: string): Promise<BindingRow | null> {
    if (!CREDENTIAL.test(credential)) return null
    const binding = await this.deps.store.bindingByVerifier(verifierOf(credential))
    return binding && binding.revoked_at === null ? binding : null
  }

  /** `fabric.access.request`. Unknown agents are refused before any prompt. */
  request(principal: HubPrincipal, raw: Record<string, unknown>): Promise<RequestAnswer> {
    return this.serial(async () => {
      const asked = normaliseAccessRequest(raw)
      if (!asked.ok) return { ok: false, refused: asked.reason }
      this.deps.registry.refresh()
      const resolved = this.deps.registry.resolve(asked.value.agentId)
      if (!resolved.ok) {
        ops.record({ op: 'hub.access.refused', outcome: 'ok', level: 'warn', detail: { agent_id: asked.value.agentId, reason: resolved.reason }, ctx: { correlationId: ops.correlate() } })
        return { ok: false, refused: `${resolved.reason}. Nothing was shown to the operator.` }
      }
      const entry = resolved.entry
      const ask: AccessAsk = { ...asked.value, agentId: entry.key }
      const bindingId = principal.kind === 'binding' ? principal.binding.id : null
      if (principal.kind === 'binding' && principal.binding.agent_id !== entry.key)
        return { ok: false, refused: `this credential belongs to ${principal.binding.agent_id}; it asks only for its own agent` }

      const signature = requestSignature(ask)
      const denied = (await this.deps.store.requests({ status: 'denied', agentId: entry.key, callee: ask.callee }))
        .find((r) => r.denial_cleared_at === null && requestSignature({ agentId: r.agent_id, callee: r.callee as AccessAsk['callee'], capabilities: r.capabilities, resources: r.resources }) === signature)
      if (denied)
        return { ok: true, requestId: denied.id, status: 'denied', expiresAt: denied.expires_at, note: 'The operator denied this exact request. It stays denied until they clear the denial; asking again does not prompt.' }

      const now = this.now()
      const pending = (await this.deps.store.requests({ status: 'pending' })).filter((r) => Date.parse(r.expires_at) > now)
      const same = pending.find((r) => r.asked_by_binding === bindingId && requestSignature({ agentId: r.agent_id, callee: r.callee as AccessAsk['callee'], capabilities: r.capabilities, resources: r.resources }) === signature)
      if (same) return { ok: true, requestId: same.id, status: 'pending', expiresAt: same.expires_at, note: 'This request is already with the operator. Poll fabric.access.status; do not ask again.' }
      if (pending.filter((r) => r.agent_id === entry.key).length >= (this.deps.maxPendingPerAgent ?? 3))
        return { ok: false, refused: `${entry.key} already has requests waiting for the operator; wait for them to be answered or to expire` }
      if (pending.length >= (this.deps.maxPending ?? 20))
        return { ok: false, refused: 'too many requests are waiting for the operator; try again after they are answered or expire' }

      const id = randomUUID()
      const expiresAt = new Date(now + ACCESS_REQUEST_TTL_MS).toISOString()
      await this.deps.store.append('access.requested@1', HUB_ACTOR, {
        id, agent_id: entry.key, callee: ask.callee, capabilities: ask.capabilities, resources: ask.resources,
        reason: ask.reason, binding_id: bindingId, expires_at: expiresAt,
        registry: { key: entry.key, kind: entry.kind, name: entry.name, installed_by: entry.installedBy, repository: entry.repository, summary: entry.summary }
      })
      const row = await this.deps.store.request(id)
      if (!row) throw new Error('the access request was written and could not be read back')
      let connected = false
      try {
        connected = await this.deps.connected(ask.callee)
      } catch (e) {
        // Shown as "not connected", which is the safe reading: the prompt then offers to connect,
        // and the connect flow itself refuses if a connection already exists.
        ops.failed('hub.access.connection-read', e, { request_id: id })
      }
      ops.record({ op: 'hub.access.requested', outcome: 'ok', detail: { request_id: id, agent_id: entry.key, callee: ask.callee, capabilities: ask.capabilities, resources: ask.resources, incremental: bindingId !== null }, ctx: { correlationId: ops.correlate() } })
      this.deps.present({ row, connected })
      return { ok: true, requestId: id, status: 'pending', expiresAt, note: 'The operator has been asked. Poll fabric.access.status every few seconds; the request expires in 10 minutes.' }
    })
  }

  /** `fabric.access.status`. The first read after an Allow carries the credential, once. */
  status(principal: HubPrincipal, requestId: string): Promise<StatusAnswer> {
    return this.serial(async () => {
      const row = typeof requestId === 'string' && /^[0-9a-f-]{36}$/.test(requestId) ? await this.deps.store.request(requestId) : null
      const mine = row && (principal.kind === 'door' || row.asked_by_binding === principal.binding.id || row.granted_binding_id === principal.binding.id)
      if (!row || !mine) return { ok: false, refused: 'no such request' }
      const now = this.now()
      if (row.status === 'pending')
        return Date.parse(row.expires_at) > now
          ? { ok: true, requestId: row.id, status: 'pending', expiresAt: row.expires_at, note: 'Waiting for the operator.' }
          : { ok: true, requestId: row.id, status: 'expired', expiresAt: row.expires_at, note: 'Nobody answered within 10 minutes. Ask again if you still need it.' }
      if (row.status === 'denied')
        return { ok: true, requestId: row.id, status: 'denied', expiresAt: row.expires_at, note: row.denial_cleared_at ? 'Denied; the operator has since cleared the denial, so you may ask again.' : 'Denied by the operator. Asking again with the same request does not prompt until they clear the denial.' }

      const bindingId = row.granted_binding_id as string
      const grants = (await this.deps.store.grantsOf(bindingId)).filter((g) => g.request_id === row.id)
      const base = {
        ok: true as const, requestId: row.id, status: 'allowed' as const, expiresAt: row.expires_at, bindingId,
        grants: grants.map((g) => ({ capability: g.capability, resource: g.resource, expiresAt: g.expires_at }))
      }
      if (row.asked_by_binding) return { ...base, note: 'Allowed. The grants were added to the credential you already hold.' }
      const binding = await this.deps.store.binding(bindingId)
      if (!binding || binding.revoked_at) return { ...base, note: 'Allowed, and since revoked by the operator.' }
      if (binding.verifier) return { ...base, note: 'Allowed. The credential was handed over once, at the first read after the decision; Fabric cannot show it again.' }
      if (principal.kind !== 'door') return { ...base, note: 'Allowed; collect the credential with the door token.' }
      if (!row.decided_at || now - Date.parse(row.decided_at) > CREDENTIAL_CLAIM_WINDOW_MS)
        return { ...base, note: 'Allowed, but the credential was not collected within 10 minutes of the decision. Ask again.' }

      const credential = this.random(32).toString('base64url')
      await this.deps.store.append('access.credential.claimed@1', HUB_ACTOR, { binding_id: bindingId, request_id: row.id, verifier: verifierOf(credential) })
      ops.record({ op: 'hub.access.credential-claimed', outcome: 'ok', detail: { request_id: row.id, binding_id: bindingId, agent_id: row.agent_id }, ctx: { correlationId: ops.correlate() } })
      return {
        ...base, credential,
        note: 'This is your binding credential, shown once. Store it in Project Observatory\'s vault and send it as Authorization: Bearer <credential> to this same hub. Fabric keeps only its hash.'
      }
    })
  }

  /** The operator's answer. Refused when the request is no longer pending or has expired. */
  decide(requestId: string, decision: 'allowed' | 'denied', actor: AccessActor): Promise<{ ok: true } | { ok: false; reason: string }> {
    return this.serial(async () => {
      const row = await this.deps.store.request(requestId)
      if (!row) return { ok: false, reason: 'no such request' }
      if (row.status !== 'pending') return { ok: false, reason: `that request was already ${row.status}` }
      const now = this.now()
      if (Date.parse(row.expires_at) <= now) return { ok: false, reason: 'that request expired before it was answered; the agent must ask again' }
      if (decision === 'denied') {
        await this.deps.store.append('access.decided@1', actor, { request_id: row.id, decision: 'denied' })
        ops.record({ op: 'hub.access.decided', outcome: 'ok', detail: { request_id: row.id, decision, agent_id: row.agent_id }, ctx: { correlationId: ops.correlate() } })
        return { ok: true }
      }
      let bindingId: string
      const newBinding = row.asked_by_binding === null
      if (newBinding) bindingId = randomUUID()
      else {
        const asking = await this.deps.store.binding(row.asked_by_binding as string)
        if (!asking || asking.revoked_at) return { ok: false, reason: 'the credential that asked has been revoked; the agent must ask again with the door token' }
        bindingId = asking.id
      }
      const expiresAt = new Date(now + GRANT_TTL_MS).toISOString()
      const grants = row.capabilities.flatMap((capability) => row.resources.map((resource) => ({ id: randomUUID(), capability, resource, expires_at: expiresAt })))
      await this.deps.store.append('access.decided@1', actor, { request_id: row.id, decision: 'allowed', binding_id: bindingId, new_binding: newBinding, grants })
      ops.record({ op: 'hub.access.decided', outcome: 'ok', detail: { request_id: row.id, decision, agent_id: row.agent_id, binding_id: bindingId, grants: grants.length }, ctx: { correlationId: ops.correlate() } })
      return { ok: true }
    })
  }

  /** The grants a binding holds now: not revoked, not expired. */
  async liveGrantsOf(binding: BindingRow): Promise<GrantRow[]> {
    const now = this.now()
    return (await this.deps.store.grantsOf(binding.id)).filter((g) => g.revoked_at === null && Date.parse(g.expires_at) > now)
  }

  revokeGrant(grantId: string, actor: AccessActor): Promise<{ ok: true } | { ok: false; reason: string }> {
    return this.serial(async () => {
      const live = (await this.deps.store.liveGrants()).find((g) => g.id === grantId)
      if (!live) return { ok: false, reason: 'that grant is not live (already revoked, or no such grant)' }
      await this.deps.store.append('access.grant.revoked@1', actor, { grant_id: grantId })
      ops.record({ op: 'hub.access.grant-revoked', outcome: 'ok', detail: { grant_id: grantId, agent_id: live.agent_id }, ctx: { correlationId: ops.correlate() } })
      return { ok: true }
    })
  }

  revokeBinding(bindingId: string, actor: AccessActor): Promise<{ ok: true } | { ok: false; reason: string }> {
    return this.serial(async () => {
      const b = await this.deps.store.binding(bindingId)
      if (!b || b.revoked_at) return { ok: false, reason: 'that credential is not live (already revoked, or no such credential)' }
      await this.deps.store.append('access.binding.revoked@1', actor, { binding_id: bindingId })
      ops.record({ op: 'hub.access.binding-revoked', outcome: 'ok', detail: { binding_id: bindingId, agent_id: b.agent_id }, ctx: { correlationId: ops.correlate() } })
      return { ok: true }
    })
  }

  clearDenial(requestId: string, actor: AccessActor): Promise<{ ok: true } | { ok: false; reason: string }> {
    return this.serial(async () => {
      const r = await this.deps.store.request(requestId)
      if (!r || r.status !== 'denied' || r.denial_cleared_at) return { ok: false, reason: 'there is no standing denial with that id' }
      await this.deps.store.append('access.denial.cleared@1', actor, { request_id: requestId })
      return { ok: true }
    })
  }

  /** What the operator's list shows: waiting requests, live grants by agent, standing denials. */
  async overview(): Promise<{
    pending: AccessRequestRow[]
    denials: AccessRequestRow[]
    bindings: Array<BindingRow & { grants: GrantRow[]; registry: AccessRequestRow['registry'] | null }>
  }> {
    const now = this.now()
    const [pending, denied, bindings, grants] = await Promise.all([
      this.deps.store.requests({ status: 'pending' }),
      this.deps.store.requests({ status: 'denied' }),
      this.deps.store.bindings(),
      this.deps.store.liveGrants()
    ])
    const origins = new Map<string, AccessRequestRow>()
    for (const b of bindings) {
      const r = await this.deps.store.request(b.request_id)
      if (r) origins.set(b.id, r)
    }
    return {
      pending: pending.filter((r) => Date.parse(r.expires_at) > now),
      denials: denied.filter((r) => r.denial_cleared_at === null),
      bindings: bindings
        .filter((b) => b.revoked_at === null)
        .map((b) => ({ ...b, grants: grants.filter((g) => g.binding_id === b.id && Date.parse(g.expires_at) > now), registry: origins.get(b.id)?.registry ?? null }))
    }
  }
}
// #endregion hub-consent
