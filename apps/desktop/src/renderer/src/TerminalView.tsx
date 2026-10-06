// One xterm view attached to one main-process PTY session. The session lives
// in main; this view replays scrollback on mount, so a renderer reload
// reattaches instead of losing the terminal (SCN-025 reattached state).

import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { TerminalSession } from '../../shared/types'
import { mergeReplay, type HeldChunk, type ReplaySnapshot } from '../../shared/replay.ts'

/**
 * `focusOnMount` is opt-OUT, and the default keeps `SessionWindow` unchanged.
 *
 * A session window IS the terminal, so taking focus when it opens is what the
 * operator asked for. An embedded pane beside a list is not: the selection can
 * change from the keyboard, and focusing on every mount would drop the caret
 * into the terminal each time the operator arrowed down the queue — so the
 * embedded host takes focus when somebody clicks into it, which xterm does by
 * itself.
 */
export function TerminalView({
  session,
  focusOnMount = true
}: {
  session: TerminalSession
  focusOnMount?: boolean
}): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  // Read at resize time, not captured when the effect ran: a session can end while its window is open (UX-10).
  const running = useRef(session.running)
  running.current = session.running

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false

    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'SF Mono, Menlo, monospace',
      // The terminal's own surface comes from the pack's --terminal token so a
      // theme switch moves it with everything else.
      theme: {
        background: getComputedStyle(document.documentElement)
          .getPropertyValue('--terminal')
          .trim()
      },
      scrollback: 5000
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    fit.fit()

    // SUBSCRIBE FIRST, then ask for the replay (FA-08).
    //
    // This used to replay `session.scrollback` — a snapshot taken by whichever
    // poll last listed the sessions, up to two seconds old — and subscribe
    // afterwards. Every byte the session emitted in between was lost, silently,
    // and the busier the session the more of them there were. Now nothing can
    // arrive unheard: what comes in before the replay lands is held, and each
    // chunk carries the character count it ends at, so the replay's own count
    // says exactly which of the held chunks it already contains.
    let attached = false
    const held: HeldChunk[] = []
    const offData = window.fabric.terminal.onData((sessionId, data, written) => {
      if (sessionId !== session.sessionId) return
      if (attached) term.write(data)
      else held.push({ data, written })
    })

    const attach = (replay: ReplaySnapshot | null): void => {
      // The merge rule lives in one place and is tested there; what happens
      // here is writing its answer in the order it gives.
      for (const piece of mergeReplay({ replay, held })) term.write(piece)
      held.length = 0
      attached = true
      if (!session.running) term.write('\r\n\x1b[2m[session ended]\x1b[0m\r\n')
    }

    void window.fabric.terminal
      .scrollback(session.sessionId)
      .then((replay) => {
        if (!disposed) attach(replay)
      })
      .catch(() => {
        // The replay is the only thing lost; the live stream still works, and a
        // terminal showing what happens NEXT beats a blank one.
        if (!disposed) attach(null)
      })
    const offExit = window.fabric.terminal.onExit((sessionId, exitCode) => {
      if (sessionId === session.sessionId) {
        running.current = false
        term.write(`\r\n\x1b[2m[session ended — exit ${exitCode}]\x1b[0m\r\n`)
      }
    })
    const onInput = term.onData((data) => window.fabric.terminal.write(session.sessionId, data))

    const doResize = (): void => {
      fit.fit()
      // An ended session keeps its tile but not its PTY: resizing one is an `ioctl EBADF` throw
      // on the far side (audit 2026-10-05 A2-001). The main side guards too; not sending is cheaper.
      if (!running.current) return
      window.fabric.terminal.resize(session.sessionId, term.cols, term.rows)
    }
    doResize()
    const resizeObserver = new ResizeObserver(doResize)
    resizeObserver.observe(host)

    if (focusOnMount) term.focus()

    return () => {
      disposed = true
      resizeObserver.disconnect()
      onInput.dispose()
      offData()
      offExit()
      term.dispose()
    }
  }, [session.sessionId, focusOnMount])

  return <div className="terminal-host" ref={hostRef} />
}
