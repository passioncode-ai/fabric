// #region product-forward — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#5-every-forwarded-call-is-narrowed-twice
// One call forwarded to a connected product (ADR-0115 §5), over Streamable HTTP with the MCP SDK.
// The product's credential travels in headers only — `CF-Access-Client-Id`, `CF-Access-Client-Secret`
// — and the call is narrowed at the product by `X-Fabric-Accounts` (Fabric Inbox intersects it with
// the key's own scope, so it narrows and never widens). A workspace setup the grant names as its own
// capability is the one call sent without that header.
//
// REDIRECTS ARE REFUSED ON EVERY REQUEST. A fetch that follows a redirect carries custom headers to the
// next origin, and a Cloudflare Access login page answers a bad service token with exactly that redirect:
// following it would hand the secret to whatever the Location names. `requestInit` is not enough — the
// SDK (1.30.0, `client/streamableHttp.js`, `_startOrAuthSse`) opens its GET stream with the headers
// copied and `requestInit` dropped, so that GET followed a redirect WITH the secret (security review,
// PR #7). The transport is therefore given its own `fetch`, which every request of the exchange passes
// through: it never follows a redirect, and one redirect anywhere ends the whole call as refused.
//
// THE DEADLINE IS THE WHOLE EXCHANGE. The SDK replaces any signal in `requestInit` with its own, so a
// timer aborting a controller given there aborted nothing. Here the timer aborts a controller that the
// guarded fetch joins to every request's own signal, and the exchange is raced against it, so `timeoutMs`
// bounds connect, the call and the GET stream alike.
//
// Every message that leaves here has the secret AND the client id removed from it, in case a product ever
// echoes a header back (ER-11, verification iteration 2 for 0.3.1); the hub hands the agent a fixed sentence
// and keeps this message for the operations log.
//
// A NARROWED CALL GOES ONLY TO A SERVER THAT NARROWS (ER-6, verification iteration 2 for 0.3.1). The header
// is a request the product may ignore: a Fabric Inbox server before 0.9.0 does, and then a grant for one
// mailbox read every mailbox with the admin key. After initialize, and before the tool call, the server's
// own `serverInfo` must name `narrowingSince.server` at `narrowingSince.version` or later; otherwise the
// call is `product-outdated`, nothing ran, and the operator is told to update the server. Checked on every
// call, so a server redeployed to an older version is caught the next time, not at the next connect.
//
// WHETHER THE CALL LEFT FABRIC IS SAID, NOT GUESSED (ER-1, verification iteration 2). A failure carries
// `reached`: false only when the exchange ended before the tool call was handed to the transport — the
// connect (initialize) failed, was refused or was redirected, the deadline fell during it, or the caller had
// gone. From the moment `tools/call` may have been written to the wire, a failure is `reached: true`: the
// product may have run the tool, and the hub refuses to send that idempotency key again.

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { versionAtLeast } from '../shared/access.ts'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export interface ForwardRequest {
  mcpUrl: string
  clientId: string
  clientSecret: string
  /** The X-Fabric-Accounts list, or null for a workspace setup. Never an empty list. */
  narrowing: string[] | null
  /** The server, and its least version, that applies the narrowing (ER-6); absent, a narrowed call is refused. */
  narrowingSince?: { server: string; version: string }
  capability: string
  input: Record<string, unknown>
  traceparent: string
  timeoutMs?: number
  /** The caller's own signal (the agent's MCP request): when it fires, the exchange is abandoned (ER-13). */
  signal?: AbortSignal
}

