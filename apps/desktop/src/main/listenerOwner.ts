// #region listener-owner — docs: docs/evidence/specs/2026-11-06-studio-spaces-gaps.md#22-fabric-mcp-does-not-check-who-listens-on-the-hubs-port-co-514-p1
/**
 * Who listens on a loopback port: the OS account (uid) owning the listening socket (CO-514, the contract's DEC-0154
 * HA-2, `v0.1.0+2026-11-07.1`). fabric-mcp asks it before a credential leaves for the hub: on a computer with several
 * accounts a process of another account can hold the port while the pid this user's `hub.json` names is alive.
 *
 * macOS reads `lsof -nP -iTCP:<port> -sTCP:LISTEN -Fpun`; Linux reads `/proc/net/tcp` and `/proc/net/tcp6`, whose
 * listening rows carry the uid. A listener of another account is usually not shown to this one at all: an empty answer
 * is `unknown`, and the caller refuses on it as on a foreign owner. Windows asks PowerShell for the listener's owning
 * process (`Get-NetTCPConnection`) and that process's owner SID against this user's, as the launcher's PC-152 does
 * (passioncode-ai/passioncode `lib/listener.js`); an owner it cannot read is `unknown`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export type ListenerOwner =
  | { uid: number }
  /** Windows: the listener's owner SID compared with this user's. */
  | { sid: string; mine: boolean }
  | { unknown: string }
  | { unsupported: true }

/**
 * `lsof -Fpun` output (`p<pid>`, `u<uid>`, then `n<address>` per socket): the uid of each listener on exactly
 * `127.0.0.1:<port>`, the address fabric-mcp connects to (hub.json's origin), de-duplicated. A wildcard listener
 * (`*:<port>`) is not counted: lsof shows no other account's sockets, so an own wildcard listener could stand beside
 * another account's listener on 127.0.0.1, which is the one the connection reaches (fabric-dashboards' FD-168 and the
 * contract's CT-254, board thread `1fe66e6e`, 2026-11-07).
 */
export function uidsFromLsof(text: string, port: number): number[] {
  const uids = new Set<number>()
  let uid: number | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('p')) uid = null
    else if (/^u\d+$/.test(line)) uid = Number(line.slice(1))
    else if (line === `n127.0.0.1:${port}` && uid !== null) uids.add(uid)
  }
  return [...uids]
}

/** One LISTEN row of `/proc/net/tcp` or `tcp6`: whether it is on 127.0.0.1, on every address, or elsewhere. */
export interface ProcListener { on: 'loopback' | 'any' | 'other'; uid: number }

/** `/proc/net/tcp` or `tcp6` rows: each socket in LISTEN (`0A`) on `port` with its uid and address. */
export function listenersFromProcNet(text: string, port: number): ProcListener[] {
  const hex = port.toString(16).toUpperCase().padStart(4, '0')
  const rows: ProcListener[] = []
  for (const line of text.split('\n').slice(1)) {
    const f = line.trim().split(/\s+/)
    // sl local_address rem_address st tx:rx tr:tm retrnsmt uid ...
    if (f.length < 8) continue
    const local = (f[1] ?? '').toUpperCase()
    const cut = local.lastIndexOf(':')
    if (local.slice(cut + 1) !== hex || f[3] !== '0A') continue
    const uid = Number(f[7])
    if (!Number.isInteger(uid) || uid < 0) continue
    const addr = local.slice(0, cut)
    // 127.0.0.1 is 0100007F in tcp; a v4-mapped ::ffff:127.0.0.1 in tcp6; every address is all zeros in either.
    const on = addr === '0100007F' || addr === '0000000000000000FFFF00000100007F' ? 'loopback' : /^0+$/.test(addr) ? 'any' : 'other'
    rows.push({ on, uid })
  }
  return rows
}

/**
 * The uids a connection to 127.0.0.1:<port> can reach: the listeners on exactly that address when there are any, else
 * the ones on every address (the contract's HA-2 for Linux, CT-254: the listener's row on the connection's address,
 * else the wildcard). Never the row of a connection, whose uid reads 0 before the server accepts it.
 */
