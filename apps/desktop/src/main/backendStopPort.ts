/**
 * The owned backend as a process port for the native Stop runtime (first-slice plan B3-2, ADR-0081,
 * ADR-0073). It has the PTY port's shape — `get`, `list`, `haltInput`, `signalProcess`,
 * `observeProcess`, `ensureClosedReceipt` — over the owned backend registry, and it writes the two
 * receipts migration 67 reads:
 *
 * - `backend.opened@1` once the registry owns the process: owner, channel epoch, the registry's own
 *   process reference, and the host identity the Stop runtime shares with the registry;
 * - `backend.exited@1` once the root's exit is observed, with the exit code, a numeric signal and the
 *   process group as observed — `quiescent` or `unknown`. A later, different observation writes a
 *   new receipt; the same one is never written twice.
 *
 * Two fence levels: `haltInput` closes `inputAllowed` (turns, deliveries) at once, while
 * `commandAllowed` stays open for the Stop commands themselves until the owner is gone.
 *
 * A sent signal is not an exit, and no receipt here claims more than the registry observed.
 */
import { constants } from 'node:os'
import type { Journal } from '@fabric/journal'
import type { NativeProcessObservation, NativeStopSession } from './nativeStopRuntime.ts'
import type { OwnedBackendHandle, createOwnedBackendProcessRegistry } from './ownedBackendProcessRegistry.ts'
import { ops } from './opsSink.ts'

type Registry = Pick<ReturnType<typeof createOwnedBackendProcessRegistry>, 'snapshot' | 'inspect' | 'signalOwned'>
export interface BackendStopSessionInput { sessionId: string; optionId: string; startedAt: string; projectId: string | null; handle: OwnedBackendHandle }
interface Entry extends BackendStopSessionInput { inputOpen: boolean; opened: boolean; openedPending?: Promise<boolean>; exitedGroup: 'quiescent' | 'unknown' | null; exitPending?: Promise<boolean> }
export interface BackendStopPortDeps {
  registry: Registry
  journal: Pick<Journal, 'append'>
  estateId: string
  actor(): { kind: 'person' | 'system'; id: string }
  /** The identity the Stop runtime reports; the registry must have been built with the same one. */
  host: { hostInstanceId: string; bootId: string }
}

const signalNumber = (name: string | null): number | null =>
  name && Object.hasOwn(constants.signals, name) ? (constants.signals as Record<string, number>)[name] : null

