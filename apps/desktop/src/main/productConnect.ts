// #region product-connect — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#verification-iteration-3-corrections--2026-10-04
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
// ONE DEADLINE, BELOW THE PRODUCT'S (verification iteration 1 for 0.3.1, ER-6). The product revokes the key
// unless the callback answers 2xx within 10 s, so the whole callback — body, vault, record — runs inside
// `callbackDeadlineMs` (8 s). Past it, or once the product has hung up, Fabric answers non-2xx and records
// nothing; Fabric is never left "connected" to a key the product has already revoked — with one exception
// (ADR-0115 amendment 28): a record that landed late is withdrawn, and if that withdrawal itself fails
// (`withdraw-failed`) the record stays and the operator is told so (I3 D-6).
//
// THE SECRET FIRST, IN A SLOT OF ITS OWN, THEN THE RECORD (DA-6). Each connection's secret has its own vault
// slot, named by the estate and the connection: `FABRIC_INBOX_CLIENT_SECRET_<ESTATE>_<CONNECTION>` (hex,
// upper case). So two estates on one Mac never share a secret, and writing the new key's secret touches
// nothing a live connection reads — the reason the security review of PR #7 put the record first is gone.
// Only after the vault has kept the secret, and only inside the deadline, is `product.connected@1`
// appended (which, for a Reconnect, supersedes the previous connection in the same event) and 200
// answered. A vault that refuses, or is too slow, leaves NO record and the previous connection whole;
// the product revokes the new key. A record that itself lands after the deadline is withdrawn at once
// (`product.disconnected@1`) — and for a Reconnect the previous connection was already superseded by it,
// which the outcome says (`previousLost`). A secret written to a slot no record names is inert: the
// product has revoked its key. Superseded slots stay in the vault until removed there (`vault.py`).
//
// RECONNECT IS A CHOICE. A product already connected is connected again only when the operator chose
// Reconnect (`begin(spec, { reconnect: true })`); every other caller is refused while a connection lives.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import type { AccessActor, AccessStore } from './accessStore.ts'
import { productName, type ConnectProblem, type ConnectProblemCode } from '../shared/access.ts'
import type { SecretSlot, VaultPort } from './observatoryVault.ts'
import { ops } from './opsSink.ts'

export const CONNECT_STATE_TTL_MS = 10 * 60 * 1000
/** The whole callback answers within this; the product's own limit is 10 s (ADR-0115 §4.4). */
export const CALLBACK_DEADLINE_MS = 8000
const MAX_CALLBACK_BYTES = 64 * 1024
const FAILURES = new Set(['no_server', 'sign_in_required', 'mint_failed'])

