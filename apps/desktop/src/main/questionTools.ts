/**
 * The owner's questions for a session: `fabric_question_ask` puts a decision the agent is not entitled to make before the
 * owner, ranked with everything else waiting, and `fabric_question_check` reads its state. Moved out of
 * `agentSurface.ts#serverFor` as one group (the screens waves S2, 2026-11-16).
 */
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ScopedStore } from './scopedStore.ts'
import { cleanOriginalText } from './desktopIngress.ts'
import { QUESTION_KINDS, normaliseAsk } from '../shared/questionAsk.ts'
import { assertAgentReference } from './agentReference.ts'

export interface QuestionToolsDeps {
  /** The credential-scoped store: another project's question reads exactly like one that does not exist. */
  store: ScopedStore
  /** The surface's journal append, payload scrubbed for an agent (`agentSurface.ts#appendRedacted`). */
  append(input: { estateId: string; type: string; actor: { kind: string; id: string }; projectId?: string | null; payload: Record<string, unknown> }): Promise<{ seq: number }>
  /** A task of this project, or null; throws when it could not be read (never "no such task" on a failed read). */
  ownTask(taskId: string): Promise<unknown | null>
}

export interface QuestionToolsScope { estateId: string; projectId: string; sessionId: string }

function json(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

export function registerQuestionTools(server: McpServer, deps: QuestionToolsDeps, scope: QuestionToolsScope): void {
  server.registerTool(
    'fabric_question_ask',
    {
      title: 'Ask the owner a question',
      description:
        'When you reach a decision you are not entitled to make, ASK — do not guess and do not work around it. The question reaches the owner ranked against everything else waiting, and whatever it blocks stays blocked until it is answered. Give options where there are options: an owner choosing between two named consequences answers in seconds, and an open question waits for them to have time to think. With options, name the one you recommend (`recommended`, its id) and say why in its consequence: the owner sees it first, then the others, then «Отдать агенту», which hands the choice back to you to decide by the project\'s decisions and goal. A question that blocks nothing is fine; you may want a decision without being stuck on it.',
      inputSchema: {
        commandId: z
          .string()
          .uuid()
          .describe('Your own id for this ask. Retry with the SAME one and you get the same question back, not a second one in front of a person.'),
        text: z.string().min(1).max(4000),
        kind: z.enum(QUESTION_KINDS).optional().describe('decision by default'),
        topic: z.string().max(80).optional().describe('what it is about, beside the kind — e.g. process'),
        about: z.string().max(200).optional().describe('a stable subject key such as db.version, so a recorded decision on the same subject can settle it without asking'),
        whyBlocked: z.string().max(2000).optional().describe('what cannot proceed, in your words'),
        taskId: z.string().uuid().optional().describe('the task this came out of'),
        options: z
          .array(z.object({ id: z.string().optional(), label: z.string(), consequence: z.string().optional(), recommended: z.boolean().optional() }))
          .max(8)
          .optional(),
        recommended: z.string().max(200).optional().describe('the id of the option you recommend; required when you give options (or recommended: true on that option)'),
        blocks: z.array(z.string().uuid()).max(20).optional().describe('tasks that cannot proceed until this is answered')
      }
    },
    async ({ commandId, ...raw }) => {
      assertAgentReference(raw.about)
      for (const option of raw.options ?? []) assertAgentReference(option.id)
      // The normalizer clips labels/consequences. Scrub the complete source
      // first: after clipping a token prefix may no longer be recognizable.
      // Optional blank detail remains legal; normaliseAsk owns its existing
      // empty-label/text refusals and omission behavior.
      const questionText = (value: string): string => value.trim() ? cleanOriginalText(value) : value
      const asked = normaliseAsk({
        ...raw,
        text: questionText(raw.text),
        ...(raw.topic !== undefined ? { topic: questionText(raw.topic) } : {}),
        ...(raw.whyBlocked !== undefined ? { whyBlocked: questionText(raw.whyBlocked) } : {}),
        ...(raw.options ? { options: raw.options.map(option => ({
          ...option,
          label: questionText(option.label),
          ...(option.consequence !== undefined ? { consequence: questionText(option.consequence) } : {})
        })) } : {})
      })
      if (!asked.ok) return json({ asked: false, reason: asked.reason })

      // Idempotency BEFORE validation costs a round trip; after it, a retry of
      // a malformed ask still gets the same refusal, which is what the agent
      // needs to see.
      const { data: already } = await deps.store
        .select('questions', 'id,status,seq')
        .eq('asked_command_id', commandId)
        .maybeSingle()
      if (already)
        return json({ asked: true, repeated: true, question_id: already.id, status: already.status, seq: already.seq })

      // Every blocked task is checked HERE, before the append. The projector
      // would silently drop a foreign one (ADR-0049) and the agent would be
      // left with a question that blocks nothing and no idea why.
      for (const taskId of asked.value.blocks)
        if (!(await deps.ownTask(taskId)))
          return json({ asked: false, reason: `task ${taskId} is not in this project, so this question cannot block it` })
      if (asked.value.taskId && !(await deps.ownTask(asked.value.taskId)))
        return json({ asked: false, reason: 'that task is not in this project' })

      const questionId = randomUUID()
      const event = await deps.append({
        estateId: scope.estateId,
        type: 'question.asked@1',
        actor: { kind: 'agent', id: scope.sessionId },
        projectId: scope.projectId,
        payload: {
          id: questionId,
          command_id: commandId,
          // The SERVER's project, not one the caller named. The estate and the
          // author come from the credential for the same reason.
          project_id: scope.projectId,
          text: asked.value.text,
          kind: asked.value.kind,
          topic: asked.value.topic,
          about: asked.value.about,
          why_blocked: asked.value.whyBlocked,
          task_id: asked.value.taskId,
          options: asked.value.options,
          blocks: asked.value.blocks
        }
      })
      return json({
        asked: true,
        repeated: false,
        question_id: questionId,
        seq: event.seq,
        blocks: asked.value.blocks.length,
        note: 'It is with the owner now. Nothing here tells you when it will be answered — check with fabric_question_check, and do not wait in a loop.'
      })
    }
  )

  server.registerTool(
    'fabric_question_check',
    {
      title: 'Check a question you asked',
      description:
        'The current state of one question, by its id. Open means nobody has answered yet — that is not a failure and not a reason to ask again. Answered carries the answer and the option chosen if there was one.',
      inputSchema: { questionId: z.string().uuid() }
    },
    async ({ questionId }) => {
      // Scoped by the credential, so another project's question reads exactly
      // like one that does not exist. Two different refusals would tell an
      // agent that a question it may not see is out there.
      const { data } = await deps.store
        .select('questions', 'id,status,answer,chosen_option,answered_at,about,topic,kind,text')
        .eq('id', questionId)
        .maybeSingle()
      if (!data) return json({ found: false, reason: 'no such question here' })
      const { data: blocked } = await deps.store
        .select('question_blocks', 'task_id')
        .eq('question_id', questionId)
      return json({
        found: true,
        question_id: data.id,
        status: data.status,
        text: data.text,
        answer: data.answer ?? null,
        chosen_option: data.chosen_option ?? null,
        answered_at: data.answered_at ?? null,
        blocks: (blocked ?? []).map((b) => b.task_id)
      })
    }
  )
}
