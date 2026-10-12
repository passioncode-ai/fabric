import { readFileSync } from 'node:fs'
import contract from '../shared/schemaContract.json' with { type: 'json' }
import { readManifest, type ManifestRead } from '../shared/buildManifest.ts'
import { STACK_FOLDER } from '../shared/stackFolder.ts'

/** Which check refused, so the dialog can say what to do in the operator's language (`startup.schema-not-ready.<why>`);
 *  the message stays English, for the copied details and the log. */
export type SchemaWhy = 'contract-invalid' | 'build-mismatch' | 'unverified' | 'behind' | 'ahead'
/** Why an `unverified` check could not read a version (0.3.5 review ER-9): no answer in time, no connection, an error
 *  from the database, or an answer that is not a schema version. Typed and free of the backend's own text, so the
 *  dialog's remedy and the log can name it without carrying what the database said. */
export type SchemaUnverified = 'timeout' | 'transport' | 'backend-error' | 'not-an-integer'

export class SchemaReadinessError extends Error {
  readonly code = 'FABRIC_SCHEMA_NOT_READY'
  readonly why: SchemaWhy
  readonly facts: { found?: number; min?: number; max?: number }
  /** Set when `why` is `unverified`: which way the read failed. */
  readonly check?: SchemaUnverified
  constructor(reason: string, why: SchemaWhy = 'unverified', facts: { found?: number; min?: number; max?: number } = {}, check?: SchemaUnverified) {
    super(reason)
    this.name = 'SchemaReadinessError'
    this.why = why
    this.facts = facts
    if (check) this.check = check
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

const stackPath = STACK_FOLDER
const schemaBehindRecovery = 'Stop all writers and make a verified backup first. Follow https://github.com/passioncode-ai/Fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database before running supabase migration up --local in {stackPath}, then retry. Fabric has not started its workspace services.'

/** The English words of each unverified cause, for the copied details and the log; none carries the backend's text. */
const UNVERIFIED: Record<SchemaUnverified, string> = {
  timeout: 'The database schema check timed out: the database did not answer in time. Check the local stack and retry.',
  transport: 'The database schema could not be verified: Fabric could not reach the database. Check the local stack and retry.',
  'backend-error': 'The database schema could not be verified: the database answered with an error, so it may predate this build. Check the local stack and retry.',
  'not-an-integer': 'The database schema could not be verified: the database answered with something that is not a schema version. Check that Fabric is connected to its own database and retry.'
}
const unverified = (check: SchemaUnverified): SchemaReadinessError => new SchemaReadinessError(UNVERIFIED[check], 'unverified', {}, check)

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
    throw new SchemaReadinessError('The compiled database schema contract is invalid. Install a verified build.', 'contract-invalid')
  if (!input.manifest.ok) {
    if (input.packaged || input.manifest.why !== 'absent')
      throw new SchemaReadinessError('The build manifest is missing or unreadable. Install a verified build, then restart Fabric.', 'build-mismatch')
    // Only an unpackaged source run with NO artifact manifest may use the
    // compiled contract. A present stale/malformed manifest is never ignored.
  } else {
    const { schemaMin, schemaMax } = input.manifest.manifest
    if (schemaMin !== contract.minimum || schemaMax !== contract.maximum)
      throw new SchemaReadinessError('The build manifest does not match the compiled database schema contract. Rebuild or install a verified build, then restart Fabric.', 'build-mismatch')
  }
  const timeout = input.timeoutMs ?? 10_000
  if (!positiveInteger(timeout) || timeout > 60_000)
    throw new SchemaReadinessError('The database schema check deadline is invalid.', 'contract-invalid')
  const deadline = performance.now() + timeout
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let response: { data: unknown; error: unknown }
  let timedOut = false
  try {
    response = await Promise.race([
      Promise.resolve().then(() => input.readSchema(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true
          controller.abort()
          reject(unverified('timeout'))
        }, timeout)
      })
    ])
  } catch {
    // The thrown value is the backend's or the transport's and stays out of the error: only its kind is kept.
    throw unverified(timedOut ? 'timeout' : 'transport')
  } finally {
    if (timer) clearTimeout(timer)
    controller.abort()
  }
  // Timers may be starved by synchronous work; a late answer grants nothing.
  if (performance.now() >= deadline) throw unverified('timeout')
  if (!response) throw unverified('not-an-integer')
  if (response.error != null) throw unverified('backend-error')
  if (!positiveInteger(response.data)) throw unverified('not-an-integer')
  if (response.data < contract.minimum)
    throw new SchemaReadinessError(`The database schema is ${response.data}; this build requires ${contract.minimum}–${contract.maximum}. ${schemaBehindRecovery.replace('{stackPath}', stackPath)}`, 'behind', { found: response.data, min: contract.minimum, max: contract.maximum })
  if (response.data > contract.maximum)
    throw new SchemaReadinessError(`The database schema is ${response.data}; this build supports ${contract.minimum}–${contract.maximum}. Install a compatible build, then retry. Fabric has not started its workspace services.`, 'ahead', { found: response.data, min: contract.minimum, max: contract.maximum })
  return start()
}
