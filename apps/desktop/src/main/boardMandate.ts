// #region board-mandate — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#34-the-packet
/**
 * The operator's mandate a board request carries (fabric-agent-contract DEC-0125 MD-3, `project-comms.md`, pinned at
 * `18f8d487`): a JSON code block in the request's body, `mandate/1`, read only when the board verified the sender
 * (`provenance: trusted`). Fabric's board is the operator's own, so a verified sender is one of the operator's Projects
 * (T1); a block that does not parse, is not `mandate/1`, has expired or is not yet in force is no mandate, and the run
 * asks the operator for anything past the floors, as without one (MD-4). Fabric carries the mandate into the run's
 * packet unchanged; the run appends itself to its chain on each call it makes under it (MD-2). CO-409, the on-demand
 * spec §3.4; the carrier confirmed by the contract on the board, thread `8948b481`, 2026-11-07.
 */
import type { CommsMessage } from '../shared/commsRead.ts'
import { mandateSchema, type OperatorMandate } from './hubAuthority.ts'

/** A mandate dated this far ahead of this computer's clock is still taken: the contract's clock skew. */
const SKEW_MS = 5 * 60_000
const BLOCK = /```json[ \t]*\r?\n([\s\S]*?)\r?\n```/g

export function mandateOfRequest(m: Pick<CommsMessage, 'body' | 'sender'>, now: number): OperatorMandate | null {
  if (m.sender?.principal?.provenance !== 'trusted') return null
  const text = m.body?.text
  if (typeof text !== 'string') return null
  for (const block of text.matchAll(BLOCK)) {
    let value: unknown
    try {
      value = JSON.parse(block[1])
    } catch {
      // A code block that is not JSON is the message's own text, not a mandate: the next block is read.
      continue
    }
    const parsed = mandateSchema.safeParse(value)
    if (!parsed.success) continue
    const at = Date.parse(parsed.data.at), until = Date.parse(parsed.data.expiresAt)
    if (!(at <= now + SKEW_MS) || !(until > now)) continue
    return parsed.data
  }
  return null
}
// #endregion board-mandate
