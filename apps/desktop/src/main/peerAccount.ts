// #region peer-account — docs: docs/evidence/specs/2026-11-06-studio-spaces-gaps.md#22-fabric-mcp-does-not-check-who-listens-on-the-hubs-port-co-514-p1
/**
 * Whose process is on the other end of a loopback connection to the hub (CO-514, the contract's DEC-0154 HA-2 point 2
 * (b) and HA-3, `v0.1.0+2026-11-07.1`): on a computer with several human accounts the hub answers only its own
 * account's processes, refusing another's (`peer-foreign-account`) or one it cannot tell (`peer-unverified`) before
 * reading the request. On a computer with one human account nothing is read and every peer is this account's.
 *
 * The client's socket is the row whose LOCAL port is the connection's remote port: macOS `lsof -Fpun`, Linux
 * `/proc/net/tcp` and `tcp6` (established, `01`); Windows asks PowerShell for that connection's owning process
 * (`Get-NetTCPConnection`) and its owner SID against this user's, as `listenerOwner.ts` does for the listener. A verdict
 * is taken once per connection and kept on its socket, so a kept-alive client costs one read.
 */
import { execFile, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import type { Socket } from 'node:net'

export type PeerVerdict = 'own' | 'foreign' | 'unverified' | 'not-checked'

/** `dscl . -list /Users UniqueID`: accounts of people (uid 500 and up, not `_`-prefixed service accounts). */
export function humanAccountsFromDscl(text: string): number {
  let n = 0
  for (const line of text.split('\n')) {
    const m = /^(\S+)\s+(-?\d+)\s*$/.exec(line.trim())
    if (m && !m[1].startsWith('_') && Number(m[2]) >= 500) n++
  }
  return n
}

/** `/etc/passwd`: accounts of people (uid 1000 up to, not including, 65534). */
export function humanAccountsFromPasswd(text: string): number {
  let n = 0
  for (const line of text.split('\n')) {
    const uid = Number(line.split(':')[2])
    if (Number.isInteger(uid) && uid >= 1000 && uid < 65534) n++
  }
  return n
}

/** `lsof -Fpun`: the uid of the process whose socket's local side is `port` on loopback, de-duplicated. */
export function peerUidsFromLsof(text: string, port: number): number[] {
  const uids = new Set<number>()
  let uid: number | null = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('p')) uid = null
    else if (/^u\d+$/.test(line)) uid = Number(line.slice(1))
    else if (line.startsWith('n') && uid !== null) {
      const local = line.slice(1).split('->')[0] ?? ''
      if (local === `127.0.0.1:${port}` || local === `[::1]:${port}`) uids.add(uid)
    }
  }
  return [...uids]
}

/** `/proc/net/tcp` or `tcp6`: the uid of each ESTABLISHED socket whose local port is `port`. */
export function peerUidsFromProcNet(text: string, port: number): number[] {
  const hex = port.toString(16).toUpperCase().padStart(4, '0')
  const uids = new Set<number>()
  for (const line of text.split('\n').slice(1)) {
    const f = line.trim().split(/\s+/)
    if (f.length < 8) continue
    const local = f[1] ?? ''
    if (local.slice(local.lastIndexOf(':') + 1).toUpperCase() !== hex || f[3] !== '01') continue
    const uid = Number(f[7])
    if (Number.isInteger(uid) && uid >= 0) uids.add(uid)
  }
  return [...uids]
}

// Windows: `me <sid>`, then one `<address> <pid> <sid or ?>` line per established connection whose local port is the
// client's; the number of enabled local accounts is asked by its own call.
export const PS_PEER_SCRIPT = (port: number): string => [
  '"me " + [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
  'if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { exit 3 }',
  `foreach ($c in @(Get-NetTCPConnection -State Established -LocalPort ${port} -ErrorAction SilentlyContinue)) {`,
  '  $sid = "?"',
  '  $p = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $c.OwningProcess) -ErrorAction SilentlyContinue',
  '  if ($p) { $o = Invoke-CimMethod -InputObject $p -MethodName GetOwnerSid -ErrorAction SilentlyContinue; if ($o -and $o.ReturnValue -eq 0 -and $o.Sid) { $sid = $o.Sid } }',
  '  $c.LocalAddress + " " + $c.OwningProcess + " " + $sid',
  '}',
  'exit 0'
].join('\n')

export const PS_ACCOUNTS_SCRIPT = '@(Get-CimInstance Win32_UserAccount -Filter "LocalAccount=True AND Disabled=False" -ErrorAction Stop).Count'

