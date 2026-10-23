// #region stack-health-notice — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// The local stack while Fabric runs (0.3.9 ST-2, ST-1), said where the person looks: above every screen, because with
// the database gone every screen is broken and a quiet one reads as Fabric having hung. The main process's watch
// decides (`main/stackWatch.ts`); this reads its last view once and then hears each change. Nothing is shown while the
// stack is up and the disk has room.

import { useEffect, useState } from 'react'
import type { StackHealthView } from '../../shared/types'
import { freeDiskGb } from '../../shared/startupFailure'
import { platformKey } from '../../shared/stackWatch'
import { Banner } from './components'
import { useLocale, useT } from './i18n'
import type { StringKey } from './i18n/en'

export function StackHealthNotice(): React.JSX.Element | null {
  const t = useT()
  const locale = useLocale()
  const [view, setView] = useState<StackHealthView | null>(null)
  // CO-374: the next try's moment, counted down here each second; a view only says how many seconds were left when read.
  const [nextAt, setNextAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const take = (v: StackHealthView): void => {
    const at = Date.now()
    setView(v)
    setNow(at)
    setNextAt(v.nextTryInS === null ? null : at + v.nextTryInS * 1000)
  }

  useEffect(() => {
    let alive = true
    const stack = window.fabric?.stack
    // A bridge without the watch (an older preload) shows nothing rather than a broken screen.
    if (typeof stack?.health !== 'function') return
    void stack.health().then((v) => alive && v && take(v), () => {})
    const off = typeof stack.onHealth === 'function' ? stack.onHealth((v) => alive && take(v)) : () => {}
    return () => {
      alive = false
      off()
    }
  }, [])
  useEffect(() => {
    if (view?.stack !== 'down' || nextAt === null) return
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [view?.stack, nextAt])
  const nextTryInS = nextAt === null ? null : Math.max(0, Math.ceil((nextAt - now) / 1000))

  if (!view) return null
  const free = view.freeDiskBytes === null ? null : freeDiskGb(view.freeDiskBytes, locale)
  if (view.stack === 'down') {
    // Said as it is (0.3.9 review UX-2, UX-4, ER-3): a stack Fabric does not bring back is waited for, never promised;
    // a try in flight is said as one, never as a countdown frozen at 0; each OS names its own Docker.
    const cause: StringKey =
      view.hold === 'external' ? 'stack.health.external'
        : view.hold === 'stopped' ? 'stack.health.stopped'
          : view.hold === 'running' ? 'stack.health.waitingContainers'
            : view.why === 'docker' ? (platformKey('stack.health.docker', view.platform ?? 'darwin') as StringKey)
              : 'stack.health.database'
    return (
      <Banner>
        <b>{t('stack.health.title')}</b>
        {view.diskLikelyCause && free !== null && <p>{t('stack.health.diskCause', { free })}</p>}
        <p>{t(cause)}</p>
        {view.trying && view.attempt !== null ? <p>{t('startup.wait.trying', { attempt: view.attempt })}</p>
          : nextTryInS !== null && <p>{t('stack.health.nextTry', { seconds: nextTryInS })}</p>}
      </Banner>
    )
  }
  if (view.diskLow && free !== null)
    return (
      <Banner tone="warn">
        <b>{t('stack.health.diskTitle')}</b>
        <p>{t('stack.health.diskLow', { free })}</p>
      </Banner>
    )
  return null
}
// #endregion stack-health-notice
