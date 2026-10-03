// The acts that resolve a derived obligation (SCR-41), moved here from the CEO panel so the
// board screen and anything else that shows an obligation share ONE door: deciding a
// proposal, granting a refused capability, opening the thing exactly.
//
// The rules they carry are the CEO panel's, unchanged (UX28-12): a decision's answer is
// KEPT, keyed by the proposal it was about; a decided proposal stops offering its acts
// unless the refusal was retryable; a throw is reported and the queue re-read, because a
// rejected invoke does not say whether the append landed.

import { useState } from 'react'
import type { ProposalDecideResult } from '../../../shared/types'
import type { EntityRef } from '../../../shared/entityRef'
import { destinationOf } from '../../../shared/entityRef.ts'
import type { AccessFacts } from '../../../shared/attention'
import { useT } from '../i18n'

export interface ObligationLike {
  subject: EntityRef
  projectId: string | null
  grantable?: { floorClass: string; target: string }
  proposal?: { id: string; depth: number; bound: number }
  /** ADR-0115: an external agent waiting on consent; the act is Allow or Deny, right here, on the prompt's facts. */
  access?: AccessFacts & { requestId: string; callee: string; expiresAt: string }
}

/** Where an obligation opens, decided by the one resolver; null when nowhere exact. */
export function opensAt(item: ObligationLike): { projectId: string; focus: EntityRef } | null {
  const d = destinationOf({ ref: item.subject, projectId: item.projectId })
  return d.at === 'exact' ? { projectId: d.projectId, focus: d.focus } : null
}

/** Decisions on proposals, keyed by proposal: one shared slot would print row A's refusal under row B. */
export function useProposalDecisions(reload: () => Promise<void>, onError: (m: string) => void) {
  const [outcome, setOutcome] = useState<Record<string, ProposalDecideResult>>({})
  const [deciding, setDeciding] = useState<string | null>(null)
  const decide = async (id: string, decision: 'accepted' | 'declined'): Promise<void> => {
    setDeciding(id)
    try {
      const result = await window.fabric.proposals.decide(id, decision)
      setOutcome((prev) => ({ ...prev, [id]: result }))
      await reload()
    } catch (e) {
      onError(String(e))
      await reload()
    } finally {
      setDeciding(null)
    }
  }
  /** Read-your-own-write through the projection is not immediate, so the acts are settled by
   *  the decision's own answer, not by the row leaving the list. */
  const stillDecidable = (id: string): boolean => {
    const answer = outcome[id]
    if (!answer) return true
    if (answer.ok) return false
    return answer.rejection?.retryable === true
  }
  return { outcome, deciding, decide, stillDecidable }
}

export function ObligationActs({ item, decisions, onOpen, onError }: {
  item: ObligationLike
  decisions: ReturnType<typeof useProposalDecisions>
  onOpen: (projectId: string, focus: EntityRef) => void
  onError: (m: string) => void
}): React.JSX.Element | null {
  const t = useT()
  const at = opensAt(item)
  const { outcome, deciding, decide, stillDecidable } = decisions
  const p = item.proposal
  return (
    <div className="lp-actions">
      {p && (
        <>
          <span className="lp-meta">{t('attention.proposal', { depth: p.depth, bound: p.bound })}</span>
          {outcome[p.id]?.ok && (
            <span role="status" className="lp-meta">
              {outcome[p.id]?.taskId ? t('attention.becameTask', { task: outcome[p.id]!.taskId! }) : t('attention.chainEnded')}
            </span>
          )}
          {outcome[p.id]?.rejection && (
            <span role="alert" className="lp-meta">
              {t('attention.decisionRefused', { says: outcome[p.id]!.rejection!.says, remedy: outcome[p.id]!.rejection!.remedy })}
            </span>
          )}
          {stillDecidable(p.id) && (
            <>
              <button type="button" className="lp-button primary" disabled={deciding === p.id} onClick={() => void decide(p.id, 'accepted')}>
                {t('attention.accept')}
              </button>
              <button type="button" className="lp-button" disabled={deciding === p.id} onClick={() => void decide(p.id, 'declined')}>
                {t('attention.decline')}
              </button>
            </>
          )}
        </>
      )}
      {item.access && <AccessActs access={item.access} onError={onError} />}
      {!p && item.grantable && (
        <button type="button" className="lp-button primary"
          onClick={() =>
            void window.fabric.attention
              .grant({ projectId: item.projectId, floorClass: item.grantable!.floorClass, target: item.grantable!.target })
              .catch((e) => onError(String(e)))
          }>
          {t('ceo.grant')}
        </button>
      )}
      {at && (
        <button type="button" className="lp-button" onClick={() => onOpen(at.projectId, at.focus)}>
          {t('ceo.openIt')}
        </button>
      )}
    </div>
  )
}

/** Allow or Deny an external agent's request where it waits in the queue (SCN-132). The answer is kept,
 *  because the queue re-reads on its own schedule and the row must not offer the act twice meanwhile.
 *  Before either button it says what the native prompt says — the same decision, on the same facts. */
function AccessActs({ access, onError }: { access: AccessFacts & { requestId: string }; onError: (m: string) => void }): React.JSX.Element {
  const t = useT()
  const requestId = access.requestId
  const [state, setState] = useState<'open' | 'deciding' | 'allowed' | 'denied'>('open')
  const decide = async (decision: 'allowed' | 'denied'): Promise<void> => {
    setState('deciding')
    try {
      const r = await window.fabric.hub.decide(requestId, decision)
      if (r.ok) setState(decision)
      else { setState('open'); onError(r.reason) }
    } catch (e) {
      setState('open')
      onError(String(e))
    }
  }
  if (state === 'allowed' || state === 'denied')
    return <span role="status" className="lp-meta">{t(state === 'allowed' ? 'access.allowedHere' : 'access.deniedHere')}</span>
  return (
    <>
      <span className="lp-meta">{access.origin}</span>
      <span className="lp-meta">{t('access.pending.reason', { reason: access.reason })}</span>
      <span className="lp-meta">{access.floor}</span>
      {access.incremental && <span className="lp-meta">{access.incremental}</span>}
      <button type="button" className="lp-button" disabled={state === 'deciding'} onClick={() => void decide('denied')}>{t('access.deny')}</button>
      <button type="button" className="lp-button primary" disabled={state === 'deciding'} onClick={() => void decide('allowed')}>{t('access.allow')}</button>
    </>
  )
}
