// #region machine-sessions — docs: docs/ux/scenarios.md#scn-166-see-every-agent-and-open-its-console-in-one-press
/**
 * The Claude Code sessions running on this computer outside Fabric (a terminal, Switchboard, a `claude -p` run), as
 * Агенты shows them (board request eef5abeb, point 3): read from Claude Code's own files, so the list works whether
 * Switchboard answers or not (point 4). The operator, 2026-11-20: «в дашборде вот вижу сессии а в фабрике не вижу».
 * Claude Code's files name only the homes Fabric knows (`~/.claude` and Switchboard's runtimes); a session started
 * with another `CLAUDE_CONFIG_DIR` is in none of them. So Switchboard's `sessions --rows` (every session of this
 * computer, the list Fabric Dashboards shows) is joined in: a running, waiting or needs-you row whose session the
 * files do not name is listed too, read-only here (its process is not known, so it is neither closed nor taken over
 * from Fabric). Each can be read (its last turns, from its transcript), closed (SIGTERM, only
 * while its process still names that session) or continued in a Fabric console: the outside process is asked to stop,
 * and once it has ended a console starts in its folder with `claude --resume <id>`, so the work goes on with its
 * context and Fabric holds it. Every act is written in the operations log.
 */
import { open } from 'node:fs/promises'
import type { DiskSession } from './diskSessions.ts'

/** One `switchboard --json sessions --rows` row, as `ceoTools.ts#parseMachineRows` reads it. */
export interface SwitchboardRow {
  session_id: string | null
  /** The process Switchboard sees running it; null for a session whose process is gone. */
  pid?: number | null
  agent: string
  folder: string
  group: string
  why: string | null
}

/** Where a session was read: Claude Code's own files (its process is known), or only Switchboard's rows. */
export type MachineSource = 'claude' | 'switchboard'
/** Working (in a turn), waiting (between turns, or on a wait of its own) or needing the person. */
export type MachineState = 'working' | 'waiting' | 'needs_you'

export interface MachineSession {
  /** The process; 0 for a session only Switchboard names. */
  pid: number
  /** A process runs it now: a Claude Code file of a live process, or a Switchboard row with a pid. Switchboard's
   *  needs_you and waiting also hold sessions whose process is gone (its launch ended, or it stopped), so the
   *  count of these is the count of running agents (Switchboard, 2026-11-20, board 7c726479; SB-582). */
  live: boolean
  source: MachineSource
  state: MachineState | null
  agent: string | null
  sessionId: string
  cwd: string
  name: string | null
  status: string | null
  kind: string | null
  entrypoint: string | null
  startedAt: string | null
  updatedAt: string | null
}

export type MachineAct = { ok: true; sessionId?: string } | { ok: false; why: string; resume?: { sessionId: string; cwd: string } }

export interface MachineSessionsDeps {
  /** The live Claude Code processes (`diskSessions.ts#liveClaudeSessions`). */
  live(): Promise<DiskSession[]>
  /** Runner session ids of the consoles Fabric holds, which are not «outside». */
  fabricRunnerIds(): Promise<ReadonlySet<string>>
  alive(pid: number): boolean
  signal(pid: number): void
  /** The session file again, right before a signal: the pid must still name this session (a pid can be reused). */
  stillNames(s: DiskSession): Promise<boolean>
  transcript(sessionId: string): string | null
  turns(jsonl: string, max: number): Array<{ role: string; text: string }>
  /** The Fabric project of the session's folder, or null when the folder is in none: asked BEFORE any signal. */
  projectFor?(s: DiskSession): Promise<string | null>
  /** A Fabric console in the folder that continues the session (`claude --resume`), with the home it ran in. */
  continueInFabric(s: DiskSession, projectId?: string, from?: string): Promise<{ sessionId: string }>
  /** The pids of the consoles Fabric runs now. A Claude Code process that is one of them, or runs under one, is
   *  Fabric's, even before the launch journal names its runner session id (0.3.26 review, iteration 1, UX-2, ER-3). */
  fabricPids?(): Promise<ReadonlySet<number>>
  /** Each process's parent, read once per listing; null when it could not be read. */
  parents?(): Promise<ReadonlyMap<number, number> | null>
  /** A session no process runs any more, continued in a Fabric console from its transcript (DEC-0189 SL-5). */
  resumeEnded?(sessionId: string, from?: string): Promise<MachineAct>
  /** Switchboard's rows of this computer; null when Switchboard is not installed or did not answer. */
  switchboardRows?(): Promise<SwitchboardRow[] | null>
  record(op: string, detail: Record<string, unknown>): void
  sleep?(ms: number): Promise<void>
}

