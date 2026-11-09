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

In this order (it answers iteration 1, PL-9 and PL-11, and iteration 2, PL-16, PL-17, PL-19, PL-20, PL-24 and PL-25;
CO-549 holds what is decided here). Nothing is published before item 7.

1. **The release commit**, after `verifiedCommit` (the iteration-3 candidate), landed on `main` by fast-forward:
   `version` 0.3.18 in `apps/desktop/package.json`; `## 0.3.18` finalized from `## Unreleased` in `CHANGELOG.md`,
   with an **Upgrading.** line as 0.3.17's carries (no schema step, schema 100; going back is «Служба доски» off in
   0.3.18 first, then launch at login on again in 0.3.17); `docs/launch/release-gate.json` naming 0.3.18, this ledger,
   `verifiedCommit` and the 15 review receipts, three iterations of five whose candidates are distinct and in order
   (`8503abbb`, `e4766665`, then iteration 3's, equal to `verifiedCommit`; `scripts/lib/release-gate.mjs` refuses a
   candidate named twice); `releaseMetadata` naming the 0.3.18 handoff under `docs/handoffs/`, written in the same
   commit. Before the rc tag, a green `ci.sh full` or a green full nightly `ci.yml` on `verifiedCommit` is recorded
   here, saying which one and its run (the push run is the fast tier only; the last full nightly, 42546389981 on
   `22a4f54a`, failed), or each red test is named with its ruling; the nightly Windows failures in `listener-owner` and
   `peer-account` are ruled or fixed.
