# Release verification: Fabric 0.3.13, the sweep of abandoned work, the one schema step and the places finished, three independent iterations

0.3.13 is everything after v0.3.12 on `main` before the tag (P-26, [plan and waves](2026-10-26-release-0313-plan.md)),
promised by 2026-10-31 (board threads `147a5538`, `a5969ac5`, `348467e5`, `0d82422a` and `12bd8b4c`; `27750925` was CO-377's promise, met in 0.3.12): the sweep of abandoned work and «told one is told all» (CO-427,
CO-426), a half-up stack that heals itself (CO-428), the stack watch for rest and kong (CO-374), the contract repinned to
`v0.1.0+2026-10-26.3` with the operator's decision and mandate through the hub (CO-434, CO-435), the one schema step
(schema 97), Settings by SCN-170's sections with folder trust (CO-392, CO-348), Агенты as an agents screen (CO-419),
История's filters and detail pane (CO-414), the overdue rows' triage (the operator's В-8) and the small fixes it took in
(CO-274, CO-225 (5), CO-222), and the remaining partial rows decided.

**Schema 97.** One migration since 0.3.12, `supabase/migrations/20261026000124_one_schema_step.sql`. The installed Fabric
on the operator's Mac is 0.3.11 (schema 95): 0.3.12 was never rolled out there (its rollout was stopped on 2026-10-24,
the plan's section "The 0.3.12 rollout and the move to Colima", and the R1 manager's order of 2026-10-26 on the board
puts 0.3.13's rollout in one window with the move to Colima, on fabric-workspace's signal), so the rollout takes
migrations 123 and 124. 0.3.12 cannot open a schema-97
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
3. **The migration files.** They come only from the 0.3.13 build's own first start (the runbook's step 1, which this
   rollout follows: install, start once so the stack folder holds migrations 123 and 124, quit), never copied by hand:
   an older build's start removes them, as 0.3.11's did on 2026-10-24. The agent compares the two files in the stack
   folder by sha256 with the files at the tag before step 4.
5. **Rehearsal.** `FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin node scripts/rehearse-upgrade.mjs --from 95 --ref
   v0.3.13 --dump <the step 4 dump>` must reach schema 97 with the journal count and every table's row count unchanged
   (PASS in `<dump>.rehearsal.json`).
6. **Migrate, then move.** `supabase migration up --local` to 97 on OrbStack; then the move to Colima as the plan's
   section says (a stopped database's volume copied, never a live one), and Fabric finds Docker through the current
   docker context (wave 1, `main/dockerPing.ts#dockerContextHost`).
8. **Verify.** As 0.3.12's step 8, plus: the stack runs on Colima, not OrbStack (`docker context show` reads `colima`,
   and the `supabase_db_fabric` container is listed by `docker ps` in that context while OrbStack is stopped); the sweep
   of abandoned work (a task moved to running by an agent with no claim on it reads as a finding in «На проверке» within
   six minutes, and a `work.swept@1` event is in the journal); Агенты by state, История's filters, Settings' sections and
   the folder trust switch; and `fabric_whoami` naming the two new rules (`work.check-every-three-minutes`,
   `operator.told-one-is-told-all`).

## Owed in 0.3.13's Release close

- CO-284: COM03-14's real-client smoke on the built candidate, when the disk allows; if it still does not at the tag, the
  row is re-ruled to 0.3.14's Release close with the measurement, never silently carried.
