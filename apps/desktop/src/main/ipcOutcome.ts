// #region board-core-holds-ipc-outcome — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#board
/**
 * What the IPC wrapper (`index.ts#handle`) records for a call that resolved (0.3.9 BD-5, BD-6).
 *
 * MEASURED BEFORE THIS (board.md BD-5, BD-6): the wrapper wrote `ok` for every reply that resolved, so all 2,336
 * `ipc.comms:heads` lines of one 11.7 h log said `ok` whether or not the badge read succeeded, and those lines, one per
 * 5 s tick, were 11.6 % of a log capped at 20,000 lines. So:
 *
 * - A reply that says it did not do it (`ok: false`) is never `ok`: `failed` when the read could not be done (code
 *   `unavailable`, or none), `unknown` when it was refused with a reason (the call reached its answer, which was no).
 * - A channel polled on a clock (`QUIET_WHEN_OK`) writes no line for a success, one line when it starts failing or its
 *   failure changes, and one when it recovers. A thrown call is still recorded by the wrapper every time.
 */

/** Channels the renderer polls on a clock. */
export const QUIET_WHEN_OK: ReadonlySet<string> = new Set(['comms:heads'])

export interface IpcOutcomeLine {
  outcome: 'ok' | 'failed' | 'unknown'
  detail?: Record<string, unknown>
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The failure a reply states, or null when it states none. */
function stated(result: unknown): { outcome: 'failed' | 'unknown'; reply: string } | null {
  if (!isObj(result) || result.ok !== false) return null
  const error = isObj(result.error) ? result.error : null
  const code = error && typeof error.code === 'string' ? error.code : typeof result.reason === 'string' ? result.reason : null
  if (code === null) return { outcome: 'failed', reply: 'ok:false' }
  return { outcome: code === 'unavailable' ? 'failed' : 'unknown', reply: code }
}

export function createIpcOutcomeLog() {
  /** The failure each quiet channel is in now; absent while it answers. */
  const failing = new Map<string, string>()
  return {
    /** The line to write for this resolved call, or null for none. */
    decide(channel: string, result: unknown): IpcOutcomeLine | null {
      const said = stated(result)
      if (!QUIET_WHEN_OK.has(channel)) return said ? { outcome: said.outcome, detail: { reply: said.reply } } : { outcome: 'ok' }
      if (said) {
        if (failing.get(channel) === said.reply) return null
        failing.set(channel, said.reply)
        return { outcome: said.outcome, detail: { reply: said.reply } }
      }
      return failing.delete(channel) ? { outcome: 'ok', detail: { recovered: true } } : null
    }
  }
}
// #endregion board-core-holds-ipc-outcome
