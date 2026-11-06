// #region review-decision-card — docs: docs/ux/scenarios.md#scn-179-decide-on-work-handed-in-for-review-in-one-place
/**
 * SCN-179 (CO-521): a task in review asks the person one thing, and says it. On the left: what the agent handed in, in
 * its own words, who and when. On the right: the three answers at once, «Принять», «Вернуть в работу», «Отменить»,
 * and one comment field. The comment goes with the answer: kept on the task when accepting, and the words the project's
 * agents read with the task when it is returned (`fabric_work_list`'s `operator_said`); returning and cancelling need it.
 * The operator, 2026-11-06: a review page said «Запуска ещё не было» and «Спецификация не собрана» and nothing of
 * what was wanted; this card is that page's first thing for a task in review.
 */
import { useState } from 'react'
import type { ReviewAsk, ReviewDecision as Decision } from '../../../shared/reviewDecision.ts'
import { reviewDecisionProblem } from '../../../shared/reviewDecision.ts'
import { useT } from '../i18n'
import { since } from '../duration'

export function ReviewDecision({
  taskId,
  ask,
  onDecided,
  compact = false
}: {
  taskId: string
  ask: ReviewAsk
  /** After an answer was recorded: the caller re-reads the task (it has left review). */
  onDecided: (decision: Decision) => void
  /** In a list row: the agent's words shortened to three lines. */
  compact?: boolean
}): React.JSX.Element {
  const t = useT()
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState<Decision | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<Decision | null>(null)

  const send = async (decision: Decision): Promise<void> => {
    const gap = reviewDecisionProblem(decision, comment)
    if (gap === 'return-needs-comment') return setProblem(t('review.needsComment'))
    if (gap === 'cancel-needs-reason') return setProblem(t('review.needsReason'))
    setProblem(null)
    setBusy(decision)
    try {
      const r = await window.fabric.tasks.decide(taskId, decision, comment)
      if (!r.ok) return setProblem(t('review.refused', { reason: r.reason }))
      setDone(decision)
      onDecided(decision)
    } catch (e) {
      setProblem(t('review.refused', { reason: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusy(null)
    }
  }

  if (done) return <section className="rd rd-done" role="status"><p className="rd-said">{t(`review.done.${done}` as 'review.done.accept')}</p></section>

  const who = t(`review.by.${ask.by}` as 'review.by.agent')
  return (
    <section className={compact ? 'rd rd-compact' : 'rd'} aria-label={t('review.title')}>
      <div className="rd-ask">
        <h3 className="rd-title">{t('review.title')}</h3>
        <p className="lp-meta">{t('review.handedIn', { who, when: since(ask.at, t) })}</p>
        {ask.said
          ? <blockquote className={compact ? 'rd-said rd-clamp' : 'rd-said'}>{ask.said}</blockquote>
          : <p className="rd-said rd-none">{t('review.saidNothing')}</p>}
        <p className="lp-meta">{t('review.question')}</p>
      </div>
      <div className="rd-answer">
        <div className="rd-buttons">
          <button type="button" className="lp-button primary" disabled={busy !== null} aria-busy={busy === 'accept'} onClick={() => void send('accept')}>{t('review.accept')}</button>
          <button type="button" className="lp-button" disabled={busy !== null} aria-busy={busy === 'return'} onClick={() => void send('return')}>{t('review.return')}</button>
          <button type="button" className="lp-button" disabled={busy !== null} aria-busy={busy === 'cancel'} onClick={() => void send('cancel')}>{t('review.cancel')}</button>
        </div>
        <label className="lp-field rd-comment">
          <span>{t('review.commentLabel')}</span>
          <textarea rows={compact ? 2 : 3} value={comment} placeholder={t('review.commentHint')} onChange={(e) => setComment(e.target.value)} />
        </label>
        {problem && <p className="lp-meta rd-problem" role="alert">{problem}</p>}
      </div>
    </section>
  )
}
// #endregion review-decision-card
