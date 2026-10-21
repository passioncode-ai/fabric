// #region hub-standby — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
/**
 * The hub before the stack (ST-3 of the 0.3.9 stability audit). The hub was created only after the local stack had
 * started and the schema was verified, so while Docker or the database was not ready (55 minutes on 2026-10-20) an
 * agent found no hub at all: `hub_not_published`, a connection refused, indistinguishable from Fabric not running.
 *
 * Now Fabric takes the hub's port and publishes hub.json first, and this standby answers every call with a typed
 * refusal: HTTP 503, `{ "error": <why>, "code": "stack-starting" | "stack-unavailable" }` and Retry-After, which
 * fabric-mcp already reads as "wait" (`fabricMcp.ts#FabricRateLimitError`). When the database is ready the real
 * surface takes over the very same listening sockets (`AgentSurface.start({ adopt })`): no moment without a listener,
 * no second bind another program could win, and the door token the standby published stays valid.
 *
 * Nothing here reads the database, a credential or a body: the refusal is the same for everyone, and it is decided
 * before anything that could cost a lookup. The destination checks are the surface's own (V2 ER-3).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { HubPortUnavailable } from './agentSurface.ts'
import { checkPortUnclaimed, hubPort, publishHub, withdrawHub } from './hub.ts'
import { ops } from './opsSink.ts'
import type { StackRefusal } from '../shared/stackWatch.ts'

/** The listening sockets a standby hands to the surface. */
export interface AdoptedListeners {
  port: number
  server: Server
  server6: Server | null
}

/** Answer one request with the refusal, after the same destination checks the surface makes. */
export function refuseForStack(req: IncomingMessage, res: ServerResponse, port: number, refusal: StackRefusal): void {
  if (![`127.0.0.1:${port}`, `[::1]:${port}`].includes(req.headers.host ?? '')) {
    res.writeHead(421, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'the Host does not name this Fabric loopback listener' }))
    return
  }
  if (req.headers.origin !== undefined) {
    res.writeHead(403, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'browser origins cannot call the Fabric agent surface' }))
    return
  }
  const path = (req.url ?? '').split('?')[0]
  const routed = path.startsWith('/mcp') || /^\/fabric\/v1\/connect\//.test(path)
  if (!routed) {
    res.writeHead(404).end()
    return
  }
  // The body is not read: drained so the client sees the answer rather than a reset.
  req.resume()
  res.writeHead(503, { 'content-type': 'application/json', 'retry-after': String(refusal.retryAfterS) })
  res.end(JSON.stringify({ error: refusal.reason, code: refusal.code, retryable: true }))
}

export class HubStandby {
  private refusal: () => StackRefusal
  private server: Server | null = null
  private server6: Server | null = null
  private port = 0

  constructor(opts: { refusal: () => StackRefusal }) {
    this.refusal = opts.refusal
  }

  /** `http://127.0.0.1:<port>` while it listens; empty before and after. */
  get origin(): string {
    return this.port ? `http://127.0.0.1:${this.port}` : ''
  }

  private handler = (req: IncomingMessage, res: ServerResponse): void => {
    try {
      refuseForStack(req, res, this.port, this.refusal())
    } catch (e) {
      ops.failed('hub.standby.answer', e)
      if (!res.headersSent) res.writeHead(503, { 'retry-after': '10' }).end()
      else res.destroy()
    }
  }

