// #region product-connect — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#4-a-product-is-connected-once-by-the-products-own-consent
// Connecting a cloud product once, by the product's own consent (ADR-0115 §4). Fabric opens the
// product's connect link; the product's app asks the operator and, on Allow, mints a key through the
// owner's own session and POSTs it to the loopback callback named in the link. Nothing is copied by a
// person. The contract on the wire is Fabric Inbox's (`desktop/connect.cjs`, passioncode-ai/fabric-inbox):
//
//   link:     fabric-inbox://connect?client=Fabric&client_id=fabric&level=admin
//               &callback=<http://127.0.0.1:<port>/fabric/v1/connect/fabric-inbox, URL-encoded>&state=<nonce>
//   callback: POST JSON {state, outcome:"connected", server, mcpUrl, key:{id, clientId, level, send, expiresAt},
//               clientSecret} | {state, outcome:"denied"} | {state, outcome:"failed", error}
//             a 2xx within 10 s keeps the key; anything else makes the product revoke it.
//
// THE STATE IS THE ONLY PROOF the POST is the answer to Fabric's own link: 32 random bytes, single
// use (spent before anything is awaited), dead after 10 minutes. A request carrying an `Origin`
// header is a browser, not the product's app, and is refused before the body is read.
//
// THE SECRET goes to the vault (`observatoryVault.ts`) and nowhere else; only then is
// `product.connected@1` journalled with the metadata and the vault slot, and only then is 200 answered.
// Without Observatory the answer is 503 with the reason, so the product revokes the key it minted —
// a key nobody can keep safely is a key that should not exist.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import type { AccessActor, AccessStore } from './accessStore.ts'
import type { SecretSlot, VaultPort } from './observatoryVault.ts'
import { ops } from './opsSink.ts'

export const CONNECT_STATE_TTL_MS = 10 * 60 * 1000
const MAX_CALLBACK_BYTES = 64 * 1024
const FAILURES = new Set(['no_server', 'sign_in_required', 'mint_failed'])

export interface ProductSpec {
  product: string
  scheme: string
  /** What the product shows as the asking client, and the client id it keys. */
  client: string
  clientId: string
  level: 'read' | 'mail' | 'admin'
  secret: SecretSlot
}

export const FABRIC_INBOX: ProductSpec = {
  product: 'fabric-inbox',
  scheme: 'fabric-inbox',
  client: 'Fabric',
  clientId: 'fabric',
  // Admin, because a workspace setup the operator grants explicitly (create_address) needs it; every
  // other call is narrowed per call by X-Fabric-Accounts, which can narrow and never widen.
  level: 'admin',
  secret: { project: 'fabric', env: 'local', name: 'FABRIC_INBOX_CLIENT_SECRET' }
}

/** The last outcome of a connect attempt, for the operator's screen. */
export type ConnectOutcome =
  | { product: string; outcome: 'waiting'; since: string }
  | { product: string; outcome: 'connected'; at: string }
  | { product: string; outcome: 'denied'; at: string }
  | { product: string; outcome: 'failed'; at: string; reason: string }

export interface ProductConnectorDeps {
  store: Pick<AccessStore, 'append' | 'liveConnection'>
  vault: VaultPort
  /** The hub's origin, `http://127.0.0.1:<port>`; empty while the hub is not listening. */
  origin: () => string
  openExternal: (url: string) => Promise<void>
  /** Read when it is needed: the operator is established after the hub is built. */
  actor: () => AccessActor
  now?: () => number
  random?: (n: number) => Buffer
  /** Told whenever an attempt changes, so the screen does not poll. */
  changed?: (outcome: ConnectOutcome) => void
}

interface PendingState {
  spec: ProductSpec
  createdAt: number
}

function write(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  if (res.headersSent) return
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

const isHttps = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.length > 2048) return false
  try {
    const u = new URL(v)
    return u.protocol === 'https:' && !u.username && !u.password
  } catch {
    return false // not a URL: the delivery is refused with its reason below
  }
}

export class ProductConnector {
  private deps: ProductConnectorDeps
  private now: () => number
  private random: (n: number) => Buffer
  private pending = new Map<string, PendingState>()
  private last = new Map<string, ConnectOutcome>()

  // Assigned in the body: Node's type-stripping loader rejects parameter properties.
  constructor(deps: ProductConnectorDeps) {
    this.deps = deps
    this.now = deps.now ?? Date.now
    this.random = deps.random ?? randomBytes
  }

