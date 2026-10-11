// #region db-deadline — docs: docs/reports/2026-10-05-release-032-audit/raw/2026-10-05-architecture.md#fabric-032-rc--architecture-audit
/**
 * A deadline on every request the main process's database client makes (audit 2026-10-05 A7-010).
 *
 * The client had none: a journal append, an IPC read, a routine tick or a board RPC against a database
 * that stopped answering waited on undici's own limit, about 300 s, with the window showing nothing.
 * Each request now ends by `DB_DEADLINE_MS`, or by `DB_LONG_DEADLINE_MS` for the few RPCs that do a
 * restore's or an import's work in one call. A caller's own signal (`.abortSignal(…)`) still ends it
 * sooner: the two are composed, never replaced.
 *
 * A request that runs out of time fails as an `AbortError`/`TimeoutError`, like any other transport
 * failure. A write that timed out may still have committed — the callers that write already treat a
 * transport failure as an outcome they did not see, and retry with the same idempotency key.
 */
export const DB_DEADLINE_MS = 15_000
export const DB_LONG_DEADLINE_MS = 120_000

/** RPCs whose one call carries a whole restore, import, export or replay. */
export const LONG_RPCS: ReadonlySet<string> = new Set([
  'restore_estate',
  'restore_estate_verified',
  'import_declared_snapshot',
  'ceo_export_private_archive',
  'ceo_import_private_archive',
  'rebuild_estate_projections',
  'recover_transcript'
])

/** The deadline for one request URL: the long one for a named long RPC, the default otherwise. */
export function deadlineFor(url: string, ms = DB_DEADLINE_MS, longMs = DB_LONG_DEADLINE_MS): number {
  const rpc = /\/rest\/v1\/rpc\/([A-Za-z0-9_]+)/.exec(url)?.[1]
  return rpc && LONG_RPCS.has(rpc) ? longMs : ms
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

/** A `fetch` for `createClient(…, { global: { fetch } })` that ends every request by its deadline. */
export function fetchWithDeadline(
  base: typeof fetch = fetch,
  options: { ms?: number; longMs?: number } = {}
): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(deadlineFor(urlOf(input), options.ms, options.longMs))
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
    return base(input, { ...init, signal })
  }
}
// #endregion db-deadline
