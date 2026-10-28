// #region relayed-close — docs: docs/adr/0184-an-agent-closes-a-task-on-the-operators-relayed-decision.md
/**
 * CO-478, ADR-0184: an agent closes or cancels a task only on the operator's relayed decision (fabric-agent-contract
 * DEC-0121 AP-2, `decision.schema.json`), the dashboard's button as an agent's door (the operator's dashboard-parity
 * rule, 2026-10-24). Without a decision the answer is `operator-decision-required`, naming exactly what to ask; a
 * decision that is malformed, for another action, without the task it names or said in the future is `decision-invalid`.
 * The ladder stays the person's (`shared/ladder.ts#mayMove`): the decision is the person's move, relayed.
 */
import { decisionSchema, type OperatorDecision } from './hubAuthority.ts'

/** The one action id the operator's words are relayed under. */
export const CLOSE_ACTION = 'task.close'
/** How far ahead of this machine's clock a decision's `at` may be (another machine's clock). */
export const CLOCK_SKEW_MS = 5 * 60_000

export type RelayedCloseVerdict =
  | { ok: true; decision: OperatorDecision }
  | { ok: false; code: 'operator-decision-required' | 'decision-invalid'; message: string; data: Record<string, unknown> }

/** The task the operator named: its id, or an 8 to 36 character prefix of it, as the board prints short ids. */
export function namesTask(target: string | undefined, taskId: string): boolean {
  if (!target) return false
  const t = target.trim().toLowerCase()
  const id = taskId.toLowerCase()
  return t === id || (t.length >= 8 && /^[0-9a-f-]+$/.test(t) && id.startsWith(t))
}

export function checkRelayedClose(decision: unknown, taskId: string, now: number): RelayedCloseVerdict {
  const ask = { action: CLOSE_ACTION, target: taskId }
  if (decision === undefined || decision === null)
    return { ok: false, code: 'operator-decision-required', message: 'Closing a task is the operator\'s move. Relay their words about this task as the decision, or move it to review.', data: ask }
  const parsed = decisionSchema.safeParse(decision)
  if (!parsed.success) return { ok: false, code: 'decision-invalid', message: 'The decision does not have the shape of decision.schema.json.', data: ask }
  const d = parsed.data
  if (d.action !== CLOSE_ACTION) return { ok: false, code: 'decision-invalid', message: `The decision is for ${d.action}, not ${CLOSE_ACTION}.`, data: ask }
  if (!namesTask(d.target, taskId)) return { ok: false, code: 'decision-invalid', message: 'The decision does not name this task as its target.', data: ask }
  if (Date.parse(d.at) - now > CLOCK_SKEW_MS) return { ok: false, code: 'decision-invalid', message: 'The decision says it was given in the future.', data: ask }
  return { ok: true, decision: d }
}
// #endregion relayed-close