/** How much of a transcript's end is read for its last turns (ER-8: transcripts reach hundreds of MB). */
export const READ_TAIL_BYTES = 2_000_000

/** The first `max` bytes of a file as text. */
export async function readHead(file: string, max: number): Promise<string> {
  const fh = await open(file, 'r')
  try {
    const buf = Buffer.alloc(max)
    const { bytesRead } = await fh.read(buf, 0, max, 0)
    return buf.subarray(0, bytesRead).toString('utf8')
  } finally { await fh.close() }
}

/** The folder a Claude Code transcript ran in: the first line that names an absolute `cwd`. */
export function transcriptCwd(head: string): string | null {
  for (const line of head.split('\n')) {
    if (!line.includes('"cwd"')) continue
    try {
      const cwd = (JSON.parse(line) as { cwd?: unknown }).cwd
      if (typeof cwd === 'string' && cwd.startsWith('/')) return cwd
    } catch { /* a line cut at the read's end: the next one may name it */ }
  }
  return null
}

/** The last `max` bytes of a file as text, from its first whole line: never the whole file. */
export async function readTail(file: string, max: number): Promise<string> {
  const fh = await open(file, 'r')
  try {
    const { size } = await fh.stat()
    const start = Math.max(0, size - max)
    const buf = Buffer.alloc(size - start)
    // ER-17: a file that shrank since the stat yields fewer bytes; the rest of the buffer is not text.
    const { bytesRead } = await fh.read(buf, 0, buf.length, start)
    const text = buf.subarray(0, bytesRead).toString('utf8')
    return start === 0 ? text : text.slice(text.indexOf('\n') + 1)
  } finally { await fh.close() }
}

/** How long a continue waits for the outside process to end after its SIGTERM. */
export const TAKE_OVER_WAIT_MS = 10_000

/** Claude Code's own status word as a state: `busy` is a turn, `idle` and `shell` are between turns. */
export function stateOfStatus(status: string | null): MachineState | null {
  return status === 'busy' ? 'working' : status === 'idle' || status === 'shell' || status === 'waiting' ? 'waiting' : null
}

const ROW_STATE: Record<string, MachineState> = { running: 'working', waiting: 'waiting', needs_you: 'needs_you' }
const ORDER: Record<string, number> = { needs_you: 0, working: 1, waiting: 2 }

