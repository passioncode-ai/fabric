// #region fabric-readiness — docs: docs/ux/scenarios.md#scn-170-set-how-fabric-behaves-in-настройки
/**
 * CO-407: the PassionCode launcher's read-only doctor (`doctor --json`), narrowed to what concerns Fabric for its
 * Settings: the checks whose product is Fabric, its MCP registrations, and the prerequisites with no product. Every
 * other way the answer can fail is a named reason, never an empty «all good».
 */
export type ReadinessState = 'ok' | 'warn' | 'fail' | 'info'
export interface ReadinessCheck { id: string; state: ReadinessState; detail: string; fix: string | null }
export type FabricReadiness =
  | { ok: true; version: string | null; at: string | null; checks: ReadinessCheck[]; summary: Record<ReadinessState, number> }
  | { ok: false; reason: 'no-npx' | 'failed' | 'timeout' | 'unreadable'; detail: string | null }

const STATES = new Set(['ok', 'warn', 'fail', 'info'])

export function parseReadiness(stdout: string): FabricReadiness {
  let doc: unknown
  try { doc = JSON.parse(stdout) } catch { return { ok: false, reason: 'unreadable', detail: stdout.trim().slice(0, 200) || null } }
  const d = doc as { version?: unknown; at?: unknown; checks?: unknown }
  if (!d || typeof d !== 'object' || !Array.isArray(d.checks)) return { ok: false, reason: 'unreadable', detail: null }
  const checks: ReadinessCheck[] = []
  for (const raw of d.checks as Array<Record<string, unknown>>) {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !STATES.has(String(raw.state))) continue
    const mine = raw.product === 'fabric' || /(^|\.)fabric(\.|$)/.test(raw.id) || (raw.area === 'prerequisites' && raw.product === null)
    if (!mine) continue
    checks.push({ id: raw.id, state: raw.state as ReadinessState, detail: typeof raw.detail === 'string' ? raw.detail : '', fix: typeof raw.fix === 'string' ? raw.fix : null })
  }
  const summary: Record<ReadinessState, number> = { ok: 0, warn: 0, fail: 0, info: 0 }
  for (const c of checks) summary[c.state]++
  return { ok: true, version: typeof d.version === 'string' ? d.version : null, at: typeof d.at === 'string' ? d.at : null, checks, summary }
}
// #endregion fabric-readiness
