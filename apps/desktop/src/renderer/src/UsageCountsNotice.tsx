// #region usage-analytics-notice — docs: docs/ANALYTICS.md#nothing-before-the-disclosure
// A7-012 (ADR-0127): a release build sends no usage count until the person has seen what is counted and answered
// the switch once. This notice is that first answer; Settings → Share usage counts (SCR-52) is the other way to
// give it. Until one of them is answered the main process holds every event, `app_installed` included.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Banner, Button } from './components'
import type { AnalyticsStatus } from '../../shared/types'
import { useT } from './i18n'

/** Fired by either surface after the switch is written; `detail` is the availability the main process answered. */
export const ANALYTICS_CHANGED = 'fabric:analytics-changed'
export const announceAnalytics = (availability: AnalyticsStatus['availability']): void => {
  window.dispatchEvent(new CustomEvent(ANALYTICS_CHANGED, { detail: availability }))
}

export function UsageCountsNotice(): React.JSX.Element | null {
  const t = useT()
  const [pending, setPending] = useState(false)
  const [share, setShare] = useState(true)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // An install from 0.3.2 already sent counts from its first start; for it "nothing has been sent yet" is false.
  const [sentBefore, setSentBefore] = useState(false)
  const continueRef = useRef<HTMLButtonElement | null>(null)
  const read = useCallback(() => {
    // A status that cannot be read — or a host without the analytics API — shows no notice: the main process still
    // sends nothing until it is answered.
    try {
      window.fabric.analytics.status().then((s) => { setPending(s.availability === 'pending-disclosure'); setSentBefore(s.sentBefore === true) }, () => setPending(false))
    } catch { setPending(false) }
  }, [])
  useEffect(() => {
    read()
    const changed = (e: Event): void => setPending((e as CustomEvent<AnalyticsStatus['availability']>).detail === 'pending-disclosure')
    window.addEventListener(ANALYTICS_CHANGED, changed)
    return () => window.removeEventListener(ANALYTICS_CHANGED, changed)
  }, [read])
  useEffect(() => { if (pending) continueRef.current?.focus() }, [pending])
  if (!pending) return null
  const answer = async (): Promise<void> => {
    setBusy(true); setFailed(false)
    try {
      const s = await window.fabric.analytics.setEnabled(share)
      if (s.availability === 'pending-disclosure') setFailed(true)
      else announceAnalytics(s.availability)
    } catch { setFailed(true) } finally { setBusy(false) }
  }
  return (
    <Banner
      tone="warn"
      actions={
        <>
          <label className="usage-notice-switch">
            <input type="checkbox" checked={share} disabled={busy} onChange={(e) => setShare(e.target.checked)} />
            {' '}{t('analytics.label')}
          </label>
          <Button ref={continueRef} disabled={busy} onClick={() => void answer()}>{t('analytics.notice.continue')}</Button>
        </>
      }
    >
      <strong>{t('analytics.notice.title')}</strong>
      <p>{t('analytics.note')}</p>
      <p>{t(sentBefore ? 'analytics.notice.sentBefore' : 'analytics.notice.nothingYet')}</p>
      {failed && <p>{t('analytics.notice.failed')}</p>}
    </Banner>
  )
}
// #endregion usage-analytics-notice
