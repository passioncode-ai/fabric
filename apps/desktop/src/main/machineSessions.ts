// #region machine-sessions — docs: docs/ux/scenarios.md#scn-166-see-every-agent-and-open-its-console-in-one-press
/**
 * The Claude Code sessions running on this computer outside Fabric (a terminal, Switchboard, a `claude -p` run), as
 * Агенты shows them (board request eef5abeb, point 3): read from Claude Code's own files, so the list works whether
 * Switchboard answers or not (point 4). Each can be read (its last turns, from its transcript), closed (SIGTERM, only
 * while its process still names that session) or continued in a Fabric console: the outside process is asked to stop,
 * and once it has ended a console starts in its folder with `claude --resume <id>`, so the work goes on with its
 * context and Fabric holds it. Every act is written in the operations log.
 */
import { readFile } from 'node:fs/promises'
import type { DiskSession } from './diskSessions.ts'

export interface MachineSession {
  pid: number
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
  record(op: string, detail: Record<string, unknown>): void
  sleep?(ms: number): Promise<void>
}

/** How long a continue waits for the outside process to end after its SIGTERM. */
export const TAKE_OVER_WAIT_MS = 10_000

export function createMachineSessions(deps: MachineSessionsDeps) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const outside = async (): Promise<DiskSession[]> => {
    const [live, ours] = await Promise.all([deps.live(), deps.fabricRunnerIds()])
    return live.filter((s) => !ours.has(s.sessionId))
  }
  const find = async (sessionId: string): Promise<DiskSession | null> => (await outside()).find((s) => s.sessionId === sessionId) ?? null

  return {
    async list(): Promise<MachineSession[]> {
      return (await outside()).map(({ config: _config, ...s }) => s)
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
