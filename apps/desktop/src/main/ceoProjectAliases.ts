// #region ceo-project-aliases — docs: docs/reports/2026-11-20-voice-ceo-retro/fixes.md#4-project-names-heard-by-voice
/**
 * The names the owner uses for projects (voice CEO retro 2026-11-20, finding 4): «Диззи» for dissy, «плейсинг» for
 * playsing. Kept on this computer in one small file (`aliases.json` in the CEO's folder, 0600), written whole or not at
 * all (beside, then renamed), read on every lookup so a name kept in the console is heard by the next call. At most
 * MAX_PER_PROJECT names a project, each at most 60 characters; a name already kept is not added twice.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

export const MAX_PER_PROJECT = 10
export const ALIAS_FILE = 'project-aliases.json'

export interface AliasStore {
  /** Every project's kept names, by project id; empty when the file is missing or unreadable. */
  read(): Record<string, string[]>
  /** Keep one more name for a project; answers its names after the write. */
  add(projectId: string, alias: string): string[]
}

export function createAliasStore(folder: string): AliasStore {
  const file = path.join(folder, ALIAS_FILE)
  function read(): Record<string, string[]> {
    let raw: unknown
    try { raw = JSON.parse(readFileSync(file, 'utf8')) } catch { return {} /* no names kept yet, or a file being replaced: none */ }
    const out: Record<string, string[]> = {}
    const aliases = raw && typeof raw === 'object' ? (raw as { aliases?: unknown }).aliases : null
    if (!aliases || typeof aliases !== 'object') return out
    for (const [id, list] of Object.entries(aliases as Record<string, unknown>)) {
      if (Array.isArray(list)) out[id] = list.filter((a): a is string => typeof a === 'string' && a.trim().length > 1).slice(0, MAX_PER_PROJECT)
    }
    return out
  }
  function add(projectId: string, alias: string): string[] {
    const name = alias.trim().replace(/\s+/g, ' ').slice(0, 60)
    const all = read()
    const list = all[projectId] ?? []
    if (name.length > 1 && !list.some((a) => a.toLowerCase() === name.toLowerCase())) list.push(name)
    // The oldest name gives way when a project has too many.
    all[projectId] = list.slice(-MAX_PER_PROJECT)
    mkdirSync(folder, { recursive: true, mode: 0o700 })
    const tmp = path.join(folder, `.${ALIAS_FILE}.${randomUUID()}.tmp`)
    try {
      writeFileSync(tmp, JSON.stringify({ version: 1, aliases: all }, null, 2), { mode: 0o600 })
      renameSync(tmp, file)
    } finally { rmSync(tmp, { force: true }) }
    return all[projectId]!
  }
  return { read, add }
}
// #endregion ceo-project-aliases
