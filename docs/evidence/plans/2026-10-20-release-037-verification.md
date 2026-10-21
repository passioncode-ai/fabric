# Release verification: Fabric 0.3.7, the simple Fabric, three independent iterations

Run `r-8db0598178fb`. The operator's rule (2026-10-03, plan row P-02, kept for every release): before the release,
three independent testing iterations across every level of the project, every finding fixed or ruled, and only then
the release. The operator asked on 2026-10-20 to finish 0.3.7 to the end in one pass. This ledger covers everything on
`main` since v0.3.6: the simple plan's waves 0 to 3 and the final pass F1 to F9
([plan](2026-10-15-fabric-simple/README.md), [final pass](2026-10-15-fabric-simple/2026-10-19-final-pass.md)).

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.7/iteration-N/`.

## Iteration 1

Five fresh reviewers, 2026-10-20, against `ff13325f` (`ff13325f1f156d1f1ac0d781a2732249d9acdb6d`, F7 part 1 on top of `main`), read-only in a
detached checkout. Reports, committed as written: [UX](../reviews/0.3.7/iteration-1/2026-10-20-ux.md) (UX-n),
[errors and boundaries](../reviews/0.3.7/iteration-1/2026-10-20-errors.md) (ER-n),
[code and documents](../reviews/0.3.7/iteration-1/2026-10-20-docs.md) (DO-n),
[data, memory, orchestration, harness](../reviews/0.3.7/iteration-1/2026-10-20-data.md) (DA-n),
[plan and roadmap](../reviews/0.3.7/iteration-1/2026-10-20-plan.md) (PL-n).

58 findings, 20 blocking; ER-4 was raised to blocking when the operator hit it on their Mac the same morning (OrbStack
restarting at start). Fixes landed on `agent/release-037-i1-fixes` by four parallel fix runs. Every *watched* fix had
its test run with the old behaviour planted back and seen failing. Migration 116 adds schema 94.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | UX-1 (blocking) | Undoing «Работа закончена» leaves the console saying the opposite of the record | fixed: `main/actRunExecutors.ts#createRunOverConsole`: the undo puts the console back to an unknown end and offers «Работа закончена» again (`act-run-over.test.mjs`, `SessionStop.test.tsx` "after the attestation is undone…"; watched) |
| V1-2 | UX-2 (blocking) | История promises the agents' acts, and none can appear in it | fixed: История says what it lists: your acts and what Fabric did on its own; the agents' own acts are 0.3.8 (P-20); CHANGELOG corrected (`acts.lede`, `acts.empty`) |
| V1-3 | UX-3 (blocking) | «Запускать Fabric при входе в систему» is shown checked on Linux and does nothing there | fixed: `settings.loginItem` IPC: no row where nothing is registered (Linux, development build); the system's state said on macOS and Windows; per-platform note (`loginItem.test.ts`, `SettingsScreen.test.tsx` "launch at login, only where it does something"; watched) |
| V1-4 | UX-4 (blocking) | Regression from 0.3.6: the count of Comms threads with new messages is gone, and nothing says so | fixed: the unread count on the rail's Настройки item and on «Переписка между проектами»; SCN-143 amended (`Rail.test.tsx`, `SettingsScreen.test.tsx`; watched) |
| V1-5 | UX-5 | After «Работа закончена» the console says «Остановка подтверждена» | fixed: an attested stop reads «Вы отметили: работа закончена» (`SessionStop.test.tsx`; watched) |
| V1-6 | UX-6 | Act sentences on the act line and in История carry machine ids and English | fixed: (a) the option's label (`answerCommit.ts#answerSaid`); (b) `runnerLabel` at display time, older records mapped (`ActLine.test.tsx`, `act-session-words.test.mjs`; watched); (c) the English brand lockup ruled to `docs/brand/`, not a defect of this release |
| V1-7 | UX-7 | The agents' «Запуск:» lines in Настройки go stale when the permission choice changes | fixed: the launch line re-read when the permission choice changes (`SettingsScreen.test.tsx`; watched) |
| V1-8 | UX-8 | «Подключились сами» in Агенты does not follow an undo from the act line | fixed: `JoinedAgents` re-reads on the act and access marks (`JoinedAgents.test.tsx`; watched) |
| V1-9 | UX-9 | Under 900 px the rail folds and the four place links lose their names | fixed: place links carry `title` and an accessible name that survives the fold; aside and nav named apart (`Rail.test.tsx`; watched) |
| V1-10 | UX-10 | The rail's foot line «этот компьютер · есть что проверить» is driven by any shell error, not by the computer | fixed: `machineOf()`: trouble only when the journal read fails (`Rail.test.tsx`; watched); a page explaining it waits for wave 4 (P-20) |
| V1-11 | UX-11 | A button still ends in an arrow, against this release's "buttons and links no longer end in an arrow" | fixed: the arrow dropped (`HomeRhythm.test.tsx`; watched); SCN-163 text too |
| V1-12 | UX-12 | The agent's flow is newest first, but the note that earlier events are left out sits above the newest row, where it reads as if the top is cut. | fixed: the note under the flow (`EstateAgents.test.tsx`; watched) |
| V1-13 | UX-13 | Two new Settings controls have no scenario | fixed: SCN-170 amended with launch at login and the permission choice |
| V1-14 | UX-14 | The UX lint can no longer see the vision rule, so the alignment rule's gate is blind (new U033 since 0.3.6) | fixed: `docs/ux/lint.py#read` keeps inline code spans (`test/audit_regressions/fix-ux-14.py` in `ci.sh`; watched); U033 gone |
| V1-15 | UX-15 | The release notes do not say that «Где идёт работа» (a 0.3.6 navigation item) is gone | fixed: CHANGELOG names the retired screen |
| V1-16 | UX-16 | Two new failures put the machine's words inside our sentence, the pattern the 0.3.6 review (UX-5) removed elsewhere | fixed: `FailureNote` for the separate window; `OperatorError.tsx#withDetail` and `draftNotKept.ts` for the draft (`SessionWindow.test.tsx`, `draftNotKept.test.ts`, `OperatorError.test.tsx`; watched) |
| V1-17 | ER-1 (blocking) | The login-shell PATH probe has no working deadline, and it sits on the startup path: a slow `.zshrc` delays every start by its full duration, and an r | fixed: `main/loginShellPath.ts`: no stdin, own process group, SIGKILL at 3 s, settles once (`login-shell-path.test.mjs` with fake shells; watched) |
| V1-18 | ER-2 (blocking) | The release notes and the upgrade procedure name schema 92; this build admits exactly 93. | fixed: CHANGELOG Database and Upgrading for 89 → 94; runbook rewritten |
| V1-19 | ER-3 (blocking) | Settings says Fabric starts at login where nothing is registered, and never shows whether the system actually took it. | fixed: with UX-3 |
| V1-20 | ER-4 | A login start whose Docker is not up yet becomes a startup failure window at every login. | fixed: blocking after the operator hit it on 2026-10-20: Docker away at start is waited for up to 90 s (`stackStartRetry.ts#waitForDocker`, `main/dockerPing.ts`; `stackStartRetry.test.ts` "Docker that is not there yet", `docker-ping.test.mjs`; watched) |
| V1-21 | ER-5 | Fabric's own enrollment makes a project of temporary and tool folders that `fabric.project.resolve` refuses, so the new hub answer is not "the way Fab | ruled: CO-339 (0.3.8): enrollment moves onto the contract's resolver; CHANGELOG no longer claims "the way Fabric does" |
| V1-22 | ER-6 | `fabric.project.resolve` takes caller input that it does not bound the way its description says. | fixed: a relative path is `input-invalid`, async realpath, parallel probes, 8 s overall deadline answering `pending` (`projectResolve.test.ts`; watched); a Git-facts cache is optional, not taken |
| V1-23 | ER-7 | After «Отменить» on «Работа закончена», the console still says the run is over, and a refused attestation reaches the person as a raw code. | fixed: with UX-1; a refused attestation in our words (`SessionStop.test.tsx` "a refused attestation…"; watched) |
| V1-24 | ER-8 | A binding can raise its own call budget tenfold by varying `runtimeSessionId`. | ruled: CO-346 (0.3.8) |
| V1-25 | ER-9 | «Отключить» keeps an agent out of session enrollment only; it can still put access questions in front of the person. | ruled: CO-347 (0.3.8) |
| V1-26 | ER-10 | The folder-trust test runs in no gate. | fixed: `claude-trust.test.mjs` runs in `ci.sh` and the package test (planted defect watched) |
| V1-27 | ER-11 | Two loosened boundaries ship with no switch a person can find. | ruled: CO-348 (0.3.8); both defaults are the operator's (ADR-0168) |
| V1-28 | DO-1 (blocking) | The release notes never name the schema this build admits (93), and there is no Upgrading paragraph. | fixed: CHANGELOG `### Database` and **Upgrading.** for 89 → 94 |
| V1-29 | DO-2 (blocking) | The upgrade runbook states the wrong schema for 0.3.7. | fixed: `docs/launch/release-mac.md`: 0.3.7 admits 94, readback 94, reservation 117/118 |
| V1-30 | DO-3 (blocking) | A release note says plain folders are refused; the release admits them. | fixed: CHANGELOG, the ADR-0164 index wording and the `fabric-mcp` lifecycle row say plain folders are admitted and containers refused |
| V1-31 | DO-4 (blocking) | ADR-0169's isolation rule is false for Claude Code: a console that carries gateway role keys runs without `--strict-mcp-config`. | fixed: `sessionBundle.ts`: Claude strict whenever the plan carries gateway role keys, as Codex (`session-bundle.test.mjs`; watched); the Codex sign-in sentence corrected |
| V1-32 | DO-5 | Smaller inaccuracies in `## Unreleased`. | fixed: five, not seven; DEC-0092 and CO-339 named; platforms of the login item; CT-26 entry; wave tags removed |
| V1-33 | DO-6 | Launch at login is documented only in the lifecycle table, and two statements around it are now false. | fixed: with UX-3 and UX-13; AGENTS.md Windows and Linux paragraph |
| V1-34 | DO-7 | The planning registers do not describe what 0.3.7 is. | fixed: P-19 rewritten, P-20 for 0.3.8, both in lane 2; Now line; the plan README and the final pass carry wave 4's move |
| V1-35 | DO-8 | ADR-0166's amendment is not carried into the index or CO-331. | fixed: ADR index row and CO-331 follow the amendment |
| V1-36 | DO-9 | The carry-over ledger's next free id is already taken. | fixed: Next free ID `CO-349` with the reservations of CO-339 to CO-348 |
| V1-37 | DO-10 | The private-archive compatibility record stops at schema 89; the code admits 90 to 93. | fixed: `docs/launch/harness-r0/ceo-private-archive.md` schema-90 to schema-94 qualification |
| V1-38 | DO-11 | New person-facing prose written after the no-em-dash rule (2026-10-18) still uses U+2014. | fixed: SCN-162, SCN-169 and CO-331 rewritten without U+2014 |
| V1-39 | DA-1 (blocking) | An answer that was taken back keeps feeding agents as a current project decision, and answering again leaves two current decisions. | fixed: migration 116 `apply_withdrawn_answer_decision` closes the withdrawn decision, backfills 90 to 93; the Decisions panel too (`reopen-answer-db.test.mjs`, `decisions.test.ts`; watched) |
| V1-40 | DA-2 (blocking) | The release notes and the upgrade runbook name the wrong schema; the build admits only 93. | fixed: with DO-1 and DO-2 |
| V1-41 | DA-3 | `rebuild_estate_projections` fails for any estate where a folder was detached and attached again under a new id. | ruled: CO-340 (0.3.8) |
| V1-42 | DA-4 | Migration 113 makes two promises it keeps only sometimes. | ruled: CO-341 (0.3.8); the runbook says the index may be skipped and that 113 rewrites every row |
| V1-43 | DA-5 | Migration 115's bytes were changed twice after it was recorded in the ledger on `main`, and the ledger entry was rewritten. | ruled: CO-342 (0.3.8); migration 116 restores schema-93 archive admission for development databases |
| V1-44 | DA-6 | The agent history read (now a three-way OR) has no index and runs every 10 s. | fixed: three journal indexes in 116 and three keyed reads: 34 ms → 0.15 ms at 200 000 events (`sessionHistory.test.ts`; watched) |
| V1-45 | DA-7 | История's reversal read never uses the index migration 112 made for it. | fixed: `actLog.ts#reversersOf` filters `type` (`acts.test.mjs`; watched) |
| V1-46 | DA-8 | The native Stop suite failed once under load and passed on rerun. | ruled: CO-332 (timing under load, 0.3.8); no code it covers changed |
| V1-47 | PL-1 (blocking) | Wave 4 of the 0.3.7 plan is neither shipped nor given a new home. | fixed: wave 4 moved to 0.3.8 (P-20) in the plan, the final pass and the ledger; CHANGELOG overclaims removed |
| V1-48 | PL-2 (blocking) | P-19 and the Now line describe a different 0.3.7. | fixed: P-19 and the Now line describe this 0.3.7; P-19 in lane 2; the onboarding plan annotated; CO-291 lands with wave 4 |
| V1-49 | PL-3 (blocking) | Open carry-over rows still name 0.3.7 as their deadline, and two have no new home at all. | fixed: rows re-dated 0.3.8 citing the final pass; CO-277 ruled here (V1 PL-3); CO-326 and CO-322's permission check given their status |
| V1-50 | PL-4 (blocking) | The contract's "not attributable yet" state that Fabric accepted is not shipped and not recorded. | fixed: DEC-0092 `pending` shipped (`main/gitFacts.ts`, `projectResolve.ts`; watched); CT-66 is CO-343 |
| V1-51 | PL-5 (blocking) | The self-updater promised to fabric-workspace for 0.3.7 moved to 0.4.0 without a recorded agreement, and the knowledge base still says 0.3.7. | ruled: posted on `cb31a510` at release with the login item delivered and the updater 0.4.0 (P-12, CO-344); the knowledge base changes with fabric-workspace's next session (Release close) |
| V1-52 | PL-6 (blocking) | The release notes and the runbook give the wrong schema. | fixed: with DO-1, DO-2; CT-26 in the notes |
| V1-53 | PL-7 (blocking) | CO-331 records the superseded direction of the cross-project attribution. | fixed: CO-331 rewritten to the amendment |
| V1-54 | PL-8 | 0.3.7 is not in the release registers yet. | fixed: this ledger; `release-gate.json` and the version at the release commit |
| V1-55 | PL-9 | The cross-project closes this release owes have no list. | fixed: the Release close lists each with its thread |
| V1-56 | PL-10 | Two other projects' asks have no Fabric row by id. | ruled: CO-344 (FD-12, 0.4.0) and CO-345 (DEC-0093, 0.3.8) |
| V1-57 | PL-11 | Stale register notes. | fixed: with DO-9; CO-309 names 117/118 |
| V1-58 | PL-12 | The workspace publication is stale on the candidate. | ruled: a release step: published and pinned after the release commit (Release close) |

