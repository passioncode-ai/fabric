// #region task-start — docs: docs/evidence/plans/2026-11-16-screens-waves.md#s3--launching-sessions-next
/**
 * The person's «start a task» (`tasks.start`), moved out of `index.ts` (the screens waves S3, 2026-11-16). The fallback
 * choice is resolved before the task exists, so the task records the runner that runs it (ADR-0125); a setup preset
 * needs a runner that connects to Fabric's surface, with the surface up (0.3.3 verification); a caller-chosen id makes
 * a retry the SAME task, brought forward when it runs or started again through admission (`taskRetry.ts`), and two
 * starts naming one id run one after the other.
 */
import type { Launch, Walk } from '../shared/runnerRoute.ts'
import { FALLBACK_OPTION, presetNeedsSurface } from '../shared/runnerRoute.ts'
import { describeExhausted, launchRoute } from './runnerFallback.ts'
import { planTaskStart, refuseSetupWithoutSurface, type RetryTaskRow } from './taskRetry.ts'
import type { LaunchRoute } from './pty.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface TaskStartInput {
  projectId: string
  instruction: string
  optionId: string
  preset?: string
  presetEdited?: boolean
  permissionMode?: string | null
  taskId?: string
}

export interface TaskStarted<T> { task: T; session: { sessionId: string } }

export interface TaskStartDeps<T extends RetryTaskRow> {
  /** The fallback order's walk for a task (`runnerFallback.ts#walk`). */
  walk(projectId: string, launch: Launch): Promise<Walk>
  /** A created agent's runner (`agent_bindings.provider_ref`); throws when it cannot be read. */
  bindingRunner(bindingId: string): Promise<string>
  /** Whether Fabric's agent surface is listening. */
  surfaceUp(): boolean
  readTask(id: string): Promise<{ data: T | null; error: { message: string } | null }>
  /** The live session this process holds for the task, if any. */
  liveSession(taskId: string): string | null
  /** Admission of an existing task (`managedLaunch.ts`). */
  launchManaged(input: { taskId: string; trigger: 'operator'; permissionMode?: string | null }): Promise<{ started: true; sessionId: string } | { started: false; says: string }>
  /** A new task's start (`index.ts#startTask`). */
  startTask(input: TaskStartInput & { taskId: string | undefined; route: LaunchRoute | null }): Promise<TaskStarted<T>>
  /** Two starts naming one id run one after the other (`taskRetry.ts#createKeyedQueue`). */
  oneAtATime<R>(key: string, work: () => Promise<R>): Promise<R>
}

export function createTaskStart<T extends RetryTaskRow>(deps: TaskStartDeps<T>) {
  return async (input: TaskStartInput): Promise<TaskStarted<T>> => {
    // ADR-0125: the fallback choice is resolved HERE, before the task exists, so the task records the runner that runs
    // it and never the choice. A managed task never attaches: its admission mints a new session.
    let optionId = input.optionId
    let route: LaunchRoute | null = null
    // The setup preset records through Fabric's tools; main holds the line whatever the window chose: a runner by name,
    // a created agent or the fallback order (0.3.3 verification, iteration 2, UX-2/ER-5/DA-1).
    const needsSurface = presetNeedsSurface(input.preset)
    if (optionId === FALLBACK_OPTION) {
      const walk = await deps.walk(input.projectId, { kind: 'task', permissionMode: input.permissionMode ?? null, needsSurface })
      if (walk.state === 'exhausted') throw new Error(describeExhausted(walk))
      optionId = walk.runner
      route = launchRoute(walk)
    }
    if (needsSurface) refuseSetupWithoutSurface(UUID.test(optionId) ? await deps.bindingRunner(optionId) : optionId, deps.surfaceUp())
    const begin = async (): Promise<TaskStarted<T>> => {
      const plan = await planTaskStart<T>(input, deps.readTask, deps.liveSession)
      if (plan.kind === 'running') return { task: plan.task, session: { sessionId: plan.sessionId } }
      if (plan.kind === 'again') {
        const again = await deps.launchManaged({ taskId: plan.task.id, trigger: 'operator', permissionMode: input.permissionMode })
        if (!again.started) throw new Error(again.says)
        return { task: plan.task, session: { sessionId: again.sessionId } }
      }
      return deps.startTask({ ...input, optionId, taskId: plan.taskId, route })
    }
    return typeof input.taskId === 'string' ? deps.oneAtATime(input.taskId, begin) : begin()
  }
}
// #endregion task-start
