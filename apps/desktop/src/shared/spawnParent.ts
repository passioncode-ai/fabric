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
/**
 * The task a stage report belongs to (the mockup parity, 2026-10-27, agent gaps «Вехи»): the task Fabric launched the
 * session on, else the ONE task the session holds a live claim on in this project, by the same rule as `spawnParentOf`.
 * None, several, or a claims read that failed: null, and the report is still recorded, unnamed.
 */
export function stageTaskOf(launchTask: string | null, projectId: string, claims: readonly LiveClaim[] | null, readError: string | null = null): string | null {
  return spawnParentOf(launchTask, projectId, claims, readError).parent
}

/** One hop's read: the `spawned` parents of one task, or why the read failed. */
export type SpawnedParentsRead = (taskId: string) => Promise<{ parents: readonly string[]; failed: string | null }>

/**
 * The `spawned` links above `start`, walked a task at a time (the 0.3.14 review, iteration 3, ER-24, DA-8). The bound
 * check used to read every `spawned` link of the project in one request: a refused read counted as no links, and past
 * the gateway's 1 000 rows the map was silently partial, so the depth was undercounted and the bound failed open. Here
 * each hop is one small read whose error is kept: `failed` names a read that did not happen, and the caller must not
 * judge the depth as safe from it. At most `hops` reads; a walk that meets a task already seen stops (a cycle, which
 * `loopBound.ts#mayChain` refuses on its own).
 */
export async function spawnedChainFrom(read: SpawnedParentsRead, start: string, hops: number): Promise<{ from: Record<string, string>; failed: string | null }> {
  const from: Record<string, string> = {}
  const seen = new Set([start])
  let at = start
  for (let hop = 0; hop < hops; hop++) {
    const r = await read(at)
    if (r.failed) return { from, failed: r.failed }
    const parent = [...r.parents].sort()[0]
    if (!parent) break
    from[at] = parent
    if (seen.has(parent)) break
    seen.add(parent)
    at = parent
  }
  return { from, failed: null }
}
// #endregion spawn-parent
