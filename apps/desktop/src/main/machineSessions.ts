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
import { readFile } from 'node:fs/promises'
import type { DiskSession } from './diskSessions.ts'

/** One `switchboard --json sessions --rows` row, as `ceoTools.ts#parseMachineRows` reads it. */
export interface SwitchboardRow {
  session_id: string | null
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

export type MachineAct = { ok: true; sessionId?: string } | { ok: false; why: string }

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
  /** A Fabric console in the folder that continues the session (`claude --resume`), with the home it ran in. */
  continueInFabric(s: DiskSession): Promise<{ sessionId: string }>
  /** Switchboard's rows of this computer; null when Switchboard is not installed or did not answer. */
  switchboardRows?(): Promise<SwitchboardRow[] | null>
  record(op: string, detail: Record<string, unknown>): void
  sleep?(ms: number): Promise<void>
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
  const outside = async (): Promise<DiskSession[]> => {
    const [live, ours] = await Promise.all([deps.live(), deps.fabricRunnerIds()])
    return live.filter((s) => !ours.has(s.sessionId))
  }
  const find = async (sessionId: string): Promise<DiskSession | null> => (await outside()).find((s) => s.sessionId === sessionId) ?? null

  return {
    async list(): Promise<MachineSession[]> {
      const [disk, ours, rows] = await Promise.all([outside(), deps.fabricRunnerIds(), deps.switchboardRows?.().catch(() => null) ?? Promise.resolve(null)])
      const byId = new Map((rows ?? []).filter((r) => r.session_id).map((r) => [r.session_id!, r]))
      const out: MachineSession[] = disk.map(({ config: _config, ...s }) => {
        const row = byId.get(s.sessionId)
        // Switchboard's group wins when it names the session, so this list counts as Switchboard and Fabric Dashboards do
        // (the operator, 2026-11-20: one machine, one count); the file's status only when Switchboard does not know it.
        const state = (row ? ROW_STATE[row.group] : undefined) ?? stateOfStatus(s.status)
        return { ...s, source: 'claude' as const, state, agent: row?.agent ?? 'claude-code' }
      })
      const listed = new Set(disk.map((s) => s.sessionId))
      for (const r of rows ?? []) {
        if (!r.session_id || listed.has(r.session_id) || ours.has(r.session_id) || r.why === 'gone') continue
        const state = ROW_STATE[r.group]
        if (!state) continue
        listed.add(r.session_id)
        out.push({ pid: 0, sessionId: r.session_id, cwd: r.folder, name: null, status: null, kind: null, entrypoint: null,
          startedAt: null, updatedAt: null, source: 'switchboard', state, agent: r.agent })
      }
      return out.sort((a, b) => (ORDER[a.state ?? ''] ?? 3) - (ORDER[b.state ?? ''] ?? 3))
    },
    async read(sessionId: string): Promise<{ turns: Array<{ role: string; text: string }> } | null> {
      const file = deps.transcript(sessionId)
      if (!file) return null
      const text = await readFile(file, 'utf8')
      return { turns: deps.turns(text.length > 2_000_000 ? text.slice(-2_000_000) : text, 12) }
    },
    async close(sessionId: string): Promise<MachineAct> {
      const s = await find(sessionId)
      if (!s) return { ok: false, why: 'gone' }
      if (!(await deps.stillNames(s))) return { ok: false, why: 'changed' }
      deps.signal(s.pid)
      deps.record('agents.machine-close', { session_id: s.sessionId, pid: s.pid, folder: s.cwd })
      return { ok: true }
    },
    async continueInFabric(sessionId: string): Promise<MachineAct> {
      const s = await find(sessionId)
      if (!s) return { ok: false, why: 'gone' }
      if (!(await deps.stillNames(s))) return { ok: false, why: 'changed' }
      deps.signal(s.pid)
      for (let waited = 0; deps.alive(s.pid); waited += 250) {
        if (waited >= TAKE_OVER_WAIT_MS) {
          deps.record('agents.machine-continue', { session_id: s.sessionId, pid: s.pid, outcome: 'still-running' })
          return { ok: false, why: 'still-running' }
        }
        await sleep(250)
      }
      try {
        const opened = await deps.continueInFabric(s)
        deps.record('agents.machine-continue', { session_id: s.sessionId, pid: s.pid, console: opened.sessionId, outcome: 'ok' })
        return { ok: true, sessionId: opened.sessionId }
      } catch (e) {
        deps.record('agents.machine-continue', { session_id: s.sessionId, pid: s.pid, outcome: 'failed', error: e instanceof Error ? e.message.slice(0, 200) : String(e) })
        return { ok: false, why: e instanceof Error ? e.message.slice(0, 300) : String(e) }
      }
    }
  }
}
export type MachineSessions = ReturnType<typeof createMachineSessions>
// #endregion machine-sessions
