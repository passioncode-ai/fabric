// #region board-core-holds-home — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
// What waits on the project board, on the home (0.3.9 BD-2): requests between projects that no agent can answer now.
// Measured before this (board.md BD-2): all six requests ever sent sat queued for days and nothing outside Comms said
// so. A failed read is said; nothing waiting shows nothing at all, so a quiet board costs the home no space.
// Review i1 UX-1 / DA-8: the home shows only what the operator can act on. The unread-deliveries figure that stood here
// counted one copy per recipient project (3,103 on the operator's data, against 434 messages on the whole board) and no
// operator action lowered it; Comms keeps its own per-project counts. UX-7: the hint says what answers a request and
// sends the operator to no grant, since nothing can be granted until an agent asks. UX-10: the counts use the
// registry's colon form (no "1 requests"), and an age that is unknown or does not parse is left out, never "?".

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
  if (reply.requests === 0) return null
  const count = reply.requests.toLocaleString(locale)
  const at = reply.oldestRequestAt ? Date.parse(reply.oldestRequestAt) : NaN
  const said = Number.isFinite(at)
    ? t('launch.home.boardWaiting.requests', { count, age: since(reply.oldestRequestAt as string, t) })
    : t('launch.home.boardWaiting.requestsNoAge', { count })
  return (
    <section className="lp-panel lh-board-waiting" aria-labelledby="home-board-waiting-title" data-board-waiting={reply.requests}>
      <div className="lp-panel-head">
        <div>
          <p className="lp-kicker">{t('launch.home.boardWaiting.kicker')}</p>
          <h3 id="home-board-waiting-title">{t('launch.home.boardWaiting.title')}</h3>
        </div>
        {onComms && <button type="button" className="lp-button" onClick={onComms}>{t('launch.home.boardWaiting.open')}</button>}
      </div>
      <p>{said}</p>
      <p className="lp-meta">{t('launch.home.boardWaiting.requestsHint')}</p>
    </section>
  )
}
// #endregion board-core-holds-home
