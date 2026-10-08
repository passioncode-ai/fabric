// #region usage-analytics-setting — docs: docs/ANALYTICS.md#the-shared-installation-id
// SCR-52 Settings → "Share usage counts" (SCN-134). One switch every PassionCode app on this Mac shares;
// a build without the App Key, or an unreadable shared file, shows why the switch cannot be used.
import { useEffect, useState } from 'react'
import type { AnalyticsStatus } from '../../shared/types'
import { useT } from './i18n'
import { ANALYTICS_CHANGED, announceAnalytics } from './UsageCountsNotice'

export function UsageCountsSetting(): React.JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<AnalyticsStatus | 'unreadable' | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    window.fabric.analytics.status().then((s) => { if (live) setStatus(s) }, () => { if (live) setStatus('unreadable') })
    // The first-run notice may answer the switch while Settings is open (A7-012).
    const changed = (e: Event): void => { if (live) setStatus({ availability: (e as CustomEvent<AnalyticsStatus['availability']>).detail }) }
    window.addEventListener(ANALYTICS_CHANGED, changed)
    return () => { live = false; window.removeEventListener(ANALYTICS_CHANGED, changed) }
  }, [])
  const toggle = async (enabled: boolean): Promise<void> => {
    setBusy(true)
    try { const s = await window.fabric.analytics.setEnabled(enabled); setStatus(s); announceAnalytics(s.availability) } catch { setStatus('unreadable') } finally { setBusy(false) }
  }
  const availability = status === null || status === 'unreadable' ? null : status.availability
  // Not yet answered (A7-012): shown on, as it will be; answering it here is the disclosure, the note above says what is counted.
  const shown = availability === 'on' || availability === 'pending-disclosure'
  const usable = shown || availability === 'off'
  return (
    <div className="settings-usage">
      <label>
        {/* An unread state is neither on nor off: an unchecked box would say "off" (0.3.2 verification UX-13). */}
        <input type="checkbox" checked={shown} disabled={!usable || busy}
          ref={(box) => { if (box) box.indeterminate = status === 'unreadable' }}
          onChange={(e) => void toggle(e.target.checked)} />
        {' '}{t('analytics.label')}
      </label>
      <span className="settings-note">
        {status === 'unreadable' ? t('analytics.unreadable')
          : availability === 'unavailable-no-key' ? t('analytics.noKey')
          : availability === 'unavailable-file' ? t('analytics.noFile')
          : t('analytics.note')}
      </span>
    </div>
  )
}
// #endregion usage-analytics-setting