Exit for iteration 1: every finding is fixed or ruled to a register row. Blocking findings open: none.

## Iteration 2

Five fresh reviewers, 2026-10-20, against `07ae71e7` (`07ae71e79718b98726b0f36e95b607cb10e24a3c`, iteration 1's fixes), read-only in a detached
checkout. Reports, committed as written: [UX](../reviews/0.3.7/iteration-2/2026-10-20-ux.md) (UX-n),
[errors and boundaries](../reviews/0.3.7/iteration-2/2026-10-20-errors.md) (ER-n),
[code and documents](../reviews/0.3.7/iteration-2/2026-10-20-docs.md) (DO-n),
[data, memory, orchestration, harness](../reviews/0.3.7/iteration-2/2026-10-20-data.md) (DA-n),
[plan and roadmap](../reviews/0.3.7/iteration-2/2026-10-20-plan.md) (PL-n).

31 findings, 8 blocking. Every iteration-1 disposition was checked against the code; the ones that did not hold (UX-2
of iteration 1, ER-4's socket path, DO-3, DO-5, DO-6) are findings here and fixed.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V2-1 | UX-1 (blocking) | Iteration-1 V1-2 (UX-2) is not fixed | fixed: История says «каждое ваше действие» only, and that the agents' acts arrive in 0.3.8 (`acts.lede`, `acts.empty`; `HistoryScreen.test.tsx`) |
| V2-2 | UX-2 (blocking) | On Windows, a person who opens Fabric from the «Пуск» menu while the login start is still starting gets no window, then or later | fixed: `second-instance` during a background start sets `activatedDuringStartup` (`background-launch.test.mjs` "a second launch during a background start…") |
| V2-3 | UX-3 | The release note says "buttons and links no longer end in an arrow", and a text button still does: the Plan's «Раскрыть ↓» / "Open ↓", beside «Открыть | fixed: the trailing ↗ removed from row buttons on Главная, the project page, the board and Comms, and «Раскрыть ↓» is «Раскрыть» (affected suites, 121 tests) |
| V2-4 | UX-4 | A run attestation refused because the work is already marked over is worded as a task move: «задача уже там» | fixed: a refused attestation of an attested run is `already_attested`, «работа уже отмечена законченной» (`act-run-over.test.mjs`) |
| V2-5 | UX-5 | «Ваш текст заменён | ruled: CO-352 (0.3.8) |
| V2-6 | UX-6 | Revoking an agent's access in Настройки → Доступ агентов is recorded as «Агент отключён» with no name, so История cannot say which agent was cut off | ruled: CO-353 (0.3.8) |
| V2-7 | UX-7 | Iteration-1 V1-6(c) says the English «by PassionCode» in the Russian rail was "ruled to `docs/brand/`", but `docs/brand/` holds no such record: `local | fixed: `docs/brand/terminology.md` records the English lockup decision |
| V2-8 | ER-1 (blocking) | The Docker wait that closed iteration 1's ER-4 never sees Docker come up with the wording Docker and Supabase actually print, so a login start before  | fixed: `stackStartRetry.ts#dockerSocketFrom` ends the path at `.sock` and drops trailing punctuation; tests with the docker CLI's and the Supabase CLI's real words (watched: 2 failed on the old parser) |
| V2-9 | ER-2 | `readGitFacts` reads a folder it is not allowed to enter as "not in Git", which is the confusion DEC-0092's `unreadable` exists to prevent. | fixed: «cannot change to» is `none` only with «No such file or directory» (`git-facts.test.mjs` "a repository under a folder Git may not enter…", watched) |
| V2-10 | ER-3 | One admitted folder whose Git stays unreadable makes every `fabric.project.resolve` answer `pending`, for every folder, until the person repairs that  | ruled: CO-354 (0.3.8); `pending` is the safe answer |
| V2-11 | DO-1 (blocking) | Iteration-1 DO-3 is recorded as fixed, but the ADR-0164 index row still says non-Git folders are refused. | fixed: ADR-0164 index row says a plain folder becomes its own Project and containers are refused |
| V2-12 | DO-2 (blocking) | Iteration-1 DO-5 is recorded as fixed ("five, not seven"; "wave tags removed"), and two of its parts still stand. | fixed: SCN-160 says five; the CHANGELOG wave tag removed |
| V2-13 | DO-3 (blocking) | The testers' brief sends the external tester to Settings for the Fabric version, and Settings does not show it. | fixed: the testers' brief names the macOS «О программе» menu item, else the downloaded file name |
| V2-14 | DO-4 (blocking) | Iteration-1 DO-6 is recorded as fixed, but SCR-89 was not touched, and the section name in the docs is not the app's. | fixed: SCR-89 lists launch at login and the not-drawn state; SCN-170 says «Компьютер» as the app does |
| V2-15 | DO-5 | ADR-0166's served capability is described with the wrong answer schema, and the index status misses its second amendment. | fixed: ADR-0166 note of 2026-10-20 names `resolveAnswer` (DEC-0092); the index row carries the amendment |
| V2-16 | DO-6 | AGENTS.md cites the wrong carry-over row for the container refusal. | fixed: the `fabric-mcp` lifecycle row cites `8bdad97c` |
| V2-17 | DO-7 | The upgrade runbook understates migration 116. | fixed: the runbook names 116's column, check, projector, pass and three indexes; step 2's FROM has 89 for 0.3.6 |
| V2-18 | DO-8 | Register rows contradict the release's own re-dating. | fixed: CO-277 and CO-291 say 0.3.8; P-20 names CO-291, CO-329, CO-332, CO-335, CO-336 |
| V2-19 | DO-9 | The testers' brief gives macOS-only prerequisites while offering Windows and Linux builds. | fixed: the testers' brief gives Windows and Linux prerequisites and log folders |
| V2-20 | DA-1 | A withdrawn answer whose decision was corrected first keeps the correction current. | ruled: CO-355 (0.3.8) |
| V2-21 | DA-2 | A withdrawn decision is shown as corrected, or not at all. | ruled: CO-356 (0.3.8) |
| V2-22 | DA-3 | A rebuild loses `questions.resolution_id` for a question answered again after a withdrawal. | ruled: CO-357 (0.3.8) |
| V2-23 | DA-4 | A backup of an estate that has one folder in two projects cannot be restored into a fresh 0.3.7 database. | ruled: CO-358 (0.3.8), with CO-341 |
| V2-24 | DA-5 | The upgrade runbook undercounts what migration 116 changes. | fixed: with DO-7 |
| V2-25 | PL-1 (blocking) | The candidate's own gates are red, so 0.3.7 cannot be released from it. | fixed: `4a8ce3fe` (projections), `4d3a9323` (ops gate), `58e4cd86` (release check) and `platformWords.test.ts` declaring the two macOS-only login lines; iteration 3 reviews a candidate whose hosted `ci` is green |
| V2-26 | PL-2 | Release close omits runbook step 11, and the iteration-1 ruling contradicts it. | fixed: the Release close requires the fabric-workspace change (RM-19, the lifecycle row, the Fabric row) before the tag, runbook step 11 |
| V2-27 | PL-3 | Two other projects' asks are neither closed nor in Release close. | fixed: the Release close carries the FD-12 post to fabric-dashboards and the answer to fabric-workspace's SD-3 / MA-06 ask |
| V2-28 | PL-4 | P-20 is the 0.3.8 release row but leaves out 0.3.8 work its own sources name. | fixed: with DO-8 |
| V2-29 | PL-5 | CO-291 still says it lands in 0.3.7. | fixed: with DO-8 |
| V2-30 | PL-6 | The operator-feedback table, which owns OF status "until each item's scenario or carry-over row takes it over", is stale for two rows. | fixed: OF-13 partially done with its remainder CO-331; OF-08 points at the Release close |
| V2-31 | PL-7 | The newest handoff sends the next agent to work that is no longer 0.3.7's. | fixed: `docs/handoffs/2026-10-20-release-037.md` names the release gate as the next task |

Exit for iteration 2: every finding is fixed or ruled to a register row. Blocking findings open: none.

## Iteration 3

Five fresh reviewers, 2026-10-20 to 2026-10-21. They started on `16405bcd`; the session limit stopped them at 15:20
UTC, and they finished on `ffe27fb3` (`ffe27fb3c1ff766a65f14152e3d1c1b2cccc1c4c`) after reading its delta: hosted `ci`
on `16405bcd` failed on stale mockup previews (fixed in `c2681cd1`), and on `c2681cd1` on the list-read rule, a
hand-written chunked `.in` from iteration 1's DA-7 fix (fixed in `ffe27fb3` by `selectIn` with per-chunk equalities).
Hosted `ci` on `ffe27fb3` passed (run 39445895894, the `fast` job; `full` is skipped on push by policy), and its
complete local `ci.sh fast` exit 0 on 2026-10-20. Migration 116's database tests last ran on disposable clusters in this
iteration's data review (`run-reopen-answer-db`, `run-function-privileges-db`, an 89 → 94 catalog comparison). Reports:
[UX](../reviews/0.3.7/iteration-3/2026-10-20-ux.md), [errors](../reviews/0.3.7/iteration-3/2026-10-20-errors.md),
[documents](../reviews/0.3.7/iteration-3/2026-10-20-docs.md), [data](../reviews/0.3.7/iteration-3/2026-10-20-data.md),
[plan](../reviews/0.3.7/iteration-3/2026-10-20-plan.md).

9 findings, 1 blocking (UX-1: iteration 2's `already_attested` sentence never reached the person). Its fix and the two
CHANGELOG corrections are the final candidate `2d6169a0` (`2d6169a08f20b5fe684d453fde1d062cd9596a1d`), a one-line code change with its watched test on
top of the reviewed `ffe27fb3`.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V3-1 | UX-1 (blocking) | Iteration-2 V2-4 (UX-4) is recorded as fixed and is not | fixed: `launch/actWords.ts` WHY lists `already_attested`; `actWords.test.ts` "says every act.why sentence…" (watched failing with the code removed) in the final candidate |
| V3-2 | DO-1 | The release handoff's decision line lists the deferred findings as "CO-340 to CO-348 and CO-352 to CO-354"; iteration 2 also deferred CO-355 to CO-358 | fixed: the handoff names CO-340 to CO-348 and CO-352 to CO-358 |
| V3-3 | DO-2 | SCN-169 quotes the non-undoable reason as «Выпуск уже опубликован», then a dash (U+2014), then «его можно только заменить новым»; the app says «выпуск | ruled: 0.3.8 with SCN-168 to SCN-171 (P-20): the scenario's quoted reason is aligned when История is rebuilt; the app's string is the one shown |
| V3-4 | DO-3 | The CHANGELOG's per-project session limit omits the second bound: a binding is also capped at 64 live sessions across all projects, so past 64 session | fixed: CHANGELOG states the 64-session cap per coding agent |
| V3-5 | DO-4 | The Codex console bullet says the same exception twice and starts a clause with a capital after a semicolon ("…instead of an empty copy; A Codex conso | fixed: CHANGELOG's Codex console line reads once |
| V3-6 | PL-1 | V2-25 was recorded as fixed on a commit whose hosted `ci` was red; the candidate needed two more commits that the ledger does not name. | fixed: this section names `c2681cd1` and `ffe27fb3`, the hosted `ci` of each, and where migration 116's database tests last ran |
| V3-7 | PL-2 | The handoff's next task is incomplete for the state it hands over. | fixed: the handoff names CO-355 to CO-358 and that `main` lands by a merge keeping the verified commit an ancestor |
| V3-8 | PL-3 | A 0.3.8 deferral and several later cross-project asks have no register home. | ruled: filed as rows in the first 0.3.8 commit (P-20): FAA-26/27/29 and the later cross-project asks; registers do not change after the verified commit |
| V3-9 | PL-4 | Three reserved carry-over ids are unaccounted for. | not a defect: CO-349 to CO-351 were taken by the id counter for another run of this session and are unused; the Next free ID note is corrected with the 0.3.8 rows |

Exit for iteration 3: 9 findings dispositioned; the final candidate `2d6169a08f20b5fe684d453fde1d062cd9596a1d` is `verifiedCommit`. Blocking findings open: none.

## Release close

Owed by this release to other projects and to the operator, each closed with its evidence when 0.3.7 is published:

| What | Where | Evidence that closes it |
|---|---|---|
| The publish time (UTC) for FAB-H01 and PLAT-019 | board thread `0cc62467` | the GitHub release's `published_at`, posted |
| CO-322 delivered (login item), the updater 0.4.0 (P-12), the knowledge base's RM-19 and lifecycle row | board thread `cb31a510` | the post; fabric-workspace flips the row |
| Observatory's live check of `fabric.project.resolve` (engine PR #309, OBS-160) | Observatory | its answer on the installed 0.3.7 |
| DEC-0092's `pending` shape shipped; Switchboard SB-141 | board thread `617c8cbe` | the post naming the tool and the shape |
| CT-26 closes when 0.3.7 is released | fabric-agent-contract | the post on the release |
| OF-08 measured on the installed build | this ledger | the measurement |
| The fabric-workspace change before the tag (runbook step 11): RM-19 and the lifecycle row (login item shipped, updater 0.4.0), the Fabric row at 0.3.7 | fabric-workspace PR | the merged PR |
| FD-12 moved to 0.4.0 (CO-344) | fabric-dashboards, board | the post |
| The attribution capability's name for the knowledge page, and SD-3 / MA-06's row | fabric-workspace, board | the answer posted |
| The workspace publication after the release commit | `node scripts/workspace.mjs publish` | `check --require-child` exit 0 |

### Release close: state on 2026-10-21

- **Published.** Tag `v0.3.7` on `cdc61fb2` (the release commit `facb2455`, the workspace-pin merge `13d2f911`, the
  receipt word fix `cdc61fb2`); preflight `release-mac.mjs --check-only --tag v0.3.7`: "is on origin/main and its
  release gate is clear". Release run 39516315609: preflight, guard, macOS, Windows x64 and arm64, Linux x64 and arm64,
  publish all green. GitHub release published 2026-10-21 00:05:18 UTC, prerelease, 14 assets.
- **Installed on the operator's Mac.** `Fabric-0.3.7-universal.dmg` checksum OK against `SHA256SUMS`; `codesign
  --verify --deep --strict` OK; `spctl`: Notarized Developer ID. The first start refused schema 89 and copied its
  migrations; backup `~/Library/Application Support/Fabric/backups/pre-0.3.7.dump` (custom format, `pg_restore --list`
  1671 entries); `supabase migration up --local` applied 112 to 116; `schema_version()` 94, journal 11 208 events before
  and after, the estate-path unique index present. 0.3.7 runs (`ipc.work:home` ok, 2026-10-21 00:15 UTC). The separate
  disposable-stack rehearsal (runbook step 3) was not run: free disk was under 2 GB and a second stack had crashed
  OrbStack twice that day; the SQL chain 89 → 94 was proven on disposable clusters by this ledger's data reviews.
- **Board.** Publish time on `0cc62467` (FAB-H01, PLAT-019); CO-322 part 1 and the updater's 0.4.0 on `cb31a510`;
  `fabric.project.resolve` and DEC-0092 on `617c8cbe` (Observatory's live check, Switchboard SB-141, CT-26, CT-63);
  the release and FD-12's move (CO-344) to every project on `bb87af23`, `8448237d`, `0f5d0589`.
- **Knowledge base.** fabric-workspace PR #321 (`508e6921`) before the tag: RM-19 and the lifecycle row.
- **The tester.** The testers' brief ([`docs/launch/testers-brief.md`](../../launch/testers-brief.md)) and a short note
  sent to the tester in Telegram on the operator's instruction (2026-10-21).
- **Open.** OF-08 (agents at work shown silent) is measured on the installed 0.3.7 in 0.3.8's first session; the
  workspace publication follows with the scheduled sync.
