// #region kept-out-file — docs: docs/ux/scenarios.md#scn-167-a-coding-agent-opened-outside-fabric-is-let-in-and-the-person-disconnects-it-with-one-press
/**
 * The coding agents the person disconnected (ADR-0160 §3, SCN-167; 0.3.7 wave 3): agent key → its name as shown and
 * when. Kept on this computer beside the hub's own credentials (`kept-out-agents.json` in the app's data folder),
 * because "kept out" is about this machine's door; the act that put an agent here is in История with its undo.
 */
export type KeptOutFile = Record<string, { name: string | null; at: string }>

export function validateKeptOutFile(parsed: unknown): KeptOutFile | null {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const out: KeptOutFile = {}
  for (const [key, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (!key || v === null || typeof v !== 'object' || Array.isArray(v)) return null
    const e = v as Record<string, unknown>
    if (typeof e.at !== 'string' || !(e.name === null || typeof e.name === 'string')) return null
    out[key] = { name: e.name as string | null, at: e.at }
  }
  return out
}
// #endregion kept-out-file
