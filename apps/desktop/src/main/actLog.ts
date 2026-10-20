// #region act-log — docs: docs/ux/scenarios.md#scn-168-read-every-act-in-история--who-did-it-when-and-to-what
/**
 * The act log over the journal: `act.recorded@1` written through the journal's one door and read back in pages,
 * newest first, with the filters История offers. A row whose payload is not a record this product wrote is not
 * shown (it is counted by the caller as unreadable, never displayed as something it is not).
 */
import type { Journal } from '@fabric/journal'
import type { createScopedStore } from './scopedStore.ts'
import { ACT_EVENT, validateActRecord, type ActActor, type ActRow } from '../shared/acts.ts'
import type { ActLog } from './acts.ts'

type Store = Pick<ReturnType<typeof createScopedStore>, 'select' | 'selectIn'>
interface Row { seq: number; occurred_at: string; actor: ActActor; project_id: string | null; payload: unknown }

const COLUMNS = 'seq,occurred_at,actor,project_id,payload'
/** Seqs per reversal read: the bound `scopedStore.selectIn` uses, under the gateway's URL limit. */
const REVERSAL_CHUNK = 100
const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (c) => '\\' + c)

function toRow(r: Row): ActRow | null {
  const record = validateActRecord(r.payload)
  if (!record || !r.actor || typeof r.actor.kind !== 'string') return null
  return { seq: Number(r.seq), occurredAt: r.occurred_at, actor: r.actor, projectId: r.project_id, record }
}

export function createActLog(deps: { journal: Pick<Journal, 'append'>; store: Store; estateId: string }): ActLog {
  const read = async (q: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<ActRow[]> => {
    const { data, error } = await q
    if (error) throw new Error(`the act log could not be read (${what}): ${error.message}`)
    return ((data ?? []) as Row[]).map(toRow).filter((r): r is ActRow => r !== null)
  }
  return {
    async append(record, projectId, actor) {
      const event = await deps.journal.append({
        estateId: deps.estateId, type: ACT_EVENT, actor, ...(projectId ? { projectId } : {}),
        payload: record as unknown as Record<string, unknown>
      })
      return { seq: event.seq }
    },
    page(q) {
      let b = deps.store.select('journal', COLUMNS).eq('type', ACT_EVENT)
      if (q.before) b = b.lt('seq', q.before)
      if (q.actorKind) b = b.eq('actor->>kind', q.actorKind)
      if (q.projectId) b = b.eq('project_id', q.projectId)
      if (q.category) b = b.eq('payload->>category', q.category)
      if (q.text?.trim()) b = b.ilike('payload->subject->>label', `%${escapeLike(q.text.trim())}%`)
      return read(b.order('seq', { ascending: false }).limit(q.limit), 'page')
    },
    async reversersOf(seqs) {
      if (!seqs.length) return []
      // The frontier grows with the history, so the list is read in bounded chunks (the list-read rule), and a
      // refused chunk is an error, never "nothing undid it". Each chunk names the act type (0.3.7 review DA-7): only
      // then can PostgreSQL use migration 112's partial index `journal_acts_reversals`; filtered by the list alone it
      // scanned the estate's journal once per chunk. The type is checked again below, as a guard.
      const { rows, failed } = await deps.store.selectIn('journal', `${COLUMNS},type`, 'payload->>undoes', seqs.map(String), REVERSAL_CHUNK, undefined, [['type', ACT_EVENT]])
      if (failed) throw new Error(`the act log could not be read (reversals): ${failed}`)
      const found = rows as unknown as (Row & { type: string })[]
      return found
        .filter((r) => r.type === ACT_EVENT)
        .sort((a, b) => Number(a.seq) - Number(b.seq))
        .map(toRow)
        .filter((r): r is ActRow => r !== null)
    },
    async get(seq) {
      const { data, error } = await deps.store.select('journal', COLUMNS).eq('type', ACT_EVENT).eq('seq', seq).maybeSingle()
      if (error) throw new Error(`the act could not be read: ${error.message}`)
      return data ? toRow(data as unknown as Row) : null
    }
  }
}
// #endregion act-log
