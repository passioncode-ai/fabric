// #region machine-agents — docs: docs/evidence/specs/2026-11-06-session-coordination.md#6-the-agents-of-this-machine-told-to-every-session
/**
 * The agents and services installed on this machine, as every session reads them in `fabric_whoami` (the operator,
 * 2026-11-07: agents do not see each other; each should learn from Fabric which agents this Mac has, so it calls the
 * one that owns a job instead of doing it itself).
 *
 * The source is the registry Fabric already reads (`main/agentRegistry.ts`): one descriptor per service and provider
 * in Fabric's services folder, the same files Fabric Dashboards lists. What a session gets is what the descriptor
 * says of itself: its key, name, one-line summary, kind and placement, and where a remote one answers. Nothing is
 * probed or started here, and a descriptor the registry refused is counted, never listed as if it worked.
 */
/** The registry entry's fields this reads (`main/agentRegistry.ts#RegistryEntry`), so the shared side imports no main module. */
export interface RegistryEntryLike {
  key: string
  kind: 'service' | 'provider'
  name: string
  summary: string | null
  placement: 'local' | 'remote'
  origin: string | null
}

/** A list a session can read whole: past this the rest is counted. */
export const MACHINE_AGENTS_LIMIT = 100
const SUMMARY_CHARS = 160

export interface MachineAgent {
  key: string
  name: string
  /** The descriptor's own one line; null when it wrote none. */
  what: string | null
  kind: 'service' | 'provider'
  placement: 'local' | 'remote'
  /** A remote service's origin; null for a local one (its port is its descriptor's, reached through its MCP). */
  origin: string | null
}

export interface MachineAgents {
  agents: MachineAgent[]
  /** Entries past `MACHINE_AGENTS_LIMIT`. */
  more: number
  /** Descriptors the registry could not take (unreadable, invalid, colliding), counted. */
  refused: number
}

export function machineAgentsOf(snapshot: { entries: readonly RegistryEntryLike[]; problems: readonly unknown[] }): MachineAgents {
  const sorted = [...snapshot.entries].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key))
  const agents = sorted.slice(0, MACHINE_AGENTS_LIMIT).map((e): MachineAgent => {
    const what = e.summary?.trim() ? e.summary.trim() : null
    return {
      key: e.key,
      name: e.name,
      what: what && what.length > SUMMARY_CHARS ? `${what.slice(0, SUMMARY_CHARS - 1)}…` : what,
      kind: e.kind,
      placement: e.placement,
      origin: e.placement === 'remote' ? e.origin : null
    }
  })
  return { agents, more: Math.max(0, sorted.length - agents.length), refused: snapshot.problems.length }
}
// #endregion machine-agents