- What 0.3.12 owed and never closed, because 0.3.12 was not rolled out here: its install-time measurements (OF-36
  keep-awake, CO-382's idle stop, CO-365's first reboot) are read at this rollout's step 8; its board posts on the threads
  its ledger names ([0.3.12 Owed](2026-10-24-release-0312-verification.md#owed-in-0312s-release-close)) are made with
  0.3.13's.
- 0.4.0's dates promised on `0d82422a` and `12bd8b4c`: told with 0.3.13's publication.
- The board posts of 0.3.13's publication: threads `147a5538`, `a5969ac5`, `348467e5`, `0d82422a`, `12bd8b4c`, `4cd89609`, `16c8a677`, `774e8772`, `b0bdbfab`, `5f14e00a`, `c430513b` and `67c3a5e0` (what each was told, corrected on 2026-10-26 by iteration 1's PL-2), `115ef7fb` (ADR-0180), the asks of 0.3.14
  (`ac92166e` to the adapter, `8106a1b6` to personal-os), org-index on `deebc6ac` (CO-274).
- The organization's knowledge base before the tag: `knowledge/plans.md` and `products.md` name 0.3.13 as built.
- `node scripts/workspace.mjs publish` and `check --require-child` after the tag.

## Iteration 1

Five fresh reviewers, 2026-10-26, against `d787a53a` (`d787a53a8a6a6906fe4c0654af41403d36fe8119`), read-only in a detached checkout. Reports:
[UX](../reviews/0.3.13/iteration-1/2026-10-26-ux.md), [errors](../reviews/0.3.13/iteration-1/2026-10-26-errors.md),
[documents](../reviews/0.3.13/iteration-1/2026-10-26-docs.md), [data](../reviews/0.3.13/iteration-1/2026-10-26-data.md),
[plan](../reviews/0.3.13/iteration-1/2026-10-26-plan.md).

54 findings, 9 blocking. The errors reviewer found that the sweep's terminal line ends in Enter and could approve a
waiting permission prompt (ER-2), and that Supabase CLI 2.114 exits 0 against a running stack, so the watch never
healed a half-up one (ER-1). The data reviewer found the sweep's receipt refused by the app's own ingress (DA-1), which
only the full tier tested. The documents and plan reviewers found the rollout's three methods for the migrations and an
upgrade written only from 96 (DO-1, DO-2, PL-5), eleven composed rows with no decision (PL-1), the board told what 0.3.13
no longer carries (PL-2), and the UX iteration's findings and CO-233 with no home (PL-3, PL-4). The fixes make the next
candidate, the tip of `release/0.3.13`.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | UX-1 | Агенты says no agent found when the reads failed; no «Повторить» on the installed read | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`): `launch/AgentsScreen.tsx#AgentsScreen` (`everyRead`); `AgentsScreen.test.tsx` «a failed read of the installed agents never says no agent was found», watched failing |
| V1-2 | UX-2 | Groups say empty while still reading | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`): `AgentsScreen.tsx#Group`; «a group is called empty only once the reads that fill it have answered» |
| V1-3 | UX-3 | «Ждут вас» guessed from silence; a plain shell listed as an agent | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`): `launch/agentRoster.ts#composeRoster` leaves plain shells out; «Возможно, ждут вас» says what is observed; two tests |
| V1-4 | UX-4 | История shows another filter's rows after a failed read | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`): readings tied to their filters (`HistoryScreen.tsx#HistoryScreen`); «a new filter shows «reading», never the last filter's rows» |
| V1-5 | UX-5 | Detail pane claims the undoing act is above | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`): «более позднее действие, которого нет в этом списке», label «Можно ли отменить»; test in `HistoryScreen.test.tsx` |
| V1-6 | UX-6 | Closing the pane drops focus; narrow window does not scroll to it | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`): focus returns to the act's sentence, the pane scrolls into view (`#ActDetail`); test |
| V1-7 | UX-7 | Sweep findings titled by raw request id | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`): `shared/attention.ts#attentionOf`, `attentionTitle.ts#titleOf`, `#notifyLineOf`; `attention.swept.test.ts`, `attentionTitle.test.ts` |
| V1-8 | UX-8 | The half-up window claims a restart that failed | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`) and `release/0.3.13`: `shared/startupFailure.ts#STACK_HEAL_FAILED`, thrown by `main/stackHalfUp.ts#resolveHealingHalfUp` when the restart fails; `stack-half-up.test.mjs` «a heal whose stop fails» reads the remedy key |
| V1-9 | UX-9 | The folder trust switch shows on while the env keeps trust off | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`): `settings.folderTrustLocked`, `shared/folderTrust.ts#folderTrustOverridden`, `SettingsScreen.tsx#AgentPermissionsSetting`; two tests |
| V1-10 | UX-10 | Feed reasons only as a hover tooltip; English says lease | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`): `.feed-why` text on rows that open nothing (`Feed.tsx`); `Feed.test.tsx` (3) |
| V1-11 | UX-11 | SCR-89, SCR-88, SCR-39 and AGENTS.md describe the pre-release state | fixed: fixed in `2e5a8035` (merged into `release/0.3.13`): `docs/ux/screens.md`, six scenario amendments; AGENTS.md's sweep and catalogue rows on `release/0.3.13` |
| V1-12 | UX-12 | CHANGELOG omits Агенты, История and «На проверке» | fixed: CHANGELOG 0.3.13 bullets on `release/0.3.13`; Copylot check `9bcb6535-ba6a-45d7-b6e3-ff40be6244db` |
| V1-13 | ER-1 (blocking) | The watch never heals a half-up stack (CLI 2.114 exits 0) | fixed: `main/stackHalfUp.ts#recoverThenHeal` heals after any try; the launch heals after an «already running» refusal (`main/index.ts#resolveEnvStartingStackIfNeeded`); `stack-half-up.test.mjs` «ER-1», watched failing with the old condition |
| V1-14 | ER-2 (blocking) | The sweep presses Enter in a terminal waiting for a person | fixed: nothing is typed into any terminal (`main/abandonedSweepRun.ts#createAbandonedSweep`; `deliver` removed from its deps); `abandoned-sweep-run.test.mjs` «ER-2» (the candidate's own test asserted the write); SCN-140, spec, AGENTS.md |
| V1-15 | ER-3 | A failed heal reads as the operator's stop | fixed: `main/stackServices.ts#afterOwnStop`, `env.ts` `stoppedByHeal`; `stack-half-up.test.mjs` «ER-3» |
| V1-16 | ER-4 | Stalled minutes counted from the stalled mark | fixed: `shared/abandonedSweep.ts#findAbandoned` counts from `lastActivityAt`; `abandonedSweep.test.ts` «ER-4» |
| V1-17 | ER-5 | Receipt counts delivered before written and is written while quitting | fixed: `delivered` removed (nothing is written); no receipt while quitting; `abandoned-sweep-run.test.mjs` «ER-5», watched failing |
| V1-18 | ER-6 | New redaction rules rewrite quoted prose | fixed: `shared/redact.ts` `authorization-field` and `yaml-credential` take no value with a space; `redact.test.ts` «quoted prose is left alone (ER-6)» |
| V1-19 | ER-7 | An unread project is said as a held folder | fixed: `folder_unread` with `FOLDER_UNREAD_SAYS` (`main/launchFolderLock.ts`, `managedLaunch.ts`, `index.ts`); `managed-launch.test.mjs` ER-7 case |
| V1-20 | ER-8 | Folder trust switch shows On under the env override | fixed: as UX-9 |
| V1-21 | DO-1 (blocking) | Opposite instructions for getting migration 124 into the stack folder | fixed: one method everywhere: the new build's own first start (runbook step 1); the 0.3.12 paragraph, CHANGELOG Upgrading and the ledger's step 3 say so |
| V1-22 | DO-2 (blocking) | Upgrade and rollback described only from 96; the operator's Mac is at 95 | fixed: runbook's 0.3.13 paragraph and CHANGELOG: FROM 95 takes 123 and 124, rollback is the bundle the database came from |
| V1-23 | DO-3 | Step 8 asks for an ops line that does not exist | fixed: ledger step 8 reads «На проверке» and the `work.swept@1` event |
| V1-24 | DO-4 | CHANGELOG omits user-facing changes | fixed: as UX-12 |
| V1-25 | DO-5 | Eleven repin rows have no decision | ruled: each row decided 2026-10-26 in the carry-over register (CO-396, CO-402, CO-339, CO-343, CO-354, CO-345, CO-359, CO-331, CO-408, CO-415, CO-416); the plan's iteration 1 rulings |
| V1-26 | DO-6 | ADR-0180 says ADR-0178 point 7 is unchanged while reversing it | fixed: ADR-0180 Amendment 1; the ADR index row of ADR-0178 |
| V1-27 | DO-7 | Living documents say SW-7 and SW-9 are unbuilt | fixed: agent-health-and-failure.md, the sweep spec's status and As built, AGENTS.md's sweep row, SCN-140's amendment |
| V1-28 | DO-8 | AGENTS.md catalogue row misses Агенты | fixed: AGENTS.md: «when Settings or Агенты opens» |
| V1-29 | DO-9 | Rollback drops trustAgentFolders silently | fixed: runbook's 0.3.13 paragraph and CHANGELOG say folder trust is on again after going back |
| V1-30 | DO-10 | Eleven commit citations on no branch | fixed: each replaced by its `main` commit in the plan and the register (subjects matched) |
| V1-31 | DO-11 | The spec says the receipt names each finding | fixed: the sweep spec's As built: counts only, the items are SW-9's |
| V1-32 | DO-12 | Two sweep follow-ups left in prose | ruled: CO-439 (0.3.14) |
| V1-33 | DO-13 | P-26 and the Now line lag | fixed: `docs/evidence/backlog.md` P-26 status and the Now line |
| V1-34 | DO-14 | The newest handoff's next task is stale | fixed: `docs/handoffs/2026-10-26-release-0313.md` |
| V1-35 | DO-15 | ADR-0178 cites Vesta ADRs that make Vesta the signer | fixed: ADR-0180 Amendment 1 names DEC-0129 OL-2 as what Fabric builds to |
| V1-36 | DO-16 | The ledger is not in the candidate; rehearsal lacks --dump | fixed: the ledger committed (`fb081f98`); step 5 carries `--dump` |
| V1-37 | DA-1 (blocking) | work.swept@1 never reaches the journal in the app | fixed: field rules in `shared/commandIngress.ts`; `ingress-owners.test.mjs` and the sweep tests in the fast tier (`scripts/ci.sh`); `abandoned-sweep-run.test.mjs` checks a real receipt prepares |
| V1-38 | DA-2 | A receipt every sweep for one stuck item; feed sentence false | fixed: receipt only when told, released, blind or capped; the feed sentence says what it does; «DA-2» test, watched failing |
| V1-39 | DA-3 | Stored replies not re-delivered under CO-370 on upgrade | ruled: CO-449 (0.3.14's schema step) |
| V1-40 | DA-4 | Memberships keep their write time | ruled: CO-449 |
| V1-41 | DA-5 | A restore can disagree with an upgraded correction | ruled: CO-449 (read from the SQL, not measured) |
| V1-42 | DA-6 | Folder-attach check scans the journal without an index | ruled: CO-449 |
| V1-43 | DA-7 | Upgrading note omits two visible changes and the 95 path | fixed: CHANGELOG Upgrading and the runbook |
| V1-44 | PL-1 (blocking) | Eleven composed repin rows have no decision | ruled: as DO-5 |
| V1-45 | PL-2 (blocking) | The board was told 0.3.13 carries work it does not | fixed: corrections posted 2026-10-26 on the threads the ledger's owed list names; the plan and ledger cite the right promise threads |
| V1-46 | PL-3 (blocking) | The UX iteration's findings have no disposition | ruled: CO-440 to CO-443 (0.3.14, 0.4.0); SX-3, SX-20, SX-26 resolved by `4d55beb7`; the rest on CO-418 and CO-438; SCN-165's status corrected |
| V1-47 | PL-4 (blocking) | CO-233 dropped from the plan | ruled: CO-233 deferred to 0.3.14's schema step with its reason |
| V1-48 | PL-5 | Three methods for the migrations; Colima not checked | fixed: as DO-1; step 8 checks the stack runs on Colima |
| V1-49 | PL-6 | Stale state and an unquoted operator decision | fixed: P-26, the Now line, the handoff; the ledger names the stopped 0.3.12 rollout and the R1 manager's order instead |
| V1-50 | PL-7 | Owed list incomplete | fixed: the ledger's owed list: 0.3.12's carried items, 0.4.0 dates, CO-284's fallback |
| V1-51 | PL-8 | Board asks unanswered | fixed: replies posted 2026-10-26: `03582f56` (CO-426, CO-435, CO-447), `d008e0a9`, `6ad918ab` (the delegation plan's adoption note), `6fa891b2` (CO-448) |
| V1-52 | PL-9 | Rows without a closing decision | ruled: CO-426 resolved, CO-436 narrowed with CO-445, CO-317 deferred, the sweep's cap CO-439 |
| V1-53 | PL-10 | Unresolvable citations and merge-log times | fixed: as DO-10; `docs/MERGES.md` times from the landed commits, newest first |
| V1-54 | PL-11 | В-7 and two branches without a home | ruled: ADR-0182 (В-7); CO-446 (`agent/w2-runners`); CO-291's status names `agent/onboarding-036-w1`'s facts |

Exit for iteration 1: every finding above is fixed or ruled with its row. Blocking findings open: none.

## Iteration 2

_Not started._
