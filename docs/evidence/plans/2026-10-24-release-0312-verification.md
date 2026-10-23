# Release verification: Fabric 0.3.12, project onboarding, the walk's places and the hardening wave, three independent iterations

The operator, 2026-10-23: «давай доделывай все сам автономно и выбирай лучшие решения для меня и в итоге заливай все
обнови доки и новая вресия», and ADR-0176 (two ways to hand work to another project, by whose computer it is; a task
starts only once its spec is gathered). 0.3.12 is everything after v0.3.11 on `main` before the tag (P-25): the
operator's ADR-0176 and the board rules it changes (wave 1), project onboarding by an agent and the project page with
the places the walk named (wave 2, [its spec](../specs/2026-10-23-0312-w2-project-onboarding.md)), and the hardening
wave (wave 3); every carried row decided by [the triage](2026-10-23-release-0312-triage.md).

**Schema 96.** One migration, `supabase/migrations/20261023000123_project_profile.sql` (`project.profiled@1`, the
profile columns on `projects`, the `project_relations` table), decision W2-2 of the wave 2 spec. 0.3.11 cannot open a
schema-96 database; going back after the upgrade is the backup below.

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.12/iteration-N/`.

## Rollout on the operator's Mac

The installed Fabric is 0.3.10 (0.3.11 was published but never installed: the person had not quit Fabric yet). 0.3.12
installs over it with one schema step, in the order of [the runbook](../../launch/release-mac.md#upgrading-an-existing-database)
(install, back up, rehearse, migrate, open), as 0.3.9's did ([its rollout](2026-10-21-release-039-verification.md)). The
stack folder (`~/Library/Application Support/@fabric/desktop/stack`) receives a bundle's migrations only when that bundle
starts (`apps/desktop/src/main/bundledStack.ts#materializeStack`), so the step copies migration 123 in from the verified
bundle; it costs no extra person step. Two person steps in all: quit, then open.

0. **Disk.** The agent measures the disk and swap (`df -h`, `sysctl vm.swapusage`) and frees what regenerates by itself
   until more than 8 GB is free: the rehearsal's disposable stack and the backup need it (Fabric's own floor is 3 GB). It
   stops the 0.3.11 placement watcher (0.3.12 supersedes that install) and, once the 0.3.12 bundle is verified, detaches
   the 0.3.11 DMG and keeps only its file for a rollback. The measurements go in the Release close.
1. **The bundle.** The agent downloads and verifies the signed 0.3.12 DMG (`SHA256SUMS`, `codesign`, `spctl`) and mounts
   it read-only; a rollback takes `Fabric-0.3.11-universal.dmg` with the backup of step 4.
2. **Quit.** The agent lists the live console sessions and says them; then **the person quits Fabric**. The agent checks
   the broker does not start it (`lifecycle.status` for `fabric.desktop`; no `ensure` for it in
   `~/Library/Logs/local-lifecycle/broker.log` from here to step 7) and never starts Fabric through the broker while
   CO-382 is open.
3. **The migration file.** The agent copies `20261023000123_project_profile.sql` from the mounted bundle
   (`Fabric.app/Contents/Resources/stack/supabase/migrations/`) into the stack folder's `supabase/migrations/`, after
   comparing its sha256 with the file at the tag; it never runs `supabase` inside the bundle.
4. **Backup.** With no writer, `pg_dump` with the PostgreSQL 17 client (runbook step 2) to
   `~/Library/Application Support/Fabric/backups/pre-0.3.12.dump`, mode 600; its size and sha256, `schema_version()` (95)
   and the journal count recorded; `pg_restore --list` parses it.
5. **Rehearsal.** `FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin node scripts/rehearse-upgrade.mjs --from 95
   --ref v0.3.12 --dump <the dump>` on a separate disposable stack; it must exit 0 with PASS in
   `<dump>.rehearsal.json` (schema 96, the journal count and every table's row count unchanged). If the disk does not
   allow it, the step stops here and the database stays at 95 with 0.3.10 installed: migrating without a rehearsal is
   the operator's decision, asked once with the measurement.
6. **Migrate.** `supabase migration up --local` in the stack folder; `schema_version()` = 96 and the journal count
   unchanged.
7. **Open.** The agent puts the 0.3.12 bundle in `/Applications`, and **the person opens Fabric**. If the first start
   stops on a failure, the agent reads `startup-failure.log` in Fabric's data folder, frees what it names, and the person
   opens Fabric again; the way back is the 0.3.11 bundle with the backup restored into a clean stack (0.3.11 admits only
   95).
8. **Verify.** The version (0.3.12), the schema (96), the hub (`hub.json` with a live `pid`, and a `fabric_whoami` with
   protocol version 3 naming `machine`), the broker (`startedBy: person`, no `ensure` since step 2), and on the real app,
   in Russian and then in English (CO-306: the splash speaks the interface's language): Главная («Нужны вы», the
   greeting), a project page (Цель, Команда, План, the analytics strip, «Познакомиться с проектом» on a project with no
   profile), the graph, Агенты with an agent page, История, Comms, the Board's filters, Настройки («Этот компьютер»,
   «Сообщения между сессиями агентов», «Готовность Fabric»). For OF-36 the agent sets «Не давать компьютеру засыпать» to
   «while agents work», reads `pmset -g assertions` while a console runs and after it ends, and puts the setting back.
   CO-382's idle stop is read after 15 minutes with no use: a person-opened Fabric is not stopped. On this Mac the agent
   sets «Этот компьютер» to «мой» (ADR-0176 Decision 3, amendment 7) and reads `protocol.machine.trust` = `mine` in
   `fabric_whoami`; fabric-workspace is told on `6c7a5404` that its interim line can go. Then the first
   measurements of 0.3.9's ["How we will know it holds"](2026-10-21-release-039-verification.md).

## Owed in 0.3.12's Release close

- The 0.3.11 install (the bundle waited for the person's quit) is superseded by 0.3.12's; the measurements it owed (OF-36
  keep-awake, CO-382's idle stops) are read in step 8 above.
- The board posts of 0.3.12's publication on the threads that were told 0.3.12: the triage's asks (CO-360, CO-383,
  CO-397, CO-403, CO-404, CO-407), fabric-agent-adapter's FAA-99 on `76f5043b`, and the rows the triage moved away from
  0.3.12 on their own threads: CO-372 (0.4.0) on `87af4473`, CO-396 and CO-402 (0.3.13) on `a5969ac5` and `348467e5`.
  CO-377 (built, `4f0e1d40`) was promised by 2026-10-31 on `27750925`: the tag goes out before that date or the thread is
  told why not.
- The organization's knowledge base before the tag (release step 11): `knowledge/plans.md` row 2 names 0.3.12 as built
  and CO-336, CO-372 in 0.4.0, CO-396 and CO-402 in 0.3.13; after publication, `products.md` and the roadmap's
  released column name v0.3.12. The fabric-workspace pull request is recorded here.
- CO-365: the first reboot after 0.3.12 is installed is the measurement its ruling waits for (does the login item start
  Fabric?); recorded in its row when it happens.
- `node scripts/workspace.mjs publish` and `check --require-child` after the tag (release step 10).

## Iteration 1

(written when the five reports are in)
