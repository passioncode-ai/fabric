// #region turn-verdict-read — docs: docs/evidence/specs/2026-11-16-turn-end-waits.md#42-while-the-session-is-alive-the-turns-verdict
/**
 * Reads what a turn's verdict needs (T2): the session's live claims and their tasks, its heartbeat's declared wait, and
 * its last three turns. Every read bounded; any read that fails gives no verdict, never a failed turn (the hook's turn is
 * recorded before this runs, and an agent told nothing ends its turn as before).
 */
import { turnVerdict, type HeldTask, type TurnFacts, type TurnVerdict } from '../shared/turnVerdict.ts'
import { ops } from './opsSink.ts'

interface Rows { data: unknown[] | null; error: { message: string } | null }
interface Query extends PromiseLike<Rows> {
  eq(column: string, value: unknown): Query
  is(column: string, value: null): Query
  order(column: string, opts: { ascending: boolean }): Query
  limit(n: number): Query
}
export interface VerdictStore {
  select(table: string, columns: string): Query
  /** The scoped store's bounded list read (`scopedStore.ts#selectIn`): chunks, a failure named, never one huge filter. */
  selectIn(table: string, columns: string, column: string, values: readonly string[], chunk?: number): Promise<{ rows: unknown[]; failed: string | null }>
}

/** A session holds few claims; more than this is not a session to keep going by itself. */
const CLAIMS = 20
const TURNS = 3

export async function readTurnVerdict(store: VerdictStore, sessionId: string, now: number): Promise<TurnVerdict | null> {
  try {
    const [claims, beat, turns] = await Promise.all([
      store.select('work_claims', 'work_id,expires_at').eq('owner_session', sessionId).is('released_at', null).limit(CLAIMS),
      store.select('session_heartbeats', 'phase').eq('session_id', sessionId).limit(1),
      store.select('journal', 'payload').eq('type', 'session.turn.observed@1').eq('payload->>session_id', sessionId)
        .order('seq', { ascending: false }).limit(TURNS)
    ])
    const refused = claims.error ?? beat.error ?? turns.error
    if (refused) return unread(refused.message)
    const live = (claims.data ?? []) as Array<{ work_id: string; expires_at: string }>
    if (!live.length) return null
    const tasks = await store.selectIn('project_tasks', 'id,title,status', 'id', live.map((c) => c.work_id), CLAIMS)
    if (tasks.failed) return unread(tasks.failed)
    const byId = new Map((tasks.rows as Array<{ id: string; title: string | null; status: string }>).map((t) => [t.id, t]))
    const held: HeldTask[] = live.flatMap((c) => {
      const t = byId.get(c.work_id)
      return t ? [{ taskId: t.id, title: t.title, status: t.status, expiresAt: c.expires_at }] : []
    })
    const phase = ((beat.data ?? [])[0] as { phase?: string } | undefined)?.phase
    const facts: TurnFacts[] = ((turns.data ?? []) as Array<{ payload: Record<string, unknown> }>).map(({ payload: p }) => ({
      head: typeof p.head === 'string' ? p.head : null,
      filesChanged: typeof p.files_changed === 'number' ? p.files_changed : null,
      linesAdded: typeof p.lines_added === 'number' ? p.lines_added : null,
      linesRemoved: typeof p.lines_removed === 'number' ? p.lines_removed : null
    }))
    return turnVerdict(held, phase === 'waiting' || phase === 'blocked', facts, now)
  } catch (e) {
    // A thrown read is said through `unread` (ops.failed) like a refused one.
    return unread(e instanceof Error ? e.message : String(e))
  }
}

/** A read the verdict could not make: said in the operations log, and no verdict, so the turn ends as before. */
function unread(why: string): null {
  ops.failed('work.turn-verdict-unread', new Error(why), { note: 'the turn is recorded without a verdict; the agent ends its turn as before' })
  return null
}
// #endregion turn-verdict-read
