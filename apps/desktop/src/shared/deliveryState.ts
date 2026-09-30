// Bytes written is not an instruction accepted (M103, ADR-0026).
//
// MEASURED: `deliverWhenReady` pastes the instruction into a pty and returns.
// There is no delivery record, no state and no acknowledgement — the write
// returning IS the delivery, as far as anything downstream can tell. And the
// task is moved to `running` immediately after, so a task reads as running on
// the strength of bytes having reached a terminal.
//
// The bytes reach a terminal in all of these cases: the agent read them and
// started; the CLI printed its prompt and exited; the paste landed in a pager;
// the process is wedged and its buffer accepted the write anyway. Four
// situations, one indistinguishable record, and only the first is work.
//
// SO THE MIDDLE STATE IS NAMED. `written_unconfirmed` is neither failure nor
// success, and it is where a delivery sits until the agent says — through a
// credentialed tool, quoting the digest of what it received — that this
// instruction is the one it has. The same third answer `outcome_unknown`,
// `ToolOutcome.unknown` and `ReadEnvelope.partial` already keep.
//
// AND NOTHING RESENDS ITSELF. A second paste into a session that may already be
// working on the first produces two agents' worth of instruction in one
// context. A timeout makes the state unknown and offers the operator an
// explicit act; it does not guess.

export const DELIVERY_STATES = [
  /** Recorded, nothing written yet. */
  'queued',
  /** Waiting for the session to look ready. A readiness HINT, never a fact. */
  'waiting_ready',
  /** The bytes went out. Nobody has said they arrived anywhere useful. */
  'written_unconfirmed',
  /** The agent quoted back the digest of what it received. */
  'accepted',
  /** Never written: the session died, or the transport refused. */
  'failed_before_write',
  /** Written, and then silence past the deadline. Not a failure and not a
   *  success — the state that exists so nothing has to guess. */
  'outcome_unknown'
] as const
export type DeliveryState = (typeof DELIVERY_STATES)[number]

/** Who said it arrived. An ADAPTER ack means a transport accepted bytes; an
 *  AGENT ack means something read them. They are never promoted into each
 *  other, because the whole distinction this module exists for is that a
 *  transport accepting bytes proves nothing about a reader. */
export const ACK_SOURCES = ['agent', 'adapter', 'operator'] as const
export type AckSource = (typeof ACK_SOURCES)[number]

/** The states from which a task may be called RUNNING. Exactly one. */
export const RUNNING_REQUIRES: DeliveryState = 'accepted'

export interface Delivery {
  deliveryId: string
  taskId: string
  sessionId: string | null
  /** Of the instruction, so an ack can prove it is about THIS instruction and
   *  not whatever the session happens to be holding. */
  inputDigest: string
  state: DeliveryState
  writtenAt: number | null
  deadlineMs: number
}

export interface Ack {
  deliveryId: string
  inputDigest: string
  source: AckSource
}

export type AckVerdict =
  | { ok: true; state: 'accepted' }
  | { ok: false; reasonCode: 'unknown_delivery' | 'digest_mismatch' | 'not_written' | 'wrong_source' | 'already_accepted'; says: string }

/**
 * May this acknowledgement move the delivery to `accepted`?
 *
 * The digest comparison is the load-bearing half. Without it an agent could
 * acknowledge a delivery it never saw — the session's previous instruction, or
 * one addressed to a different task — and the task would read `running` on a
 * confirmation about something else.
 */
export function checkAck(delivery: Delivery | null, ack: Ack): AckVerdict {
  if (!delivery)
    return { ok: false, reasonCode: 'unknown_delivery', says: 'no delivery with that id in this scope' }

  if (delivery.state === 'accepted')
    // Idempotent rather than an error: a retry after a lost response must not
    // read as a second, conflicting acknowledgement.
    return ack.inputDigest === delivery.inputDigest
      ? { ok: true, state: 'accepted' }
      : { ok: false, reasonCode: 'already_accepted', says: 'that delivery was already accepted, with different content' }

  if (delivery.state !== 'written_unconfirmed' && delivery.state !== 'outcome_unknown')
    return {
      ok: false,
      reasonCode: 'not_written',
      says: `that delivery is ${delivery.state}; nothing has been written for anyone to receive`
    }

  if (ack.inputDigest !== delivery.inputDigest)
    return {
      ok: false,
      reasonCode: 'digest_mismatch',
      says:
        'the content you acknowledged is not the content that was sent. Either you are answering about a ' +
        'different instruction, or what reached you was altered on the way.'
    }

  // An adapter accepting bytes is a transport fact. It is recorded, and it does
  // not make a task running.
  if (ack.source !== 'agent')
    return {
      ok: false,
      reasonCode: 'wrong_source',
      says: `a ${ack.source} acknowledgement records that bytes moved; only the agent can say it read them`
    }

  return { ok: true, state: 'accepted' }
}

/**
 * What a written delivery becomes when the deadline passes with no word.
 *
 * NOT a resend. A second paste into a session that may already be working on
 * the first puts two instructions in one context, and the agent has no way to
 * know which it is meant to do.
 */
export function onDeadline(delivery: Delivery): { state: DeliveryState; says: string } {
  if (delivery.state === 'accepted') return { state: 'accepted', says: 'already acknowledged' }
  if (delivery.state === 'written_unconfirmed')
    return {
      state: 'outcome_unknown',
      says:
        'the instruction was written and nothing came back. It may have been read, or it may have gone ' +
        'into a prompt that was not listening — look at the session before sending it again.'
    }
  return {
    state: 'failed_before_write',
    says: 'the session never became ready, so nothing was written'
  }
}

/**
 * The instruction, with what an acknowledgement must quote.
 *
 * Handed to the agent IN the instruction rather than out of band, because the
 * agent has no other channel at the moment it is handed work — and a digest it
 * cannot see is one it cannot quote, which would make the acknowledgement a
 * formality instead of a check.
 */
export function withDeliveryHeader(instruction: string, deliveryId: string, inputDigest: string): string {
  return (
    `[fabric] delivery ${deliveryId} · digest ${inputDigest}\n` +
    `[fabric] confirm you have this with fabric_task_accept({ deliveryId, inputDigest }) before you start.\n\n` +
    instruction
  )
}
