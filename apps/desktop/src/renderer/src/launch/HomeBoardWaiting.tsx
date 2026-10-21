// #region board-core-holds-home — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
// What waits on the project board, on the home (0.3.9 BD-2): requests between projects that no agent can answer now, and
// board messages the projects they were sent to have not marked read. Measured before this (board.md BD-2): all six
// requests ever sent sat queued for days and nothing outside Comms said so. A failed read is said; nothing waiting
// shows nothing at all, so a quiet board costs the home no space.

import { useEffect, useState } from 'react'
import type { CommsWaitingReply } from '../../../shared/commsRead'
import { useLocale, useT } from '../i18n'
import { since } from '../duration'
import { FailureNote } from '../OperatorError'

const REFRESH_MS = 60_000

type Reading = { kind: 'reading' } | { kind: 'read'; reply: CommsWaitingReply } | { kind: 'failed'; detail: string }

/** Reads `comms.waiting` when the journal's board events move and once a minute, so an age keeps counting. */
export function HomeBoardWaiting({ mark, onComms }: { mark: number; onComms?: () => void }): React.JSX.Element | null {
  const t = useT()
  const locale = useLocale()
  const [reading, setReading] = useState<Reading>({ kind: 'reading' })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), REFRESH_MS)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    let alive = true
    // Through a promise, so a build without the read (an older preload, a test double) is said rather than thrown.
    Promise.resolve().then(() => window.fabric.comms.waiting()).then(
      (reply) => alive && setReading({ kind: 'read', reply }),
      (e: unknown) => alive && setReading({ kind: 'failed', detail: e instanceof Error ? e.message : String(e) })
    )
    return () => { alive = false }
  }, [mark, tick])
  if (reading.kind === 'reading') return null
  if (reading.kind === 'failed') return <FailureNote said={t('launch.home.boardWaiting.unreadable')} detail={reading.detail} />
  const reply = reading.reply
  if (!reply.ok) return <FailureNote said={t('launch.home.boardWaiting.unreadable')} detail={reply.error.message} />
  if (reply.requests === 0 && reply.unread === 0) return null
  const count = (n: number): string => n.toLocaleString(locale)
  return (
    <section className="lp-panel lh-board-waiting" aria-labelledby="home-board-waiting-title" data-board-waiting={reply.requests}>
      <div className="lp-panel-head">
        <div>
          <p className="lp-kicker">{t('launch.home.boardWaiting.kicker')}</p>
          <h3 id="home-board-waiting-title">{t('launch.home.boardWaiting.title')}</h3>
        </div>
        {onComms && <button type="button" className="lp-button" onClick={onComms}>{t('launch.home.boardWaiting.open')}</button>}
      </div>
      {reply.requests > 0 && (
        <>
          <p>{t('launch.home.boardWaiting.requests', { count: count(reply.requests), age: reply.oldestRequestAt ? since(reply.oldestRequestAt, t) : '?' })}</p>
          <p className="lp-meta">{t('launch.home.boardWaiting.requestsHint')}</p>
        </>
      )}
      {reply.unread > 0 && (
        <p className="lp-meta">{t('launch.home.boardWaiting.unread', { count: count(reply.unread), age: reply.oldestUnreadAt ? since(reply.oldestUnreadAt, t) : '?' })}</p>
      )}
    </section>
  )
}
// #endregion board-core-holds-home
