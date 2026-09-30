// What a session ran from, as the wire carries it (AX-04).
//
// The type lives here and the implementation in `main/pastContext.ts`, because
// this crosses the IPC boundary and a field the wire carries but the shared
// declaration omits arrives untyped and is read by accident — the defect M109
// swept out of this surface, and one that reappeared in AX-03.

/**
 * The bytes a session was given, or the reason they cannot be produced.
 *
 * FOUR outcomes, not two. "Held" and "gone" would collapse three situations an
 * operator acts on differently: a session that predates the packet store, a
 * blob deleted from under it, and a blob whose content no longer hashes to what
 * the packet claims. The third must never read as the second — it means
 * something rewrote the record.
 *
 * There is deliberately NO fifth outcome that rebuilds the pack from today's
 * memory. AX-04's acceptance forbids it in as many words, and the reason is
 * arithmetic rather than taste: memory has moved, so a recompilation is a
 * different pack wearing the same session id.
 */
export type PastContext =
  | {
      held: true
      sessionId: string
      projectId: string
      taskId: string | null
      /** The identity. The bytes hash to this, checked on the way out. */
      sha256: string
      bytes: string
      chars: number
    }
  | { held: false; why: PastContextGap; says: string }

export type PastContextGap = 'no_packet' | 'blob_missing' | 'blob_corrupt' | 'unreadable'

/**
 * Whether a gap means the record was ALTERED rather than merely absent.
 *
 * Separated because the two need different acts from a person: an absence is
 * history this machine never had or has since lost, and an alteration is a
 * record that disagrees with itself.
 */
export function wasRewritten(gap: PastContextGap): boolean {
  return gap === 'blob_corrupt'
}
