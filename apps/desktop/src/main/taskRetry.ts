// #region task-retry — docs: docs/ux/scenarios.md#scn-136-create-an-ecosystem-agent
// A caller-chosen task id makes a retry the SAME task (0.3.3 onboarding, verifier finding). The onboarding's
// «Create and open the console» and «Start the adaptation» name the task before the first try; when that try
// recorded the task and then failed to launch, the next one starts the recorded task again through admission —
// the path `startExisting` takes — instead of leaving one more backlog task per retry.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface RetryTaskRow { id: string; project_id: string }
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
  if (typeof input.taskId !== 'string' || !UUID.test(input.taskId)) throw new Error('task-id-refused: not an id')
  const { data, error } = await readTask(input.taskId)
  // A failed read is not "no such task": treating it so would record a second task under the same id.
  if (error) throw new Error('The task could not be read before starting it: ' + error.message)
  if (!data) return { kind: 'new', taskId: input.taskId }
  if (data.project_id !== input.projectId) throw new Error('task-id-refused: the task belongs to another project')
  // A first try that started the session and then failed to answer (the task read back after the launch) left
  // the session running: the retry brings THAT one forward rather than being refused as already running.
  const live = liveSession(data.id)
  if (live) return { kind: 'running', task: data, sessionId: live }
  return { kind: 'again', task: data }
}
// #endregion task-retry
