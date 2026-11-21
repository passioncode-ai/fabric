/**
 * The floor's two tools for a session (ADR-0050): `fabric_effect_request` asks before an act that spends money, deletes
 * what cannot be recovered or publishes outward, and `fabric_effect_report` says what happened after, as a claim. Moved
 * out of `agentSurface.ts#serverFor` as one group (the screens waves S2, 2026-11-16).
 */
import type { BehaviourJournal } from './behaviourJournal.ts'
import { ops } from './opsSink.ts'
import { waitsForOwner, type ApprovalMode } from '../shared/approvalMode.ts'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Policy } from './policy'
import type { HubTerminals } from './hubPorts.ts'
import type { ScopedStore } from './scopedStore.ts'
import { assertAgentReference } from './agentReference.ts'

export interface EffectToolsDeps {
  /** The decision port; absent, both tools say so rather than pretend. */
  policy(): Policy | undefined
  /** The credential-scoped store `serverFor` built: every read is narrowed to the session's estate and project. */
  store: ScopedStore
  /** The terminals, to say which runner and permission mode asks (FA-09); undefined before they exist. */
  ptys(): HubTerminals | undefined
  /** The owner's approval mode (ADR-0203); absent is the default, every act above the floor waits. */
  approvalMode?(): ApprovalMode
  /** ADR-0203 §6: each decision on an act above the floor, on whose word; absent: not written. */
  behaviour?: Pick<BehaviourJournal, 'note'>
}

export interface EffectToolsScope { estateId: string; projectId: string; sessionId: string }

