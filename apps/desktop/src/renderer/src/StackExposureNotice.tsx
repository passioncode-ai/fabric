// #region stack-exposure — docs: docs/ux/scenarios.md#scn-073-диагностика
// The local stack answering on this Mac's network (audit 2026-10-05 A7-001, P0), said where the person
// looks: above every screen (one banner; i3 DO-1). The check runs in the main process after the stack
// starts and again when a reading is older than five minutes; this only reads it. Nothing is shown
// while no check has finished, or when nothing answered — a warning is a measurement, not a default.

import { useEffect, useState } from 'react'
import type { StackExposureView } from '../../shared/types'
import { Banner } from './components'
import { useT } from './i18n'
import { CopyButton } from './start/StartPaths'

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
  // Compact by design (0.3.3 UI pass): the risk in one sentence, then one row per engine with the
  // command set as code and a copy button. Why Fabric cannot fix it itself is one click away, not a
  // paragraph above every screen — it was four lines tall and pushed each screen's heading down.
  return (
    <Banner tone="warn">
      <b>{t('diagnostics.exposure.title')}</b>
      <p>
        {t('diagnostics.exposure.body', {
          ports: [...new Set(view.exposed.map((x) => x.port))].join(', '),
          ifaces: [...new Set(view.exposed.map((x) => x.iface))].join(', ')
        })}
      </p>
      <ul className="banner-remedy" aria-label={t('diagnostics.exposure.remedyLabel')}>
        <li>
          <b>{t('diagnostics.exposure.orbstack')}</b>
          <code>{t('diagnostics.exposure.orbstackCommand')}</code>
          <CopyButton text={t('diagnostics.exposure.orbstackCommand')} what={t('diagnostics.exposure.orbstack')} />
          <span>{t('diagnostics.exposure.orbstackAfter')}</span>
        </li>
        <li>
          <b>{t('diagnostics.exposure.docker')}</b>
          <span>{t('diagnostics.exposure.dockerBefore')}</span>
          <code>{t('diagnostics.exposure.dockerSetting')}</code>
          <CopyButton text={t('diagnostics.exposure.dockerSetting')} what={t('diagnostics.exposure.docker')} />
          <span>{t('diagnostics.exposure.dockerAfter')}</span>
        </li>
      </ul>
      <details className="banner-why">
        <summary>{t('diagnostics.exposure.why')}</summary>
        <p>{t('diagnostics.exposure.whyBody')}</p>
      </details>
    </Banner>
  )
}
// #endregion stack-exposure