export function uidsReaching(rows: readonly ProcListener[]): number[] {
  const exact = rows.filter((r) => r.on === 'loopback')
  return [...new Set((exact.length ? exact : rows.filter((r) => r.on === 'any')).map((r) => r.uid))]
}

/** One table read on its own (a test's convenience): the uids reaching 127.0.0.1:<port> by that table alone. */
export function uidsFromProcNet(text: string, port: number): number[] {
  return uidsReaching(listenersFromProcNet(text, port))
}

// Windows: one PowerShell call prints `me <sid>` and one `<address> <pid> <sid or ?>` line per listener on the port. A
// port nobody holds is an error Get-NetTCPConnection reports, silenced, so the script still exits 0 (the launcher's
// first Windows run found powershell.exe exiting 1 there, PC-152's 33fdaca).
export const PS_SCRIPT = (port: number): string => [
  '"me " + [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
  'if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { exit 3 }',
  `foreach ($c in @(Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue)) {`,
  '  $sid = "?"',
  '  $p = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $c.OwningProcess) -ErrorAction SilentlyContinue',
  '  if ($p) { $o = Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid -ErrorAction SilentlyContinue; if ($o -and $o.ReturnValue -eq 0 -and $o.Sid) { $sid = $o.Sid } }',
  '  $c.LocalAddress + " " + $c.OwningProcess + " " + $sid',
  '}',
  'exit 0'
].join('\n')

const TAKES_LOOPBACK = /^(?:127(?:\.\d{1,3}){3}|0\.0\.0\.0|::1|::|::ffff:127(?:\.\d{1,3}){3})$/i

/** The PowerShell answer: this user's SID and each listener taking loopback, or null when it is not one. */
export function ownerFromPowerShell(text: string): ListenerOwner {
  let me: string | null = null
  const sids: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/)
    if (f[0] === 'me' && f[1]) me = f[1]
    else if (f.length === 3 && /^\d+$/.test(f[1]) && TAKES_LOOPBACK.test(f[0])) sids.push(f[2])
  }
  if (!me) return { unknown: 'PowerShell did not name this user' }
  if (sids.length === 0) return { unknown: 'no listener could be seen on the port' }
  if (sids.includes('?')) return { unknown: 'the owner of a listening process could not be read' }
  const other = sids.find((sid) => sid !== me)
  return other ? { sid: other, mine: false } : { sid: me, mine: true }
}

/** One owner, or why it cannot be told: none seen, or listeners of several accounts. */
export function ownerOf(uids: number[]): ListenerOwner {
  if (uids.length === 0) return { unknown: 'no listener on 127.0.0.1 could be seen on the port' }
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
      return ownerOf(uidsFromLsof(run('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpun']), port))
    } catch (e) {
      // lsof exits 1 when it lists nothing: no listener this account can see, which is unknown, never fine.
      const out = (e as { stdout?: unknown }).stdout
      if (typeof out === 'string' && out.trim()) return ownerOf(uidsFromLsof(out, port))
      return { unknown: 'the socket table could not be read' }
    }
  }
  if (platform === 'linux') {
    const read = deps.read ?? ((f: string) => readFileSync(f, 'utf8'))
    const rows: ProcListener[] = []
    let readAny = false
    for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
      try {
        rows.push(...listenersFromProcNet(read(file), port))
        readAny = true
      } catch {
        // A kernel without IPv6 has no tcp6; the other file still answers, and none answering is said below.
      }
    }
    if (!readAny) return { unknown: 'the socket table could not be read' }
    return ownerOf(uidsReaching(rows))
  }
  if (platform === 'win32') {
    const run = deps.run ?? ((cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }))
    try {
      return ownerFromPowerShell(run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT(port)]))
    } catch {
      // No Get-NetTCPConnection (exit 3), a timeout, or PowerShell missing: the owner cannot be told.
      return { unknown: 'PowerShell did not list the sockets' }
    }
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
