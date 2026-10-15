# Release verification — Fabric 0.3.6, the operator home, the project's way, settings as a screen: three independent iterations

Run `2026-10-14-release-036-verification` (`r-44ae60a75316`). The operator's rule (2026-10-03, plan row P-02, kept for
every release): before the release, three independent testing iterations across every level of the project, every
finding fixed, and only then the release. The operator asked on 2026-10-14, after Fabric would not open on their Mac,
for the fix and a new version, then for the whole run to be closed in one iteration with two or three checking rounds —
these three iterations are those rounds. This file is the ledger for **Fabric 0.3.6**: everything on `main` since
v0.3.5 — the operator home and project page in plain words (SCN-158, SCN-159), settings as a screen with the agents on
this computer (SCN-160), the stack-start retry (CO-294), comms wave 4 reads, the CO-282 harness waves behind their
flag, load-tolerant tests. The onboarding plan that held the 0.3.6 number moves to 0.3.7
([its note](2026-10-13-onboarding-036/README.md)).

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.6/iteration-N/`.

## Iteration 1

Five fresh reviewers, 2026-10-14, against `034108c5` (`034108c5cf0f4019fa35f5be0ec46776dfdd3ed5`, `main` after the stack-start retry), read-only in a
detached checkout. Reports, committed as written: [UX](../reviews/0.3.6/iteration-1/2026-10-14-ux.md) (UX-n),
[errors and boundaries](../reviews/0.3.6/iteration-1/2026-10-14-errors.md) (ER-n),
[code and documents](../reviews/0.3.6/iteration-1/2026-10-14-docs.md) (DO-n),
[data, memory, orchestration, harness](../reviews/0.3.6/iteration-1/2026-10-14-data.md) (DA-n),
[plan and roadmap](../reviews/0.3.6/iteration-1/2026-10-14-plan.md) (PL-n).

62 findings, 17 blocking, plus one found by the lead. Fixes landed on `agent/release-036-i1-fixes` with the
Comms branch `fix/rv-036-comms-ux` (`f5d55a16`) and the documentation branch `docs/review-036-docs` (`4f3f207c`). Every
*watched* fix had its test run with the old behaviour planted back and seen failing. Checks run after the fixes:
`vitest run src/renderer src/shared` 2147/2147; `agent-surface.test.mjs` on a disposable stack 104/104;
`probe-fresh-vs-upgraded.mjs --from 84` all green; `context-privacy.test.mjs` 8/8.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | UX-1 (blocking) | The release notes omit the release's three headline user-facing changes | fixed: CHANGELOG `## Unreleased` names the home (SCN-158), the project page (SCN-159), Settings as a screen (SCN-160) and the lost manual order of unpinned projects (docs branch `4f3f207c`) |
| V1-2 | UX-2 (blocking) | The headline "who is doing what" presents work nobody is doing as current | fixed: `homeLive.ts#composeHome`: `WorkItem.live`; a silent/lapsed claim is listed as «никто не отмечается», not counted and never a project's «Сейчас» (test `homeLive.test.ts` "work nobody is doing is not current"; watched) |
| V1-3 | UX-3 | The same task is named differently on two screens, against the wave's own plain-language rule | fixed: `projectPath.ts#pathSummary` = `homeLive.ts#taskSummary`: brief, title, else «Задача без описания»; the board keeps `legacyTaskLine` for untitled legacy tasks (`projectPath.test.ts`) |
| V1-4 | UX-4 | The home's "to review" figure is a floor shown as an exact number | fixed: `HomeView.reviewCapped`/`inWorkCapped`; counts read «50+» (`HomeWork.test.tsx`; watched) |
| V1-5 | UX-5 | Raw English machine errors are put inside localized sentences | fixed: `OperatorError.tsx#FailureNote`: our sentence, the machine's words on their own line, on Comms, home, project and Settings (branch `f5d55a16`, plants watched per screen) |
| V1-6 | UX-6 | Comms shows coding agents by raw runner id | fixed: Comms names agents by `runnerLabel` (branch `f5d55a16`; plants watched) |
| V1-7 | UX-7 | Two Comms reads fail in silence | fixed: a failed «More results» page and a refused Copy are said, «More results» kept (branch `f5d55a16`; plants watched) |
| V1-8 | UX-8 | Settings turns "unknown" into "not installed" | fixed: `SettingsScreen.tsx`: `installed: null` shows no pill (Switchboard did not say) |
| V1-9 | UX-9 | The screen records were not updated for the home and project waves, and the UX lint does not notice | fixed: `docs/ux/screens.md` SCR-30/31/52 built with coverage (docs branch `4f3f207c`) |
| V1-10 | UX-10 | From the Settings screen, "History" and "Agent access" open their panels in the `.shell` that follows the Settings screen, beside a hidden `<main>` | fixed: `App.tsx`: Settings renders inside `.shell`, so History and Agent access open beside it |
| V1-11 | UX-11 | The home's "In work" and "To review" lanes show at most 6 rows | fixed: lanes show «Ещё N» to the Board past six rows (`HomeWork.tsx` `LANE_ROWS`) |
| V1-12 | UX-12 | The Settings nav item is a toggle | fixed: the navigation item opens Settings (no toggle) and the screen carries its name «Настройки приложения» |
| V1-13 | UX-13 | The stack-start retry line is Fabric's own English sentence in main: "The stack is still starting — trying again (1)…" | ruled: CO-306 — the whole splash is English (main writes it before the locale is read); the line now says «try 2 of 4» |
| V1-14 | ER-1 (blocking) | A task whose instruction (plus brief) exceeds ~11.5 k characters can no longer be started at all, and the person is not told why | fixed: `contextPack.ts`: the essential head is delivered whole, memory that does not fit is left out and said; compiler revision 5 (`context-privacy.test.mjs`, the old refusal planted back failed) |
| V1-15 | ER-2 (blocking) | The project page's board glance counts "Done" from a read capped at 20 and shows it as the total | fixed: `ProjectWay.tsx#ProjectBoardGlance` `doneFloor` from `TaskList.closed.truncated`: «Готово 20+» (`ProjectLaunch.test.tsx`; watched) |
| V1-16 | ER-3 (blocking) | The release notes give the wrong schema boundary | fixed: CHANGELOG: schema 89 from 84, five migrations, an Upgrading paragraph (docs branch `4f3f207c`) |
| V1-17 | ER-4 | Claude Code (and every surface-connected runner) now refuses to start while Fabric's agent surface is down, where 0.3.5 started it unconnected | fixed: recorded in CHANGELOG "How sessions start": a surface-connected runner is refused before start when its surface is down, with the person-facing message; the behaviour is CO-282's and intended |
| V1-18 | ER-5 | The home's "In review" count and each project's review pill come from a read capped at 50, without saying so | fixed: with UX-4 |
| V1-19 | ER-6 | The stack-start retry has no quit check, logs nothing, and retries more than its stated scope | fixed: `stackStartRetry.ts`: `stopped()` read before and after the wait; retries recorded as `stack.start.retry` in the operations log; `unhealthy` is not waited out (`stackStartRetry.test.ts` "a quit during the wait starts no new try") |
| V1-20 | ER-7 | The home's count strip shows the last confirmed numbers as current after a failed read | fixed: `HomeStats`: after a failed read the counts show «—» with the reason as their title (`HomeWork.test.tsx`) |
| V1-21 | ER-8 | A failed "more results" page in Comms search ends the results silently | fixed: with UX-7 |
| V1-22 | ER-9 | "What waits for a project" drops the board's cap flag | fixed: «What waits for a project» keeps and says the over-100 flag (branch `f5d55a16`; watched) |
| V1-23 | ER-10 | "Quiet since" and the home's project order come from the last 3 000 journal events only | ruled: CO-307 |
| V1-24 | ER-11 | Settings shows Switchboard's raw answer as the "failed" reason when its JSON is a schema this build does not read | fixed: `agentCatalog.ts`: a newer schema is `unknown-schema`, said in words (`agentCatalog.test.ts`) |
| V1-25 | ER-12 | The two pending resource migrations reuse applied version numbers | ruled: CO-309 |
| V1-26 | DO-1 (blocking) | The release notes give the wrong schema: "schema 88 (from 84): four migrations", but the build admits only 89, after five | fixed: with ER-3 |
| V1-27 | DO-2 (blocking) | Settings cannot read the Switchboard catalogue it documents: Fabric's parser ignores Switchboard's `--json` envelope | fixed: `agentCatalog.ts#parseSwitchboardAgents` reads the `{ok, data}` envelope; measured live on Switchboard 0.6.31: 30 agents read (`agentCatalog.test.ts` "the envelope Switchboard actually prints") |
| V1-28 | DO-3 (blocking) | `## Unreleased` does not mention the release's headline changes | fixed: with UX-1, plus CO-292 and the Kimi Code registration |
| V1-29 | DO-4 (blocking) | Shipped launch behaviour from the CO-282 wave is unrecorded, and two of the changes are not behind any flag | fixed: CHANGELOG "How sessions start" (surface refusal, Kimi modes applied, context revision, ADR-0152/0154 inactive) |
| V1-30 | DO-5 | The stack-start retry can start a new `supabase start` after a quit, contrary to its own quit contract | fixed: with ER-6 |
| V1-31 | DO-6 | The runbook still says "The next release" and its readback omits 89 | fixed: `docs/launch/release-mac.md`: 0.3.6 admits 89; readback 89 |
| V1-32 | DO-7 | `screens.md` does not record the screens this release built | fixed: with UX-9 |
| V1-33 | DO-8 | SCN-147 and SCN-148 still say the contract repin is owed, but it has landed | fixed: SCN-147/SCN-148 amended 2026-10-14: the repin landed (`a59d04b`) |
| V1-34 | DO-9 | The private-archive compatibility record stops at schema 84, but the code admits 85–89 | fixed: archive compatibility for 85–89 recorded with its measurement (docs branch `4f3f207c`) |
| V1-35 | DO-10 | The pending harness migrations reuse version numbers the release now ships | ruled: CO-309 |
| V1-36 | DO-11 | The lifecycle table (LC-09) does not list this release's new clocks | fixed: AGENTS.md lifecycle rows: Comms badge 5 s, home reading 15 s, Settings catalogue once per opening |
| V1-37 | DO-12 | Some documents still describe the Settings band that wave 3 removed | fixed: `components/registry.ts` reworded; ADR-0156 Amendment 1 reads "the Settings band" as Settings |
| V1-38 | DO-13 | No scenario covers the stack-start retry; its code region points at an unrelated scenario | fixed: SCN-161 written and the code region points at it; the splash language is CO-306 |
| V1-39 | DO-14 | The CHANGELOG states the receipt-shape change twice, in two clusters | fixed: the duplicated receipt-shape entries merged |
| V1-40 | DA-1 (blocking) | A task with a long instruction no longer starts, and whether it starts depends on how much the project remembers | fixed: with ER-1 |
| V1-41 | DA-2 (blocking) | Harness wave-1 repairs change the ordinary launch path without a release note | fixed: with ER-4 and DO-4 |
| V1-42 | DA-3 (blocking) | The project page's board glance counts a capped read as the total — the M190 defect again | fixed: with ER-2 |
| V1-43 | DA-4 (blocking) | The release notes state the wrong schema | fixed: with ER-3 |
| V1-44 | DA-5 | History search cannot reach older messages once its 2 s budget is spent, and tells the person to do the thing that makes it worse | ruled: CO-308 |
| V1-45 | DA-6 | "Works on a board too large to hold" holds for the output, not the work | ruled: CO-308 |
| V1-46 | DA-7 | The inactive resource SQL keeps filenames that collide with applied migrations | ruled: CO-309 |
| V1-47 | DA-8 | A project's "last activity" is read from the newest 3 000 journal events of the whole estate | ruled: CO-307 |
| V1-48 | DA-9 | "What it is doing now" can be an old stage from a session that has ended | fixed: `composeHome`: a stage counts only from a session still held and signing (`homeLive.test.ts` "an ended session's last stage is not what anyone is doing") |
| V1-49 | DA-10 | The stack retry also retries `unhealthy`, which the release note and commit say it does not | fixed: with ER-6 |
| V1-50 | PL-1 (blocking) | The release notes omit the release's headline work | fixed: with UX-1 |
| V1-51 | PL-2 (blocking) | CHANGELOG gives the wrong schema | fixed: with ER-3 |
| V1-52 | PL-3 (blocking) | The plan on the candidate says 0.3.6 is a different release | fixed: the onboarding plan records its release moving to 0.3.7; this ledger re-scopes 0.3.6 |
| V1-53 | PL-4 (blocking) | A carry-over row gates this release and is still open | ruled: CO-284 — two of three checks run green 2026-10-14 (agent-surface 104/104, upgrade probe 84→89); the real-client smoke is carried to 0.3.7 |
| V1-54 | PL-5 | The release is not in the plan registers yet | fixed: P-18 in `docs/evidence/backlog.md`; this ledger |
| V1-55 | PL-6 | Recorded fixed, not shipped: CO-291 | fixed: CO-291 corrected: deferred with the onboarding plan (0.3.7) |
| V1-56 | PL-7 | Shipped, still recorded open: CO-190 | fixed: CO-190 resolved (`979474d3`) |
| V1-57 | PL-8 | The operator-home plan has no register home and silently dropped an item | fixed: the operator-home plan carries its status; the dropped permission mode is CO-305 |
| V1-58 | PL-9 | The workspace publication is stale and its path is broken | ruled: CO-197 / N-030 — the publication runs after this release lands; the scheduled sync's new failure (`ceo-conversation-service.test.mjs`) is fixed as `ee4064b4` on its own branch and landed on `main` with `339c44e1` |
| V1-59 | PL-10 | Harness records lag the work after N-040 closed | fixed: the CO-282 handoff names N-040 closed and the next task |
| V1-60 | PL-11 | CO-277's deadline is this release | ruled: CO-277 — the upgrade path measured green 2026-10-14; the `db reset` refusal is carried to 0.3.7 |
| V1-61 | PL-12 | Two open rows name the next release's local gate as their deadline | ruled: CO-281 and CO-293 — the release's local gate run decides them; carried to 0.3.7 if not reproduced |
| V1-62 | PL-13 | The same change is announced twice | fixed: with DO-14 |
| V1-63 | lead, while running CO-284's checks | `agent-surface.test.mjs` on a disposable stack: `fabric_whoami`'s answer outgrew the trace tap's 4 KiB head, so every call traced `unknown` | fixed: `toolOutcome.ts#bodyFromEnds` reads a long body from its head and tail; `toolOutcome.test.ts` 23/23; agent-surface 104/104 |

