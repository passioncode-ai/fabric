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
import { execFile, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

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

// CO-560: Windows without PowerShell first. On the windows-11-arm runner `Get-NetTCPConnection` and its CIM owner query
// ran past their 30 s; `netstat -ano` lists every socket with its process id at once, `tasklist /v` names a process's
// account and `whoami` this one. netstat's state column is translated on a non-English Windows, so a listener is told by
// its foreign address (`0.0.0.0:0`, `[::]:0`) and a connection by its two ports, never by the state's word.
const WIN_ROW = /^\s*TCP\s+(\S+):(\d+)\s+(\S+):(\d+)\s+(?:\S+\s+)?(\d+)\s*$/i
const unbracket = (a: string): string => a.replace(/^\[|\]$/g, '')

/** The process ids `netstat -ano` shows listening on `port` where loopback reaches them. */
export function listenerPidsFromWinNetstat(text: string, port: number): number[] {
  const pids = new Set<number>()
  for (const line of text.split(/\r?\n/)) {
    const m = WIN_ROW.exec(line)
    if (!m || Number(m[2]) !== port || Number(m[4]) !== 0) continue
    if (TAKES_LOOPBACK.test(unbracket(m[1]))) pids.add(Number(m[5]))
  }
  return [...pids]
}

/** The process ids holding the hub's end of one connection: local port `hubPort`, foreign port `clientPort`. */
export function serverEndPidsFromWinNetstat(text: string, hubPort: number, clientPort: number): number[] {
  const pids = new Set<number>()
  for (const line of text.split(/\r?\n/)) {
    const m = WIN_ROW.exec(line)
    if (m && Number(m[2]) === hubPort && Number(m[4]) === clientPort && TAKES_LOOPBACK.test(unbracket(m[1]))) pids.add(Number(m[5]))
  }
  return [...pids]
}

/** The account `tasklist /v /fo csv /nh` names for a process (its seventh column), or null when it cannot say. */
export function accountFromTasklist(text: string): string | null {
  const line = text.split(/\r?\n/).find((l) => l.trim().startsWith('"'))
  if (!line) return null
  const cols = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((c) => c[1].replace(/""/g, '"'))
  const account = cols[6]?.trim()
  return account && account.toUpperCase() !== 'N/A' ? account : null
}

/** One owner from this account's name and each listening process's account (null: unreadable). */
export function ownerFromWinAccounts(me: string, accounts: (string | null)[]): ListenerOwner {
  if (!me) return { unknown: 'whoami did not name this user' }
  if (accounts.length === 0) return { unknown: 'no listener could be seen on the port' }
  if (accounts.some((a) => a === null)) return { unknown: 'the owner of a listening process could not be read' }
  const other = accounts.find((a) => a!.toLowerCase() !== me.toLowerCase())
  return other ? { sid: other, mine: false } : { sid: me, mine: true }
}

/** The Windows read through netstat, tasklist and whoami; throws when one of them cannot be run. */
function winOwner(pidsOf: (netstat: string) => number[], run: (cmd: string, args: string[]) => string): ListenerOwner {
  const me = run('whoami', []).trim()
  const pids = pidsOf(run('netstat', ['-ano']))
  // Nothing netstat shows on the port: a table of a shape this read does not know is asked of PowerShell, never
  // taken as no listener.
  if (pids.length === 0) throw new Error('netstat showed no listener on the port')
  return ownerFromWinAccounts(me, pids.map((pid) => accountFromTasklist(run('tasklist', ['/v', '/fo', 'csv', '/nh', '/fi', `PID eq ${pid}`]))))
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
    // CO-561: 10 s, not 3, and a second try: on a machine at load 34 one lsof that could not be spawned or answered late
    // left a session without the board while the same lsof answered in 0.06 s from its shell (2026-11-11).
    const run = deps.run ?? ((cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 10_000, stdio: ['ignore', 'pipe', 'ignore'] }))
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return ownerOf(uidsFromLsof(run('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpun']), port))
      } catch (e) {
        // lsof exits 1 when it lists nothing: no listener this account can see, which is unknown, never fine.
        const out = (e as { stdout?: unknown }).stdout
        if (typeof out === 'string' && out.trim()) return ownerOf(uidsFromLsof(out, port))
        // Exit 1 with nothing printed is lsof's answer, not a failure to read: not asked again.
        if ((e as { status?: unknown }).status === 1) break
      }
    }
    return { unknown: 'the socket table could not be read' }
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
      return winOwner((t) => listenerPidsFromWinNetstat(t, port), run)
    } catch {
      // netstat, tasklist or whoami could not be run: PowerShell below, as before CO-560.
    }
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
    // CO-561: an owner that could not be told is asked again on the next locate, never kept for the minute: kept, one
    // failed read held a session off the board for as long.
    kept = 'unknown' in owner ? null : { port, pid, at: now(), owner }
    return owner
  }
}
// #endregion listener-owner

