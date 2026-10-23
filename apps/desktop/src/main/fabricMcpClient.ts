// #region fabric-mcp-client — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#amendments
// The parts of `fabric-mcp` that touch the world (fabricMcpMain.ts is only the entry): the hub as an MCP client over
// streamable HTTP, and the files that hold a runner's credentials and its waiting requests. Split from the entry so
// they are driven by tests without starting a stdio server.
//
// FILES, in Fabric's registry root, owner-only (0600 files in a 0700 folder; the owner-only ACL on Windows,
// `hub.ts#writeAtomic`), read with the hub's own no-follow bounded reader:
//
//   enrollments/<runner>/<sha8>.credential   one per binding — sha8 is the first 8 hex digits of the credential's
//                                            sha256, so a second binding never overwrites the first
//   enrollments/<runner>.pending.json        the requests waiting for the operator, by resource:
//                                            { "version": 1, "requests": { "<resource>": { requestId, pollSecret?, via } } }
//
// The wave-1 single file `enrollments/<runner>.credential` is moved into the folder the first time it is read.
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { readHubDocument, writeAtomic } from './hub.ts'
import { FabricRateLimitError, boundedRetryMs, hubRefusalOf, type CredentialStore, type HubCall, type HubRefusal, type PendingRequest, type SessionLink } from './fabricMcp.ts'
import { APP_VERSION } from '../shared/appVersion.ts'

const CREDENTIAL = /^[A-Za-z0-9_-]{43}$/
const CREDENTIAL_FILE = /^([0-9a-f]{8})\.credential$/
const REQUEST_ID = /^[0-9a-f-]{36}$/

const isMissing = (e: unknown): boolean => (e as NodeJS.ErrnoException | null)?.code === 'ENOENT'

/** A small regular file's text, or null when there is none. Anything else unreadable throws. */
function readSmall(file: string): string | null {
  try {
    return readHubDocument(file)
  } catch (e) {
    if (isMissing(e)) return null
    throw e
  }
}

export function fileCredentialStore(root: string, runner: string): CredentialStore & { dir: string; pendingFile: string } {
  const base = path.join(root, 'enrollments')
  const dir = path.join(base, runner)
  const legacy = path.join(base, `${runner}.credential`)
  const pendingFile = path.join(base, `${runner}.pending.json`)
  const idOf = (credential: string): string => createHash('sha256').update(credential, 'utf8').digest('hex').slice(0, 8)
  const ensureDir = (): void => { mkdirSync(dir, { recursive: true, mode: 0o700 }) }

  const save = (credential: string): string => {
    if (!CREDENTIAL.test(credential)) throw new Error('that is not a credential Fabric hands over')
    ensureDir()
    const id = idOf(credential)
    writeAtomic(path.join(dir, `${id}.credential`), credential)
    return id
  }

  const migrate = (): void => {
    const text = readSmall(legacy)?.trim()
    if (text === undefined) return
    if (CREDENTIAL.test(text)) save(text)
    rmSync(legacy, { force: true })
  }

  const readRequests = (): Record<string, PendingRequest> => {
    const text = readSmall(pendingFile)
    if (text === null) return {}
    try {
      const doc = JSON.parse(text) as { version?: unknown; requests?: Record<string, unknown> }
      const out: Record<string, PendingRequest> = {}
      for (const [resource, raw] of Object.entries(doc.version === 1 && doc.requests && typeof doc.requests === 'object' ? doc.requests : {})) {
        const r = raw as Partial<PendingRequest>
        if (typeof r.requestId !== 'string' || !REQUEST_ID.test(r.requestId) || typeof r.via !== 'string') continue
        if (r.pollSecret !== undefined && (typeof r.pollSecret !== 'string' || !CREDENTIAL.test(r.pollSecret))) continue
        out[resource] = { requestId: r.requestId, via: r.via, ...(r.pollSecret ? { pollSecret: r.pollSecret } : {}) }
      }
      return out
    } catch {
      // A file that is not this shape holds no request to resume: the next ask writes a good one over it.
      return {}
    }
  }
  const writeRequests = (requests: Record<string, PendingRequest>): void => {
    mkdirSync(base, { recursive: true, mode: 0o700 })
    if (Object.keys(requests).length === 0) rmSync(pendingFile, { force: true })
    else writeAtomic(pendingFile, JSON.stringify({ version: 1, requests }, null, 2) + '\n')
  }

  return {
    dir, pendingFile,
    list() {
      migrate()
      let names: string[]
      try {
        names = readdirSync(dir)
      } catch (e) {
        if (isMissing(e)) return []
        throw e
      }
      const out: Array<{ id: string; credential: string }> = []
      for (const name of names.sort()) {
        const m = CREDENTIAL_FILE.exec(name)
        if (!m) continue
        const text = readSmall(path.join(dir, name))?.trim()
        if (text && CREDENTIAL.test(text)) out.push({ id: m[1], credential: text })
      }
      return out
    },
    save,
    forget(id) {
      if (/^[0-9a-f]{8}$/.test(id)) rmSync(path.join(dir, `${id}.credential`), { force: true })
    },
    pending(resource) {
      return readRequests()[resource] ?? null
    },
    keepPending(resource, request) {
      writeRequests({ ...readRequests(), [resource]: request })
    },
    forgetPending(resource) {
      const all = readRequests()
      if (!(resource in all)) return
      delete all[resource]
      writeRequests(all)
    }
  }
}

