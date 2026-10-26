// #region folder-trust-setting — docs: docs/ux/scenarios.md#scn-170-set-how-fabric-behaves-in-настройки
/**
 * CO-348: whether Fabric marks a Claude Code session's folder trusted before it starts (`main/claudeTrust.ts`). The
 * person's switch in Settings decides; the environment variable that came first still turns it off on this machine.
 * A settings read that names nothing keeps the default, which is on (the operator, 2026-10-19).
 */
export function trustsAgentFolders(s: { trustAgentFolders?: boolean } | null, env: Readonly<Record<string, string | undefined>>): boolean {
  if (folderTrustOverridden(env)) return false
  return s?.trustAgentFolders !== false
}

/** Whether the environment keeps folder trust off whatever the switch says: Settings then shows the switch off and says
 *  why (0.3.13 review, iteration 1, UX-9). */
export function folderTrustOverridden(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.FABRIC_TRUST_AGENT_FOLDERS === '0'
}
// #endregion folder-trust-setting
