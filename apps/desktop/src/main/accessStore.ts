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
  /** sha256 of the poll secret handed to the asker that created the request (ER-2, migration 77); null before 77. */
  poll_verifier: string | null
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

/**
 * Which requests to read. `liveAt` keeps only requests whose expiry is after that instant, and
 * `standingOnly` only denials nobody cleared — both IN THE QUERY (DA-5, verification iteration 1 for
 * 0.3.1): expiry is read from `expires_at` and never written, so an unanswered request stays `pending`
 * for ever, and a page of the 500 oldest rows filtered afterwards went blank after 500 unanswered asks.
 */
export interface RequestFilter {
  status?: AccessRequestRow['status']
  agentId?: string
  callee?: string
  liveAt?: string
  standingOnly?: boolean
}

/**
 * Which grants to read. Every read is COMPLETE — paged to the end over a stable order, filtered in the
 * query (ER-8 / DA-1, verification iteration 2 for 0.3.1): the gateway answers at most 1000 rows however
 * many match, and the grants and bindings were read as the 1000 / 500 OLDEST rows with dead ones in the
 * page. One broad Allow (32 tools × 32 mailboxes) or a year of expired grants then pushed a newer live
 * grant out of every read: it still worked for a call, was missing from Settings, and its Revoke answered
 * "not live". `liveAt` keeps grants neither revoked nor expired at that instant; `unrevoked` keeps grants
 * not revoked (an expired one included — it still holds the one live row a re-grant extends).
 */
export interface GrantFilter {
  bindingId?: string
  requestId?: string
  unrevoked?: boolean
  liveAt?: string
}

export interface AccessStore {
  request(id: string): Promise<AccessRequestRow | null>
  /** All matching requests, newest first; a failed/oversize page fails the whole read. */
  requests(filter: RequestFilter): Promise<AccessRequestRow[]>
  /** How many requests match — a count, never the length of a capped page. */
  countRequests(filter: RequestFilter): Promise<number>
  binding(id: string): Promise<BindingRow | null>
  bindingByVerifier(verifier: string): Promise<BindingRow | null>
  /** Every binding not revoked, oldest first — complete, never a capped page. */
  liveBindings(): Promise<BindingRow[]>
  /** Every grant the filter matches — complete, never a capped page. */
  grants(filter: GrantFilter): Promise<GrantRow[]>
  /** One grant by its id, live or not. */
  grant(id: string): Promise<GrantRow | null>
  liveConnection(product: string): Promise<ConnectionRow | null>
  append(type: string, actor: AccessActor, payload: Record<string, unknown>): Promise<number>
}

const REQUEST_COLUMNS =
  'id,agent_id,callee,capabilities,resources,reason,registry,asked_by_binding,poll_verifier,requested_at,expires_at,status,decided_at,decided_by,granted_binding_id,credential_claimed_at,denial_cleared_at'
const BINDING_COLUMNS = 'id,agent_id,request_id,verifier,created_at,claimed_at,revoked_at'
const GRANT_COLUMNS = 'id,binding_id,request_id,agent_id,callee,capability,resource,decided_at,expires_at,revoked_at'
const CONNECTION_COLUMNS = 'id,product,server,mcp_url,key_id,client_id,level,send,key_expires_at,secret_ref,connected_at,removed_at'

type Answer<T> = { data: T | null; error: { message: string } | null }
function read<T>(answer: Answer<T>, what: string): T | null {
  if (answer.error) throw new Error(`${what} could not be read: ${answer.error.message}`)
  return answer.data
}

/** The three filters a request read uses, as the query builder offers them. */
interface Filterable {
  eq(column: string, value: string): Filterable
  gt(column: string, value: string): Filterable
  is(column: string, value: null): Filterable
}

/** A request read narrowed by `filter` in the query itself (the builder's own type is too deep to name here). */
function narrowed<Q>(query: Q, filter: RequestFilter): Q {
  let q = query as unknown as Filterable
  if (filter.status) q = q.eq('status', filter.status)
  if (filter.agentId) q = q.eq('agent_id', filter.agentId)
  if (filter.callee) q = q.eq('callee', filter.callee)
  if (filter.liveAt) q = q.gt('expires_at', filter.liveAt)
  if (filter.standingOnly) q = q.is('denial_cleared_at', null)
  return q as unknown as Q
}

export function createAccessStore(deps: { db: SupabaseClient; journal: Journal; estateId: string }): AccessStore {
  const store = createScopedStore(deps.db, { kind: 'estate', estateId: deps.estateId })
  return {
    async request(id) {
      return read(await store.select('access_requests', REQUEST_COLUMNS).eq('id', id).maybeSingle(), 'the access request') as AccessRequestRow | null
    },
    async requests(filter) {
      const eq: Array<readonly [string, string]> = []
      if (filter.status) eq.push(['status', filter.status])
      if (filter.agentId) eq.push(['agent_id', filter.agentId])
      if (filter.callee) eq.push(['callee', filter.callee])
      // Standing denial is authority, not a display page: an omitted old denial could prompt
      // again. Read all matching rows under the shared 50,000-row fail-closed ceiling.
      const all = await store.selectAll('access_requests', REQUEST_COLUMNS, {
        eq,
        isNull: filter.standingOnly ? ['denial_cleared_at'] : [],
        gt: filter.liveAt ? [['expires_at', filter.liveAt]] : [],
        orderBy: ['requested_at', 'id']
      })
      if (all.failed) throw new Error(`the access requests could not be read: ${all.failed}`)
      return all.rows.reverse() as unknown as AccessRequestRow[]
    },
    async countRequests(filter) {
      const answer = await narrowed(store.select('access_requests', 'id', { count: 'exact', head: true }), filter)
      if (answer.error) throw new Error(`the access requests could not be counted: ${answer.error.message}`)
      if (typeof answer.count !== 'number') throw new Error('the access requests could not be counted: no count came back')
      return answer.count
    },
    async binding(id) {
      return read(await store.select('access_bindings', BINDING_COLUMNS).eq('id', id).maybeSingle(), 'the binding') as BindingRow | null
    },
    async bindingByVerifier(verifier) {
      return read(await store.select('access_bindings', BINDING_COLUMNS).eq('verifier', verifier).maybeSingle(), 'the binding') as BindingRow | null
    },
    async liveBindings() {
      const all = await store.selectAll('access_bindings', BINDING_COLUMNS, { isNull: ['revoked_at'], orderBy: ['created_at', 'id'] })
      if (all.failed) throw new Error(`the bindings could not be read: ${all.failed}`)
      return all.rows as unknown as BindingRow[]
    },
    async grants(filter) {
      const eq: Array<readonly [string, string]> = []
      if (filter.bindingId) eq.push(['binding_id', filter.bindingId])
      if (filter.requestId) eq.push(['request_id', filter.requestId])
      const all = await store.selectAll('access_grants', GRANT_COLUMNS, {
        eq,
        isNull: filter.unrevoked || filter.liveAt ? ['revoked_at'] : [],
        gt: filter.liveAt ? [['expires_at', filter.liveAt]] : [],
        orderBy: ['decided_at', 'id']
      })
      if (all.failed) throw new Error(`the grants could not be read: ${all.failed}`)
      return all.rows as unknown as GrantRow[]
    },
    async grant(id) {
      return read(await store.select('access_grants', GRANT_COLUMNS).eq('id', id).maybeSingle(), 'the grant') as GrantRow | null
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
