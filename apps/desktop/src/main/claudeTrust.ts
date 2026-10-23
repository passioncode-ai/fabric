// #region claude-trust — docs: docs/evidence/plans/2026-10-15-fabric-simple/2026-10-19-operator-feedback.md
/**
 * OF-12 (the operator, 2026-10-19): a Claude Code session Fabric starts in a project's folder does not stop at
 * «Do you trust this folder?». The operator pointed at Orca's «Trust the folder when Orca starts an agent», and this
 * does what Orca does (measured in its bundle, `claude-profile-paths`): before the start, the folder's
 * `hasTrustDialogAccepted` is set in Claude Code's own state file, for the path as given and for its real path,
 *
 * - under Claude's lock (`<file>.lock`, a directory, the proper-lockfile convention Claude Code itself uses),
 * - through a temporary file beside it with the same mode, then a rename, so a reader never sees half a file,
 * - changing nothing but that flag, and nothing at all when the folder is trusted already,
 * - and never writing over a file it could not read: `unreadable` and `missing-config` are answers, not repairs.
 *
 * Folders already trusted stay trusted; Fabric never sets the flag to false.
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import path from 'node:path'

export type TrustOutcome = 'granted' | 'unchanged' | 'missing-config' | 'unreadable' | 'locked'

export interface TrustOptions {
  env?: NodeJS.ProcessEnv
  home?: string
  /** How long to wait for Claude's own lock before answering `locked`. */
  lockWaitMs?: number
}

/** A lock older than this was left by a process that died; proper-lockfile treats 10 s the same way. */
const STALE_LOCK_MS = 10_000

/** Claude Code's state file: `$CLAUDE_CONFIG_DIR/.config.json` when it exists, else `.claude.json` beside the config
 *  directory's choice (`$CLAUDE_CONFIG_DIR/.claude.json`, or `~/.claude.json`). */
export function claudeStateFile({ env = process.env, home = homedir() }: TrustOptions = {}): string {
  const dir = env.CLAUDE_CONFIG_DIR?.trim()
  const configJson = path.join(dir || path.join(home, '.claude'), '.config.json')
  if (existsSync(configJson)) return configJson
  return path.join(dir || home, '.claude.json')
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function readState(file: string): Record<string, unknown> | 'missing-config' | 'unreadable' {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch (e) {
    // Not silent: `missing-config` or `unreadable` is the answer, recorded by the caller; nothing is created.
    return (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing-config' : 'unreadable'
  }
  try {
    const value: unknown = JSON.parse(text)
    return isObject(value) ? value : 'unreadable'
  } catch {
    // Not silent: `unreadable` is the answer, recorded by the caller, and the file is left as it is.
    return 'unreadable'
  }
}

/** The state with every key trusted, or null when it already is, or 'unreadable' when `projects` is not an object. */
function withTrust(state: Record<string, unknown>, keys: string[]): Record<string, unknown> | null | 'unreadable' {
  if (state.projects !== undefined && !isObject(state.projects)) return 'unreadable'
  const projects: Record<string, unknown> = { ...(state.projects as Record<string, unknown> | undefined) }
  if (keys.every((k) => isObject(projects[k]) && (projects[k] as Record<string, unknown>).hasTrustDialogAccepted === true)) return null
  for (const k of keys) {
    const entry = projects[k]
    projects[k] = isObject(entry) ? { ...entry, hasTrustDialogAccepted: true } : { hasTrustDialogAccepted: true }
  }
  return { ...state, projects }
}

/** Claude's own lock on one of its files (`<file>.lock`, a directory, proper-lockfile's convention): a release function,
 *  or null when it could not be taken within `waitMs`. Also `claudeInbound.ts`'s, for Claude Code's settings file. */
export async function lockClaudeFile(file: string, waitMs: number): Promise<(() => void) | null> {
  const dir = `${file}.lock`
  const until = Date.now() + waitMs
  for (;;) {
    try {
      mkdirSync(dir)
      return () => { try { rmdirSync(dir) } catch { /* already gone: nothing to release */ } }
    } catch (e) {
      // Not silent: EEXIST is Claude holding the lock (wait for it); anything else answers `locked` to the caller.
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') return null
      try {
        if (Date.now() - statSync(dir).mtimeMs > STALE_LOCK_MS) { rmdirSync(dir); continue }
      } catch {
        // The lock went away between the two reads: try to take it again.
        continue
      }
      if (Date.now() >= until) return null
      await new Promise((r) => setTimeout(r, 25))
    }
  }
}

export async function trustFolderForClaude(folder: string, opts: TrustOptions = {}): Promise<TrustOutcome> {
  const file = claudeStateFile(opts)
  const keys = [...new Set([path.resolve(folder), (() => { try { return realpathSync.native(folder) } catch { /* a folder with no real path is trusted by the path given */ return path.resolve(folder) } })()])]
  const first = readState(file)
  if (typeof first === 'string') return first
  const planned = withTrust(first, keys)
  if (planned === 'unreadable') return 'unreadable'
  if (planned === null) return 'unchanged'
  const release = await lockClaudeFile(file, opts.lockWaitMs ?? 2000)
  if (!release) return 'locked'
  try {
    // Read again under the lock: Claude may have written it between the first read and now.
    const current = readState(file)
    if (typeof current === 'string') return current
    const next = withTrust(current, keys)
    if (next === 'unreadable') return 'unreadable'
    if (next === null) return 'unchanged'
    const target = (() => { try { return realpathSync.native(file) } catch { /* not a link: the file is its own target */ return file } })()
    const tmp = `${target}.fabric-trust-${randomUUID()}.tmp`
    try {
      writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: statSync(target).mode & 0o777 })
      renameSync(tmp, target)
    } finally {
      rmSync(tmp, { force: true })
    }
    return 'granted'
  } finally {
    release()
  }
}
// #endregion claude-trust
