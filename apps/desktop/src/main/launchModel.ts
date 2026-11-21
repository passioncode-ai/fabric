// #region launch-model — docs: docs/evidence/plans/2026-11-21-ceo-voice-missing-tools.md#progress
/**
 * The model and effort a caller asks a console to start on (CO-622 item 1: the CEO typed `/model …` into a console as
 * text, and one session ran on another model than asked). Carried from the caller to the spawn like the launch's origin
 * (`launchOrigin.ts`): the caller runs its launch inside `withLaunchModel`, and `PtyManager.open` adds the flags for the
 * runner it actually starts (the fallback walk may start another one), through `modelArgs`. A runner with no such flag
 * gets none, and the caller is told it was not applied.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORTS)[number]
export interface LaunchModel { model?: string; effort?: Effort }

/** A model name as the runners take it (`claude-fable-5-2`, `opus`, `gpt-5.1-codex`, `openai/gpt-5`): no spaces, no shell. */
export const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/[\]-]{0,99}$/

const store = new AsyncLocalStorage<LaunchModel>()

export function withLaunchModel<T>(choice: LaunchModel, run: () => Promise<T>): Promise<T> {
  return store.run(choice, run)
}

export function currentLaunchModel(): LaunchModel | null {
  const c = store.getStore()
  return c && (c.model || c.effort) ? c : null
}

/** Codex's reasoning effort has no xhigh or max: the nearest it has. */
const CODEX_EFFORT: Record<Effort, string> = { low: 'low', medium: 'medium', high: 'high', xhigh: 'high', max: 'high' }

/** The flags that start `runner` on the choice, and what of it could not be applied. */
export function modelArgs(runner: string, choice: LaunchModel | null): { args: string[]; unapplied: Array<'model' | 'effort'> } {
  if (!choice) return { args: [], unapplied: [] }
  const model = choice.model && MODEL_NAME.test(choice.model) ? choice.model : undefined
  const bad: Array<'model' | 'effort'> = choice.model && !model ? ['model'] : []
  if (runner === 'claude-code') {
    return { args: [...(model ? ['--model', model] : []), ...(choice.effort ? ['--effort', choice.effort] : [])], unapplied: bad }
  }
  if (runner === 'codex') {
    return { args: [...(model ? ['-m', model] : []), ...(choice.effort ? ['-c', `model_reasoning_effort="${CODEX_EFFORT[choice.effort]}"`] : [])], unapplied: bad }
  }
  return { args: [], unapplied: [...(choice.model ? ['model' as const] : []), ...(choice.effort ? ['effort' as const] : [])] }
}
// #endregion launch-model