// #region connection-owner — docs: docs/evidence/specs/2026-11-06-studio-spaces-gaps.md#22-fabric-mcp-does-not-check-who-listens-on-the-hubs-port-co-514-p1
/*
 * The owner of the hub's end of THIS client's connection (CO-528, the contract's CT-254, `v0.1.0+2026-11-07.3`): read on
 * the open socket just before a request with a token is written, with no cache, so a hub that restarted under another
 * account between the listener check and the request cannot take the token. macOS: the `127.0.0.1:<hub>->127.0.0.1:<client>`
 * socket in `lsof`, with its uid; a table that shows no such socket (another account's, not yet accepted, or a table
 * macOS 27.2 restricts) is unknown (`table-restricted`), never this account's. Linux: that row of `/proc/net/tcp` with
 * its uid when its inode is not 0, else the listener rule on the connection's address before the wildcard. Windows: the
 * connection in `Get-NetTCPConnection` by its two ports and its process's owner SID.
 */

/** `lsof -Fpun` for ESTABLISHED sockets on the hub's port: the uids holding exactly `127.0.0.1:<hub>->127.0.0.1:<client>`. */
export function serverEndUidsFromLsof(text: string, hubPort: number, clientPort: number): number[] {
  const uids = new Set<number>()
  let uid: number | null = null
  const want = `n127.0.0.1:${hubPort}->127.0.0.1:${clientPort}`
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('p')) uid = null
    else if (/^u\d+$/.test(line)) uid = Number(line.slice(1))
    else if (line === want && uid !== null) uids.add(uid)
  }
  return [...uids]
}

/**
 * `netstat -anv -p tcp` on macOS: the pids of the process column (`name:pid`) on the ESTABLISHED row whose local end is
 * `127.0.0.1.<hub>` and remote `127.0.0.1.<client>` (DEC-0155 RT-1, CO-532). A header-only or empty table gives none.
 * The column's name is the executable's, chosen by whoever holds the port, and may hold spaces and colons (the 0.3.17
 * release review, iteration 2, ER-1: a name `x:<pid> y` read as that pid). So the column is cut by position: ten fields
 * before it, eight after it (state, options, gencnt, flags, flags1, usecnt, rtncnt, fltrs), and its pid is the LAST
 * `:digits` of the whole column; a row of any other shape gives no pid, and so `table-restricted`.
 */
export function serverEndPidsFromNetstat(text: string, hubPort: number, clientPort: number): number[] {
  const pids = new Set<number>()
  for (const line of text.split('\n')) {
    const f = line.trim().split(/\s+/)
    if (!/^tcp[46]?$/.test(f[0] ?? '') || f[3] !== `127.0.0.1.${hubPort}` || f[4] !== `127.0.0.1.${clientPort}` || f[5] !== 'ESTABLISHED') continue
    if (f.length < 19 || !f.slice(6, 10).every((x) => /^\d+$/.test(x)) || !f.slice(-8).every((x) => /^[0-9a-f]+$/.test(x))) continue
    const m = /:(\d+)$/.exec(f.slice(10, -8).join(' '))
    if (m) pids.add(Number(m[1]))
  }
  return [...pids]
}

/** One ESTABLISHED (`01`) row of `/proc/net/tcp` or `tcp6` whose local end is 127.0.0.1:<hub> and remote 127.0.0.1:<client>. */
export interface ProcConnection { uid: number; inode: string }

