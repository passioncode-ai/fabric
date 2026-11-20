// #region disk-sessions — docs: docs/evidence/specs/2026-11-19-session-launch-journal.md#5-when-switchboard-does-not-answer
/**
 * The Claude Code sessions running on this computer, read from Claude Code's own files and not from Switchboard
 * (board request eef5abeb, point 4: the session list must not depend on Switchboard's CLI answering). Claude Code
 * writes `<config>/sessions/<pid>.json` for each process it runs (measured on 2.1.299, 2026-11-19: `pid`,
 * `sessionId`, `cwd`, `startedAt`, `status`, `name`, `kind`, `entrypoint`); a file whose process is gone is left by
 * a crash and is skipped. Ids, folders, names and times only: never a transcript's content.
 */
import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

export interface DiskSession {
  pid: number
  sessionId: string
  cwd: string
  name: string | null
  status: string | null
  kind: string | null
  entrypoint: string | null
  startedAt: string | null
  updatedAt: string | null
  /** The Claude config folder it was read from: the person's own, or a Switchboard home. */
  config: string
}

/** Where Claude Code keeps its per-process files: the person's home, then every Switchboard runtime home. */
export async function claudeConfigDirs(home = homedir()): Promise<string[]> {
  const out = [path.join(home, '.claude')]
  const runtimes = path.join(home, 'Library/Application Support/ai.passioncode.fabric-switchboard/runtimes')
  try {
    for (const h of (await readdir(runtimes)).slice(0, 200)) out.push(path.join(runtimes, h))
  } catch { /* no Switchboard on this computer: its homes are not there */ }
  return out
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const iso = (v: unknown): string | null => (typeof v === 'number' && Number.isFinite(v) ? new Date(v).toISOString() : null)
const str = (v: unknown, max = 200): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null)

export function defaultAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch (e) { return (e as { code?: string }).code === 'EPERM' /* alive, another user's */ }
}

/** Every live Claude Code process with its session, newest update first; at most `limit` (200). */
export async function liveClaudeSessions(configs: readonly string[], alive: (pid: number) => boolean = defaultAlive, limit = 200): Promise<DiskSession[]> {
  const out: DiskSession[] = []
  const seen = new Set<number>()
  for (const config of configs) {
    let names: string[]
    try { names = await readdir(path.join(config, 'sessions')) } catch { continue /* this home never ran Claude Code */ }
    for (const name of names) {
      if (!/^\d+\.json$/.test(name)) continue
      let j: Record<string, unknown>
      try { j = JSON.parse(await readFile(path.join(config, 'sessions', name), 'utf8')) as Record<string, unknown> } catch { continue /* half written: the next read takes it */ }
      const pid = typeof j.pid === 'number' ? j.pid : NaN
      if (!Number.isInteger(pid) || pid <= 0 || `${pid}.json` !== name || seen.has(pid)) continue
      if (typeof j.sessionId !== 'string' || !UUID.test(j.sessionId) || typeof j.cwd !== 'string' || !path.isAbsolute(j.cwd)) continue
      if (!alive(pid)) continue
      seen.add(pid)
      out.push({ pid, sessionId: j.sessionId, cwd: j.cwd, name: str(j.name), status: str(j.status, 40), kind: str(j.kind, 40),
        entrypoint: str(j.entrypoint, 40), startedAt: iso(j.startedAt), updatedAt: iso(j.updatedAt), config })
    }
  }
  return out.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, limit)
}
// #endregion disk-sessions
