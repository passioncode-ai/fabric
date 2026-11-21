// #region session-meta-read — docs: docs/ux/scenarios.md#scn-188-read-a-consoles-system-line
/**
 * What a console's system line reads (the owner, 2026-11-20): the launch journal, Switchboard's own answers, git and the
 * tail of the runner's transcript, each with its deadline and a cache, so a console that asks every 30 s and ten
 * consoles that ask at once cost one Switchboard call each, not ten. A part that could not be read is left out of the
 * line, never guessed; what it means is `shared/sessionMeta.ts`.
 */
import { open } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import type { BranchReader } from './agentBranches.ts'
import { parseAccounts, parseGroupOrgs, parseSessionLites, parseShellEnv } from './switchboardSessions.ts'
import type { Launch } from '../shared/sessionLaunches.ts'
import { claudeProjectSlug, modelFromTranscriptTail, sessionMeta, type SessionMeta, type SwitchboardView } from '../shared/sessionMeta.ts'

/** Switchboard's session list is read at most this often; the routes and groups (an account switch) as often. */
export const META_SESSIONS_TTL_MS = 30_000
export const META_ACCOUNTS_TTL_MS = 30_000
/** A folder's group changes only when the person edits a group. */
export const META_FOLDER_TTL_MS = 120_000
/** The transcript's tail read for the model: the newest assistant line is within it. */
export const TRANSCRIPT_TAIL_BYTES = 64 * 1024

type Run = (args: string[]) => Promise<{ code: number; stdout: string } | null>

export interface SessionMetaDeps {
  /** One read-only `switchboard` call; null when Switchboard is not installed. */
  switchboard: Run
  branch: BranchReader
  launch: (sessionId: string) => Promise<Launch | null>
  /** The last bytes of a file, or null when it cannot be read. */
  tail?: (file: string, bytes: number) => Promise<string | null>
  home?: string
  now?: () => number
}

export interface ConsoleFacts { sessionId: string; cwd: string; runner: string; startedAt: string }

async function fileTail(file: string, bytes: number): Promise<string | null> {
  let fh
  try {
    fh = await open(file, 'r')
    const { size } = await fh.stat()
    const start = Math.max(0, size - bytes)
    const buf = Buffer.alloc(size - start)
    await fh.read(buf, 0, buf.length, start)
    return buf.toString('utf8')
  } catch {
    // No transcript (yet, or another home): the line names no model, which it says by leaving it out.
    return null
  } finally {
    await fh?.close().catch(() => undefined)
  }
}

export function createSessionMetaReader(deps: SessionMetaDeps): { read(c: ConsoleFacts): Promise<SessionMeta> } {
  const now = deps.now ?? Date.now
  const tail = deps.tail ?? fileTail
  const home = deps.home ?? homedir()
  const cached = <T>(ttl: number, load: () => Promise<T>): (() => Promise<T>) => {
    let held: { at: number; value: Promise<T> } | null = null
    return () => {
      if (held && now() - held.at < ttl) return held.value
      const value = load()
      held = { at: now(), value }
      // A failed read is not kept: the next asks again.
      value.catch(() => { if (held?.value === value) held = null })
      return value
    }
  }
  const json = async <T>(args: string[], parse: (s: string) => T | null): Promise<T | null> => {
    const r = await deps.switchboard(args).catch(() => null)
    return r && r.code === 0 ? parse(r.stdout) : null
  }
  const sessions = cached(META_SESSIONS_TTL_MS, () => json(['--json', 'sessions', '--all'], parseSessionLites))
  const accounts = cached(META_ACCOUNTS_TTL_MS, () => json(['--json', 'accounts', 'list'], parseAccounts))
  const groups = cached(META_ACCOUNTS_TTL_MS, () => json(['--json', 'project', 'list'], parseGroupOrgs))
  const folders = new Map<string, () => Promise<ReturnType<typeof parseShellEnv>>>()
  const folderOf = (cwd: string): Promise<ReturnType<typeof parseShellEnv>> => {
    let f = folders.get(cwd)
    if (!f) {
      if (folders.size > 200) folders.clear()
      f = cached(META_FOLDER_TTL_MS, () => json(['--json', 'shell', 'env', '--dir', cwd], parseShellEnv))
      folders.set(cwd, f)
    }
    return f()
  }

  return {
    async read(c) {
      const [launch, branch, sb, acc, orgs, folder] = await Promise.all([
        deps.launch(c.sessionId).catch(() => null),
        deps.branch.read(c.cwd),
        sessions(), accounts(), groups(), folderOf(c.cwd)
      ])
      const switchboard: SwitchboardView | null = sb || acc || folder
        ? { sessions: sb, routes: acc?.routes ?? null, labels: acc?.labels ?? null, groupOrg: orgs, folder: folder ? { pool: folder.pool, context: folder.context } : null }
        : null
      let model: string | null = null
      const runnerSession = launch?.runnerSessionId ?? null
      if (c.runner === 'claude-code' && runnerSession) {
        const homes = [folder?.claudeHome, process.env.CLAUDE_CONFIG_DIR, path.join(home, '.claude')].filter((h): h is string => Boolean(h))
        for (const h of homes) {
          const text = await tail(path.join(h, 'projects', claudeProjectSlug(c.cwd), `${runnerSession}.jsonl`), TRANSCRIPT_TAIL_BYTES)
          if (text) { model = modelFromTranscriptTail(text); break }
        }
      }
      return sessionMeta({ ...c, launch, switchboard, branch, model })
    }
  }
}
// #endregion session-meta-read
