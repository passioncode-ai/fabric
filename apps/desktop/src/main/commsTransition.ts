// #region project-board-settled-by — docs: docs/adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md#7-the-owner-settles-a-request-nobody-can-settle-contract-dec-0081
/**
 * A request's transition as the contract reads it (fabric-agent-contract 39c8977, `comms-transition`): the record
 * `{op, from, to, observed?, settledBy?, summary?, principal?}`, and the two rules a host's journal must hold over it —
 * FAC-SEM-027 (the lifecycle table) and FAC-SEM-109 (who settled a request, DEC-0081).
 *
 * The rules are a port of the contract's own (`src/semantic-rules.ts`, `commsTransition` and `commsSettlement`), held
 * to its shared vectors (`fixtures/vectors/comms-settlement.json`) in `test/contract-consumer.test.mjs`, and applied to
 * the board's journal in `test/project-board-operator-db.test.mjs`. Fabric's journal spells its payload in snake case
 * (`settled_by`, `effect_from`); `transitionRecordOf` is the one place that reads it as the contract's record.
 */

/** The request lifecycle (DEC-0022, DEC-0081, DEC-0098): op → the (from, to) pairs it may make. No op leaves outcome_unknown but
 *  reconcile, and none moves it to cancelled. */
export const COMMS_TRANSITIONS: Readonly<Record<string, readonly (readonly [string, string])[]>> = Object.freeze({
  claim: [['queued', 'claimed'], ['claimed', 'claimed']],
  accept: [['claimed', 'accepted']],
  effect_begin: [['accepted', 'in_progress']],
  complete: [['accepted', 'completed'], ['accepted', 'failed_known'], ['in_progress', 'completed'], ['in_progress', 'failed_known']],
  cancel: [['queued', 'cancelled'], ['claimed', 'cancelled'], ['accepted', 'cancelled'], ['in_progress', 'outcome_unknown'], ['answered', 'cancelled']],
  expire: [['queued', 'expired'], ['claimed', 'expired']],
  replace: [['claimed', 'queued'], ['accepted', 'accepted']],
  lost_result: [['in_progress', 'outcome_unknown']],
  reconcile: [['outcome_unknown', 'completed'], ['outcome_unknown', 'failed_known']],
  // DEC-0098, DEC-0102 (first served as 0.3.9 BD-1, migration 95): the target Project's participant message, not a
  // request and never a responder's fenced reply or progress note, answers a queued request; its asker may still cancel it.
  answer: [['queued', 'answered']]
})

export interface TransitionFinding {
  code: 'FAC-SEM-027' | 'FAC-SEM-109'
  instancePath: string
  message: string
}

const SETTLING_OPS: ReadonlySet<string> = new Set(['complete', 'reconcile'])
/** The owner's summary bound, in characters as JSON Schema counts them: code points, not UTF-16 units. */
const OWNER_SUMMARY_MAX = 2000

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** FAC-SEM-027: the transition is in the table; a complete after an effect began, and every reconcile, is observed. */
function lifecycle(value: Record<string, unknown>): TransitionFinding[] {
  const op = String(value.op ?? '')
  const from = String(value.from ?? '')
  const to = String(value.to ?? '')
  // Own members only: an op named `constructor` or `__proto__` must not reach Object.prototype.
  const allowed = Object.hasOwn(COMMS_TRANSITIONS, op) ? (COMMS_TRANSITIONS[op] ?? []) : []
  if (!allowed.some(([f, t]) => f === from && t === to)) {
    return [{ code: 'FAC-SEM-027', instancePath: '/to', message: `${op || '(no op)'} cannot move a request from ${from} to ${to}` }]
  }
  if (((op === 'complete' && from === 'in_progress') || op === 'reconcile') && value.observed !== true) {
    return [{ code: 'FAC-SEM-027', instancePath: '/observed', message: 'an effect that began is settled only by an observed result' }]
  }
  return []
}

/** FAC-SEM-109: every complete and reconcile names who settled it, and nothing else does; the owner only reconciles,
 *  with a summary of 1–2000 characters, as an operator principal the host verified. */
function settlement(value: Record<string, unknown>): TransitionFinding[] {
  const op = typeof value.op === 'string' ? value.op : ''
  if (value.settledBy === undefined) {
    return SETTLING_OPS.has(op) ? [{ code: 'FAC-SEM-109', instancePath: '/settledBy', message: `a ${op} record names who settled the request: responder or owner` }] : []
  }
  if (value.settledBy !== 'responder' && value.settledBy !== 'owner') {
    return [{ code: 'FAC-SEM-109', instancePath: '/settledBy', message: 'settledBy is responder or owner' }]
  }
  if (!SETTLING_OPS.has(op)) {
    return [{ code: 'FAC-SEM-109', instancePath: '/settledBy', message: `only a settlement names who settled it, and ${op || '(no op)'} settles nothing` }]
  }
  if (value.settledBy === 'responder') return []
  const findings: TransitionFinding[] = []
  if (op !== 'reconcile') findings.push({ code: 'FAC-SEM-109', instancePath: '/op', message: 'the estate owner settles only by reconciling an outcome_unknown request' })
  const length = typeof value.summary === 'string' ? [...value.summary].length : 0
  if (length < 1 || length > OWNER_SUMMARY_MAX) {
    findings.push({ code: 'FAC-SEM-109', instancePath: '/summary', message: "the estate owner's settlement carries a summary of what it observed, 1–2000 characters" })
  }
  const principal = isObject(value.principal) ? value.principal : {}
  if (principal.kind !== 'operator' || principal.provenance !== 'trusted') {
    findings.push({ code: 'FAC-SEM-109', instancePath: '/principal', message: 'the estate owner is an operator principal the host verified (trusted)' })
  }
  return findings
}

/** What the contract finds wrong with one transition record, in its order: FAC-SEM-027, then FAC-SEM-109. A record
 *  that is not an object is read as an empty one, as the contract's rules read it. */
export function transitionFindings(record: unknown): TransitionFinding[] {
  const value = isObject(record) ? record : {}
  return [...lifecycle(value), ...settlement(value)]
}

/** One `comms.request_transitioned@1` payload of the board's journal, as the contract's transition record. `summary`
 *  and `principal` are not in the payload (the summary is a board_outcomes row, the principal the event's actor); the
 *  caller passes them when it has them. */
export function transitionRecordOf(payload: unknown, extra: { summary?: string; principal?: unknown } = {}): Record<string, unknown> {
  const p = isObject(payload) ? payload : {}
  const record: Record<string, unknown> = { op: p.op, from: p.from, to: p.to }
  if (p.observed !== undefined) record.observed = p.observed
  if (p.settled_by !== undefined) record.settledBy = p.settled_by
  if (extra.summary !== undefined) record.summary = extra.summary
  if (extra.principal !== undefined) record.principal = extra.principal
  return record
}
// #endregion project-board-settled-by
