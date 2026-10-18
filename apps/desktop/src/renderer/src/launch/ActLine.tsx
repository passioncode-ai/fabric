// #region act-line — docs: docs/ux/scenarios.md#scn-169-undo-an-act-or-read-why-it-cannot-be-undone
/**
 * The act line (ADR-0160 §1, plan §7 "the act line"; 0.3.7 wave 3): after an act the place shows ONE quiet line at
 * its foot, «{что сделано} · Отменить», until the next act or until the person leaves the place; История keeps every
 * act. No toast, no banner, no dialog: a polite status line.
 *
 * WHICH ACT. The newest `act.recorded@1` the PERSON did since they came to this place, read from the journal the shell
 * already reads every two seconds (`latestPersonAct`). One source for every act, whichever control did it, so no
 * control has to remember to hand its act to the line, and an undo — itself an act — replaces the line with its own
 * («Отменено: …», with «Отменить» again: an undo can be redone).
 *
 * «Отменить» calls wave 2's `acts.undo(seq)`. A second press while the first runs is not sent (the main process
 * refuses it too, `already_undone`). A refused undo changes nothing and says why in our words, the machine's beneath,
 * and the button can be pressed again.
 */
import { useEffect, useState } from 'react'
import { ACT_EVENT, validateActRecord, type ActAnswer, type ActRecord } from '../../../shared/acts.ts'
import { useT } from '../i18n'
import { actSentence, whyWords } from './actWords'

export interface LineAct { seq: number; record: ActRecord }

/** The newest act of the person after `sinceSeq`, from the events the shell has read; null when there is none. */
export function latestPersonAct(
  feed: ReadonlyArray<{ seq: number; type: string; actor: { kind: string }; payload: Record<string, unknown> }> | null,
  sinceSeq: number
): LineAct | null {
  for (let i = (feed?.length ?? 0) - 1; i >= 0; i--) {
    const e = feed![i]
    if (e.seq <= sinceSeq) return null
    if (e.type !== ACT_EVENT || e.actor.kind !== 'person') continue
    const record = validateActRecord(e.payload)
    if (record) return { seq: e.seq, record }
  }
  return null
}

type LineState = { at: 'idle' } | { at: 'undoing' } | { at: 'undone' } | { at: 'refused'; why: string; says?: string }

export function ActLine({ act, onUndo, onUndone }: {
  act: LineAct | null
  onUndo(seq: number): Promise<ActAnswer>
  /** The undo went through: the shell re-reads what the undo changed outside the journal (a restored draft). */
  onUndone?(act: LineAct): void
}): React.JSX.Element | null {
  const t = useT()
  const [state, setState] = useState<LineState>({ at: 'idle' })
  const seq = act?.seq ?? null
  // A new act is a new line: what the last one said does not carry over.
  useEffect(() => { setState({ at: 'idle' }) }, [seq])
  if (!act) return null
  const undo = async (): Promise<void> => {
    if (state.at === 'undoing' || state.at === 'undone') return
    setState({ at: 'undoing' })
    let answer: ActAnswer
    try {
      answer = await onUndo(act.seq)
    } catch (e) {
      // Not silence: an undo the main process could not even answer is said as a failure, the button enabled again.
      answer = { ok: false, reason: 'failed', says: e instanceof Error ? e.message : String(e) }
    }
    if (answer.ok) {
      setState({ at: 'undone' })
      onUndone?.(act)
    } else setState({ at: 'refused', why: answer.reason, ...(answer.says ? { says: answer.says } : {}) })
  }
  const r = act.record
  return (
    <div className="act-line" role="status" aria-live="polite">
      <span className="act-line-said">{actSentence(t, r)}</span>
      {r.inverse ? (
        <>
          <span aria-hidden="true"> · </span>
          {state.at === 'undone'
            ? <span className="act-line-done">{t('act.undoneNow')}</span>
            : <button type="button" className="act-line-undo" aria-label={t('act.undo')} aria-busy={state.at === 'undoing'}
                disabled={state.at === 'undoing'} onClick={() => void undo()}>
                {state.at === 'undoing' ? t('act.undoing') : t('act.undo')}
              </button>}
        </>
      ) : (
        <span className="act-line-cannot"> · {t('act.cannot', { why: whyWords(t, r.why_not ?? 'no_inverse') })}</span>
      )}
      {state.at === 'refused' && (
        <span className="act-line-refused">
          <span>{t('act.undoFailed', { why: whyWords(t, state.why) })}</span>
          {state.says && <small className="act-line-words">{state.says}</small>}
        </span>
      )}
    </div>
  )
}
// #endregion act-line