function json(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

export function registerEffectTools(server: McpServer, deps: EffectToolsDeps, scope: EffectToolsScope): void {
  server.registerTool(
    'fabric_effect_report',
    {
      title: 'Report what happened to an act you were permitted',
      description:
        'After doing a permitted act, say what happened, citing the effect_id you were given. This is a CLAIM, not a receipt: Fabric did not watch you do it, so the outcome stays recorded as unknown and your report is attached to it with your name on it. Reporting is still worth doing — an effect nobody reported and one that failed silently look identical otherwise. Never report an act you did not perform.',
      inputSchema: {
        effectId: z.string().uuid().describe('The effect_id fabric_effect_request gave you'),
        says: z
          .string()
          .min(3)
          .max(1000)
          .describe('What happened, plainly. Include any reference the other side gave you')
      }
    },
    async ({ effectId, says }) => {
      const policy = deps.policy()
      if (!policy) return json({ recorded: false, reason: 'no policy port is configured on this surface' })
      // The intent is looked up under the SESSION's scope, so an agent cannot
      // report against another project's effect by knowing its id.
      // The credential-scoped store built at the top of `serverFor`: the lookup is
      // narrowed to this session's estate and project before the tool sees it.
      const { data: intent, error } = await deps.store
        .select('effect_intents', 'command_id, action_class, target, state')
        .eq('command_id', effectId)
        .maybeSingle()
      if (error)
        return json({ recorded: false, reason: `the effect could not be read: ${error.message}` })
      if (!intent)
        return json({
          recorded: false,
          reason: 'no such effect in this project. Report against the effect_id you were given, not one you constructed.'
        })

      const request = {
        estateId: scope.estateId,
        projectId: scope.projectId,
        actionClass: (intent as { action_class: string }).action_class,
        floorClass: null,
        actor: { kind: 'agent' as const, id: scope.sessionId },
        target: (intent as { target: string | null }).target ?? ''
      }
      const event = await policy.claimEffect(
        request,
        { commandId: effectId, attemptNo: 1, idempotencyKey: '', seq: 0 },
        { says }
      )
      return json({
        recorded: true,
        receipt_seq: event.seq,
        outcome: 'unknown',
        note:
          'Recorded as your report, attributed to this session. The effect stays UNKNOWN to Fabric ' +
          'because Fabric did not observe it; that is not a doubt about you, it is the difference ' +
          'between evidence and an account.'
      })
    }
  )

  server.registerTool(
    'fabric_effect_request',
    {
      title: 'Ask to do something above the floor',
      description:
        'Three classes of act need a person: spending money, deleting what cannot be recovered, and publishing outward. Ask here BEFORE doing one. Unless the owner\'s approval mode lets this act through (your fabric_whoami `approval` says which), you will be refused the first time — that is not a failure, it is the operator being asked. They see the request with your reason, and if they agree you ask again and it goes through. You never hold the permission yourself.',
      inputSchema: {
        actionClass: z.string().min(3).max(80).describe('What you want to do, in the effects vocabulary'),
        floorClass: z
          .enum(['money', 'deletion', 'publication'])
          .describe('Which floor it crosses'),
        target: z
          .string()
          .min(1)
          .max(300)
          .describe('What it acts ON — a path, a domain, an account. The permission is scoped to exactly this'),
        why: z.string().min(3).max(500).describe('Why it is needed. The operator reads this and nothing else')
      }
    },
    async ({ actionClass, floorClass, target, why }) => {
      assertAgentReference(actionClass)
      assertAgentReference(target)
      const policy = deps.policy()
      if (!policy)
        return json({ allowed: false, reason: 'the policy port is not available in this session' })
      // The agent presents NOTHING. If the operator has already granted this
      // exact act, the surface finds it — see `findGrantFor`. Handing the
      // agent a grant id would put authority in a language model's context,
      // quotable and copyable and easy to present for the wrong act.
      const grantId = await policy.findGrantFor({
        estateId: scope.estateId,
        floorClass,
        target,
        // A grant confined to another project or act does not serve this one (audit A7-015).
        projectId: scope.projectId,
        actionClass
      })
      // ADR-0203: the owner's approval mode. When this act does not wait for him under it, Fabric issues the one-shot
      // grant itself, as the system `approval-mode:<mode>`, scoped to this project, act and target, so the floor's rule
      // holds (a floored effect names a grant) and the journal says which mode allowed it. The agent still holds nothing.
      const autoGrant = grantId ? null : await grantByMode(deps, scope, { floorClass, target, actionClass })
      const grantUsed = grantId ?? autoGrant?.grantId ?? null
      // WHO IS ASKING, and in which mode (FA-09). The floor is voluntary —
      // every runner has native tools Fabric cannot see — so the decision has
      // to know whether the asker could be held to it at all. An unknown
      // session is uncontained by construction, which is the safe direction:
      // the question is whether Fabric can be sure.
      const session = deps.ptys()?.get(scope.sessionId) ?? null
      const request = {
        estateId: scope.estateId,
        projectId: scope.projectId,
        actionClass,
        floorClass,
        actor: { kind: 'agent' as const, id: scope.sessionId },
        target,
        grantId: grantUsed,
        runner: session?.optionId ?? null,
        permissionMode: session?.permissionMode ?? null
      }
      const decision = await policy.decide({ ...request, reason: why } as typeof request)
      try {
        deps.behaviour?.note({
          actor: { kind: 'session', id: scope.sessionId },
          act: `effect.${floorClass}`,
          target,
          word: autoGrant ? { of: 'approval-mode', via: autoGrant.mode } : grantId ? { of: 'owner', via: 'grant', ref: grantId } : { of: 'agent', via: 'request' },
          // A grant presented and still refused is a refusal; none presented is the owner being asked.
          decision: decision.verdict === 'allow' ? 'allowed' : grantUsed ? 'refused' : 'waits-for-owner',
          reason: why
        })
      } catch (e) { ops.failed('effect.behaviour-note', e, { note: 'the decision stands; only its line in the behaviour journal is missing' }) }
      if (decision.verdict !== 'allow')
        return json({
          allowed: false,
          reason: decision.reason,
          needs: decision.needs,
          // Said plainly, because an agent that reads a refusal as a dead end
          // will invent a way around it instead of waiting.
          next: 'The operator has been asked. Do the act only after asking again and being allowed.',
          approval_mode: autoGrant?.mode ?? deps.approvalMode?.() ?? 'important'
        })
      // ADR-0050 — THE PERMIT IS NOT A RECEIPT. This used to call
      // `recordEffect`, which appended `effect.executed@1` — shown to the
      // operator as "an effect was carried out" — with nothing whatsoever
      // between the permission and the claim. The act happens afterwards,
      // outside Fabric, and may never happen at all.
      //
      // The fence is crossed here because from the agent's next instruction
      // onward the estate cannot know what occurred; the grant is spent, and
      // the effect stands at `dispatching` until somebody reports or observes
      // it. What an agent reports is a CLAIM, and the schema refuses to let a
      // claim become a success.
      const dispatch = await policy.beginDispatch(request, decision)
      return json({
        allowed: true,
        ...(autoGrant ? { allowed_by: `the owner's approval mode «${autoGrant.mode}»` } : {}),
        effect_id: dispatch.commandId,
        idempotency_key: dispatch.idempotencyKey,
        receipt_seq: dispatch.seq,
        note:
          'Permission, not a receipt: nothing has been recorded as done. Do the act ONCE, ' +
          'then report it with fabric_effect_report citing this effect_id. If you retry, ' +
          'reuse the idempotency key — a new one makes a second effect out of one.'
      })
    }
  )
}

// #region approval-mode-grant — docs: docs/adr/0203-the-owners-approval-mode-says-which-acts-wait-for-him.md#decision
/** How long a grant the mode issued stays usable: long enough for the ask that follows it, never a standing permission. */
export const MODE_GRANT_TTL_MS = 10 * 60_000

/** ADR-0203: the grant the owner's approval mode gives an act that does not wait for him; null when it waits. */
async function grantByMode(
  deps: EffectToolsDeps,
  scope: EffectToolsScope,
  act: { floorClass: 'money' | 'deletion' | 'publication'; target: string; actionClass: string }
): Promise<{ grantId: string; mode: ApprovalMode } | null> {
  const policy = deps.policy()
  const mode = deps.approvalMode?.() ?? 'important'
  if (!policy || mode === 'important') return null
  const firstTime = mode === 'unusual'
    ? await policy.actedBefore({ estateId: scope.estateId, projectId: scope.projectId, floorClass: act.floorClass, target: act.target }).then((b) => (b === null ? null : !b))
    : null
  if (waitsForOwner(mode, act.floorClass, { firstTime })) return null
  try {
    const issued = await policy.issueGrant({
      estateId: scope.estateId,
      projectId: scope.projectId,
      floorClass: act.floorClass,
      target: act.target,
      actionClass: act.actionClass,
      actor: { kind: 'system', id: `approval-mode:${mode}` },
      ttlMs: MODE_GRANT_TTL_MS
    })
    return { grantId: issued.grantId, mode }
  } catch (e) {
    // A grant the mode could not issue is no grant: the act waits for the owner, as in the default mode.
    ops.failed('effect.mode-grant', e, { note: 'the approval mode could not issue its grant; the act waits for the owner' })
    return null
  }
}
// #endregion approval-mode-grant
