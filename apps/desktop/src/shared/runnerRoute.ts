// #region runner-fallback — docs: docs/adr/0125-an-agent-launch-may-follow-the-operators-fallback-order.md#decision
/**
 * The operator's fallback order, walked at a launch (ADR-0125; contract DEC-0026 as refined by DEC-0029).
 *
 * PURE. The walk decides; the main process measures. Every fact about the machine — is the runner
 * installed, does it answer, is it signed in, is the surface up, is there a session to attach — arrives
 * through `probe`, so this function can be tested without a machine and the main process cannot quietly
 * decide differently from what the picker previewed.
 *
 * NOT A ROUTE. The contract's runner route is a project-pinned revision; this order is an installation
 * setting, and what is recorded of it names the basis `host-order`, never a route revision (DEC-0029).
 * The probe results and their order are the contract's, so the record reads the same either way.
 */
import { AGENTS, containmentFor, describeAgent, mayLaunch } from './agents.ts'
import type { Containment } from './containment.ts'

/** The launch choice that walks the order instead of naming one runner. Never stored on a task. */
export const FALLBACK_OPTION = 'fallback-order'

/** What a picker shows for the fallback choice: whether the order is set, and what it resolves to now. */
export interface FallbackPreview { configured: boolean; walk: Walk | null }

/** How one entry of the order may serve: a new session, an open one first, or an open one only. */
export type FallbackSession = 'spawn' | 'attach-or-spawn' | 'attach-only'
export interface FallbackEntry { runner: string; session: FallbackSession }
export interface RunnerFallback { order: FallbackEntry[] }

/** The contract's closed probe results (runner-route-event.schema.json), the subset a host order can produce. */
export type ProbeResult = 'not-catalogued' | 'not-installed' | 'not-responding' | 'not-connected' | 'no-held-session' | 'refused' | 'spawn-failed'
export interface PassedOver { index: number; runner: string; result: ProbeResult; detail?: string }

/** What the main process measured about one runner, asked only when the walk reaches it. */
export interface RunnerProbe {
  /** found / missing / unresponsive, as first-run detection reports them (`executorDetect.ts`). */
  install: 'found' | 'missing' | 'unresponsive'
  /** Signed in where the runner can say; `unknown` is judged by the version answer alone (DEC-0029). */
  signedIn: 'yes' | 'no' | 'unknown'
  /** For `acp-session` and `config-content-env` runners: whether Fabric's surface is up to start them. */
  surfaceUp: boolean
  /** An idle session of this runner in this project that no task holds, running under exactly the mode
   *  this launch would apply and as the runner itself (not a created agent), or null. */
  heldSession: string | null
}

export interface Launch {
  /** The permission mode the person chose for this launch, or null for each runner's default. */
  permissionMode: string | null
  /** A managed task (it reports on a result channel and was admitted with a new session id) or an ad-hoc terminal. */
  kind: 'terminal' | 'task'
  /** The task records through Fabric's tools (the setup preset): a runner that does not connect to the surface is
   *  passed over, never chosen (0.3.3 verification, iteration 2, UX-2/ER-5/DA-1). */
  needsSurface?: boolean
}

export type Walk =
  | { state: 'selected'; index: number; runner: string; session: 'spawned' | 'attached'; sessionId: string | null; permissionMode: string | null; passedOver: PassedOver[] }
  | { state: 'exhausted'; passedOver: PassedOver[] }

const STRENGTH: Record<Containment, number> = { intercepted: 2, 'runner-gated': 1, none: 0 }
const CHANNEL: Record<'surface' | 'packet' | 'none', number> = { surface: 2, packet: 1, none: 0 }

/** The mode a runner actually receives for a launch's chosen mode: null for a runner without modes. */
export function appliedMode(runner: string, permissionMode: string | null): string | null {
  const agent = describeAgent(runner)
  if (!agent || agent.permissionModes.length === 0) return null
  return permissionMode ?? agent.defaultMode
}

/** A runner id as a later build may name it: kept in the order, and reported as not catalogued here. */
const RUNNER_ID = /^[a-z][a-z0-9-]{1,39}$/

/** The order with what cannot be in it removed: the plain shell, a runner twice, a malformed id. A runner
 *  this build does not know stays, so the walk can say so (`not-catalogued`) instead of losing it. */
