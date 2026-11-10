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
`git diff --stat v0.3.17..HEAD -- supabase/` is empty). The `## 0.3.18` section of
[`CHANGELOG.md`](../../../CHANGELOG.md) names every person-visible change since 0.3.17: the board as a service launchd
keeps on macOS, with «Служба доски» in Settings and a Quit that only hides (ADR-0192); «Перезапустить Fabric»
(ADR-0192); reviews older than three days accepted by default, said in the task's history (CO-537); «Направления
работы» on the project and agent pages (CO-543, SCN-181); the agent's page saying what the agent does now (CO-542);
the session card and «Написать агенту» keeping up (CO-544); the dispatcher's backoff (CO-544); a refused reply no
longer logged as a wall error (CO-541); the Docker ping out of the main thread (CO-536); a board request with a far
deadline starting its run again (CO-554, which joined 0.3.18 on 2026-11-09: *Iteration 3*). Windows and Linux are
unchanged apart from the restart item.

The candidates `8503abbb`, `e4766665` and `bba86bce` (iteration 3's first run) were made on the working branch
`release/0318` and each landed on `main` by fast-forward; the superseded release commit `a86481ca` and the rows commit
`78772e6d` followed them on `main`. Iteration 3's final candidate `d5861ddb` is a child of `78772e6d` and goes to `main`
by fast-forward from it (PL-43); the release commit is made on `release/0318-rc2` from `d5861ddb`. Run two's candidate
`0e501425`, which `d5861ddb` replaced (an amend on the same parent, not a child), is kept under
`refs/archive/2026-11-09/fix-dispatch-packet-deadline`.

## Owed in 0.3.18's Release close

Executable in this order, each act with its actor and route. It answers iteration 1 (PL-9, PL-11), iteration 2 (PL-16,
PL-17, PL-19, PL-20, PL-24, PL-25) and iteration 3 (PL-26 to PL-34, DO-19, ER-22's measurement, and PL-35 to PL-44,
DO-23 and DO-24 of its later runs); CO-549 holds
what is decided here. The actor is the coordinator: an agent session that does not run inside a Fabric terminal (every
terminal session Fabric hosts ends at the install and at each kill), with a watcher that survives Fabric's restarts
(PL-25). The operator presses nothing; a step that needs the person's own body (macOS's Login Items approval, logging
back in) is named as a human gate once, and the steps that do not need it go on. The direct launches and signals below
are the close's own acts on the operator's delegation (2026-11-05), under an owner hold of the lifecycle broker, the
route its runbook gives for a swap; each N6 receipt cites that authority. Nothing is published before item 7.

After `verifiedCommit` (`d5861ddb`) only the release files change (PL-26): `CHANGELOG.md`, the gate, this ledger,
`docs/MERGES.md`, `docs/reports/map.html`, the review reports and receipts the gate names, the 0.3.18 handoff and the
package `version`. Iteration 3's register rulings (CO-555, filed after the release commit; the CO-549 update naming
ER-22), run two's reports and receipts (at `docs/evidence/reviews/0.3.18/iteration-3-0e501425/`, PL-42) and the N6
receipts are written on `main` after the release commit; the tags sit on the release commit, so later commits do not
touch what they name.

**Superseded, not to be used** (PL-38). The first release commit `a86481ca` (on `main`; its gate names `bba86bce`)
and `v0.3.18-rc.1` on it (run 42689818347, `workflow_dispatch` with `publish=false`, every job green, nothing
published) came before CO-554 and before item 0's full run (PL-39): rc.1 was a rehearsal of a superseded release
commit, harmless only because it was never installed or published, and it is not to be installed or published now.
`a86481ca`'s own gate is self-consistent, so `--check-only --tag v0.3.18` passes there too: `v0.3.18` and the next rc
go only on the release commit made from `d5861ddb` (item 7 checks the hash).

0. **Preflight** (coordinator, before the landing). The release commit carries `version` 0.3.18, `## 0.3.18` finalized
   with its **Upgrading.** line, the gate naming 0.3.18, this ledger, `verifiedCommit` `d5861ddb` and the 15 review
   receipts (candidates `8503abbb`, `e4766665`, `d5861ddb`, distinct and in order), and `releaseMetadata` naming the
   0.3.18 handoff, written in the same commit. `node scripts/release-mac.mjs --check-only --tag v0.3.18-rc.2` passes on
   it: the script fetches `origin/main` and refuses a HEAD not on it (`scripts/lib/release-mac.mjs#releaseCommitProblem`),
   so before the landing it runs in a disposable clone whose `origin` `main` is the release commit, which proves every
   other check, and the real run follows the landing (item 1). `node --test scripts/test/release-gate.test.mjs` passes.
   A green `bash scripts/ci.sh full` (a disposable stack) on `d5861ddb`, a green full nightly `ci.yml`, or a dispatched
   `gh workflow run ci.yml --ref <a branch at d5861ddb>`, is recorded here with its run id and the commit it ran: the
   nightly runs `main`'s tip, so it counts only when `git diff --name-only d5861ddb <its commit>` lists release files
   alone (PL-31). On `d5861ddb`: the push run 42706313170 (on `fix/dispatch-packet-deadline-3`) was queued and no full
   run had finished when the release commit was written; both results, and the full run's id, are recorded here by the
   coordinator before the rc (PL-39). rc.1 was built before any full run, which
   is one more reason it is superseded. The two recent nightly failures are
   named: 42546389981 on `22a4f54a` failed `test/board-launch-agent.test.mjs` (the plist missing from the repository,
   V1-1, fixed in `8c7e5469`); 42433463558 on `bc21883d` failed `test/private-history-native-db.test.mjs`, which the
   same night's other run on that commit (42428390833) passed, so a full run on `d5861ddb` passes it or names it here
   with its ruling. The nightly Windows failures in `listener-owner` and `peer-account` are ruled or fixed.
1. **Landing** (coordinator). The release commits land on `main` by fast-forward; landings on `main` are announced as
   paused on the project board from this step to the `v0.3.18` tag (PL-31). If `main` moved only by the workspace
   publication's pin (`workspace` and `docs/workspace-receipt.json`, the shape
   `scripts/lib/release-mac.mjs#verifiedCandidateProblem` admits), the release commits are rebased onto it; anything
   else on `main` after `d5861ddb` is a stop, and the close is planned again (`d5861ddb` itself reaches `main` first,
   by fast-forward from `78772e6d`, PL-43). Then
   `node scripts/release-mac.mjs --check-only --tag v0.3.18-rc.2` runs on the landed release commit: exit 0, its last
   line recorded here.
2. **The release candidate** (coordinator). `git tag -a v0.3.18-rc.2 <release commit> -m "Fabric 0.3.18 rc.2"` and
   `git push origin v0.3.18-rc.2`: the push trigger takes only `v[0-9]+.[0-9]+.[0-9]+` (`.github/workflows/release.yml`,
   line 19), so the rc tag starts nothing by itself; then `gh workflow run release.yml --ref v0.3.18-rc.2 -f
   publish=false` (the runbook's [*Rehearsal*](../../launch/release-mac.md#rehearsal); the `publish` input, lines 22 to
   25, defaults to false, and the shared publish workflow refuses an `-rc` tag). Read the result of each job (guard,
   preflight, macos, windows, linux, publish) and the Windows and Linux SMOKE receipts
   (`fabric-0.3.18-windows-<arch>.json`, the Linux one; PL-14); then `gh run download <run> -n
   signed-release-v0.3.18-rc.2` (kept 14 days; the per-job `release-macos` artifact 90). The rc DMG's SHA-256 and
   signer (`codesign -dvv`, `spctl -a -t open --context context:primary-signature`) are written beside every N6 receipt.
