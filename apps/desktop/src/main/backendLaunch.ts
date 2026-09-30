/**
 * The launch receipt seam for an owned backend (first-slice plan B1, ADR-0081).
 *
 * `createManagedLaunch` asks for an `open(sessionId, beforeSpawn)`; this answers it with the owned
 * backend process registry, and classifies what the registry returned into the two things a
 * launch may conclude:
 *
 * - `owned` → the session exists, and its handle is kept for `get` and `stop`;
 * - a typed refusal with NO child (not granted, authority, capacity, invalid run) → a clean
 *   "not started" (`LaunchRefusedBeforeSpawn`), even though the attempt's marker file exists and
 *   the registry's own snapshot reads `outcome_unknown` — the RESULT classifies, never a snapshot;
 * - `outcome_unknown`, `run_already_consumed`, `run_identity_conflict` and `run_marker_present`
 *   (a Run an earlier registry reserved) → unknown (`ProcessLaunchFailure`): a child may exist, so
 *   the launch must check its termination before anything starts again.
 *
 * `get` reports running only for an owned child; the registry never returns to `owned`.
 */
import type { AdmissionReceipt } from '../shared/admission.ts'
import { LaunchRefusedBeforeSpawn, ProcessLaunchFailure } from './launchFailure.ts'
import type { BackendLaunchArgs, OwnedBackendHandle, createOwnedBackendProcessRegistry } from './ownedBackendProcessRegistry.ts'

type Registry = Pick<ReturnType<typeof createOwnedBackendProcessRegistry>, 'start' | 'snapshot' | 'signalOwned'>
const UNKNOWN = new Set(['run_already_consumed', 'run_identity_conflict', 'run_marker_present'])

export function createBackendLaunch(registry: Registry) {
  const sessions = new Map<string, OwnedBackendHandle>()
  return {
    /** The `open` a `ManagedLaunchDeps.prepare` returns for this admitted receipt; `launch` carries
     * per-backend arguments such as a token digest (B2b-1), refused before any reservation if malformed. */
    open(receipt: AdmissionReceipt, launch?: BackendLaunchArgs) {
      return async (sessionId: string, beforeSpawn: () => Promise<boolean>): Promise<{ sessionId: string }> => {
        const result = await registry.start(receipt, sessionId, beforeSpawn, launch)
        if (result.state === 'owned') { sessions.set(sessionId, result.handle); return { sessionId } }
        if (result.handle) sessions.set(sessionId, result.handle) // kept for Stop and inspection, never reported running
        if (result.state === 'outcome_unknown' || UNKNOWN.has(result.reasonCode))
          throw new ProcessLaunchFailure(sessionId, result.reasonCode, 'The backend may have started, but its launch did not complete. Its termination must be checked before another launch.')
        throw new LaunchRefusedBeforeSpawn(sessionId, result.reasonCode)
      }
    },
    /** Running only for an owned child. The registry leaves `owned` for good on a root exit, a lost
     * channel or changed authority, so `owned` already means live; nothing else reads as running. */
    get(sessionId: string): { running: boolean } | null {
      const handle = sessions.get(sessionId); if (!handle) return null
      try {
        const s = registry.snapshot(handle)
        return s.physicalState === 'owned' ? { running: true } : null
      } catch { /* Not silence: an unreadable handle is not a running session. */ return null }
    },
    /** Requests the owned child's termination. A sent signal is not an exit and settles nothing; a
     * child whose process group was never captured cannot be signalled and stays unknown. */
    async stop(sessionId: string): Promise<void> {
      const handle = sessions.get(sessionId); if (!handle) return
      await registry.signalOwned(handle, 'SIGTERM', () => sessions.get(sessionId) === handle)
    },
    handle(sessionId: string): OwnedBackendHandle | null { return sessions.get(sessionId) ?? null },
  }
}
