// #region builder-choice — docs: docs/ux/scenarios.md#scn-136-create-an-ecosystem-agent
// Which coding agent builds or adapts an agent by default (0.3.3 onboarding, decision D3): the first one in the
// operator's fallback order that is installed and answers (ADR-0125), else the first installed one Fabric's
// tools reach, else the first installed one at all. None installed is null — the screen says so, never guesses.
import type { ExecutorRow } from './startPaths.ts'
import type { FallbackEntry, RunnerFallback } from './runnerRoute.ts'

export function defaultBuilder(executors: readonly ExecutorRow[], fallback: RunnerFallback | null | undefined): string | null {
  const found = executors.filter((e) => e.state === 'found')
  for (const entry of fallback?.order ?? []) if (found.some((e) => e.id === entry.runner)) return entry.runner
  return found.find((e) => e.connected)?.id ?? found[0]?.id ?? null
}

/**
 * A project's default coding agent when the one it holds is not on this Mac (REQ-40): the first installed one in the
 * fallback order, else the first installed one listed. `current` is kept when it is installed; null when none is.
 */
export function installedDefault(
  options: readonly { id: string; program: string | null; available: boolean }[],
  fallback: RunnerFallback | null | undefined,
  current: string
): string | null {
  const installed = options.filter((o) => o.program !== null && o.available)
  if (installed.some((o) => o.id === current)) return current
  for (const entry of fallback?.order ?? []) if (installed.some((o) => o.id === entry.runner)) return entry.runner
  return installed[0]?.id ?? null
}

/** Only an installed coding agent that answered `--version` can be picked; the others say why (REQ-40). */
export function mayPick(executor: ExecutorRow): boolean {
  return executor.state === 'found'
}

/**
 * The fallback order with `runner` at its head: the coding agent picked in the first run (REQ-40). The other
 * entries keep their place and how each may serve; the picked one keeps its own if it was already listed.
 */
export function withHead(fallback: RunnerFallback | null | undefined, runner: string): FallbackEntry[] {
  const order = fallback?.order ?? []
  const own = order.find((e) => e.runner === runner)
  return [own ?? { runner, session: 'spawn' }, ...order.filter((e) => e.runner !== runner)]
}
// #endregion builder-choice

/**
 * Which runners a picker lists (ADR-0168): every runner Fabric connects to its surface, installed or not (a missing
 * one is shown disabled with the reason), and a catalogue console only when this machine has it; two dozen consoles
 * nobody installed would bury the few that are.
 */
export function listedRunner(option: { connectsToSurface: boolean; program: string | null; available: boolean }): boolean {
  return option.connectsToSurface || option.program === null || option.available
}