const LOOPBACK = /^(?:127(?:\.\d{1,3}){3}|::1|::ffff:127(?:\.\d{1,3}){3})$/i

/** The PowerShell answer for one client port: own when its one owner SID is this user's. */
export function peerFromPowerShell(text: string): PeerVerdict {
  let me: string | null = null
  const sids = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const f = line.trim().split(/\s+/)
    if (f[0] === 'me' && f[1]) me = f[1]
    else if (f.length === 3 && /^\d+$/.test(f[1]) && LOOPBACK.test(f[0])) sids.add(f[2])
  }
  if (!me || sids.size !== 1 || sids.has('?')) return 'unverified'
  return sids.has(me) ? 'own' : 'foreign'
}

export function verdictOf(uids: number[], me: number): PeerVerdict {
  if (uids.length !== 1) return 'unverified'
  return uids[0] === me ? 'own' : 'foreign'
}

const DEADLINE_MS = 3_000

export function createPeerCheck(deps: {
  platform?: NodeJS.Platform
  uid?: () => number
  /** Read the accounts and socket tables; the defaults run the platform's own tools. */
  accounts?: () => number
  peers?: (port: number) => Promise<number[]>
  now?: () => number
} = {}): (socket: Pick<Socket, 'remotePort'>) => Promise<PeerVerdict> {
  const platform = deps.platform ?? process.platform
  const me = (deps.uid ?? (() => process.getuid?.() ?? -1))()
  const now = deps.now ?? Date.now
  const accounts = deps.accounts ?? (() => {
    if (platform === 'darwin') return humanAccountsFromDscl(execFileSync('/usr/bin/dscl', ['.', '-list', '/Users', 'UniqueID'], { encoding: 'utf8', timeout: DEADLINE_MS, stdio: ['ignore', 'pipe', 'ignore'] }))
    if (platform === 'linux') return humanAccountsFromPasswd(readFileSync('/etc/passwd', 'utf8'))
    if (platform === 'win32') return Number(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_ACCOUNTS_SCRIPT], { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim())
    return 1
  })
  const windowsPeer = (port: number): Promise<PeerVerdict> => new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_PEER_SCRIPT(port)], { encoding: 'utf8', timeout: 30_000, windowsHide: true }, (e, out) =>
      // No Get-NetTCPConnection (exit 3), a timeout or no PowerShell: the caller's account cannot be told.
      resolve(e ? 'unverified' : peerFromPowerShell(String(out ?? ''))))
  })
  const peers = deps.peers ?? ((port: number): Promise<number[]> => {
    if (platform === 'linux') {
      const uids: number[] = []
      for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
        try {
          uids.push(...peerUidsFromProcNet(readFileSync(file, 'utf8'), port))
        } catch {
          // A kernel without IPv6 has no tcp6: the other table still answers; none answering is unverified below.
        }
      }
      return Promise.resolve([...new Set(uids)])
    }
    return new Promise((resolve) => {
      execFile('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:ESTABLISHED', '-Fpun'], { encoding: 'utf8', timeout: DEADLINE_MS }, (_e, out) =>
        // lsof exits 1 when it lists nothing: no socket of a visible account, which is unverified, never own.
        resolve(peerUidsFromLsof(String(out ?? ''), port)))
    })
  })
  // How many people have accounts here, read again every ten minutes: one account means no check at all.
  let counted: { at: number; several: boolean } | null = null
  const several = (): boolean => {
    if (!counted || now() - counted.at > 600_000) {
      let n = 1
      try {
        n = accounts()
        // A count that is not a number (an empty PowerShell answer) cannot prove one person: check every peer.
        if (!Number.isInteger(n)) n = 2
      } catch {
        // The account list could not be read: treat the computer as shared, so every peer is checked.
        n = 2
      }
      counted = { at: now(), several: n > 1 }
    }
    return counted.several
  }
  const kept = new WeakMap<object, Promise<PeerVerdict>>()
  return (socket) => {
    if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') return Promise.resolve('not-checked')
    if (!several()) return Promise.resolve('own')
    const known = kept.get(socket)
    if (known) return known
    const port = socket.remotePort
    const verdict = typeof port !== 'number'
      ? Promise.resolve('unverified' as const)
      : platform === 'win32' && !deps.peers
        ? windowsPeer(port)
        : peers(port).then((uids) => verdictOf(uids, me), () => 'unverified' as const)
    kept.set(socket, verdict)
    return verdict
  }
}
// #endregion peer-account
