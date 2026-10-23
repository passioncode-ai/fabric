// #region claude-inbound — docs: docs/ux/scenarios.md#scn-170-set-how-fabric-behaves-in-настройки
/**
 * CO-407 (fabric-workspace's ask on board thread `7bd4dfac`, amended): Claude Code's `crossSessionInbound` set to
 * "accept" lets one agent session message another on this computer. It widens what every Claude Code session here
 * accepts, so Fabric sets it only when the person turns the switch on in Settings, and turning it off removes it.
 *
 * Claude Code's user settings: `$CLAUDE_CONFIG_DIR/settings.json`, else `~/.claude/settings.json`. Every other key is
 * kept. The write follows `claudeTrust.ts` (0.3.12 review ER-7): under Claude's own lock (`<file>.lock`), read again
 * under it, through a temporary file beside the real file and a rename with the file's mode, so a reader never sees
 * half a file, a symlinked settings file stays a link (its target is written), and a temporary file is removed when the
 * write fails. A file that does not read as a JSON object is never written over: `unreadable` is the answer. A write
 * that could not be made is its own answer, `notSaved`, beside what the file still holds, so the switch stays.
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import path from 'node:path'
import { lockClaudeFile } from './claudeTrust.ts'

/** Why a change was not saved: Claude held its lock past the wait, or the write itself failed (`code`, e.g. EACCES). */
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
  try {
    mkdirSync(path.dirname(file), { recursive: true })
  } catch (e) {
    // Not silent: the answer says the change was not saved and why (the caller records it); nothing was written.
    return withNotSaved(file, { reason: 'write-failed', code: errCode(e) })
  }
  const release = await lockClaudeFile(file, opts.lockWaitMs ?? 2000)
  if (!release) return withNotSaved(file, { reason: 'locked' })
  try {
    // Read again under the lock: Claude Code may have written it between the first read and now.
    const current = readSettings(file)
    if (current === 'unreadable') return { unreadable: true, file }
    const next = plan(current)
    if (next === null) return readInbound(file)
    const target = (() => { try { return realpathSync.native(file) } catch { /* no file yet, or not a link: the path is its own target */ return file } })()
    const mode = existsSync(target) ? statSync(target).mode & 0o777 : 0o600
    const tmp = `${target}.fabric-inbound-${randomUUID()}.tmp`
    try {
      writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode })
      renameSync(tmp, target)
    } catch (e) {
      // Not silent: the answer says the change was not saved and why; the settings file is as it was.
      return withNotSaved(file, { reason: 'write-failed', code: errCode(e) })
    } finally {
      rmSync(tmp, { force: true })
    }
    return readInbound(file)
  } finally {
    release()
  }
}

const errCode = (e: unknown): string => (typeof (e as NodeJS.ErrnoException)?.code === 'string' ? (e as NodeJS.ErrnoException).code! : 'unknown')

function withNotSaved(file: string, notSaved: InboundNotSaved): InboundState {
  const now = readInbound(file)
  return 'unreadable' in now ? now : { ...now, notSaved }
}
// #endregion claude-inbound
