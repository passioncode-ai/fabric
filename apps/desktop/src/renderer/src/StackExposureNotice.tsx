// #region stack-exposure — docs: docs/ux/scenarios.md#scn-073-диагностика
// The local stack answering on this Mac's network (audit 2026-10-05 A7-001, P0), said where the person
// looks. 0.3.7 wave 3 (ADR-0160 §5, SCN-163): a question on Главная with its fix, no longer a banner over every screen. The check runs in the main process after the stack
// starts and again when a reading is older than five minutes; this only reads it. Nothing is shown
// while no check has finished, or when nothing answered — a warning is a measurement, not a default.

import { useEffect, useState } from 'react'
import type { StackExposureView } from '../../shared/types'
import { useT } from './i18n'
import { CopyButton } from './start/StartPaths'

const RECHECK_MS = 5 * 60_000

export function StackExposureNotice(): React.JSX.Element | null {
  const t = useT()
  const [view, setView] = useState<StackExposureView | null>(null)

  useEffect(() => {
    let alive = true
    const read = (): void => {
      // An unreadable check shows no warning rather than a false one; the main process records why. A bridge without
      // the check (an older preload, a detached window) is the same: no question rather than a broken home.
      try {
        void window.fabric.stack.exposure().then((v) => alive && setView(v), () => {})
      } catch {
        /* no check to read: nothing is asked */
      }
    }
    read()
    const timer = setInterval(read, RECHECK_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  if (!view || view.exposed.length === 0) return null
  // Compact (the mockup-parity pass, 2026-10-27, gap map A6): one line with the risk, everything else behind one
  // disclosure, so the question no longer pushes the whole home down by a block. The check does not learn which
  // container engine serves the stack (`main/stackExposure.ts` only connects to the ports), so every engine's remedy is
  // listed: OrbStack, Docker Desktop and Colima, the engine this machine moved to (v2 R-26).
  const ports = [...new Set(view.exposed.map((x) => x.port))].join(', ')
  const ifaces = [...new Set(view.exposed.map((x) => x.iface))].join(', ')
  return (
    <section className="home-question lh-exposure" aria-labelledby="exposure-question">
      <details>
        <summary>
          <span className="lh-exposure-dot" aria-hidden="true" />
          <h3 id="exposure-question">{t('diagnostics.exposure.title')}</h3>
          <span className="lh-exposure-ports">{ports}</span>
          <span className="lh-exposure-how">{t('diagnostics.exposure.remedyLabel')}</span>
        </summary>
        <p>{t('diagnostics.exposure.body', { ports, ifaces })}</p>
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
          <li>
            <b>{t('diagnostics.exposure.colima')}</b>
            <span>{t('diagnostics.exposure.colimaBefore')}</span>
            <code className="lh-exposure-block">{t('diagnostics.exposure.colimaSetting')}</code>
            <CopyButton text={t('diagnostics.exposure.colimaSetting')} what={t('diagnostics.exposure.colima')} />
            <span>{t('diagnostics.exposure.colimaAfter')}</span>
            <code>{t('diagnostics.exposure.colimaCommand')}</code>
          </li>
        </ul>
        <details className="banner-why">
          <summary>{t('diagnostics.exposure.why')}</summary>
          <p>{t('diagnostics.exposure.whyBody')}</p>
        </details>
      </details>
    </section>
  )
}
// #endregion stack-exposure