export function cleanOrder(order: readonly FallbackEntry[]): FallbackEntry[] {
  const seen = new Set<string>()
  const out: FallbackEntry[] = []
  for (const entry of order) {
    const agent = describeAgent(entry.runner)
    if (!RUNNER_ID.test(entry.runner) || (agent && agent.program === null) || seen.has(entry.runner)) continue
    seen.add(entry.runner)
    out.push({ runner: entry.runner, session: entry.session })
  }
  return out
}

/**
 * Walk the order from the top. The first entry sets the bar the others are held to: a fallback never
 * trades a gate for none, and a task never goes to a runner with a weaker result channel. `spawnFailed`
 * lets the caller pass a candidate over after its spawn threw, without starting the walk again.
 */
export function walkFallback(
  order: readonly FallbackEntry[],
  launch: Launch,
  /** Measures one runner; `mode` is the mode this launch would apply to it, which an attached session must match. */
  probe: (runner: string, mode: string | null) => RunnerProbe,
  spawnFailed: ReadonlySet<string> = new Set()
): Walk {
  const passedOver: PassedOver[] = []
  const entries = cleanOrder(order)
  const first = entries.map((entry) => describeAgent(entry.runner)).find((agent) => agent !== null) ?? null
  const bar = first
    ? { containment: STRENGTH[containmentFor(first.id, launch.permissionMode)], channel: CHANNEL[first.resultChannel] }
    : null
  for (const [index, entry] of entries.entries()) {
    const agent = describeAgent(entry.runner)
    const pass = (result: ProbeResult, detail?: string) => passedOver.push({ index, runner: entry.runner, result, ...(detail ? { detail } : {}) })
    if (!agent || !bar) { pass('not-catalogued'); continue }
    // The person's mode, as this runner would receive it: a runner that has no mode of that name is
    // refused, and a runner without modes receives none — the containment bar below then decides.
    const verdict = mayLaunch(agent.id, launch.permissionMode)
    if (!verdict.ok) { pass('refused', verdict.reason); continue }
    if (STRENGTH[containmentFor(agent.id, launch.permissionMode)] < bar.containment) {
      pass('refused', `${agent.label} would run with less containment than the first choice under this mode`)
      continue
    }
    if (launch.needsSurface && !agent.connectsToSurface) {
      pass('refused', `${agent.label} does not connect to Fabric's tools, and this task records through them`)
      continue
    }
    if (launch.kind === 'task' && CHANNEL[agent.resultChannel] < bar.channel) {
      pass('refused', `${agent.label} cannot return a task's result the way the first choice would`)
      continue
    }
    const mode = appliedMode(agent.id, launch.permissionMode)
    const measured = probe(agent.id, mode)
    if (measured.install === 'missing') { pass('not-installed'); continue }
    if (measured.install === 'unresponsive') { pass('not-responding'); continue }
    if (measured.signedIn === 'no') { pass('not-connected', `${agent.label} is signed out`); continue }
    // `not-connected` is the sign-in check's answer only (contract DEC-0029); a surface that is down is
    // a reason this launch cannot run the runner.
    if ((agent.surfaceAdapter === 'acp-session' || agent.surfaceAdapter === 'config-content-env') && agent.connectsToSurface && !measured.surfaceUp) {
      pass('refused', `Fabric's agent surface is not running, and ${agent.label} is connected through it`)
      continue
    }
    if (launch.kind === 'task' && entry.session === 'attach-only') {
      pass('refused', 'a task starts its own session, and this entry uses an open session only')
      continue
    }
    const mayAttach = launch.kind === 'terminal' && entry.session !== 'spawn'
    if (mayAttach && measured.heldSession) {
      return { state: 'selected', index, runner: agent.id, session: 'attached', sessionId: measured.heldSession, permissionMode: mode, passedOver }
    }
    if (entry.session === 'attach-only') { pass('no-held-session'); continue }
    if (spawnFailed.has(agent.id)) { pass('spawn-failed'); continue }
    return { state: 'selected', index, runner: agent.id, session: 'spawned', sessionId: null, permissionMode: mode, passedOver }
  }
  return { state: 'exhausted', passedOver }
}

/** Whether a runner may stand in the order at all — the Settings page lists exactly these. */
export const FALLBACK_RUNNERS: readonly string[] = AGENTS.filter((agent) => agent.program !== null).map((agent) => agent.id)
// #endregion runner-fallback
