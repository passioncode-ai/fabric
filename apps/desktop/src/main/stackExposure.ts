// #region stack-exposure — docs: docs/ux/scenarios.md#scn-073-диагностика
/**
 * Whether the local stack is reachable from the network (audit 2026-10-05 A7-001, P0).
 *
 * The Supabase CLI publishes PostgREST (54321) and Postgres (54322) on every interface, with its default
 * credentials, and it has no setting that binds them to loopback. Measured 2026-10-06 on the operator's
 * Mac: OrbStack listened on `*:54321` and `*:54322` (`docker.expose_ports_to_lan: true`) and both ports
 * accepted a connection on the Mac's LAN address. The binding belongs to the container engine and applies
 * to every container on the machine, so Fabric does not change it. What Fabric does is find out, and say
 * so with the remedy: a database that anyone on the café Wi-Fi can open with `postgres:postgres` is not a
 * fact the person should learn from an audit.
 *
 * The check is a TCP connect to each stack port on each of this Mac's own non-loopback addresses — the
 * same thing another device on the network would try. A connect proves reachability; a refusal or a
 * timeout proves only that this address did not answer.
 */
import net from 'node:net'
import os from 'node:os'

export interface ExposedPort {
  /** The interface whose address answered (`en0`), never the address itself: the log is shareable. */
  iface: string
  port: number
}

export interface StackExposure {
  checkedAt: string
  ports: number[]
  /** Every (interface, port) pair that accepted a connection. Empty: nothing answered off loopback. */
  exposed: ExposedPort[]
}

export interface ExposureProbe {
  interfaces?: () => NodeJS.Dict<os.NetworkInterfaceInfo[]>
  connect?: (host: string, port: number, timeoutMs: number) => Promise<boolean>
  timeoutMs?: number
  now?: () => Date
}

/** A TCP connect that settles true on connect and false on any error or the deadline. */
export function tcpReachable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    const done = (ok: boolean): void => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

/** The stack's ports from its API URL and database URL; unparseable or missing ones are left out. */
export function stackPorts(urls: Array<string | undefined | null>): number[] {
  const ports = new Set<number>()
  for (const u of urls) {
    if (!u) continue
    try {
      const port = Number(new URL(u).port)
      if (Number.isInteger(port) && port > 0) ports.add(port)
    } catch {
      /* not a URL: it names no port to check */
    }
  }
  return [...ports].sort((a, b) => a - b)
}

export async function stackExposure(ports: number[], probe: ExposureProbe = {}): Promise<StackExposure> {
  const interfaces = (probe.interfaces ?? os.networkInterfaces)()
  const connect = probe.connect ?? tcpReachable
  const timeoutMs = probe.timeoutMs ?? 1500
  const targets: Array<{ iface: string; address: string }> = []
  for (const [iface, infos] of Object.entries(interfaces))
    for (const info of infos ?? [])
      // IPv4 only: an IPv6 link-local address needs its scope, and a global IPv6 address answers on the
      // same listener as the IPv4 one here (both are `*`), so the IPv4 probe already decides the case.
      if (!info.internal && info.family === 'IPv4') targets.push({ iface, address: info.address })
  const checks = targets.flatMap((t) => ports.map(async (port) => ((await connect(t.address, port, timeoutMs)) ? { iface: t.iface, port } : null)))
  const exposed = (await Promise.all(checks)).filter((x): x is ExposedPort => x !== null)
  return { checkedAt: (probe.now ?? (() => new Date()))().toISOString(), ports, exposed }
}
// #endregion stack-exposure
