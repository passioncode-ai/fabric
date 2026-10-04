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
// THE ORIGIN IS USED EXACTLY AS WRITTEN. `http://127.0.0.1:<port>`, never `localhost`: a name that resolves
// to another loopback address could reach another program. Fabric holds the hub port on [::1] as well
// (`AgentSurface.start`), so the IPv6 loopback cannot be squatted while Fabric runs (ER-8, verification
// iteration 1 for 0.3.1), but the published origin is the contract.
//
// THE PORT DOES NOT PROVE WHO HOLDS IT. While Fabric is down, any program running as this user can listen on
// the hub's port and answer like a hub (port squatting). So the contract for an agent is: re-read hub.json
// before sending a binding credential, and send it only when the `pid` hub.json names is alive (and is
// Fabric); hub.json is removed on quit, so no file or a dead pid means no hub, whatever answers on the port.
// The hub's own tool descriptions say this to the agent (`hubTools.ts`, VERIFY_HUB).
//
// THE PORT IS STABLE OR THERE IS NO HUB. An agent stores the origin; a random fallback port would make
// every stored origin wrong without anyone being told. A port another registered agent claims is
// refused before listening, and a port in use is an error with its reason — never a quiet move.

import type { HubDownCode } from '../shared/access.ts'
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

export type PortChoice = { ok: true; port: number } | { ok: false; reason: string; code: HubDownCode; fact: string }

/** The configured hub port, or why the configuration is unusable. */
export function hubPort(env: NodeJS.ProcessEnv = process.env): PortChoice {
  const raw = env.FABRIC_HUB_PORT
  if (raw === undefined || raw === '') return { ok: true, port: DEFAULT_HUB_PORT }
  if (!/^\d{4,5}$/.test(raw) || Number(raw) < 1024 || Number(raw) > 65535)
    return { ok: false, code: 'port-setting', fact: `FABRIC_HUB_PORT=${JSON.stringify(raw)}`, reason: `the hub port setting (FABRIC_HUB_PORT=${JSON.stringify(raw)}) is not a port between 1024 and 65535. Correct or remove it, then quit and reopen Fabric` }
  return { ok: true, port: Number(raw) }
}

/** Refuses a port a registered agent claims (FAC-SEM-010 applied to Fabric itself). */
export function checkPortUnclaimed(port: number, claimed: Map<number, string>): PortChoice {
  const by = claimed.get(port)
  return by
    ? { ok: false, code: 'port-claimed', fact: `port ${port}: ${by}`, reason: `port ${port} is claimed by the registered agent ${by}, so agents outside Fabric cannot reach it. Move that agent to another port (or choose a free one for Fabric with FABRIC_HUB_PORT), then quit and reopen Fabric` }
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
/** What `startHub` needs of the surface: listen on a port (a refusal throws), and say where it listens. */
export interface HubListener {
  start(opts?: { port?: number }): Promise<void>
  readonly origin: string
}

/** `down` is said to sessions and agents (English, with the instruction); `downCode` and `downFact` let the
 *  operator's panel say it in their language (verification iteration 2 for 0.3.1, DO-14, UX-5). */
export type HubStart = { open: true; doorToken: string; hubFile: string } | { open: false; down: string; downCode: HubDownCode; downFact: string }

/**
 * Start the surface on the hub's stable port and publish the hub — or, when the port cannot be had,
 * start it on an ephemeral port with the external ingress CLOSED (no hub.json, no door token) and say
 * why (DA-9, verification iteration 1 for 0.3.1: this was inline in `index.ts`, driven by no test).
 * Sessions Fabric starts work either way; only agents outside Fabric lose the hub. Never throws: a
 * surface that cannot listen at all is reported in `down`, and the caller's sessions say so.
 */
export async function startHub(opts: {
  surface: HubListener
  env?: NodeJS.ProcessEnv
  claimedPorts: Map<number, string>
  root: string
  publish?: typeof publishHub
}): Promise<HubStart> {
  const chosen = hubPort(opts.env ?? process.env)
  const unclaimed = chosen.ok ? checkPortUnclaimed(chosen.port, opts.claimedPorts) : chosen
  let down: string
  let downCode: HubDownCode
  let downFact: string
  try {
    if (!unclaimed.ok) throw Object.assign(new Error(unclaimed.reason), { name: 'HubPortUnavailable' })
    await opts.surface.start({ port: unclaimed.port })
    const published = (opts.publish ?? publishHub)({ root: opts.root, port: unclaimed.port })
    ops.record({ op: 'hub.published', outcome: 'ok', detail: { origin: opts.surface.origin, hub_file: published.hubFile }, ctx: { correlationId: ops.correlate() } })
    return { open: true, doorToken: published.doorToken, hubFile: published.hubFile }
  } catch (e) {
    const portRefused = (e as Error).name === 'HubPortUnavailable'
    down = portRefused
      ? (e as Error).message
      : `the hub could not start (${(e as Error).message}), so agents outside Fabric cannot reach it. Quit and reopen Fabric to try again`
    downCode = !unclaimed.ok ? unclaimed.code : portRefused ? 'port-taken' : 'not-started'
    // The observation only: the surface says "port N on HOST is …, so agents … . Close …" — keep the first clause.
    downFact = !unclaimed.ok ? unclaimed.fact : ((e as Error).message.split(/, so agents /)[0] ?? (e as Error).message)
    ops.failed('index.hub-not-listening', e, { reason: down })
  }
  try {
    if (!opts.surface.origin) await opts.surface.start()
  } catch (e2) {
    // A session must still start when the surface cannot: the agent simply has nothing to report
    // through, and the launch says so rather than failing.
    ops.failed('index.agent-surface-failed-to-start', e2, { note: 'agent surface failed to start:' })
  }
  return { open: false, down, downCode, downFact }
}
// #endregion hub-discovery
