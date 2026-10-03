// #region hub-access-store — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#3-grants-are-standing-narrow-and-revocable
// The hub's standing access, read and written (ADR-0115, migration 76).
//
// WRITES ARE EVENTS. Every change is one `append_event`, and the projector (`apply_hub_access`) is the
// only thing that writes the four tables — refusing an impossible transition by raising, so a write
// that did not happen comes back here as a thrown error, never as a quiet success.
//
// READS ARE ESTATE-SCOPED through the scoped store, and a read that FAILED throws (IMP-04): "no grant"
// and "the grants could not be read" must never look alike, because the first refuses a call politely
// and the second must refuse it loudly.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Journal } from '@fabric/journal'
import { createScopedStore } from './scopedStore.ts'

export interface AccessRequestRow {
  id: string
  agent_id: string
  callee: string
  capabilities: string[]
  resources: string[]
  reason: string
  registry: { key?: string; kind?: string; name?: string; installed_by?: string; repository?: string | null; summary?: string | null }
  asked_by_binding: string | null
  requested_at: string
  expires_at: string
  status: 'pending' | 'allowed' | 'denied'
  decided_at: string | null
  decided_by: string | null
  granted_binding_id: string | null
  credential_claimed_at: string | null
  denial_cleared_at: string | null
}

export interface BindingRow {
  id: string
  agent_id: string
  request_id: string
  verifier: string | null
  created_at: string
  claimed_at: string | null
  revoked_at: string | null
}

export interface GrantRow {
  id: string
  binding_id: string
  request_id: string
  agent_id: string
  callee: string
  capability: string
  resource: string
  decided_at: string
  expires_at: string
  revoked_at: string | null
}

export interface ConnectionRow {
  id: string
  product: string
  server: string
  mcp_url: string
  key_id: string
  client_id: string
  level: string
  send: string
  key_expires_at: string | null
  secret_ref: { project: string; env: 'local' | 'stage' | 'prod'; name: string }
  connected_at: string
  removed_at: string | null
}

export type AccessActor = { kind: 'person' | 'system'; id: string }

export interface AccessStore {
  request(id: string): Promise<AccessRequestRow | null>
  requests(filter: { status?: AccessRequestRow['status']; agentId?: string; callee?: string }): Promise<AccessRequestRow[]>
  binding(id: string): Promise<BindingRow | null>
  bindingByVerifier(verifier: string): Promise<BindingRow | null>
  bindings(): Promise<BindingRow[]>
  grantsOf(bindingId: string): Promise<GrantRow[]>
  liveGrants(): Promise<GrantRow[]>
  liveConnection(product: string): Promise<ConnectionRow | null>
  append(type: string, actor: AccessActor, payload: Record<string, unknown>): Promise<number>
}

const REQUEST_COLUMNS =
  'id,agent_id,callee,capabilities,resources,reason,registry,asked_by_binding,requested_at,expires_at,status,decided_at,decided_by,granted_binding_id,credential_claimed_at,denial_cleared_at'
const BINDING_COLUMNS = 'id,agent_id,request_id,verifier,created_at,claimed_at,revoked_at'
const GRANT_COLUMNS = 'id,binding_id,request_id,agent_id,callee,capability,resource,decided_at,expires_at,revoked_at'
const CONNECTION_COLUMNS = 'id,product,server,mcp_url,key_id,client_id,level,send,key_expires_at,secret_ref,connected_at,removed_at'

type Answer<T> = { data: T | null; error: { message: string } | null }
function read<T>(answer: Answer<T>, what: string): T | null {
  if (answer.error) throw new Error(`${what} could not be read: ${answer.error.message}`)
  return answer.data
}

export function createAccessStore(deps: { db: SupabaseClient; journal: Journal; estateId: string }): AccessStore {
  const store = createScopedStore(deps.db, { kind: 'estate', estateId: deps.estateId })
  return {
    async request(id) {
      return read(await store.select('access_requests', REQUEST_COLUMNS).eq('id', id).maybeSingle(), 'the access request') as AccessRequestRow | null
    },
    async requests(filter) {
      let q = store.select('access_requests', REQUEST_COLUMNS)
      if (filter.status) q = q.eq('status', filter.status)
      if (filter.agentId) q = q.eq('agent_id', filter.agentId)
      if (filter.callee) q = q.eq('callee', filter.callee)
      return (read(await q.order('requested_at', { ascending: true }).limit(500), 'the access requests') ?? []) as AccessRequestRow[]
    },
    async binding(id) {
      return read(await store.select('access_bindings', BINDING_COLUMNS).eq('id', id).maybeSingle(), 'the binding') as BindingRow | null
    },
    async bindingByVerifier(verifier) {
      return read(await store.select('access_bindings', BINDING_COLUMNS).eq('verifier', verifier).maybeSingle(), 'the binding') as BindingRow | null
    },
    async bindings() {
      return (read(await store.select('access_bindings', BINDING_COLUMNS).order('created_at', { ascending: true }).limit(500), 'the bindings') ?? []) as BindingRow[]
    },
    async grantsOf(bindingId) {
      return (read(await store.select('access_grants', GRANT_COLUMNS).eq('binding_id', bindingId).order('decided_at', { ascending: true }).limit(1000), 'the grants') ?? []) as GrantRow[]
    },
    async liveGrants() {
      return (read(await store.select('access_grants', GRANT_COLUMNS).is('revoked_at', null).order('decided_at', { ascending: true }).limit(1000), 'the grants') ?? []) as GrantRow[]
    },
    async liveConnection(product) {
      return read(await store.select('product_connections', CONNECTION_COLUMNS).eq('product', product).is('removed_at', null).maybeSingle(), 'the product connection') as ConnectionRow | null
    },
    async append(type, actor, payload) {
      const event = await deps.journal.append({ estateId: deps.estateId, type, actor, payload })
      return event.seq
    }
  }
}
// #endregion hub-access-store
