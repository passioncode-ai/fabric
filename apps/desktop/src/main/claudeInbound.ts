// #region claude-inbound — docs: docs/ux/scenarios.md#scn-170-set-how-fabric-behaves-in-настройки
/**
 * CO-407 (fabric-workspace's ask on board thread `7bd4dfac`, amended): Claude Code's `crossSessionInbound` set to
 * "accept" lets one agent session message another on this computer. It widens what every Claude Code session here
 * accepts, so Fabric sets it only when the person turns the switch on in Settings, and turning it off removes it.
 *
 * Claude Code's user settings: `$CLAUDE_CONFIG_DIR/settings.json`, else `~/.claude/settings.json`. Every other key is
 * kept; the write goes through a temporary file and a rename with the file's mode, so a reader never sees half a file;
 * a file that does not read as a JSON object is never written over: `unreadable` is the answer.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import path from 'node:path'

export type InboundState = { accepting: boolean; value: string | null; file: string } | { unreadable: true; file: string }

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

/** Turns the setting on ("accept") or off (the key removed); answers what the file holds afterwards. */
export function setInbound(on: boolean, file: string = claudeSettingsFile()): InboundState {
  const s = readSettings(file)
  if (s === 'unreadable') return { unreadable: true, file }
  const next: Record<string, unknown> = { ...(s ?? {}) }
  if (on) next.crossSessionInbound = 'accept'
  else delete next.crossSessionInbound
  if (s !== null && JSON.stringify(s) === JSON.stringify(next)) return readInbound(file)
  if (s === null && !on) return readInbound(file)
  mkdirSync(path.dirname(file), { recursive: true })
  const mode = existsSync(file) ? statSync(file).mode & 0o777 : 0o600
  const tmp = `${file}.${randomUUID()}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', { mode })
  chmodSync(tmp, mode)
  renameSync(tmp, file)
  return readInbound(file)
}
// #endregion claude-inbound
