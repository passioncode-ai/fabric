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
the plan's section "The 0.3.12 rollout and the move to Colima"; fabric-workspace's session, which runs the process,
put 0.3.13's rollout in one window with the move to Colima on its own signal, in a cross-session message to this
session on 2026-10-26, not on the board, so it has no board id), so the rollout takes
migrations 123 and 124. 0.3.12 cannot open a schema-97
database, and 0.3.11 cannot open 96 or 97; going back is the rollout's step 9.

## Protocol

The protocol is 0.3.12's ([0.3.12 ledger, Protocol](2026-10-24-release-0312-verification.md#protocol)), unchanged:
fresh reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the candidate;
their reports are committed under `docs/evidence/reviews/0.3.13/iteration-N/` as written. A reviewed candidate is never
rebased: `release/0.3.13` takes `main` by a merge and lands on `main` by a fast-forward of that merge.

## Rollout on the operator's Mac, with the move to Colima

One window, on fabric-workspace's signal (it runs the process; the operator's decision of 2026-10-26 to move this Mac to
Colima at once, the plan's section on it): Fabric 0.3.11 to 0.3.13 and the stack's data from OrbStack to Colima. The
steps are written out here in full; 0.3.12's ([its rollout](2026-10-24-release-0312-verification.md#rollout-on-the-operators-mac))
and the plan's section on the move are the records of the first attempt, not the order. **Four person steps in all:**
quit 0.3.11, open 0.3.13 once, quit it, open it. Everything else is the agent's, and an agent never starts Fabric itself
(the machine's rule): the hold keeps the broker from starting it, and the person's own opens are not the broker's.
(Written 2026-10-26 by iteration 2's DO-2, DO-3 and PL-4.)

0. **Disk.** More than 15 GB free and swap under 16 GB (the Colima condition of [the plan](2026-10-26-release-0313-plan.md#the-0312-rollout-and-the-move-to-colima-the-operator-2026-10-26));
   measured 2026-10-26 at 8.0 GB free and 27.6 GB of swap, filled by the live sessions, which no agent closes. Until it
   holds, the rollout waits; the release itself does not.
1. **Colima proven first.** Before any of the operator's data moves, a disposable Supabase project with its own ports and
   project id starts on a disposable Colima profile, addressed per command (`DOCKER_CONTEXT=colima-<profile>`, never
   `docker context use`, which would move the running 0.3.11 too), `supabase start`, its `status` names the keys; then
   it is stopped and the profile deleted (`colima delete --profile <profile> --force`). The live stack on OrbStack is
   not touched. The 2026-10-26 check proved only the engine and Fabric's ping (the plan's "The Colima node's live check").
2. **Hold and quit.** The agent downloads and verifies the signed 0.3.13 DMG (`SHA256SUMS`, `codesign --verify`,
   `spctl`), lists the live console sessions and says them, and puts a hold on `fabric.desktop` through the lifecycle
   broker's owner, so nothing starts Fabric until step 8. Then **the person quits Fabric 0.3.11** (person step 1).
3. **The migration files, by the new build's first start.** The agent replaces `/Applications/Fabric.app` with the
   verified 0.3.13 bundle. **The person opens it once** (person step 2): its start writes its own migrations into the
   stack folder, 123 and 124 among them, and its startup window refuses the schema-95 database; **the person quits it**
   (person step 3). Never copied by hand: an older build's start removes them, as 0.3.11's did on 2026-10-24. The agent
   compares the two files in the stack folder by sha256 with the files at the tag.
4. **Backup.** With no writer, `pg_dump` with the PostgreSQL 17 client (runbook step 2) to `pre-0.3.13.dump` in the
   backups folder: a new name, never `pre-0.3.12.dump`, which holds the 2026-10-24 backup. Before it the agent reads
   `select count(*) from pg_indexes where indexname = 'project_repos_unique_estate_path'` and, when it reads 0, the
   duplicate count d (`select count(*) - count(distinct (estate_id, path)) from project_repos`; the runbook's 0.3.13
   paragraph). The schema (95) and the journal count are written beside the dump.
5. **Rehearsal.** `FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin node scripts/rehearse-upgrade.mjs --from 95 --ref
   v0.3.13 --dump <the step 4 dump>` must reach schema 97 with the journal count and every table's row count unchanged
   (PASS in `<dump>.rehearsal.json`). The one allowed difference: when step 4 read the index as missing, `project_repos`
   loses exactly d rows (migration 124 merges a folder held twice); the rehearsal then reports that loss, and the agent
   reads it against d. Any other lost row stops the rollout (iteration 2's DO-4 and DA-6; CO-449).
6. **Migrate on OrbStack.** `supabase migration up --local` in the stack folder; `schema_version()` reads 97 and the
   journal count is step 4's.
7. **Move to Colima.** A final dump at 97 (`pre-colima-0.3.13.dump`); `supabase stop` on OrbStack, keeping its volumes
   (they are the rollback); Colima's default profile started with a disk the step-0 condition leaves room for
   (`colima start --disk <GB> --memory 4 --cpu 4`, the size read from `df` at that moment, at most the free space less
   15 GB); the stopped volume `supabase_db_fabric` copied into Colima's engine (fabric-workspace copies it, as it offered
   in the first attempt; a live volume is never copied); then `docker context use colima`, with no Fabric running.
   Fabric finds Docker through the current docker context (wave 1, `main/dockerPing.ts#dockerContextHost`).
8. **Open and verify.** The agent releases the hold, and **the person opens Fabric 0.3.13** (person step 4). It starts
   the stack on Colima. Then: as 0.3.12's step 8 (the version 0.3.13, the schema 97, the journal count of step 7's dump,
   the hub with a live `pid`), plus: the stack runs on Colima, not OrbStack (`docker context show` reads `colima`, and the
   `supabase_db_fabric` container is listed by `docker ps` in that context); the sweep of abandoned work (a task moved to
   running by an agent with no claim on it reads as a finding in «На проверке» within six minutes, and a `work.swept@1`
   event is in the journal); Агенты by state, История's filters, Settings' sections and the folder trust switch; and
   `fabric_whoami` naming the two new rules (`work.check-every-three-minutes`, `operator.told-one-is-told-all`).
   OrbStack is stopped last, once this step passes; its volumes stay until the Release close.
9. **Going back.** The agent holds `fabric.desktop` again and **the person quits Fabric** first, in both branches.
   If step 8 fails on Colima alone: `pg_dump` from Colima's stack, so what the person did on Colima since step 8 is
   kept; `docker context use orbstack`, OrbStack started, its kept volume (at 97) restored from that dump when it holds
   anything newer; the hold released and the person opens 0.3.13. If 0.3.13 itself fails: the signed 0.3.11 DMG from
   the [v0.3.11 release](https://github.com/passioncode-ai/fabric/releases/tag/v0.3.11) (verified as in step 2) put in
   `/Applications`; `docker context use orbstack` and OrbStack started; the person opens 0.3.11 once, so its own start
   rewrites the stack folder's migrations without 123 and 124 (never removed by hand), and quits it; then OrbStack's
   stack restored from `pre-0.3.13.dump` (schema 95) as the [runbook's step 5](../../launch/release-mac.md#upgrading-an-existing-database)
   says, its `migration up` reaching 95 only, the failed database kept privately; the hold released and the person
   opens 0.3.11. (Iteration 3's DA-2 and PL-5.)

## Owed in 0.3.13's Release close

The Release close comes after the rollout: the measurements below need its step 8, and OrbStack's volumes, kept as the
rollback until then, are removed only at the Release close (iteration 3's PL-3). The tag and its publication do not wait
for the rollout.

- CO-284: COM03-14's real-client smoke on the built candidate, when the disk allows; if it still does not at the tag, the
  row is re-ruled to 0.3.14's Release close with the measurement, never silently carried.
- What 0.3.12 owed and never closed, because 0.3.12 was not rolled out here: its install-time measurements (OF-36
  keep-awake and CO-382's idle stop) are read at this rollout's step 8; CO-365's first reboot is measured at the first
  real reboot after it, which an agent cannot cause (CO-365, 0.4.0). Its publication posts were made on 2026-10-24
  (10:42Z) and need nothing more. (Iteration 3's PL-4.)
- 0.4.0's dates promised on `0d82422a` and `12bd8b4c`: told with 0.3.13's publication.
- The board posts of 0.3.13's publication: threads `147a5538`, `a5969ac5`, `348467e5`, `0d82422a`, `12bd8b4c`, `4cd89609`, `16c8a677`, `774e8772`, `b0bdbfab`, `5f14e00a`, `c430513b` and `67c3a5e0` (what each was told, corrected on 2026-10-26 by iteration 1's PL-2), `115ef7fb` (ADR-0180), org-index on `deebc6ac` (CO-274). The asks of
  0.3.14 (`ac92166e` to the adapter, `8106a1b6` to personal-os) are posted; their answers are waits, due 2026-11-14.
- The threads answered by iteration 2's PL-2 on 2026-10-26 (`1ddb20ce`, `6225e0c1`, `d34e8ce8`, `198866e6`, `ef5a84c3`,
  `e75d502d`, `cf5d97f7`, `41a9b0cb`): 0.4.0's date posted with 0.3.13's publication on `1ddb20ce`, `d34e8ce8`,
  `ef5a84c3`, `e75d502d` and `41a9b0cb`; a "shipped" line after the tag on `198866e6` and `6225e0c1` for CO-426, CO-435
  and the forwarding on `agent.call`; on `d34e8ce8` by 2026-11-01, whether 0.3.14 issues tokens for services (CO-258).
  The adapter's answer to TO-2's SW-6 half (request `e2a7bec4`, due 2026-11-14).
- Three H3 threads with no Fabric reply, each covered by built work: `f3cfad27` (sasai's rate-limit finding, CO-334 in
  0.3.7, `42aad991`), `4f1769de` (the dashboard parity rule, DEC-0121 and CO-434), `15d9e4fa` (the contract's repin
  notes, the repin `dc2221ad`): a one-line reply each with 0.3.13's publication.
- The board answers of iteration 3 (2026-10-26): `693a7937` on `6a334fcc` (DEC-0134, CO-453) and the correction
  `661a5e1a` on `cf5d97f7` (CO-445). The row promised on `198866e6` (reply `69dea81c`) for CT-143's item 1: filed when
  the contract publishes its DEC (due 2026-11-07), and said there.
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

Five fresh reviewers, 2026-10-26, against `5aa6e59f` (`5aa6e59f44903681a34e80b168bb70a65cfeee0f`), read-only in a detached checkout. Reports:
[UX](../reviews/0.3.13/iteration-2/2026-10-26-ux.md), [errors](../reviews/0.3.13/iteration-2/2026-10-26-errors.md),
[documents](../reviews/0.3.13/iteration-2/2026-10-26-docs.md), [data](../reviews/0.3.13/iteration-2/2026-10-26-data.md),
[plan](../reviews/0.3.13/iteration-2/2026-10-26-plan.md).

One edit to the reports as written: in the documents report (DO-1) and the plan report (PL-1) the quoted register
link was set in a code span before the commit, so the link gate reads it as the quotation it is; no other byte changed.

36 findings, none blocking. Every iteration-1 fix held in substance. The errors and UX reviewers found the heal's own
edges: a start after a quit had begun, and a failure window that spoke of a running stack after the heal had stopped it
(ER-1, UX-1). The data reviewer found the sweep's receipt still written every three minutes while a read stays blind
or capped (DA-1), and JSON credential fields the redaction let through (DA-5). The documents and plan reviewers found
the register's sixteen rulings citing a plan section never written (DO-1, PL-1), a rollout that held Fabric before the
start it needed and sent the move to Colima to a dated section with the opposite order (DO-2, DO-3, PL-4), a rehearsal
that refuses the folder merge migration 124 makes (DO-4, DA-6), and seven board asks with no answer (PL-2). The fixes
make the next candidate, the tip of `release/0.3.13`.

| Finding | Level id | What | Disposition |
|---|---|---|---|
| V2-1 | UX-1 | The heal's failure window speaks of a running stack after the heal stopped it | fixed: a failed stop throws `STACK_HEAL_FAILED` with its own remedy, a start that fails after the stop throws the start's own failure (`stack-half-up.test.mjs` «iteration 2 UX-1», `startupFailure.test.ts` «the heal's stop itself failed»), watched failing first |
| V2-2 | UX-2 | A burst of notifications speaks English to a Russian interface | fixed: `decideNotification` takes the burst sentence, `notify.burst` in both locales (`notify.test.ts` «says a burst in the interface language», «the Russian burst sentence is in the registry»); Copylot `f0c68482-17bb-4140-926b-9416e5d514ac` |
| V2-3 | UX-3 | An agent's page states a task and an action that were not read | fixed: `agentPage.taskUnread`, `agentPage.doingUnread` when the work read failed (`AgentsScreen.test.tsx` «iteration 2 UX-3»), watched failing with the change reverted |
| V2-4 | UX-4 | «Консоль» says a working agent is not working | fixed: `agentsPlace.console.elsewhere`, or `.unknown` when the hub read failed (`AgentsScreen.test.tsx` «iteration 2 UX-4»), watched failing with the change reverted |
| V2-5 | UX-5 | The installed-agents note contradicts the list | fixed: `agentsPlace.installedUnread` says installed agents that are not working may be missing; Copylot ru `job_c5ed0198cbd2d75296f464ba`, en `6e62085e-660a-4552-9564-9dc6dec03a96` |
| V2-6 | UX-6 | The undo lines read badly in Russian | fixed: ru «Отменено действием», «более поздним действием, которого нет в этом списке»; Copylot `cf5f4ce6-b7d6-4336-8ce1-eeb4b8f502eb` (one passive, advisory, kept: the label names who undid it) |
| V2-7 | UX-7 | CHANGELOG describes Агенты before iteration 1's fix | fixed: «Возможно, ждут вас» and the plain shell left out |
| V2-8 | ER-1 | The watch's heal starts the stack after a quit began | fixed: `HalfUpDeps.stopped`, a quit after the heal's stop starts nothing, and a heal's own stop is not read as the person's (`env.ts` `stoppedByHeal`, `afterOwnStop`; `stack-half-up.test.mjs` «iteration 2 ER-1») |
| V2-9 | ER-2 | One-word quoted values rewritten for good | fixed: `authorization-field` and `yaml-credential` take a token-shaped value only (`redact.test.ts` «keeps none, required and ask-the-operator; still redacts a token-shaped value») |
| V2-10 | ER-3 | Three descriptions of the sweep say what iteration 1 removed | fixed in code (`abandonedSweepRun.ts` header, the obligation's evidence); migration 124's note and header ruled: CO-449 (a landed migration is not edited) |
| V2-11 | DO-1 | Sixteen rulings cite a plan section that does not exist | fixed: the plan's [Iteration 1's rulings](2026-10-26-release-0313-plan.md#iteration-1s-rulings-2026-10-26) |
| V2-12 | DO-2 | The rollout holds Fabric before the start it needs | fixed: the Rollout above, written out in full, four person steps |
| V2-13 | DO-3 | The move to Colima sent to a section with the opposite order | fixed: the Rollout's step 7; the plan's section cited as the first attempt's record |
| V2-14 | DO-4 | The rehearsal refuses the folder merge it should prove | fixed in the runbook's 0.3.13 paragraph and the Rollout's steps 4 and 5 (d read before, the one allowed loss); teaching `judge` the allowance ruled: CO-449 |
| V2-15 | DO-5 | CHANGELOG and CO-419 name a group the screen does not show | fixed: CHANGELOG; a dated note on CO-419 |
| V2-16 | DO-6 | Two stack bullets narrow what the code does | fixed: "the database and kong"; "without rest or without kong"; Copylot `bc66edd1-3c68-4c27-964c-a8379e2f2054` |
| V2-17 | DO-7 | The folder trust sentence is unconditional | fixed: the older build trusts folders whatever the switch said, and a setting change there forgets it |
| V2-18 | DO-8 | The runbook still tells a hand copy | fixed: the 0.3.9 paragraph says the first start, with a dated note |
| V2-19 | DO-9 | Three in-code descriptions of the sweep are stale | as V2-10 |
| V2-20 | DO-10 | ADR-0182's measurement undercounts | fixed: ADR-0182's Amendments |
| V2-21 | DO-11 | ADR-0178 has no pointer; ADR-0180's Consequences uncorrected | fixed: ADR-0178's Amendments, ADR-0180's Amendment 2 |
| V2-22 | DO-12 | The newest merge-log time is not its commit's | fixed: `13:49:58Z` |
| V2-23 | DO-13 | The map's iteration-1 entry links only to itself | fixed: it links the ledger, Агенты, Settings, the sweep and the stack |
| V2-24 | DO-14 | The handoff's release list omits "(not yet released)" | fixed: the handoff's Next task |
| V2-25 | DO-15 | The promise threads differ between ledger and handoff | fixed: five threads in the ledger, the handoff and P-26; `0d82422a` and `12bd8b4c` also carry 0.4.0's dates |
| V2-26 | DA-1 | A receipt every sweep while a read stays blind or capped | fixed: a receipt for the reads only when their state changes (`abandoned-sweep-run.test.mjs` «iteration 2 DA-1») |
| V2-27 | DA-2 | `capped` accepts any string; the kind list is a copy | fixed: `ABANDONED_KINDS` is the one list, `capped` and `unread` are enumerations (`abandoned-sweep-run.test.mjs` «iteration 2 DA-2») |
| V2-28 | DA-3 | Four places describe the pre-fix receipt | as V2-10; the db test's receipt drops `delivered` |
| V2-29 | DA-4 | The running-tasks read is cut at 500 without an order or a mark | ruled: CO-439's note |
| V2-30 | DA-5 | JSON credential fields and the `Token` scheme stored unredacted | fixed: rule `json-credential-field`, the `Token` scheme (`redact.test.ts` «redacts access_token, password, client_secret values and Authorization: Token», «keeps a plain word and a sentence»); camelCase keys and passphrases with spaces ruled: CO-222 |
| V2-31 | DA-6 | The rehearsal fails on the databases migration 124 repairs | as V2-14 |
| V2-32 | PL-1 | The rulings live only in the register | as V2-11 |
| V2-33 | PL-2 | Cross-project asks still unanswered | fixed: replies posted 2026-10-26 (`f13c9ea9` on `1ddb20ce`, CO-450; `c1e9554d` on `6225e0c1`, CO-434's note; `f769299a` on `d34e8ce8`, CO-258's note; `69dea81c` on `198866e6`, CO-432; `00da6035` on `ef5a84c3`, CO-451 and CO-045's note; `5cc2d25b` on `e75d502d`, CO-336's target corrected; `3a7c1489` on `cf5d97f7`; `a1faec87` on `41a9b0cb`, CO-452) and TO-2's SW-6 half asked of the adapter (request `e2a7bec4`); the rest on the owed list |
| V2-34 | PL-3 | 0.3.12's end unwritten; the skip's source not checkable | fixed: P-25 reads released and never rolled out here, owed in 0.3.13's Release close; the ledger names the source as a cross-session message from fabric-workspace's session, not on the board; P-27 lists the rows 0.3.13 moved into it |
| V2-35 | PL-4 | The rollout's gaps (actor, backup name, way back, Colima unproven) | as V2-12: steps 1, 3, 4 and 9 |
| V2-36 | PL-5 | PX-11 homeless; three threads in the handoff; a merge-log time | fixed: CO-413 names PX-11; as V2-25 and V2-22 |

Exit for iteration 2: every finding above is fixed or ruled with its row. Blocking findings open: none.

## Iteration 3

Five fresh reviewers, 2026-10-26, against `c83af249` (`c83af249b687861156a95160d1ed425fc37132af`), read-only in a
detached checkout. The final candidate is the commit after the fixes below, with `main` merged in; the receipts and the
release gate name it, as 0.3.12's named its final candidate. Reports: [UX](../reviews/0.3.13/iteration-3/2026-10-26-ux.md), [errors](../reviews/0.3.13/iteration-3/2026-10-26-errors.md),
[documents](../reviews/0.3.13/iteration-3/2026-10-26-docs.md), [data](../reviews/0.3.13/iteration-3/2026-10-26-data.md), [plan](../reviews/0.3.13/iteration-3/2026-10-26-plan.md).

29 findings, none blocking. Every iteration-2 fix held for the case it was written for. The errors reviewer found the
heal blind to a stack with only PostgREST gone, since its status still names the keys (ER-4), and a quit during the
heal's first read still spawning a stop (ER-1). The data and errors reviewers found the receipt for a blind read lost
when its one append fails (ER-3, DA-1), and the three quoted credential rules disagreeing on the same value (ER-2,
DA-4). The UX reviewer found История's agent list saying the journal is empty under a filter (UX-1) and Агенты' row
contradicting its page (UX-2). The plan reviewer found one board reply that the register contradicts (PL-1) and
DEC-0134 unanswered (PL-2).

| Finding | Level id | What | Disposition |
|---|---|---|---|
| V3-1 | UX-1 | «Кто» or «Проект» empties «Что делали агенты» and it says the journal is empty | fixed: «Ничего не найдено.» with «Сбросить фильтры» (`HistoryScreen.tsx#AgentWork`, `narrowed`; `HistoryScreen.test.tsx` «iteration 3 UX-1», watched failing with the change reverted); the old sentence loses its em dash in both languages |
| V3-2 | UX-2 | Агенты' row says «has not said yet» when the work read failed | fixed: the row says «Не удалось прочитать, что он делает.» (`AgentsScreen.tsx#lineOf`, `workUnread`; `AgentsScreen.test.tsx` «iteration 3 UX-2», watched failing) |
| V3-3 | UX-3 | The UX documents not amended for iteration 2's visible changes | fixed: dated amendments to SCN-161, SCN-166, SCN-168, SCN-173, SCR-87, SCR-88; `startupFailure.ts`'s two comments |
| V3-4 | UX-4 | A heal's stop refused because Docker does not answer is final, under a false title | fixed: such a stop is classified by Docker's words and waited out (`startupFailure.ts#classifyStartupFailure`; `startupFailure.test.ts` «iteration 3 UX-4», watched failing) |
| V3-5 | UX-5 | The splash is silent while the heal stops and starts the stack | fixed: `HEAL_LINE` before the stop, said in the person's language (`splashProgress.ts`; `stack-half-up.test.mjs` «iteration 3 UX-5», watched failing); Copylot `32cc6df4-48cf-4245-ba58-685402552091` |
| V3-6 | ER-1 | A quit during the heal's first read still spawns a stop | fixed: no stop once Fabric is quitting (`stackHalfUp.ts#resolveHealingHalfUp`; «iteration 3 ER-1», watched failing) |
| V3-7 | ER-2 | Redaction inconsistent across the quoted rules; `Token` eats prose | fixed: one test, `redact.ts#quotedValueIsSecret`, for JSON, the authorization field and YAML; `Token` takes only a token-shaped value (`redact.test.ts` «iteration 3: one value test», watched failing on the candidate's `redact.ts`); the rest ruled: CO-222 |
| V3-8 | ER-3 | A blind read's receipt is lost when its one append fails | fixed: the reads' state counts as recorded only once the journal took it (`abandonedSweepRun.ts`; `abandoned-sweep-run.test.mjs` «iteration 3 ER-3», watched failing) |
| V3-9 | ER-4 | A stack with only PostgREST gone is never healed | fixed: the watch also heals by the containers, a status with keys while Docker shows the stack partial is stopped keeping its data and started once (`stackHalfUp.ts`, `partial`; `env.ts#recoverStack`; «iteration 3 ER-4», watched failing); CHANGELOG and AGENTS.md say so |
| V3-10 | ER-5 | Four descriptions say every blind sweep writes a receipt | fixed: the module header, the obligation's evidence, AGENTS.md, the sweep spec, SCN-140's amendment, CHANGELOG |
| V3-11 | DO-1 | CHANGELOG says two credential shapes; it is four | fixed: CHANGELOG; Copylot `866411ca-d544-4492-8748-c48d5ba55c3d` (advisory only) |
| V3-12 | DO-2 | Five descriptions of the receipt are stale | as V3-10 |
| V3-13 | DO-3 | The handoff cites the wrong precedent commit | fixed: `4cf87820` |
| V3-14 | DO-4 | The handoff omits request `e2a7bec4` | fixed: the handoff's asks |
| V3-15 | DO-5 | CO-329, CO-367, CO-375 still target 0.3.10 | fixed: their target cells read 0.3.14 |
| V3-16 | DO-6 | P-27 omits CO-291 | fixed: P-27 |
| V3-17 | DO-7 | The 2026-10-25 audit handoff and report cite pre-landing commits | fixed: a dated note on each names the landed commits; the text is kept as the record of its moment |
| V3-18 | DA-1 | Descriptions stale; a refused receipt never retried | as V3-10 and V3-8 |
| V3-19 | DA-2 | Rollout step 9 loses Colima's writes and migrates a restored 95 to 97 | fixed: step 9 dumps Colima first, and 0.3.11's own first start rewrites the stack folder before the restore |
| V3-20 | DA-3 | CHANGELOG's count; CO-222 lacks the YAML gap | as V3-11; CO-222's status names what is still unredacted |
| V3-21 | DA-4 | The JSON rule rewrites names, paths and dates | as V3-7 |
| V3-22 | DA-5 | The receipt's read and bound names are hand-written copies | fixed: `SWEEP_READS` and `SWEEP_CAPS` in `shared/abandonedSweep.ts`, read by the sweep and the ingress rules (`abandoned-sweep-run.test.mjs` «iteration 3 DA-5») |
| V3-23 | PL-1 | A board reply the register contradicts | fixed: correction `661a5e1a` on `cf5d97f7` (CO-445, 0.3.14) |
| V3-24 | PL-2 | DEC-0134 unanswered; a promised row untracked | fixed: CO-453 filed and answered (`693a7937` on `6a334fcc`); the CT-143 row on the owed list |
| V3-25 | PL-3 | The Release close before the rollout | fixed: the Owed section says the Release close follows the rollout; the handoff's order |
| V3-26 | PL-4 | The owed list asks for posts already made and a reboot step 8 cannot make | fixed: the owed list |
| V3-27 | PL-5 | Rollout gaps: Colima's profile, the machine-wide context, step 9's actor and bundle | fixed: steps 1, 7 and 9 |
| V3-28 | PL-6 | P-27 and the handoff incomplete; `main` not merged | fixed: P-27, the handoff's Next task (`main` merged into the final candidate, the knowledge base before the tag) |
| V3-29 | PL-7 | Rows without a target; an unsourced ask; a broken link | fixed: CO-308, CO-315, CO-326, CO-365, CO-366, CO-372, CO-378 read 0.4.0 in their cells, CO-432 and CO-437 name a decision point; the plan's Composition names its source; the link points at the heading |

Exit for iteration 3: every finding above is fixed or ruled with its row. Blocking findings open: none.
