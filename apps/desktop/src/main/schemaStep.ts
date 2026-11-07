// #region schema-step — docs: docs/evidence/specs/2026-11-07-schema-step-at-start.md#3-the-flow
/**
 * A schema step applied at start (CO-364), its first build step: whether a behind database may be stepped at all
 * (step 0), whether the disk holds a safe backup (step 1), and the backup itself with its receipt (step 2). The
 * rehearsal, the apply and the verification are the next build steps; nothing here changes the working database.
 *
 * Every database act runs INSIDE the stack's own database container (`docker exec supabase_db_<project>`), so the
 * client is the server's own PostgreSQL 17 (the runbook's step 2 needed a PostgreSQL 17 client on the PATH) and no
 * password travels. The receipt holds numbers and the dump's digest, never a row: what the rehearsal and the
 * verification are judged against (`shared/upgradeRehearsal.ts#judge`).
 */
import { spawn, execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, readdirSync, statSync, writeFileSync, mkdirSync, statfsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { dumpProblems, type DatabaseNumbers } from '../shared/upgradeRehearsal.ts'

/** The database acts the step needs, one seam so tests run without Docker. */
export interface SchemaStepPorts {
  /** One SQL text through `psql -At -v ON_ERROR_STOP=1`; resolves its standard output. */
  sql(text: string): Promise<string>
  /** `pg_dump --format=custom` of the database into `file` (created mode 600). */
  dump(file: string): Promise<void>
  /** `pg_restore --list` of `file`. */
  list(file: string): Promise<string>
  /** Free bytes on the volume holding `dir`. */
  freeBytes(dir: string): Promise<number>
  /** The file's sha256 and size. */
  digest(file: string): Promise<{ sha256: string; bytes: number }>
  /** Writes the receipt beside the dump, mode 600. */
  writeReceipt(file: string, text: string): Promise<void>
}

export type Admission =
  | { ok: true; pending: string[] }
  | { ok: false; why: 'not-behind' | 'not-bundled' | 'not-a-prefix'; says: string }

/** A migration file's version: the digits before its first underscore, as Supabase records it. */
export function migrationVersion(file: string): string | null {
  const m = /^(\d{8,})_[^/]*\.sql$/.exec(file)
  return m ? m[1]! : null
}

/** The bundled migrations' versions in the order `supabase migration up` applies them. */
export function bundledVersions(files: readonly string[]): string[] {
  return files.map(migrationVersion).filter((v): v is string => v !== null).sort()
}

/**
 * Step 0. A database is stepped only when it is behind, lives in the stack Fabric bundles, and its applied ledger is
 * exactly the start of the build's own: then `supabase migration up` applies precisely the rest. Anything else (a
 * database of another branch, a hand-applied migration) keeps today's refusal.
 */
export function admitStep(input: { found: number; minimum: number; bundledStack: boolean; ledger: readonly string[]; bundled: readonly string[] }): Admission {
  const { found, minimum, bundledStack, ledger, bundled } = input
  if (!(found < minimum)) return { ok: false, why: 'not-behind', says: `the schema is ${found}; this build needs ${minimum}` }
  if (!bundledStack) return { ok: false, why: 'not-bundled', says: 'the database is not in the stack Fabric bundles, so Fabric does not change it' }
  if (ledger.length !== found)
    return { ok: false, why: 'not-a-prefix', says: `the database reports schema ${found} but its ledger holds ${ledger.length} migrations` }
  for (let i = 0; i < ledger.length; i++)
    if (ledger[i] !== bundled[i])
      return { ok: false, why: 'not-a-prefix', says: `applied migration ${i + 1} is ${ledger[i]}; this build's is ${bundled[i] ?? 'none'}: the database comes from another build` }
  const pending = bundled.slice(ledger.length)
  if (ledger.length + pending.length < minimum)
    return { ok: false, why: 'not-a-prefix', says: `this build bundles ${bundled.length} migrations, fewer than the ${minimum} it needs` }
  return { ok: true, pending }
}

/** One read of the schema, the journal's events and every public table's rows: what `judge` compares. */
export const NUMBERS_SQL = `select 'schema|' || public.schema_version()
union all select 'journal|' || count(*) from public.journal
union all select 't|' || table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE';`

export function parseNumbers(out: string): DatabaseNumbers {
  let schemaVersion: number | null = null, journal: number | null = null
  const tables: Record<string, number> = {}
  for (const line of out.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split('|')
    const n = Number(parts[parts.length - 1])
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(`a count is not a number: ${parts[0]}`)
    if (parts[0] === 'schema' && parts.length === 2) schemaVersion = n
    else if (parts[0] === 'journal' && parts.length === 2) journal = n
    else if (parts[0] === 't' && parts.length === 3) tables[parts[1]!] = n
    else throw new Error(`an unexpected line in the numbers read: ${parts[0]}`)
  }
  if (schemaVersion === null || journal === null) throw new Error('the numbers read named no schema or no journal')
  return { schemaVersion, journal, tables }
}

export const LEDGER_SQL = 'select version from supabase_migrations.schema_migrations order by version;'
export const SIZE_SQL = 'select pg_database_size(current_database());'

/** The margin above twice the database's size the backups folder must keep free (spec §3, step 1). */
export const SPACE_MARGIN_BYTES = 1024 ** 3

export interface BackupReceipt {
  format: 'FabricSchemaStepBackup@1'
  at: string
  appVersion: string
  file: string
  sha256: string
  bytes: number
  numbers: DatabaseNumbers
}

export type Backup =
  | { ok: true; file: string; receipt: BackupReceipt }
  | { ok: false; why: 'no-space' | 'moved' | 'dump-failed' | 'dump-incomplete'; says: string; file?: string }

const stampOf = (at: Date): string => at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

/** Steps 1 and 2: room for the backup, then the backup, its listing and its receipt. */
export async function backupBeforeStep(ports: SchemaStepPorts, input: { dir: string; appVersion: string; found: number; now: Date }): Promise<Backup> {
  const size = Number((await ports.sql(SIZE_SQL)).trim())
  const free = await ports.freeBytes(input.dir)
  if (!Number.isFinite(size) || free < 2 * size + SPACE_MARGIN_BYTES)
    return { ok: false, why: 'no-space', says: `not enough disk for a safe upgrade: the database is ${size} bytes and ${free} bytes are free; ${2 * size + SPACE_MARGIN_BYTES} are needed` }
  const numbers = parseNumbers(await ports.sql(NUMBERS_SQL))
  if (numbers.schemaVersion !== input.found)
    return { ok: false, why: 'moved', says: `the schema moved from ${input.found} to ${numbers.schemaVersion} while the step began` }
  const file = path.join(input.dir, `pre-${input.appVersion}-schema-${input.found}-${stampOf(input.now)}.dump`)
  try {
    await ports.dump(file)
  } catch (e) {
    // A dump that failed part-way is not a backup: said with its file, which the caller removes.
    return { ok: false, why: 'dump-failed', says: `the backup failed: ${e instanceof Error ? e.message.slice(0, 300) : 'pg_dump failed'}`, file }
  }
  const problems = dumpProblems(await ports.list(file))
  if (problems.length) return { ok: false, why: 'dump-incomplete', says: `the backup is incomplete: ${problems.join('; ')}`, file }
  const { sha256, bytes } = await ports.digest(file)
  const receipt: BackupReceipt = { format: 'FabricSchemaStepBackup@1', at: input.now.toISOString(), appVersion: input.appVersion, file: path.basename(file), sha256, bytes, numbers }
  await ports.writeReceipt(`${file}.json`, `${JSON.stringify(receipt, null, 2)}\n`)
  return { ok: true, file, receipt }
}

/** The migration files a stack folder bundles. */
export function readBundledMigrations(stackRoot: string): string[] {
  return bundledVersions(readdirSync(path.join(stackRoot, 'supabase', 'migrations')))
}

const execFileP = promisify(execFile)

/** The real ports: every act through `docker exec` in the stack's database container. */
export function dockerPorts(opts: { container: string; deadlineMs?: number }): SchemaStepPorts {
  const deadline = opts.deadlineMs ?? 30 * 60_000
  const exec = (args: string[]): string[] => ['exec', '-i', opts.container, ...args]
  // A pipe between a file and `docker exec`, ended by the deadline; resolves stdout when the file is the input.
  const piped = (args: string[], io: { from?: string; to?: string }): Promise<string> => new Promise((resolve, reject) => {
    const child = spawn('docker', exec(args), { stdio: ['pipe', 'pipe', 'pipe'] })
    const timer = setTimeout(() => child.kill('SIGKILL'), deadline)
    let out = '', err = ''
    child.stderr.on('data', (d: Buffer) => { err = (err + d.toString('utf8')).slice(-2000) })
    // The dump is whole only once its file stream has flushed, not when the process exits.
    let written: Promise<void> = Promise.resolve()
    if (io.to) {
      const file = createWriteStream(io.to, { mode: 0o600 })
      written = new Promise((done, fail) => { file.on('finish', () => done()); file.on('error', fail) })
      child.stdout.pipe(file)
    } else child.stdout.on('data', (d: Buffer) => { out += d.toString('utf8') })
    // `pg_restore --list` reads only the table of contents at the head of a dump and exits before the rest is written
    // to it: EPIPE on its input is then the reader being done, not a failure (measured on the live stack, 2026-11-07).
    // The exit code alone decides.
    child.stdin.on('error', (e: NodeJS.ErrnoException) => { if (e.code !== 'EPIPE') reject(e) })
    if (io.from) {
      const source = createReadStream(io.from)
      source.on('error', reject)
      child.stdin.on('close', () => source.destroy())
      source.pipe(child.stdin)
    } else child.stdin.end()
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) written.then(() => resolve(out), reject)
      else reject(new Error(signal ? `${args[0]} was stopped (${signal})` : `${args[0]} exited ${code}: ${err.trim().split('\n').pop() ?? ''}`))
    })
  })
  return {
    async sql(text) {
      const { stdout } = await execFileP('docker', exec(['psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', text]), { encoding: 'utf8', timeout: deadline, maxBuffer: 16 * 1024 * 1024 })
      return stdout
    },
    async dump(file) {
      mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
      try {
        await piped(['pg_dump', '-U', 'postgres', '--format=custom', 'postgres'], { to: file })
      } catch (e) {
        rmSync(file, { force: true })
        throw e
      }
    },
    list: (file) => piped(['pg_restore', '--list'], { from: file }),
    async freeBytes(dir) {
      mkdirSync(dir, { recursive: true, mode: 0o700 })
      const s = statfsSync(dir)
      return Number(s.bavail) * Number(s.bsize)
    },
    digest: (file) => new Promise((resolve, reject) => {
      const hash = createHash('sha256')
      createReadStream(file).on('error', reject).on('data', (d) => hash.update(d)).on('end', () => resolve({ sha256: hash.digest('hex'), bytes: statSync(file).size }))
    }),
    async writeReceipt(file, text) { writeFileSync(file, text, { mode: 0o600 }) }
  }
}
// #endregion schema-step