export interface ProductSpec {
  product: string
  scheme: string
  /** What the product shows as the asking client, and the client id it keys. */
  client: string
  clientId: string
  level: 'read' | 'mail' | 'admin'
  /** The vault slot's project, env and name prefix; the estate and the connection complete the name. */
  secret: SecretSlot
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const hexOf = (uuid: string): string => uuid.replace(/-/g, '').toUpperCase()

/** The vault slot of ONE connection in ONE estate: `<PREFIX>_<ESTATE HEX>_<CONNECTION HEX>` (DA-6). */
export function secretSlotFor(spec: ProductSpec, estateId: string, connectionId: string): SecretSlot {
  if (!UUID.test(estateId) || !UUID.test(connectionId)) throw new Error('a secret slot is named by an estate id and a connection id (UUIDs)')
  return { ...spec.secret, name: `${spec.secret.name}_${hexOf(estateId)}_${hexOf(connectionId)}` }
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

/** The last outcome of a connect attempt, for the operator's screen. `problem` is phrased there (en/ru);
 *  `reason` is the same in English, for the operations log. */
export type ConnectOutcome =
  | { product: string; outcome: 'waiting'; since: string; reconnect: boolean }
  | { product: string; outcome: 'connected'; at: string; reconnect: boolean }
  | { product: string; outcome: 'denied'; at: string }
  | { product: string; outcome: 'failed'; at: string; problem: ConnectProblem; reason: string }

export type BeginAnswer = { ok: true; expiresAt: string } | { ok: false; problem: ConnectProblem; reason: string }

export interface ProductConnectorDeps {
  store: Pick<AccessStore, 'append' | 'liveConnection'>
  vault: VaultPort
  /** The estate this connector's connections belong to; it names their vault slots (DA-6). */
  estateId: string
  /** The hub's origin, `http://127.0.0.1:<port>`; empty while the hub is not listening. */
  origin: () => string
  openExternal: (url: string) => Promise<void>
  /** Read when it is needed: the operator is established after the hub is built. */
  actor: () => AccessActor
  now?: () => number
  random?: (n: number) => Buffer
  /** Told whenever an attempt changes, so the screen does not poll. */
  changed?: (outcome: ConnectOutcome) => void
  /** How long the callback's body may take to arrive (default 5 s; the product gives up at 10 s). */
  bodyTimeoutMs?: number
  /** The whole callback's deadline (default 8 s), below the product's 10 s (ER-6). */
  callbackDeadlineMs?: number
}

interface PendingState {
  spec: ProductSpec
  createdAt: number
  /** The operator chose Reconnect: a live connection exists and this attempt replaces it on success. */
  reconnect: boolean
  /** Connection the operator chose to replace; null for a first connection. */
  supersedes: string | null
}

/**
 * The callback's body, whole, within a size and a deadline. The product's app posts a few hundred bytes
 * and gives up on its own after 10 s, so a body still arriving after `ms` is not the app — and a reader
 * with no deadline is a socket anyone on this Mac can hold open for as long as the server allows.
 */
function readBounded(req: IncomingMessage, max: number, ms: number): Promise<{ ok: true; raw: string } | { ok: false; status: number; error: string }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false
    const finish = (v: { ok: true; raw: string } | { ok: false; status: number; error: string }): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      req.off('data', onData).off('end', onEnd).off('error', onError)
      if (!v.ok) req.pause()
      resolve(v)
    }
    const timer = setTimeout(() => finish({ ok: false, status: 408, error: 'the body did not arrive in time' }), ms)
    const onData = (chunk: Buffer): void => {
      size += chunk.length
      if (size > max) finish({ ok: false, status: 413, error: 'body too large' })
      else chunks.push(chunk)
    }
    const onEnd = (): void => finish({ ok: true, raw: Buffer.concat(chunks).toString('utf8') })
    const onError = (): void => finish({ ok: false, status: 400, error: 'the body could not be read' })
    req.on('data', onData).on('end', onEnd).on('error', onError)
  })
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
  private bodyTimeoutMs: number
  private callbackDeadlineMs: number
  private pending = new Map<string, PendingState>()
  private last = new Map<string, ConnectOutcome>()
  /** Admission and consumed callbacks also own the product while they await I/O. */
  private starting = new Set<string>()
  private processing = new Set<string>()

  // Assigned in the body: Node's type-stripping loader rejects parameter properties.
  constructor(deps: ProductConnectorDeps) {
    if (!UUID.test(deps.estateId)) throw new Error('a ProductConnector belongs to one estate (a UUID)')
    this.deps = deps
    this.now = deps.now ?? Date.now
    this.random = deps.random ?? randomBytes
    this.bodyTimeoutMs = deps.bodyTimeoutMs ?? 5000
    this.callbackDeadlineMs = deps.callbackDeadlineMs ?? CALLBACK_DEADLINE_MS
  }

  private settle(outcome: ConnectOutcome): void {
    this.last.set(outcome.product, outcome)
    this.deps.changed?.(outcome)
  }

  private failed(product: string, at: string, problem: ConnectProblem, reason: string): void {
    this.settle({ product, outcome: 'failed', at, problem, reason })
  }

  private prune(now: number): void {
    for (const [s, p] of this.pending) if (now - p.createdAt > CONNECT_STATE_TTL_MS) this.pending.delete(s)
  }

  /**
   * The last attempt, as the operator's screen shows it. "Waiting" lasts only while a connect state is
   * alive (UX-6): once the 10-minute window has passed with no answer, it reads as failed, no answer.
   */
  lastOutcome(product: string): ConnectOutcome | null {
    const last = this.last.get(product) ?? null
    if (last?.outcome !== 'waiting') return last
    const now = this.now()
    this.prune(now)
    if (this.starting.has(product) || this.processing.has(product) || [...this.pending.values()].some((p) => p.spec.product === product)) return last
    const at = new Date(Date.parse(last.since) + CONNECT_STATE_TTL_MS).toISOString()
    this.failed(product, at, { code: 'no-answer' }, `no answer from ${productName(product)} within 10 minutes`)
    return this.last.get(product) ?? null
  }

  /** The connect link for a product, exactly as its app parses it. */
  linkFor(spec: ProductSpec, state: string): string {
    const callback = `${this.deps.origin()}/fabric/v1/connect/${spec.product}`
    const q = new URLSearchParams({ client: spec.client, client_id: spec.clientId, level: spec.level, callback, state })
    return `${spec.scheme}://connect?${q.toString()}`
  }

  /**
   * Start connecting: mint a state, open the product's link. The answer arrives at the callback.
   * A product that is already connected is refused unless the operator chose Reconnect.
   */
  async begin(spec: ProductSpec, opts: { reconnect?: boolean } = {}): Promise<BeginAnswer> {
    const name = productName(spec.product)
    const refuse = (code: ConnectProblemCode, reason: string, detail?: string): BeginAnswer => ({ ok: false, problem: detail ? { code, detail } : { code }, reason })
    if (!this.deps.origin()) return refuse('hub-off', `the hub is not listening, so ${name} would have nowhere to deliver its key`)
    this.prune(this.now())
    if (this.starting.has(spec.product) || this.processing.has(spec.product) || [...this.pending.values()].some(p => p.spec.product === spec.product))
      return refuse('busy', `a connection to ${name} is already waiting for its answer`)
    // Taken before the first await: simultaneous IPC decisions must open one consent, not two.
    this.starting.add(spec.product)
    let live: Awaited<ReturnType<AccessStore['liveConnection']>>
    try {
      live = await this.deps.store.liveConnection(spec.product)
    } catch (e) {
      ops.failed('connect.live-read', e, { product: spec.product })
      return refuse('live-unreadable', `whether ${name} is already connected could not be read`, (e as Error).message)
    } finally {
      this.starting.delete(spec.product)
    }
    // No await between releasing admission and retaining its state.
    if (live && !opts.reconnect) return refuse('already-connected', `${name} is already connected; reconnect it to replace its key`)
    const now = this.now()
    const state = this.random(32).toString('base64url')
    const reconnect = opts.reconnect === true
    this.pending.set(state, { spec, createdAt: now, reconnect, supersedes: live?.id ?? null })
    const link = this.linkFor(spec, state)
    this.settle({ product: spec.product, outcome: 'waiting', since: new Date(now).toISOString(), reconnect })
    try {
      await this.deps.openExternal(link)
    } catch (e) {
      this.pending.delete(state)
      ops.failed('connect.open', e, { product: spec.product })
      const reason = `${name} could not be opened — is its app installed? (${(e as Error).message})`
      const problem: ConnectProblem = { code: 'not-installed', detail: (e as Error).message }
      this.failed(spec.product, new Date(now).toISOString(), problem, reason)
      return { ok: false, problem, reason }
    }
    ops.record({ op: 'connect.begin', outcome: 'ok', detail: { product: spec.product, reconnect }, ctx: { correlationId: ops.correlate() } })
    return { ok: true, expiresAt: new Date(now + CONNECT_STATE_TTL_MS).toISOString() }
  }

  /** The product's own Deny or failure, in the journal (DA-7). Its absence would only cost history. */
  private async journalRefusal(product: string, outcome: 'denied' | 'failed', error: string | null): Promise<void> {
    try {
      await this.deps.store.append('product.connect.refused@1', this.deps.actor(), { product, outcome, error })
    } catch (e) {
      // The product has already decided; the answer to it does not depend on our history. Logged, not hidden.
      ops.failed('connect.refused-record', e, { product, outcome, error })
    }
  }

  /**
   * `POST /fabric/v1/connect/<product>`. 2xx only once the key is safely stored AND recorded, inside
   * one deadline below the product's own (ER-6); anything else is non-2xx, so the product revokes it.
   */
  async callback(product: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    // THE DEADLINE, AND THE PRODUCT HANGING UP, END THE WAIT ALIKE: either way a 2xx would reach no one.
    let late = false
    let timer: NodeJS.Timeout | undefined
    const deadline = new Promise<'late'>((resolve) => {
      const end = (): void => { late = true; resolve('late') }
      timer = setTimeout(end, this.callbackDeadlineMs)
      res.once('close', () => { if (!res.writableFinished) end() })
    })
    try {
      await this.answer(product, req, res, deadline, () => late)
    } finally {
      clearTimeout(timer)
    }
  }

  private async answer(product: string, req: IncomingMessage, res: ServerResponse, deadline: Promise<'late'>, isLate: () => boolean): Promise<void> {
    const name = productName(product)
    const fail = (status: number, error: string, detail?: Record<string, unknown>): void => {
      ops.record({ op: 'connect.callback', outcome: 'ok', level: 'warn', detail: { product, refused: error, status, ...detail }, ctx: { correlationId: ops.correlate() } })
      write(res, status, { error })
    }
    if (req.headers.origin !== undefined) return fail(403, 'a browser cannot deliver a key')
    // An Origin is not a product callback and cannot cancel legitimate consent. Malformed delivery on
    // the app path fails the unique attempt immediately instead of claiming another ten minutes' wait.
    const invalid = (status: number, error: string): void => {
      const waiting = [...this.pending.entries()].filter(([, p]) => p.spec.product === product)
      if (waiting.length === 1 && !this.processing.has(product)) {
        this.pending.delete(waiting[0][0])
        this.failed(product, new Date(this.now()).toISOString(), { code: 'invalid-delivery', detail: error }, `${name} delivered an invalid answer`)
      }
      fail(status, error)
    }
    if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return invalid(415, 'expected application/json')
    const read = await readBounded(req, MAX_CALLBACK_BYTES, Math.min(this.bodyTimeoutMs, this.callbackDeadlineMs))
    if (!read.ok) {
      // The connection is closed after the answer: a sender that is still trickling bytes is not waited on.
      res.once('finish', () => req.destroy())
      return invalid(read.status, read.error)
    }
    let body: Record<string, unknown>
    try {
      const parsed = JSON.parse(read.raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalid(400, 'expected a JSON object')
      body = parsed as Record<string, unknown>
    } catch {
      return invalid(400, 'the body is not JSON') // a refusal with its reason is the record
    }
    const state = typeof body.state === 'string' ? body.state : ''
    const pending = /^[A-Za-z0-9_-]{22,128}$/.test(state) ? this.pending.get(state) : undefined
    // SPENT before anything is awaited: a replay of this POST finds nothing.
    if (pending?.spec.product === product) this.pending.delete(state)
    if (!pending || pending.spec.product !== product) return fail(400, 'unknown or already used state')
    this.processing.add(product)
    try {
      const at = new Date(this.now()).toISOString()
      if (this.now() - pending.createdAt > CONNECT_STATE_TTL_MS) {
        this.failed(product, at, { code: 'late' }, `${name} answered after the 10-minute window`)
        return fail(400, 'the state expired')
      }

      if (body.outcome === 'denied') {
        this.settle({ product, outcome: 'denied', at })
        ops.record({ op: 'connect.callback', outcome: 'ok', detail: { product, outcome: 'denied' }, ctx: { correlationId: ops.correlate() } })
        await this.journalRefusal(product, 'denied', null)
        return write(res, 200, { ok: true })
      }
      if (body.outcome === 'failed') {
        const error = typeof body.error === 'string' && FAILURES.has(body.error) ? body.error : 'unknown'
        const reasons: Record<string, string> = {
          no_server: `${name} has no server set up yet`,
          sign_in_required: `${name} needs you to sign in again; it has opened its sign-in`,
          mint_failed: `${name} could not make the key`,
          unknown: `${name} reported a failure Fabric does not recognise`
        }
        this.failed(product, at, { code: error as ConnectProblemCode }, reasons[error])
        ops.record({ op: 'connect.callback', outcome: 'ok', level: 'warn', detail: { product, outcome: 'failed', error }, ctx: { correlationId: ops.correlate() } })
        await this.journalRefusal(product, 'failed', error)
        return write(res, 200, { ok: true })
      }
      if (body.outcome !== 'connected') {
        this.failed(product, at, { code: 'invalid-delivery', detail: 'unknown outcome' }, `${name} delivered an unknown outcome`)
        return fail(400, 'unknown outcome')
      }

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
        this.failed(product, at, { code: 'invalid-delivery', detail: problems.join(', ') }, `${name} delivered a key Fabric cannot use (${problems.join(', ')})`)
        return fail(400, `invalid delivery: ${problems.join(', ')}`)
      }
      const k = key as { id: string; clientId: string; level: string; send: string; expiresAt?: string | null }
      const id = randomUUID()
      const slot = secretSlotFor(pending.spec, this.deps.estateId, id)
      const tooLate = (stage: string): void => {
        ops.record({ op: 'connect.callback', outcome: 'failed', level: 'error', detail: { product, stage, refused: 'deadline', key_id: k.id, connection_id: id, deadline_ms: this.callbackDeadlineMs }, ctx: { correlationId: ops.correlate() } })
        this.failed(product, at, { code: 'deadline' }, `Fabric could not keep the key within ${name}'s 10 seconds (stage: ${stage})`)
        write(res, 504, { error: 'deadline' })
      }

      // 1. THE SECRET, into a slot no live connection reads.
      const put = this.deps.vault.put(slot, secret as string)
      const stored = await Promise.race([put, deadline])
      if (stored === 'late') {
        // The put may still finish: its slot is named by no record, and the product revokes the key.
        put.then((r) => ops.record({ op: 'connect.callback', outcome: 'ok', level: 'warn', detail: { product, stage: 'vault-after-deadline', stored: r.ok, connection_id: id }, ctx: { correlationId: ops.correlate() } }), () => undefined)
        return tooLate('vault')
      }
      if (!stored.ok) {
        this.failed(product, at, { code: 'vault', detail: stored.reason }, `the key was not kept: ${stored.reason}`)
        ops.record({ op: 'connect.callback', outcome: 'failed', level: 'error', detail: { product, stage: 'vault', reason: stored.reason, key_id: k.id, connection_id: id }, ctx: { correlationId: ops.correlate() } })
        return write(res, 503, { error: 'vault_unavailable', reason: stored.reason })
      }
      if (isLate()) return tooLate('vault')

      // A delivery replaces only the connection chosen when the operator opened consent. The schema
      // checks this same predecessor atomically at append, closing the read/append race across processes.
      let current: Awaited<ReturnType<AccessStore['liveConnection']>>
      try {
        const readLive = this.deps.store.liveConnection(product).then(value => ({ value }), error => ({ error: error as Error }))
        const currentRead = await Promise.race([readLive, deadline])
        if (currentRead === 'late' || isLate()) return tooLate('live-read')
        if ('error' in currentRead) throw currentRead.error
        current = currentRead.value
      } catch (e) {
        ops.failed('connect.callback-live-read', e, { product })
        this.failed(product, at, { code: 'live-unreadable', detail: (e as Error).message }, 'the current connection could not be read')
        return write(res, 503, { error: 'live_unreadable' })
      }
      if ((current?.id ?? null) !== pending.supersedes) {
        this.failed(product, at, { code: 'connection-changed' }, 'the connection changed while the product was answering; reconnect from its current state')
        return write(res, 409, { error: 'connection_changed' })
      }

      // 2. THE RECORD, only now — and withdrawn if it lands after the product stopped waiting.
      const appended = this.deps.store.append('product.connected@1', this.deps.actor(), {
        id, product, supersedes: pending.supersedes, server: body.server, mcp_url: body.mcpUrl, key_id: k.id, client_id: k.clientId,
        level: k.level, send: k.send, key_expires_at: k.expiresAt ?? null, secret_ref: slot
      }).then(() => 'recorded' as const, (e: unknown) => ({ error: e as Error }))
      const recorded = await Promise.race([appended, deadline])
      if (recorded !== 'late' && recorded !== 'recorded') {
        ops.failed('connect.record', recorded.error, { product, key_id: k.id })
        this.failed(product, at, { code: 'record-failed', detail: recorded.error.message }, `the connection could not be recorded: ${recorded.error.message}`)
        return write(res, 500, { error: 'record_failed' })
      }
      if (recorded === 'late' || isLate()) {
        write(res, 504, { error: 'deadline' })
        const landed = recorded === 'recorded' ? 'recorded' : await appended
        if (landed !== 'recorded') {
          ops.failed('connect.record', landed.error, { product, key_id: k.id, after: 'deadline' })
          this.failed(product, at, { code: 'deadline' }, `Fabric could not record the key within ${name}'s 10 seconds`)
          return
        }
        let withdrawn = true
        try {
          await this.deps.store.append('product.disconnected@1', this.deps.actor(), { id })
        } catch (e) {
          withdrawn = false
          ops.failed('connect.withdraw', e, { product, connection_id: id, key_id: k.id })
        }
        ops.record({ op: 'connect.callback', outcome: 'failed', level: 'error', detail: { product, stage: 'record-after-deadline', connection_id: id, key_id: k.id, withdrawn, reconnect: pending.reconnect }, ctx: { correlationId: ops.correlate() } })
        const problem: ConnectProblem = withdrawn
          ? (pending.reconnect ? { code: 'withdrawn', previousLost: true } : { code: 'withdrawn' })
          // The record DID land and stays: its own code, phrased by the operator's screens (iteration 2, UX-6 / DO-7).
          : { code: 'withdraw-failed' }
        this.failed(product, at, problem, withdrawn ? 'the key was recorded after the product stopped waiting, and was withdrawn' : 'the late record could not be withdrawn')
        return
      }
      ops.record({ op: 'connect.callback', outcome: 'ok', detail: { product, outcome: 'connected', connection_id: id, key_id: k.id, level: k.level, reconnect: pending.reconnect }, ctx: { correlationId: ops.correlate() } })
      this.settle({ product, outcome: 'connected', at, reconnect: pending.reconnect })
      write(res, 200, { ok: true })
    } finally { this.processing.delete(product) }
  }

  /**
   * The operator's disconnect: Fabric stops using the connection. The key itself stays valid in the
   * product until the operator revokes it there, and its secret stays in its vault slot (no record names
   * it any more) — SCN-133 and SCR-76 say both.
   */
  async disconnect(product: string): Promise<{ ok: true } | { ok: false; problem: ConnectProblem; reason: string }> {
    const live = await this.deps.store.liveConnection(product)
    if (!live) return { ok: false, problem: { code: 'not-connected' }, reason: `${productName(product)} is not connected` }
    await this.deps.store.append('product.disconnected@1', this.deps.actor(), { id: live.id })
    ops.record({ op: 'connect.disconnect', outcome: 'ok', detail: { product, connection_id: live.id }, ctx: { correlationId: ops.correlate() } })
    return { ok: true }
  }
}
// #endregion product-connect