3. **Before the install** (coordinator).
   1. Announce the board's outage window on the project board (`com.submit`, an announcement), with each step's
      expected outage and the count of live Fabric-hosted sessions (`work.home`), and that board-dispatched runs may
      start during N6: at the rc's first start the dispatcher takes the far-deadline requests CO-554 lets open (two
      runs on the machine, one per project; PL-41, its rest ruled CO-555).
   2. Record here the ids and the count of the tasks in review that the first sweep will accept, irreversibly, by the
      sweep's own predicate (`shared/board.ts#reviewsDueForDefaultAccept` over the tasks in review and their
      `moved_at`; PL-34).
   3. Hold the broker's `fabric.desktop` as owner: stop the broker service, `lifecycle.py hold --target-id
      fabric.desktop`, start the broker service again (as `release-mac.md` step 1). Record the policy before the hold
      (on 2026-11-09 `always_on`, revision 29), which item 7 restores exactly (PL-29). A hold stops nothing: it keeps
      `always_on` from starting the old bundle during the swap.
4. **Install the rc** (coordinator). Quit 0.3.17 through its menu (`osascript -e 'tell application "Fabric" to quit'`),
   or SIGTERM its pid when it has not ended within 15 s (0.3.17 has no service, so its Quit ends it); move
   `/Applications/Fabric.app` aside as the way back (`/Applications/Fabric-0.3.17.app`); copy the rc's `Fabric.app` into
   `/Applications`; `open -a /Applications/Fabric.app`. Read the «Служба доски» line in Settings and
   `launchctl print gui/$(id -u)/ai.passioncode.desktop.board`, and read that 0.3.17's login item went only after the
   service read enabled (`shared/loginItem.ts#legacyLoginItemAction`; the ops log's `app.login-item`). If Settings shows
   the approval line (macOS answers `requires-approval`), that is a human gate: the person allows Fabric in System
   Settings, General, Login Items and Extensions; it is said once, with that path, and item 5 waits for it while the
   reads go on. After the first sweeps (every three minutes), their `work.swept@1` `acceptedByDefault` is compared with
   item 3.2's ids (PL-34).
5. **N6 on the rc build**, each case a receipt in `docs/evidence/plans/2026-11-08-0318-board-always-on/`. Every kill is
   spaced more than 60 s from the job's last spawn, since launchd's throttle counts from the spawn (launchd.plist(5);
   PL-28), so neither the throttle nor the broker's pause decides a case. "The board answers" means `hub.json`'s pid is
   alive and `GET <hub origin>/.well-known/fabric-service` answers 200. The window acts (Settings, a new terminal
   session) are the coordinator's, through UI automation of Fabric's window (System Events, or the computer-use tool).
   1. **(f), first: the state right after the install**, while the copy started in item 4 holds the lock (ER-14,
      PL-18): for five minutes, `launchctl print` every minute (`state`, `pid`, `runs`, `last exit code = 75`), one
      losing copy's CPU time, whether it shows in the Dock (a screen recording), `lifecycle.status` every 10 s and the
      broker's log for `circuit_open`.
   2. **Hand the board to launchd.** SIGTERM the copy started in item 4: it exits 0 (PL-3), and within 60 s launchd's
      next start takes the lock (`launchctl print`'s `pid` equals `hub.json`'s). This is also ER-22's measurement: while
      the service is on, a signalled copy that launchd did not start is replaced by launchd's within a minute (DO-19).
   3. **(a)** Quit from the menu hides Fabric (no window, no Dock icon) and the board answers.
   4. **(b)** SIGKILL launchd's copy; the time until a new pid answers. The bar, written before the run (PL-28): a new
      pid answers within 70 s of the kill (launchd spawns a `KeepAlive` job at most once every `ThrottleInterval`, 60 s
      in the plist; launchd.plist(5)); a copy that ran 60 s since its spawn is expected back within 10 s. This ledger
      amends REQ-1's 10 s ([the brief](2026-11-08-0318-board-always-on/brief.md#req-spine-ask-1)) to "within 70 s of an
      abnormal end" for 0.3.18; the brief itself is amended on `main` after the tag, with the measurement.
   5. **(c)** SIGTERM launchd's copy: `last exit code = 0`, and launchd does not start it again (no new pid for two
      minutes; `SuccessfulExit false`). Then `launchctl kickstart gui/$(id -u)/ai.passioncode.desktop.board` starts
      it, and its pid equals `hub.json`'s.
   6. **(d)** With a live terminal session open (opened from Fabric's window), turn «Служба доски» off in Settings,
      then Quit: Fabric ends (PL-8), and the session with it. Then `open -a /Applications/Fabric.app`, turn «Служба
      доски» on again (it writes `launchAtLogin` back), SIGTERM that copy, and read launchd's copy taking the board
      within 60 s (or `launchctl kickstart` the job).
   7. **(e)** A logout or a restart is not cancelled (PL-7). Its owner is the person: a logout ends the coordinator's
      own processes, and logging back in is a human gate. It is read after the person's next logout or restart (the ops
      log's quit line before it, `launchctl print`'s `runs` after login) and recorded unproven, with that owner, until
      then (PL-33); the notes already say a logout and a restart end Fabric.
6. **Then the carried checks** (coordinator; both carried from 0.3.17): the Docker-stopped start check, and
   `chat-activation-native` with its own `--user-data-dir`, now that such a start leaves the service alone (PL-4).
7. **Publish, only after item 5 passes** (coordinator). The release commit is the one made from `d5861ddb`, named by
   its full hash in the 0.3.18 handoff once it lands (a commit cannot name itself), never `a86481ca`.
   `node scripts/release-mac.mjs --check-only --tag v0.3.18` on it (exit 0, recorded);
   `git tag -a v0.3.18 <release commit> -m "Fabric 0.3.18"`, then `git rev-parse v0.3.18^{commit}` equals the hash the
   handoff names (else the tag is deleted locally and nothing is pushed), then push it: the push
   trigger builds, signs and publishes, so the published bytes are not the rc's. Read the published DMG's SHA-256 and
   signer back. Install it under the same hold: SIGTERM launchd's copy (exit 0, not started again), swap
   `/Applications/Fabric.app` for the published one, `launchctl kickstart` the job, then read the service line, the
   job's pid against `hub.json`'s and `com.status`. Run the runbook's step 7 on the installed published build
   (`node scripts/smoke-platform.mjs --exe /Applications/Fabric.app/Contents/MacOS/Fabric --mcp-only`,
   `FABRIC_APP_EXECUTABLE=… node --test apps/desktop/test/packaged-helpers.test.mjs`). Release the broker's hold,
   restoring the exact previous policy (`always_on`, item 3.3) with the broker service stopped for the edit; then read
   `lifecycle.status` and the broker's log for 10 minutes: no start attempt against launchd's copy and no `gave_up`,
   else the policy goes to `on_demand` with the reason in CO-549 (PL-29). Announce the end of the outage on the board.
   Then the runbook's steps 9 to 11 (the site's downloads, the workspace, the knowledge base); the rollout readings
   (version, schema, journal count, `hub.json`'s pid, `com.status`, `dispatchBoardRequests`) written into the 0.3.18
   handoff on `main`; the person's look at the opened release; a live board-dispatcher run (PL-32).
8. **The failure path** (PL-30). A failure in items 2 to 6 stops the close: nothing is published, `v0.3.18` stays
   untagged, and 0.3.17 stays installed or is restored by item 9. The fix becomes a new candidate, and the release
   takes a new three-iteration review under a new `verifiedCommit` (the gate admits exactly three iterations, the
   third equal to `verifiedCommit`: `scripts/lib/release-gate.mjs#ITERATIONS`); its rc is the next number,
   `v0.3.18-rc.3`. This rule governs a failure in items 2 to 6. Iteration 3's re-entry on 2026-11-09 was narrower and
   is not that path (PL-36): CO-554 joined 0.3.18 before any of items 2 to 6 ran on a build carrying it (rc.1 was a
   rehearsal of the superseded release commit, never installed), its code delta from iteration 3's first candidate is
   the dispatcher's two files and their tests (`git diff --name-only bba86bce d5861ddb -- apps scripts .github` lists
   those four and `apps/desktop/package.json`, whose only change is `version`), nothing iterations 1 and 2 fixed, so
   iteration 3 alone was run again on it, twice (*Iteration 3*).