  private settle(outcome: ConnectOutcome): void {
    this.last.set(outcome.product, outcome)
    this.deps.changed?.(outcome)
  }

  lastOutcome(product: string): ConnectOutcome | null {
    return this.last.get(product) ?? null
  }

  /** The connect link for a product, exactly as its app parses it. */
  linkFor(spec: ProductSpec, state: string): string {
    const callback = `${this.deps.origin()}/fabric/v1/connect/${spec.product}`
    const q = new URLSearchParams({ client: spec.client, client_id: spec.clientId, level: spec.level, callback, state })
    return `${spec.scheme}://connect?${q.toString()}`
  }

  /** Start connecting: mint a state, open the product's link. The answer arrives at the callback. */
  async begin(spec: ProductSpec): Promise<{ ok: true; expiresAt: string } | { ok: false; reason: string }> {
    if (!this.deps.origin()) return { ok: false, reason: 'the hub is not listening, so the product would have nowhere to deliver its key' }
    const now = this.now()
    for (const [s, p] of this.pending) if (now - p.createdAt > CONNECT_STATE_TTL_MS) this.pending.delete(s)
    if ([...this.pending.values()].filter((p) => p.spec.product === spec.product).length >= 3)
      return { ok: false, reason: `a connection to ${spec.product} is already waiting for its answer` }
    const state = this.random(32).toString('base64url')
    this.pending.set(state, { spec, createdAt: now })
    const link = this.linkFor(spec, state)
    try {
      await this.deps.openExternal(link)
    } catch (e) {
      this.pending.delete(state)
      ops.failed('connect.open', e, { product: spec.product })
      const reason = `${spec.product} could not be opened — is its app installed? (${(e as Error).message})`
      this.settle({ product: spec.product, outcome: 'failed', at: new Date(now).toISOString(), reason })
      return { ok: false, reason }
    }
    ops.record({ op: 'connect.begin', outcome: 'ok', detail: { product: spec.product }, ctx: { correlationId: ops.correlate() } })
    this.settle({ product: spec.product, outcome: 'waiting', since: new Date(now).toISOString() })
    return { ok: true, expiresAt: new Date(now + CONNECT_STATE_TTL_MS).toISOString() }
  }

  /** `POST /fabric/v1/connect/<product>`. Answers fast; 2xx only once the key is safely stored. */
  async callback(product: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const fail = (status: number, error: string, detail?: Record<string, unknown>): void => {
      ops.record({ op: 'connect.callback', outcome: 'ok', level: 'warn', detail: { product, refused: error, status, ...detail }, ctx: { correlationId: ops.correlate() } })
      write(res, status, { error })
    }
    if (req.headers.origin !== undefined) return fail(403, 'a browser cannot deliver a key')
    if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return fail(415, 'expected application/json')
    let raw = ''
    let size = 0
    for await (const chunk of req) {
      size += (chunk as Buffer).length
      if (size > MAX_CALLBACK_BYTES) return fail(413, 'body too large')
      raw += (chunk as Buffer).toString('utf8')
    }
    let body: Record<string, unknown>
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail(400, 'expected a JSON object')
      body = parsed as Record<string, unknown>
    } catch {
      return fail(400, 'the body is not JSON') // a refusal with its reason is the record
    }
    const state = typeof body.state === 'string' ? body.state : ''
    const pending = /^[A-Za-z0-9_-]{22,128}$/.test(state) ? this.pending.get(state) : undefined
    // SPENT before anything is awaited: a replay of this POST finds nothing.
    if (pending) this.pending.delete(state)
    if (!pending || pending.spec.product !== product) return fail(400, 'unknown or already used state')
    const at = new Date(this.now()).toISOString()
    if (this.now() - pending.createdAt > CONNECT_STATE_TTL_MS) {
      this.settle({ product, outcome: 'failed', at, reason: 'the product answered after the 10-minute window' })
      return fail(400, 'the state expired')
    }

