// #region stack-health-notice — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
// The local stack while Fabric runs (0.3.9 ST-2, ST-1), said where the person looks: above every screen, because with
// the database gone every screen is broken and a quiet one reads as Fabric having hung. The main process's watch
// decides (`main/stackWatch.ts`); this reads its last view once and then hears each change. Nothing is shown while the
// stack is up and the disk has room.

import { useEffect, useState } from 'react'
import type { StackHealthView } from '../../shared/types'
import { freeDiskGb } from '../../shared/startupFailure'
import { DISK_RECOVERED_BYTES, platformKey } from '../../shared/stackWatch'
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
    // CO-594, 0.3.23 review, iteration 1 (UX-1, UX-3): under the disk hold, a stop Fabric made and saw end is said as its
    // own, with its own title and without the Docker cause beside it; a database that went down by itself on the
    // nearly full disk is said as down (Docker named when Docker is why), with the disk line first. The free space the
    // start waits for comes from the watch (UX-9), never a figure in the words.
    const diskStopped = view.hold === 'disk' && view.diskStopped === true
    const cause: StringKey =
      view.hold === 'external' ? 'stack.health.external'
        : view.hold === 'stopped' ? 'stack.health.stopped'
          : view.hold === 'running' ? 'stack.health.waitingContainers'
            : diskStopped ? 'stack.health.diskHold'
              : view.hold === 'disk' ? (view.why === 'docker' ? 'stack.health.diskDownDocker' : 'stack.health.diskDown')
                : view.why === 'docker' ? (platformKey('stack.health.docker', view.platform ?? 'darwin', view.runtime ?? null) as StringKey)
                  : 'stack.health.database'
    const mark = freeDiskGb(view.diskMarkBytes ?? DISK_RECOVERED_BYTES, locale)
    return (
      <Banner>
        <b>{t(diskStopped ? 'stack.health.diskStoppedTitle' : 'stack.health.title')}</b>
        {!diskStopped && view.diskLikelyCause && free !== null && <p>{t('stack.health.diskCause', { free })}</p>}
        <p>{t(cause, { mark })}</p>
        {/* The countdown ticks every second; inside the alert it would be announced again with every tick (0.3.12 review
            UX-5). The ticking line is shown and kept out of the live region; a screen reader hears, once, the moment of the
            next try, which stays true however late the notice is read (iteration 2, UX-6). */}
        {view.trying && view.attempt !== null ? <p>{t('startup.wait.trying', { attempt: view.attempt })}</p>
          : nextTryInS !== null && (
            <>
              <p aria-hidden="true" data-testid="stack-next-try">{t('stack.health.nextTry', { seconds: nextTryInS })}</p>
              {nextAt !== null && <span className="visually-hidden">{t('stack.health.nextTryAt', { time: new Date(nextAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}</span>}
            </>
          )}
      </Banner>
    )
  }
  // 0.3.23 review, iteration 2, UX-10: Fabric's last stop for the disk failed and the database still writes: said in plain
  // words after the free space, so the person frees space now.
  if ((view.diskLow || view.diskStopFailed === true) && free !== null)
    return (
      <Banner tone="warn">
        <b>{t('stack.health.diskTitle')}</b>
        <p>{t('stack.health.diskLow', { free })}</p>
        {view.diskStopFailed === true && <p>{t('stack.health.diskStopFailed')}</p>}
      </Banner>
    )
  return null
}
// #endregion stack-health-notice
