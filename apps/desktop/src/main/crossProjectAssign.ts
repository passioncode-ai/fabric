// #region cross-project-assign — docs: docs/ux/2026-10-26-simple-fabric.md#5-work-that-needs-another-project
/**
 * CO-458, «Поручить агенту B в Fabric» (the simple Fabric, §5, open choice 2's default): from a task in project A, the
 * person files the ask as a task in B's backlog and as a board request from A to B (`project.work`, DEC-0140 PR-1), so
 * B's agents meet it in `fabric_whoami`'s `waiting` and in B's queue. The two are tied by a note on B's task naming the
 * request («Board request: <id> (from task <A's task> in project <A>)»); when an agent releases B's task done, Fabric
 * answers the request on its thread as B, and A's task gets the note «B сделал: …». No schema step: the board, the
 * journal's task events and notes as they are. A refusal (another business, no board) is said, and nothing half-done
 * is left: the task is filed only after the request was stored.
 */
export interface AssignDeps {
  readTask(taskId: string): Promise<{ id: string; project_id: string; title: string | null; instruction: string } | null>
  readProject(projectId: string): Promise<{ id: string; name: string } | null>
  /** The operator's board submit as `projectId` (`AgentSurface#operatorBoard`); a refusal is `{ error }`. */
  submit(projectId: string, input: Record<string, unknown>): Promise<Record<string, unknown>>
  /** The operator's board reply as `projectId`. */
  reply(projectId: string, input: Record<string, unknown>): Promise<Record<string, unknown>>
  epoch(projectId: string): Promise<number | null>
  fileTask(projectId: string, title: string, instruction: string): Promise<{ id: string }>
  note(taskId: string, projectId: string, body: string): Promise<void>
  /** The notes of one task, newest first (bounded). */
  notes(taskId: string): Promise<string[]>
}

export type AssignResult =
  | { ok: true; taskId: string; requestId: string; project: string }
  | { ok: false; reason: string }

const MARK = /^Board request: ([0-9a-f-]{36}) \(from task ([0-9a-f-]{36}) in project ([0-9a-f-]{36})\)/m
const errorOf = (r: Record<string, unknown>): string | null => {
  const e = r.error as { code?: unknown; message?: unknown } | undefined
  return e ? `${String(e.code ?? 'refused')}: ${String(e.message ?? '')}` : null
}

export async function assignAcross(deps: AssignDeps, input: { fromTaskId: string; toProjectId: string; text: string; key: string }): Promise<AssignResult> {
  const text = input.text.trim()
  if (!text) return { ok: false, reason: 'say what is needed' }
  const from = await deps.readTask(input.fromTaskId)
  if (!from) return { ok: false, reason: 'the task this comes from could not be read' }
  if (from.project_id === input.toProjectId) return { ok: false, reason: 'the task is already in that project' }
  const [a, b] = await Promise.all([deps.readProject(from.project_id), deps.readProject(input.toProjectId)])
  if (!a || !b) return { ok: false, reason: 'a project could not be read' }
  const epoch = await deps.epoch(a.id)
  if (epoch === null) return { ok: false, reason: 'the board did not say its epoch, so nothing was sent' }
  const title = text.split('\n')[0]!.slice(0, 200)
  const fromTitle = (from.title ?? from.instruction).split('\n')[0]!.slice(0, 200)
  // The request first: a refusal (another business, a board that does not answer) leaves nothing filed in B.
  const sent = await deps.submit(a.id, {
    idempotency: { epoch, key: `assign:${input.key}` },
    thread: { new: { participants: [b.id], subject: title.slice(0, 200) } },
    kind: 'request',
    body: { format: 'text/markdown', text: `${text}\n\nFrom the task «${fromTitle}» in ${a.name} (task ${from.id}). Fabric files this as a task in ${b.name}'s backlog; releasing that task done answers this request.` },
    request: { target: b.id, capability: 'project.work' }
  })
  const refused = errorOf(sent)
  if (refused) return { ok: false, reason: `the board refused the request (${refused})` }
  const requestId = String((sent.request as { id?: unknown } | undefined)?.id ?? sent.message ?? '')
  if (!/^[0-9a-f-]{36}$/.test(requestId)) return { ok: false, reason: 'the board stored the request but did not name it' }
  const task = await deps.fileTask(b.id, title, `${text}\n\nThis is ${a.name}'s request on the board (${requestId}). When it is done, release this task done: Fabric answers the request for you.`)
  await deps.note(task.id, b.id, `Board request: ${requestId} (from task ${from.id} in project ${a.id})`)
  await deps.note(from.id, a.id, `Поручено ${b.name}: «${title}» (задача ${task.id}, запрос ${requestId}).`)
  return { ok: true, taskId: task.id, requestId, project: b.name }
}

/** When B's task is released done: answer its request as B and tell A's task. Nothing when the task was not assigned. */
export async function answerAssigned(deps: AssignDeps, taskId: string): Promise<{ answered: boolean; reason?: string }> {
  const mark = (await deps.notes(taskId)).map((n) => MARK.exec(n)).find((m) => m !== null)
  if (!mark) return { answered: false }
  const [, requestId, fromTaskId, fromProjectId] = mark
  const task = await deps.readTask(taskId)
  if (!task) return { answered: false, reason: 'the task could not be read' }
  const [b, epoch] = await Promise.all([deps.readProject(task.project_id), deps.epoch(task.project_id)])
  if (!b || epoch === null) return { answered: false, reason: 'the project or its board epoch could not be read' }
  const title = (task.title ?? task.instruction).split('\n')[0]!.slice(0, 200)
  const said = await deps.reply(b.id, {
    idempotency: { epoch, key: `assign-done:${taskId}` },
    replyTo: requestId,
    body: { format: 'text/markdown', text: `${b.name} сделал: «${title}». Задача ${taskId} на проверке.` }
  })
  const refused = errorOf(said)
  if (refused) return { answered: false, reason: `the board refused the answer (${refused})` }
  if (!(said.repeated === true)) await deps.note(fromTaskId!, fromProjectId!, `${b.name} сделал: «${title}» (задача ${taskId}).`)
  return { answered: true }
}
// #endregion cross-project-assign
