// #region runner-fallback-main — docs: docs/adr/0125-an-agent-launch-may-follow-the-operators-fallback-order.md#decision
/**
 * The machine side of the fallback walk (ADR-0125). `shared/runnerRoute.ts` decides; this measures:
 * which runners are installed and answer (first-run detection, `executorDetect.ts`), which are signed in
 * where the runner can say (`executorAuth.ts`), whether the surface is up, and which idle session of a
 * runner this project already holds under the mode the launch would apply. Measurements are cached for
 * a short time, and concurrent walks share one measurement, so the picker's preview and the launch that
 * follows it read the same machine.
 */
import { AGENTS } from '../shared/agents.ts'
import { walkFallback, type FallbackEntry, type Launch, type RunnerProbe, type Walk } from '../shared/runnerRoute.ts'
import type { ExecutorRow } from '../shared/startPaths.ts'
import type { LaunchRoute } from './pty.ts'

export interface RunnerFallbackDeps {
  /** The order as the settings file holds it now. */
  order: () => readonly FallbackEntry[]
  /** First-run detection for these runners (`detectExecutors` with the session environment). */
  detect: (runners: readonly { id: string; label: string; program: string; connected: boolean }[]) => Promise<ExecutorRow[]>
  /** Whether Fabric's agent surface is listening (`AgentSurface.endpoint !== ''`). */
  surfaceUp: () => boolean
  /** An idle session of this runner in this project, as the runner itself and under `mode`, that no task
   *  holds and `skip` does not name (`PtyManager.attachable`). */
  attachable: (projectId: string, runner: string, mode: string | null, skip: ReadonlySet<string>) => string | null
  now?: () => number
}

/** How long one measurement of the machine is reused: long enough for a preview and its launch. */
const FRESH_MS = 30_000

export function createRunnerFallback(deps: RunnerFallbackDeps) {
  const now = deps.now ?? Date.now
  let cached: { at: number; key: string; rows: Promise<Map<string, ExecutorRow>> } | null = null

  function measure(order: readonly FallbackEntry[]): Promise<Map<string, ExecutorRow>> {
    const runners = order.flatMap((entry) => {
      const agent = AGENTS.find((a) => a.id === entry.runner)
      return agent && agent.program ? [{ id: agent.id, label: agent.label, program: agent.program, connected: agent.connectsToSurface }] : []
    })
    const key = runners.map((r) => r.id).join(',')
    if (cached && cached.key === key && now() - cached.at < FRESH_MS) return cached.rows
    // The promise is cached, not its answer: two panels mounting at once share one detection.
    const rows = deps.detect(runners).then((found) => new Map(found.map((row) => [row.id, row])))
    cached = { at: now(), key, rows }
    rows.catch(() => { if (cached?.rows === rows) cached = null })
    return rows
  }

  /** Walk the order for one launch in one project. `spawnFailed` carries runners whose spawn threw;
   *  `skipSessions` carries held sessions an earlier step of this launch could not use. */
  async function walk(projectId: string, launch: Launch, spawnFailed: ReadonlySet<string> = new Set(), skipSessions: ReadonlySet<string> = new Set()): Promise<Walk> {
    const order = deps.order()
    const rows = await measure(order)
    const surfaceUp = deps.surfaceUp()
    const probe = (runner: string, mode: string | null): RunnerProbe => {
      const row = rows.get(runner)
      const auth = row?.authentication?.state
      return {
        install: row?.state ?? 'missing',
        // Signed out only when the runner's own check says so; an unsupported or inconclusive check is
        // judged by the version answer, as for a runner without one (contract DEC-0029).
        signedIn: auth === 'authenticated' ? 'yes' : auth === 'not-authenticated' ? 'no' : 'unknown',
        surfaceUp,
        heldSession: launch.kind === 'terminal' ? deps.attachable(projectId, runner, mode, skipSessions) : null
      }
    }
    return walkFallback(order, launch, probe, spawnFailed)
  }

  return {
    walk,
    /** The order is in use at all: the pickers offer the fallback choice only then. */
    configured: () => deps.order().length > 0,
    /** Forget the measurement: the next walk measures the machine again. */
    invalidate: () => { cached = null }
  }
}

