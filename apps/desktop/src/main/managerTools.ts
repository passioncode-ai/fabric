// #region manager-tools — docs: docs/evidence/specs/2026-11-06-fabric-manager-agent.md#3-tools-a-closed-set-each-one-of-fabrics-existing-doors
/**
 * The Fabric manager's closed tool set (CO-522 wave D, step 4, its first half: the tools before the model). Each tool is
 * one of Fabric's existing doors, used with the person's authority, so every act lands in the journal like the person's
 * own. A read answers; an act runs; a person-gated act never runs here: it comes back as a proposal the person confirms
 * with one click (`confirmProposal`), until CO-523's levels make an administrator's order its own approval. Every enum
 * is closed, every argument checked before a door is called, and one message is held to at most 12 tool calls
 * (agent-orchestrator §2). The doors themselves are the host's (`ManagerPort`); this module calls nothing else.
 */
import { z } from 'zod'

export type ToolKind = 'read' | 'act' | 'person-gated'

const id = z.string().uuid()
const words = (max: number) => z.string().trim().min(1).max(max)

export const REVIEW_DECISIONS = ['accept', 'return', 'cancel'] as const
export const OVERLAP_CHOICES = ['wait', 'handover', 'split'] as const

/** The closed set, in the order the model reads it; each description says when to use it and which neighbour it is not. */
export const MANAGER_TOOLS = {
  sessions_list: {
    kind: 'read' as ToolKind,
    description: 'The agents working now: each session with its project, folder, branch, held task and stage. Use it first to know who works on what; for one project\'s claims and open tasks use work_list.',
    input: z.object({}).strict()
  },
  work_list: {
    kind: 'read' as ToolKind,
    description: 'One project\'s claims, overlaps and open tasks. Use it to see what a project has in flight; for every session at once use sessions_list.',
    input: z.object({ projectId: id }).strict()
  },
  task_get: {
    kind: 'read' as ToolKind,
    description: 'One task whole: its brief, notes, links, lease and recent events. Use it before deciding about a task.',
    input: z.object({ taskId: id }).strict()
  },
  waiting_for_person: {
    kind: 'read' as ToolKind,
    description: 'What waits for the person: reviews, questions and decisions, oldest first. Use it when asked what needs the person.',
    input: z.object({ projectId: id.nullable().optional(), limit: z.number().int().min(1).max(20).optional() }).strict()
  },
  say_to_session: {
    kind: 'act' as ToolKind,
    description: 'Words to one running session, which it reads on its next turn. Use it to steer work already in flight; to start new work in a project use file_task.',
    input: z.object({ sessionId: id, text: words(4000) }).strict()
  },
  file_task: {
    kind: 'act' as ToolKind,
    description: 'A new task in a project\'s queue, for that project\'s own agent. Use it for new work; to steer a session already on it use say_to_session.',
    input: z.object({ projectId: id, text: words(4000) }).strict()
  },
  assign_across: {
    kind: 'act' as ToolKind,
    description: 'Hand a task\'s work to another project\'s agent («Поручить агенту B»), the task linked to it. Use it when the work belongs to another project.',
    input: z.object({ fromTaskId: id, toProjectId: id, text: words(4000) }).strict()
  },
  decide_review: {
    kind: 'person-gated' as ToolKind,
    description: 'Propose a decision on a task in review: accept, return with a comment, or cancel with a reason. The person confirms it with one click; it is never applied by you.',
    input: z.object({ taskId: id, decision: z.enum(REVIEW_DECISIONS), comment: z.string().trim().max(4000).default('') }).strict()
  },
  decide_overlap: {
    kind: 'person-gated' as ToolKind,
    description: 'Propose how two sessions on one piece of work go on: one waits, one hands over, or both split the paths. The person confirms it with one click.',
    input: z.object({ key: z.string().regex(/^overlap-unsettled:[0-9a-f-]{36}:[0-9a-f-]{36}$/), choice: z.enum(OVERLAP_CHOICES) }).strict()
  },
  ask_person: {
    kind: 'act' as ToolKind,
    description: 'Ask the person a question with options, shown in «Нужны вы». Use it when a decision is the person\'s and no other tool applies.',
    input: z.object({ text: words(1000), options: z.array(words(200)).min(2).max(6) }).strict()
  }
} as const

export type ManagerToolName = keyof typeof MANAGER_TOOLS