export function serverEndFromProcNet(text: string, hubPort: number, clientPort: number): ProcConnection[] {
  const hex = (n: number): string => n.toString(16).toUpperCase().padStart(4, '0')
  const loop = (a: string): boolean => a === '0100007F' || a === '0000000000000000FFFF00000100007F'
  const rows: ProcConnection[] = []
  for (const line of text.split('\n').slice(1)) {
    const f = line.trim().split(/\s+/)
    // sl local_address rem_address st tx:rx tr:tm retrnsmt uid timeout inode ...
    if (f.length < 10 || f[3] !== '01') continue
    const [la, lp] = splitAddr(f[1] ?? ''), [ra, rp] = splitAddr(f[2] ?? '')
    if (!loop(la) || !loop(ra) || lp !== hex(hubPort) || rp !== hex(clientPort)) continue
    const uid = Number(f[7])
    if (!Number.isInteger(uid) || uid < 0) continue
    rows.push({ uid, inode: f[9] ?? '0' })
  }
  return rows
}
const splitAddr = (a: string): [string, string] => { const u = a.toUpperCase(); const cut = u.lastIndexOf(':'); return [u.slice(0, cut), u.slice(cut + 1)] }

/** Linux's verdict from both tables: the accepted socket's uid when its inode is not 0, else the listener rule (CT-254). */
export function connectionOwnerFromProcNet(tables: readonly string[], hubPort: number, clientPort: number): ListenerOwner {
  const accepted = tables.flatMap((t) => serverEndFromProcNet(t, hubPort, clientPort)).filter((r) => r.inode !== '0')
  if (accepted.length) return ownerOf([...new Set(accepted.map((r) => r.uid))])
  const listeners = tables.flatMap((t) => listenersFromProcNet(t, hubPort))
  if (listeners.length === 0) return { unknown: 'neither the accepted connection nor a listener could be seen on the port' }
  return ownerOf(uidsReaching(listeners))
}

// Windows: `me <sid>`, then `<local address> <pid> <sid or ?>` for the hub's end of this connection (by its two ports).
export const PS_CONNECTION_SCRIPT = (hubPort: number, clientPort: number): string => [
  '"me " + [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
  'if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { exit 3 }',
  `foreach ($c in @(Get-NetTCPConnection -State Established -LocalPort ${hubPort} -RemotePort ${clientPort} -ErrorAction SilentlyContinue)) {`,
  '  $sid = "?"',
  '  $p = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $c.OwningProcess) -ErrorAction SilentlyContinue',
  '  if ($p) { $o = Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid -ErrorAction SilentlyContinue; if ($o -and $o.ReturnValue -eq 0 -and $o.Sid) { $sid = $o.Sid } }',
  '  $c.LocalAddress + " " + $c.OwningProcess + " " + $sid',
  '}',
  'exit 0'
].join('\n')

const execFileP = promisify(execFile)

