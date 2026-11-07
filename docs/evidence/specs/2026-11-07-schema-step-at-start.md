# A schema step applied at start, after a backup and a rehearsal (CO-364)

**Status:** proposed, 2026-11-07. Row: [CO-364](2026-08-16-software-fabric-carryover.md) («every schema step is a manual
outage at upgrade»). It unblocks the journal events of CO-409 §7 and every later migration, which today cannot reach an
installed Fabric without the person running the runbook by hand. Plan to the North Star, wave 2 (P-27: «self-update and
the schema step (P-12, CO-364)»).

## 1. What exists (read 2026-11-07 at `738e037b`)

- **The check.** `apps/desktop/src/main/schemaReadiness.ts#withSchemaReadiness` reads `public.schema_version()` (the
  count of rows in `supabase_migrations.schema_migrations`, `supabase/migrations/20260909000051_schema_version.sql`)
  before any workspace service starts, and refuses a database below the build's minimum with `why: 'behind'` and the
  runbook's words (`schemaBehindRecovery`). It is called from `apps/desktop/src/main/index.ts` after the stack is up and
  before `bootstrapReady`.
- **The runbook.** `docs/launch/release-mac.md#upgrading-an-existing-database`: stop every writer; `pg_dump` with a
  PostgreSQL 17 client into a private folder; rehearse on a disposable stack (`scripts/rehearse-upgrade.mjs`, CO-198);
  `supabase migration up --local` in the stack folder; compare `schema_version()` and the journal count; on failure
  restore the tested backup into a clean stack. About four minutes by hand (CO-364's source, ST-6).
- **The rehearsal's judgement** is pure code already: `scripts/lib/rehearse-upgrade.mjs#judge` (schema equals the
  candidate's, journal count unchanged, no public table loses rows), `#dumpProblems`, `#restoreList`, `#receipt`
  (numbers and the dump's sha256, never a row).
- **Writers at that moment.** Before `bootstrapReady` no workspace service runs: the hub answers every call 503
  `stack-starting` (`apps/desktop/src/main/hubStandby.ts`), and no PTY session, routine or board dispatcher has started.
  The runbook's «stop every writer» holds by construction inside Fabric. A stack Fabric did not start is not Fabric's:
  it is never upgraded here.
- **Self-update** (P-12, ADR-0121) never installs past a schema step unasked; a build the person installed is the ask.

## 2. The rule

When the bundled local stack's database is behind and its applied migrations are a prefix of the build's own, Fabric
takes the step itself, in this order, and starts only when every check passed:

1. **Backup**, verified, kept.
2. **Rehearsal** of the step on a copy of that backup, judged as `scripts/lib/rehearse-upgrade.mjs#judge` judges it.
3. **Apply** to the working database with `supabase migration up --local`, the runbook's command.
4. **Verify** the working database with the same judgement against the backup's numbers.

Anything that fails stops the start with its reason, the backup's path and the one next action; Fabric never retries a
failed step by itself and never touches a database whose ledger is not a prefix of its own.

## 3. The flow

| Step | What happens | Refuses when |
|---|---|---|
| 0. Admit | `found < minimum`, the stack is the bundled one, and `supabase_migrations.schema_migrations.version` read in order is a prefix of the bundled migration filenames' versions | the ledger is not a prefix (another branch's database): today's refusal, unchanged |
| 1. Space | `pg_database_size` of the database, free space of the backups folder | free < 2 × size + 1 GB: «not enough disk for a safe upgrade», with both numbers |
| 2. Backup | `pg_dump --format=custom` run inside the database container (`docker exec supabase_db_<project>`), so the client is the server's own PostgreSQL 17, streamed to `<userData>/backups/pre-<app version>-schema-<found>-<UTC stamp>.dump` (mode 600); `pg_restore --list` of the file the same way, `dumpProblems` empty; a receipt beside it: sha256, bytes, schema, journal count, each public table's row count | the dump or its listing fails |
| 3. Rehearse | a disposable stack (`fabric_test_<random>`, its own port block, as `scripts/lib/test-stack.mjs`) with no migrations; the dump's `public` and `supabase_migrations` restored (`restoreList`); the bundled migrations applied with `supabase migration up --local`; `judge` against the receipt; the stack removed in every outcome | `judge` fails, or the stack cannot start (Docker, ports) |
| 4. Apply | `supabase migration up --local` in the bundled stack folder | the command fails |
| 5. Verify | `schema_version()` within the contract, `judge` against the receipt | any check fails |
| 6. Start | the ordinary start continues; the receipt records `applied` | |

A failure at 4 or 5 leaves the working database in a state Fabric does not open. The refusal names the backup and the
runbook's step 5 (restore into a clean stack); Fabric does not restore by itself, because a restore over a database in
an unknown state is the one act here that can lose what the backup does not hold. A marker
(`<userData>/backups/schema-step.failed.json`) keeps the next start from trying again until the person presses
«Попробовать снова» or the build changes.

## 4. What the person sees

The splash already says why a start waits (SCN-161). It gains three lines, one per long step, each with its elapsed time:
«Сохраняю копию базы», «Проверяю обновление на копии», «Обновляю базу». The rehearsal is the long one (a disposable
stack starts in about a minute on the operator's Mac; to be measured in the build of step 3). A refusal opens the
existing startup-failure window with the reason, the backup's folder (a «Показать в Finder» action) and «Попробовать
снова». This is a change to SCN-161 through `super-ux`, its text through the text check, in the change that builds step 4.

## 5. Logging

The operations log records `schema.step.admitted`, `.backup`, `.rehearsal`, `.applied`, `.verified` and `.refused`, each
with numbers only (schemas, counts, bytes, durations) and the refusal's code. The receipt file is the durable record;
no journal event is added for the step itself, because a journal event needs the schema the step is still taking.

## 6. Edge cases

- **Docker is up but the database container is not running:** the stack start already waits for it
  (`apps/desktop/src/shared/stackStartRetry.ts`); the step begins only after the schema read answered.
- **The person quits during the step:** quit waits for the current command up to its deadline; a quit during step 4 is
  recorded and the next start reads the ledger again (step 0 decides).
- **Two Fabric processes:** the single-instance lock already holds (`index.ts`, `requestSingleInstanceLock`); the step
  also takes `<userData>/backups/.schema-step.lock`.
- **A database ahead of the build:** unchanged (`why: 'ahead'`, install a compatible build).
- **Windows and Linux:** the same commands, through the same Docker and Supabase CLI the stack already needs.

## 7. Steps of the build

1. **Admit and back up** (`apps/desktop/src/main/schemaStep.ts`): steps 0 to 2 behind a seam of `docker` and `supabase`
   calls, unit-tested with fakes and a fake `docker` on the PATH. **Built 2026-11-07**; measured on the live database
   read-only (6.4 s, 23 MB, 79 tables), where `pg_restore --list` closing its input after the table of contents showed
   that EPIPE on that pipe is the reader being done.
2. **Rehearse:** move the disposable-stack part of `scripts/rehearse-upgrade.mjs` into a module both the script and
   the app call, reading migrations from the bundled stack folder instead of `git archive`.
3. **Apply and verify**, the marker and the lock.
4. **The person's view** (SCN-161, the text check), and the runbook rewritten: the manual procedure stays as the fallback.
5. **Verification** on the operator's Mac with a real upgrade from 100 to the first build that adds a migration (CO-409
   §7's events are the natural first step to ship this way).

## 8. Open questions

1. **Ask before the step, or tell while it runs?** Proposed: tell. The person installed the build (ADR-0121's ask);
   a second question would bring back the outage this row removes. The backup is kept either way.
2. **How long to keep backups.** Proposed: the last three receipts and their dumps; older ones removed only after a
   newer step verified.
