# CO-198 — the database upgrade rehearsal is executable (2026-10-05)

**Objective.** Runbook steps 3 and 5 of [upgrading an existing database](../launch/release-mac.md#upgrading-an-existing-database)
had no executable commands (CO-198, found in 0.3.1 verification iteration 3). The operator's live database must move
from schema 75 to 78 after installing 0.3.1, and only after a rehearsal on their own dump.

**What exists now.** `scripts/rehearse-upgrade.mjs` with its pure half `scripts/lib/rehearse-upgrade.mjs`:

- `--dump <file> --ref <tag> --from <schema>` starts a disposable stack (`scripts/test-stack.mjs`, new options
  `migrationsDir`, `migrationCount`, `seed`) with **no** migrations, restores the dump's `public` schema and
  migration ledger (leaving out the default privileges of Supabase's own roles, which `postgres` may not set and a
  fresh stack already has — each one named in the receipt), copies in the candidate's migrations read from the tag
  with `git archive`, applies them with `supabase migration up --local` (runbook step 4's command), and judges:
  schema equals the candidate's admitted maximum, journal count unchanged, no public table loses rows.
- It writes a mode-600 receipt beside the dump (numbers, hashes, notes; never a row), removes the stack — also when
  `up()` failed half-way — and exits 0 only on PASS.
- `--make-fixture <N> --out <file>` builds a synthetic dump at the first N migrations with the seed's estate and five
  projects written through the journal: how the rehearsal is tested.

**Checks run (2026-10-05, load average 130–220 on this machine).**

| Command | Result |
|---|---|
| `node --test scripts/test/rehearse-upgrade.test.mjs` | 7/7 (client version, dump contents, restore list, verdicts, receipt, arguments) |
| `node scripts/rehearse-upgrade.mjs --make-fixture 75 --out fixture-75.dump` | schema 75, journal 6, 53 tables |
| `node scripts/rehearse-upgrade.mjs --dump fixture-75.dump --ref v0.3.1 --from 75` | **PASS**, exit 0: schema 75 → 78 (admits 78), journal 6 → 6, 53 → 57 tables (the four hub tables new, `event_types` backfilled 89 → 99); stack 182 s, restore 2 s, migrate 7 s — [receipt](co198/fixture-75-to-v0.3.1.rehearsal.json) (dump sha256 `86945506890fd990…`) |
| the same with `--from 74` | **FAIL**, exit 1: "the restored database reports schema 75, the dump was taken at 74" — [receipt](co198/fixture-75-wrong-from.rehearsal.json) |
| `docker ps` after each run | no `fabric_test_` container left |

**The operator's own dump (2026-10-05).** The step-2 backup of the live database was taken read-only
(`pg_dump` inside the database container, no password handled; schema 75; mode 600 under
`~/Library/Application Support/Fabric/backups/`) and rehearsed against `v0.3.1`: **PASS**, exit 0 — schema
75 → 78, the journal count unchanged, no table lost a row. Its receipt stays beside the private dump and is not
committed: this repository is public and the counts describe the operator's estate.

**What it does not prove** (also in every receipt): the restored estate is not opened in the app; the app's restore
boundary (hub requests, source credentials, pending work) is not exercised; the rollback restore into the working
stack (step 5) has the same commands as step 3's restore but has not been run against that stack.

**Next task — the operator's approval, then step 4.** Steps 2 and 3 are done on the live data; installing 0.3.1 and
applying the migrations to the working stack (step 4) change the operator's installation and database, so they wait
for the operator's go-ahead. CO-198 is narrowed to step 5: its rollback stays a recorded manual check (disposition "partially").