export function createBackendStopPort(deps: BackendStopPortDeps) {
  const sessions = new Map<string, Entry>()
  const identity = (e: Entry) => {
    const s = deps.registry.snapshot(e.handle)
    if (!s.processIdentityRef) return null
    return { session_id: e.sessionId, owner_id: e.handle.ownerId, channel_epoch: e.handle.channelEpoch, process_ref: s.processIdentityRef,
      host_instance_id: s.host.hostInstanceId, boot_id: s.host.bootId }
  }
  const append = (e: Entry, type: 'backend.opened@1' | 'backend.exited@1', payload: Record<string, unknown>) =>
    deps.journal.append({ estateId: deps.estateId, type, actor: deps.actor(), ...(e.projectId ? { projectId: e.projectId } : {}), payload })
  const entry = (sessionId: string) => sessions.get(sessionId) ?? null
  const owned = (e: Entry) => { try { return deps.registry.snapshot(e.handle).physicalState === 'owned' } catch { /* A foreign or retired handle owns nothing. */ return false } }

  function recordOpened(sessionId: string): Promise<boolean> {
    const e = entry(sessionId); if (!e) return Promise.resolve(false)
    if (e.opened) return Promise.resolve(true)
    if (e.openedPending) return e.openedPending
    e.openedPending = (async () => {
      const id = identity(e); if (!id) return false
      try { await append(e, 'backend.opened@1', id); e.opened = true; return true }
      catch { ops.failed('backend.journal-opened-failed', new Error('Backend open receipt remains unavailable'), { sessionId }); return false }
      finally { e.openedPending = undefined }
    })()
    return e.openedPending
  }

  return {
    /** After the registry owns the process. A registry built with another host identity is refused:
     * its process references would never match what the Stop runtime reports. */
    register(input: BackendStopSessionInput): void {
      const s = deps.registry.snapshot(input.handle)
      if (s.host.hostInstanceId !== deps.host.hostInstanceId || s.host.bootId !== deps.host.bootId) throw Error('backend_host_identity_mismatch')
      if (sessions.has(input.sessionId)) throw Error('backend_session_registered')
      sessions.set(input.sessionId, { ...input, inputOpen: true, opened: false, exitedGroup: null })
    },
    /** `backend.opened@1`, once. False when the identity is unreadable or the append failed; a later call retries. */
    recordOpened,
    /** The session a registry handle belongs to, for the registry's exit hook. */
    sessionOf(handle: OwnedBackendHandle): string | null { for (const e of sessions.values()) if (e.handle === handle) return e.sessionId; return null },
    /** Turns and deliveries: closed by `haltInput` at once. */
    inputAllowed(sessionId: string): boolean { const e = entry(sessionId); return !!e && e.inputOpen && owned(e) },
    /** Stop's own commands: open until the owner is gone, whatever `haltInput` did. */
    commandAllowed(sessionId: string): boolean { const e = entry(sessionId); return !!e && owned(e) },
    ptys: {
      get(sessionId: string): NativeStopSession | null { const e = entry(sessionId); return e ? { sessionId: e.sessionId, optionId: e.optionId, startedAt: e.startedAt } : null },
      list(): NativeStopSession[] { return [...sessions.values()].map(e => ({ sessionId: e.sessionId, optionId: e.optionId, startedAt: e.startedAt })) },
      haltInput(sessionId: string): void { const e = entry(sessionId); if (e) e.inputOpen = false },
      async signalProcess(sessionId: string, signal: 'SIGTERM' | 'SIGKILL', stillAllowed: () => boolean): Promise<void> {
        const e = entry(sessionId); if (!e) return
        const r = await deps.registry.signalOwned(e.handle, signal, stillAllowed)
        if (!r.sent) throw Error('backend_signal_not_sent')
      },
      async observeProcess(sessionId: string): Promise<NativeProcessObservation | null> {
        const e = entry(sessionId); if (!e) return null
        const s = await deps.registry.inspect(e.handle)
        return { rootExited: s.rootExitObserved, processTreeQuiescent: s.processGroup === 'quiescent', processIdentity: null,
          ...(s.processIdentityRef ? { processIdentityRef: s.processIdentityRef } : {}), exitCode: s.exitCode, exitSignal: signalNumber(s.exitSignal) }
      },
      /** `backend.exited@1` for the observation as it is now; true once one for this group state exists. */
      ensureClosedReceipt(sessionId: string): Promise<boolean> {
        const e = entry(sessionId); if (!e) return Promise.resolve(false)
        if (e.exitPending) return e.exitPending
        e.exitPending = (async () => {
          try {
            // Without its open receipt the session is not a backend session to SQL: retry that first.
            if (!e.opened && !await recordOpened(sessionId)) return false
            const s = await deps.registry.inspect(e.handle)
            if (!s.rootExitObserved) return false
            const group = s.processGroup === 'quiescent' ? 'quiescent' : 'unknown'
            if (e.exitedGroup === group) return true
            const id = identity(e); if (!id) return false
            await append(e, 'backend.exited@1', { ...id, exit_code: s.exitCode, exit_signal: signalNumber(s.exitSignal), process_group: group })
            e.exitedGroup = group
            return true
          } catch { ops.failed('backend.journal-exited-failed', new Error('Backend exit receipt remains unavailable'), { sessionId }); return false }
          finally { e.exitPending = undefined }
        })()
        return e.exitPending
      },
    },
  }
}
