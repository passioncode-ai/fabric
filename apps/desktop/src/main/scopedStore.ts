// The database client, narrowed to one scope (S02.a).
//
// The decision this makes is in `shared/scope.ts` and is tested there without a
// database. What lives here is the binding: apply those predicates to a Supabase
// builder and hand the builder on, so a caller keeps chaining exactly as before
// (`.eq('id', x).maybeSingle()`) and never gets the chance to start from a naked
// client.
//
// THE POINT IS WHAT IS NOT EXPORTED. There is no `raw()`, no `unscoped(reason)`,
// no escape hatch — an escape hatch with a reason parameter is a door, and doors
// get used. `index.ts` keeps the naked client for bootstrap, where no scope
// exists yet; everything downstream is handed one of these instead.
//
// THE TYPE IS INFERRED RATHER THAN DECLARED, and that is not a style choice. An
// explicit `interface ScopedStore { select(...): Selected }` compiles and throws
// away the column-string generic on the way through, so every row arrives as
// `unknown` and each call site needs a cast that says nothing. Inference keeps
// the generic, so a scoped read is typed exactly as the unscoped one was.

import type { SupabaseClient } from '@supabase/supabase-js'
import { scopeFilters, scopeOwnership, type Scope } from '../shared/scope.ts'

/** A project id that is not the one this store is scoped to. Refused rather
 *  than widened: an id arriving from a renderer or an agent payload names what
 *  the caller wants to look at, never what it may look at. */
export class OutOfScope extends Error {
  readonly projectId: string
  constructor(projectId: string) {
    super(`project ${projectId} is not in this scope`)
    this.name = 'OutOfScope'
    this.projectId = projectId
  }
}

