// #region stack-exposure — docs: docs/ux/scenarios.md#scn-073-диагностика
// The local stack answering on this Mac's network (audit 2026-10-05 A7-001, P0), said where the person
// looks: above every screen, and in Diagnostics. The check runs in the main process after the stack
// starts and again when a reading is older than five minutes; this only reads it. Nothing is shown
// while no check has finished, or when nothing answered — a warning is a measurement, not a default.

import { useEffect, useState } from 'react'
import type { StackExposureView } from '../../shared/types'
import { Banner } from './components'
import { useT } from './i18n'

const RECHECK_MS = 5 * 60_000

export function StackExposureNotice(): React.JSX.Element | null {
  const t = useT()
  const [view, setView] = useState<StackExposureView | null>(null)

  useEffect(() => {
    let alive = true
    const read = (): void => {
      void window.fabric.stack.exposure().then(
        (v) => alive && setView(v),
        // An unreadable check shows no warning rather than a false one; the main process records why.
        () => {}
      )
    }
    read()
    const timer = setInterval(read, RECHECK_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  if (!view || view.exposed.length === 0) return null
  return (
    <Banner tone="warn">
      <b>{t('diagnostics.exposure.title')}</b>
      <p>
        {t('diagnostics.exposure.body', {
          ports: [...new Set(view.exposed.map((x) => x.port))].join(', '),
          ifaces: [...new Set(view.exposed.map((x) => x.iface))].join(', ')
        })}
      </p>
      <p>{t('diagnostics.exposure.remedy')}</p>
    </Banner>
  )
}
// #endregion stack-exposure