9. **Rollback** (PL-20, DO-19), in the runbook's order (`release-mac.md`, the 0.3.18 paragraph): in 0.3.18 turn «Служба
   доски» off (it unregisters the agent service and writes `launchAtLogin: false`, the key 0.3.17 reads) and read the
   off line in Settings and no job in `launchctl print`; hold the broker (service stop, hold, service start); quit;
   swap in the kept 0.3.17 bundle; start it; turn «Запускать Fabric при входе в систему» on in 0.3.17's Settings;
   release the hold, restoring the exact previous policy, `always_on` included (PL-29); read `hub.json`'s pid and
   `com.status`. When 0.3.18 cannot open Settings: with Fabric stopped, set `launchAtLogin` to `false` in
   `userData/settings.json`, start 0.3.18 once so it unregisters the service, quit it, then continue at the hold.
   `launchctl bootout` alone is an emergency stop only: it leaves the registration in Login Items and stops only a copy
   launchd started.

### Executed on rc.2, 2026-11-10

What the coordinator (session `5d9bed98`, outside any Fabric terminal) did of the items above, item by item, with its
evidence; times are UTC. The N6 receipts are in
[`2026-11-08-0318-board-always-on/`](2026-11-08-0318-board-always-on/), each naming the build
([`n6-rc2-build.md`](2026-11-08-0318-board-always-on/n6-rc2-build.md)). Nothing is published: `v0.3.18` is not tagged.

0. **Preflight: done.** The full run on `d5861ddb62117e2b34a5540b5ef6844c9df99c45`: `ci.yml` run 42707815486
   (`workflow_dispatch` on `fix/dispatch-packet-deadline-3`, 2026-11-09 22:00:29Z to 23:25:25Z), jobs "fast, no
   database" and "full, with a disposable stack" `success` (the `gate` job skipped, as on a dispatch). The push run
   42706313170 on the same commit: `success`. The release commit is `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359`. The
   full tier passed on `d5861ddb`, so neither nightly `ci` failure named above reproduces on it. **Still owed before
   item 7:** the nightly Windows failures of `platforms.yml` (run 42547666053 on `22a4f54a`, both Windows jobs:
   `apps\desktop\test\listener-owner.test.mjs` and `apps\desktop\test\peer-account.test.mjs`) are neither ruled nor
   fixed by this record; `platforms.yml` has not run on `d5861ddb` or `bbc90b7a`, and the release run's Windows jobs do
   not run those two tests.
1. **Landing: done, by a merge, not a rebase.** Before the landing `main` had moved only by the workspace publication's
   pin `40fe3818` (child of `78772e6d`; `git diff --stat 78772e6d 40fe3818`: `docs/workspace-receipt.json` and
   `workspace` alone). The chain `d5861ddb`, `bbc90b7a`, `1e338346` was joined to it by the merge commit `df2c2cf2`
   ("Merge origin/main (workspace pin) into docs/0318-post-rc2"; parents `1e338346` and `40fe3818`), the precedent of
   `7e43dc03` for 0.3.14, so `d5861ddb` and `bbc90b7a` keep their hashes and the tags name the commit the gate was
   written for; `main` then moved to `df2c2cf2` by fast-forward (this machine's reflog of `origin/main`: pushed
   2026-11-09 22:59:55Z). This deviates from item 1's "rebased onto it" and is recorded as such. Run on the landed
   release commit (the clean detached checkout at `bbc90b7a`): `node scripts/release-mac.mjs --check-only --tag
   v0.3.18-rc.2`, last line "release: Fabric 0.3.18 at bbc90b7ae4bc (v0.3.18-rc.2) is on origin/main and its release
   gate is clear", exit 0. Since then `main` moved by the pin `e48571b6` (pushed 00:25:21Z) and by `b9277354` (CO-551
   stage A, a code change, pushed 00:56:38Z, inside the window item 1 announces as paused); neither touches what the
   tags name (`bbc90b7a` is their ancestor), and at 01:13:42Z on `bbc90b7a` `--check-only --tag v0.3.18` and `--tag
   v0.3.18-rc.2` both answered "is on origin/main and its release gate is clear", exit 0.
2. **The release candidate: done.** `v0.3.18-rc.2` on `bbc90b7a` (a lightweight tag: `git ls-remote` shows no peeled
   line; item 2 wrote `git tag -a`, so `v0.3.18` is to be annotated). `release.yml` run 42720627493
   (`publish=false`): guard, preflight, macos, windows x64, windows arm64, linux x64, linux arm64 and publish all
   `success`. Artifact `signed-release-v0.3.18-rc.2`: `shasum -a 256 -c SHA256SUMS` answers `OK` for all 12 files.
   `Fabric-0.3.18-universal.dmg` sha256 `8c3db3519b4026bedf1d686eddc5f66608fe5b9ff6e1cb207bde6bcb0f2e8ede`, Developer ID
   Application (team `KJ35UYYL22`), `spctl`: `Notarized Developer ID`. SMOKE receipts (PL-14): Windows x64 and arm64
   `SIGNED (Azure Artifact Signing)`, and on Windows and Linux both arches `installed-start` and `fabric-mcp` pass, each
   naming commit `bbc90b7a` ([the build receipt](2026-11-08-0318-board-always-on/n6-rc2-build.md)). rc.1 stays
   superseded and was never installed.
3. **Before the install: done.**
   1. Announced on the project board at 00:38Z (message `eafab06d`): the outage window, with zero live Fabric-hosted
      terminal sessions (Fabric's only child was the dispatcher's Observatory server).
   2. Read at 00:37Z: 29 tasks in review, 1 due for the default accept by the sweep's predicate, id
      `b1718a7d-7726-4128-8fcb-f5c14bb1fbfc`. Compared after the install: the rc's first sweep with an accept,
      `work.swept@1` at 00:42:13Z (journal seq 126743), says `acceptedByDefault: 1`, and the one `task.closed@1` by
      `review-default` since 00:30Z (seq 126742) names that id. The two earlier sweeps (00:31Z, 00:37Z, still 0.3.17)
      accepted none.
   3. The broker's owner hold: policy before `always_on`, revision 29; after `held_off`, revision 30 (broker service
      stopped, hold, started); its `events.jsonl` holds no `circuit_open`. Item 7 restores `always_on` exactly.
