// #region builder-choice — docs: docs/ux/scenarios.md#scn-136-create-an-ecosystem-agent
// Which coding agent builds or adapts an agent by default (0.3.3 onboarding, decision D3): the first one in the
// operator's fallback order that is installed and answers (ADR-0125), else the first installed one Fabric's
// tools reach, else the first installed one at all. None installed is null — the screen says so, never guesses.
import type { ExecutorRow } from './startPaths.ts'
import type { RunnerFallback } from './runnerRoute.ts'

export function defaultBuilder(executors: readonly ExecutorRow[], fallback: RunnerFallback | null | undefined): string | null {
  const found = executors.filter((e) => e.state === 'found')
  for (const entry of fallback?.order ?? []) if (found.some((e) => e.id === entry.runner)) return entry.runner
  return found.find((e) => e.connected)?.id ?? found[0]?.id ?? null
}
// #endregion builder-choice
