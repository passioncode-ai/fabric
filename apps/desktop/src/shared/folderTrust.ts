// #region folder-trust-setting — docs: docs/ux/scenarios.md#scn-170-set-how-fabric-behaves-in-настройки
/**
 * CO-348: whether Fabric marks a Claude Code session's folder trusted before it starts (`main/claudeTrust.ts`). The
 * person's switch in Settings decides; the environment variable that came first still turns it off on this machine.
 * A settings read that names nothing keeps the default, which is on (the operator, 2026-10-19).
 */
export function trustsAgentFolders(s: { trustAgentFolders?: boolean } | null, env: Readonly<Record<string, string | undefined>>): boolean {
  if (env.FABRIC_TRUST_AGENT_FOLDERS === '0') return false
  return s?.trustAgentFolders !== false
}
// #endregion folder-trust-setting
