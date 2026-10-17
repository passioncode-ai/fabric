// #region act-log — docs: docs/ux/scenarios.md#scn-168-read-every-act-in-istoriia-who-did-it-when-and-to-what
/**
 * The act log over the journal: `act.recorded@1` written through the journal's one door and read back in pages,
 * newest first, with the filters История offers. A row whose payload is not a record this product wrote is not
 * shown (it is counted by the caller as unreadable, never displayed as something it is not).
 */
import type { Journal } from '@fabric/journal'
import type { createScopedStore } from './scopedStore.ts'
import { ACT_EVENT, validateActRecord, type ActActor, type ActRow } from '../shared/acts.ts'
import type { ActLog } from './acts.ts'

type Store = Pick<ReturnType<typeof createScopedStore>, 'select'>
interface Row { seq: number; occurred_at: string; actor: ActActor; project_id: string | null; payload: unknown }

const COLUMNS = 'seq,occurred_at,actor,project_id,payload'
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
    reversersOf(seqs) {
      if (!seqs.length) return Promise.resolve([])
      return read(deps.store.select('journal', COLUMNS).eq('type', ACT_EVENT).in('payload->>undoes', seqs.map(String)).order('seq', { ascending: true }), 'reversals')
    },
    async get(seq) {
      const { data, error } = await deps.store.select('journal', COLUMNS).eq('type', ACT_EVENT).eq('seq', seq).maybeSingle()
      if (error) throw new Error(`the act could not be read: ${error.message}`)
      return data ? toRow(data as unknown as Row) : null
    }
  }
}
// #endregion act-log
