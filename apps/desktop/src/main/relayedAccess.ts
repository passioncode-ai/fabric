// #region relayed-access — docs: docs/evidence/specs/2026-11-05-co506-agent-access-door.md#2-decisions
/**
 * CO-506: an agent decides Agent access only on the operator's relayed words, the buttons «Разрешить», «Отклонить» and
 * «Отозвать» as an agent's door (the operator's dashboard-parity rule, 2026-10-24), in ADR-0184's shape. The verdict is
 * bound into the action (`access.allow`, `access.deny`, `access.revoke`), so words that said deny cannot allow; the
 * target names the request, grant or credential; words dated in the future beyond the clock skew, or older than a day,
 * are refused. `admitAccessAct` is what an agent may never do there, whatever the words: allow a product request (its
 * consent and secret are the person's), allow outside Fabric's own lanes, allow what its own credential asked, or act on
 * a machine marked as an organization's.
 */
import { decisionSchema, type OperatorDecision } from './hubAuthority.ts'
import { CLOCK_SKEW_MS, namesTask } from './relayedClose.ts'
import { BOARD_RESPOND, FABRIC_SELF, PROJECT_RESOLVE, SESSION_ENROLL } from '../shared/access.ts'

export const ACCESS_ACTIONS = { allow: 'access.allow', deny: 'access.deny', revoke: 'access.revoke' } as const
export type AccessVerb = keyof typeof ACCESS_ACTIONS
/** How old the operator's words may be: a request lives ten minutes, but the words may come before it exists. */
export const DECISION_MAX_AGE_MS = 24 * 60 * 60_000
/** The lanes an agent may allow on the operator's words: Fabric's own, never a product's. */
export const AGENT_ALLOWABLE: ReadonlySet<string> = new Set([BOARD_RESPOND, SESSION_ENROLL, PROJECT_RESOLVE])

export type RelayedAccessRefusal = { ok: false; code: 'operator-decision-required' | 'decision-invalid' | 'human-step-required' | 'self-decision'; message: string; data: Record<string, unknown> }
export type RelayedAccessVerdict = { ok: true; decision: OperatorDecision } | RelayedAccessRefusal

export function checkRelayedAccess(decision: unknown, want: { verb: AccessVerb; targetId: string }, now: number): RelayedAccessVerdict {
  const ask = { action: ACCESS_ACTIONS[want.verb], target: want.targetId }
  if (decision === undefined || decision === null)
    return { ok: false, code: 'operator-decision-required', message: 'Agent access is the operator\'s to decide. Relay their words about this request, grant or agent as the decision.', data: ask }
  const parsed = decisionSchema.safeParse(decision)
  if (!parsed.success) return { ok: false, code: 'decision-invalid', message: 'The decision does not have the shape of decision.schema.json.', data: ask }
  const d = parsed.data
  if (d.action !== ask.action) return { ok: false, code: 'decision-invalid', message: `The decision is for ${d.action}, not ${ask.action}.`, data: ask }
  if (!namesTask(d.target, want.targetId)) return { ok: false, code: 'decision-invalid', message: 'The decision does not name this id as its target.', data: ask }
  const at = Date.parse(d.at)
  if (at - now > CLOCK_SKEW_MS) return { ok: false, code: 'decision-invalid', message: 'The decision says it was given in the future.', data: ask }
  if (now - at > DECISION_MAX_AGE_MS) return { ok: false, code: 'decision-invalid', message: 'The decision is more than a day old; relay the operator\'s current words.', data: ask }
  return { ok: true, decision: d }
}

export interface AdmitAccessAct {
  verb: AccessVerb
  /** The request decided (allow or deny). */
  request?: { callee: string; capabilities: string[]; asked_by_binding: string | null }
  /** The credential of the session asking to act. */
  callerBindingId: string | null
  /** `appSettings.machineTrust`: an absent setting is the operator's own machine, as ADR-0186 is today. */
  machineTrust: string | null
}

export function admitAccessAct(v: AdmitAccessAct): { ok: true } | RelayedAccessRefusal {
  if (v.machineTrust === 'organization')
    return { ok: false, code: 'human-step-required', message: 'This computer is marked as an organization\'s: Agent access is decided in Fabric\'s window here.', data: { verb: v.verb } }
  if (v.verb !== 'allow' || !v.request) return { ok: true }
  if (v.request.callee !== FABRIC_SELF)
    return { ok: false, code: 'human-step-required', message: 'Allowing a product is the person\'s step: its consent and its key are given in Fabric\'s window. You may deny it.', data: { callee: v.request.callee } }
  if (!v.request.capabilities.every((c) => AGENT_ALLOWABLE.has(c)))
    return { ok: false, code: 'decision-invalid', message: 'Only Fabric\'s own lanes (board.respond, session.enroll, project.resolve) are allowed on relayed words.', data: { capabilities: v.request.capabilities } }
  if (v.request.asked_by_binding !== null && v.request.asked_by_binding === v.callerBindingId)
    return { ok: false, code: 'self-decision', message: 'A request your own credential asked is not yours to allow; another session or the operator decides it.', data: {} }
  return { ok: true }
}
// #endregion relayed-access
