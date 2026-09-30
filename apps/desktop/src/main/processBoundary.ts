// POSIX process-group observations for a Fabric-owned foreground execution.
// This is evidence about an owned group, not a sandbox or proof that no work
// escaped before observation. Provider quiescence is a separate requirement.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const execute = promisify(execFile)
export interface ProcessRow { pid: number; parent: number; group: number; start: string; status: string }
export interface OwnedProcess {
  pid: number
  group: number
  start: string
  known: Record<string, string>
  escaped: boolean
}
export type ProcessObservation = {
  state: 'active' | 'quiescent' | 'unknown'
  rootExited: boolean
  members: number[]
  reasonCode: string
}
export interface ProcessBoundaryDeps {
  snapshot(): Promise<ProcessRow[]>
  signal(group: number, signal: 'SIGTERM' | 'SIGKILL'): void
  ownPid: number
}
export function parseProcessSnapshot(text: string): ProcessRow[] {
  return text.split('\n').filter(line => line.trim()).map(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/.exec(line)
    if (!match) throw Error('process snapshot shape is unavailable')
    return { pid: Number(match[1]), parent: Number(match[2]), group: Number(match[3]), status: match[4], start: match[5] }
  })
}
export function createProcessBoundary(deps: ProcessBoundaryDeps = {
  ownPid: process.pid,
  snapshot: async () => {
    if (!['darwin', 'linux'].includes(process.platform)) throw Error('process group observer unsupported')
    const { stdout } = await execute('ps', ['-axo', 'pid=,ppid=,pgid=,stat=,lstart='],
      { timeout: 2000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C' } })
    return parseProcessSnapshot(stdout)
  },
  signal: (group, signal) => { process.kill(-group, signal) }
}) {
  const living = (row: ProcessRow) => !row.status.startsWith('Z')
  const sample = (owned: OwnedProcess, rows: ProcessRow[], exited: boolean): ProcessObservation => {
    const byPid = new Map(rows.map(row => [row.pid, row]))
    const root = byPid.get(owned.pid)
    const host = byPid.get(deps.ownPid)
    if (!host || owned.group <= 1 || host.group === owned.group || owned.group !== owned.pid)
      return { state: 'unknown', rootExited: false, members: [], reasonCode: 'group_not_owned' }
    if (root && (root.start !== owned.start || root.group !== owned.group))
      return { state: 'unknown', rootExited: false, members: [], reasonCode: 'root_identity_changed' }
    // Learn descendants while their parent identity is still known. A process
    // that has left the owned group is sticky uncertainty, even if later gone.
    const related = new Set(Object.keys(owned.known).map(Number))
    let grew = true
    while (grew) {
      grew = false
      for (const row of rows) {
        const knownStart = owned.known[String(row.parent)]
        const parent = byPid.get(row.parent)
        if (!related.has(row.pid) && related.has(row.parent) && parent?.start === knownStart) {
          related.add(row.pid); owned.known[String(row.pid)] = row.start; grew = true
        }
      }
    }
    const group = rows.filter(row => row.group === owned.group && living(row))
    for (const row of rows) {
      if (owned.known[String(row.pid)] === row.start && living(row) && row.group !== owned.group)
        owned.escaped = true
    }
    // A surviving, already identified member witnesses group continuity after
    // leader exit. Never signal an unrelated group that recycled the number.
    const continuity = Boolean(root && root.start === owned.start) || group.some(row => owned.known[String(row.pid)] === row.start)
    if (group.length && !continuity)
      return { state: 'unknown', rootExited: exited, members: group.map(row => row.pid), reasonCode: 'group_continuity_unknown' }
    if (continuity) for (const row of group) owned.known[String(row.pid)] = row.start
    if (owned.escaped) return { state: 'unknown', rootExited: exited, members: group.map(row => row.pid), reasonCode: 'descendant_left_group' }
    const rootExited = exited && (!root || !living(root))
    return { state: rootExited && group.length === 0 ? 'quiescent' : 'active', rootExited,
      members: group.map(row => row.pid), reasonCode: group.length ? 'group_live' : rootExited ? 'group_empty_after_exit' : 'exit_not_observed' }
  }
  return {
    async capture(pid: number): Promise<OwnedProcess> {
      const rows = await deps.snapshot()
      const root = rows.find(row => row.pid === pid)
      const host = rows.find(row => row.pid === deps.ownPid)
      if (!Number.isInteger(pid) || pid <= 1 || !root || !host || !living(root) || root.group !== pid || root.group === host.group)
        throw Error('a separately owned process group could not be established')
      const owned: OwnedProcess = { pid, group: root.group, start: root.start, known: { [String(pid)]: root.start }, escaped: false }
      sample(owned, rows, false)
      return owned
    },
    async observe(owned: OwnedProcess, rootExitObserved: boolean): Promise<ProcessObservation> {
      try { return sample(owned, await deps.snapshot(), rootExitObserved) }
      catch { return { state: 'unknown', rootExited: rootExitObserved, members: [], reasonCode: 'process_read_unavailable' } }
    },
    async signal(owned: OwnedProcess, signal: 'SIGTERM' | 'SIGKILL', stillAllowed: () => boolean = () => true): Promise<{ sent: boolean; reasonCode: string }> {
      let observed: ProcessObservation
      try { observed = sample(owned, await deps.snapshot(), false) }
      catch { return { sent: false, reasonCode: 'process_read_unavailable' } }
      if (observed.state === 'unknown' && observed.reasonCode !== 'descendant_left_group')
        return { sent: false, reasonCode: observed.reasonCode }
      if (!observed.members.length) return { sent: false, reasonCode: 'group_empty' }
      if (!stillAllowed()) return { sent: false, reasonCode: 'signal_cancelled' }
      try { deps.signal(owned.group, signal); return { sent: true, reasonCode: 'signal_sent' } }
      catch { return { sent: false, reasonCode: 'signal_failed' } }
    }
  }
}
