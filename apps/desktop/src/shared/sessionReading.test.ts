// The four screens a session window can be, and the two it used to collapse
// (UXA-C04).

import { describe, expect, it } from 'vitest'
import { UNREAD, afterRead, afterRefusal, sessionSays } from './sessionReading.ts'
import type { TerminalSession } from './types.ts'

const session = { sessionId: 's1', cwd: '/repo' } as TerminalSession

describe('what a window may say about one session', () => {
  it('says nothing before the first answer', () => {
    expect(sessionSays(UNREAD)).toBe('booting')
  })

  it('is BLOCKED only while it has never had an answer', () => {
    expect(sessionSays(afterRefusal(UNREAD, 'the bridge is gone'))).toBe('blocked')
  })

  it('and a successful read CLEARS the problem — the half that was missing', () => {
    // `error` was never cleared and the render checked it first, so one failed
    // read on mount killed the window for the life of the process while the
    // poll went on succeeding underneath.
    const stuck = afterRefusal(UNREAD, 'a hiccup')
    expect(sessionSays(stuck)).toBe('blocked')
    const recovered = afterRead(session)
    expect(recovered.problem).toBeNull()
    expect(sessionSays(recovered)).toBe('session')
  })

  it('KEEPS the session when a refresh refuses, and marks the reading', () => {
    // A failed refresh is not a reason to take away a terminal somebody is
    // reading — the cheaper mistake, chosen and said.
    const stale = afterRefusal(afterRead(session), 'the bridge went away')
    expect(sessionSays(stale)).toBe('session')
    expect(stale.answer).toBe(session)
    expect(stale.problem).toMatch(/went away/)
  })

  it('and NULL is an answer: the estate no longer has this session', () => {
    // `then((s) => s && setSession(s))` discarded exactly this, so a reaped
    // session went on rendering as running for ever — defeating the exit
    // handler whose own comment says it exists to prevent that.
    expect(sessionSays(afterRead(null))).toBe('gone')
    expect(afterRead(null).problem, 'null is not a failure').toBeNull()
  })

  it('and every reading it can hold answers the question exactly once', () => {
    // The join, asserted rather than assumed: a reading no branch claims would
    // be a window rendering nothing at all.
    const all = [
      UNREAD,
      afterRefusal(UNREAD, 'x'),
      afterRead(null),
      afterRead(session),
      afterRefusal(afterRead(session), 'x'),
      afterRefusal(afterRead(null), 'x')
    ]
    for (const r of all)
      expect(['booting', 'blocked', 'gone', 'session']).toContain(sessionSays(r))
  })
})
