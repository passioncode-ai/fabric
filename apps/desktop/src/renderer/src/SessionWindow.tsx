// One session in full: in a detached window of its own, or (OF-03, SCN-172) full size in the main window under its
// console tab, where `onDetach` offers the separate window as a secondary control. The session itself lives in the
// main process (ADR-0031 §2), so closing either never ends it.
//
// The operator, 2026-11-17 («двойную навигацию не надо ... статус ... объединить и снизу сделать»): embedded, the
// terminal fills the page edge to edge and the top bar alone names the session (its title and its tab). One slim bar
// under the terminal holds the state, the folder (shortened, the whole path on hover), «Новая сессия» once the session
// has ended, «Завершить сессию» and the separate window as a small icon button. It wraps rather than clips.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TerminalSession } from '../../shared/types'
import { Banner, EmptyState } from './components'
import { StatusPill } from './launch/StatusPill'
import { sessionStatus, type SessionStatus } from '../../shared/sessionStatus.ts'
import { SessionStop, StopStatus } from './SessionStop'
import { FailureNote } from './OperatorError'
import { unwrap } from '../../shared/errorText'
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
import { shortFolder, useOpenConsole } from './consoles'

export function SessionWindow({
  sessionId,
  onDetach
}: {
  sessionId: string
  /** In the main window only: «Open in a separate window». Resolves when it opened; rejects with why it did not. */
  onDetach?: () => Promise<void>
}): React.JSX.Element {
  const t = useT()
  /** Why the separate window did not open, said under the header; null when nothing failed. */
  const [detachProblem, setDetachProblem] = useState<string | null>(null)
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
  const runner = runnerLabel(session.optionId, t)
  const state = session.termination ? <StopStatus state={session.termination} session={session} /> : (
    // CO-472 (UX-10): the word and colour the agent page and the rail say for this agent, from the same function, not
    // the terminal's own state in upper case; the console sees no heartbeat, so it says what Fabric observes.
    <ConsoleStatus status={sessionStatus({ terminal: session })} />
  )
  const detach = (): void => {
    setDetachProblem(null)
    onDetach?.().catch((e: unknown) => setDetachProblem(unwrap(e instanceof Error ? e.message : String(e))))
  }
  const stop = <SessionStop key={session.sessionId} session={session} refresh={load}
    onError={message => setReading(prev => afterRefusal(prev, message))} />
  const notes = <>
    {/* 0.3.7 review UX-16: our sentence, then the machine's words on their own line, never one paragraph. */}
    {detachProblem !== null && <FailureNote said={t('consoles.detachFailed')} detail={detachProblem} />}
    {/* A REFUSED REFRESH IS A CAVEAT, NOT A WALL. Taking the terminal away
        because one poll failed costs the operator what they were reading;
        leaving it with nothing said would let a frozen reading pass as a
        live one. */}
    {reading.problem !== null && (
      <p className="muted session-note">{t('session.stale', { reason: reading.problem })}</p>
    )}
  </>
  if (onDetach) return (
    <div className="session-window session-embedded">
      {notes}
      <TerminalView session={session} />
      <footer className="session-bar" aria-label={t('session.bar')}>
        {state}
        <span className="muted mono session-cwd" title={session.cwd}>{shortFolder(session.cwd)}</span>
        {!session.running && <NewSession session={session} runner={runner} />}
        <span className="session-stop-slot">{stop}</span>
        <button type="button" className="session-detach" aria-label={t('consoles.detach')} title={t('consoles.detach')} onClick={detach}>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <path d="M9 2.5h4.5V7M13.5 2.5 8 8M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </footer>
    </div>
  )
  return (
    <div className="session-window">
      <header className="session-head">
        <strong>{runner}</strong>
        <span className="muted mono">{session.cwd}</span>
        {state}
        {/* No «Новая сессия» here (0.3.22 review, iteration 2, ER-1): a detached window may not open a terminal
            (`terminalOpen` is main-only, `shared/ipcWindowPolicy.ts`), so the button would only ever fail; the
            console under its tab in the main window offers it. */}
      </header>
      {notes}
      {stop}
      <TerminalView session={session} />
    </div>
  )
}

/** Once a session has ended, what comes next (the operator, 2026-11-17: «более качественные завершения»): a new session
 *  of the same coding agent, with the same permissions, in the same project, opened as its own console. */
function NewSession({ session, runner }: { session: TerminalSession; runner: string }): React.JSX.Element {
  const t = useT()
  const openConsole = useOpenConsole()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const start = async (): Promise<void> => {
    setBusy(true)
    setProblem(null)
    try {
      const next = await window.fabric.terminal.open(session.projectId, session.optionId, undefined, session.permissionMode)
      await openConsole(next.sessionId)
    } catch (e) {
      setProblem(unwrap(e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }
  return <span className="session-new">
    <button type="button" className="btn btn-ghost" disabled={busy} title={t('session.newHelp', { runner })} onClick={() => void start()}>
      {t(busy ? 'session.newStarting' : 'session.new')}
    </button>
    {problem !== null && <FailureNote said={t('session.newFailed')} detail={problem} />}
  </span>
}

/** The console header's status, in the agent page's words (CO-472): «работает» while it runs, the shared status word otherwise. */
function ConsoleStatus({ status }: { status: SessionStatus }): React.JSX.Element {
  const t = useT()
  return <StatusPill status={status} words={status === 'working' ? t('agentScreen.state.working') : t(`status.${status}` as 'status.idle')} />
}
