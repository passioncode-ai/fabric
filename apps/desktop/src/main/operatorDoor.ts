// #region board-operator-door — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
/**
 * The board's operator door (ADR-0195 W2c.2a): the loopback door through which the window reaches the board's doors
 * once the board runs in its own process. This step is the transport alone; the door groups it serves (the about 45
 * `hub*`, `work*` and attention doors of the plan's §2.2) are registered on it by W2c.2b, and nothing starts it yet.
 *
 * - It listens on `127.0.0.1` only, on a port the system picks, and publishes `board-door.json` (protocol, origin, pid)
 *   with a fresh 32-byte token in `board-door-token` beside `hub.json`, both written 0600 by `hub.ts#writeAtomic`, the
 *   token first, so a reader that finds the document always finds the token it names.
 * - Every request is checked in this order before its body is read: the Host names this listener (421), no browser
 *   Origin (403), the caller's account (CO-514, `peerAccount.ts#createPeerCheck`: another account's process 403
 *   `peer-foreign-account`, one that cannot be told 503 `peer-unverified` with Retry-After), then the bearer token,
 *   compared in constant time (401). Only then is the body read, at most `maxBodyBytes`.
 * - A call is `POST /door/<name>` with a JSON body `{ "args": … }`; the answer is `{ "ok": true, "value": … }`, an unknown
 *   door 404 `unknown-door`, a door that threw 500 `door-failed` with its message (never its stack).
 * - Its stop closes the listener and removes both files, only while `board-door.json` still names this process.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path from 'node:path'
import { pidAlive, readHubDocument, writeAtomic } from './hub.ts'
import { ops } from './opsSink.ts'
import type { PeerVerdict } from './peerAccount.ts'

export const OPERATOR_DOOR_PROTOCOL = 'fabric-board-door/0.1'
/** The default bound of a call's body: a door's arguments are small; a larger body is refused unread (413). */
export const OPERATOR_DOOR_MAX_BODY_BYTES = 1024 * 1024
/** How long a caller whose account could not be told waits before it asks again, as the hub answers (agentSurface.ts). */
export const OPERATOR_DOOR_RETRY_AFTER_S = 5

export interface OperatorDoorDocument {
  protocol: typeof OPERATOR_DOOR_PROTOCOL
  origin: string
  tokenFile: string
  pid: number
  startedAt: string
}

export type OperatorDoorHandler = (args: unknown) => unknown
export type OperatorDoorLog = (event: { op: string; door?: string; code?: string; status?: number; message?: string }) => void

export function operatorDoorPaths(root: string): { doorFile: string; tokenFile: string } {
  return { doorFile: path.join(root, 'board-door.json'), tokenFile: path.join(root, 'board-door-token') }
}

const DOOR_NAME = /^[a-z][A-Za-z0-9.:-]{0,127}$/

export interface OperatorDoor {
  readonly port: number
  readonly origin: string
  readonly document: OperatorDoorDocument
  /** Closes the listener and withdraws the files; safe to call twice. */
  stop(): Promise<void>
}

