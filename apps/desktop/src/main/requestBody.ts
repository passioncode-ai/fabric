/**
 * Reading and refusing one request on the agent surface's port (moved out of `agentSurface.ts`, the screens waves S2,
 * 2026-11-16): the body under its size cap and deadline, and the one JSON refusal every door answers with.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ops } from './opsSink.ts'

/** A refusal: its reason reaches the log as well as the client. */
export function refuse(
  res: ServerResponse,
  status: number,
  reason: string,
  extra: Record<string, string> = {},
  attempt?: { refused(reason: string): void }
): void {
  // The reason reaches the LOG as well as the client. A 401 whose record says
  // only "401" cannot tell an expired credential from a stolen one, and those
  // are the two things anybody reading a 401 is trying to distinguish.
  attempt?.refused(reason)
  res.writeHead(status, { 'content-type': 'application/json', ...extra })
  res.end(JSON.stringify({ error: reason }))
}

/** A request body larger than this is refused rather than read (M104).
 *
 *  Not a performance figure: without a cap a single request can take the main
 *  process's memory with it, and the door is reachable by anything that has a
 *  bearer — including an agent looping on a mistake. A megabyte is far past any
 *  real tool call and far short of a problem. */
export const MAX_BODY_BYTES = 1_000_000

export class BodyTooLarge extends Error {
  constructor() {
    super('request body too large')
  }
}

export class BodyReadTimeout extends Error {
  constructor() { super('request body deadline exceeded') }
}

export async function readJson(req: IncomingMessage, timeoutMs: number): Promise<unknown> {
  // Event listeners can be removed on timeout without leaving an iterator blocked on next().
  // The caller sends Connection: close, so the bounded refusal reaches the peer before closure.
  const raw = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const cleanup = () => {
      clearTimeout(timer)
      req.off('data', data); req.off('end', end); req.off('aborted', aborted); req.off('error', failed)
    }
    const failed = (error: Error) => { cleanup(); reject(error) }
    const aborted = () => failed(new Error('request body aborted'))
    const data = (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) { req.pause(); failed(new BodyTooLarge()); return }
      chunks.push(chunk)
    }
    const end = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')) }
    const timer = setTimeout(() => { req.pause(); failed(new BodyReadTimeout()) }, timeoutMs)
    req.on('data', data); req.once('end', end); req.once('aborted', aborted); req.once('error', failed)
  })
  if (!raw) return undefined
  try { return JSON.parse(raw) } catch (e) {
    ops.failed('agentSurface.optional-read', e)
    return undefined
  }
}
