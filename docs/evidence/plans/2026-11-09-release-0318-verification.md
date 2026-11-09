# Fabric 0.3.18 release verification

Release gate ledger for 0.3.18 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under
`docs/evidence/reviews/0.3.18/`.

0.3.18 carries the board as a service launchd keeps ([ADR-0192](../../adr/0192-the-board-is-a-service-launchd-keeps.md);
[the brief and the design](2026-11-08-0318-board-always-on/design.md), task `296b88c5`) and what landed since 0.3.17.

## Protocol

- Baseline: tag `v0.3.17`. The reviewers read one clean detached checkout of the candidate, write nothing in it and
  record HEAD and `git status --short | wc -l` before and after.
- Tests are run by file on the twin worktree at the same commit, under `nice -n 10`, one run at a time.
- The review copies are redacted for publication (ADR-0096): home paths are `/Users/example`, private names replaced.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- Machine load on 2026-11-09 ran from 30 to 250 on 14 cores; a timing test that fails under that load and passes alone
  is recorded as such, never as a pass, and the hosted CI on the candidate is the tier's verdict.
- The push run of `ci` runs the fast tier only; each iteration names its candidate's run.

## What 0.3.18 carries

No schema step: the database stays at schema 100 (the newest migration is still `20261030000127`, 0.3.17's;
`git diff --stat v0.3.17..HEAD -- supabase/` is empty). The `## Unreleased` section of
[`CHANGELOG.md`](../../../CHANGELOG.md) names every person-visible change since 0.3.17: the board as a service launchd
keeps on macOS, with «Служба доски» in Settings and a Quit that only hides (ADR-0192); «Перезапустить Fabric»
(ADR-0192); reviews older than three days accepted by default, said in the task's history (CO-537); «Направления
работы» on the project and agent pages (CO-543, SCN-181); the agent's page saying what the agent does now (CO-542);
the session card and «Написать агенту» keeping up (CO-544); the dispatcher's backoff (CO-544); a refused reply no
longer logged as a wall error (CO-541); the Docker ping out of the main thread (CO-536). Windows and Linux are
unchanged apart from the restart item.

The candidates sit on the working branch `release/0318`, each landed on `main` by fast-forward.

## Owed in 0.3.18's Release close

In this order (it answers iteration 1, PL-9 and PL-11; CO-549 holds what is decided here):

1. The release commit, after `verifiedCommit` (the iteration-3 candidate): `version` 0.3.18 in
   `apps/desktop/package.json`; `## 0.3.18` finalized from `## Unreleased` in `CHANGELOG.md`;
   `docs/launch/release-gate.json` naming 0.3.18, this ledger, `verifiedCommit` and the 15 review receipts (three
   iterations of five); `releaseMetadata` naming the 0.3.18 handoff.
2. The tag and the release run (macos, windows, linux, publish); its SMOKE receipts read for Windows and Linux (PL-14);
   the nightly Windows failures in `listener-owner` and `peer-account` ruled or fixed.
3. Before the install on the operator's Mac: the counts of reviews waiting are recorded here (the first sweep accepts
   every review older than three days, irreversibly; PL-15), and the board's outage window is announced on the project
   board.
4. The published DMG installed over 0.3.17 through the lifecycle broker; the system's agent-service state read (the
   Settings line and `launchctl print gui/<uid>/ai.passioncode.desktop.board`), and 0.3.17's login item read as gone
   only after the service read enabled.