/** The host's doors, one per tool; each answers `{ok: true, ...}` or `{ok: false, reason}`. */
export interface ManagerPort {
  sessions(): Promise<unknown>
  work(projectId: string): Promise<unknown>
  task(taskId: string): Promise<unknown>
  waiting(projectId: string | null, limit: number): Promise<unknown>
  say(sessionId: string, text: string): Promise<{ ok: boolean; reason?: string }>
  fileTask(projectId: string, text: string): Promise<{ ok: boolean; reason?: string; taskId?: string }>
  assignAcross(fromTaskId: string, toProjectId: string, text: string, key: string): Promise<{ ok: boolean; reason?: string }>
  decideReview(taskId: string, decision: typeof REVIEW_DECISIONS[number], comment: string): Promise<{ ok: boolean; reason?: string }>
  decideOverlap(key: string, choice: typeof OVERLAP_CHOICES[number]): Promise<{ ok: boolean; reason?: string }>
  ask(text: string, options: string[]): Promise<{ ok: boolean; reason?: string; questionId?: string }>
}

/** A person-gated act, proposed and waiting for the person's click. */
export interface Proposal { tool: 'decide_review' | 'decide_overlap'; args: Record<string, unknown> }

export type ToolAnswer =
  | { ok: true; result: unknown }
  | { ok: true; proposal: Proposal; says: string }
  | { ok: false; reason: 'unknown-tool' | 'invalid-arguments' | 'budget-spent' | 'door-refused' | 'door-failed'; says: string }

/** At most this many tool calls answer one message of the person's (agent-orchestrator §2). */
export const TOOL_CALLS_PER_MESSAGE = 12

export function createManagerTools(port: ManagerPort, opts: { newKey?: () => string } = {}) {
  const newKey = opts.newKey ?? (() => crypto.randomUUID())
  let calls = 0
  const door = async (run: () => Promise<{ ok: boolean; reason?: string }>): Promise<ToolAnswer> => {
    try {
      const r = await run()
      return r.ok ? { ok: true, result: r } : { ok: false, reason: 'door-refused', says: r.reason ?? 'the door refused' }
    } catch (e) {
      // The model is told the door failed and why in one line; nothing is retried here.
      return { ok: false, reason: 'door-failed', says: e instanceof Error ? e.message.slice(0, 300) : 'the door failed' }
    }
  }
  return {
    /** A new message from the person: the budget of tool calls starts again. */
    newMessage(): void { calls = 0 },
    async call(name: string, args: unknown): Promise<ToolAnswer> {
      if (!Object.hasOwn(MANAGER_TOOLS, name)) return { ok: false, reason: 'unknown-tool', says: `no tool is named ${name}` }
      if (calls >= TOOL_CALLS_PER_MESSAGE) return { ok: false, reason: 'budget-spent', says: `this message has used its ${TOOL_CALLS_PER_MESSAGE} tool calls: answer with what you have` }
      calls++
      const tool = MANAGER_TOOLS[name as ManagerToolName]
      const parsed = tool.input.safeParse(args ?? {})
      if (!parsed.success) return { ok: false, reason: 'invalid-arguments', says: parsed.error.issues.map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`).join('; ').slice(0, 500) }
      const a = parsed.data as Record<string, never>
      switch (name as ManagerToolName) {
        case 'sessions_list': return door(async () => ({ ok: true, sessions: await port.sessions() }))
        case 'work_list': return door(async () => ({ ok: true, work: await port.work(a.projectId) }))
        case 'task_get': return door(async () => ({ ok: true, task: await port.task(a.taskId) }))
        case 'waiting_for_person': return door(async () => ({ ok: true, waiting: await port.waiting((a.projectId as string | null | undefined) ?? null, (a.limit as number | undefined) ?? 10) }))
        case 'say_to_session': return door(() => port.say(a.sessionId, a.text))
        case 'file_task': return door(() => port.fileTask(a.projectId, a.text))
        case 'assign_across': return door(() => port.assignAcross(a.fromTaskId, a.toProjectId, a.text, newKey()))
        case 'ask_person': return door(() => port.ask(a.text, a.options))
        case 'decide_review':
        case 'decide_overlap':
          // Person-gated: never applied here. The person confirms the proposal with one click (`confirmProposal`).
          return { ok: true, proposal: { tool: name as Proposal['tool'], args: parsed.data as Record<string, unknown> }, says: 'proposed; the person confirms it with one click' }
      }
    }
  }
}

/** The person's click on a proposal: the only path by which a person-gated act reaches its door. */
export async function confirmProposal(p: Proposal, port: Pick<ManagerPort, 'decideReview' | 'decideOverlap'>): Promise<{ ok: boolean; reason?: string }> {
  if (p.tool === 'decide_review') {
    const a = MANAGER_TOOLS.decide_review.input.parse(p.args)
    return port.decideReview(a.taskId, a.decision, a.comment)
  }
  const a = MANAGER_TOOLS.decide_overlap.input.parse(p.args)
  return port.decideOverlap(a.key, a.choice)
}
// #endregion manager-tools
