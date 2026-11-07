// #region listener-owner — docs: docs/evidence/specs/2026-11-06-studio-spaces-gaps.md#22-fabric-mcp-does-not-check-who-listens-on-the-hubs-port-co-514-p1
/**
 * Who listens on a loopback port: the OS account (uid) owning the listening socket (CO-514, the contract's DEC-0154
 * HA-2, `v0.1.0+2026-11-07.1`). fabric-mcp asks it before a credential leaves for the hub: on a computer with several
 * accounts a process of another account can hold the port while the pid this user's `hub.json` names is alive.
 *
 * macOS reads `lsof -nP -iTCP:<port> -sTCP:LISTEN -Fpu`; Linux reads `/proc/net/tcp` and `/proc/net/tcp6`, whose
 * listening rows carry the uid. A listener of another account is usually not shown to this one at all: an empty answer
 * is `unknown`, and the caller refuses on it as on a foreign owner. Windows is not read yet (`unsupported`).
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export type ListenerOwner = { uid: number } | { unknown: string } | { unsupported: true }

/** `lsof -Fpu` output: `p<pid>` then `u<uid>` for each process; every listener's uid, de-duplicated. */
export function uidsFromLsof(text: string): number[] {
  const uids = new Set<number>()
  for (const line of text.split('\n')) if (/^u\d+$/.test(line.trim())) uids.add(Number(line.trim().slice(1)))
  return [...uids]
}

/** `/proc/net/tcp` or `tcp6` rows: the uid of each socket in LISTEN (`0A`) on `port`, de-duplicated. */
export function uidsFromProcNet(text: string, port: number): number[] {
  const hex = port.toString(16).toUpperCase().padStart(4, '0')
  const uids = new Set<number>()
  for (const line of text.split('\n').slice(1)) {
    const f = line.trim().split(/\s+/)
    // sl local_address rem_address st tx:rx tr:tm retrnsmt uid ...
    if (f.length < 8) continue
    const local = f[1] ?? ''
    if (local.slice(local.lastIndexOf(':') + 1).toUpperCase() !== hex || f[3] !== '0A') continue
    const uid = Number(f[7])
    if (Number.isInteger(uid) && uid >= 0) uids.add(uid)
  }
  return [...uids]
}

/** One owner, or why it cannot be told: none seen, or listeners of several accounts. */
export function ownerOf(uids: number[]): ListenerOwner {
  if (uids.length === 0) return { unknown: 'no listener of this account could be seen on the port' }
  if (uids.length > 1) return { unknown: `listeners of ${uids.length} accounts hold the port` }
  return { uid: uids[0] }
}

export function readListenerOwner(port: number, deps: {
  platform?: NodeJS.Platform
  run?: (cmd: string, args: string[]) => string
  read?: (file: string) => string
} = {}): ListenerOwner {
  const platform = deps.platform ?? process.platform
  if (platform === 'darwin') {
    const run = deps.run ?? ((cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 3_000, stdio: ['ignore', 'pipe', 'ignore'] }))
    try {
      return ownerOf(uidsFromLsof(run('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpu'])))
    } catch (e) {
      // lsof exits 1 when it lists nothing: no listener this account can see, which is unknown, never fine.
      const out = (e as { stdout?: unknown }).stdout
      if (typeof out === 'string' && out.trim()) return ownerOf(uidsFromLsof(out))
      return { unknown: 'the socket table could not be read' }
    }
  }
  if (platform === 'linux') {
    const read = deps.read ?? ((f: string) => readFileSync(f, 'utf8'))
    const uids: number[] = []
    let readAny = false
    for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
      try {
        uids.push(...uidsFromProcNet(read(file), port))
        readAny = true
      } catch {
        // A kernel without IPv6 has no tcp6; the other file still answers, and none answering is said below.
      }
    }
    if (!readAny) return { unknown: 'the socket table could not be read' }
    return ownerOf([...new Set(uids)])
  }
  return { unsupported: true }
}

/**
 * The owner check fabric-mcp runs on every `locate` (every 2 s, and before each credential): one socket-table read per
 * hub, kept while hub.json names the same pid and port (`ttlMs`), since the listener of a live hub process cannot
 * change under it. A new pid or port is read again at once.
 */
export function createOwnerCheck(deps: { read?: (port: number) => ListenerOwner; now?: () => number; ttlMs?: number } = {}): (port: number, pid: number) => ListenerOwner {
  const read = deps.read ?? ((port: number) => readListenerOwner(port))
  const now = deps.now ?? Date.now
  const ttl = deps.ttlMs ?? 60_000
  let kept: { port: number; pid: number; at: number; owner: ListenerOwner } | null = null
  return (port, pid) => {
    if (kept && kept.port === port && kept.pid === pid && now() - kept.at < ttl) return kept.owner
    const owner = read(port)
    kept = { port, pid, at: now(), owner }
    return owner
  }
}
// #endregion listener-owner