  /** Hold the port on 127.0.0.1 and [::1], as the surface does (ER-8); a port that cannot be had throws. */
  async listen(port: number): Promise<void> {
    if (this.server) return
    const taken = (host: string, e: NodeJS.ErrnoException): Error =>
      e.code === 'EADDRINUSE' || e.code === 'EACCES'
        ? new HubPortUnavailable(port, `port ${port} on ${host} is ${e.code === 'EADDRINUSE' ? 'already in use by another program' : 'not available to this user'}, so agents outside Fabric cannot reach it. Close that program (or choose a free port with FABRIC_HUB_PORT), then quit and reopen Fabric`)
        : e
    const server = createServer(this.handler)
    await new Promise<void>((resolve, reject) => {
      server.once('error', (e: NodeJS.ErrnoException) => reject(taken('127.0.0.1', e)))
      server.listen(port, '127.0.0.1', () => resolve())
    })
    const server6 = createServer(this.handler)
    const bound6 = await new Promise<Error | 'bound' | 'absent'>((resolve) => {
      server6.once('error', (e: NodeJS.ErrnoException) => resolve(e.code === 'EADDRNOTAVAIL' || e.code === 'EAFNOSUPPORT' ? 'absent' : taken('[::1]', e)))
      server6.listen({ port, host: '::1', ipv6Only: true }, () => resolve('bound'))
    })
    if (bound6 instanceof Error) {
      await new Promise<void>((r) => server.close(() => r()))
      throw bound6
    }
    this.server = server
    this.server6 = bound6 === 'bound' ? server6 : null
    const address = server.address()
    this.port = typeof address === 'object' && address ? address.port : port
  }

  /** Give the sockets to the surface: from now on the standby answers nothing and holds nothing. */
  handOver(): AdoptedListeners {
    if (!this.server) throw new Error('the hub standby is not listening')
    const adopted: AdoptedListeners = { port: this.port, server: this.server, server6: this.server6 }
    this.server.removeListener('request', this.handler)
    this.server6?.removeListener('request', this.handler)
    this.server = null
    this.server6 = null
    this.port = 0
    return adopted
  }

  async stop(): Promise<void> {
    const servers = [this.server, this.server6].filter((s): s is Server => s !== null)
    this.server = null
    this.server6 = null
    this.port = 0
    await Promise.all(servers.map((s) => new Promise<void>((r) => { s.closeAllConnections?.(); s.close(() => r()) })))
  }
}

export type StandbyOpen =
  | { open: true; standby: HubStandby; port: number; doorToken: string; hubFile: string }
  | { open: false; reason: string }

/**
 * Take the hub's port and publish hub.json before the stack starts. A port the configuration refuses, a registered
 * agent claims or another program holds is reported and left to `startHub`, which says why the hub is down exactly as
 * before; nothing is published for a port Fabric does not hold.
 */
export async function openHubStandby(opts: {
  env?: NodeJS.ProcessEnv
  claimedPorts: Map<number, string>
  root: string
  refusal: () => StackRefusal
}): Promise<StandbyOpen> {
  const chosen = hubPort(opts.env ?? process.env)
  const unclaimed = chosen.ok ? checkPortUnclaimed(chosen.port, opts.claimedPorts) : chosen
  if (!unclaimed.ok) return { open: false, reason: unclaimed.reason }
  const standby = new HubStandby({ refusal: opts.refusal })
  try {
    await standby.listen(unclaimed.port)
  } catch (e) {
    ops.record({ op: 'hub.standby.not-listening', outcome: 'failed', level: 'warn', detail: { why: e instanceof Error ? e.message : String(e) }, ctx: { correlationId: ops.correlate() } })
    return { open: false, reason: e instanceof Error ? e.message : String(e) }
  }
  try {
    const published = publishHub({ root: opts.root, port: unclaimed.port })
    ops.record({ op: 'hub.standby.published', outcome: 'ok', detail: { origin: standby.origin, hub_file: published.hubFile }, ctx: { correlationId: ops.correlate() } })
    return { open: true, standby, port: unclaimed.port, doorToken: published.doorToken, hubFile: published.hubFile }
  } catch (e) {
    ops.failed('hub.standby.publish', e)
    await standby.stop()
    return { open: false, reason: e instanceof Error ? e.message : String(e) }
  }
}

/** A quit while the standby still holds the port: stop it and remove hub.json (only if it still names this process). */
export async function closeHubStandby(opened: StandbyOpen, root: string): Promise<void> {
  if (!opened.open) return
  await opened.standby.stop()
  const w = withdrawHub(root)
  if (!w.removed) ops.record({ op: 'hub.standby.withdraw', outcome: 'ok', level: 'warn', detail: { reason: w.reason }, ctx: { correlationId: ops.correlate() } })
}
// #endregion hub-standby