/** How an MCP client reaches the hub; replaced in tests by an in-memory transport. */
export type TransportFactory = (url: string, bearer: string) => Transport

/** Retry-After is either seconds or an HTTP date. Missing/invalid/excessive values use a bounded fallback. */
export function retryAfterMs(header: string | null, now = Date.now()): number {
  if (header === null || header.trim() === '') return boundedRetryMs(undefined)
  const value = header.trim()
  // Seconds, or an HTTP-date (RFC 9110 §10.2.3); anything else is not a wait the hub stated, and takes the fallback.
  const delay = /^\d+$/.test(value) ? Number(value) * 1000
    : /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value) ? Date.parse(value) - now
    : undefined
  return boundedRetryMs(delay)
}

// #region fabric-mcp-refusal-body — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#tracking
/** The largest refusal body read, and how long it may take: the hub's is one short JSON object. */
export const REFUSAL_BODY_MAX = 4096
export const REFUSAL_BODY_MS = 2000
/**
 * What the hub said with a refusal to wait (review UX-3): its 503 carries `{"error": <why>, "code": "stack-starting" |
 * "stack-unavailable"}` (hubStandby.ts#refuseForStack). Read bounded in size and time; a body that is larger, slower or
 * not that JSON gives nothing, and the wait still holds. Only the code and the one-line reason leave this function.
 */
export async function refusalSaid(response: Response): Promise<HubRefusal | undefined> {
  const reader = response.body?.getReader()
  if (!reader) return undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'late'>((resolve) => { timer = setTimeout(() => resolve('late'), REFUSAL_BODY_MS) })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), late])
      if (next === 'late' || next.done) {
        if (next === 'late') return undefined
        break
      }
      size += next.value.byteLength
      if (size > REFUSAL_BODY_MAX) return undefined
      chunks.push(next.value)
    }
    return hubRefusalOf(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  } catch {
    // Not the hub's JSON (a proxy's page, a body cut short): no reason to pass on; the status and the wait still say it.
    return undefined
  } finally {
    if (timer) clearTimeout(timer)
    await reader.cancel().catch(() => {})
  }
}
// #endregion fabric-mcp-refusal-body

