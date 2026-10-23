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
installs over it with one schema step, as 0.3.9's did ([its rollout](2026-10-21-release-039-verification.md)):

0. The agent measures the disk and swap (`df -h`, `sysctl vm.swapusage`) and frees space until more than 3 GB is free
   from what regenerates by itself, as 0.3.11's rollout says; the measurement goes in the Release close.
1. The agent downloads and verifies the signed 0.3.12 bundle (`SHA256SUMS`, `codesign`, `spctl`); a rollback takes
   `Fabric-0.3.11-universal.dmg` with the backup of step 3.
2. The agent lists the live console sessions and says them; then **the person quits Fabric**.
3. With no writer, the agent takes a backup (`pg_dump` of the local database, its size and sha256 recorded), applies
   `supabase migration up --local` (only `20261023000123_project_profile.sql`), and reads `schema_version()` = 96 and
   the journal count before and after.
4. The agent puts the 0.3.12 bundle in `/Applications`, and **the person opens Fabric**; the agent never starts it
   through the broker while CO-382 is open.
5. The agent verifies the version (0.3.12), the schema (96), the hub (`hub.json` and a `fabric_whoami` with protocol
   version 3 naming `machine`), and on the real app: Главная («Нужны вы», the greeting), a project page (Цель,
   Команда, План, the analytics strip, «Найти связи»), the graph, Агенты with an agent page, История, Comms, the Board's
   filters, Настройки («Этот компьютер», «Сообщения между сессиями агентов», «Готовность Fabric»).

## Owed from 0.3.11's Release close

- The 0.3.11 install (the bundle waited for the person's quit) is superseded by 0.3.12's; the measurements it owed (OF-36
  keep-awake, CO-382's idle stops) are read at 0.3.12's install.
- The board posts of 0.3.12's publication on the threads that were told 0.3.12 (the triage's asks: CO-360, CO-383,
  CO-397, CO-403, CO-404, CO-407; fabric-agent-adapter's FAA-99 on `76f5043b`).
- CO-284's three checks need a disposable stack and a built app; they run in this release's full gate when the disk
  allows (more than 15 GB free), else they stay with their row.

## Iteration 1

(written when the five reports are in)
