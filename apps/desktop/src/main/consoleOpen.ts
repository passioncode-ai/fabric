// #region console-open — docs: docs/evidence/plans/2026-11-16-screens-waves.md#s3--launching-sessions-next
/**
 * Opening a console for a project (the screens waves S3, 2026-11-16: moved out of `index.ts`'s `terminal.open`
 * handler, where it was a closure over a dozen of the main process's locals). One path for the person's launch: the
 * folder lock (CO-236), where the agent starts (UXA-C04), the fallback order's walk (ADR-0125) and the first
 * instruction's delivery with the attach claim it holds until then (CO-229, M103).
 */
import type { Walk } from '../shared/runnerRoute.ts'
import { FALLBACK_OPTION } from '../shared/runnerRoute.ts'
import { launchPlace } from '../shared/launchPlace.ts'
import { FOLDER_HELD_SAYS } from './launchFolderLock.ts'
import { openWithFallback } from './runnerFallback.ts'
import type { LaunchRoute } from './pty.ts'

export interface ConsoleOpenDeps<S extends { sessionId: string }> {
  readProject(projectId: string): Promise<{ repo_path: string | null }>
  /** CO-236: whether an unresolved launch may still be writing in the project's folder. */
  folderHeld(projectId: string): boolean
  /** The operator's home folder: where an agent starts when no repository is attached. */
  home(): string
  /** The terminals (`PtyManager`), narrowed to what a launch uses. */
  ptys: {
    open(projectId: string, cwd: string, optionId: string, taskId: string | null, permissionMode: string | null,
      agent?: null, requestedSessionId?: undefined, preset?: undefined, route?: LaunchRoute): Promise<S>
    get(sessionId: string): S | null
    claimAttach(sessionId: string): boolean
    releaseAttach(sessionId: string): void
    deliverWhenReady(sessionId: string, instruction: string): Promise<unknown>
  }
  /** The fallback order's walk for an ad-hoc terminal (`runnerFallback.ts#walk`). */
  walk(projectId: string, permissionMode: string | null, spawnFailed: ReadonlySet<string>, skipSessions: ReadonlySet<string>): Promise<Walk>
  /** ADR-0125 §4: nothing started, so the walk may move on (a spawn that threw, a runner not available). */
  unavailable(error: unknown): boolean
  record(op: 'runner.fallback-exhausted' | 'runner.fallback-attached', detail: Record<string, unknown>): void
  /** A first instruction that was not delivered: logged, never thrown at the person who opened the console. */
  failed(op: string, error: unknown): void
  /** The power blocker follows the running consoles. */
  syncPower(): void
}

export function createConsoleOpen<S extends { sessionId: string }>(deps: ConsoleOpenDeps<S>) {
  return async (projectId: string, optionId: string, firstInstruction?: string, permissionMode?: string | null): Promise<S> => {
    const project = await deps.readProject(projectId)
    // CO-236: no second coding agent in a folder an unresolved launch may still be writing in (a plain shell is no agent).
    if (optionId !== 'shell' && deps.folderHeld(projectId)) throw new Error(FOLDER_HELD_SAYS)
    // ONE RULE, and the surface reads the same one (UXA-C04): with no repository attached the agent starts in the
    // operator's own home folder, with write tools, and the launcher says so.
    const place = launchPlace(project.repo_path)
    const cwd = place.place === 'repository' ? place.path : deps.home()
    const mode = permissionMode ?? null
    // CO-229: the held session this launch attached to is claimed until its first instruction is delivered.
    let claimed: string | null = null
    const session = optionId === FALLBACK_OPTION
      ? await openWithFallback({
          walk: (failed, skip) => deps.walk(projectId, mode, failed, skip),
          open: (runner, route) => deps.ptys.open(projectId, cwd, runner, null, mode, null, undefined, undefined, route),
          get: (sessionId) => deps.ptys.get(sessionId),
          claim: (sessionId) => { const ok = deps.ptys.claimAttach(sessionId); if (ok) claimed = sessionId; return ok },
          unavailable: deps.unavailable,
          record: deps.record
        })
      : await deps.ptys.open(projectId, cwd, optionId, null, mode)
    deps.syncPower()
    const release = (): void => { if (claimed) deps.ptys.releaseAttach(claimed) }
    if (firstInstruction?.trim()) {
      // The same delivery as the task path, and it must be: two ways of handing an agent its first instruction is two
      // behaviours to keep matched (M103). The claim ends when the instruction is written or refused.
      void deps.ptys.deliverWhenReady(session.sessionId, firstInstruction.trim()).finally(release)
        .catch((e) => deps.failed('terminal.first-instruction', e))
    } else release()
    return session
  }
}
// #endregion console-open
