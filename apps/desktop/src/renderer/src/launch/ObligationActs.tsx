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
import type { HubActResult, PendingRequestFacts } from '../../../shared/access'
import { sayActRefusal, sayAllow, sayAllowFor, sayAsk, sayConnectDetail, sayConnectProblem, sayFloor, sayIncremental, sayOrigin, shownName } from '../../../shared/accessWords'
import { humaniseError } from '../../../shared/errorText'
import { useT } from '../i18n'

export interface ObligationLike {
  subject: EntityRef
  projectId: string | null
  grantable?: { floorClass: string; target: string }
  proposal?: { id: string; depth: number; bound: number }
  /** ADR-0115: an external agent waiting on consent; the act is Allow or Deny, right here, on the prompt's facts. */
  access?: PendingRequestFacts
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
  return { outcome, deciding, decide, stillDecidable, reload }
}

export function ObligationActs({ item, decisions, onOpen, onError, onAccessDecided }: {
  item: ObligationLike
  decisions: ReturnType<typeof useProposalDecisions>
  onOpen: (projectId: string, focus: EntityRef) => void
  onError: (m: string) => void
  /** An access request was answered: what to say about it, named, after its row has left the queue; `detail`
   *  is the machine's words behind a connect problem, a line of their own (UX-5). */
  onAccessDecided?: (said: string, detail: string | null) => void
}): React.JSX.Element | null {
  const t = useT()
  const at = opensAt(item)
  const { outcome, deciding, decide, stillDecidable } = decisions
  const p = item.proposal
  // An access request is its own block: the prompt's facts above, its two buttons below (UX-8).
  if (item.access) return <AccessActs access={item.access} onError={onError} reload={decisions.reload} onDecided={onAccessDecided} />
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
 *  Before either button it says what the native prompt says — the same decision, on the same facts, in
 *  the operator's language (verification iteration 1 for 0.3.1: UX-2, UX-4, UX-5, UX-8).
 *
 *  THE ANSWER IS THIS REQUEST'S (iteration 2, UX-1): the board keys these acts by the row, so opening
 *  another request never shows this one's "Allowed"; and a decision re-reads the queue and hands the board
 *  a named sentence to keep, because the row itself leaves the list once the decision is projected. */
function AccessActs({ access, onError, reload, onDecided }: {
  access: PendingRequestFacts
  onError: (m: string) => void
  reload: () => Promise<void>
  onDecided?: (said: string, detail: string | null) => void
}): React.JSX.Element {
  const t = useT()
  const requestId = access.requestId
  const name = shownName(access.agent)
  const [state, setState] = useState<'open' | 'deciding' | 'allowed' | 'denied'>('open')
  const [connectProblem, setConnectProblem] = useState<string | null>(null)
  const [saw, setSaw] = useState<string | null>(null)
  const decide = async (decision: 'allowed' | 'denied'): Promise<void> => {
    if (state === 'deciding') return
    setState('deciding')
    try {
      const r: HubActResult = await window.fabric.hub.decide(requestId, decision)
      if (r.ok) {
        // Allowed, but the product could not be opened: the Allow stands, and the row says so beside it.
        const problem = r.connect ? sayConnectProblem(t, r.connect.problem, access.product) : null
        const detail = r.connect ? sayConnectDetail(t, r.connect.problem) : null
        if (problem) { setConnectProblem(problem); setSaw(detail) }
        setState(decision)
        onDecided?.(problem
          ? t('access.queue.allowedNotConnected', { name, product: access.product, problem })
          : t(decision === 'allowed' ? 'access.queue.allowed' : 'access.queue.denied', { name, product: access.product }), detail)
      } else {
        setState('open')
        onError(r.code ? sayActRefusal(t, r.code) : r.problem ? sayConnectProblem(t, r.problem, access.product) : humaniseError(r.reason).detail)
      }
    } catch (e) {
      setState('open')
      onError(humaniseError(e).detail)
    }
    await reload()
  }
  if (state === 'allowed' || state === 'denied')
    return (
      <div className="lp-actions">
        <span role="status" className="lp-meta">
          {connectProblem ? t('access.allowedConnect', { problem: connectProblem }) : t(state === 'allowed' ? 'access.allowedHere' : 'access.deniedHere')}
        </span>
        {saw && <span className="lp-meta">{saw}</span>}
      </div>
    )
  return (
    <>
      <div className="lp-access-facts">
        <p className="lp-meta">{sayOrigin(t, access.agent)}</p>
        <ul className="lp-facts-asks">{access.ask.map((l, i) => <li key={i}>{sayAsk(t, l)}</li>)}</ul>
        <p className="lp-meta">{t('access.pending.reason', { reason: access.reason })}</p>
        <p className="lp-meta">{sayFloor(t)}</p>
        {access.incremental && <p className="lp-meta">{sayIncremental(t)}</p>}
        <p className="lp-meta">{t('access.lasts')}</p>
        <p className="lp-meta">{t('access.denyStands')}</p>
      </div>
      <div className="lp-actions">
        <button type="button" className="lp-button" aria-label={t('access.denyFor', { name })} aria-disabled={state === 'deciding' ? true : undefined} onClick={() => void decide('denied')}>{t('access.deny')}</button>
        <button type="button" className="lp-button primary" aria-label={sayAllowFor(t, access, name)} aria-disabled={state === 'deciding' ? true : undefined} onClick={() => void decide('allowed')}>{sayAllow(t, access)}</button>
      </div>
    </>
  )
}
