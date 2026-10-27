// #region board-core-holds-home — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
// What waits on the project board, on the home (0.3.9 BD-2): requests between projects that no agent is answering now
// (no session holds the request's slot: `board_waiting_operator`). Review i2 UX-5: said as "answering now" in both
// languages, since a live board.respond grant may still let a session take the slot, as the receipt's `noResponder` counts.
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

/** How many requests the home lists before «ещё N» (the approved mockup shows one or two). */
export const WAITING_SHOWN = 5

/** Reads `comms.waiting` when the journal's board events move and once a minute, so an age keeps counting. */
export function HomeBoardWaiting({ mark, onComms, nameOf }: {
  mark: number
  onComms?: () => void
  /** A project's printed name by id (`projectDisplayName`); absent: the id. */
  nameOf?: (projectId: string) => string | null
}): React.JSX.Element | null {
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
  // A project no list knows is said so, never printed as its id (the 0.3.15 review, iteration 1, UX-5).
  const name = (id: string | null): string => (id ? (nameOf ? (nameOf(id) ?? t('launch.home.boardWaiting.unknownProject')) : id) : t('launch.home.boardWaiting.fromNone'))
  const list = reply.list ?? null
  const shown = (list ?? []).slice(0, WAITING_SHOWN)
  // The mockup parity (home gap D11): one line per request, who asked whom and what, then who has not taken it and
  // since when. The count sentence stays only when the list is not the whole of what is waiting (cut, or not read).
  const whole = !!list && reply.listComplete === true
  const more = whole ? reply.requests - shown.length : 0
  // The approved mockup (2026-10-26, `.req`): inside the right column under a thin rule, a kicker «Запросы без ответа».
  return (
    <section className="lh-req" aria-labelledby="home-board-waiting-title" data-board-waiting={reply.requests}>
      <h3 id="home-board-waiting-title" className="lp-kicker" title={t('launch.home.boardWaiting.requestsHint')}>{t('launch.home.boardWaiting.kicker')}</h3>
      {shown.length > 0 && (
        <ul className="lh-req-list" aria-label={t('launch.home.boardWaiting.listLabel')}>
          {shown.map((r) => {
            const line = r.subject
              ? t('launch.home.boardWaiting.line', { from: name(r.from), to: name(r.to), subject: r.subject })
              : t('launch.home.boardWaiting.lineNoSubject', { from: name(r.from), to: name(r.to) })
            return (
              <li key={r.requestId}>
                <p className="lh-req-line">{onComms ? <button type="button" className="lp-link" onClick={onComms}>{line}</button> : line}</p>
                <p className="lh-req-who">{t('launch.home.boardWaiting.untaken', { to: name(r.to), age: since(r.at, t) })}</p>
              </li>
            )
          })}
        </ul>
      )}
      {more > 0 && <p className="lh-req-more">{t('launch.home.boardWaiting.more', { count: more.toLocaleString(locale) })}</p>}
      {!whole && <p className="lh-req-line">{said}</p>}
      {onComms && !shown.length && <button type="button" className="lp-link lh-req-open" onClick={onComms}>{t('launch.home.boardWaiting.open')}</button>}
    </section>
  )
}
// #endregion board-core-holds-home