export const httpTransport: TransportFactory = (url, bearer) => {
  // SDK background SSE failures do not reject callTool. The same transport must therefore
  // enforce a monotonic deadline before EVERY fetch, including its next foreground POST.
  let retryUntil = 0
  return new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${bearer}` } },
    // The SDK's StreamableHTTPError discards headers. Capture the delay at the fetch boundary;
    // do not replay the request, and do not copy the URL, bearer or arbitrary response body into an error.
    fetch: async (input, init) => {
      const remaining = retryUntil - performance.now()
      // 0.3.9 review iteration 2, ER-2: the session's DELETE (the agent leaving) is the one request the hub takes while
      // its stack is lost, so it is never held by the cooldown; `leave` bounds it in time.
      const leaving = (init?.method ?? '').toUpperCase() === 'DELETE'
      if (remaining > 0 && !leaving) throw new FabricRateLimitError(remaining)
      const response = await fetch(input, init)
      if (response.status === 429 || (response.status === 503 && response.headers.get('retry-after') !== null)) {
        const delay = retryAfterMs(response.headers.get('retry-after'))
        retryUntil = Math.max(retryUntil, performance.now() + delay)
        // UX-3: the body says why (stack-starting, stack-unavailable); read bounded, and only its code and reason kept.
        const said = await refusalSaid(response)
        throw new FabricRateLimitError(delay, response.status, said)
      }
      return response
    }
  })
}

async function connect(url: string, bearer: string, transportOf: TransportFactory): Promise<{ client: Client; transport: Transport }> {
  const transport = transportOf(url, bearer)
  const client = new Client({ name: 'fabric-mcp', version: APP_VERSION })
  await client.connect(transport)
  return { client, transport }
}

/** One tool call to the hub as a short-lived client. HTTP 401/403 is `unauthorized`; anything else thrown is thrown. */
export function makeHubCall(transportOf: TransportFactory = httpTransport): HubCall {
  return async (url, bearer, tool, args) => {
    let link: Awaited<ReturnType<typeof connect>> | null = null
    try {
      link = await connect(url, bearer, transportOf)
      const r = (await link.client.callTool({ name: tool, arguments: args })) as { isError?: boolean; structuredContent?: Record<string, unknown>; content?: unknown }
      // PL-2: an error with no structured answer (the hub's schema refused an argument) is known by its text.
      const said = r.isError && !r.structuredContent && Array.isArray(r.content)
        ? r.content.map((c) => (typeof (c as { text?: unknown }).text === 'string' ? (c as { text: string }).text : '')).join(' ').slice(0, 2000)
        : ''
      return { isError: Boolean(r.isError), value: r.structuredContent ?? {}, ...(said ? { text: said } : {}) }
    } catch (e) {
      const status = (e as { code?: unknown } | null)?.code
      if (status === 401 || status === 403) return { unauthorized: true }
      throw e
    } finally {
      await link?.client.close().catch(() => {})
    }
  }
}

/** The session a bearer opens. When its transport closes, the SDK's own close handling runs first (it fails the
 *  requests still waiting, which would otherwise hang), then the proxy is told. */
export async function openSessionLink(url: string, bearer: string, transportOf: TransportFactory = httpTransport, opts: { leaveMs?: number } = {}): Promise<SessionLink> {
  const { client, transport } = await connect(url, bearer, transportOf)
  const link: SessionLink = {
    listTools: async () => (await client.listTools()).tools,
    callTool: async (name, args) => (await client.callTool({ name, arguments: args })) as Record<string, unknown>,
    // TR-4: the session's sign of life while the agent works; the smallest request MCP has.
    ping: async () => { await client.ping() },
    close: () => client.close(),
    // The SDK's close() sends nothing to the server; terminateSession() is the HTTP session's DELETE (0.3.5 review i2
    // ER-4). Bounded: a Fabric that is gone or hung must not hold the coding agent's exit.
    leave: async () => {
      const terminate = (transport as { terminateSession?: () => Promise<void> }).terminateSession
      if (terminate) {
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await Promise.race([terminate.call(transport), new Promise<void>((resolve) => { timer = setTimeout(resolve, opts.leaveMs ?? 2000) })])
        } catch (e) {
          // fabric-mcp has no ops sink: stderr. Fabric then ends the session when the cap or a revocation does.
          process.stderr.write(`fabric-mcp: Fabric could not be told this session ended (${e instanceof Error ? e.message : String(e)})\n`)
        } finally {
          if (timer) clearTimeout(timer)
        }
      }
      await client.close().catch((e: unknown) => {
        // Closing a transport that already failed: nothing is left open to report beyond this line.
        process.stderr.write(`fabric-mcp: the session's transport did not close cleanly (${e instanceof Error ? e.message : String(e)})\n`)
      })
    }
  }
  const sdkOnclose = transport.onclose
  transport.onclose = () => {
    try {
      sdkOnclose?.()
    } finally {
      link.onclose?.()
    }
  }
  return link
}
// #endregion fabric-mcp-client
