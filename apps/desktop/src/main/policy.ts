// The decision port, and the first thing in this product that can refuse.
//
// ADR-0023 names it: policy is an embedded decision port that NEVER GRANTS ON
// UNCERTAINTY. ADR-0028 puts the floor in the schema — `effect_intents` carries
// `CHECK (floor_class IS NULL OR grant_id IS NOT NULL)`, so a floored effect
// without a grant cannot be recorded even by a caller that skips this module.
// This file is the layer above that constraint: it decides, and it writes the
// receipt.
//
// WHY IT EXISTS NOW, ahead of runs and routines. The vision's third principle is
// "we automate explicit loops, not implied authority; every effect has a
// boundary, an owner and a receipt". Measured on 2026-09-03, the estate held
// zero grants, zero effect intents and zero authority events of any kind — the
// principle had never once been exercised. Every surface built before this one
// was execution; this is the first piece of the operating unit.
//
// THE RECEIPT IS THE JOURNAL ROW, not a field beside it. `effect_intents.
// receipt_seq` points at the `effect.executed@1` event, so "what happened" and
// "what was allowed" cannot drift: one is a projection of the other.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Actor, Journal } from '@fabric/journal'
import { createHash, randomUUID } from 'node:crypto'
import { checkAuthorityTarget, redactAuthorityPayload } from '../shared/authorityIngress.ts'
import { containmentFor } from '../shared/agents.ts'
import { flooredEffectAllowed } from '../shared/containment.ts'
import { describeRedactions } from '../shared/redact.ts'

/**
 * A stable id for one logical attempt, when the caller did not bring one.
 *
 * `decide` is asked more than once about the same act — to answer the operator,
 * and again before the effect is recorded — and reserving is not a pure read any
 * more. A fresh uuid per call would make the second call collide with its own
 * reservation, so the id is derived from what makes the attempt what it is.
 * A caller that wants two genuinely separate attempts passes its own.
 */
