// #region rehearse-upgrade — docs: docs/launch/release-mac.md#upgrading-an-existing-database
// The pure half of the upgrade rehearsal (CO-198): what a dump's table of contents must hold, how the
// state before and after the candidate's migrations is compared, and the receipt. No process, no file,
// no database here — `scripts/rehearse-upgrade.mjs` gathers, this judges.

/** The PostgreSQL client major version the stack runs (the runbook's step 2: PostgreSQL 17). */
export const PG_MAJOR = 17

/** Whether a `pg_restore --version` / `pg_dump --version` line is this major version. */
export function isPgMajor(versionLine, major = PG_MAJOR) {
  const m = /\(PostgreSQL\) (\d+)\./.exec(String(versionLine))
  return !!m && Number(m[1]) === major
}

/**
 * What `pg_restore --list` must show for a Fabric database dump: the journal table and the migration
 * ledger. Without the ledger `supabase migration up` would reapply every migration over existing
 * objects; without the journal it is not a Fabric estate.
 */
export function dumpProblems(list) {
  const text = String(list)
  const problems = []
  if (!/\bTABLE public journal\b/.test(text)) problems.push('the dump holds no public.journal table — it is not a Fabric database')
  if (!/\bTABLE supabase_migrations schema_migrations\b/.test(text))
    problems.push('the dump holds no supabase_migrations.schema_migrations — the applied migrations cannot be known, so the candidate cannot be applied on top')
  return problems
}

/**
 * The restore list without the default privileges of Supabase's own roles (`supabase_admin`,
 * `supabase_auth_admin`, …): `postgres` may not change another role's defaults, and a fresh Supabase
 * stack already carries them. Returns the filtered list and the entries it left out, named.
 */
export const RESTORED_SCHEMAS = ['public', 'supabase_migrations']

export function restoreList(list) {
  const keep = [], skipped = []
  for (const line of String(list).split('\n')) {
    const m = / DEFAULT ACL (\S+) DEFAULT PRIVILEGES FOR \S+ supabase_\w+\s*$/.exec(line)
    if (!m) { keep.push(line); continue }
    // Only the schemas being restored count as left out; the others were never selected.
    if (RESTORED_SCHEMAS.includes(m[1])) skipped.push(line.replace(/^\d+; \d+ \d+ /, ''))
  }
  return { list: keep.join('\n'), skipped }
}

/**
 * The verdict of one rehearsal. `before` and `after` are `{schemaVersion, journal, tables: {name: rows}}`
 * read from the disposable stack right after the restore and right after the candidate's migrations;
 * `expected` is the candidate's compiled schema contract maximum.
 */
export function judge({ dumpVersion, before, after, expected }) {
  const failures = [], notes = []
  if (before.schemaVersion !== dumpVersion)
    failures.push(`the restored database reports schema ${before.schemaVersion}, the dump was taken at ${dumpVersion}`)
  if (after.schemaVersion !== expected)
    failures.push(`after the candidate's migrations the schema is ${after.schemaVersion}, the candidate admits ${expected}`)
  if (after.journal !== before.journal)
    failures.push(`the journal held ${before.journal} events before the migrations and ${after.journal} after — a migration must not add or lose history`)
  for (const [table, rows] of Object.entries(before.tables)) {
    if (!(table in after.tables)) { failures.push(`table ${table} existed before the migrations and is gone after`); continue }
    const now = after.tables[table]
    if (now < rows) failures.push(`table ${table} lost rows: ${rows} → ${now}`)
    else if (now > rows) notes.push(`table ${table} gained rows: ${rows} → ${now} (a migration backfilled it)`)
  }
  for (const table of Object.keys(after.tables))
    if (!(table in before.tables)) notes.push(`table ${table} is new (${after.tables[table]} rows)`)
  return { ok: failures.length === 0, failures, notes }
}

/** The receipt a rehearsal writes: enough to prove what ran, never a row of the operator's data. */
export function receipt({ dump, candidate, stack, before, after, verdict, timings, tools, skipped = [] }) {
  return {
    format: 'FabricUpgradeRehearsal@1',
    at: new Date().toISOString(),
    dump: { file: dump.file, sha256: dump.sha256, bytes: dump.bytes },
    candidate: { ref: candidate.ref, commit: candidate.commit, migrations: candidate.count, admits: candidate.expected },
    stack: { projectId: stack.projectId, kept: stack.kept },
    tools,
    before: { schemaVersion: before.schemaVersion, journal: before.journal, tables: Object.keys(before.tables).length },
    after: { schemaVersion: after.schemaVersion, journal: after.journal, tables: Object.keys(after.tables).length },
    verdict: verdict.ok ? 'PASS' : 'FAIL',
    failures: verdict.failures,
    notes: verdict.notes,
    seconds: timings,
    skippedFromRestore: skipped,
    notCovered: [
      'the restored estate is not opened in the Fabric app here: start the installed build against the upgraded working stack (runbook step 4)',
      'restored hub requests, source credentials and pending work are checked by the app\'s restore boundary, not by this rehearsal'
    ]
  }
}
// #endregion rehearse-upgrade
