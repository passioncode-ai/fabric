// A detached window showing one session in full. The session itself lives in
// the main process (ADR-0031 §2), so closing this window never ends it.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Banner, EmptyState, StateChip } from './components'
import { sessionTone } from './sessionTone'
import { SessionStop, StopStatus } from './SessionStop'
import { TerminalView } from './TerminalView'
import { useT } from './i18n'
import {
  UNREAD,
  afterRead,
  afterRefusal,
  sessionSays,
  type SessionReading
} from '../../shared/sessionReading.ts'
import { runnerLabel } from './runnerLabel'

export function SessionWindow({ sessionId }: { sessionId: string }): React.JSX.Element {
  const t = useT()
  /**
   * ONE reading for all four call sites (UXA-C04): the first read, the poll,
   * the exit handler and any retry. It used to be `session` plus an `error`
   * that nothing ever cleared, checked FIRST in the render — so one failed read
   * on mount killed the window for the life of the process while the poll went
   * on succeeding underneath it.
   */
  const [reading, setReading] = useState<SessionReading>(UNREAD)
  /**
   * The generation of the newest request. A read still in flight when
   * `sessionId` changes, or after this window unmounts, must not land: the same
   * overlap UXA-C01 removed from the estate home, at four call sites instead of
   * one.
   */
  const generation = useRef(0)

  const load = useCallback(async (): Promise<void> => {
    const mine = ++generation.current
    try {
      const answer = await window.fabric.terminal.get(sessionId)
      // NULL IS AN ANSWER — the one that means the main process no longer has
      // this session. It used to be discarded by `s && setSession(s)`, so a
      // reaped session went on rendering as running for ever.
      if (mine === generation.current) setReading(afterRead(answer))
    } catch (e) {
      // CAUGHT AT EVERY CALL SITE. The poll and the exit handler had no
      // rejection handler at all, so an unreachable main process produced an
      // unhandled rejection every five seconds.
      if (mine === generation.current)
        setReading((prev) => afterRefusal(prev, e instanceof Error ? e.message : String(e)))
    }
  }, [sessionId])

  useEffect(() => {
    generation.current += 1
    setReading(UNREAD)
    void load()
    // The header carries the session's state, so it has to learn when the
    // process exits — otherwise it says "running" over a dead shell.
    const off = window.fabric.terminal.onExit((id) => {
      if (id === sessionId) void load()
    })
    const poll = setInterval(() => void load(), 5000)
    return () => {
      generation.current += 1
      off()
      clearInterval(poll)
    }
  }, [sessionId, load])

  const says = sessionSays(reading)
  if (says === 'booting') return <div className="booting" />
  if (says === 'blocked')
    return (
      <div className="booting">
        {/* A BANNER, NOT AN `EmptyState`. That component has exactly two modes —
            read and not-yet-read — and this is the third: we asked and were
            refused. `read` would mark a MEASUREMENT over a read that measured
            nothing (UXA-C02's lesson at another surface), and `read={false}`
            renders the waiting line, which says the opposite of what happened.
            A two-mode component cannot carry a three-state fact. */}
        <Banner tone="warn">{t('session.unreadable', { reason: reading.problem ?? '' })}</Banner>
      </div>
    )
  if (says === 'gone')
    return (
      <div className="booting">
        <EmptyState read>{t('session.gone')}</EmptyState>
      </div>
    )

  const session = reading.answer!
  return (
    <div className="session-window">
      <header className="session-head">
        <strong>
          {runnerLabel(session.optionId, t)}
        </strong>
        <span className="muted mono">{session.cwd}</span>
        <>{session.termination ? <StopStatus state={session.termination} /> : <StateChip tone={sessionTone(session.state)} dot>
          {t(`session.state.${session.state}`)}
        </StateChip>}</>
      </header>
      {/* A REFUSED REFRESH IS A CAVEAT, NOT A WALL. Taking the terminal away
          because one poll failed costs the operator what they were reading;
          leaving it with nothing said would let a frozen reading pass as a
          live one. */}
      {reading.problem !== null && (
        <p className="muted">{t('session.stale', { reason: reading.problem })}</p>
      )}
      <SessionStop key={session.sessionId} session={session} refresh={load}
        onError={message => setReading(prev => afterRefusal(prev, message))} />
      <TerminalView session={session} />
    </div>
  )
}