5. N6, each a receipt in `docs/evidence/plans/2026-11-08-0318-board-always-on/`:
   1. Quit hides and the board answers (`hub.json`'s pid alive, `GET /.well-known/fabric-service` 200).
   2. The main process killed with SIGKILL comes back under launchd within a minute (the job's pid changes).
   3. SIGTERM ends it (PL-3) and launchd does not start it again.
   4. With the switch off, Quit ends it, observed with a live terminal session open (PL-8).
   5. A logout or a restart is not cancelled (PL-7), or recorded unproven with its owner.
6. Then the Docker-stopped start check and `chat-activation-native` (both carried from 0.3.17), the latter with its own
   `--user-data-dir`, now that such a start leaves the service alone (PL-4).
7. Rollback, if N6 fails: turn the switch off in Settings (or
   `launchctl bootout gui/<uid>/ai.passioncode.desktop.board`), quit, install the 0.3.17 DMG, turn launch at login on
   again there; the hub returns with the app.

## Iteration 1

Candidate `8503abbb19b5d99050cbbb9ca92824703ca68a38` (hosted `ci` 42656913216 on `main`, green; 42655109395 on
`release/0318`, green). Five reviewers, one per level; their reports and receipts are in
`docs/evidence/reviews/0.3.18/iteration-1/`. 56 findings, 14 blocking (UX-1 to UX-3, ER-1 to ER-4, DO-1, PL-1, PL-3,
PL-4, PL-5, PL-6, PL-9; UX-1, ER-1, DO-1, PL-1 and DA-1 are one defect, the plist absent from the repository). The fix
wave is `8c7e5469`, `b39f11de`, `cb31e0d6`, `565a554c`, `579fa74e`, `71c844cf`, `7b58a79c`, `f4a92667` and
`e4766665` on `release/0318`.

Text check reports of the strings the fix wave changed, no blocking findings: en `b6d0632c`, `c805fab1`, `97831fdf`,
`68330c51`, `52f5d4ca`, `f6b929a0`, `8ea829f2`, `0d79aed3`, `c5bd918d`, `5b3b9ead`, `d5a70389`, `f324c493`,
`67b8c4ce`; ru `6477c5ad`, `5782d232`, `1a175bdd`, `32cc5e77`, `b196a755`, `23cf941a`, `2e08aac4`, `caebf3fe`,
`81ead897`, `263f963c`, `24e267ce`, `6545480b`, `43e445d7`.

One redaction in the committed reports: the docs report's DO-10 proposed fix named the text-check tool; it reads "the
text check" (the rest of every report is as written).

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V1-1 | UX-1 | blocking | the board's launch agent plist was not in the repository, so no build carried the service and Settings blamed the person; the 0.3.17 login item was removed whatever the registration's outcome | fixed: the plist is source (`apps/desktop/build/launchd/ai.passioncode.desktop.board.plist`, a `.gitignore` exception) in 8c7e5469; 0.3.17's `mainAppService` item goes only once the agent service reads back enabled (`shared/loginItem.ts#legacyLoginItemAction`) in b39f11de, test `loginItem.test.ts` «PL-5, ER-3: 0.3.17's login item goes only once the service reads back enabled, or when the person turned it off»; the packaging check as V1-33; the packaged proof is N6 of the Release close |
| V1-2 | UX-2 | blocking | a review accepted by default was said in the notes and SCN-179 to say so in its history; the history read «задача закрыта», the person's own words | fixed in 565a554c: a `task.closed@1` by `system/review-default` reads its own sentence in the task page's history, История and Пульс (`i18n#describeFeedEvent`, `shared/board.ts#REVIEW_DEFAULT_ACTOR`); test `Feed.test.tsx` «a review accepted by default says so in the history», watched failing on the old Feed |
| V1-3 | UX-3 | blocking | with the service on, the advice «закройте и снова откройте Fabric» hid the windows and restarted nothing | fixed in b39f11de with f4a92667: «Перезапустить Fabric» / "Restart Fabric" above Quit ends the process past the hold and starts Fabric again, through `launchctl kickstart` while launchd keeps the service, else `app.relaunch` (`shared/loginItem.ts#restartPlan`, `main/restartFabric.ts`); the advice names it (`stack.health.stopped`, `access.hub.off.*`, `diagnostics.exposure.orbstackAfter`); tests `test/restart-fabric.test.mjs`, `test/menu.test.mjs`, `loginItem.test.ts` «UX-3» |
| V1-4 | UX-4 | non-blocking | the service note named a menu item that does not exist, sent the person to a Dock icon a held quit hides, and did not say how to stop Fabric | fixed in 579fa74e: `settings.boardServiceNote` names «Завершить Fabric» / Quit Fabric, says the Dock icon goes with the windows, where to open Fabric again (Launchpad, Spotlight, Applications) and how to stop it completely (the switch off, then Quit) (`i18n/ru.ts`, `i18n/en.ts`); the notes in e4766665 |
| V1-5 | UX-5 | non-blocking | «Направления работы» said the tasks were unread and then that the week was quiet | fixed in 579fa74e: unread tasks are said and the panel no longer adds «quiet» (`launch/WorkDirections.tsx#ProjectDirections`); test `ProjectLaunch.test.tsx` «UX-5: tasks that cannot be read are said, and the panel never adds that the week was quiet», watched failing |
| V1-6 | UX-6 | non-blocking | a task card named its agent by the machine id | fixed in 579fa74e: the card names the runner by `runnerLabel`, as every other card (`launch/WorkDirections.tsx#Card`); `ProjectLaunch.test.tsx` expects the display name, watched failing on «claude-code» |
| V1-7 | UX-7 | non-blocking | abandoned work lost its own mention on the project page | ruled: CO-550 |
| V1-8 | UX-8 | non-blocking | «Последнее действие» can name housekeeping that is not the agent's act | ruled: CO-550 |
| V1-9 | UX-9 | non-blocking | a review accepted by default counts as handed in on the strip, in the rhythm and in lead time | ruled: CO-550 |
| V1-10 | UX-10 | non-blocking | the notes missed macOS's background item notice; the dispatcher's ambiguous folder is said only in its log; screens.md and the testers' brief still name the old switch | fixed in part in e4766665: the notes name macOS's background item notice and its approval on the first start, and say the ambiguous folder is said in the dispatcher's log (`CHANGELOG.md`); the rest (`docs/ux/screens.md`, `docs/launch/testers-brief.md`) ruled: CO-550 |
| V1-11 | UX-11 | non-blocking | small wording points in the service line, the agent page, «Написать агенту» and the system lines | fixed in 579fa74e: «Fabric всегда работает в фоне»; the darwin off and approval lines say the service also does not start Fabric again after a crash; `say.unreadable` no longer speaks of lines never shown; "Working without a claimed task." (`i18n/ru.ts`, `i18n/en.ts`) |
| V1-12 | ER-1 | blocking | the launch agent's plist was not in the candidate; a release build ships no service and the board ends with the process | fixed in 8c7e5469 (the plist is source) with cb31e0d6's packaging check: afterPack refuses every packed macOS app, each architecture's and the joined one, without the plist or whose plist names another job or a program the app lacks (`scripts/lib/board-service.mjs`, `scripts/after-pack-universal.mjs`); tests `scripts/test/board-service.test.mjs`, `test/board-launch-agent.test.mjs`, both run in `scripts/ci.sh` |
| V1-13 | ER-2 | blocking | the quit hold read only the stored switch, not whether launchd keeps the service | fixed in b39f11de: a quit hides only while macOS reads the agent service back as enabled (`shared/loginItem.ts#quitHolds`); test `loginItem.test.ts` «PL-5, ER-2: a quit hides only while macOS reads the service back as enabled, not on the stored wish alone» |
| V1-14 | ER-3 | blocking | the 0.3.17 `mainAppService` login item was removed whether or not the agent service registered | fixed in b39f11de: `shared/loginItem.ts#legacyLoginItemAction` removes it only once the service reads back enabled, or when the person turned it off; test `loginItem.test.ts` «PL-5, ER-3» |
| V1-15 | ER-4 | blocking | a start that failed past the runtime's ready point could no longer be quit | fixed in b39f11de: the Quit of a failed or unfinished start is never held, and under launchd a failed start ends 0 so KeepAlive does not bring the dialog back (`shared/loginItem.ts#quitHolds`, `#startFailureExitCode`); tests `loginItem.test.ts` «ER-4: the Quit of a start that failed, or of a start not finished, ends the process» and «ER-4: a failed start under launchd ends 0» |
| V1-16 | ER-5 | non-blocking | SIGTERM was held like the person's Quit | fixed in b39f11de (as PL-3): SIGTERM, SIGHUP and SIGINT mark the quit as a signal's and quit again, within LC-01's deadline; tests `test/quit.test.mjs` «PL-3: a signal after a held quit ends Fabric within the drain, though the service is on», `loginItem.test.ts` «PL-3» |
| V1-17 | ER-6 | non-blocking | the crash restart covered only an instance launchd started; a background second start could raise the window | fixed in part in b39f11de: a `--background` second instance never raises the running window (`shared/loginItem.ts#secondInstanceShows`; test `loginItem.test.ts` «ER-6: a background start of another copy never raises the running window; a person's open does»), and with cb31e0d6 launchd's losing copy ends 75 and is tried again once a minute; the rest (the proof on the packaged build) ruled: CO-549 |
| V1-18 | ER-7 | non-blocking | a held quit hides the Dock icon while an editor that refused to close stays on screen | ruled: CO-549 |
| V1-19 | ER-8 | non-blocking | `systemEnding` was never cleared, so a cancelled logout made every later Quit end Fabric | fixed in b39f11de: cleared when the process still lives a minute later (`main/index.ts`, `SYSTEM_ENDING_MS`); the wiring has no unit test, and the system-end case is N6 (e) of the Release close |
| V1-20 | ER-9 | non-blocking | CO-541 silences every `board_get` error, not only the reply's own refusal | ruled: CO-550 |
| V1-21 | ER-10 | non-blocking | request states read without order or limit under the 1 000-row cap | ruled: CO-550 |
| V1-22 | ER-11 | non-blocking | the default accept checks, then appends, with no status guard in the projector | ruled: CO-550 |
| V1-23 | ER-12 | non-blocking | the Docker probe's child start can exceed its 3 s bound under load | ruled: CO-550 |
| V1-24 | DA-1 | non-blocking | as ER-1, from the data level | fixed: as V1-12 |
| V1-25 | DA-2 | non-blocking | CO-537's irreversible closes were not counted in the sweep's receipt | fixed in 71c844cf: `work.swept@1` carries `acceptedByDefault` when a sweep accepted any, and a sweep that did nothing else still writes its receipt (`main/abandonedSweepRun.ts`); test `abandoned-sweep-run.test.mjs` «DA-2 (0.3.18 review)», watched failing |
| V1-26 | DA-3 | non-blocking | as ER-11 | ruled: CO-550 |
| V1-27 | DA-4 | non-blocking | «Из бэклога» can misfile past its cap, unsaid | ruled: CO-550 |
| V1-28 | DA-5 | non-blocking | the 30-day request window is not said | ruled: CO-550 |
| V1-29 | DA-6 | non-blocking | as ER-10 | ruled: CO-550 |
| V1-30 | DA-7 | non-blocking | the request reads scan the journal without an index | ruled: CO-550 |
| V1-31 | DA-8 | non-blocking | a persistent `task_sources` failure wrote a log line on every read | fixed in 71c844cf: one line when the failure starts or changes and one when it recovers (`main/workRead.ts#readSessionTasks`); test `work-read-views.test.mjs` «DA-8 (0.3.18 review)», watched failing |
| V1-32 | PL-1 | blocking | N1 not done: the plist was not in the repository and its guarding test did not run on push | fixed: the plist is source in 8c7e5469; `board-launch-agent.test.mjs` and the new `board-service.test.mjs` run in `scripts/ci.sh` in cb31e0d6 |
| V1-33 | PL-2 | non-blocking | nothing checked the built universal bundle for the plist | fixed in cb31e0d6: afterPack checks each architecture's app and the joined one (`scripts/after-pack-universal.mjs`, `scripts/lib/board-service.mjs`); the release config read through electron-builder's own loader keeps the base `mac.extraFiles`; test `board-launch-agent.test.mjs` «PL-2: the release config keeps the base config's extraFiles» |
| V1-34 | PL-3 | blocking | SIGTERM was held like the person's Quit | fixed: as V1-16 |
| V1-35 | PL-4 | blocking | any second Fabric with its own userData rewrote the machine-wide service | fixed in b39f11de: only the Fabric on the operator's own data folder (no `--user-data-dir` in any spelling, no SMOKE) registers, removes or holds for the service (`shared/loginItem.ts#ownsBoardService`); tests `loginItem.test.ts` «PL-4: the operator's own Fabric owns it» and «PL-4: a Fabric on another data folder, or a smoke run, never holds» |
| V1-36 | PL-5 | blocking | the move from `mainAppService` to `agentService` was not safe | fixed: as V1-13 and V1-14 |
| V1-37 | PL-6 | blocking | N6's kill-and-return could not prove REQ-1: launchd's copy lost the lock and exited 0 | fixed in b39f11de with cb31e0d6: launchd's copy that loses the single-instance lock ends 75 (`shared/loginItem.ts#LAUNCHD_RETRY_EXIT`, `#secondInstanceExitCode`) and the plist's `ThrottleInterval` 60 has launchd try again once a minute, taking the board over when the person's copy ends; tests `loginItem.test.ts` «PL-6: launchd's copy that loses the lock ends non-zero», `board-launch-agent.test.mjs` «PL-6: launchd tries a copy that lost the single-instance lock again once a minute»; N6 (b) proves it on the packaged build |
| V1-38 | PL-7 | non-blocking | a logout or restart relies on an unmeasured event order | ruled: CO-549 (N6 (e)) |
| V1-39 | PL-8 | non-blocking | what turning the switch off does is stated two ways | ruled: CO-549 (N6 (d)) |
| V1-40 | PL-9 | blocking | the close had no written order and no rollback | fixed by this ledger: *Owed in 0.3.18's Release close* writes the order (the release commit, the tag and its run, what is recorded before install, the install through the broker, N6 case by case, the carried checks) and the rollback |
| V1-41 | PL-10 | non-blocking | the runbook's install and stop assumed Quit stops Fabric | fixed in 7b58a79c: `docs/launch/release-mac.md` gains 0.3.18's paragraph (schema 100, how to stop the service for an install, macOS's background item notice, going back to 0.3.17), and step 1 and the move order turn the service off first |
| V1-42 | PL-11 | non-blocking | the gate items the release commit owes | fixed by this ledger: *Owed in 0.3.18's Release close*, item 1; the notes say macOS may ask once to allow Fabric in Login Items (e4766665) |
| V1-43 | PL-12 | non-blocking | rows targeted at 0.3.18 were not settled | fixed by this ledger: CO-538, CO-539 and CO-548 retargeted after 0.3.18; the remainders of CO-543 and CO-544 carried by CO-550 (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`) |
| V1-44 | PL-13 | non-blocking | REQ-4 half built; no node verification record | ruled: CO-549 |
| V1-45 | PL-14 | non-blocking | Windows and Linux carry the new code through unit tests only; the Windows nightly is red | ruled: CO-549 (the release run's SMOKE receipts read, the two nightly tests ruled or fixed) |
| V1-46 | PL-15 | non-blocking | the rollout's risks on the operator's Mac | ruled: CO-549 (the review counts recorded and the outage announced before install) |
| V1-47 | DO-1 | blocking | as ER-1, from the docs level: every shipped claim of the service was false | fixed: as V1-12 |
| V1-48 | DO-2 | non-blocking | the Fabric.app row's «Stopped by» did not say Quit is held | fixed in 7b58a79c: the row says which quits hide and which end Fabric (signals, logout, «Перезапустить Fabric», a failed start), launchd's retry and how to stop Fabric completely (`AGENTS.md`) |
| V1-49 | DO-3 | non-blocking | the sweep's row did not name the default accept | fixed in 7b58a79c: the sweep row names the review read, the default accept (CO-537) and the receipt's `acceptedByDefault` (`AGENTS.md`) |
| V1-50 | DO-4 | non-blocking | the agent page row missed the 15 s tick and the new reads | fixed in 7b58a79c: the row names the 15 s tick, the question mark, the backlog rows and the «Написать агенту» lines (`AGENTS.md`) |
| V1-51 | DO-5 | non-blocking | the project page's directions reading had no lifecycle row | fixed in 7b58a79c: a row for it (requests both ways, 30 days, 200 each; backlog rows, 1 000) (`AGENTS.md`) |
| V1-52 | DO-6 | non-blocking | the general plan said 0.3.17's rollout still waited | fixed by this ledger: P-31's status and the Now line say it was rolled out on 2026-11-08, read 21:45 UTC (`docs/evidence/backlog.md`) |
| V1-53 | DO-7 | non-blocking | SCN-181 traced SCR-39, a screen no longer drawn; no screen listed SCN-181 | fixed by this ledger: SCN-181 traces SCR-87 in its index row, its Traces and its UI elements; SCR-31 and SCR-87 list SCN-181 (`docs/ux/scenarios.md`, `docs/ux/screens.md`); `docs/ux/lint.py` through `scripts/check-docs.sh` |
| V1-54 | DO-8 | non-blocking | CO-322 still described macOS launch at login as the app service | fixed in 7b58a79c: CO-322 gains a dated note pointing at ADR-0192 and the agent service (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md`) |
| V1-55 | DO-9 | non-blocking | the map's new entries point only to the previous entry | ruled: CO-550 |
| V1-56 | DO-10 | non-blocking | the note sent the person to a Dock icon a held quit hides | fixed: as V1-4 |

Exit for iteration 1: every finding has a disposition. Blocking findings open: none.