4. **Install the rc: done, in part.** 0.3.17 quit by its menu's Quit (an Apple event) and ended in 1 s; kept as
   `/Applications/Fabric-0.3.17.app`. The rc's `Fabric.app` copied with `ditto`; `codesign --deep --strict` OK; `spctl`
   accepted. Opened at 00:39:06Z; the ops log `app.started` 0.3.18 at 00:39:10Z; the board answered (`com.status`:
   board ready). Not read: the «Служба доски» line in Settings (the screen was locked); the legacy login item's
   removal was not read either, beyond the ops log holding no `app.login-item` line for the rc's starts (that op is
   written only when the state is unknown or the apply fails, `apps/desktop/src/main/index.ts#applyLoginItem`).
   Both are read with the window checks. The ledger's probe "`GET <hub origin>/.well-known/fabric-service`" does not
   exist on the hub (404 on rc.2; no such route in `apps/desktop/src/main`); "the board answers" was read through
   `com.status` over the hub instead, a defect of this ledger carried in CO-549.
5. **N6: done in part.** (f) [after the install](2026-11-08-0318-board-always-on/n6-f-after-install.md): five
   samples 00:52 to 00:56Z, the job `spawn scheduled`, runs 14 to 18, last exit 75, `hub.json`'s pid the opened copy,
   the broker `held_off`, no `circuit_open`. [The hand-over](2026-11-08-0318-board-always-on/n6-handover.md): SIGTERM
   at 00:57:58Z, the opened copy ended in 1 s (`app.quit-signal` SIGTERM), launchd's copy published the hub 17 s later
   (ER-22's measurement: replaced within a minute). (a) [Quit hides](2026-11-08-0318-board-always-on/n6-a-quit-hides.md),
   00:58:29Z: process alive, background only, zero windows, board ready: pass. (b)
   [SIGKILL](2026-11-08-0318-board-always-on/n6-b-sigkill.md), 00:58:54Z: new pid published in 21 s, bar 70 s: pass;
   deviation: the kill came about 40 s after that copy's spawn, not 60 s. (c)
   [SIGTERM](2026-11-08-0318-board-always-on/n6-c-sigterm.md), 00:59:27Z (about 12 s after the spawn, the same
   deviation): exit 0, not running for 2 minutes, `kickstart` at 01:01:30Z answered in 1 s: pass. (d)
   [The switch off](2026-11-08-0318-board-always-on/n6-d-switch-off.md), by the documented file route because the
   screen was locked: `launchAtLogin` false, one start unregistered the job, Quit at 01:03:23Z ended Fabric (no ops
   record after 01:03:23.509Z, `hub.json` removed); `launchAtLogin` true, one start registered the job, SIGTERM at
   01:05:18Z, launchd's copy took the board in 55 s: pass for the switch; the live terminal session part is unproven
   until the screen is unlocked. (e) [Logout](2026-11-08-0318-board-always-on/n6-e-logout.md): unproven, owner the
   person.
6. **The carried checks: not passed.** `chat-activation-native` ran on the installed rc with its own `--user-data-dir`:
   the board service was left alone (launchd's pid 80545 before and after: PL-4 holds), and the probe ended `FAIL` at
   stage `status` (`locator.waitFor: Timeout 120000ms exceeded`) with the screen locked; the renderer ran (its `ipc`
   reads logged once) and then stopped updating, consistent with a locked screen. Inconclusive; it runs again with the
   screen unlocked. The Docker-stopped start check was not run: it stops every container on the machine, so it waits
   for the operator's presence.
7. **Publish: not done.** `v0.3.18` is not tagged; it waits for the window checks above (4's Settings line, 5 (d)'s
   live session, 6) with the screen unlocked, and for item 0's Windows ruling. The broker's hold stays until item 7.

Found during the close: **CO-556** (reserved; its row and fix land on their own branch). The board dispatcher offered
its hand-overs to provider `claude` while Switchboard's dispatch prompt asks the session to accept as `claude-code`, and
Observatory refused every accept (`InvalidInput: the handoff goes to claude, not claude-code`), observed on rc.2 at
00:40Z. The dispatcher was switched off on this Mac (`settings.json` `dispatchBoardRequests` `false`, 00:48Z) before any
request reached its second empty run. Not a regression of 0.3.18 (0.3.17 maps the provider the same way); the fix
ships in 0.3.19.

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

## Iteration 3

Candidate `d5861ddb62117e2b34a5540b5ef6844c9df99c45`, equal to `verifiedCommit` (hosted `ci`: push run 42706313170 on
`fix/dispatch-packet-deadline-3`, queued when this was written; item 0's full run pending; their results and the full
run's id recorded by the coordinator before the rc). Five reviewers, one
per level, each a fresh context on a clean detached checkout of the candidate (HEAD and `git status --short | wc -l`
read before and after, unchanged); their reports and receipts are in
`docs/evidence/reviews/0.3.18/iteration-3-d5861ddb/`, and the receipts carry run two's findings too, each with its V3
row (PL-42).

**Why iteration 3 ran three times.** After the first release commit, CO-554 joined 0.3.18 on the operator's word
(2026-11-09, session `5d9bed98`, as CO-554's row cites): the dispatcher refused every board request with a deadline more
than a week away (986 `DeadlineTooFar` failures for 28 requests that day), and the fix reaches the operator's Mac at
once with the rc's install, which a 0.3.19 route could not match. Its code delta from iteration 3's first candidate is
the dispatcher's two files and their tests, nothing iterations 1 and 2 fixed (item 8 has the list), so iteration 3
alone was run again, once on each fix, and every code change after iteration 2's candidate is read by an iteration 3
run: fix wave 2 by run one, `bba86bce..0e501425` by run two, `0e501425..d5861ddb` (eight files) by run three. Item 8's
rule still governs a failure in items 2 to 6 (PL-36).

- **Run one**, `bba86bce9964fa7b27e72baf591ca226516c9130`: the candidate then, superseded. Reports and receipts in
  `docs/evidence/reviews/0.3.18/iteration-3/`, kept byte-identical as the record of that run, which the gate no longer
  names. 23 findings, 2 blocking; rows V3-1 to V3-23 below.
- **Run two**, `0e501425c7c4df672307734e595cae5982deaced` (hosted `ci` 42700340664 on `fix/dispatch-packet-deadline`,
  green): the first CO-554 fix, superseded. `d5861ddb` replaced it by an amend on the same parent `78772e6d`, so it is
  outside the shipped history and kept under `refs/archive/2026-11-09/fix-dispatch-packet-deadline` (PL-43, DO-29).
  Its reports and receipts cannot be in the release commit (the gate names one candidate per iteration, PL-42); they
  land on `main` after it at `docs/evidence/reviews/0.3.18/iteration-3-0e501425/`. 21 findings (UX-21 to UX-24, ER-24
  to ER-26, DA-13, DA-14, PL-35 to PL-41, DO-23 to DO-27), 2 blocking: UX-21 and DO-23; rows V3-24 to V3-44.
- **Run three**, `d5861ddb`: the candidate. 11 findings (UX-25, UX-26, ER-27, ER-28, DA-15, DA-16, PL-42 to PL-44,
  DO-28, DO-29), none blocking; rows V3-45 to V3-55.

Run two's and run three's findings are fixed in `d5861ddb`, fixed by this release commit (the gate, this ledger, the
handoff, `CHANGELOG.md`'s UX-25 line, the map and the merge log), fixed by the post-release commit, or ruled into CO-549
(the row update naming ER-22, written after the release commit) or CO-555, the dispatcher's packet deadline residues,
non-blocking, a row filed on `main` after the release commit. One defect is reported more than once: UX-21, PL-37 and
part of DO-23 (the bullet under `## Unreleased`); ER-24 and DA-13 (the frozen deadline across versions); UX-23, ER-25,
DA-14 and PL-41 (2) (a request older than a week); PL-36 and DO-24 (the route against item 8); UX-22 and DO-27 (c); UX-26,
ER-27 and DA-16 (a workflow older than a week); PL-43 and DO-29 (the amend). The text check of the three `## 0.3.18`
paragraphs `d5861ddb` and this commit change (the **Upgrading.** line, the ADR-0192 bullet, the CO-554 bullet) found
nothing. The committed run-three reports are as written; none needed a redaction.

What runs two and three recorded of the earlier findings, at their candidates:

- ux: UX-1 to UX-18 as run one left them; UX-4's rest named in CO-550 by `78772e6d`; UX-19 and UX-20 carried by
  CO-553. Run three: UX-21 and UX-22 fixed; UX-23 fixed for the cases named, its rest UX-26; UX-24 fixed in part, its
  rest UX-25.
- errors: ER-1 to ER-23 unchanged since run one (the quit, restart, launchd and sweep code byte-identical). Run three:
  ER-24 fixed (two plants watched); ER-25 fixed, its rest ER-27; ER-26 fixed, its rest ER-28.
- data: DA-1 to DA-12 unchanged; the schema unchanged since 0.3.17, `board-dispatches.json` keeps its shape both ways,
  the dispatcher writes no journal event. Run three: DA-13 fixed for the upgrade and for the board's default deadline on
  a rollback, its rest DA-15; DA-14 fixed as named, its rest DA-16.
- plan: PL-1 to PL-34 as run one recorded them, PL-30's rule not the route taken (PL-36). Run three: PL-37 fixed;
  PL-35, PL-36, PL-38 and PL-39 hold until this release commit (PL-38 widened by PL-43); PL-40 fixed for CO-554, the
  rest after the release commit; PL-41 (2) fixed with a residue, (1) and the first-start burst hold.
- docs: DO-1 to DO-22 as run one recorded them, DO-20's CO-549 half now DO-25. Run three: DO-23 and DO-24 deferred to
  this release commit, DO-25 to the post-release commit, DO-26 fixed (986 failures for 28 requests, recounted), DO-27
  (a) fixed on Fabric's side and upstream on Observatory's, (b) moot, (c) fixed.

### Run one, bba86bce (superseded)

Candidate `bba86bce9964fa7b27e72baf591ca226516c9130`, then `verifiedCommit` (hosted `ci` 42678863108 on
`release/0318`, green; 42680621451 on `main`, green; the fast tier, as the protocol says). Five reviewers, one per
level, each a fresh context on a clean detached checkout of the candidate (HEAD and `git status --short | wc -l` read
before and after, unchanged); their reports and receipts are in `docs/evidence/reviews/0.3.18/iteration-3/`. 23
findings (UX-19 and UX-20, ER-18 to ER-23, DA-12, PL-26 to PL-34, DO-18 to DO-22), 2 blocking: PL-26 and PL-27.
ER-19 and DA-12 are one defect (the restart note's sentence); ER-22 and DO-19 one hand-over (a signalled copy launchd
did not start is replaced by launchd's); UX-19 and DO-22 (a) one clause; PL-33 is PL-7's owner.

No fix wave followed run one: no code, string, scenario, decision record or register changed after its candidate
before the first release commit `a86481ca` (PL-26); CO-554 came after that, and runs two and three read it. PL-26 is fixed by splitting the iteration-2 ledger commit (`0c0f19cc` carries only the
ledger, the iteration-2 reports and receipts and the map), PL-27 and the other plan findings by the Release close above.
Every other finding is ruled into CO-549 (ER-22) or CO-553, the 0.3.18 review's iteration-3 leftovers (the restart
helper and the service's leftovers, non-blocking), a row filed on `main` after the release commit (in `78772e6d`, now
inside the verified tree; its CO-549 update missed ER-22, DO-25) with the CO-549 and
CO-550 updates, which name what iterations 2 and 3 sent those rows (ER-14's rest, PL-18 and ER-22 to CO-549; UX-4's
rest and PL-23 to CO-550). No strings changed in run one, so it has no text check reports. The committed reports are as
written; none needed a redaction.

Superseded rows of iteration 1 (DO-20), which stay as written, a record of that iteration: V1-15's evidence
(`shared/loginItem.ts#startFailureExitCode` and the test «ER-4: a failed start under launchd ends 0») was removed in
`62f24bf4`, and V2-12 (ER-17) states the rule that holds: every failed-start Quit exits 0. V1-16 and V1-34 recorded the
signal fix as done in `b39f11de`, but its listeners never ran on Electron 44 until `62f24bf4` added them once Electron
is ready (V2-8, ER-13); this iteration's errors reviewer watched the planted shape (`held-at-load`) stay alive after
SIGTERM and the fixed one end.

What the reviewers recorded of iterations 1 and 2, at this candidate:

- ux: UX-1, UX-2, UX-3, UX-5, UX-6 and UX-11 fixed and not made worse, UX-1's packaged proof CO-549's (N6); UX-12 to
  UX-17 fixed; UX-18 fixed in code, its live proof CO-549's; UX-4's rest (nothing at a held quit says Fabric still
  runs) unnamed in the CO-550 row at the candidate, named there in the row update after the release commit; UX-7 to
  UX-10 (rest) carried by CO-550.
- errors: ER-1, ER-2, ER-3, ER-8, ER-16 and ER-17 fixed and holding; ER-4 fixed, its residue at the deadline ER-23;
  ER-5 and ER-13 fixed (the plant watched); ER-6 in part, the rest CO-549's; ER-7 CO-549's; ER-9 to ER-12 CO-550's and
  untouched; ER-14 fixed for the sweep, the retry cost CO-549's; ER-15 fixed for a refused kickstart, with residues
  ER-19, ER-20 and ER-21.
- data: DA-1, DA-8, DA-10 and DA-11 fixed; DA-2 fixed through DA-9, which is fixed end to end (the receipt stored with
  its count through the real journal adapter, a count of 0 refused; `work.swept@1` projects nothing; a 0.3.17 rollback
  stores and ignores the key); DA-3 to DA-7 CO-550's and not made worse; the schema unchanged since 0.3.17.
- plan: PL-1 to PL-5, PL-10, PL-12, PL-16, PL-20, PL-21, PL-22 and PL-25 fixed; PL-6 fixed in code, its proof N6 (b);
  PL-7, PL-8, PL-13, PL-14 and PL-15 ruled and carried into the close; PL-9, PL-11 and PL-24 fixed by the ledger with
  the gaps PL-31 and PL-32; PL-17 and PL-19 in part (PL-27, PL-28); PL-18 ruled CO-549, its reverse direction PL-29;
  PL-23 ruled CO-550, its row edit then staged after `verifiedCommit` (PL-26). The release workflow supports an rc with
  `publish=false` (precedent: run 38242615349, `v0.3.5-rc.2`, every job green).
- docs: DO-2 to DO-8 and DO-10 to DO-15 fixed; DO-1 fixed in the tree, its live proof CO-549's; DO-9 CO-550's and not
  made worse; DO-16 fixed in the scenarios, its screens half DO-22 (e); DO-17 fixed with one leftover, DO-22 (c). All
  41 `File#symbol` citations in the 0.3.18 documents resolve, and the read-only gates passed at the candidate.

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V3-1 | UX-19 | non-blocking | the «Служба доски» note always says Fabric starts at login and is started again after a crash, beside lines that say otherwise in the approval and off states; the Quit line comes before the system line it depends on; SCN-170 says only the off line shows with the switch off | ruled CO-553 (filed after the release commit): the note's second sentence said only with the service on, the system line before the Quit line, an off-state Quit sentence, and SCN-170's clause corrected; strings and the scenario change after `verifiedCommit`, so they wait for the next candidate |
| V3-2 | UX-20 | non-blocking | the restart question calls every running terminal an agent console, though it counts plain shells and routine runs too; the notes and `AGENTS.md` repeat it | ruled CO-553 (filed after the release commit): the question says «консоль» without the agent, or counts agent sessions and shells apart, with the notes and `AGENTS.md` in step |
| V3-3 | ER-18 | non-blocking | with every window closed the restart question is a free-standing box; while it is open `app.exit` cannot end the process, so a signal or a logout during it is ended only by the 15 s outside kill, which launchd restarts | ruled CO-553 (filed after the release commit): the question is always a sheet on the main window (shown or created first), with the fixture case "restart question with no window, SIGTERM ends 0" |
| V3-4 | ER-19 | non-blocking | the next start records "launchd did not start the board; Fabric was opened by its id instead" for any restart note, also when the note says only `waited` or that the open failed too | ruled CO-553 (filed after the release commit) (with DA-12): the sentence is chosen from the note's lines, each case tested |
| V3-5 | ER-20 | non-blocking | a restart helper that fails to spawn reports it asynchronously, after the restart chose the launchd route, so Fabric quits with nothing to start it again | ruled CO-553 (filed after the release commit): quit only after the child's `spawn` event, or arm `app.relaunch` in its `error` handler; tested with a command that does not exist |
| V3-6 | ER-21 | non-blocking | the fallback `open -b ai.passioncode.desktop` lets LaunchServices pick among every registered copy with that id (16 on the operator's Mac) | ruled CO-553 (filed after the release commit): open the running bundle by its path, `open -b` only as the last resort |
| V3-7 | ER-22 | non-blocking | UX-18's exit 0 covers only launchd's own copy: a signalled copy the person or the broker opened is followed within 60 s by launchd's copy taking the board, so the board does not stay stopped and a broker `held_off` is undone | ruled CO-549: measured in the Release close (item 5's hand-over and case (f)); the Lifecycle row and the runbook state the hand-over, or a signalled copy stops launchd's job too, as CO-549 decides from the measurement; the close already relies on it (item 5 hands the board to launchd by a SIGTERM) |
| V3-8 | ER-23 | non-blocking | the deadline maps only a signalled quit of launchd's copy to 0; a failed start's Quit under launchd that runs into the deadline exits 3, so launchd brings the failure dialog back | ruled CO-553 (filed after the release commit): pass `startFailed` and `restarting` into `quit.ts#quitDeadlineExitCode` and end 0 under launchd for them, one test row each |
| V3-9 | DA-12 | non-blocking | the restart outcome is logged with one fixed sentence whatever the note holds, and the note carries no time, so a later unrelated start logs it as the restart's | ruled CO-553 (filed after the release commit) (with ER-19): each line carries its time and the sentence is chosen from the lines, with the line's age in the detail |
| V3-10 | PL-26 | blocking | the iteration-2 ledger work edited the carry-over register on top of `verifiedCommit`; after `verifiedCommit` only the release files may change, so preflight would refuse the rc and the tag | fixed: the iteration-2 ledger commit was split, so nothing outside the allowed set changes after `verifiedCommit`: `0c0f19cc` carries only the ledger, the iteration-2 reports and receipts and the map (`git diff --name-only bba86bce 0c0f19cc`); the carry-over and backlog edits (CO-549 and CO-550 updates, CO-553) land on `main` after the release commit; the Release close runs `node scripts/release-mac.mjs --check-only --tag <tag>` before each tag (items 0, 1 and 7) |
| V3-11 | PL-27 | blocking | N6 could not start as written: the first start under the hold, the hand-over to launchd's copy, the start after (c), the routes for (d), the swap under a live `KeepAlive` job and the order of (f) were missing | fixed by this ledger: the Release close names each act with its actor and route: items 3 and 4 (owner hold with the broker service stopped, quit 0.3.17 by its menu or SIGTERM, swap, `open -a`), item 5 runs (f) first while that copy holds, hands the board to launchd by SIGTERM and reads the pid against `hub.json`, starts the job again after (c) with `launchctl kickstart`, names the UI route for (d), and item 7 stops launchd's copy by SIGTERM before the swap and kickstarts after |
| V3-12 | PL-28 | non-blocking | item 5 (b) rested on a false premise (ThrottleInterval spaces every start of the job, launchd.plist(5)) and set its pass bar after the result; kills were spaced from the last kill, not the last spawn | fixed by this ledger: item 5 (b) writes its bar before the run (a new pid answers within 70 s of the kill; a copy that ran 60 s since its spawn is expected back within 10 s) and REQ-1's 10 s is amended here to that bound for 0.3.18, the brief amended on `main` after the tag; kills are spaced more than 60 s from the last spawn |
| V3-13 | PL-29 | non-blocking | the broker's end state was undecided: `hold --release` returns `fabric.desktop` to `on_demand`, dropping `always_on`; the hold edits omitted the broker service stop | fixed by this ledger: items 3, 7 and 9 stop the broker service for each edit (`service stop`, `hold`, `service start`, as `release-mac.md` step 1), record the policy revision, and on release restore the exact previous policy, `always_on` included, then read `lifecycle.status` and the broker log for 10 minutes for a start attempt or `gave_up` against launchd's copy |
| V3-14 | PL-30 | non-blocking | the failure path ("a new candidate, the gate's next iteration, rc.2") could not be followed: the gate admits exactly three iterations per `verifiedCommit` | fixed by this ledger: item 8 says a failure in items 2 to 6 stops the close; the fix becomes a new candidate and the release takes a new three-iteration review under a new `verifiedCommit`, with the next rc number; `v0.3.18` stays untagged and 0.3.17 stays installed or is restored by the rollback |
| V3-15 | PL-31 | non-blocking | the landing route and the full run could fail without a fault in 0.3.18: another landing on `main` breaks the fast-forward, and the nightly runs `main`'s tip, not `verifiedCommit` | fixed by this ledger: item 1 lands by fast-forward, rebases only over the workspace publication's pin (the gate admits that shape) and stops on anything else; item 0 counts a nightly only when `git diff --name-only bba86bce <its commit>` lists allowed paths alone, and names the two recent nightly failures (`board-launch-agent.test.mjs` on `22a4f54a`, the missing plist fixed in `8c7e5469`; `private-history-native-db.test.mjs` on `bc21883d`) |
| V3-16 | PL-32 | non-blocking | the close dropped what 0.3.17 carried and the runbook owes: step 7 on the installed published app, the rollout readings, the end of the outage, the person's look, a live dispatcher run, forty sessions | fixed by this ledger: item 7 runs the runbook's step 7 on the installed published build, writes the rollout readings into the 0.3.18 handoff, announces the end of the outage, and carries the person's look at the opened release and a live board-dispatcher run; forty sessions at once stays in the handoff's Open |
| V3-17 | PL-33 | non-blocking | (e) could close as unproven, and the agent driving the close cannot run it: a logout ends its own processes and logging back in needs the person | fixed by this ledger: item 5 (e) names the person as its owner (a human gate) and the reading after their next logout or restart (the ops log's quit line, `launchctl print` `runs` after login); until then it is recorded unproven in the handoff, and the release notes say a logout and a restart end Fabric |
| V3-18 | PL-34 | non-blocking | item 3 recorded only counts of the reviews the first sweep accepts irreversibly, so nothing could check what the sweep did | fixed by this ledger: item 3 records the task ids and their count with the sweep's own predicate (`shared/board.ts#reviewsDueForDefaultAccept` over tasks in review and their `moved_at`), and item 4 compares them with the `acceptedByDefault` of the first `work.swept@1` receipts after the install |
| V3-19 | DO-18 | non-blocking | ADR-0192 amendment 1 and the Lifecycle row say Electron ends a quit with 0 whatever `process.exitCode` says, yet the SMOKE failure branch sets `process.exitCode = 1` after `app.quit()` and the smoke runner says it exits 1 | ruled CO-553 (filed after the release commit): end the SMOKE failure with `app.exit(1)` after its record, or narrow the sentence to the failure dialog's Quit and correct `scripts/smoke-platform.mjs`; the smoke verdict reads the line, so the release runs are unaffected |
| V3-20 | DO-19 | non-blocking | the ledger's close kept bootout as an equal rollback route without a broker hold, and expected a SIGTERM to leave Fabric stopped, true only for launchd's own copy; the notes' "a signal still ends Fabric" has the same gap | fixed by this ledger: item 9 follows the runbook's rollback order (`release-mac.md`, the 0.3.18 paragraph); item 5 says a signalled launchd copy is not started again while a signalled person or broker copy is replaced by launchd's within 60 s, and proves both (the hand-over and case (c)); the release commit's **Upgrading.** line says it in the notes |
| V3-21 | DO-20 | non-blocking | CO-549 does not list the measurement ADR-0192 and the design hand it (PL-18); iteration-1 rows V1-15, V1-16 and V1-34 cite evidence the fix waves removed or proved ineffective | fixed by this ledger: the iteration-3 section records the supersession of V1-15 (by V2-12, `62f24bf4`) and of V1-16 and V1-34 (by V2-8, `62f24bf4`); the CO-549 row part is ruled CO-553 (filed after the release commit): the row update naming PL-18, ER-14's rest and ER-22 is written on `main` after the release commit |
| V3-22 | DO-21 | non-blocking | three passages of the board-always-on design still describe what was not built, though the header says the differences are marked *As built* | ruled CO-553 (filed after the release commit): mark the quit row, step 3's `keepRunning()` and step 4's second start *As built* with ADR-0192 amendment 1's rule numbers |
| V3-23 | DO-22 | non-blocking | small inaccuracies: SCN-170's off-state clause, the ADR index row without amendment 1, a test name without SIGINT, ADR-0192's Evidence citing Electron 44.9.3's docs, no screen record for «Перезапустить Fabric» | ruled CO-553 (filed after the release commit): (a) with UX-19, (b) to (e) as the report proposes |

Run one closed with every finding disposed and none of its blocking findings left open.

### Run two, 0e501425 (superseded)

The first CO-554 fix. Its findings, disposed against the candidate that replaced it:

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V3-24 | UX-21 | blocking | the CO-554 fix shipped in 0.3.18 with its note under `## Unreleased`, which the release does not publish; every record still placed CO-554 after 0.3.18 | fixed in d5861ddb: the bullet is the last of `## 0.3.18` and `## Unreleased` is gone (`CHANGELOG.md`; `scripts/lib/release-mac.mjs#changelogProblem` answers null); CO-554's row targets 0.3.18; the gate, *What 0.3.18 carries* and the handoff follow in this release commit (V3-40) |
| V3-25 | UX-22 | non-blocking | the CO-554 bullet said Fabric retried every ten minutes, 0.3.17's cadence, against CO-544's doubling back-off in the same notes | fixed in d5861ddb: the bullet says Fabric "kept trying again later without starting it", no cadence |
| V3-26 | UX-23 | non-blocking | the packet deadline cut from the submission is already past for a run opened more than a week after it, so the run cannot use the project's keys while the board's deadline is ahead | fixed in d5861ddb for the cases named: the cut is from the opening write (`shared/boardDispatch.ts#packetDeadline(deadline, writtenAt)`) and a lost open reuses its write time; a workflow taken back more than a week after it opened is UX-26 |
| V3-27 | UX-24 | non-blocking | the notes promised a restart "within a minute" twice, against the release's own bar of 70 s | fixed in d5861ddb for the **Upgrading.** line ("within about a minute"); the ADR-0192 bullet's rest is UX-25, fixed by this release commit (V3-45) |
| V3-28 | ER-24 | non-blocking | later writes repeated the cut deadline, so a workflow opened before the fix was refused `packet-frozen` after the update and the request never had its next run | fixed in d5861ddb: only the opening write names `deadline:` (`main/boardDispatchRun.ts`, `body(opening)`); test «CO-554 (0.3.18 review, DA-13, ER-24): the board's default deadline is written as it is, and a later write leaves the frozen deadline out» with a stand-in that freezes the first write; the case named is closed |
| V3-29 | ER-25 | non-blocking | the cut anchored on the submission gave a request read more than seven days after it a packet deadline already past at the write | fixed in d5861ddb: the cut is from the write, always ahead of it; test «CO-554 (0.3.18 review, DA-14, ER-25): a request sent more than a week ago gets a packet deadline still ahead»; the case named is closed, a workflow that lives longer than seven days is ER-27 |
| V3-30 | ER-26 | non-blocking | the new tests did not guard the same value on every write: one compared two identical calls, the other checked only the opening write | fixed in d5861ddb: the tautology is gone; the run tests use `freezingObservatory`, take a workflow back on a later pass and compare a lost open's retried body (`assert.deepEqual`); the case named is closed, the unguarded `-ends-held` write is ER-28 |
| V3-31 | DA-13 | non-blocking | the cut also changed every default deadline, so a workflow 0.3.17 opened could not be continued by 0.3.18, and the reverse after a rollback | fixed in d5861ddb: later writes leave `deadline:` out, and a deadline within `openAt + 7 d - 60 s` (the board's default included) is written as the board's string; the rollback residue for cut deadlines is DA-15 |
| V3-32 | DA-14 | non-blocking | a request older than about seven days got a packet deadline already past at its first write, so its run opened with keys shut | fixed in d5861ddb for the case named: the first write's deadline is `openAt + 7 d - 60 s`, always ahead; a later run after that week is DA-16 |
| V3-33 | PL-35 | non-blocking | the new release commit had more to move than two hashes: new receipt paths, the ledger naming the new candidate in full, one exit line in iteration 3 | fixed by this release commit: the gate names `d5861ddb` as `verifiedCommit` and iteration 3's candidate, iteration 3's five reviews are at `docs/evidence/reviews/0.3.18/iteration-3-d5861ddb/` (run one's `iteration-3/` byte-identical), and this section names the candidate in full and ends with its one exit line |
| V3-34 | PL-36 | non-blocking | the route (iteration 3 run again) contradicted item 8's rule, and nothing recorded the decision | fixed by this release commit: this section records the decision that CO-554 joins 0.3.18 and why iteration 3 alone was run again; item 8 keeps its rule for a failure in items 2 to 6 and names this narrower re-entry |
| V3-35 | PL-37 | non-blocking | CO-554's note sat under `## Unreleased`, outside the published notes | fixed in d5861ddb: as V3-24 |
| V3-36 | PL-38 | non-blocking | the superseded release commit `a86481ca` is still a valid one and `v0.3.18-rc.1` points at it, while the close named rc.1 throughout and the release commit by no hash | fixed by this release commit: `a86481ca` and rc.1 are recorded superseded and not to be used (above item 0), items 0 to 2 name `v0.3.18-rc.2` and `signed-release-v0.3.18-rc.2`, and item 7 checks `git rev-parse v0.3.18^{commit}` against the release commit's full hash, which the handoff names once it lands |
| V3-37 | PL-39 | non-blocking | item 0's full run was never made, and rc.1 was built without it | fixed by this release commit: item 0 names the full run on `d5861ddb` (pending, run id recorded by the coordinator before the rc) and records that rc.1 was built before any full run |
| V3-38 | PL-40 | non-blocking | the register cannot change in the release commit: CO-554's target and this iteration's rulings | fixed: CO-554's target reads 0.3.18 in d5861ddb, inside the verified tree; the rest is fixed by the post-release commit (register rulings land on `main` after the release commit: CO-555 filed, the CO-549 update), the `78772e6d` pattern |
| V3-39 | PL-41 | non-blocking | (1) a rollback takes CO-554 away again, and at the rc's first start the dispatcher takes the waiting far-deadline requests inside N6's window; (2) a request older than seven days opened with a past packet deadline | ruled CO-555 (filed after the release commit) for (1) and the first-start burst, which item 3.1's announcement now names; (2) fixed in d5861ddb (V3-29), its residue ER-27 |
| V3-40 | DO-23 | blocking | every release document named `bba86bce` as `verifiedCommit` and excluded CO-554, so the preflight refused any tag above the fix | fixed by this release commit: the gate, this ledger and the handoff name `d5861ddb`; CO-554 is in *What 0.3.18 carries* and in `## 0.3.18` (d5861ddb); the rc is `v0.3.18-rc.2`; iteration 3's run-one reports stay as written and run two's take their own folder after the release commit (PL-42) |
| V3-41 | DO-24 | non-blocking | the route contradicted item 8, and the ledger recorded none of the close's acts already done (`a86481ca` on `main`, rc.1 and its run) | fixed by this release commit: as V3-34, and rc.1 (`a86481ca`, run 42689818347) is recorded as a rehearsal of a superseded release commit, not as item 2 |
| V3-42 | DO-25 | non-blocking | ER-22 has no home: the CO-549 row updated in `78772e6d` does not name it, nor does CO-553 | ruled CO-549 (row updated after the release commit): the update names ER-22, a signalled copy launchd did not start being replaced by launchd's within about a minute |
| V3-43 | DO-26 | non-blocking | CO-554's count of 80 failures was false: the log held far more that day | fixed in d5861ddb: the row, `packetDeadline`'s comment, the test name, the map entry and the commit message say 986 failures for 28 requests (10:19 to 21:34 UTC), recounted by run three over every log segment |
| V3-44 | DO-27 | non-blocking | (a) the spec's agreed `deadline:` ref changed without a date or a note to Observatory; (b) keys "only until the deadline" now means the cut deadline; (c) the CO-554 bullet's ten minutes beside CO-544's | fixed in d5861ddb for (c) and for (a) on Fabric's side (the spec says the ref changed on 2026-11-09); (a) on Observatory's side is upstream, its header wording, which the coordinator tells Observatory on the board; (b) moot while the dispatcher names no credentials |

### Run three, d5861ddb

| Finding | Level | Severity | What | Disposition |
|---|---|---|---|---|
| V3-45 | UX-25 | non-blocking | the ADR-0192 bullet still promised a restart "within a minute", while the **Upgrading.** line says about a minute and the bar is 70 s | fixed by this release commit: "(within about a minute)" in the ADR-0192 bullet of `## 0.3.18` (`CHANGELOG.md`) |
| V3-46 | UX-26 | non-blocking | a workflow taken back more than a week after it opened starts an agent whose keys are shut (`deadline-passed`) while the board's deadline is ahead | ruled CO-555 (filed after the release commit): open a new workflow when the frozen packet deadline has passed and the board's has not |
| V3-47 | ER-27 | non-blocking | ER-25's residue moved to the workflow's age: a far-deadline request keeps one workflow across its runs, so a run dispatched more than seven days after the opening reads its deadline as passed | ruled CO-555 (filed after the release commit): compare the frozen deadline before a take-back and open a new workflow when it has passed or is within `LAUNCH_MARGIN_MS`; a test with a refusal streak over seven days |
| V3-48 | ER-28 | non-blocking | ER-26's residue: the `-ends-held` write is not guarded by a freezing stand-in (a plant writing the deadline there passes all 57 run tests) | ruled CO-555 (filed after the release commit): a pass after a Switchboard refusal in the run test with `freezingObservatory`, asserting the `-ends-held` write names no `deadline:` |
| V3-49 | DA-15 | non-blocking | after a rollback to 0.3.17 a workflow 0.3.18 opened with a cut deadline cannot be taken back, a 60 s band of explicit deadlines regresses, and the rollback paragraph says nothing of open dispatcher workflows | ruled CO-555 (filed after the release commit): a sentence in the 0.3.18 rollback steps (let open board-dispatch workflows end first), the band decided there |
| V3-50 | DA-16 | non-blocking | a later run of a far-deadline request after its workflow's first week opens with keys shut while the dispatcher treats the request as live | ruled CO-555 (filed after the release commit): one change with UX-26 and ER-27 |
| V3-51 | PL-42 | non-blocking | run two's receipts cannot be in the release commit: the gate names one candidate per iteration and admits only the review files its receipts name | fixed by this release commit (the ledger route): run two's findings are rows V3-24 to V3-44 and sit in run three's receipts with those sources; run two's reports and receipts land on `main` after the release commit at `docs/evidence/reviews/0.3.18/iteration-3-0e501425/` |
| V3-52 | PL-43 | non-blocking | the candidate was on no remote and replaced run two's by an amend; updating that branch would need a force-push, landing `0e501425` would ship the old cut | fixed by this release commit and the coordinator's landing: `d5861ddb` goes to `main` by fast-forward from `78772e6d`, never over `fix/dispatch-packet-deadline`; `0e501425` is kept under `refs/archive/2026-11-09/fix-dispatch-packet-deadline` (on `origin`); this ledger names it superseded |
| V3-53 | PL-44 | non-blocking | release text at the candidate was stale beyond the hashes: `## Unreleased` in *What 0.3.18 carries*, CO-554 missing there, rc.2 named as the failure path's rc, the handoff's *Open* listing what `78772e6d` landed | fixed by this release commit: *What 0.3.18 carries* names `## 0.3.18` and CO-554; item 8 names `v0.3.18-rc.3`; the handoff's *Open* names the post-release register rulings instead |
| V3-54 | DO-28 | non-blocking | the board's default deadline is "never cut" only because the dispatcher marks no request urgent; the comment and the row do not say so and no test pins it | ruled CO-555 (filed after the release commit): the comment and the row name the dependency on `urgent: false`, and wiring urgency keeps the default deadline whole, with an `urgent: true` test |
| V3-55 | DO-29 | non-blocking | `d5861ddb` replaces `0e501425` rather than following it; moving the branch would be a force-push and leave the commit run two's reports cite on no ref | fixed by the post-release commit: run two's reports land on `main` after the release commit citing `0e501425`, which stays reachable under `refs/archive/2026-11-09/fix-dispatch-packet-deadline`; this ledger says run three's candidate replaces run two's (an amend on the same parent `78772e6d`) |

Exit for iteration 3: every finding has a disposition. Blocking findings open: none.