2. **A release candidate first.** An annotated `v0.3.18-rc.1` on the release commit. The push trigger takes only
   `v[0-9]+.[0-9]+.[0-9]+` (`.github/workflows/release.yml`, line 19), so the rc tag starts nothing by itself; then
   `gh workflow run release.yml --ref v0.3.18-rc.1 -f publish=false` (the rehearsal of lines 12 to 13; the `publish`
   input, lines 22 to 25, defaults to false and reaches the guard at line 49 and the publish job at line 274). The
   preflight accepts the tag (`scripts/lib/release-mac.mjs#tagProblem`: `v0.3.18` or `v0.3.18-rc.N`) and still checks
   the release gate. The signed, notarized, attested set is kept as the workflow artifact `signed-release-v0.3.18-rc.1`
   for 14 days and no release is created ([the runbook's *Rehearsal*](../../launch/release-mac.md#rehearsal)). Its
   Windows and Linux SMOKE receipts (`fabric-0.3.18-windows-<arch>.json` from the installed start at line 189, the
   Linux one at line 250) are read here (PL-14). The rc DMG's SHA-256 and signer are written beside every N6 receipt.
   If any item below fails, nothing was published: the fix is a new candidate, the gate's next iteration and
   `v0.3.18-rc.2`.
3. **Before the install on the operator's Mac.** The board's outage window is announced on the project board, with
   each step's expected outage and the count of live Fabric-hosted sessions (`work.home`). The counts of reviews waiting
   are recorded here (the first sweep accepts every review older than three days, irreversibly; PL-15). The lifecycle
   broker's `fabric.desktop` is held as owner (`lifecycle.py hold --target-id fabric.desktop`), so `always_on` does not
   start the old bundle again during the swap; the running 0.3.17 was started by the person, so a non-owner stop is
   refused (`not_started_by_broker`) and the owner's stop is the route (PL-19). Every terminal session Fabric hosts ends
   at the install and at each kill below: the agent driving the close runs outside Fabric's terminals, with a watcher
   that survives Fabric's restarts (PL-25).
4. **Install the rc build** under the hold: stop 0.3.17 as owner, keep its bundle aside as the way back, swap in the
   rc's `Fabric.app`, start it. Read the Settings line and `launchctl print gui/<uid>/ai.passioncode.desktop.board`,
   and read 0.3.17's login item as gone only after the service read enabled (`shared/loginItem.ts#legacyLoginItemAction`).
   If macOS answers `requires-approval` (Settings shows the approval line), that is a human gate: the person allows
   Fabric in System Settings, General, Login Items and Extensions. It is recorded once with that path, N6 waits for it,
   and the steps that do not need it go on.
5. **N6 on the rc build**, each case a receipt in `docs/evidence/plans/2026-11-08-0318-board-always-on/` that cites the
   authority for its direct signal (the machine's rule otherwise leaves an enrolled app to the broker). With the broker
   held, first wait until launchd's copy is the running one: `launchctl print gui/<uid>/ai.passioncode.desktop.board`
   reads `state = running` and its `pid` equals `hub.json`'s. Kills are spaced more than 60 s apart, so neither the
   broker's pause after two deaths within a minute of a start nor launchd's throttle decides a case.
   1. Quit hides and the board answers (`hub.json`'s pid alive, `GET /.well-known/fabric-service` 200).
   2. SIGKILL: the time until a new pid, from `launchctl print` (`pid`, `runs`, `last exit reason`) and the ops log's
      `app.started`, against REQ-1's 10 s ([the brief](2026-11-08-0318-board-always-on/brief.md#req-spine-ask-1), REQ-1).
      launchd starts a `KeepAlive` job again at once when it ran longer than its `ThrottleInterval` (launchd.plist(5));
      the property list's 60 s spaces launchd's starts, which bounds the losing copy's retry, not this return. The
      measured time is recorded, and REQ-1's bound or this item's wording is reconciled in the receipt with the reason.
   3. SIGTERM ends it with exit 0 (`last exit code = 0`) and launchd does not start it again: no new pid for two
      minutes, with and without a live terminal session.
   4. With the switch off, Quit ends it, observed with a live terminal session open (PL-8).
   5. A logout or a restart is not cancelled (PL-7), or recorded unproven with its owner.
   6. While a copy not started by launchd holds the lock, for five minutes: `launchctl print` every minute (`runs`,
      `last exit code = 75`), one losing copy's CPU time, whether it shows in the Dock (a screen recording), the
      broker's `lifecycle.status` every 10 s and its log for `circuit_open` (ER-14, PL-18). The hand-over question of
      ADR-0192 amendment 1, rule 5, is decided in CO-549 from this measurement.
6. **Then the Docker-stopped start check and `chat-activation-native`** (both carried from 0.3.17), the latter with its
   own `--user-data-dir`, now that such a start leaves the service alone (PL-4).
7. **Only after N6 passes**: push `v0.3.18` on the same commit; the release run builds, signs and publishes; read the
   published DMG's SHA-256 and signer back (that run builds again, so its bytes are not the rc's); install it in place
   of the rc build under the same hold; release the broker's hold; then the website, the workspace and the knowledge
   base as the runbook's steps 9 to 11 say.
8. **Rollback** (PL-20), in this order: in 0.3.18 turn «Служба доски» off (it unregisters the agent service and
   writes `launchAtLogin: false`, the key 0.3.17 reads) and read Settings' off line and no job in `launchctl print`;
   hold the broker; quit; swap in the 0.3.17 bundle; start it; turn «Запускать Fabric при входе в систему» on in
   0.3.17's Settings; release the hold (the runbook's 0.3.18 paragraph releases it before the start; once the bundle is
   swapped either order is safe, since `always_on` can only start 0.3.17). When 0.3.18 cannot open Settings: with
   Fabric stopped, set `launchAtLogin` to `false` in `userData/settings.json`, start 0.3.18 once so it unregisters the
   service, quit it, then continue as above. `launchctl bootout` alone is an emergency stop only: it leaves the
   registration in Login Items and stops only a copy launchd started.

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

## Iteration 2

Candidate `e47666650d7f09bb6f4da241cba9fbdd2d2e51fc` (hosted `ci` 42667576218 on `release/0318`, green; 42669456523 on
`main`, green; the fast tier, as the protocol says). Five reviewers, one per level, each a fresh context on a clean
detached checkout of the candidate (HEAD and `git status --short | wc -l` read before and after, unchanged); their
reports and receipts are in `docs/evidence/reviews/0.3.18/iteration-2/`. 32 findings (UX-12 to UX-18, ER-13 to ER-17,
DA-9 to DA-11, PL-16 to PL-25, DO-11 to DO-17), 4 blocking: ER-13, DA-9, PL-16 and PL-17. DA-11 is part of ER-14 (the
losing copy's editor sweep); UX-12 and DO-14 one, the hub's last quit-and-reopen reason; UX-13 and DO-12
one; UX-16 and DO-16 one; ER-16 and PL-21 one. The fix wave is `0aaa0f95`, `62f24bf4`, `1c3b1e6f`, `f954f141`,
`5fe73120`, `c4dbc7b4`, `e16ad277`, `9ea777b3` and `bba86bce` on `release/0318`, with this ledger.

Text check reports of the strings the fix wave changed, no blocking findings: the restart question `ed7ceb48`,
`10d746b6`, `9d358d2b`, `c7c7c5db`, `9f076bbe`, `4366a333`, `add56f0e`, `280c75fd`, `ccb7053b`, `8491e56a`,
`7dc27517`; the restart advice `ec2ae402`, `496b444c`, `a3b54c57`, `42f4268f`, `9a296641`, `493c669a`, `e198b011`,
`488d2375`, `28e0e68d`, `f5f1f396`, `1e70db87`, `3a748509`; Settings `ce891fc4`, `34057577`, `7d44850f`, `2b094003`,
`08e2ce4a`, `92628918`, `35763872`, `971de3f4`, `0a975cbc`, `9bb11f22`; the notes `7062f8af`, `987fc7ba`.

The committed reports are as written; none needed a redaction.

What the reviewers recorded of iteration 1, at this candidate:

- ux: UX-2, UX-5, UX-6 and UX-11 fixed; UX-1 fixed in source, its packaged proof CO-549's (N6); UX-3 fixed with one
  leftover, UX-12; UX-4 fixed in part, and the rest (nothing at the moment of a held quit says Fabric still runs) moves
  to CO-550; UX-7 to UX-10 (rest) ruled CO-550 and not made worse.
- errors: ER-1, ER-2, ER-3 and ER-8 fixed; ER-4 fixed in its outcome, its exit-code half moot (ER-17); ER-5 not fixed,
  reported again as ER-13 (the plan reviewer read PL-3 as fixed from the code; the errors reviewer's probe on Electron
  44 showed the listener never ran); ER-6 fixed in part with a new cost, ER-14; ER-7 and ER-9 to ER-12 ruled and not
  made worse.
- data: DA-1 and DA-8 fixed, DA-8 with a false recovery line (DA-10); DA-2 not fixed and made worse, reported as DA-9;
  DA-3 to DA-7 ruled CO-550 and not made worse.
- plan: PL-1, PL-3 and PL-5 fixed; PL-2 fixed before signing; PL-4 fixed with a new edge, PL-21; PL-6 fixed in code,
  its proof PL-17; PL-7, PL-8, PL-14 and PL-15 ruled CO-549; PL-9 and PL-11 in part (PL-16, PL-20, PL-22, PL-24);
  PL-10 fixed with a wrong rollback (PL-20); PL-12 pending at the candidate, done in `f27f2ee3` after it; PL-13 ruled
  but carried nowhere (PL-23).
- docs: DO-2 to DO-5, DO-8 and DO-10 fixed; DO-1 fixed in the tree, its live proof CO-549's; DO-6 and DO-7 not fixed
  at the candidate, done in `f27f2ee3` after it; DO-9 ruled CO-550.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V2-1 | UX-12 | non-blocking | one hub reason agents relay still said to quit and reopen Fabric, which with the service on only hides it | fixed in f954f141: the hub's not-started reason, the standby's and the surface's name the item through `shared/loginItem.ts#RESTART_ITEM_ADVICE` (`main/hub.ts`, `main/hubStandby.ts`, `main/agentSurface.ts`); test `restart-fabric.test.mjs` «UX-12: the reasons agents relay name the restart item, never quit and reopen» |
| V2-2 | UX-13 | non-blocking | the «Служба доски» note said Quit only hides Fabric in every state, also with the switch off and before macOS reads the service enabled | fixed in 5fe73120: the Quit sentence is its own line (`settings.boardServiceQuitHides`), said only while the switch is on and macOS reads the service as enabled; otherwise «Завершить Fabric» is said to end Fabric until macOS confirms the service (`settings.boardServiceQuitEnds`), and with the switch off only the off line shows (`launch/SettingsScreen.tsx#LaunchAtLoginSetting`, `i18n/ru.ts`, `i18n/en.ts`); test `SettingsScreen.test.tsx` «UX-13: says Quit only hides Fabric only while the service runs; otherwise that Quit ends it»; the Mac-only lines declared in e16ad277 (`platformWords.test.ts`) |
| V2-3 | UX-14 | non-blocking | Settings and the notes said opposite things about the time before approval, each true for one kind of Mac | fixed in 5fe73120: the login-item read carries `legacy` (0.3.17's item still registered, `shared/loginItem.ts#LoginItemState`), and on such a Mac the approval and off lines say Fabric still starts at login as before but is not started again after a crash; a fresh install keeps the old lines; the notes say the update and the fresh install apart (`CHANGELOG.md`, c4dbc7b4); test `SettingsScreen.test.tsx` «UX-14: an updated Mac that keeps the old login item is told it still starts at login, but not after a crash» |
| V2-4 | UX-15 | non-blocking | «Перезапустить Fabric» ended every agent console without a word | fixed in 1c3b1e6f: with live terminal sessions the restart asks once in a native dialog naming how many agent consoles close, Cancel the default; without them it restarts at once (`main/restartFabric.ts#restartConfirmation`, `main/index.ts`); test `restart-fabric.test.mjs` «UX-15: with live consoles the restart asks first, Cancel the default; with none it does not ask» |
| V2-5 | UX-16 | non-blocking | the scenarios did not carry the fix wave's person-visible changes: no restart item, SCN-170's hold unconditional | fixed in c4dbc7b4: SCN-170 amended (when Quit hides, the new system lines, the restart item), SCN-161 and SCN-133 name the restart in their recovery (`docs/ux/scenarios.md`); `docs/ux/product-model.json`, `docs/reports/product.html` and `completeness.html` regenerated; the previews repinned in 9ea777b3 |
| V2-6 | UX-17 | non-blocking | wording: menu items named bare in English, the restart advice not naming the item, the Russian repeating itself | fixed in f954f141 and 5fe73120: English names “Quit Fabric” and “Restart Fabric” in quotes (choose “Restart Fabric” in the menu), the Russian says «выберите в меню «Перезапустить Fabric»» (`i18n/en.ts`, `i18n/ru.ts`, `docs/brand/strings.md`); the brand lint reads a closing typographic quote as punctuation (`docs/brand/lint.py`, B024) |
| V2-7 | UX-18 | non-blocking | a signalled quit of launchd's copy that ran into the deadline exited 3, so launchd started again what the signal stopped | fixed in 62f24bf4: a signalled quit of launchd's copy that reaches the deadline ends 0, any other ends 3 (`main/quit.ts#quitDeadlineExitCode`); tests `quit.test.mjs` «UX-18: a signalled quit of launchd's copy that reaches the deadline ends 0; any other ends 3» and «UX-18: the coordinator ends at the deadline with the code it is given at that moment» |
| V2-8 | ER-13 | blocking | the signal fix did not work: Electron 44 replaces a signal listener added while the main module loads, so SIGTERM was still held with the service on | fixed in 62f24bf4: the listeners are added once Electron is ready (`main/quit.ts#listenForQuitSignals`, `#QUIT_SIGNALS`, `main/index.ts`); tests `quit.test.mjs` «ER-13: a real Electron main process whose quit the service holds still ends on SIGTERM» (a real-Electron fixture, `test/fixtures/quit-app/main.mjs`, that holds every quit unless its listener ran; listening at load, mode held-at-load, it is still alive at the bound, watched), «ER-13: the signals that end Fabric are listened for, each once» and «ER-13: index.ts listens for the signals only once Electron is ready, never at load»; N6 (c) of the Release close proves it on the release candidate's build |
| V2-9 | ER-14 | non-blocking | launchd's losing copy starts every minute while another Fabric holds the lock; each start ran the editor recovery sweep and showed as a Dock app while loading | fixed in part in 62f24bf4: the editor recovery sweep runs only in the process that won the single-instance lock (`main/index.ts`); test `background-launch.test.mjs` «the editor recovery sweep runs only in the process that won the single-instance lock»; the retry cadence, its cost and whether the losing copy flashes in the Dock ruled: CO-549, measured on the release candidate's build (*Owed in 0.3.18's Release close*, item 5) |
| V2-10 | ER-15 | non-blocking | «Перезапустить Fabric» through launchd had no observable failure and no fallback once the process was gone | fixed in 1c3b1e6f: the helper opens `ai.passioncode.desktop` by its id when launchd refuses the job and writes each refusal to the `restart-outcome` note in the data folder, which the next start records as `app.restart-kickstart` (`main/restartFabric.ts#RESTART_OUTCOME_FILE`, `#takeRestartOutcome`); its values travel as arguments; a restart note that cannot be written is recorded too; tests `restart-fabric.test.mjs` «ER-15: a kickstart that works starts the board's job and leaves no note», «ER-15: a refused kickstart opens the app by its id, and the next start reads why», «ER-15: when the open fails too, both refusals are in the note», «ER-15: the id the restart opens is the app's own», run for real with stand-ins for `launchctl` and `open` |
| V2-11 | ER-16 | non-blocking | `launchdStarted` read an inherited `XPC_SERVICE_NAME`, so terminals, agents and relaunches took themselves for launchd's copy | fixed in 62f24bf4 (as PL-21): `XPC_SERVICE_NAME` is read once at start and the board's label removed from the environment (`shared/loginItem.ts#takeLaunchdStart`); tests `loginItem.test.ts` «the 0.3.18 review, iteration 2, PL-21, ER-16: the job label stays with the process launchd started» and `background-launch.test.mjs` «launchd's job label is taken from the environment before the quit wiring and any child» |
| V2-12 | ER-17 | non-blocking | `startFailureExitCode` claimed a failed start outside launchd exits 1; Electron ends every such Quit with 0 | fixed in 62f24bf4: `startFailureExitCode` is gone and the comment says every failed-start Quit exits 0 (`shared/loginItem.ts`, `main/index.ts`); ADR-0192 amendment 1, rule 1, and the Fabric.app row of `AGENTS.md` say the same (c4dbc7b4) |
| V2-13 | DA-9 | blocking | the DA-2 fix wrote `acceptedByDefault` into a receipt the journal's ingress refuses, so every receipt carrying it was lost | fixed in 0aaa0f95: `work.swept@1`'s ingress rules carry `acceptedByDefault: optional(integer(1))` (`shared/commandIngress.ts#EVENT_FIELDS`, `shared/protocolObligations.ts`); the DA-2 test runs the receipt through `prepareEventPayload`: prepared with the count, prepared when it also told and released, rejected with a count of 0 (`abandoned-sweep-run.test.mjs` «DA-2 (0.3.18 review)»), and `commandIngress.test.ts`'s fixture carries the count |
| V2-14 | DA-10 | non-blocking | DA-8's quiet log wrote a recovery for a backlog-row read that never ran | fixed in 0aaa0f95: the line is said only after a read that ran (`main/workRead.ts#readSessionTasks`); test `work-read-views.test.mjs` «DA-8 (0.3.18 review)» extended: an agent with no tasks says neither a failure nor a recovery; the two doc comments DO-17 found misplaced are back on their symbols |
| V2-15 | DA-11 | non-blocking | each losing copy of launchd's ran the editor recovery sweep, which can remove the running copy's temporary file mid-write | fixed in 62f24bf4: as V2-9 (the sweep runs only in the process that won the lock) |
| V2-16 | PL-16 | blocking | the close order published 0.3.18 before N6, its only end-to-end proof | fixed by this ledger: *Owed in 0.3.18's Release close* item 2 runs a release candidate first (`v0.3.18-rc.1`, `gh workflow run release.yml --ref v0.3.18-rc.1 -f publish=false`, `.github/workflows/release.yml` lines 12 to 13, 19 and 22 to 25; the preflight accepts the tag, `scripts/lib/release-mac.mjs#tagProblem`), items 4 to 6 prove it on that build, and item 7 tags and publishes `v0.3.18` only after N6 passes |
| V2-17 | PL-17 | blocking | N6 (b) could not prove REQ-1: the broker's always_on answers a kill before launchd, whose job may hold no pid; (c) missed the exit code | fixed by this ledger: item 5 holds the broker as owner, waits until launchd's copy is the running one (`launchctl print` pid equal to `hub.json`'s), times the return of a SIGKILL against REQ-1's 10 s and reconciles the bound or the wording, reads SIGTERM's exit 0 and no new start, spaces the kills more than 60 s apart and cites the authority for each direct signal in its receipt |
| V2-18 | PL-18 | non-blocking | the two-supervisor steady state (a losing copy every minute while another copy holds the lock) is unmeasured | ruled: CO-549 (item 5 measures the losing copy's cadence, its cost and the Dock on the release candidate's build; ADR-0192 amendment 1, rule 5, leaves the hand-over decision to that measurement) |
| V2-19 | PL-19 | non-blocking | the install through the broker could not run as written: a non-owner stop is refused and always_on brings the old bundle back | fixed by this ledger: items 3 and 4 hold `fabric.desktop` as owner before the install, stop 0.3.17 under the hold, keep its bundle as the way back and swap; item 8 swaps back under the same hold |
| V2-20 | PL-20 | non-blocking | the rollback was not safe: the switch writes `launchAtLogin` false, bootout leaves the registration, no route when Settings cannot open, the broker restarts during the swap | fixed in c4dbc7b4 with this ledger: the runbook's 0.3.18 paragraph gives the way back to 0.3.17 in order (switch off and read back, broker hold, quit, swap, start 0.3.17, launch at login on there; with Settings unreachable, `launchAtLogin` false in the settings file and one start of 0.3.18), and bootout only as an emergency stop (`docs/launch/release-mac.md`); item 8 here |
| V2-21 | PL-21 | non-blocking | launchd's job label leaked to every child and relaunch | fixed in 62f24bf4: as V2-11 |
| V2-22 | PL-22 | non-blocking | N5 not done for the fix wave: ADR-0192 and the design still described iteration 1's mechanism | fixed in c4dbc7b4: ADR-0192 amendment 1 (dated, append-only) records the rules of both fix waves with their review ids and corrects the consequences; the design marks what was built differently; the regions `board-service-quit` and `restart-fabric` point at the amendment; all in iteration 3's candidate |
| V2-23 | PL-23 | non-blocking | PL-13's ruling reached no item: REQ-4's board notice and the node records | ruled: CO-550 (REQ-4's notice on the board when the service is off); the node records are N6's receipts in the run's folder (item 5, CO-549) |
| V2-24 | PL-24 | non-blocking | what the release commit owes beyond the gate: the changelog's Upgrading line, the release handoff, distinct candidates, a full run on `verifiedCommit` | fixed by this ledger: item 1 names the Upgrading line, the 0.3.18 handoff for `releaseMetadata`, the three distinct candidates in order with iteration 3's equal to `verifiedCommit`, and a green `ci.sh full` or full nightly on `verifiedCommit` recorded here before the rc tag |
| V2-25 | PL-25 | non-blocking | rollout risks for the agents on this Mac: every Fabric-hosted session ends at each kill, the broker's pause, macOS's approval gate | fixed by this ledger: item 3 counts and announces, and drives the close from outside Fabric's terminals with a watcher that survives Fabric's restarts; item 4 names macOS's `requires-approval` as the human gate; item 5 spaces the kills more than 60 s apart |
| V2-26 | DO-11 | non-blocking | `launchctl bootout` was documented as a way to stop Fabric; it stops only a copy launchd started | fixed in c4dbc7b4: the runbook's 0.3.18 paragraph, step 1 and the move order say bootout stops only a copy launchd started and name the switch off, then Quit (`docs/launch/release-mac.md`); the Fabric.app row of `AGENTS.md` and ADR-0192 amendment 1's consequences say the same |
| V2-27 | DO-12 | non-blocking | the Settings note and the notes said Quit only hides Fabric in every state | fixed in 5fe73120: as V2-2; the notes state the condition of the hold (`CHANGELOG.md`, c4dbc7b4) |
| V2-28 | DO-13 | non-blocking | ADR-0192 was not amended for the fix wave's rules that cite it | fixed in c4dbc7b4: as V2-22 |
| V2-29 | DO-14 | non-blocking | one hub reason still advised "Quit and reopen Fabric" | fixed in f954f141: as V2-1 |
| V2-30 | DO-15 | non-blocking | turning «Служба доски» off writes `launchAtLogin` false, the key 0.3.17 reads; the rollback, step 1 and the move order did not say so | fixed in c4dbc7b4: step 1 and the move order turn the service on again once the new build runs, and the rollback turns launch at login on in 0.3.17 (`docs/launch/release-mac.md`) |
| V2-31 | DO-16 | non-blocking | the fix wave's person-visible changes did not reach the scenarios | fixed in c4dbc7b4: as V2-5 |
| V2-32 | DO-17 | non-blocking | small inaccuracies: when 0.3.17's item goes, SIGINT missing from a comment, two misplaced doc comments | fixed: (a) the Fabric.app row of `AGENTS.md` and CO-322 say the old item goes when the switch is off or once macOS reads the service enabled (c4dbc7b4); (b) `quitHolds`' comment names SIGINT (62f24bf4, `shared/loginItem.ts`); (c) the doc comments are back above `readSessionTasks` and `SESSION_ALIASES` (0aaa0f95, `main/workRead.ts`) |

Exit for iteration 2: every finding has a disposition. Blocking findings open: none.