/** One read of the hub's end of this connection, on this platform. */
export async function readConnectionOwner(hubPort: number, clientPort: number, deps: {
  platform?: NodeJS.Platform
  run?: (cmd: string, args: string[]) => Promise<string>
  read?: (file: string) => Promise<string>
} = {}): Promise<ListenerOwner> {
  const platform = deps.platform ?? process.platform
  // CO-561: 10 s on macOS and Linux, as the listener read: 3 s left a loaded Mac with no answer and the session dropped.
  const run = deps.run ?? (async (cmd: string, args: string[]) => (await execFileP(cmd, args, { encoding: 'utf8', timeout: platform === 'win32' ? 30_000 : 10_000, windowsHide: true })).stdout)
  if (platform === 'darwin') {
    let out = ''
    try {
      out = await run('/usr/sbin/lsof', ['-nP', `-iTCP:${hubPort}`, '-sTCP:ESTABLISHED', '-Fpun'])
    } catch (e) {
      // lsof exits 1 when it lists nothing; what it printed still counts, and nothing printed is said below.
      const printed = (e as { stdout?: unknown }).stdout
      out = typeof printed === 'string' ? printed : ''
    }
    const uids = serverEndUidsFromLsof(out, hubPort, clientPort)
    if (uids.length) return ownerOf(uids)
    // DEC-0155 RT-1 (CO-532): nothing among this account's descriptors; the table is read before the end is called
    // unseen. A row held by another process names its owner; an unreadable, empty, header-only table, or one without
    // this connection's row, is table-restricted. Either way no token leaves.
    let table = ''
    try {
      table = await run('/usr/sbin/netstat', ['-anv', '-p', 'tcp'])
    } catch {
      // netstat failing is a restricted table (RT-1), never an answer.
      return { unknown: 'table-restricted: the socket table could not be read' }
    }
    const pids = serverEndPidsFromNetstat(table, hubPort, clientPort)
    if (pids.length === 0) return { unknown: 'table-restricted: the hub\'s end of this connection could not be seen' }
    const owners: number[] = []
    for (const pid of pids) {
      try {
        const uid = Number((await run('/bin/ps', ['-o', 'uid=', '-p', String(pid)])).trim())
        if (Number.isInteger(uid) && uid >= 0) owners.push(uid)
      } catch {
        // A process gone or unreadable: its owner cannot be told.
      }
    }
    if (owners.length === 0) return { unknown: 'table-restricted: the owner of the hub\'s end could not be read' }
    return ownerOf([...new Set(owners)])
  }
  if (platform === 'linux') {
    const read = deps.read ?? ((f: string) => readFile(f, 'utf8'))
    const tables: string[] = []
    for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
      try {
        tables.push(await read(file))
      } catch {
        // A kernel without IPv6 has no tcp6; none answering is said below.
      }
    }
    if (tables.length === 0) return { unknown: 'the socket table could not be read' }
    return connectionOwnerFromProcNet(tables, hubPort, clientPort)
  }
  if (platform === 'win32') {
    try {
      // CO-560: netstat, tasklist and whoami first (see `winOwner`); PowerShell when one of them cannot be run.
      const me = (await run('whoami', [])).trim()
      const pids = serverEndPidsFromWinNetstat(await run('netstat', ['-ano']), hubPort, clientPort)
      if (pids.length === 0) throw new Error('netstat showed no such connection')
      const accounts: (string | null)[] = []
      for (const pid of pids) accounts.push(accountFromTasklist(await run('tasklist', ['/v', '/fo', 'csv', '/nh', '/fi', `PID eq ${pid}`])))
      return ownerFromWinAccounts(me, accounts)
    } catch {
      // Asked of PowerShell below.
    }
    try {
      return ownerFromPowerShell(await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_CONNECTION_SCRIPT(hubPort, clientPort)]))
    } catch {
      // No Get-NetTCPConnection (exit 3), a timeout, or PowerShell missing: the owner cannot be told.
      return { unknown: 'PowerShell did not list the connection' }
    }
  }
  return { unsupported: true }
}

/** Why a credential may not go to this owner, or null when it is this account's (the same rule as `hub.ts#locateHub`). */
export function ownerRefusal(owner: ListenerOwner, me: number): string | null {
  if ('unsupported' in owner) return null
  if ('unknown' in owner) return `foreign-user: the owner of the hub's end could not be told (${owner.unknown})`
  if ('uid' in owner && owner.uid !== me) return 'foreign-user: the hub\'s end of this connection is held by another account of this computer'
  if ('mine' in owner && !owner.mine) return 'foreign-user: the hub\'s end of this connection is held by another account of this computer'
  return null
}

/**
 * The check before a token is written: the owner read on the open connection, again up to `settleMs` (3 s) while it cannot be
 * told yet (a server that has not accepted the connection shows no end of it), then the verdict. No cache.
 */
export async function verifyConnection(hubPort: number, clientPort: number, deps: {
  read?: (hubPort: number, clientPort: number) => Promise<ListenerOwner>
  me?: () => number
  settleMs?: number
  stepMs?: number
} = {}): Promise<string | null> {
  const read = deps.read ?? ((h: number, c: number) => readConnectionOwner(h, c))
  const me = (deps.me ?? (() => process.getuid?.() ?? -1))()
  // The 0.3.17 review, ER-4: 3 s, so a hub whose event loop stalls under load is not refused as unseen.
  let owner = await read(hubPort, clientPort)
  // CO-561: the settle window counts from the end of the first read, so a slow read still leaves a second one.
  const until = Date.now() + (deps.settleMs ?? 3_000)
  while ('unknown' in owner && Date.now() < until) {
    await new Promise((r) => setTimeout(r, deps.stepMs ?? 100))
    owner = await read(hubPort, clientPort)
  }
  return ownerRefusal(owner, me)
}
// #endregion connection-owner