export interface ForwardedResult {
  content?: unknown[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export type ForwardAnswer =
  | { ok: true; result: ForwardedResult; wallMs: number }
  | {
      ok: false
      code: 'product-unreachable' | 'product-refused' | 'product-error' | 'product-outdated' | 'cancelled'
      message: string
      wallMs: number
      /** Whether the tool call may have left Fabric. Absent is read as true by the hub (fail closed). */
      reached?: boolean
    }

/** A narrowing entry the product reads as exactly one account: no list separator, no line break. */
const UNSAFE_IN_HEADER = /[,\r\n\0]/
/** Per HTTP response, including SSE: stop and cancel its stream before the SDK buffers/parses more. */
export const MAX_PRODUCT_RESPONSE_BYTES = 8 * 1024 * 1024

class RedirectRefused extends Error {}
class Outdated extends Error {}

export async function forwardToProduct(req: ForwardRequest): Promise<ForwardAnswer> {
  const started = Date.now()
  const scrub = (text: string): string => {
    let t = text.split(req.clientSecret).join('«redacted»')
    if (req.clientId) t = t.split(req.clientId).join('«client id»')
    return t.slice(0, 500)
  }
  if (req.narrowing !== null && req.narrowing.length === 0)
    return { ok: false, code: 'product-error', message: 'an empty narrowing list would be refused by the product; nothing was sent', wallMs: 0, reached: false }
  // The header is a comma-separated list: an entry carrying a comma would name a second mailbox, and a
  // line break would end the header. Coverage only ever produces normalised ids; this holds if it did not.
  if (req.narrowing?.some((a) => UNSAFE_IN_HEADER.test(a)))
    return { ok: false, code: 'product-error', message: 'a narrowing entry carries a separator or a line break; nothing was sent', wallMs: 0, reached: false }
  const headers: Record<string, string> = {
    'CF-Access-Client-Id': req.clientId,
    'CF-Access-Client-Secret': req.clientSecret,
    ...(req.narrowing ? { 'X-Fabric-Accounts': req.narrowing.join(',') } : {})
  }
  const timeout = req.timeoutMs ?? 60_000
  const controller = new AbortController()
  let redirected: string | null = null
  let timedOut = false
  let hungUp = false
  /** Set the moment the tool call is handed to the transport: from then on it may have run. */
  let callSent = false
  if (req.signal?.aborted) return { ok: false, code: 'cancelled', message: 'the caller hung up before anything was sent', wallMs: 0, reached: false }
  const onHangUp = (): void => {
    hungUp = true
    controller.abort()
  }
  req.signal?.addEventListener('abort', onHangUp, { once: true })
  const inflight = new Set<Promise<Response>>()

  const guardedFetch = (url: string | URL, init?: RequestInit): Promise<Response> => {
    const signal = init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal
    const sent = (async () => {
      const res = await fetch(url, { ...init, redirect: 'manual', signal })
      if ((res.status >= 300 && res.status < 400) || res.type === 'opaqueredirect') {
        await res.body?.cancel().catch(() => undefined) // the body of a refused redirect is not read
        redirected ??= `the product answered ${init?.method ?? 'GET'} with a redirect (${res.status}); Fabric does not follow one with the product's key`
        controller.abort()
        throw new RedirectRefused(redirected)
      }
      if (!res.body) return res
      let responseBytes = 0
      const body = res.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, stream) {
          responseBytes += chunk.byteLength
          if (responseBytes > MAX_PRODUCT_RESPONSE_BYTES) {
            controller.abort() // stop this body and the exchange's other requests, including GET SSE
            throw new Error('product response exceeds Fabric’s byte limit')
          }
          stream.enqueue(chunk)
        }
      }))
      return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers })
    })()
    inflight.add(sent)
    // Settled either way; the caller sees the rejection, this only stops tracking it.
    void sent.then(() => inflight.delete(sent), () => inflight.delete(sent))
    return sent
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new Error('deadline'))
    }, timeout)
    // The caller hanging up ends the race at once, as the deadline does.
    req.signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })
  })
  const client = new Client({ name: 'fabric-hub', version: '0.1.0' })
  const transport = new StreamableHTTPClientTransport(new URL(req.mcpUrl), {
    requestInit: { headers, redirect: 'error' },
    fetch: guardedFetch
  })
  const exchange = (async () => {
    await client.connect(transport)
    if (req.narrowing !== null) {
      const need = req.narrowingSince
      const info = client.getServerVersion()
      if (!need || !info || info.name !== need.server || !versionAtLeast(info.version, need.version))
        throw new Outdated(
          need
            ? `the server says it is ${info ? `${String(info.name).slice(0, 64)} ${String(info.version).slice(0, 64)}` : 'nothing'}; narrowing needs ${need.server} ${need.version} or later, so the call was not sent`
            : 'Fabric knows no server version that narrows this product, so a narrowed call was not sent'
        )
    }
    callSent = true
    const result = (await client.callTool(
      { name: req.capability, arguments: req.input, _meta: { traceparent: req.traceparent } },
      undefined,
      { timeout, signal: controller.signal }
    )) as ForwardedResult
    // The SDK opens its GET stream without waiting for it; an answer is only kept once every request
    // of the exchange has been answered without a redirect.
    await Promise.allSettled([...inflight])
    if (redirected) throw new RedirectRefused(redirected)
    return result
  })()
  exchange.catch(() => undefined) // raced below; a rejection after the deadline is not unhandled
  try {
    const result = await Promise.race([exchange, deadline])
    return { ok: true, result, wallMs: Date.now() - started }
  } catch (e) {
    const reached = callSent
    if (e instanceof Outdated) return { ok: false, code: 'product-outdated', message: scrub(e.message), wallMs: Date.now() - started, reached: false }
    if (hungUp) return { ok: false, code: 'cancelled', message: 'the caller hung up; the exchange was abandoned', wallMs: Date.now() - started, reached }
    if (redirected) return { ok: false, code: 'product-refused', message: scrub(redirected), wallMs: Date.now() - started, reached }
    if (timedOut) return { ok: false, code: 'product-unreachable', message: `the product did not answer within ${timeout / 1000}s`, wallMs: Date.now() - started, reached }
    const message = scrub(String((e as Error).message ?? e))
    const status = (e as { code?: unknown }).code
    const refused = status === 401 || status === 403 || /\b(401|403)\b|Unauthorized|Forbidden|redirect/i.test(message)
    const unreachable = /ECONNREFUSED|ENOTFOUND|fetch failed|ETIMEDOUT|network|aborted/i.test(message)
    return {
      ok: false,
      code: refused ? 'product-refused' : unreachable ? 'product-unreachable' : 'product-error',
      message,
      wallMs: Date.now() - started,
      reached
    }
  } finally {
    clearTimeout(timer)
    req.signal?.removeEventListener('abort', onHangUp)
    controller.abort() // ends the GET stream and anything still open
    // Closing ends the product-side session; a failure to close changes nothing about the answer.
    await client.close().catch(() => undefined)
  }
}
// #endregion product-forward
