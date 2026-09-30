import { describe, expect, it } from 'vitest'
import { summariseAnswer } from './answerReceipt.ts'

const base = {
  committed: true,
  unblocked: ['t1'],
  stillBlocked: [] as { task_id: string; open_blockers: number }[],
  continuations: [{ taskId: 't1', state: 'delivering' as const, says: 'sent', deliveryId: 'd1' }]
}

describe('the aggregate never compresses into one enum', () => {
  it('shows the commit and the delivery as SEPARATE lines', () => {
    // The measured defect: one banner said "answered · 1 eligible" and the
    // delivery half was not shown at all.
    const got = summariseAnswer(base)
    expect(got.lines.map((l) => l.kind)).toEqual(['commit', 'delivery'])
  })

  it('does not call the loop closed when the session that asked has gone', () => {
    // "answered · 1 eligible" is what the operator used to read here, and the
    // agent never heard.
    const got = summariseAnswer({
      ...base,
      continuations: [{ taskId: 't1', state: 'needs_restart', says: 'gone' }]
    })
    expect(got.committed).toBe(true)
    expect(got.loopClosed).toBe(false)
    expect(got.lines.some((l) => l.says.includes('has ended'))).toBe(true)
  })

  it('keeps the commit true even when nothing could be delivered', () => {
    // The decision is recorded and stays recorded. That is the half an operator
    // most needs to rely on, and a delivery failure must not put it in doubt.
    const got = summariseAnswer({
      ...base,
      continuations: [{ taskId: 't1', state: 'needs_restart', says: 'gone' }]
    })
    expect(got.lines[0].kind).toBe('commit')
    expect(got.lines[0].tone).toBe('ok')
    expect(got.lines[0].says).toMatch(/stays recorded whatever happens next/)
  })

  it('says plainly when nothing was delivered because nobody was waiting', () => {
    const got = summariseAnswer({ ...base, continuations: [] })
    expect(got.lines.some((l) => l.says.includes('no session was waiting'))).toBe(true)
    expect(got.loopClosed).toBe(false)
  })

  it('requires acknowledgement of every unblocked task, not a transport write', () => {
    expect(summariseAnswer(base).loopClosed).toBe(false)
    const acked = {...base, continuations: [{taskId:'t1', state:'acked' as const, says:'ack'}]}
    expect(summariseAnswer(acked).loopClosed).toBe(true)
    expect(summariseAnswer({...acked, unblocked:['t1','t2']}).loopClosed).toBe(false)
    expect(summariseAnswer({...base, continuations:[{taskId:'t1',state:'outcome_unknown',says:'Inspect the session.'}]}).lines).toContainEqual({kind:'delivery',tone:'warn',says:'Inspect the session.'})
  })

  it('does not close the loop while a delivery is retryable', () => {
    const got = summariseAnswer({
      ...base,
      continuations: [{ taskId: 't1', state: 'retryable', says: 'try again' }]
    })
    expect(got.loopClosed).toBe(false)
  })

  it('reports a refusal as one line and offers nothing', () => {
    const got = summariseAnswer({ ...base, committed: false, reason: 'that question was already answered' })
    expect(got.lines).toHaveLength(1)
    expect(got.primaryAction).toBe('none')
  })
})

describe('one act, not four', () => {
  it('offers restart when the session is gone', () => {
    expect(
      summariseAnswer({ ...base, continuations: [{ taskId: 't1', state: 'needs_restart', says: 'x' }] })
        .primaryAction
    ).toBe('restart_session')
  })

  it('prefers restart over retry when both are present', () => {
    // A receipt offering four buttons is a receipt nobody reads, and retrying a
    // delivery to a session that is gone cannot work.
    const got = summariseAnswer({
      ...base,
      continuations: [
        { taskId: 't1', state: 'retryable', says: 'x' },
        { taskId: 't2', state: 'needs_restart', says: 'y' }
      ]
    })
    expect(got.primaryAction).toBe('restart_session')
  })

  it('offers answering the rest when other blockers remain', () => {
    const got = summariseAnswer({
      ...base,
      unblocked: [],
      stillBlocked: [{ task_id: 't2', open_blockers: 1 }],
      continuations: []
    })
    expect(got.primaryAction).toBe('answer_remaining')
    expect(got.loopClosed).toBe(false)
  })

  it('offers nothing when the loop is closed', () => {
    expect(summariseAnswer(base).primaryAction).toBe('none')
  })
})

describe('a second press does not read as a second decision', () => {
  // MEASURED at `38c37d3`: `repeated` crossed the IPC boundary on every answer
  // and nothing in production read it — its only consumers were assertions in
  // `BoardPanel.test.tsx` that it had been SENT. A test is not a reader. So an
  // operator whose first response was lost pressed again and got a receipt word
  // for word identical to a first commit, with no way to tell whether the
  // estate held one decision or two.
  it('says the answer was ALREADY recorded, rather than repeating the first sentence', () => {
    const fresh = summariseAnswer({ committed: true, unblocked: [], stillBlocked: [], continuations: [] })
    const again = summariseAnswer({
      committed: true,
      repeated: true,
      unblocked: [],
      stillBlocked: [],
      continuations: []
    })
    const line = (s: ReturnType<typeof summariseAnswer>): string =>
      s.lines.find((l) => l.kind === 'commit')?.says ?? ''
    // The assertion that can FALL: before this, these two were the same string.
    expect(line(again)).not.toBe(line(fresh))
    expect(line(again)).toMatch(/ALREADY/)
    // And it is still good news — a repeat is the estate refusing to record
    // twice, not a problem the operator has to act on.
    expect(again.lines.find((l) => l.kind === 'commit')?.tone).toBe('ok')
    expect(again.committed).toBe(true)
  })

  it('and says the agent had already been told, which is not a failed delivery', () => {
    const summary = summariseAnswer({
      committed: true,
      repeated: true,
      unblocked: ['t1'],
      stillBlocked: [],
      continuations: [
        { taskId: 't1', state: 'delivering', says: 'sent', deliveryId: 'd', alreadyDelivered: true }
      ]
    })
    const delivery = summary.lines.filter((l) => l.kind === 'delivery')
    expect(delivery.some((l) => /already had a terminal receipt/.test(l.says))).toBe(true)
    expect(delivery.every((l) => l.tone === 'ok')).toBe(true)
    // NOT the "nothing was delivered" line: something WAS delivered, once.
    expect(summary.lines.some((l) => /nothing was delivered/.test(l.says))).toBe(false)
  })

  it('but a first delivery says nothing about having already happened', () => {
    // The other direction, so the fix is not "always say already told" — which
    // would make the sentence meaningless by making it universal.
    const summary = summariseAnswer({
      committed: true,
      unblocked: ['t1'],
      stillBlocked: [],
      continuations: [{ taskId: 't1', state: 'delivering', says: 'sent', deliveryId: 'd' }]
    })
    expect(summary.lines.some((l) => /already had a terminal receipt/.test(l.says))).toBe(false)
  })
})
