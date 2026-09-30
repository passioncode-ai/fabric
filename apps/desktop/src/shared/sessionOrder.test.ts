// The order, and the array it must not touch (UX28-13).
//
// The rendering probe in `EstateAgents.terminal.test.tsx` asserts what a reader
// SEES. This asserts the two properties a rendering cannot: that the input is
// left alone, and that the order is total.
//
// THE SECOND ONE IS HERE BECAUSE A PLANT LEFT EVERYTHING GREEN. Replacing
// `[...sessions].sort` with an in-place `sessions.sort` broke nothing in
// thirty-nine rendering cases, because each of them passes a fresh array
// literal and never looks at it again. In the product the array is a parent's
// state, shared with `Workspace`, which renders the same sessions in its own
// order — so an in-place sort reorders somebody else's list and mutates state
// React was told was immutable. Invisible in a test that renders once; a
// reordering list under the pointer in the app.

import { describe, expect, it } from 'vitest'
import { inAttentionOrder, sessionRank } from './sessionOrder'
import type { TerminalSession } from './types'

const session = (over: Partial<TerminalSession>): TerminalSession =>
  ({
    sessionId: 's',
    projectId: 'p1',
    cwd: '/x',
    program: 'claude',
    optionId: 'claude-code',
    permissionMode: null,
    excerpt: '',
    written: 0,
    running: true,
    state: 'running',
    startedAt: '2026-09-10T00:00:00Z',
    lastActivityAt: '2026-09-10T00:00:00Z',
    tail: '',
    exitCode: null,
    ...over
  }) as TerminalSession

describe('what is waiting for a person comes first', () => {
  it('ranks idle before running before ended', () => {
    expect(sessionRank('idle')).toBeLessThan(sessionRank('running'))
    expect(sessionRank('running')).toBeLessThan(sessionRank('ended'))
  })

  it('and inside one state the longest wait is first', () => {
    const early = session({ sessionId: 'early', state: 'idle', lastActivityAt: '2026-09-10T01:00:00Z' })
    const late = session({ sessionId: 'late', state: 'idle', lastActivityAt: '2026-09-10T09:00:00Z' })
    expect(inAttentionOrder([late, early]).map((s) => s.sessionId)).toEqual(['early', 'late'])
  })

  it('and the order is TOTAL, so equal rows do not swap between renders', () => {
    // Two sessions identical but for their id. Without the final tiebreak the
    // comparator returns 0 and the result depends on the engine's sort
    // stability plus the input order — a row that moves under the pointer for
    // no reason the operator can see.
    const a = session({ sessionId: 'aaa', state: 'idle' })
    const b = session({ sessionId: 'bbb', state: 'idle' })
    expect(inAttentionOrder([b, a]).map((s) => s.sessionId)).toEqual(['aaa', 'bbb'])
    expect(inAttentionOrder([a, b]).map((s) => s.sessionId)).toEqual(['aaa', 'bbb'])
  })

  it('and it NEVER touches the array it was given', () => {
    // The plant that left thirty-nine rendering cases green. The input is a
    // parent's state and `Workspace` renders the same sessions; sorting where
    // they lie reorders somebody else's list.
    const ended = session({ sessionId: 'z', state: 'ended' })
    const idle = session({ sessionId: 'a', state: 'idle' })
    const input = [ended, idle]
    const before = input.map((s) => s.sessionId)
    const out = inAttentionOrder(input)
    expect(out.map((s) => s.sessionId), 'the fixture must actually reorder, or this proves nothing').toEqual([
      'a',
      'z'
    ])
    expect(input.map((s) => s.sessionId), 'the caller’s array was sorted in place').toEqual(before)
    expect(out, 'the same array was handed back').not.toBe(input)
  })
})
