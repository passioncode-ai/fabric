// #region task-retry — docs: docs/ux/scenarios.md#scn-136-create-an-ecosystem-agent
// A caller-chosen task id makes a retry the SAME task (0.3.3 onboarding, verifier finding). The onboarding's
// «Create and open the console» and «Start the adaptation» name the task before the first try; when that try
// recorded the task and then failed to launch, the next one starts the recorded task again through admission —
// the path `startExisting` takes — instead of leaving one more backlog task per retry.

import { describeAgent } from '../shared/agents.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface RetryTaskRow { id: string; project_id: string; status?: string | null }
export type TaskStartPlan<T extends RetryTaskRow> =
  | { kind: 'new'; taskId: string | undefined }
  | { kind: 'again'; task: T }
  | { kind: 'running'; task: T; sessionId: string }

/** Decide whether `tasks.start` records a new task or starts the one this id already names. Refusals are codes. */
export async function planTaskStart<T extends RetryTaskRow>(
  input: { projectId: string; taskId?: unknown },
  readTask: (id: string) => Promise<{ data: T | null; error: { message: string } | null }>,
  /** The live session this process holds for the task, if any. */
  liveSession: (taskId: string) => string | null = () => null
): Promise<TaskStartPlan<T>> {
  if (input.taskId === undefined) return { kind: 'new', taskId: undefined }
  if (typeof input.taskId !== 'string' || !UUID.test(input.taskId)) throw new Error('task-refused:not-an-id')
  const { data, error } = await readTask(input.taskId)
  // A failed read is not "no such task": treating it so would record a second task under the same id.
  if (error) throw new Error('task-refused:read-failed: ' + error.message)
  if (!data) return { kind: 'new', taskId: input.taskId }
  if (data.project_id !== input.projectId) throw new Error('task-refused:other-project')
  // A first try that started the session and then failed to answer (the task read back after the launch) left
  // the session running: the retry brings THAT one forward rather than being refused as already running.
  // Only a task its receiver acknowledged is running: a launch that spawned and then failed (bind or liveness not
  // confirmed) keeps a tracked process while the task stays in backlog, and must start again (iteration 2, ER-2).
  const live = data.status === 'running' ? liveSession(data.id) : null
  if (live) return { kind: 'running', task: data, sessionId: live }
  return { kind: 'again', task: data }
}
/** The newest session this process tracks for the task that is still RUNNING. A tracked session whose process has
 *  ended is not one to bring forward: the retry must start the task again (0.3.3 verification DA-1). */
export function liveSessionOf(tracked: Iterable<[string, string]>, isRunning: (sessionId: string) => boolean, taskId: string): string | null {
  let found: string | null = null
  for (const [sessionId, task] of tracked) if (task === taskId && isRunning(sessionId)) found = sessionId
  return found
}
/** Run work for one key at a time: two `tasks.start` calls naming the same new task id (two windows, a double
 *  press) are serialised, so the second plans after the first has recorded the task and reuses it instead of
 *  journalling a second `task.created@1` for it (0.3.3 verification DA-8). Different keys do not wait. */
export function createKeyedQueue(): <T>(key: string, work: () => Promise<T>) => Promise<T> {
  const tails = new Map<string, Promise<unknown>>()
  return <T>(key: string, work: () => Promise<T>): Promise<T> => {
    const before = tails.get(key) ?? Promise.resolve()
    const run = before.then(work, work)
    const tail = run.then(() => undefined, () => undefined)
    tails.set(key, tail)
    void tail.then(() => { if (tails.get(key) === tail) tails.delete(key) })
    return run
  }
}
/** The setup preset records through Fabric's tools (memory, questions, tasks): a runner that does not connect to the
 *  surface could record nothing, so main refuses it whatever the window chose (0.3.3 verification, iteration 2). */
export function refuseSetupWithoutSurface(runner: string, surfaceUp = true): void {
  if (!describeAgent(runner)?.connectsToSurface) throw new Error('task-refused:setup-needs-surface')
  // A runner that connects, with Fabric's agent surface not listening, would start with none of the tools either
  // (iteration 3, ER-6/DA-1): said as its own reason, the person can start the surface (Settings → Agent access).
  if (!surfaceUp) throw new Error('task-refused:setup-surface-down')
}
// #endregion task-retry
