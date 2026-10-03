// #region product-forward — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#5-every-forwarded-call-is-narrowed-twice
// One call forwarded to a connected product (ADR-0115 §5), over Streamable HTTP with the MCP SDK.
// The product's credential travels in headers only — `CF-Access-Client-Id`, `CF-Access-Client-Secret`
// — and the call is narrowed at the product by `X-Fabric-Accounts` (Fabric Inbox intersects it with
// the key's own scope, so it narrows and never widens). A workspace setup the grant names as its own
// capability is the one call sent without that header.
//
// REDIRECTS ARE REFUSED. A fetch that follows a redirect carries custom headers to the next origin,
// and a Cloudflare Access login page answers a bad service token with exactly that redirect: following
// it would hand the secret to whatever the Location names. Every message that leaves here has the
// secret removed from it, in case a product ever echoes a header back.

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export interface ForwardRequest {
  mcpUrl: string
  clientId: string
  clientSecret: string
  /** The X-Fabric-Accounts list, or null for a workspace setup. Never an empty list. */
  narrowing: string[] | null
  capability: string
  input: Record<string, unknown>
  traceparent: string
  timeoutMs?: number
}

export interface ForwardedResult {
  content?: unknown[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export type ForwardAnswer =
  | { ok: true; result: ForwardedResult; wallMs: number }
  | { ok: false; code: 'product-unreachable' | 'product-refused' | 'product-error'; message: string; wallMs: number }

export async function forwardToProduct(req: ForwardRequest): Promise<ForwardAnswer> {
  const started = Date.now()
  const scrub = (text: string): string => text.split(req.clientSecret).join('«redacted»').slice(0, 500)
  if (req.narrowing !== null && req.narrowing.length === 0)
    return { ok: false, code: 'product-error', message: 'an empty narrowing list would be refused by the product; nothing was sent', wallMs: 0 }
  const headers: Record<string, string> = {
    'CF-Access-Client-Id': req.clientId,
    'CF-Access-Client-Secret': req.clientSecret,
    ...(req.narrowing ? { 'X-Fabric-Accounts': req.narrowing.join(',') } : {})
  }
  const timeout = req.timeoutMs ?? 60_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const client = new Client({ name: 'fabric-hub', version: '0.1.0' })
  const transport = new StreamableHTTPClientTransport(new URL(req.mcpUrl), {
    requestInit: { headers, redirect: 'error', signal: controller.signal }
  })
  try {
    await client.connect(transport)
    const result = (await client.callTool(
      { name: req.capability, arguments: req.input, _meta: { traceparent: req.traceparent } },
      undefined,
      { timeout }
    )) as ForwardedResult
    return { ok: true, result, wallMs: Date.now() - started }
  } catch (e) {
    const message = scrub(String((e as Error).message ?? e))
    const status = (e as { code?: unknown }).code
    const refused = status === 401 || status === 403 || /\b(401|403)\b|Unauthorized|Forbidden|redirect/i.test(message)
    const unreachable = controller.signal.aborted || /ECONNREFUSED|ENOTFOUND|fetch failed|ETIMEDOUT|network|aborted/i.test(message)
    return {
      ok: false,
      code: refused ? 'product-refused' : unreachable ? 'product-unreachable' : 'product-error',
      message: controller.signal.aborted ? `the product did not answer within ${timeout / 1000}s` : message,
      wallMs: Date.now() - started
    }
  } finally {
    clearTimeout(timer)
    // Closing ends the product-side session; a failure to close changes nothing about the answer.
    await client.close().catch(() => undefined)
  }
}
// #endregion product-forward
