// #region claude-inbound — docs: docs/ux/scenarios.md#scn-170-set-how-fabric-behaves-in-настройки
/**
 * CO-407 (fabric-workspace's ask on board thread `7bd4dfac`, amended): Claude Code's `crossSessionInbound` set to
 * "accept" lets one agent session message another on this computer. It widens what every Claude Code session here
 * accepts, so Fabric sets it only when the person turns the switch on in Settings, and turning it off removes it.
 *
 * Claude Code's user settings: `$CLAUDE_CONFIG_DIR/settings.json`, else `~/.claude/settings.json`. Every other key is
 * kept. The write follows `claudeTrust.ts` (0.3.12 review ER-7): under Claude's own lock (`<realpath>.lock`, 0.3.12 review i2 ER-10), read again
 * under it, through a temporary file beside the real file and a rename with the file's mode, so a reader never sees
 * half a file, a symlinked settings file stays a link (its target is written), and a temporary file is removed when the
 * write fails. A link whose target does not exist is never written over: `notSaved` with code `ENOENT-link` (0.3.12
 * review i3 ER-8). A file that does not read as a JSON object is never written over: `unreadable` is the answer. A write
 * that could not be made is its own answer, `notSaved`, beside what the file still holds, so the switch stays.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import path from 'node:path'
import { lockClaudeFile } from './claudeTrust.ts'

/** Why a change was not saved: Claude held its lock past the wait, or the write itself failed (`code`, e.g. EACCES, or
 *  `ENOENT-link` for a symlinked settings file whose target does not exist). */
export type InboundNotSaved = { reason: 'locked' } | { reason: 'write-failed'; code: string }

export type InboundState =
  | { accepting: boolean; value: string | null; file: string; notSaved?: InboundNotSaved }
  | { unreadable: true; file: string }

export function claudeSettingsFile(env: NodeJS.ProcessEnv = process.env, home = homedir()): string {
  const dir = env.CLAUDE_CONFIG_DIR?.trim()
  return path.join(dir || path.join(home, '.claude'), 'settings.json')
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function readSettings(file: string): Record<string, unknown> | null | 'unreadable' {
  if (!existsSync(file)) return null
  try {
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
    return isObject(value) ? value : 'unreadable'
  } catch {
    // Not silent: `unreadable` is the answer the caller shows, and the file is left as it is.
    return 'unreadable'
  }
}

export function readInbound(file: string = claudeSettingsFile()): InboundState {
  const s = readSettings(file)
  if (s === 'unreadable') return { unreadable: true, file }
  const value = s && typeof s.crossSessionInbound === 'string' ? s.crossSessionInbound : null
  return { accepting: value === 'accept', value, file }
}

/** Turns the setting on ("accept") or off (the key removed); answers what the file holds afterwards, with `notSaved`
 *  when the change could not be written. */
export async function setInbound(on: boolean, file: string = claudeSettingsFile(), opts: { lockWaitMs?: number } = {}): Promise<InboundState> {
  const plan = (s: Record<string, unknown> | null): Record<string, unknown> | null => {
    const next: Record<string, unknown> = { ...(s ?? {}) }
    if (on) next.crossSessionInbound = 'accept'
    else delete next.crossSessionInbound
    if (s !== null && JSON.stringify(s) === JSON.stringify(next)) return null
    if (s === null && !on) return null
    return next
  }
  const first = readSettings(file)
  if (first === 'unreadable') return { unreadable: true, file }
  if (plan(first) === null) return readInbound(file)
  if (danglingLink(file)) return withNotSaved(file, DANGLING)
  try {
    mkdirSync(path.dirname(file), { recursive: true })
  } catch (e) {
    // Not silent: the answer says the change was not saved and why (the caller records it); nothing was written.
    return withNotSaved(file, { reason: 'write-failed', code: errCode(e) })
  }
  // `locked` only when Claude holds its lock; a lock that cannot be made is `write-failed` with the system's code.
  const lock = await lockClaudeFile(file, opts.lockWaitMs ?? 2000)
  if ('refused' in lock) return withNotSaved(file, lock.refused === 'locked' ? { reason: 'locked' } : { reason: 'write-failed', code: lock.code })
  try {
    // Read again under the lock: Claude Code may have written it between the first read and now.
    const current = readSettings(file)
    if (current === 'unreadable') return { unreadable: true, file }
    const next = plan(current)
    if (next === null) return readInbound(file)
    let target = file
    try { target = realpathSync.native(file) } catch {
      // Not silent: a link whose target went missing since the first look is the DANGLING answer; otherwise there is no
      // file yet and the path is its own target.
      if (danglingLink(file)) return withNotSaved(file, DANGLING)
    }
    const mode = existsSync(target) ? statSync(target).mode & 0o777 : 0o600
    const tmp = `${target}.fabric-inbound-${randomUUID()}.tmp`
    try {
      writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode })
      renameSync(tmp, target)
    } catch (e) {
      // Not silent: the answer says the change was not saved and why; the settings file is as it was.
      return withNotSaved(file, { reason: 'write-failed', code: errCode(e) })
    } finally {
      // A temporary file whose name the system refused (ENAMETOOLONG) cannot be removed either: that is not a second
      // failure to throw over the first, which the answer already carries.
      try { rmSync(tmp, { force: true }) } catch { /* nothing was made under that name */ }
    }
    return readInbound(file)
  } finally {
    lock.release()
  }
}

const DANGLING: InboundNotSaved = { reason: 'write-failed', code: 'ENOENT-link' }

/** A symlink whose target does not exist: writing the path would replace the link with a file (i3 ER-8). */
function danglingLink(file: string): boolean {
  try {
    if (!lstatSync(file).isSymbolicLink()) return false
  } catch {
    // Silence is right: no entry at all is not a link; the write creates the file.
    return false
  }
  return !existsSync(file)
}

const errCode = (e: unknown): string => (typeof (e as NodeJS.ErrnoException)?.code === 'string' ? (e as NodeJS.ErrnoException).code! : 'unknown')

function withNotSaved(file: string, notSaved: InboundNotSaved): InboundState {
  const now = readInbound(file)
  return 'unreadable' in now ? now : { ...now, notSaved }
}
// #endregion claude-inbound