export function createMachineSessions(deps: MachineSessionsDeps) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  /** Fabric's own: its runner session id is in the journal, or its process is a Fabric console or runs under one. */
  const ownedBy = async (): Promise<((s: DiskSession) => boolean) & { parentsUnread: boolean }> => {
    const [ours, pids, parents] = await Promise.all([deps.fabricRunnerIds(), deps.fabricPids?.() ?? Promise.resolve(new Set<number>()),
      deps.parents?.().catch(() => null) ?? Promise.resolve(null)])
    const underFabric = (pid: number): boolean => {
      for (let p: number | undefined = pid, hops = 0; p && p > 1 && hops < 32; p = parents?.get(p), hops++) if (pids.has(p)) return true
      return false
    }
    // ER-14 (0.3.26 review, iteration 2): with no process table, a process nested under a console cannot be told apart.
    return Object.assign((s: DiskSession) => ours.has(s.sessionId) || underFabric(s.pid), { parentsUnread: !!deps.parents && parents === null })
  }
  const continuing = new Set<string>()
  /** The session to act on, or why not: an act never runs on a process whose owner could not be checked (ER-14). */
  const find = async (sessionId: string): Promise<DiskSession | null | 'unknown-owner'> => {
    const [live, owned] = await Promise.all([deps.live(), ownedBy()])
    const s = live.find((x) => x.sessionId === sessionId)
    if (!s || owned(s)) return null
    return owned.parentsUnread && s.pid > 1 ? 'unknown-owner' : s
  }

  return {
    async list(): Promise<MachineSession[]> {
      const [live, owned, ours, rows] = await Promise.all([deps.live(), ownedBy(), deps.fabricRunnerIds(), deps.switchboardRows?.().catch(() => null) ?? Promise.resolve(null)])
      const disk = live.filter((s) => !owned(s))
      // A Fabric console's runner session, by its file, is not listed from Switchboard's rows either.
      const fabricIds = new Set([...ours, ...live.filter(owned).map((s) => s.sessionId)])
      const byId = new Map((rows ?? []).filter((r) => r.session_id).map((r) => [r.session_id!, r]))
      const out: MachineSession[] = disk.map(({ config: _config, ...s }) => {
        const row = byId.get(s.sessionId)
        // Switchboard's group wins when it names the session, so this list counts as Switchboard and Fabric Dashboards do
        // (the operator, 2026-11-20: one machine, one count); the file's status only when Switchboard does not know it.
        const state = (row ? ROW_STATE[row.group] : undefined) ?? stateOfStatus(s.status)
        return { ...s, source: 'claude' as const, live: true, state, agent: row?.agent ?? 'claude-code' }
      })
      const listed = new Set(disk.map((s) => s.sessionId))
      for (const r of rows ?? []) {
        if (!r.session_id || listed.has(r.session_id) || fabricIds.has(r.session_id) || r.why === 'gone') continue
        const state = ROW_STATE[r.group]
        if (!state) continue
        listed.add(r.session_id)
        out.push({ pid: 0, live: r.pid != null, sessionId: r.session_id, cwd: r.folder, name: null, status: null, kind: null, entrypoint: null,
          startedAt: null, updatedAt: null, source: 'switchboard', state, agent: r.agent })
      }
      return out.sort((a, b) => (ORDER[a.state ?? ''] ?? 3) - (ORDER[b.state ?? ''] ?? 3))
    },
    async read(sessionId: string): Promise<{ turns: Array<{ role: string; text: string }> } | null> {
      const file = deps.transcript(sessionId)
      if (!file) return null
      return { turns: deps.turns(await readTail(file, READ_TAIL_BYTES), 12) }
    },
    async close(sessionId: string): Promise<MachineAct> {
      if (continuing.has(sessionId)) return { ok: false, why: 'busy' }
      const s = await find(sessionId)
      if (!s) return { ok: false, why: 'gone' }
      if (s === 'unknown-owner') return { ok: false, why: 'unknown-owner' }
      if (!(await deps.stillNames(s))) return { ok: false, why: 'changed' }
      deps.signal(s.pid)
      deps.record('agents.machine-close', { session_id: s.sessionId, pid: s.pid, folder: s.cwd })
      return { ok: true }
    },
    async continueInFabric(sessionId: string, from?: string): Promise<MachineAct> {
      // DA-16 (0.3.26 review, iteration 2): one continue of a session at a time; a second press or link waits its answer.
      if (continuing.has(sessionId)) return { ok: false, why: 'busy' }
      continuing.add(sessionId)
      try { return await continueOnce(sessionId, from) } finally { continuing.delete(sessionId) }
    }
  }
  async function continueOnce(sessionId: string, from?: string): Promise<MachineAct> {
      const s = await find(sessionId)
      if (s === 'unknown-owner') return { ok: false, why: 'unknown-owner' }
      if (!s) {
        // Not running here: a session that ended is continued from its history; one Fabric runs was never «outside».
        if (!deps.resumeEnded) return { ok: false, why: 'gone' }
        const r = await deps.resumeEnded(sessionId, from).catch((e: unknown) => ({ ok: false as const, why: e instanceof Error ? e.message.slice(0, 300) : String(e) }))
        deps.record('agents.machine-continue', { session_id: sessionId, outcome: r.ok ? 'ok' : r.why, ended: true, ...(r.ok && r.sessionId ? { console: r.sessionId } : {}) })
        return r
      }
      if (!(await deps.stillNames(s))) return { ok: false, why: 'changed' }
      // UX-1 (0.3.26 review, iteration 1): what can refuse the continue is asked before the session is stopped, so a
      // refusal leaves the person's terminal session running.
      let projectId: string | undefined
      if (deps.projectFor) {
        const found = await deps.projectFor(s).catch(() => null)
        if (!found) {
          deps.record('agents.machine-continue', { session_id: s.sessionId, pid: s.pid, outcome: 'no-project', folder: s.cwd })
          return { ok: false, why: 'no-project' }
        }
        projectId = found
      }
      deps.signal(s.pid)
      for (let waited = 0; deps.alive(s.pid); waited += 250) {
        if (waited >= TAKE_OVER_WAIT_MS) {
          deps.record('agents.machine-continue', { session_id: s.sessionId, pid: s.pid, outcome: 'still-running' })
          return { ok: false, why: 'still-running' }
        }
        await sleep(250)
      }
      try {
        const opened = await deps.continueInFabric(s, projectId, from)
        deps.record('agents.machine-continue', { session_id: s.sessionId, pid: s.pid, console: opened.sessionId, outcome: 'ok' })
        return { ok: true, sessionId: opened.sessionId }
      } catch (e) {
        deps.record('agents.machine-continue', { session_id: s.sessionId, pid: s.pid, outcome: 'failed', error: e instanceof Error ? e.message.slice(0, 200) : String(e) })
        // The session was stopped and no console continued it: said as such, with how to go on by hand.
        return { ok: false, why: 'stopped-not-continued', resume: { sessionId: s.sessionId, cwd: s.cwd } }
      }
  }
}
export type MachineSessions = ReturnType<typeof createMachineSessions>
// #endregion machine-sessions
