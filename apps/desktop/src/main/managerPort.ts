// #region manager-port — docs: docs/evidence/specs/2026-11-06-fabric-manager-agent.md#3-tools-a-closed-set-each-one-of-fabrics-existing-doors
/**
 * The manager's doors (CO-522 wave D, step 4, its second half): each tool of `managerTools.ts` calls the SAME handler
 * the person's window calls, by its IPC channel, so a door has one implementation and an act lands in the journal
 * exactly as the person's own. `call` is the host's in-process call of a registered handler (index.ts `callDoor`),
 * never a second copy of its logic. A handler that throws is a refusal with its message, never an answer.
 *
 * `ask` is the one door the window does not have: a question to the person from the manager's own conversation. Until
 * the conversation exists (step 5) the host passes none and the tool answers that it is not wired, so the model is
 * told and never believes it asked.
 */
import { IPC } from '../shared/types.ts'
import type { ManagerPort } from './managerTools.ts'

export type DoorCall = (channel: string, ...args: unknown[]) => Promise<unknown>

type Outcome = { ok: boolean; reason?: string }

const refusal = (e: unknown): Outcome => ({ ok: false, reason: e instanceof Error ? e.message.slice(0, 300) : 'the door refused' })

/** A handler's answer as an outcome: `{ok}` answers pass through, anything else is a refusal named by its shape. */
function outcome(r: unknown): Outcome {
  if (r && typeof r === 'object' && typeof (r as { ok?: unknown }).ok === 'boolean') return r as Outcome
  return { ok: false, reason: 'the door answered without ok' }
}

export function createManagerPort(deps: { call: DoorCall; ask?: (text: string, options: string[]) => Promise<{ ok: boolean; reason?: string; questionId?: string }> }): ManagerPort {
  const { call } = deps
  const act = async (channel: string, ...args: unknown[]): Promise<Outcome> => {
    try {
      return outcome(await call(channel, ...args))
    } catch (e) {
      // A handler that throws refused the act (a read it needed failed, or its input was refused): said, not retried.
      return refusal(e)
    }
  }
  return {
    sessions: () => call(IPC.workHome),
    work: (projectId) => call(IPC.workProject, projectId),
    task: (taskId) => call(IPC.tasksDetail, taskId),
    waiting: (projectId, limit) => call(IPC.boardQuery, { projectId, limit, personOnly: true }),
    say: (sessionId, text) => act(IPC.workSay, { sessionId, text }),
    async fileTask(projectId, text) {
      try {
        const row = await call(IPC.tasksFileIdea, projectId, text) as { id?: unknown } | null
        return typeof row?.id === 'string' ? { ok: true, taskId: row.id } : { ok: false, reason: 'the task was not read back' }
      } catch (e) {
        // fileIdea throws on text it refuses and on a failed read-back: either way nothing reached the queue as asked.
        return refusal(e)
      }
    },
    assignAcross: (fromTaskId, toProjectId, text, key) => act(IPC.tasksAssignAcross, { fromTaskId, toProjectId, text, key }),
    decideReview: (taskId, decision, comment) => act(IPC.tasksDecide, taskId, decision, comment),
    decideOverlap: (key, choice) => act(IPC.workOverlapDecide, { key, choice }),
    ask: (text, options) => deps.ask ? deps.ask(text, options) : Promise.resolve({ ok: false, reason: 'asking the person is not wired yet: say the question in your answer instead' })
  }
}
// #endregion manager-port
