// Diagnostic reproduction, not an acceptance test. Synthetic records only.
// Baseline defect is observed when writes=2 or queued is reported delivered.
import { createContinuationDelivery, continuationDeliveryId } from '../../../apps/desktop/src/main/continuationDelivery.ts'
import { createScopedStore } from '../../../apps/desktop/src/main/scopedStore.ts'

// `estate_id` is on the fixture because the REAL store adds that filter, and a
// row without it is invisible — which is the property being relied on rather
// than a nuisance: no query in the module writes the estate filter itself.
const ESTATE = 'e-1'
const RUN = { estate_id: ESTATE, task_run_id: 'r-1', task_id: 't-1', session_id: 's-1', state: 'running' }

/**
 * A db shaped like PostgREST's client, recording the filters each query used.
 *
 * THE FAKE IS THE DATABASE, not the store: `createScopedStore` is the real one
 * (R-007). That is what proves no query in the module writes its own estate
 * filter, and it is the fourth module extracted in this shape after
 * `digestRead`, `harnessRead`, `memoryOverviewRead` and `searchRead`.
 */
function fakeDb(tables) {
  const queries = []
  return {
    queries,
    from: (table) => ({
      select: (columns) => {
        const q = { table, columns, filters: [] }
        queries.push(q)
        const builder = {
          eq: (c, v) => { q.filters.push(['eq', c, String(v)]); return builder },
          order: (c, o) => { q.filters.push(['order', c, String(o.ascending)]); return builder },
          limit: (n) => { q.filters.push(['limit', String(n), '']); return builder },
          then: (resolve) => {
            // FILTERED, because a store that returns the whole table whatever
            // was asked is more generous than the database and cannot see a
            // lookup that asked for the wrong thing (measured on UX28-09).
            let out = tables[table] ?? []
            for (const [op, col, v] of q.filters)
              if (op === 'eq') out = out.filter((row) => String(row[col]) === v)
            return Promise.resolve({ data: out, error: null }).then(resolve)
          }
        }
        return builder
      }
    })
  }
}

function harness(tables = { task_runs: [RUN] }) {
  const appended = []
  const written = []
  const rows = { deliveries: [], ...tables }
  const db = fakeDb(rows)
  const store = createScopedStore(db, { kind: 'estate', estateId: ESTATE })
  const deliver = createContinuationDelivery({
    store,
    journal: {
      // THE FAKE PROJECTS, exactly as the real projector does, because a store
      // that never learns about the delivery would answer "no such delivery"
      // for ever and the reconciliation could not be exercised at all. Migration
      // 45 inserts on `delivery.queued@1` with `on conflict (delivery_id) do
      // nothing`; so does this, and no more than that.
      append: async (e) => {
        appended.push(e)
        if (e.type === 'delivery.queued@1') {
          const id = e.payload.delivery_id
          if (!rows.deliveries.some((d) => d.delivery_id === id))
            rows.deliveries.push({ estate_id: ESTATE, delivery_id: id, state: 'queued' })
        }
        return {}
      }
    },
    ptys: {
      list: () => [{ sessionId: 's-1', running: true }],
      deliverWhenReady: (sessionId, instruction) => written.push({ sessionId, instruction })
    },
    estateId: ESTATE,
    actor: { kind: 'operator', id: 'op' },
    withDeliveryHeader: (text, id, digest) => `[${id}:${digest}] ${text}`
  })
  return { deliver, appended, written, db }
}


const concurrent = harness();
await Promise.all([concurrent.deliver.deliver('t-1','d-race','yes'),concurrent.deliver.deliver('t-1','d-race','yes')]);
console.log(JSON.stringify({case:'concurrent_same_decision',writes:concurrent.written.length,queued:concurrent.appended.filter(e=>e.type==='delivery.queued@1').length}));
const queued = harness({task_runs:[RUN],deliveries:[{estate_id:ESTATE,delivery_id:continuationDeliveryId('d-crash','t-1'),state:'queued'}]});
const recovered=await queued.deliver.deliver('t-1','d-crash','yes');
console.log(JSON.stringify({case:'crash_after_queue_before_write',writes:queued.written.length,alreadyDelivered:recovered.alreadyDelivered}));
