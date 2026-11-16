/**
 * The hub's external ingress (ADR-0115 §1): a registered agent's door token or binding credential admitted beside the
 * sessions' bearers, under its budgets. Moved out of `agentSurface.ts` with the state only it keeps (the screens waves
 * S2, 2026-11-16); the surface hands it every bearer that is not a session's.
 */
import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { McpServer as HubServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { sameToken, type AccessService, type HubPrincipal } from './accessService.ts'
import type { AttemptContext } from './toolTrace.ts'
import { ops } from './opsSink.ts'
import { BodyReadTimeout, BodyTooLarge, readJson, refuse } from './requestBody.ts'

/** What the surface needs to admit a registered agent from outside (ADR-0115 §1). */
export interface HubIngress {
  /** The current door token; null while none is published. */
  doorToken: () => string | null
  access: Pick<AccessService, 'authenticate' | 'primeCredentialVerifiers' | 'knownCredential'>
  /** A server holding exactly the tools this principal may use. */
  tools: (principal: HubPrincipal) => HubServer
  /** `POST /fabric/v1/connect/<product>`: a product delivering its key (ADR-0115 §4). */
  callback?: (product: string, req: IncomingMessage, res: ServerResponse) => Promise<void>
}

/**
 * Which door bucket a JSON-RPC body spends (ER-7): a status poll its request, an ask its agent, anything
 * else (initialize, tools/list) one shared bucket. The values are only a budget key, never trusted.
 */
function doorBucket(body: unknown): string {
  const first = Array.isArray(body) ? body[0] : body
  const params = (first as { method?: unknown; params?: { name?: unknown; arguments?: Record<string, unknown> } } | null)?.params
  const args = (first as { method?: unknown })?.method === 'tools/call' && params && typeof params.arguments === 'object' && params.arguments ? params.arguments : null
  const id = (v: unknown): string | null => (typeof v === 'string' && v.length <= 128 ? v : null)
  if (args && params?.name === 'fabric.access.status' && id(args.requestId)) return `request:${id(args.requestId)}`
  if (args && params?.name === 'fabric.access.request' && id(args.agentId)) return `agent:${id(args.agentId)}`
  return 'other'
}

/** A binding's ingress is a flood guard this many times its call budget: one binding serves its coding agent in
 *  every project on the machine, and each session's hook costs an initialize and an initialized beside its call. */
const BINDING_INGRESS_FACTOR = 10

/**
 * Which call bucket a binding's JSON-RPC body spends (2026-10-19, board thread 1afd08e7): a `tools/call` naming its
 * coding-agent session spends that session's share, any other call the binding's shared one, and protocol traffic
 * (initialize, tools/list, notifications) only the ingress guard. The values are a budget key, never trusted.
 */
export function bindingCallBucket(bindingId: string, body: unknown): string | null {
  const first = body as { method?: unknown; params?: { arguments?: Record<string, unknown> } } | null
  if (first?.method !== 'tools/call') return null
  const rt = first.params?.arguments?.runtimeSessionId
  return typeof rt === 'string' && rt.length > 0 && rt.length <= 128 ? `binding:${bindingId}:session:${rt}` : `binding:${bindingId}:calls`
}

/** CO-346: the distinct `runtimeSessionId` windows one binding may hold in a budget window; past them its calls share one. */
export const SESSION_WINDOWS_PER_BINDING = 16

/** The budgets this ingress spends: the surface's own limits, so one setting governs both doors. */
export interface IngressLimits {
  budgetCalls: number
  budgetWindowMs: number
  bodyReadMs: number
}

export class ExternalIngress {
  /** Per binding, the session ids given their own budget window in the current window (CO-346). */
  private bindingSessions = new Map<string, { windowStart: number; ids: Set<string> }>()
  /**
   * Calls per external principal per window. The door token is shared by every agent on this Mac, so its
   * calls are budgeted per request (a status poll) or per agent (an ask), never in one bucket that one
   * agent polling in a loop spends for all of them (ER-7, verification iteration 1 for 0.3.1); a door-wide
   * ceiling of five budgets still bounds the whole door. Bearers that turned out to be nobody's share one
   * small budget checked BEFORE the credential lookup, so they cannot each cost a database read.
   */
  private externalBudget = new Map<string, { windowStart: number; calls: number }>()
  /** sha256 of bearers that authenticated recently: still looked up (revocation is checked every time), but never budgeted as unknown. */
  private knownBearers = new Set<string>()
  /** Bounded in-flight requests; hashes identify buckets without retaining raw credentials. */
  private externalPending = new Map<string, number>()
  private externalPendingTotal = 0

  private deps: { limits: IngressLimits; now: () => number; estateId: string }

  constructor(deps: { limits: IngressLimits; now: () => number; estateId: string }) {
    this.deps = deps
  }

  private get limits(): IngressLimits { return this.deps.limits }
  private now(): number { return this.deps.now() }

  /** A binding's per-session window, unless it already holds SESSION_WINDOWS_PER_BINDING others in this window; then the
   *  binding's one shared window, so varying `runtimeSessionId` cannot raise its budget (CO-346). */
  private boundedCallBucket(bindingId: string, bucket: string | null): string | null {
    const marker = `binding:${bindingId}:session:`
    if (!bucket || !bucket.startsWith(marker)) return bucket
    const now = this.now()
    let seen = this.bindingSessions.get(bindingId)
    if (!seen || now - seen.windowStart >= this.limits.budgetWindowMs) {
      seen = { windowStart: now, ids: new Set() }
      this.bindingSessions.set(bindingId, seen)
      // Bounded like the budget map: bindings whose window has passed are forgotten.
      if (this.bindingSessions.size > 4096)
        for (const [k, v] of this.bindingSessions) if (now - v.windowStart >= this.limits.budgetWindowMs) this.bindingSessions.delete(k)
    }
    const id = bucket.slice(marker.length)
    if (seen.ids.has(id)) return bucket
    if (seen.ids.size >= SESSION_WINDOWS_PER_BINDING) return `binding:${bindingId}:calls`
    seen.ids.add(id)
    return bucket
  }

  /** Spend one call from `key`'s window; false when the window's `limit` is already spent. */
  private spend(key: string, limit: number): boolean {
    const now = this.now()
    const budget = this.externalBudget.get(key) ?? { windowStart: now, calls: 0 }
    if (now - budget.windowStart >= this.limits.budgetWindowMs) {
      budget.windowStart = now
      budget.calls = 0
    }
    if (budget.calls >= limit) {
      this.externalBudget.set(key, budget)
      return false
    }
    budget.calls++
    this.externalBudget.set(key, budget)
    // Bounded: a window's buckets are forgotten once they are old, so request ids cannot grow the map for ever.
    if (this.externalBudget.size > 4096)
      for (const [k, v] of this.externalBudget) if (now - v.windowStart >= this.limits.budgetWindowMs) this.externalBudget.delete(k)
    return true
  }

  // #region hub-external-ingress — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#1-one-door-a-second-way-in
  /**
   * An external principal (ADR-0115): the door token, or a binding credential. Returns false when the
   * bearer is neither, so the caller refuses it exactly as it refuses any unknown bearer.
   *
   * STATELESS, deliberately. A session's bearer is spent on one initialize and paired with a session
   * id; an external credential is reusable by design (an agent that restarts keeps working), so each
   * request gets a fresh server and transport, and there is no session id to steal or to leak.
   */
  async handle(
    token: string,
    hub: HubIngress,
    req: IncomingMessage,
    res: ServerResponse,
    ctx: AttemptContext,
    attempt: { refused(reason: string): void; saw(body: unknown): void }
  ): Promise<boolean> {
    // Admission is BEFORE credential lookup/body parsing: a partial body otherwise holds a
    // request outside every budget. Door poll buckets remain separate after parsing (ER-7).
    const admissionKey = createHash('sha256').update(token, 'utf8').digest('hex')
    const pending = this.externalPending.get(admissionKey) ?? 0
    if (pending >= Math.max(1, Math.min(32, this.limits.budgetCalls)) || this.externalPendingTotal >= 128) {
      refuse(res, 429, 'too many concurrent requests', {'connection':'close', 'retry-after':'1'}, attempt)
      return true
    }
    this.externalPending.set(admissionKey, pending + 1)
    this.externalPendingTotal++
    // Released exactly once — when the request ends OR when the caller goes away. The SDK never settles
    // handleRequest for a response closed under it, so a slot freed only after it leaked one per hang-up
    // until the credential (or the whole hub) was refused 429 (I3 E-2).
    let released = false
    const release = (): void => {
      if (released) return
      released = true
      const remaining = (this.externalPending.get(admissionKey) ?? 1) - 1
      if (remaining) this.externalPending.set(admissionKey, remaining)
      else this.externalPending.delete(admissionKey)
      this.externalPendingTotal--
    }
    const closed = new Promise<void>((resolve) => res.once('close', () => { release(); resolve() }))
    try {
      let principal: HubPrincipal | null = null
      const door = hub.doorToken()
      if (door && sameToken(token, door)) principal = { kind: 'door' }
      else {
        const bearerHash = createHash('sha256').update(token, 'utf8').digest('hex')
        // Unknown bearers share one small budget, spent BEFORE the lookup: each would otherwise cost a
        // database read with no budget at all (ER-7). A bearer that authenticated before is not held back.
        if (!hub.access.knownCredential(token) && !this.knownBearers.has(bearerHash) && !this.spend('unknown-bearers', Math.max(1, Math.ceil(this.limits.budgetCalls / 4)))) {
          refuse(res, 429, 'too many unknown credentials; try again later', { 'retry-after': String(Math.max(1, Math.ceil(this.limits.budgetWindowMs / 1000))) }, attempt)
          return true
        }
        try {
          const binding = await hub.access.authenticate(token)
          if (binding) {
            principal = { kind: 'binding', binding }
            if (this.knownBearers.size >= 1024) this.knownBearers.clear()
            this.knownBearers.add(bearerHash)
          } else this.knownBearers.delete(bearerHash)
        } catch (e) {
          // Not "unknown credential": the credential could not be CHECKED, and an agent told it is
          // unknown would discard a valid one. 503 says try again.
          ops.failed('agentSurface.hub-authenticate', e)
          refuse(res, 503, 'the hub cannot check credentials right now; try again', { 'retry-after': '5' }, attempt)
          return true
        }
      }
      if (!principal) return false

      // Global door/binding window admission precedes body consumption. The door's per-agent
      // window is charged only once its request identifies an agent or poll (below).
      const ingressKey = principal.kind === 'door' ? 'door' : `binding:${principal.binding.id}`
      if (!this.spend(ingressKey, this.limits.budgetCalls * (principal.kind === 'door' ? 5 : BINDING_INGRESS_FACTOR))) {
        refuse(res, 429, 'call budget exhausted before body admission', {'connection':'close', 'retry-after':String(Math.max(1, Math.ceil(this.limits.budgetWindowMs / 1000)))}, attempt)
        return true
      }
      let body: unknown
      try {
        body = await readJson(req, this.limits.bodyReadMs)
      } catch (e) {
        if (e instanceof BodyTooLarge) {
          refuse(res, 413, 'request body too large', {'connection':'close'}, attempt)
          return true
        }
        if (e instanceof BodyReadTimeout) {
          refuse(res, 408, 'request body deadline exceeded', {'connection':'close'}, attempt)
          return true
        }
        throw e
      }
      attempt.saw(body)
      if (Array.isArray(body)) {
        refuse(res, 400, 'JSON-RPC batches are not accepted', {}, attempt)
        return true
      }

      // The door's bucket is the request being polled, or the agent asking — never the whole door (ER-7).
      const key = principal.kind === 'door' ? `door:${doorBucket(body)}` : `binding:${principal.binding.id}`
      ctx.sessionId = principal.kind === 'door' ? 'door' : key
      const callKey = principal.kind === 'door' ? key : this.boundedCallBucket(principal.binding.id, bindingCallBucket(principal.binding.id, body))
      if (callKey && !this.spend(callKey, this.limits.budgetCalls)) {
        const now = this.now()
        const bucket = this.externalBudget.get(callKey)
        const retryIn = bucket ? Math.ceil((bucket.windowStart + this.limits.budgetWindowMs - now) / 1000) : 1
        ops.record({ op: 'agentSurface.budgetExhausted', outcome: 'ok', level: 'warn', detail: { principal: callKey, calls: this.limits.budgetCalls, retry_in_s: retryIn }, ctx: { correlationId: ctx.correlationId, estateId: this.deps.estateId } })
        refuse(res, 429, `call budget exhausted: ${this.limits.budgetCalls} calls per ${this.limits.budgetWindowMs / 1000}s. Retry in ${retryIn}s.`, { 'retry-after': String(Math.max(1, retryIn)) }, attempt)
        return true
      }
      const server = hub.tools(principal)
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
      res.on('close', () => {
        // Each request owns its server and transport; both end with the response.
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await Promise.race([transport.handleRequest(req, res, body), closed])
      return true
    } finally {
      release()
    }
  }
  // #endregion hub-external-ingress
}
