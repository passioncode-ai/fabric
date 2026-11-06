// #region overlap-decision — docs: docs/evidence/specs/2026-11-06-session-coordination.md#5-waves
/**
 * CO-522 wave B part 2: two sessions whose claims overlap past fifteen minutes are the person's to decide, where the
 * item is read. Three answers: the second waits (its task follows the first), it hands its task to the first, or both go
 * on split. The decision is noted on both tasks and told to both sessions at the next sweep (`abandonedSweep.ts`).
 */
import { useState } from 'react'
import { useT } from '../i18n'

export function OverlapDecision({ itemKey }: { itemKey: string }): React.JSX.Element {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const decide = async (choice: 'wait' | 'handover' | 'split'): Promise<void> => {
    setBusy(true)
    setSaid(null)
    try {
      const r = await window.fabric.work.overlapDecide({ key: itemKey, choice })
      if (r.ok) setDone(true)
      else setSaid(t('overlap.refused', { reason: r.reason }))
    } catch (e) {
      setSaid(t('overlap.refused', { reason: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusy(false)
    }
  }
  if (done) return <p className="lp-meta" role="status">{t('overlap.done')}</p>
  return (
    <div className="ov">
      <p className="lp-meta">{t('overlap.lede')}</p>
      <div className="lo-acts" role="group">
        <button type="button" className="lp-button primary" disabled={busy} onClick={() => void decide('wait')}>{t('overlap.wait')}</button>
        <button type="button" className="lp-button" disabled={busy} onClick={() => void decide('handover')}>{t('overlap.handover')}</button>
        <button type="button" className="lp-button" disabled={busy} onClick={() => void decide('split')}>{t('overlap.split')}</button>
      </div>
      {said && <p className="lp-meta" role="alert">{said}</p>}
    </div>
  )
}
// #endregion overlap-decision