Exit for iteration 1: every finding is fixed or ruled to a register row. Blocking findings open: none.

## Iteration 2

Five fresh reviewers, 2026-10-15, against `339c44e1` (`339c44e1c99e6b27eb5ef8ea01c5faeedc0eb525`, `main` after
iteration 1's fixes and the revision-5 test repair), read-only in a detached checkout. The first two launches against
`7aaeff6b` all stopped on the account's rate limit (HTTP 429) before writing anything; that candidate also failed the
complete local gate (V2-41), so the iteration was run on `339c44e1`, with the reviewers started one or two at a time.
The docs reviewer ran on Opus and finished its report before the limit stopped it; the other four ran on Sonnet.
Reports, committed as written: [UX](../reviews/0.3.6/iteration-2/2026-10-15-ux.md) (UX-n),
[errors and boundaries](../reviews/0.3.6/iteration-2/2026-10-15-errors.md) (ER-n),
[code and documents](../reviews/0.3.6/iteration-2/2026-10-15-docs.md) (DO-n),
[data, memory, orchestration, harness](../reviews/0.3.6/iteration-2/2026-10-15-data.md) (DA-n),
[plan and roadmap](../reviews/0.3.6/iteration-2/2026-10-15-plan.md) (PL-n). Each reviewer also checked iteration 1's
fixes at its level; the ones that held only in part are findings here (UX-1, ER-2, DO-7, PL-3, PL-4).

40 findings, 2 blocking (DO-1 and DA-1, the same sentence; ER-3 and PL-1 name it too), plus one found by the lead.
Fixes landed on `agent/release-036-i2-fixes`. Checks run after the fixes: vitest on the launch screens, `homeLive`
and Settings (planted defects watched failing for the strip count, the per-project review count and the head refusal);
`run-project-board-operator-db` 12/12 and `run-function-privileges-db` 5/5 on isolated PostgreSQL;
`agent-surface.test.mjs` on a disposable stack (CO-303's reproduction); `check-registers`, `check-plan-ids`,
`ux/lint.py`; the complete local `bash scripts/ci.sh fast` on the fixes, exit 0 on 2026-10-15 after V2-42…V2-45 (load1 50–300 from other sessions through the runs).

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | UX-1 | Strip «tasks in work» counted live tasks only while the lane counted all | fixed: `HomeWork.tsx#HomeStats` counts the lane's set; `HomeWork.test.tsx` (old count planted back failed) |
| V2-2 | UX-2 | Settings had no `main` landmark, no focus move, and Escape closed it from a field | fixed: `SettingsScreen.tsx` is a `main` and focuses its heading; `App.tsx` Escape ignores fields and an open panel; `SettingsScreen.test.tsx` |
| V2-3 | UX-3 | An untitled legacy task is named two ways on the project page | fixed: SCN-159 amendment states the one exception («Вопросы ко мне» shares the Board's attention rows) |
| V2-4 | UX-4 | SCR-30 and SCN-158 still promised the old failure wording | fixed: SCR-30 row and SCN-158 «Errors & recovery» carry the shipped sentence, reason on its own line |
| V2-5 | UX-5 | The strip's failure tooltip passed a reason its string never shows | fixed: the argument is dropped (`HomeWork.tsx#HomeStats`) |
| V2-6 | UX-6 | A live task with no stage showed a blank line in «В работе» | fixed: it says «Ещё не сказал, что делает» (`HomeWork.tsx#HomeWorkLanes`); SCN-158 amendment |
| V2-7 | UX-7 | «All agents» on the project page leads to this project's agents | fixed: `launch.project.agents.all` «Агенты этого проекта» / "This project's agents" |
| V2-8 | UX-8 | Release notes quote Russian labels an English operator never sees | fixed: CHANGELOG gives the English name first, the Russian beside it |
| V2-9 | UX-9 | Comms' badge says «тредов» | not a defect: «тред» is the Russian Comms word throughout (`i18n/ru.ts` launch.comms.*) |
| V2-10 | ER-1 | A failed goals read on the project page was swallowed | fixed: `ProjectLaunch.tsx` keeps `goalsProblem`; `ProjectWay.tsx` says «Цель проекта не прочитана.» |
| V2-11 | ER-2 | Per-project review pill counted from the 50-row list; «idle» shown before any reading | fixed: `workRead.ts#readHome` reads every review task's project, `homeLive.ts#composeHome` counts from it (test, planted back failed); «idle» only from a reading that happened (`EstateHome.tsx`) |
| V2-12 | ER-3 | CHANGELOG says compiler revision 4 | fixed with V2-23 |
| V2-13 | ER-4 | Favourites and workspace-state reads failed without a word | fixed: both said in a banner; a failed workspace read is no longer recorded as 'declined' (`EstateHome.tsx`) |
| V2-14 | ER-5 | A failed first tasks read left the way at «Reading…» forever | fixed: `ProjectHome.tsx` keeps `tasksProblem`; `ProjectWay.tsx` says it |
| V2-15 | ER-6 | `readHome` stops silently at 500 projects / 500 stage reports | ruled: CO-310 (0.3.7) |
| V2-16 | DA-1 (blocking) | Release notes state revision 4 and the head-bounding revision 5 removed | fixed with V2-23 |
| V2-17 | DA-2 | The wave-4 migration's database tier is in no gate | fixed: `run-project-board-operator-db` joins the owned-cluster loop in `scripts/ci.sh`; run on isolated PostgreSQL: 12 passed, 0 failed |
| V2-18 | DA-3 | Claims/leases (200) and stage reports (500) cap silently | ruled: CO-310 (0.3.7) |
| V2-19 | DA-4 | Tasks of inactive projects shown with a blank project | fixed: `homeLive.ts#composeHome` leaves them off the home (test) |
| V2-20 | DA-5 | A refused board restore is not described | fixed: CHANGELOG — Comms says the texts did not come back whether the archive lacked them or their restore was refused |
| V2-21 | DA-6 | Migrations 100 and 107 restate no privileges | not a defect: they only replace existing functions (grants kept); `run-function-privileges-db` on isolated PostgreSQL PASS, 5 cases |
| V2-22 | DA-7 | Pending resource migrations reuse applied versions | ruled: CO-309 (already open) |
| V2-23 | DO-1 (blocking) | The release notes state the wrong context-compiler revision | fixed: CHANGELOG says revision 5 and what it changed (a long task is delivered whole, not refused) |
| V2-24 | DO-2 | SCN-159 still names a task by its instruction | fixed: SCN-159 step 2 and amendment |
| V2-25 | DO-3 | Iteration 1's new states recorded nowhere | fixed: SCN-158/159/160 amendments, SCR-30/31 state rows, SCR-52 amendment, one CHANGELOG clause; the strip and lane now count one set (V2-1) |
| V2-26 | DO-4 | CHANGELOG describes the Comms filters two ways | fixed: the COM-07 bullets say each filter change is one board read since wave 4 |
| V2-27 | DO-5 | Agent-facing notes say things twice | fixed: the epoch and the board-rule bullets merged |
| V2-28 | DO-6 | Kimi Code registration claimed beyond its evidence | fixed: CHANGELOG and README say it was verified outside a project only |
| V2-29 | DO-7 | FLW-92 and the product model still call SCR-83 a Settings band; dead `.settings-bar` CSS | fixed: FLW-92 reworded, product model regenerated, the CSS and its registry entry removed |
| V2-30 | DO-8 | Flows do not link back to this release's scenarios | fixed: FLW-40 traces SCN-135/SCN-160 with an agent-catalogue node; FLW-21 names SCN-158/159/161 |
| V2-31 | DO-9 | The ADR register names two current pipeline reservations | fixed: ADR-0157 recorded superseded, never used (re-reserved as 0159) |
| V2-32 | DO-10 | SCN-160 cites only the 0.6.30 measurement | fixed: the 0.6.31 measurement (30 agents) added to its Coverage |
| V2-33 | PL-1 | CHANGELOG revision 4 | fixed with V2-23 |
| V2-34 | PL-2 | The Now line stops at 0.3.5 and schema 84 | fixed: Now names P-18 (0.3.6, schema 89) then P-19; the upgrade sentence says schema 89 |
| V2-35 | PL-3 | The 0.3.7 onboarding plan has no register home and its body says 0.3.6 | fixed: P-19 row is its home; the dated plan's body stays as written (dated documents are not rewritten), its header note records the move |
| V2-36 | PL-4 | Iteration 1's rulings are not in the rows they cite | fixed: CO-277 and CO-284 re-dated to 0.3.7; CO-293 re-dated, not reproduced; CO-281 resolved on a green complete gate |
| V2-37 | PL-5 | CO-303 open with no reproduction | fixed: not reproduced — `agent-surface.test.mjs` on a disposable stack at `339c44e1`: 43 tools with `com.directory`, `fabric_whoami` names the project; CO-303 resolved |
| V2-38 | PL-6 | No complete local gate recorded for the candidate | fixed: complete local `bash scripts/ci.sh fast` on `339c44e1` exit 0 (2026-10-15, load1 above 300); the final candidate's run is a release-close step |
| V2-39 | PL-7 | The Next free ID note contradicts itself | fixed: one number (CO-311), the counter named as the authority |
| V2-40 | PL-8 | No release-close list; the gate file still names 0.3.5 | fixed: «Release close» list below; the gate file changes in the release commit |
| V2-41 | lead, the complete local gate on `7aaeff6b` | Four tests still demanded revision 4's refusal of a long task, so the gate and hosted CI failed on the first iteration-2 candidate | fixed in `339c44e1`: `context-mandatory.test.mjs` and `prepared-launch-input.test.mjs` check revision 5 (the old refusal planted back failed); the CEO in-flight test's 2 s hold brought in; the SRC-02 receipt re-pointed |
| V2-42 | lead, the complete local gate on the iteration-2 fixes at load1 about 300 | `git-lease-snapshot.test.mjs` "default command transport isolates …" gave its fake git (a Node script) 1 s to start, and the start alone outlasted it | fixed: the case checks argv and environment with a 10 s deadline (a hang still fails); 49/49 three times |
| V2-43 | lead, the next complete local gate | `resource-pool-publisher.test.mjs` "pending read is bounded …" failed 2 of 5 runs even at low load: its 10 ms deadline could pass before the read began, so the reentry it checks was never attempted | fixed: 250 ms (the read hangs until released, so it still times out); 8/8 |
| V2-44 | lead, the next complete local gate at load1 about 150 | `executor-detect.test.mjs` gave five shell probes 4 s and asserted the run under 3 s; at that load «firstline» read as no version | fixed: 15 s deadline, and the bound is "answered before the deadline" — the held child sleeps 30 s, so waiting for it still fails; 3/3 |
| V2-45 | lead, the next complete local gate | Two of V2-41's new assertions compared two separate compiles byte for byte, and each pack names the millisecond it was compiled, so they failed when the clock moved between them (1 of 5 runs) | fixed: compared without the clock line (`context-mandatory.test.mjs`, `unclocked`); 12/12 |

Exit for iteration 2: every finding is fixed or ruled to a register row. Blocking findings open: none.

## Iteration 3

Five fresh reviewers, 2026-10-15, against `940f14d3` (`940f14d3595e40b1113ba5ba04123fcd5a2b2366`, `main` after
iteration 2's fixes), read-only in a detached checkout, run on Sonnet one or two at a time. Reports, committed as
written: [UX](../reviews/0.3.6/iteration-3/2026-10-15-ux.md) (UX-n),
[errors and boundaries](../reviews/0.3.6/iteration-3/2026-10-15-errors.md) (ER-n),
[code and documents](../reviews/0.3.6/iteration-3/2026-10-15-docs.md) (DO-n),
[data, memory, orchestration, harness](../reviews/0.3.6/iteration-3/2026-10-15-data.md) (DA-n),
[plan and roadmap](../reviews/0.3.6/iteration-3/2026-10-15-plan.md) (PL-n). As in 0.3.5, the fixes below make the
final candidate, which is `verifiedCommit`.

30 findings, 1 blocking (PL-1: the CHANGELOG's 0.3.5 baseline). Where the gates ran: iteration 2's complete local
`ci.sh fast` (exit 0) ran on the tree of its fixes before the ledger and map lines of `940f14d3` were written; the
final candidate's own complete gate is recorded in the release commit.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V3-1 | UX-1 | The board glance reads «Reading…» forever when the tasks read fails | fixed: `ProjectWay.tsx#ProjectBoardGlance` says it (`ProjectWay.test.tsx`) |
| V3-2 | UX-2 | Release notes name most new controls in Russian only | fixed: CHANGELOG gives the English label first, the Russian beside it, for every new control |
| V3-3 | UX-3 | Settings' unknown-schema case prints its reason twice | fixed: the sentence no longer carries `{detail}`; the reason stands on its own line |
| V3-4 | UX-4 | A project's goal is shown twice on its first screen | fixed: said once in «Дальше»; the side panel stands in only while there is no goal (`ProjectLaunch.test.tsx`); SCN-159 amended |
| V3-5 | UX-5 | SCR-52's index row says designed while the record says built | fixed: the index says built for the screen; the record keeps the estate-scoped half designed |
| V3-6 | UX-6 | A refused settings write is said in a banner that can be out of view | ruled: CO-313 (0.3.7 rebuilds Настройки) |
| V3-7 | ER-1 | A failed reload of a project's tasks leaves the last way on screen unsaid | fixed: `ProjectWay.tsx` says «Задачи не перечитались…» above the last read (`ProjectWay.test.tsx`, the old branch planted back failed) |
| V3-8 | ER-2 | Comms read marks grow past the settings file's 4096 bound | ruled: CO-312 |
| V3-9 | ER-3 | Favourite toggle, replace and move had no rejection handler | fixed: each says its failure in the pins banner (`EstateHome.tsx`) |
| V3-10 | ER-4 | The lease scratch monitor treats a vanished temp file as a breach | ruled: CO-316 (behind CO-282's flag) |
| V3-11 | ER-5 | After a failed home read the lanes keep the last view without saying so | ruled: CO-313 (the strip already shows «—»; 0.3.7 rebuilds Главная) |
| V3-12 | ER-6 | `since()` renders NaN for a time that does not parse | fixed: «—» (`duration.test.ts`) |
| V3-13 | ER-7 | Settings' catalogue failure text: `{ok:false}`, a timeout, a duplicate line | ruled: CO-313 for the `{ok:false}` and timeout wording; the duplicate line fixed with UX-3 |
| V3-14 | ER-8 | The stack retry's worst case is about 16 minutes, unstated | ruled: CO-311; the CHANGELOG now states the worst case |
| V3-15 | DO-1 | SCR-52's index status | fixed with UX-5 |
| V3-16 | DO-2 | An SCR-52 paragraph still reads as a current Settings band | fixed: marked superseded in place |
| V3-17 | DO-3 | The retry's splash line is English-only and the notes do not say so | fixed: CHANGELOG says so (CO-306) |
| V3-18 | DA-1 | The home can name a claimed task by its instruction | fixed: `homeLive.ts#composeHome` no longer falls back to the claim's title (`homeLive.test.ts`) |
| V3-19 | DA-2 | Board sessions count as agents at work | fixed: `index.ts#heldSessions` leaves board sessions out; `agentSurface.ts#heldSessions` marks them (`board-surface.test.mjs`) |
| V3-20 | DA-3 | fabric-mcp's 429 cooldown is not in the notes; a Retry-After over 300 s becomes 60 s | fixed: CHANGELOG states the cooldown; ruled: CO-314 for the 60 s fallback |
| V3-21 | DA-4 | The thread page aggregates every thread before filtering | ruled: CO-308 (already open) |
| V3-22 | DA-5 | A backup missing `board.json` restores as an older archive | ruled: CO-315 |
| V3-23 | DA-6 | Pending resource migrations share applied version prefixes | ruled: CO-309 (already open) |
| V3-24 | PL-1 (blocking) | CHANGELOG says 0.3.5's revision 4 refused a long task; 0.3.5 shipped revision 3 | fixed: CHANGELOG says 0.3.5 is revision 3 and never refused one, an unreleased revision 4 did, 0.3.6 is revision 5 (`git show v0.3.5:apps/desktop/src/main/contextPack.ts`, `COMPILER_REVISION = 3`) |
| V3-25 | PL-2 | The green complete gate is attributed to a commit it did not run on | fixed: the iteration sections name the trees the gates ran on; the final candidate's own complete gate is recorded below |
| V3-26 | PL-3 | `ee4064b4` is cited as on main | fixed: the ledger, its receipt and the harness handoff say it landed with `339c44e1` |
| V3-27 | PL-4 | No merge-log entry for iteration 2; the release close does not name one | fixed: `docs/MERGES.md` entry for `940f14d3`; the release-close list names the merge log |
| V3-28 | PL-5 | Rows ruled to 0.3.7 have no register home | fixed: P-19 names CO-277, CO-284, CO-293, CO-304, CO-305…CO-316 |
| V3-29 | PL-6 | CO-304's deadline still reads next release | fixed: re-dated to 0.3.7 |
| V3-30 | PL-7 | P-18 does not say iteration 2 closed; iteration-2 reports carry the wrong date | fixed: P-18 names iterations 2 and 3; the iteration-2 reports are renamed 2026-10-15 and their receipts follow |

Exit for iteration 3: 30 findings dispositioned; the final candidate `295150039e054ef0c56762f57d483f6516aa8307` is `verifiedCommit` (its complete local `ci.sh fast` exit 0, 2026-10-15). Blocking findings open: none.

## Release close

The steps after iteration 3 ends with no blocking finding, in order, each by the agent (operator rule, 2026-10-11):

1. `apps/desktop/package.json` → `0.3.6`; CHANGELOG `## Unreleased` → `## 0.3.6 — <date>`.
2. `docs/launch/release-gate.json` → version 0.3.6, this ledger, `verifiedCommit` = iteration 3's candidate, the three
   iterations' review receipts (`docs/evidence/reviews/0.3.6/iteration-{1,2,3}/*.json`).
3. The merge log (`docs/MERGES.md`) and the design map in the same commit; the complete local gate green on it; land on `main`.
4. Push the tag `v0.3.6`; watch `release.yml` (approval by checks) to success; confirm the published release.
5. Install the release here through the lifecycle broker; close P-18.
6. `node scripts/workspace.mjs publish`, then `node scripts/workspace.mjs check --require-child` (N-030, CO-197).