export function createScopedStore(db: SupabaseClient, scope: Scope) {
  return {
    scope,

    select<Table extends string, Columns extends string>(
      table: Table,
      columns: Columns,
      options?: { head?: boolean; count?: 'exact' | 'planned' | 'estimated' }
    ) {
      const filters = scopeFilters(table, scope)
      let q = db.from(table).select(columns, options)
      for (const [column, value] of filters) q = q.eq(column, value)
      return q
    },

    // #region bounded-reads — docs: docs/evidence/backlog.md#work-s02-store
    /**
     * A read whose filter is a LIST the caller did not size.
     *
     * MEASURED 2026-09-10, and it arrived without a code change. `chainAdvance`
     * read every follows-link, then asked for the follower tasks with
     * `.in('id', followerIds)`. At 294 ids that filter is 10 879 characters, and
     * the gateway answers **HTTP 414 URI too long** — reproduced with `curl`
     * against the live stack. The advancer read `.data ?? []`, so a refused
     * request became "no followers are waiting" and unattended chains silently
     * stopped advancing. `ci.sh full` was green that morning and red that
     * afternoon with nothing committed in between: the id list grows with the
     * data, so the URL crosses the limit on its own.
     *
     * It is the FOURTH time this shape has been found — FA-04, FA-03 and FA-02
     * each closed one — and the first time in a query whose SIZE is the trigger.
     * So the fix is a function rather than a patch: the list is chunked, and the
     * error is READ. A caller gets `{ rows, failed }` and cannot mistake a
     * refused read for an empty table, because `failed` is not an empty array.
     */
    async selectIn<Table extends string, Columns extends string>(
      table: Table,
      columns: Columns,
      column: string,
      values: readonly string[],
      chunk = 100
    ): Promise<{ rows: Record<string, unknown>[]; failed: string | null }> {
      const filters = scopeFilters(table, scope)
      if (!values.length) return { rows: [], failed: null }
      const rows: Record<string, unknown>[] = []
      for (let i = 0; i < values.length; i += chunk) {
        let q = db.from(table).select(columns)
        for (const [c, value] of filters) q = q.eq(c, value)
        const { data, error } = await q.in(column, values.slice(i, i + chunk) as string[])
        // NOT `?? []`. A read that did not happen is not a read that found
        // nothing, and every caller of this function is deciding whether to act.
        if (error)
          return {
            rows: [],
            failed: `${table}.${column} could not be read (${error.code ?? 'no code'}): ${error.message}`
          }
        rows.push(...((data ?? []) as Record<string, unknown>[]))
      }
      return { rows, failed: null }
    },

    /**
     * EVERY matching row, paged, or the reason it could not be read.
     *
     * The gateway answers at most `max_rows` rows (1000, `supabase/config.toml`)
     * however many match, and says nothing about the rest — a capped answer and
     * a complete one look identical to the caller. MEASURED in the 2026-10-03
     * release review: the chain advance read `task_links` in one request, the
     * probe estate already held 686 `follows` rows, and past the cap a
     * follower's unfinished predecessor would simply not be in the answer — so
     * the follower would start before it. `selectIn` bounds a FILTER that grows
     * with the data; this bounds the ANSWER.
     *
     * Paged by `range` over a stable order the caller names (a page boundary on
     * an unordered read can skip or repeat a row), with an exact count so a
     * gateway whose cap is lower than `pageSize` is still read to the end. The
     * same `{ rows, failed }` shape as `selectIn`: a refused page is `failed`,
     * never a shorter list, and every caller of this is deciding whether to act.
     */
    async selectAll<Table extends string, Columns extends string>(
      table: Table,
      columns: Columns,
      opts: {
        eq?: ReadonlyArray<readonly [column: string, value: string | number | boolean]>
        /** Columns that must be null — in the query, so the cap pages over matching rows only. */
        isNull?: readonly string[]
        /** `column > value`, in the query (an expiry still ahead, for instance). */
        gt?: ReadonlyArray<readonly [column: string, value: string | number]>
        orderBy: readonly string[]
        pageSize?: number
        /** A ceiling on the whole read. Past it the read FAILS rather than
         *  returning a partial list — a caller sized for thousands of rows that
         *  is handed millions has a different problem than paging. */
        maxRows?: number
      }
    ): Promise<{ rows: Record<string, unknown>[]; failed: string | null }> {
      const pageSize = opts.pageSize ?? 1000
      const maxRows = opts.maxRows ?? 50_000
      if (!opts.orderBy.length) throw new Error(`a paged read of ${table} needs a stable order`)
      const filters = scopeFilters(table, scope)
      const rows: Record<string, unknown>[] = []
      for (let from = 0; ; ) {
        let q = db.from(table).select(columns, { count: 'exact' })
        for (const [c, value] of filters) q = q.eq(c, value)
        for (const [c, value] of opts.eq ?? []) q = q.eq(c, value)
        for (const c of opts.isNull ?? []) q = q.is(c, null)
        for (const [c, value] of opts.gt ?? []) q = q.gt(c, value)
        for (const c of opts.orderBy) q = q.order(c, { ascending: true })
        const { data, error, count } = await q.range(from, from + pageSize - 1)
        if (error)
          return {
            rows: [],
            failed: `${table} could not be read (${error.code ?? 'no code'}): ${error.message}`
          }
        const page = (data ?? []) as Record<string, unknown>[]
        rows.push(...page)
        from += page.length
        if (rows.length > maxRows)
          return { rows: [], failed: `${table} holds more than ${maxRows} matching rows; the read stopped rather than act on part of them` }
        if (page.length === 0) break
        if (typeof count === 'number' ? rows.length >= count : page.length < pageSize) break
      }
      return { rows, failed: null }
    },
    // #endregion bounded-reads

    /** Fills the scope columns rather than trusting the caller to. A row whose
     *  own values disagreed with the scope would be written and then invisible
     *  to every read — the empty-table failure, one layer down. */
    insert(table: string, row: Record<string, unknown>) {
      const owned: Record<string, unknown> = { ...row }
      for (const [column, value] of scopeOwnership(table, scope)) owned[column] = value
      return db.from(table).insert(owned)
    },

    update(table: string, patch: Record<string, unknown>) {
      const filters = scopeFilters(table, scope)
      let q = db.from(table).update(patch)
      for (const [column, value] of filters) q = q.eq(column, value)
      return q
    },

    delete(table: string) {
      const filters = scopeFilters(table, scope)
      let q = db.from(table).delete()
      for (const [column, value] of filters) q = q.eq(column, value)
      return q
    }
  }
}

/**
 * A store narrowed to one project inside `parent`'s estate.
 *
 * A FREE FUNCTION RATHER THAN A METHOD, for two reasons and the second is the
 * one that matters. `forProject` as a method makes the inferred type refer to
 * itself, which TypeScript resolves by giving up — every row comes back as `{}`
 * and the compiler spends four gigabytes finding that out. And a store that can
 * re-scope itself puts the scope decision back at the call site, which is the
 * thing this module exists to take away: a scope is decided at the trusted
 * boundary, from a window's selection or a minted credential, and handed down.
 */
export function projectStore(db: SupabaseClient, parent: Scope, projectId: string): ScopedStore {
  if (parent.kind === 'project' && parent.projectId !== projectId) throw new OutOfScope(projectId)
  return createScopedStore(db, { kind: 'project', estateId: parent.estateId, projectId })
}

export type ScopedStore = ReturnType<typeof createScopedStore>
