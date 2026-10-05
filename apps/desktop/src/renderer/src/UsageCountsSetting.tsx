// #region usage-analytics-setting — docs: docs/ANALYTICS.md#the-shared-installation-id
// SCR-52 Settings → "Share anonymous usage counts" (SCN-134). One switch every PassionCode app on this Mac shares;
// a build without the App Key, or an unreadable shared file, shows why the switch cannot be used.
import { useEffect, useState } from 'react'
import type { AnalyticsStatus } from '../../shared/types'
import { useT } from './i18n'

export function UsageCountsSetting(): React.JSX.Element {
  const t = useT()
  const [status, setStatus] = useState<AnalyticsStatus | 'unreadable' | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    window.fabric.analytics.status().then((s) => { if (live) setStatus(s) }, () => { if (live) setStatus('unreadable') })
    return () => { live = false }
  }, [])
  const toggle = async (enabled: boolean): Promise<void> => {
    setBusy(true)
    try { setStatus(await window.fabric.analytics.setEnabled(enabled)) } catch { setStatus('unreadable') } finally { setBusy(false) }
  }
  const availability = status === null || status === 'unreadable' ? null : status.availability
  const usable = availability === 'on' || availability === 'off'
  return (
    <div className="settings-usage">
      <label>
        <input type="checkbox" checked={availability === 'on'} disabled={!usable || busy}
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
