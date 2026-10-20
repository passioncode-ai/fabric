// #region act-sessions — docs: docs/ux/scenarios.md#scn-169-undo-an-act-or-read-why-it-cannot-be-undone
/**
 * A console stopped is a console that can be started again where it stood (ADR-0160 §2). Pure over its seams: the
 * real ones (`index.ts`) are the runtime's stop and the launch the person's own «open» uses; a test passes fakes.
 *
 * "Where it stood" is the place and the way it ran: the project, its folder, the runner and the permission mode it
 * had, and the task it carried. The agent's own conversation is the runner's to resume; Fabric does not reach into it.
 */
import type { ActArgs, ActOutcome } from '../shared/acts.ts'
import type { ActCheck, ActExecutor } from './acts.ts'

export interface ConsoleSnapshot { sessionId: string; projectId: string; optionId: string; permissionMode: string | null; cwd: string; label: string }
export interface StopSeen { sessionId: string; state: 'stopped' | 'outcome_unknown' | 'refused'; reasonCode: string; taskId?: string }

/** What to record after an operator's stop, or null when nothing was stopped (a refused or unproven stop is not an act that happened). */
export function sessionStopOutcome(snapshot: ConsoleSnapshot, result: StopSeen, projectName: string | null): ActOutcome | null {
  if (result.state !== 'stopped') return null
  return {
    kind: 'session.stop', projectId: snapshot.projectId,
    subject: { type: 'session', id: snapshot.sessionId, label: snapshot.label },
    // `runner` is the id the renderer words through runnerLabel; `agent` stays for records read by an older build
    // (0.3.7 review UX-6: a shell read «Terminal» in Russian, a created agent its uuid).
    said: { key: 'act.session.stop', params: { agent: snapshot.label, runner: snapshot.optionId, project: projectName } },
    inverse: {
      kind: 'session.start',
      args: { project_id: snapshot.projectId, option_id: snapshot.optionId, permission_mode: snapshot.permissionMode, cwd: snapshot.cwd,
        task_id: result.taskId ?? null, from_session: snapshot.sessionId }
    }
  }
}

export interface SessionExecutorDeps {
  runnerAvailable(optionId: string): Promise<boolean>
  startAgain(args: { project_id: string; option_id: string; permission_mode: string | null; cwd: string | null; task_id: string | null; from_session: string }): Promise<{ sessionId: string; label: string }>
  stop(sessionId: string): Promise<StopSeen>
  snapshot(sessionId: string): ConsoleSnapshot | null
  projectName(projectId: string): Promise<string | null>
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export function createSessionExecutors(deps: SessionExecutorDeps): { 'session.start': ActExecutor; 'session.stop': ActExecutor } {
  return {
    'session.start': {
      async check(args: ActArgs): Promise<ActCheck> {
        const projectId = str(args.project_id), optionId = str(args.option_id)
        if (!projectId || !optionId) return { ok: false, why: 'invalid' }
        if (!(await deps.runnerAvailable(optionId))) return { ok: false, why: 'runner_gone' }
        return { ok: true }
      },
      async run(args: ActArgs): Promise<ActOutcome> {
        const projectId = str(args.project_id)!, optionId = str(args.option_id)!
        const opened = await deps.startAgain({ project_id: projectId, option_id: optionId, permission_mode: str(args.permission_mode),
          cwd: str(args.cwd), task_id: str(args.task_id), from_session: str(args.from_session) ?? '' })
        const project = await deps.projectName(projectId)
        return {
          kind: 'session.start', projectId,
          subject: { type: 'session', id: opened.sessionId, label: opened.label },
          said: { key: 'act.session.start', params: { agent: opened.label, runner: optionId, project: project } },
          inverse: { kind: 'session.stop', args: { session_id: opened.sessionId } }
        }
      }
    },
    'session.stop': {
      async check(args: ActArgs): Promise<ActCheck> {
        const id = str(args.session_id)
        return id && deps.snapshot(id) ? { ok: true } : { ok: false, why: 'session_gone' }
      },
      async run(args: ActArgs): Promise<ActOutcome> {
        const id = str(args.session_id)!
        const snap = deps.snapshot(id)
        if (!snap) throw new Error('the console is no longer here')
        const result = await deps.stop(id)
        const outcome = sessionStopOutcome(snap, result, await deps.projectName(snap.projectId))
        if (!outcome) throw new Error(`the console did not stop (${result.state}: ${result.reasonCode})`)
        return outcome
      }
    }
  }
}
// #endregion act-sessions
