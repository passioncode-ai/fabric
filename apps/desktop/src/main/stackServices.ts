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

/** The container each excluded service runs as, by the Supabase CLI's naming (`supabase_<name>_<project_id>`). */
const CONTAINER_OF: Readonly<Record<string, string>> = Object.freeze({
  realtime: 'realtime', 'storage-api': 'storage', imgproxy: 'imgproxy', mailpit: 'inbucket', 'postgres-meta': 'pg_meta',
  studio: 'studio', 'edge-runtime': 'edge_runtime', logflare: 'analytics', vector: 'vector', supavisor: 'pooler'
})

export function excludedContainers(projectId: string): string[] {
  return STACK_EXCLUDED_SERVICES.map((service) => `supabase_${CONTAINER_OF[service] ?? service}_${projectId}`)
}

/**
 * CO-333. `-x` only keeps `supabase start` from starting a service; a container an older full start created
 * stays, with `restart: unless-stopped`, and every Docker or OrbStack restart brings it back (measured
 * 2026-10-19: seven such containers from 2026-09-28, ~1.4 GiB and their logs, on a VM that was failing for
 * lack of disk). After a start, the excluded containers of THIS project that exist are removed; their data
 * volumes stay, so a full `supabase start` brings any of them back. Best effort: a docker that does not answer
 * is reported to the caller, never thrown, and never stops Fabric from starting.
 */
export async function removeExcludedContainers(
  projectId: string,
  docker: (args: string[]) => Promise<string>
): Promise<{ removed: string[]; error?: string }> {
  try {
    const present = new Set((await docker(['ps', '-a', '--format', '{{.Names}}'])).split('\n').map((n) => n.trim()).filter(Boolean))
    const removed = excludedContainers(projectId).filter((name) => present.has(name))
    if (removed.length) await docker(['rm', '-f', ...removed])
    return { removed }
  } catch (e) {
    // Not silent: the caller records this as `stack.excluded.removed` with `failed` (env.ts), and a start goes on.
    return { removed: [], error: e instanceof Error ? e.message : String(e) }
  }
}
// #endregion stack-services

// #region stack-database-container — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
/**
 * What Docker says of the stack's database container (0.3.9 review ER-3), for the runtime watch to decide whether a try
 * starts the stack. `supabase stop` removes the project's containers (their volumes stay), so a container that is gone
 * while Docker answers is a stop someone made; one that is running while the database does not answer is a database
 * still coming up (Docker's `unless-stopped` restart, or its own recovery), which `supabase start` cannot help.
 */
export function containerStateFrom(output: string): import('../shared/stackWatch.ts').StackContainers {
  const state = output.trim().split('\n')[0]?.trim().toLowerCase() ?? ''
  if (state === '') return 'absent'
  if (state === 'running' || state === 'restarting' || state === 'paused') return 'running'
  if (state === 'exited' || state === 'created' || state === 'dead' || state === 'removing') return 'stopped'
  return 'unknown'
}

/** Asks Docker; a Docker that does not answer throws, and the watch reads that as `unknown` (a start, which waits for it). */
export async function databaseContainer(projectId: string, docker: (args: string[]) => Promise<string>): Promise<import('../shared/stackWatch.ts').StackContainers> {
  return containerStateFrom(await docker(['ps', '-a', '--filter', `name=^supabase_db_${projectId}$`, '--format', '{{.State}}']))
}
// #endregion stack-database-container