export async function startOperatorDoor(opts: {
  /** The registry root `hub.json` lives in. */
  root: string
  /** The doors by name. A name outside `DOOR_NAME` is refused at start. */
  doors: ReadonlyMap<string, OperatorDoorHandler>
  /** CO-514: whose process is on the other end; `createPeerCheck()` in the board. */
  peerAccount: (socket: { remotePort?: number }) => Promise<PeerVerdict>
  port?: number
  pid?: number
  maxBodyBytes?: number
  now?: () => Date
  random?: (n: number) => Buffer
  log?: OperatorDoorLog
}): Promise<OperatorDoor> {
  for (const name of opts.doors.keys()) if (!DOOR_NAME.test(name)) throw new Error(`the operator door cannot serve a door named ${JSON.stringify(name)}`)
  const log: OperatorDoorLog = opts.log ?? (() => {})
  const maxBody = opts.maxBodyBytes ?? OPERATOR_DOOR_MAX_BODY_BYTES
  const pid = opts.pid ?? process.pid
  const token = (opts.random ?? randomBytes)(32).toString('base64url')
  const expected = Buffer.from(`Bearer ${token}`)
  let port = 0

  const answer = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void => {
    if (res.headersSent) return
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers })
    res.end(JSON.stringify(body))
  }
  const refuse = (res: ServerResponse, status: number, code: string, message: string, headers?: Record<string, string>): void => {
    log({ op: 'operatorDoor.refused', code, status })
    answer(res, status, { ok: false, error: code, message }, headers)
  }

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.headers.host !== `127.0.0.1:${port}`) return refuse(res, 421, 'wrong-host', 'the Host does not name the board\'s operator door')
    if (req.headers.origin !== undefined) return refuse(res, 403, 'browser-origin', 'browser origins cannot call the board\'s operator door')
    const verdict = await opts.peerAccount(req.socket)
    if (verdict === 'foreign') return refuse(res, 403, 'peer-foreign-account', 'another account of this computer called the board\'s operator door')
    if (verdict === 'unverified') return refuse(res, 503, 'peer-unverified', 'the account of the caller could not be told', { 'retry-after': String(OPERATOR_DOOR_RETRY_AFTER_S) })
    const given = Buffer.from(req.headers.authorization ?? '')
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return refuse(res, 401, 'bad-token', 'the operator door\'s token is missing or wrong')
    const route = /^\/door\/([^/?#]+)$/.exec((req.url ?? '').split('?')[0])
    if (req.method !== 'POST' || !route) return refuse(res, 405, 'not-a-door-call', 'a door is called with POST /door/<name>', { allow: 'POST' })
    let name: string
    try { name = decodeURIComponent(route[1]) } catch {
      // A malformed escape in the door's name is the caller's mistake, refused as such (0.3.28 review, ER-6).
      return refuse(res, 400, 'bad-door-name', 'the door\'s name is not a valid URL path segment')
    }
    const handler = opts.doors.get(name)
    if (!handler) return refuse(res, 404, 'unknown-door', `the board serves no door named ${JSON.stringify(name)}`)
    const declared = Number(req.headers['content-length'] ?? 0)
    if (declared > maxBody) return refuse(res, 413, 'body-too-large', `a door's arguments are at most ${maxBody} bytes`, { connection: 'close' })
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      size += (chunk as Buffer).length
      if (size > maxBody) return refuse(res, 413, 'body-too-large', `a door's arguments are at most ${maxBody} bytes`, { connection: 'close' })
      chunks.push(chunk as Buffer)
    }
    let args: unknown
    try {
      const text = Buffer.concat(chunks).toString('utf8')
      const body = text.trim() === '' ? {} : JSON.parse(text) as unknown
      if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object')
      args = (body as { args?: unknown }).args
    } catch {
      // Not a failure of the board: the caller sent a body that is not a JSON object. `refuse` records it as
      // `operatorDoor.refused` with its code, and the caller is told why.
      return refuse(res, 400, 'bad-body', 'a door call\'s body is a JSON object { "args": … }')
    }
    try {
      const value = await handler(args)
      answer(res, 200, { ok: true, value: value === undefined ? null : value })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      ops.failed('operatorDoor.door-failed', e, { door: name })
      log({ op: 'operatorDoor.door-failed', door: name, status: 500, message })
      answer(res, 500, { ok: false, error: 'door-failed', message })
    }
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((e) => {
      ops.failed('operatorDoor.handle-failed', e)
      log({ op: 'operatorDoor.handle-failed', message: e instanceof Error ? e.message : String(e) })
      answer(res, 500, { ok: false, error: 'door-failed', message: 'the operator door could not answer' })
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(opts.port ?? 0, '127.0.0.1', () => { server.off('error', reject); resolve() })
  })
  port = (server.address() as { port: number }).port

  const { doorFile, tokenFile } = operatorDoorPaths(opts.root)
  const document: OperatorDoorDocument = {
    protocol: OPERATOR_DOOR_PROTOCOL,
    origin: `http://127.0.0.1:${port}`,
    tokenFile,
    pid,
    startedAt: (opts.now ?? (() => new Date()))().toISOString()
  }
  try {
    mkdirSync(opts.root, { recursive: true, mode: 0o700 })
    writeAtomic(tokenFile, token)
    writeAtomic(doorFile, JSON.stringify(document, null, 2) + '\n')
  } catch (e) {
    await new Promise<void>((r) => server.close(() => r()))
    rmSync(tokenFile, { force: true })
    throw e
  }
  log({ op: 'operatorDoor.started' })

  let stopped: Promise<void> | null = null
  return {
    port,
    origin: document.origin,
    document,
    stop() {
      // The listener closes even when the files cannot be withdrawn, and a stop that failed may be asked again
      // (0.3.28 review, ER-7).
      stopped ??= (async () => {
        try {
          const left = withdrawOperatorDoor(opts.root, pid)
          if (!left.removed) log({ op: 'operatorDoor.withdraw-skipped', message: left.reason ?? 'not removed' })
        } finally {
          server.closeAllConnections?.()
          await new Promise<void>((r) => server.close(() => r()))
        }
        log({ op: 'operatorDoor.stopped' })
      })()
      const ending = stopped
      // The caller of stop() sees the failure; here a failed stop is only made askable again.
      ending.catch(() => { if (stopped === ending) stopped = null })
      return ending
    }
  }
}