/** What `terminal.opened@1` records of a walk that spawned (ADR-0125 §6; probe results as the contract's event names them). */
export function launchRoute(walk: Extract<Walk, { state: 'selected' }>): LaunchRoute {
  return {
    basis: 'host-order',
    requested: 'fallback-order',
    selected_index: walk.index,
    session: 'spawned',
    probes: walk.passedOver.map((p) => ({ index: p.index, runner: p.runner, result: p.result, ...(p.detail ? { detail: p.detail } : {}) }))
  }
}

export interface OpenWithFallbackDeps<S> {
  walk: (spawnFailed: ReadonlySet<string>, skipSessions: ReadonlySet<string>) => Promise<Walk>
  /** Open the selected runner; throws as `PtyManager.open` does. */
  open: (runner: string, route: LaunchRoute) => Promise<S>
  /** The held session the walk chose, or null when it is gone. */
  get: (sessionId: string) => S | null
  /** "Candidate unavailable": the runner could not serve and nothing started (ADR-0125 §4). */
  unavailable: (error: unknown) => boolean
  record?: (op: 'runner.fallback-exhausted' | 'runner.fallback-attached', detail: Record<string, unknown>) => void
}

/**
 * The ad-hoc terminal's fallback launch (ADR-0125 §3–4): attach where the order and the held session
 * allow it, otherwise spawn the first runner that can serve. A refusal that started nothing — the
 * runner is not available, its surface is down, its spawn threw — moves the walk on; any other failure
 * (the launch's authority changed, a process may be alive) stops it. Every pass adds a runner or a
 * session to what the next walk excludes, so the loop ends.
 */
export async function openWithFallback<S>(deps: OpenWithFallbackDeps<S>): Promise<S> {
  const failed = new Set<string>()
  const skip = new Set<string>()
  for (;;) {
    const walk = await deps.walk(failed, skip)
    if (walk.state === 'exhausted') {
      deps.record?.('runner.fallback-exhausted', { passed_over: walk.passedOver.map((p) => `${p.runner}:${p.result}`) })
      throw new Error(describeExhausted(walk))
    }
    if (walk.session === 'attached' && walk.sessionId) {
      const held = deps.get(walk.sessionId)
      if (held) {
        deps.record?.('runner.fallback-attached', { runner: walk.runner, session_id: walk.sessionId })
        return held
      }
      skip.add(walk.sessionId)
      continue
    }
    try {
      return await deps.open(walk.runner, launchRoute(walk))
    } catch (error) {
      if (!deps.unavailable(error)) throw error
      failed.add(walk.runner)
    }
  }
}

/** One sentence per passed-over runner, for the person who asked for a session and got none. */
export function describeExhausted(walk: Extract<Walk, { state: 'exhausted' }>): string {
  if (walk.passedOver.length === 0) return 'The fallback order is empty, so no agent was started. Add coding agents to it in Settings → Fallback order.'
  const words: Record<string, string> = {
    'not-catalogued': 'is not an agent this version of Fabric knows',
    'not-installed': 'is not installed on this computer',
    'not-responding': 'did not answer its version check',
    'not-connected': 'is signed out',
    'no-held-session': 'has no open session in this project, and is set to use an open session only',
    refused: 'cannot run this launch',
    'spawn-failed': 'could not be started'
  }
  const lines = walk.passedOver.map((p) => {
    const label = AGENTS.find((a) => a.id === p.runner)?.label ?? p.runner
    return `${label} ${words[p.result] ?? p.result}${p.detail ? ` (${p.detail})` : ''}.`
  })
  return `No agent in the fallback order could start: ${lines.join(' ')}`
}
// #endregion runner-fallback-main
