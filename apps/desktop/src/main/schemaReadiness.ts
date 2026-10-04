import { readFileSync } from 'node:fs'
import contract from '../shared/schemaContract.json' with { type: 'json' }
import { readManifest, type ManifestRead } from '../shared/buildManifest.ts'

export class SchemaReadinessError extends Error {
  readonly code = 'FABRIC_SCHEMA_NOT_READY'
  constructor(reason: string) {
    super(reason)
    this.name = 'SchemaReadinessError'
  }
}

/** Only absence permits trying another location. A present broken artifact must
 * not borrow the identity of a different copy or become the dev-only fallback. */
export function readBuildManifestCandidates(files: readonly string[]): ManifestRead {
  for (const file of files) {
    try {
      const read = readManifest(JSON.parse(readFileSync(file, 'utf8')))
      return !read.ok && read.why === 'absent'
        ? { ok: false, why: 'unreadable', says: 'the present build manifest contains no identity' }
        : read
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') continue
      return { ok: false, why: 'unreadable', says: 'the build manifest could not be read' }
    }
  }
  return readManifest(null)
}

const stackPath = '~/Library/Application Support/Fabric/stack'
const schemaBehindRecovery = 'Stop all writers and make a verified backup first. Follow docs/launch/release-mac.md#upgrading-an-existing-database before running supabase migration up --local in {stackPath}, then retry. Fabric has not started its workspace services.'

const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/** A per-attempt fence, not a runtime migration lock. Deployment must still
 * stop every writer before changing schema. No automatic migration or ahead
 * read model is provided. The callback owns ALL domain startup effects. */
export async function withSchemaReadiness<T>(input: {
  packaged: boolean
  manifest: ManifestRead
  readSchema: (signal: AbortSignal) => PromiseLike<{ data: unknown; error: unknown }>
  timeoutMs?: number
}, start: () => T | Promise<T>): Promise<T> {
  if (contract.schema !== 'FabricSchemaContract@1' || !positiveInteger(contract.minimum) ||
      !positiveInteger(contract.maximum) || contract.minimum > contract.maximum)
    throw new SchemaReadinessError('The compiled database schema contract is invalid. Install a verified build.')
  if (!input.manifest.ok) {
    if (input.packaged || input.manifest.why !== 'absent')
      throw new SchemaReadinessError('The build manifest is missing or unreadable. Install a verified build, then restart Fabric.')
    // Only an unpackaged source run with NO artifact manifest may use the
    // compiled contract. A present stale/malformed manifest is never ignored.
  } else {
    const { schemaMin, schemaMax } = input.manifest.manifest
    if (schemaMin !== contract.minimum || schemaMax !== contract.maximum)
      throw new SchemaReadinessError('The build manifest does not match the compiled database schema contract. Rebuild or install a verified build, then restart Fabric.')
  }
  const timeout = input.timeoutMs ?? 10_000
  if (!positiveInteger(timeout) || timeout > 60_000)
    throw new SchemaReadinessError('The database schema check deadline is invalid.')
  const deadline = performance.now() + timeout
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let response: { data: unknown; error: unknown }
  try {
    response = await Promise.race([
      Promise.resolve().then(() => input.readSchema(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new SchemaReadinessError('The database schema check timed out. Check the local stack and retry.'))
        }, timeout)
      })
    ])
  } catch {
    throw new SchemaReadinessError('The database schema could not be verified. Check the local stack and retry.')
  } finally {
    if (timer) clearTimeout(timer)
    controller.abort()
  }
  // Timers may be starved by synchronous work; a late answer grants nothing.
  if (performance.now() >= deadline || !response || response.error != null || !positiveInteger(response.data))
    throw new SchemaReadinessError('The database schema could not be verified. Check the local stack and retry.')
  if (response.data < contract.minimum)
    throw new SchemaReadinessError(`The database schema is ${response.data}; this build requires ${contract.minimum}–${contract.maximum}. ${schemaBehindRecovery.replace('{stackPath}', stackPath)}`)
  if (response.data > contract.maximum)
    throw new SchemaReadinessError(`The database schema is ${response.data}; this build supports ${contract.minimum}–${contract.maximum}. Install a compatible build, then retry. Fabric has not started its workspace services.`)
  return start()
}
