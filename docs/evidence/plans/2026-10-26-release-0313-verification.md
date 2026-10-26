# Release verification: Fabric 0.3.13, the sweep of abandoned work, the one schema step and the places finished, three independent iterations

0.3.13 is everything after v0.3.12 on `main` before the tag (P-26, [plan and waves](2026-10-26-release-0313-plan.md)),
promised by 2026-10-31 (board thread `27750925`): the sweep of abandoned work and «told one is told all» (CO-427,
CO-426), a half-up stack that heals itself (CO-428), the stack watch for rest and kong (CO-374), the contract repinned to
`v0.1.0+2026-10-26.3` with the operator's decision and mandate through the hub (CO-434, CO-435), the one schema step
(schema 97), Settings by SCN-170's sections with folder trust (CO-392, CO-348), Агенты as an agents screen (CO-419),
История's filters and detail pane (CO-414), the overdue rows' triage (the operator's В-8) and the small fixes it took in
(CO-274, CO-225 (5), CO-222), and the remaining partial rows decided.

**Schema 97.** One migration since 0.3.12, `supabase/migrations/20261026000124_one_schema_step.sql`. The installed Fabric
on the operator's Mac is 0.3.11 (schema 95): 0.3.12 was never rolled out there (the operator, 2026-10-26: 0.3.13 goes
straight on with the move to Colima), so the rollout takes migrations 123 and 124. 0.3.12 cannot open a schema-97
database, and 0.3.11 cannot open 96 or 97; going back is the backup below.

## Protocol

The protocol is 0.3.12's ([0.3.12 ledger, Protocol](2026-10-24-release-0312-verification.md#protocol)), unchanged:
fresh reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the candidate;
their reports are committed under `docs/evidence/reviews/0.3.13/iteration-N/` as written. A reviewed candidate is never
rebased: `release/0.3.13` takes `main` by a merge and lands on `main` by a fast-forward of that merge.

## Rollout on the operator's Mac, with the move to Colima

One window, on fabric-workspace's signal (the R1 manager runs the process, the operator's decision of 2026-10-26): Fabric
0.3.11 to 0.3.13 and the stack's data from OrbStack to Colima. The steps are 0.3.12's ([its rollout](2026-10-24-release-0312-verification.md#rollout-on-the-operators-mac))
with these differences:

0. **Disk.** More than 15 GB free and swap under 16 GB (the Colima condition of [the plan](2026-10-26-release-0313-plan.md#the-0312-rollout-and-the-move-to-colima-the-operator-2026-10-26));
   measured 2026-10-26 at 8.0 GB free and 27.6 GB of swap, filled by the live sessions, which no agent closes. Until it
   holds, the rollout waits; the release itself does not.
2. **Quit.** Before the person quits, the agent puts a hold on `fabric.desktop` through the lifecycle broker's owner, so
   nothing starts Fabric between the quit and the open; the hold is released at step 7.
3. **The migration files.** Migrations 123 and 124 are copied from the mounted 0.3.13 bundle into the stack folder, each
   compared by sha256 with the file at the tag.
5. **Rehearsal.** `scripts/rehearse-upgrade.mjs --from 95 --ref v0.3.13` must reach schema 97 with the journal count and
   every table's row count unchanged.
6. **Migrate, then move.** `supabase migration up --local` to 97 on OrbStack; then the move to Colima as the plan's
   section says (a stopped database's volume copied, never a live one), and Fabric finds Docker through the current
   docker context (wave 1, `main/dockerPing.ts#dockerContextHost`).
8. **Verify.** As 0.3.12's step 8, plus: the sweep of abandoned work (a `work.swept` ops line within three minutes of a
   claim left silent), Агенты by state, История's filters, Settings' sections and the folder trust switch, and
   `fabric_whoami` naming the two new rules (`work.check-every-three-minutes`, `operator.told-one-is-told-all`).

## Owed in 0.3.13's Release close

- CO-284: COM03-14's real-client smoke on the built candidate, when the disk allows.
- The board posts of 0.3.13's publication: thread `27750925` (the promise), `115ef7fb` (ADR-0180), the asks of 0.3.14
  (`ac92166e` to the adapter, `8106a1b6` to personal-os), org-index on `deebc6ac` (CO-274).
- The organization's knowledge base before the tag: `knowledge/plans.md` and `products.md` name 0.3.13 as built.
- `node scripts/workspace.mjs publish` and `check --require-child` after the tag.

## Iteration 1

Candidate `d787a53a` (main, 2026-10-26). Five fresh reviewers, read-only in a detached checkout.
