// #region agent-catalog — docs: docs/evidence/plans/2026-10-14-operator-home/README.md#настройки-новый-экран
/**
 * The agents this machine can run, as Settings shows them (operator request 2026-10-14). Switchboard 0.6.31+ owns
 * the catalogue of coding agents and publishes it as `switchboard --json agents status` (schema 1, its contract
 * SB-119/SB-120); Fabric reads it and never writes it — enabling, disabling and choosing the default stay
 * Switchboard's commands. Without Switchboard, or with one too old to answer, Settings falls back to Fabric's own
 * detection and says which source it shows.
 */

export interface CatalogAgent {
  id: string
  name: string
  /** Null when the source does not say. */
  installed: boolean | null
  path: string | null
  enabled: boolean | null
  isDefault: boolean
  /** The vendor's install command, when it publishes one. */
  install: string | null
  url: string | null
}

export type SwitchboardCatalog =
  | { source: 'switchboard'; revision: string | null; defaultId: string | null; agents: CatalogAgent[] }
  | { source: 'absent'; reason: 'not-installed' | 'too-old' | 'failed'; detail: string | null }

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)

/** Schema 1 of `switchboard --json agents status`, read defensively: an unknown shape is null, never a guess. */
export function parseSwitchboardAgents(stdout: string): { revision: string | null; defaultId: string | null; agents: CatalogAgent[] } | null {
  let doc: unknown
  try {
    doc = JSON.parse(stdout)
  } catch {
    return null
  }
  if (!doc || typeof doc !== 'object') return null
  const d = doc as Record<string, unknown>
  if (d.schema !== 1 || !Array.isArray(d.agents)) return null
  const defaultId = str(d.default)
  const agents: CatalogAgent[] = []
  for (const raw of d.agents) {
    if (!raw || typeof raw !== 'object') continue
    const a = raw as Record<string, unknown>
    const id = str(a.id)
    if (!id) continue
    const install = typeof a.install === 'string' ? str(a.install) : a.install && typeof a.install === 'object' ? str((a.install as Record<string, unknown>).command) : null
    const disabled = bool(a.disabled)
    agents.push({
      id,
      name: str(a.name) ?? id,
      installed: bool(a.installed),
      path: str(a.path),
      enabled: bool(a.enabled) ?? (disabled === null ? null : !disabled),
      isDefault: a.default === true || id === defaultId,
      install,
      url: str(a.url)
    })
  }
  return { revision: d.revision === undefined || d.revision === null ? null : String(d.revision), defaultId, agents }
}

export interface CatalogDeps {
  /** Switchboard's executable on this machine's PATH, or null. */
  find(): Promise<string | null>
  run(file: string, args: readonly string[]): Promise<{ code: number | null; stdout: string; stderr: string }>
}

/** One bounded read; every way it can fail is a named reason, never an empty list. */
export async function readSwitchboardCatalog(deps: CatalogDeps): Promise<SwitchboardCatalog> {
  const file = await deps.find()
  if (!file) return { source: 'absent', reason: 'not-installed', detail: null }
  let r: { code: number | null; stdout: string; stderr: string }
  try {
    r = await deps.run(file, ['--json', 'agents', 'status'])
  } catch (e) {
    return { source: 'absent', reason: 'failed', detail: e instanceof Error ? e.message : String(e) }
  }
  const parsed = r.code === 0 ? parseSwitchboardAgents(r.stdout) : null
  if (parsed) return { source: 'switchboard', ...parsed }
  // Before 0.6.31 the command does not exist and Switchboard answers "Invalid arguments" (measured on 0.6.30).
  if (/invalid arguments/i.test(r.stdout + r.stderr)) return { source: 'absent', reason: 'too-old', detail: null }
  return { source: 'absent', reason: 'failed', detail: (r.stderr || r.stdout).trim().slice(0, 200) || `exit ${r.code}` }
}
// #endregion agent-catalog
