// #region spawn-parent — docs: docs/ux/2026-10-26-simple-fabric-v2.md#42-an-agents-goal-and-its-step-r-3-r-4
/**
 * The task a new piece was spawned FROM (iteration 2 of the 0.3.14 review, PL-1, DA-1, DO-2). `fabric_task_create`
 * links what an agent files as `spawned` from its parent, so the home can walk a piece up to the person's request
 * (`main/agentGoals.ts#withGoals`). The parent is the task Fabric launched the session on (`scope.taskId`); a session
 * that joined from its own terminal, enrolled or came through the hub has none, so its parent is the ONE task it holds
 * a live claim on in this project. None, several, or a claims read that failed: no parent, and `why` says so in a line
 * the agent can act on (the answer carries it), never a silent missing link.
 */
export interface LiveClaim { work_id: string; project_id: string | null }

export type SpawnParent =
  | { parent: string; from: 'launch' | 'claim'; why: null }
  | { parent: null; from: null; why: string }

const LINK_IT = 'link it yourself with fabric_task_link {taskId: <this piece>, rel: "spawned", targetTaskId: <the task it came from>}'

export function spawnParentOf(
  launchTask: string | null,
  projectId: string,
  claims: readonly LiveClaim[] | null,
  readError: string | null = null
): SpawnParent {
  if (launchTask) return { parent: launchTask, from: 'launch', why: null }
  if (readError || !claims) return { parent: null, from: null, why: `this session's claims could not be read (${readError ?? 'no answer'}): ${LINK_IT}` }
  const here = [...new Set(claims.filter((c) => c.project_id === projectId && !!c.work_id).map((c) => c.work_id))]
  if (here.length === 1) return { parent: here[0], from: 'claim', why: null }
  if (here.length === 0)
    return { parent: null, from: null, why: `no single claimed task: this session holds no live claim in this project, so nothing links this piece; claim the task it came from first (fabric_work_claim), or ${LINK_IT}` }
  return { parent: null, from: null, why: `no single claimed task: this session holds ${here.length} live claims in this project and Fabric cannot tell which one this piece came from; ${LINK_IT}` }
}
// #endregion spawn-parent