/** Removes both files, only while `board-door.json` still names `pid`; anything else is left in place and said. */
export function withdrawOperatorDoor(root: string, pid: number = process.pid): { removed: boolean; reason?: string } {
  const { doorFile, tokenFile } = operatorDoorPaths(root)
  let current: Partial<OperatorDoorDocument> | null
  try {
    const text = readHubDocument(doorFile)
    if (text === null) return { removed: false, reason: 'board-door.json is not a regular file; left in place' }
    current = JSON.parse(text) as Partial<OperatorDoorDocument>
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { removed: false, reason: 'no board-door.json to remove' }
    return { removed: false, reason: 'board-door.json could not be read; left in place' }
  }
  if (current?.pid !== pid) return { removed: false, reason: `board-door.json names process ${String(current?.pid)}, not this one` }
  rmSync(doorFile, { force: true })
  rmSync(tokenFile, { force: true })
  return { removed: true }
}

export type OperatorDoorAnswer =
  | { ok: true; value: unknown }
  | { ok: false; error: string; message: string; status?: number }

/**
 * The window's side: read `board-door.json` and its token the way they were written (a small regular file, never a
 * link, the token inside the registry root), then call one door. A refusal is an answer, never a throw.
 */
export async function callOperatorDoor(root: string, door: string, args: unknown, deps: {
  fetch?: typeof fetch
  isAlive?: (pid: number) => boolean
  timeoutMs?: number
} = {}): Promise<OperatorDoorAnswer> {
  const { doorFile } = operatorDoorPaths(root)
  let doc: Partial<OperatorDoorDocument>
  let token: string
  try {
    const text = readHubDocument(doorFile)
    if (text === null) return { ok: false, error: 'no-door', message: 'board-door.json is not a regular file' }
    doc = JSON.parse(text) as Partial<OperatorDoorDocument>
    if (doc.protocol !== OPERATOR_DOOR_PROTOCOL) return { ok: false, error: 'no-door', message: 'board-door.json speaks another protocol' }
    if (typeof doc.origin !== 'string' || !/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(doc.origin)) return { ok: false, error: 'no-door', message: 'board-door.json names an origin that is not the loopback literal' }
    if (typeof doc.tokenFile !== 'string' || path.resolve(path.dirname(doc.tokenFile)) !== path.resolve(root)) return { ok: false, error: 'no-door', message: 'board-door.json names a token outside the registry root' }
    if (!Number.isInteger(doc.pid) || !(deps.isAlive ?? pidAlive)(doc.pid as number)) return { ok: false, error: 'no-door', message: 'the board that wrote board-door.json is not running' }
    const t = readHubDocument(doc.tokenFile)
    if (t === null || !/^[A-Za-z0-9_-]{43}$/.test(t.trim())) return { ok: false, error: 'no-door', message: 'the operator door\'s token is not one the board writes' }
    token = t.trim()
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    return { ok: false, error: 'no-door', message: code === 'ENOENT' ? 'the board is not running: there is no board-door.json' : 'board-door.json could not be read' }
  }
  try {
    const res = await (deps.fetch ?? fetch)(`${doc.origin}/door/${encodeURIComponent(door)}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ args }),
      signal: AbortSignal.timeout(deps.timeoutMs ?? 15_000)
    })
    const body = await res.json().catch(() => null) as Partial<{ ok: boolean; value: unknown; error: string; message: string }> | null
    if (res.ok && body?.ok === true) return { ok: true, value: body.value ?? null }
    return { ok: false, error: body?.error ?? 'bad-answer', message: body?.message ?? `the operator door answered ${res.status}`, status: res.status }
  } catch (e) {
    return { ok: false, error: 'unreachable', message: e instanceof Error ? e.message : String(e) }
  }
}

// #endregion board-operator-door
