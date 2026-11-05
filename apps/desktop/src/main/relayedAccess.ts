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
import type { AccessActAnswer } from '../shared/accessActs.ts'
import type { AccessActor } from './accessStore.ts'

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

/** Agent access as an agent's door (index.ts wires it to `AccessService`); only a session server uses it. */
export interface AgentAccessDoor {
  request(id: string): Promise<{ callee: string; capabilities: string[]; asked_by_binding: string | null } | null>
  decide(id: string, verdict: 'allowed' | 'denied', actor: AccessActor, relayed: OperatorDecision): Promise<AccessActAnswer>
  revokeGrant(id: string, actor: AccessActor, relayed: OperatorDecision): Promise<AccessActAnswer>
  revokeAgent(bindingId: string, actor: AccessActor, relayed: OperatorDecision): Promise<AccessActAnswer>
  /** `appSettings.machineTrust`; null when never set. */
  machineTrust(): string | null
}
export interface AccessCaller { sessionId: string; bindingId: string | null }
export type RelayedActAnswer = { ok: true; done: Record<string, unknown> } | { ok: false; code: string; message: string; data: Record<string, unknown> }

/** «Разрешить» or «Отклонить», by the session, on the operator's words: checked, admitted, then the service's own answer. */
export async function relayedDecide(door: AgentAccessDoor, caller: AccessCaller, args: { requestId: string; verdict: 'allow' | 'deny'; decision: unknown }, now: number): Promise<RelayedActAnswer> {
  const checked = checkRelayedAccess(args.decision, { verb: args.verdict, targetId: args.requestId }, now)
  if (!checked.ok) return checked
  const row = await door.request(args.requestId)
  if (!row) return { ok: false, code: 'not-found', message: 'no such request', data: {} }
  const admit = admitAccessAct({ verb: args.verdict, request: row, callerBindingId: caller.bindingId, machineTrust: door.machineTrust() })
  if (!admit.ok) return admit
  const answer = await door.decide(args.requestId, args.verdict === 'allow' ? 'allowed' : 'denied', { kind: 'agent', id: caller.sessionId }, checked.decision)
  return answer.ok ? { ok: true, done: { requestId: args.requestId, verdict: args.verdict } } : { ok: false, code: answer.code, message: answer.reason, data: {} }
}

/** «Отозвать» one grant, or everything an agent holds, by the session, on the operator's words. */
export async function relayedRevoke(door: AgentAccessDoor, caller: AccessCaller, args: { grantId?: string; credentialId?: string; decision: unknown }, now: number): Promise<RelayedActAnswer> {
  const target = args.grantId ?? args.credentialId
  if (!target || (args.grantId && args.credentialId)) return { ok: false, code: 'invalid-arguments', message: 'Name exactly one: grantId or credentialId.', data: {} }
  const checked = checkRelayedAccess(args.decision, { verb: 'revoke', targetId: target }, now)
  if (!checked.ok) return checked
  const admit = admitAccessAct({ verb: 'revoke', callerBindingId: caller.bindingId, machineTrust: door.machineTrust() })
  if (!admit.ok) return admit
  const actor: AccessActor = { kind: 'agent', id: caller.sessionId }
  const answer = args.grantId ? await door.revokeGrant(args.grantId, actor, checked.decision) : await door.revokeAgent(target, actor, checked.decision)
  return answer.ok ? { ok: true, done: { revoked: args.grantId ? { grantId: args.grantId } : { credentialId: target } } } : { ok: false, code: answer.code, message: answer.reason, data: {} }
}

/** The act History shows when an agent's credential is revoked: written as the actor who revoked it (the session, on the
 *  operator's words, never «Вы»; the review of CO-506, F1), with the agent's name read before the revocation. */
export interface RevokeAgentDeps {
  nameOf(bindingId: string): Promise<string | null>
  revokeBinding(bindingId: string, actor: AccessActor, relayed: OperatorDecision): Promise<AccessActAnswer>
  note(outcome: { kind: 'agent.disconnect'; projectId: null; subject: { type: 'agent'; id: string; label: string | null }; said: { key: 'act.agent.disconnect'; params: { agent: string | null } }; inverse: null; whyNot: 'credential_gone' },
    opts: { actor: AccessActor }): Promise<unknown>
}
export function createRevokeAgent(deps: RevokeAgentDeps): AgentAccessDoor['revokeAgent'] {
  return async (bindingId, actor, relayed) => {
    const named = await deps.nameOf(bindingId)
    const done = await deps.revokeBinding(bindingId, actor, relayed)
    if (done.ok) await deps.note({ kind: 'agent.disconnect', projectId: null, subject: { type: 'agent', id: bindingId, label: named },
      said: { key: 'act.agent.disconnect', params: { agent: named } }, inverse: null, whyNot: 'credential_gone' }, { actor })
    return done
  }
}
// #endregion relayed-access
