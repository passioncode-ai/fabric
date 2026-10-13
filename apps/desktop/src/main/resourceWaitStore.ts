// #region resource-wait-store-client — docs: docs/execution/harness-waves/resource-wait-store.md#client-boundary
import type { ResourceWaitInput, ResourceWaitRecord, ResourceWaitStore, WaitQueueScope } from './resourceWaitQueue.ts'

export interface ResourceWaitRpc {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error?: unknown }>
}
const sameScope = (a: WaitQueueScope, b: WaitQueueScope) =>
  a.estateId === b.estateId && a.hostId === b.hostId && a.poolId === b.poolId
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Wait store receipt unavailable')
  return value as Record<string, unknown>
}
/** This client is internal and scope-bound; it neither installs a schema nor
 * configures a queue. Full row validation belongs to the queue kernel. The DB
 * enforces mutations; an RPC error never becomes an empty/successful receipt.
 * Reuse one kernel instance for its pending-operation/backpressure contract. */
export function createResourceWaitStore(db: ResourceWaitRpc, scope: WaitQueueScope): ResourceWaitStore {
  const bound = Object.freeze({ ...scope })
  const guard = (candidate: WaitQueueScope) => {
    if (!sameScope(candidate, bound)) throw Error('Wait store scope changed')
  }
  async function call(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      const answer = await db.rpc(name, args)
      if (answer.error) throw Error('refused')
      return answer.data
    } catch { /* Safe structured failure: RPC diagnostics can contain private input. */ throw Error('Wait store receipt unavailable') }
  }
  async function receipt(name: string, args: Record<string, unknown>) {
    const data = object(await call(name, args))
    if (data.ok !== true) throw Error('Wait store refused')
    return data
  }
  function row(raw: unknown, id: string): ResourceWaitRecord {
    const data = object(raw), input = object(data.input)
    guard(object(input.scope) as unknown as WaitQueueScope)
    if (input.id !== id) throw Error('Wait store identity changed')
    return data as unknown as ResourceWaitRecord
  }
  return {
    async insert(input: ResourceWaitInput) {
      guard(input.scope)
      return row((await receipt('resource_wait_insert', { p_input: input })).record, input.id)
    },
    async read(candidate: WaitQueueScope, id: string) {
      guard(candidate)
      const value = (await receipt('resource_wait_read', { p_scope: bound, p_id: id })).record
      return value === null ? null : row(value, id)
    },
    async page(candidate: WaitQueueScope, limit: number) {
      guard(candidate)
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw Error('Invalid wait page bound')
      const value = await receipt('resource_wait_page', { p_scope: bound, p_limit: limit })
      if (!Array.isArray(value.rows) || value.rows.length > limit || typeof value.more !== 'boolean') throw Error('Wait page unavailable')
      return { rows: value.rows.map(value => {
        const id = object(object(value).input).id
        if (typeof id !== 'string') throw Error('Wait row identity unavailable')
        return row(value, id)
      }), more: value.more }
    },
    async cas(candidate: WaitQueueScope, id: string, revision: number, next: ResourceWaitRecord) {
      guard(candidate); guard(next.input.scope)
      if (next.input.id !== id || !Number.isSafeInteger(revision) || revision < 1) throw Error('Wait CAS identity changed')
      const result = await call('resource_wait_cas', { p_scope: bound, p_id: id, p_revision: revision, p_next: next })
      if (typeof result !== 'boolean') throw Error('Wait CAS receipt unavailable')
      return result
    }
  }
}
// #endregion resource-wait-store-client
