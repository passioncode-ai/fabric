// #region stack-services — docs: docs/adr/0106-fabric-adopts-the-product-lifecycle-contract.md#4-the-stack-runs-only-what-fabric-calls
/**
 * The local Supabase containers Fabric never calls (lifecycle LC-09).
 *
 * MEASURED 2026-10-03: the app's `supabase start` left 11 containers running, ~1.83 GiB at idle, of
 * which ~1.37 GiB were services nothing in Fabric calls — realtime, storage and its image proxy, mail,
 * studio, edge functions, logs and their vector shipper, the pooler and postgres-meta. Fabric speaks
 * PostgREST through Kong and SQL through Postgres; a grep of `apps/desktop/src` and `packages/*\/src`
 * for `.channel(`, `storage.from`, `functions.invoke` and `auth.sign*` finds nothing. The disposable
 * test stack has excluded exactly this list since 2026-10-03 (`scripts/test-stack.mjs` EXCLUDE); a
 * test keeps the two equal.
 */
export const STACK_EXCLUDED_SERVICES = Object.freeze([
  'realtime', 'storage-api', 'imgproxy', 'mailpit', 'postgres-meta', 'studio', 'edge-runtime', 'logflare', 'vector', 'supavisor'
])
// #endregion stack-services