    if (body.outcome === 'denied') {
      this.settle({ product, outcome: 'denied', at })
      ops.record({ op: 'connect.callback', outcome: 'ok', detail: { product, outcome: 'denied' }, ctx: { correlationId: ops.correlate() } })
      return write(res, 200, { ok: true })
    }
    if (body.outcome === 'failed') {
      const error = typeof body.error === 'string' && FAILURES.has(body.error) ? body.error : 'unknown'
      const reasons: Record<string, string> = {
        no_server: `${product} has no server set up yet`,
        sign_in_required: `${product} needs you to sign in again; it has opened its sign-in`,
        mint_failed: `${product} could not make the key`,
        unknown: `${product} reported a failure Fabric does not recognise`
      }
      this.settle({ product, outcome: 'failed', at, reason: reasons[error] })
      ops.record({ op: 'connect.callback', outcome: 'ok', level: 'warn', detail: { product, outcome: 'failed', error }, ctx: { correlationId: ops.correlate() } })
      return write(res, 200, { ok: true })
    }
    if (body.outcome !== 'connected') return fail(400, 'unknown outcome')

    const key = body.key as Record<string, unknown> | undefined
    const secret = body.clientSecret
    const problems: string[] = []
    if (!isHttps(body.server)) problems.push('server must be an https URL')
    if (!isHttps(body.mcpUrl)) problems.push('mcpUrl must be an https URL')
    if (!key || typeof key !== 'object') problems.push('key is missing')
    else {
      if (typeof key.id !== 'string' || !key.id || key.id.length > 200) problems.push('key.id')
      if (typeof key.clientId !== 'string' || !key.clientId || key.clientId.length > 400) problems.push('key.clientId')
      if (key.level !== pending.spec.level) problems.push(`key.level must be ${pending.spec.level}`)
      if (key.send !== 'drafts' && key.send !== 'send') problems.push('key.send')
      if (key.expiresAt !== null && key.expiresAt !== undefined && (typeof key.expiresAt !== 'string' || Number.isNaN(Date.parse(key.expiresAt)))) problems.push('key.expiresAt')
    }
    if (typeof secret !== 'string' || !secret || secret.length > 4096) problems.push('clientSecret')
    if (problems.length) {
      this.settle({ product, outcome: 'failed', at, reason: `${product} delivered a key Fabric cannot use (${problems.join(', ')})` })
      return fail(400, `invalid delivery: ${problems.join(', ')}`)
    }
    const k = key as { id: string; clientId: string; level: string; send: string; expiresAt?: string | null }

    const stored = await this.deps.vault.put(pending.spec.secret, secret as string)
    if (!stored.ok) {
      this.settle({ product, outcome: 'failed', at, reason: `the key was not kept: ${stored.reason}` })
      ops.record({ op: 'connect.callback', outcome: 'failed', level: 'error', detail: { product, stage: 'vault', reason: stored.reason, key_id: k.id }, ctx: { correlationId: ops.correlate() } })
      return write(res, 503, { error: 'vault_unavailable', reason: stored.reason })
    }
    const id = randomUUID()
    try {
      await this.deps.store.append('product.connected@1', this.deps.actor(), {
        id, product, server: body.server, mcp_url: body.mcpUrl, key_id: k.id, client_id: k.clientId,
        level: k.level, send: k.send, key_expires_at: k.expiresAt ?? null, secret_ref: pending.spec.secret
      })
    } catch (e) {
      // The secret is in the vault and Fabric could not record the connection: answering non-2xx makes
      // the product revoke the key, so the stored value becomes inert and the next connect rotates it.
      ops.failed('connect.record', e, { product, key_id: k.id })
      this.settle({ product, outcome: 'failed', at, reason: `the connection could not be recorded: ${(e as Error).message}` })
      return write(res, 500, { error: 'record_failed' })
    }
    ops.record({ op: 'connect.callback', outcome: 'ok', detail: { product, outcome: 'connected', connection_id: id, key_id: k.id, level: k.level }, ctx: { correlationId: ops.correlate() } })
    this.settle({ product, outcome: 'connected', at })
    write(res, 200, { ok: true })
  }

  /** The operator's disconnect: Fabric stops forwarding; the key itself is revoked in the product. */
  async disconnect(product: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const live = await this.deps.store.liveConnection(product)
    if (!live) return { ok: false, reason: `${product} is not connected` }
    await this.deps.store.append('product.disconnected@1', this.deps.actor(), { id: live.id })
    ops.record({ op: 'connect.disconnect', outcome: 'ok', detail: { product, connection_id: live.id }, ctx: { correlationId: ops.correlate() } })
    return { ok: true }
  }
}
// #endregion product-connect