function commandIdFor(request: EffectRequest): string {
  const h = createHash('sha256')
    .update(
      [request.estateId, request.projectId ?? '', request.actionClass, request.floorClass ?? '', request.target, request.grantId ?? ''].join('\u0000')
    )
    .digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** The three classes of action a person must authorise one at a time. */
export type FloorClass = 'money' | 'deletion' | 'publication'

export interface EffectRequest {
  estateId: string
  projectId: string | null
  /** What is being attempted, in the effects algebra's vocabulary. */
  actionClass: string
  /** Null for an action below the floor. */
  floorClass: FloorClass | null
  actor: Actor
  /** What the effect acts on — compared against the grant's target. */
  target: string
  /** Offered by the caller; absent means no authority was presented. */
  grantId?: string | null
  /**
   * WHICH runner is asking, and in which mode (FA-09).
   *
   * The floor is voluntary: every runner has native tools Fabric cannot see, so
   * an `allow` on a floored effect authorises the ASKING and the doing was
   * available all along. A request that does not say who is asking is treated as
   * uncontained, because the question is whether Fabric can be sure.
   */
  runner?: string | null
  permissionMode?: string | null
  /**
   * The caller's own id for this attempt, kept across retries (S03.boundary).
   * It is what makes a reservation attributable: "which command holds this
   * grant" has an answer, and a retry of the same command is not a second one.
   */
  commandId?: string | null
  /**
   * Why the actor wants this, in their own words (M140). Journalled with the
   * decision, because the operator deciding in the attention queue reads THIS
   * and nothing else — an action class and a target say what would happen and
   * never why it should.
   */
  reason?: string
}

export type Decision =
  | {
      verdict: 'allow'
      reason: string
      grantId: string | null
      /** The reservation that holds the grant for this command. A floored
       *  effect cites THIS, not the grant — the database refuses the grant id
       *  on its own (S03.boundary). Null only for an unfloored allowance. */
      reservationId?: string | null
      /** The identity every later stage of this effect cites (ADR-0050). It is
       *  derived, not minted, so a retry of the same command reaches the same
       *  row rather than opening a second effect beside it. */
      commandId: string
    }
  | { verdict: 'refuse'; reason: string; needs: FloorClass | null }

/** The permit `beginDispatch` returns: what the caller cites when it comes back
 *  with a result, or what reconciliation looks the effect up by if it does not. */
export interface EffectDispatch {
  commandId: string
  attemptNo: number
  /** The same across every retry of one logical effect, by construction. */
  idempotencyKey: string
  seq: number
}

export interface PolicyDeps {
  db: SupabaseClient
  journal: Journal
  now?: () => Date
}

export class Policy {
  private db: SupabaseClient
  private journal: Journal
  private now: () => Date

  constructor(deps: PolicyDeps) {
    this.db = deps.db
    this.journal = deps.journal
    this.now = deps.now ?? ((): Date => new Date())
  }

  /**
   * Issue a one-shot authority for one floored action on one target.
   *
   * A grant is deliberately NOT a role, a setting or a preference: it names the
   * class, the target and an expiry, and it is spent once. That is what makes
   * "the operator allowed this" a fact with a time and a subject rather than a
   * configuration someone changed months ago.
   */
  async issueGrant(input: {
    estateId: string
    projectId: string | null
    floorClass: FloorClass
    target: string
    actor: Actor
    ttlMs: number
  }): Promise<{ grantId: string; seq: number; expiresAt: string }> {
    // A TARGET IS REFUSED, NOT SCRUBBED (S03). Every other field can be
    // cleaned and still mean what it meant; the target cannot, because it is
    // what the permission is compared against later. Scrubbing it would issue a
    // grant for a string nobody asked about and nobody will ever match.
    const targetCheck = checkAuthorityTarget(input.target)
    if (!targetCheck.ok) throw new Error(`${targetCheck.says} ${targetCheck.remedy}`)

    const expiresAt = new Date(this.now().getTime() + input.ttlMs).toISOString()
    const event = await this.appendAuthority({
      estateId: input.estateId,
      type: 'grant.issued@1',
      actor: input.actor,
      projectId: input.projectId ?? undefined,
      payload: {
        floor_class: input.floorClass,
        target: input.target,
        expires_at: expiresAt,
        issued_by: input.actor.id
      }
    })
    // The projector has not learned this event yet, so the row is written here
    // and the seq that carries it is returned: when `grant.issued@1` joins the
    // projector this insert is the line that goes, not the event.
    const { data, error } = await this.db
      .from('grants')
      .insert({
        estate_id: input.estateId,
        floor_class: input.floorClass,
        target: input.target,
        expires_at: expiresAt
      })
      .select('id')
      .single()
    if (error) throw new Error(`grant could not be recorded: ${error.message}`)
    return { grantId: data.id as string, seq: event.seq, expiresAt }
  }

  /**
   * Find an unspent grant the operator already issued for exactly this act
   * (M140).
   *
   * THE AGENT NEVER HOLDS AUTHORITY. When an agent's request is refused, the
   * operator grants from the attention queue and the agent simply asks again —
   * the surface looks the grant up here. Handing the agent a grant id to carry
   * would make authority a token in a language model's context, quotable,
   * copyable, and easy to present for the wrong act.
   *
   * This is NOT a weakening of the uncertainty clause. The operator's decision
   * was about the ACT — this class, this target — and it stays scoped to it.
   * Nothing here widens what was granted; it only removes the agent from the
   * chain of custody.
   */
  async findGrantFor(input: {
    estateId: string
    floorClass: FloorClass
    target: string
  }): Promise<string | null> {
    const { data, error } = await this.db
      .from('grants')
      .select('id,expires_at')
      .eq('estate_id', input.estateId)
      .eq('floor_class', input.floorClass)
      .eq('target', input.target)
      .is('consumed_at', null)
      .gt('expires_at', this.now().toISOString())
      // The OLDEST usable one. Newest-first would leave an earlier grant to
      // expire unused while the operator believes they authorised the act once.
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    // A grant that cannot be READ is not a grant that exists — the same rule
    // `evaluate` applies below, and for the same reason.
    if (error || !data) return null
    return data.id as string
  }

  /**
   * The ONE appender for the authority plane (S03).
   *
   * `redactPayload` lived inside `AgentSurface` and nowhere else, so every event
   * this class writes — the grant, the decision, the reservation, the dispatch,
   * the observation — carried its free text verbatim. `asked_because` is the
   * AGENT'S OWN WORDS (M140), and it reached the journal and the operator's
   * attention queue unscrubbed: M195's leak, one door along. The guarantee
   * belongs to the boundary that owes it, not to the surfaces that remember.
   */
  private async appendAuthority(input: {
    estateId: string
    type: string
    actor: Actor
    projectId?: string | null
    payload: Record<string, unknown>
  }): Promise<{ seq: number }> {
    const { payload, redactions } = redactAuthorityPayload(input.payload)
    const described = describeRedactions(redactions)
    return this.journal.append({
      estateId: input.estateId,
      type: input.type,
      actor: input.actor,
      projectId: input.projectId ?? undefined,
      payload: described ? { ...payload, redactions: described } : payload
    } as Parameters<Journal['append']>[0])
  }

  /**
   * Decide, and journal the decision either way.
   *
   * A refusal is recorded with the same weight as an allowance. An authority
   * plane that only writes down its yeses cannot answer "what did it stop", and
   * that question is the whole reason the plane exists.
   */
  async decide(request: EffectRequest): Promise<Decision> {
    // Checked BEFORE the decision is even journalled: a refusal here is about
    // the request being unaskable, not about the authority not existing, and
    // recording it as a policy decision would file it under the wrong question.
    const targetCheck = checkAuthorityTarget(request.target)
    if (!targetCheck.ok)
      return { verdict: 'refuse', reason: `${targetCheck.says} ${targetCheck.remedy}`, needs: request.floorClass }

    const decision = await this.evaluate(request)
    await this.appendAuthority({
      estateId: request.estateId,
      type: 'policy.decided@1',
      actor: request.actor,
      projectId: request.projectId ?? undefined,
      payload: {
        action_class: request.actionClass,
        floor_class: request.floorClass,
        target: request.target,
        verdict: decision.verdict,
        reason: decision.reason,
        // The decision's reason is policy's; this one is the caller's.
        asked_because: request.reason ?? null,
        grant_id: decision.verdict === 'allow' ? decision.grantId : null
      }
    })
    return decision
  }

  private async evaluate(request: EffectRequest): Promise<Decision> {
    if (request.floorClass === null)
      // Below the floor there is no reservation to make, but there IS still an
      // effect with a lifecycle: an unfloored act can be started and its result
      // still go unobserved, and an estate that only tracks the dangerous ones
      // cannot tell a quiet failure from a quiet success.
      return {
        verdict: 'allow',
        reason: 'below the floor',
        grantId: null,
        commandId: request.commandId ?? commandIdFor(request)
      }

    // CAN THE ASKER BE HELD TO THIS AT ALL (FA-09)? Checked before the grant,
    // because a grant handed to something nothing can contain authorises the
    // asking rather than the doing — and the same act was available without it.
    // The card allows two answers, intercept or refuse the profile; interception
    // would mean sitting inside another program's tool loop, so this is the one
    // that can be true.
    // AGENTS ONLY, and the distinction is the same one the quota gate makes: a
    // person acting with their own hands is not bypassing a floor, they ARE the
    // floor. What this catches is a runner whose native tools could have done
    // the thing without asking, and an operator has no native tools to hide.
    const contained = request.actor.kind !== 'agent'
      ? { allowed: true as const }
      : flooredEffectAllowed({
          containment: containmentFor(request.runner ?? '', request.permissionMode ?? null),
          floorClass: request.floorClass,
          runner: request.runner ?? 'an unnamed runner',
          permissionMode: request.permissionMode ?? null
        })
    if (!contained.allowed)
      return {
        verdict: 'refuse',
        reason: `${'reason' in contained ? contained.reason : ''} ${'remedy' in contained ? contained.remedy : ''}`.trim(),
        needs: request.floorClass
      }

    if (!request.grantId)
      // The uncertainty clause of ADR-0023, in one branch: no authority was
      // presented, so none is assumed.
      return {
        verdict: 'refuse',
        reason: `${request.floorClass} is above the floor and no grant was presented`,
        needs: request.floorClass
      }

    const { data: grant, error } = await this.db
      .from('grants')
      .select('id,estate_id,floor_class,target,expires_at,consumed_at')
      .eq('id', request.grantId)
      .maybeSingle()
    if (error)
      // A grant that cannot be READ is not a grant that is valid. The read
      // failing is uncertainty, and uncertainty refuses.
      return { verdict: 'refuse', reason: `the grant could not be read: ${error.message}`, needs: request.floorClass }
    if (!grant) return { verdict: 'refuse', reason: 'no such grant', needs: request.floorClass }
    if (grant.estate_id !== request.estateId)
      return { verdict: 'refuse', reason: 'the grant belongs to another estate', needs: request.floorClass }
    if (grant.floor_class !== request.floorClass)
      return {
        verdict: 'refuse',
        reason: `the grant authorises ${grant.floor_class}, not ${request.floorClass}`,
        needs: request.floorClass
      }
    if (grant.target !== request.target)
      return {
        verdict: 'refuse',
        reason: 'the grant names a different target',
        needs: request.floorClass
      }
    if (grant.consumed_at !== null)
      return { verdict: 'refuse', reason: 'the grant has already been spent', needs: request.floorClass }
    if (new Date(grant.expires_at as string).getTime() <= this.now().getTime())
      return { verdict: 'refuse', reason: 'the grant has expired', needs: request.floorClass }

    // EVERY CHECK ABOVE IS ALSO MADE IN THE DATABASE NOW (S03.boundary), and
    // that is not duplication — it is the difference between a caller that is
    // careful and a floor. What the caller cannot do from here is make the check
    // and the reservation ATOMIC: two commands both reaching this line found the
    // same unconsumed grant and both spent it. `reserve_effect` takes the row
    // lock, re-checks, and inserts under a partial unique index, so the second
    // command is refused rather than authorised.
    const { data: reservation, error: reserveError } = await this.db.rpc('reserve_effect', {
      p_estate_id: request.estateId,
      p_project_id: request.projectId ?? null,
      p_action_class: request.actionClass,
      p_floor_class: request.floorClass,
      p_target: request.target,
      p_command_id: request.commandId ?? commandIdFor(request)
    })
    if (reserveError)
      return {
        verdict: 'refuse',
        // The database's own sentence: it names which rule refused, and it is
        // already free of anything an agent supplied.
        reason: reserveError.message,
        needs: request.floorClass
      }

    const commandId = request.commandId ?? commandIdFor(request)
    // The reservation IS an event, and until this the projection had no row for
    // it — an effect existed only once somebody claimed it had happened.
    await this.appendAuthority({
      estateId: request.estateId,
      type: 'effect.reserved@1',
      actor: request.actor,
      projectId: request.projectId ?? undefined,
      payload: {
        command_id: commandId,
        action_class: request.actionClass,
        floor_class: request.floorClass,
        target: request.target,
        reservation_id: (reservation as { reservation_id: string } | null)?.reservation_id ?? null
      }
    })

    return {
      verdict: 'allow',
      reason: 'a live grant was reserved for this command',
      grantId: grant.id as string,
      reservationId: (reservation as { reservation_id: string } | null)?.reservation_id ?? null,
      commandId
    }
  }

  /**
   * THE DISPATCH FENCE — called immediately BEFORE the act, never after.
   *
   * ADR-0050. The grant is spent here rather than at the receipt, and that is
   * the whole point of the fence: past this line the estate may never learn
   * what happened. Consuming at the receipt instead means a crash mid-act
   * returns the grant to `available`, and the retry is a second authorisation
   * for what may already be one effect — a paid invoice paid twice.
   *
   * It returns the permit the caller cites when it comes back with a result.
   * If it never comes back, the effect sits at `dispatching` and reconciliation
   * — not optimism — is what resolves it.
   */
  async beginDispatch(
    request: EffectRequest,
    decision: Decision,
    opts: { attemptNo?: number; adapterRevision?: string } = {}
  ): Promise<EffectDispatch> {
    if (decision.verdict !== 'allow') throw new Error('a refused effect must not be dispatched')
    const attemptNo = opts.attemptNo ?? 1
    // STABLE ACROSS RETRIES, by construction. A key that varied per attempt is
    // how one logical effect becomes two at the provider — so it is derived
    // from the command, which a retry keeps, not from the attempt.
    const idempotencyKey = `${request.estateId}:${decision.commandId}`
    const event = await this.appendAuthority({
      estateId: request.estateId,
      type: 'effect.dispatch_started@1',
      actor: request.actor,
      projectId: request.projectId ?? undefined,
      payload: {
        command_id: decision.commandId,
        attempt_no: attemptNo,
        idempotency_key: idempotencyKey,
        action_class: request.actionClass,
        target: request.target,
        ...(opts.adapterRevision ? { adapter_revision: opts.adapterRevision } : {})
      }
    })
    await this.spendGrant(request, decision)
    return { commandId: decision.commandId, attemptNo, idempotencyKey, seq: event.seq }
  }

  /**
   * What was OBSERVED, by the party that performed the act.
   *
   * Fabric itself for a local effect, a provider receipt for an external one.
   * This is the only path that may resolve an effect, and the database enforces
   * it: a `succeeded` row with no attempt carrying an observation is refused.
   */
  async observeEffect(
    request: EffectRequest,
    dispatch: EffectDispatch,
    observation: { outcome: 'succeeded' | 'failed_known'; evidence: string; providerEffectRef?: string }
  ): Promise<{ seq: number }> {
    return this.appendAuthority({
      estateId: request.estateId,
      type: 'effect.observed@1',
      actor: request.actor,
      projectId: request.projectId ?? undefined,
      payload: {
        command_id: dispatch.commandId,
        attempt_no: dispatch.attemptNo,
        outcome: observation.outcome,
        observation_ref: observation.evidence,
        ...(observation.providerEffectRef ? { provider_effect_ref: observation.providerEffectRef } : {})
      }
    })
  }

  /**
   * What an AGENT says it did, where Fabric could not watch.
   *
   * Recorded, attributed, and never resolving anything. An agent performing an
   * act outside Fabric leaves an effect whose outcome Fabric honestly does not
   * know; the schema refuses `succeeded` on a claimed row, so this cannot
   * become a success by anybody's later convenience.
   */
  async claimEffect(
    request: EffectRequest,
    dispatch: EffectDispatch,
    report: { says: string }
  ): Promise<{ seq: number }> {
    return this.appendAuthority({
      estateId: request.estateId,
      type: 'effect.claimed@1',
      actor: request.actor,
      projectId: request.projectId ?? undefined,
      payload: { command_id: dispatch.commandId, attempt_no: dispatch.attemptNo, says: report.says }
    })
  }

  /**
   * Spend the grant, at the fence.
   *
   * Extracted from the old `recordEffect`, which spent it at the RECEIPT. The
   * move is the decision in ADR-0050 clause 4, not a refactor: the difference
   * shows up only when the process dies between the act and its receipt, and
   * that is exactly the case the old code got wrong.
   */
  private async spendGrant(request: EffectRequest, decision: Decision): Promise<void> {
    if (decision.verdict !== 'allow' || !decision.grantId) return
    await this.db
      .from('grants')
      .update({ consumed_at: this.now().toISOString() })
      .eq('id', decision.grantId)
      // S02.a: a grant id is a uuid from a decision, and `where id = …` alone
      // would consume another estate's grant if one ever collided.
      .eq('estate_id', request.estateId)
    await this.appendAuthority({
      estateId: request.estateId,
      type: 'grant.consumed@1',
      actor: request.actor,
      projectId: request.projectId ?? undefined,
      payload: { grant_id: decision.grantId, command_id: decision.commandId }
    })
  }
}
