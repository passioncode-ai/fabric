// #region hub-discovery — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#1-one-door-a-second-way-in
// How an agent on this Mac finds Fabric's hub (ADR-0115 §1). Fabric is an app, not a launchd service,
// so it publishes no `fabric-service` descriptor; while it runs it keeps ONE stable loopback port and
// writes `hub.json` beside the registry directories, with the door token in a file of its own:
//
//   { "protocol": "fabric-hub/0.1", "origin": "http://127.0.0.1:<port>", "mcp": "/mcp",
//     "doorTokenFile": "<path>", "pid": <pid>, "startedAt": "<iso>" }
//
// Both files are mode 0600, written atomically (temporary file, fsync, rename), rotated on every start
// and removed on quit — only by the process that wrote them, so a second Fabric that failed to start
// cannot delete the first one's door.
//
// THE PORT IS STABLE OR THERE IS NO HUB. An agent stores the origin; a random fallback port would make
// every stored origin wrong without anyone being told. A port another registered agent claims is
// refused before listening, and a port in use is an error with its reason — never a quiet move.

import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync, chmodSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { ops } from './opsSink.ts'

export const HUB_PROTOCOL = 'fabric-hub/0.1'
/** Chosen to sit apart from the ports agent services on this machine commonly take; `FABRIC_HUB_PORT` overrides. */
export const DEFAULT_HUB_PORT = 47070

export interface HubDocument {
  protocol: typeof HUB_PROTOCOL
  origin: string
  mcp: '/mcp'
  doorTokenFile: string
  pid: number
  startedAt: string
}

export type PortChoice = { ok: true; port: number } | { ok: false; reason: string }

/** The configured hub port, or why the configuration is unusable. */
export function hubPort(env: NodeJS.ProcessEnv = process.env): PortChoice {
  const raw = env.FABRIC_HUB_PORT
  if (raw === undefined || raw === '') return { ok: true, port: DEFAULT_HUB_PORT }
  if (!/^\d{4,5}$/.test(raw) || Number(raw) < 1024 || Number(raw) > 65535)
    return { ok: false, reason: `FABRIC_HUB_PORT=${JSON.stringify(raw)} is not a port between 1024 and 65535` }
  return { ok: true, port: Number(raw) }
}

/** Refuses a port a registered agent claims (FAC-SEM-010 applied to Fabric itself). */
export function checkPortUnclaimed(port: number, claimed: Map<number, string>): PortChoice {
  const by = claimed.get(port)
  return by
    ? { ok: false, reason: `port ${port} is claimed by the registered agent ${by}; set FABRIC_HUB_PORT to a free port` }
    : { ok: true, port }
}

export function hubPaths(root: string): { hubFile: string; doorTokenFile: string } {
  return { hubFile: path.join(root, 'hub.json'), doorTokenFile: path.join(root, 'hub-door-token') }
}

function writeAtomic(file: string, contents: string): void {
  const tmp = `${file}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
  const fd = openSync(tmp, 'wx', 0o600)
  try {
    writeSync(fd, contents)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  // The umask cannot widen a file created 0600, but a rename onto an existing file keeps the new
  // inode's mode — stated again so the property does not depend on how the file was first made.
  chmodSync(tmp, 0o600)
  renameSync(tmp, file)
}

/**
 * Publish the hub: a fresh door token (32 random bytes, base64url) and `hub.json` naming it.
 * The door token goes first, so a reader that finds `hub.json` always finds the token it names.
 */
export function publishHub(opts: {
  root: string
  port: number
  pid?: number
  now?: () => Date
  random?: (n: number) => Buffer
}): { doorToken: string; document: HubDocument; hubFile: string; doorTokenFile: string } {
  mkdirSync(opts.root, { recursive: true, mode: 0o700 })
  const { hubFile, doorTokenFile } = hubPaths(opts.root)
  const doorToken = (opts.random ?? randomBytes)(32).toString('base64url')
  writeAtomic(doorTokenFile, doorToken)
  const document: HubDocument = {
    protocol: HUB_PROTOCOL,
    origin: `http://127.0.0.1:${opts.port}`,
    mcp: '/mcp',
    doorTokenFile,
    pid: opts.pid ?? process.pid,
    startedAt: (opts.now ?? (() => new Date()))().toISOString()
  }
  writeAtomic(hubFile, JSON.stringify(document, null, 2) + '\n')
  return { doorToken, document, hubFile, doorTokenFile }
}

/** Remove both files — only when `hub.json` still names this process. */
export function withdrawHub(root: string, pid: number = process.pid): { removed: boolean; reason?: string } {
  const { hubFile, doorTokenFile } = hubPaths(root)
  let current: Partial<HubDocument> | null = null
  try {
    current = JSON.parse(readFileSync(hubFile, 'utf8')) as Partial<HubDocument>
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { removed: false, reason: 'no hub.json to remove' }
    ops.failed('hub.withdraw-read', e, { file: hubFile })
    return { removed: false, reason: 'hub.json could not be read; left in place' }
  }
  if (current?.pid !== pid) return { removed: false, reason: `hub.json names process ${String(current?.pid)}, not this one` }
  rmSync(hubFile, { force: true })
  rmSync(doorTokenFile, { force: true })
  return { removed: true }
}
// #endregion hub-discovery
