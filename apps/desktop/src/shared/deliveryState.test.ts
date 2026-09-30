import { describe, expect, it } from 'vitest'
import {
  ACK_SOURCES,
  DELIVERY_STATES,
  RUNNING_REQUIRES,
  checkAck,
  onDeadline,
  type Delivery
} from './deliveryState.ts'

const d = (over: Partial<Delivery> = {}): Delivery => ({
  deliveryId: 'd1',
  taskId: 't1',
  sessionId: 's1',
  inputDigest: 'abc123',
  state: 'written_unconfirmed',
  writtenAt: 1000,
  deadlineMs: 60_000,
  ...over
})

describe('bytes written is not an instruction accepted', () => {
  it('accepts an agent ack that quotes the right digest', () => {
    expect(checkAck(d(), { deliveryId: 'd1', inputDigest: 'abc123', source: 'agent' })).toEqual({
      ok: true,
      state: 'accepted'
    })
  })

  it('refuses an ack whose digest is not what was sent', () => {
    // Without this an agent could acknowledge a delivery it never saw — the
    // session's previous instruction, or one for another task — and the task
    // would read `running` on a confirmation about something else.
    const got = checkAck(d(), { deliveryId: 'd1', inputDigest: 'something-else', source: 'agent' })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reasonCode).toBe('digest_mismatch')
  })

  it('never promotes an ADAPTER ack into an agent one', () => {
    // A transport accepting bytes proves nothing about a reader, and that is
    // the whole distinction this module exists for.
    for (const source of ['adapter', 'operator'] as const) {
      const got = checkAck(d(), { deliveryId: 'd1', inputDigest: 'abc123', source })
      expect(got.ok).toBe(false)
      if (!got.ok) expect(got.reasonCode).toBe('wrong_source')
    }
  })

  it('refuses an ack for something never written', () => {
    const got = checkAck(d({ state: 'queued' }), { deliveryId: 'd1', inputDigest: 'abc123', source: 'agent' })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reasonCode).toBe('not_written')
  })

  it('is idempotent on a repeat of the same ack', () => {
    // A retry after a lost response must not read as a second, conflicting
    // acknowledgement.
    const already = d({ state: 'accepted' })
    expect(checkAck(already, { deliveryId: 'd1', inputDigest: 'abc123', source: 'agent' }).ok).toBe(true)
  })

  it('refuses a SECOND ack with different content', () => {
    const already = d({ state: 'accepted' })
    const got = checkAck(already, { deliveryId: 'd1', inputDigest: 'other', source: 'agent' })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reasonCode).toBe('already_accepted')
  })

  it('answers an unknown delivery without confirming anything about the id', () => {
    const got = checkAck(null, { deliveryId: 'invented', inputDigest: 'x', source: 'agent' })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reasonCode).toBe('unknown_delivery')
  })

  it('names exactly one state a task may be called running from', () => {
    expect(RUNNING_REQUIRES).toBe('accepted')
    expect(DELIVERY_STATES).toContain('written_unconfirmed')
    expect(ACK_SOURCES).toEqual(['agent', 'adapter', 'operator'])
  })
})

describe('a deadline makes the outcome unknown; it does not resend', () => {
  it('turns a written delivery into outcome_unknown, and says why to look', () => {
    // A second paste into a session that may already be working on the first
    // puts two instructions in one context, and the agent cannot know which it
    // is meant to do.
    const got = onDeadline(d())
    expect(got.state).toBe('outcome_unknown')
    expect(got.says).toMatch(/look at the session before sending it again/i)
  })

  it('separates "never written" from "written and silent"', () => {
    // Different problems with different answers: one is a session that never
    // came up, the other is an instruction that may be being worked on.
    expect(onDeadline(d({ state: 'waiting_ready' })).state).toBe('failed_before_write')
  })

  it('leaves an accepted delivery alone', () => {
    expect(onDeadline(d({ state: 'accepted' })).state).toBe('accepted')
  })
})
