// @fabric/journal — the client side of ADR-0027.
// append() is the only write path (it calls the append_event RPC, the single
// writer); replay() reads the journal table — Realtime, when it arrives, is a
// wake-up signal only and never the record.
//
// Contention is handled HERE, not in the database, and the split is deliberate.
// Migration 7 gives append_event a `lock_timeout`, so a writer that cannot get
// the per-estate lock fails with 55P03 instead of waiting forever (measured
// before the fix: still blocked after 6 000 ms). Deciding whether to try again
// is the caller's, because only the caller can let go of the connection between
// attempts — a retry loop inside the transaction would hold the very resource
// it is waiting for.

import type { SupabaseClient } from '@supabase/supabase-js'

export type ActorKind = 'person' | 'agent' | 'system'

export interface Actor {
  kind: ActorKind
  id: string
}

export interface JournalEvent {
  estate_id: string
  seq: number
  type: string // 'noun.verb@N'
  schema_rev: string
  actor: Actor
  project_id: string | null
  run_id: string | null
  node_id: string | null
  occurred_at: string
  payload: Record<string, unknown>
}

export interface NewEvent {
  estateId: string
  type: string
  actor: Actor
  payload?: Record<string, unknown>
  schemaRev?: string
  projectId?: string
  runId?: string
  nodeId?: string
}

export interface Journal {
  append(e: NewEvent): Promise<JournalEvent>
  replay(estateId: string, fromSeq: number, limit?: number): Promise<JournalEvent[]>
}

/** Seams, all defaulted: the tests drive the clock and the dice, nothing else does. */
export interface JournalOptions {
  /** Total attempts for a contended append, the first included. */
  maxAttempts?: number
  /** Base backoff; attempt n waits roughly base · 2^n, jittered. */
  backoffMs?: number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
}

/**
 * The only Postgres error an append may be retried on. Anything else — a bad
 * payload, an unregistered type (22023), a permission error — is a decision the
 * database has already made, and repeating the call would only repeat it.
 */
export const LOCK_NOT_AVAILABLE = '55P03'

const DEFAULTS = { maxAttempts: 3, backoffMs: 120 }

export function createJournal(db: SupabaseClient, options: JournalOptions = {}): Journal {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULTS.maxAttempts)
  const backoffMs = options.backoffMs ?? DEFAULTS.backoffMs
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const random = options.random ?? Math.random

  // Jittered, because unjittered backoff makes two starved writers collide again
  // on exactly the same schedule.
  const waitFor = (attempt: number): number =>
    Math.round(backoffMs * 2 ** attempt * (0.5 + random()))

  return {
    async append(e: NewEvent): Promise<JournalEvent> {
      let contended: { message: string } | null = null

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data, error } = await db.rpc('append_event', {
          p_estate_id: e.estateId,
          p_type: e.type,
          p_actor: e.actor,
          p_payload: e.payload ?? {},
          p_schema_rev: e.schemaRev ?? '1',
          p_project_id: e.projectId ?? null,
          p_run_id: e.runId ?? null,
          p_node_id: e.nodeId ?? null
        })

        if (!error) return data as JournalEvent
        if (error.code !== LOCK_NOT_AVAILABLE)
          throw new Error(`append_event(${e.type}) failed: ${error.message}`)

        contended = error
        if (attempt < maxAttempts - 1) await sleep(waitFor(attempt))
      }

      // Say what actually happened. "failed" would send whoever reads this
      // looking for a bad payload; the payload was fine and the estate was busy.
      throw new Error(
        `append_event(${e.type}) gave up after ${maxAttempts} attempts contending ` +
          `for the estate lock: ${contended?.message ?? 'lock not available'}`
      )
    },

    async replay(estateId: string, fromSeq: number, limit = 500): Promise<JournalEvent[]> {
      const { data, error } = await db
        .from('journal')
        .select('*')
        .eq('estate_id', estateId)
        .gt('seq', fromSeq)
        .order('seq', { ascending: true })
        .limit(limit)
      if (error) throw new Error(`journal replay failed: ${error.message}`)
      return (data ?? []) as JournalEvent[]
    }
  }
}
