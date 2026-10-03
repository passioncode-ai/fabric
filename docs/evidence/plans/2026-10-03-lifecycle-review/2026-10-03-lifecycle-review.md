# Lifecycle changes: independent verification (2026-10-03)

Subject: `bbfd52eb` (fix(lifecycle)…), `fa0b1139` (the gate's findings), `05d6f7e4` (docs). Tree read at
`origin/main` = `9ae998ca`. Read-only review: no repository edits and no commits. The live stack (54321/54322) was
not touched. Database work went through `node scripts/test-stack.mjs run -- …` only (stack `fabric_test_78471ab7`,
API 55421 / DB 55422, removed afterwards). Every scratch process, temp directory and throwaway keychain I created
was removed. No container is left behind.

## What holds (measured)

- **The real built app now quits.** I ran `apps/desktop/out` (built 13:17 today, contains `hardDeadlineMs`) on a
  disposable stack with `--use-mock-keychain` and a stubbed `security`. Idle SIGTERM: **exit 0 after 158 ms**.
  With a live shell PTY session: **exit 0 after 2152 ms**. CO-191's core defect is fixed in the product, not only
  in the fixture. (Probe: `scratchpad/realapp/probe.mjs`, log `scratchpad/realapp/run.log`.)
- In a real Electron 44 process, the deadline timer fires even though it is unref'd: a stalled shutdown exited at
  +10 036 ms. A 9.5 s drain completed and exited normally at 9.65 s. Quitting during startup (`ready()` false)
  exits gracefully in 53 ms. (Probe: `scratchpad/qa/main.mjs` + `run.mjs`, using the production `quit.ts`.)
- Every main-process loop is registered with the coordinator: the cycle `ticker` (index.ts:1914/1918), the
  `notifier` (2728/2780) and transcript recovery (680–701). The splash `tick` (383) is cleared in its `finally`.
  `main/` has no other `setInterval`.
- `security` exits 44 for "item not found". I measured this on a throwaway keychain with an explicit path, then
  deleted the keychain. That is the `absent` branch. Other refusals (`-128`→128, `-25293`→51, `-25308`→36)
  fall to `denied`, which is the intended policy.
- The dated probe `docs/audit/2026-09-09-provider-accounts.probe.mjs` still runs. Its span (readToken→realFetch)
  now includes `readKeychainToken`, and it still sees the `Claude Code-credentials` service read. All PASS/FIXED.
- Stack exclusions: I grepped `apps/desktop/src`, `packages/*`, `scripts/lib`, the migrations and
  `supabase/` (there is no `functions/`). There is no `.channel(`, `storage.from`, `functions.invoke`,
  `/storage|realtime|functions/v1`, studio, mailpit or pooler port. The only hit is `auth.uid()` in migrations,
  and gotrue/auth is not excluded. `supabase start --help` (CLI 2.114.0) accepts every name in the list. An
  already-running full stack is left as is: `resolveEnvStartingStackIfNeeded` reads status first and starts
  nothing. This matches ADR §4 "Consequences".
- The proportional gate (`fabricChanged = !receiptSource || sourceChangedSince(...)`) holds by induction: a
  receipt only exists for a source that was gated or differs from a gated one only in publication paths. A
  diverged branch (receipt source not an ancestor) gates. **I found no case where a manual publish skips the gate
  wrongly.** `pnpm install` runs only in the sync, after the checkout guard. It never runs in a dev checkout.
- Tests pass locally: quit (7/7), quota-reader, stack-services, bounded-run, walk-cleanup and workspace-release
  (18/18).

## Findings

### BLOCKING

**B1. CI `fast` has been red on main since the lifecycle commits landed: the real-Electron quit test runs on Linux.**
- Receipt: run 37119372339 (main @ 9ae998ca) and 37118117108 (84209c61). In both,
  `✖ a real Electron main process exits gracefully on SIGTERM … Error: the fixture exited before ready`
  at quit.test.mjs:144. `ci.yml` runs `fast` on `ubuntu-latest` with no display and no xvfb.
  `scripts/ci.sh:191` runs the test unconditionally. The other Electron-main suites are Darwin-only
  (`ci.sh:344` `if [ "$(uname)" = Darwin ]`).
- Fix: guard the real-process case the same way (a `NOT_RUN:` line off Darwin), or run it under
  `xvfb-run` with `--no-sandbox` on Linux. Keep the model tests unconditional.

**B2. Live right now: the scheduled workspace sync is wedged. A Node exit deadlock reproduces the 5 h wedge the
ADR says is fixed.**
- `ps`: sync pid 26961 (started 13:23:04, ppid 1) → publish pid 28261 (same pgid, i.e. spawned by the OLD
  `execFileSync`), both idle for 21+ min. No `~/.cache/fabric-workspace/sync-status.json` exists. The log is
  22.8 MB and was not rotated. `launchctl print` shows `runs = 1, last exit code = (never exited)`.
- Why: the sync process loaded the pre-lifecycle `workspace.mjs` from its checkout (at 24e79cf5). It checked out
  9ae998ca and spawned the new `publish`. That publish threw at `workspace.mjs:71`
  (`git merge-base --is-ancestor origin/main HEAD`: fabric-workspace main moved `9c1e373..fbbae40` during the
  run) and never exited.
- `sample 28261`: main thread in `TriggerUncaughtException → Environment::Exit → DisposePlatform →
  WorkerThreadsTaskRunner::Shutdown → uv_thread_join`. A V8 worker is in
  `ConcurrentBaselineCompiler → … → TriggerAndWaitForGCFromBackgroundThread`. This is a Node 26.8.2 exit-path
  deadlock (`scratchpad/publish-sample.txt`).
- Impact: launchd skips every interval until someone acts. The `workspace publication` check on main fails with
  "Workspace is stale" (run 37119372333).
- Action (operator): kill 28261. The old sync then returns and exits. I did not touch it because I did not start
  it. Code consequences: see M8.

### MAJOR

**M1. Nested `boundedRun` leaves orphans (ppid 1). The watchdog, the step timeout and SIGTERM do not end
grandchildren.**
- `boundedRun` spawns every step `detached: true` (bounded-run.mjs:29), so each step leads its own group. The
  publish child's steps (`bash scripts/ci.sh fast`, git, npm) are new groups, not part of the publish group. The
  sync's `killAll()` / step timeout SIGKILLs only the publish group, so the publish process cannot run its own
  cleanup and its steps survive.
- Reproduced: outer `boundedRun(node inner.mjs, 1.5 s)`, where inner runs `boundedRun(bash -c 'sleep 300')`.
  Result: `outer saw: TIMEOUT after 2 s` and the survivor was `43047 ppid 1 pgid 43047 sleep 300`
  (`scratchpad/br/`, killed afterwards).
- This contradicts the module comment ("a timeout ends everything it started — ci.sh and its test processes
  included") and LC-02.
- Fix: detach only at the top. Pass `FABRIC_BOUNDED_GROUP=1` and spawn non-detached inside, or have the outer send
  SIGTERM with a grace period and give `publish` a SIGTERM handler that calls `killAll()`. Add a two-level test.

**M2. The "machine-wide lock" is not exclusive under contention.**
- `acquireLock` creates the file with `openSync('wx')` and writes it afterwards (bounded-run.mjs:75–77). A
  contender that reads the still-empty file treats it as "torn → stale", removes it and takes it. The stale
  takeover (`rmSync` then `open wx`, lines 84–85) is also a check-then-act race.
- Measured with real processes on one lock file (holders overlapping in time):
  - two contenders started together: **20/20 rounds had two holders**;
  - six contenders: 19/20;
  - stale-lock takeover with two contenders: 5/20 (`scratchpad/br/race.sh`).
- A dead holder whose pid was recycled is also "alive" forever (line 84), and the `at` field is never used.
- Fix: write `{pid,token,at}` to a temp file and `linkSync(tmp, lock)`, which is atomic. Treat unparseable content
  as held unless its mtime is older than the watchdog. Take over a stale lock with `renameSync` on a unique name
  and re-read before claiming. Treat `at` older than watchdog + margin as stale even when the pid is alive. Add
  a concurrent-acquire test with N processes.

**M3. Cmd+Q with an unsaved editor loses the work after ≤10 s, silently, exit 0.**
- `EditorWindow.tsx:184–193` cancels its close from `beforeunload` (UX-05). The coordinator's deadline is armed at
  the first quit request (quit.ts:78) and is never disarmed when Electron cancels the quit.
- Reproduced in real Electron with a `beforeunload` window. The log shows
  `before-quit → shutdown → before-quit(re-quit) → … DEADLINE at +10 136 ms → exit 0`.
- The "save your changes?" UI gets whatever is left after the drain (up to 8 s of it), and then the process is
  hard-exited.
- Fix: for an interactive quit, ask the editor windows before draining (or listen to `will-prevent-unload` and
  cancel the quit: reset `quitting`, clear the deadline timer, restart schedulers). Keep the hard deadline for
  signals and logout.

**M4. While the startup-failure dialog is open, SIGTERM does nothing. The process lives on with no deadline.**
- `explainAndQuit` loops on `dialog.showMessageBoxSync` (index.ts:4052). The nested modal loop does not service
  the shutdown signal, so `before-quit` never fires and `begin()` never arms the deadline.
- Reproduced (fixture `dialog` mode): SIGTERM sent 1 s after the modal opened, and the process was **still alive
  25 s later**, so I SIGKILLed it.
- A walk against a failing start therefore reports "killed", and launchd or logout cannot end it.
- Fix: use async `dialog.showMessageBox` in the loop so the event loop and the quit coordinator keep running.

**M5. The hard deadline exits with code 0, and the walk's grace equals the app's deadline, so a stalled drain can
pass the walk as "terminated".**
- quit.ts:78 calls `app.exit(0)`. `endApp` uses `graceMs = 10_000` (cleanup.mjs:35), which is the same 10 s.
- Measured: a stalled shutdown exits `code=0 signal=null` at +10 036 ms. When the walk's 10 000 ms SIGKILL loses
  the race, the result is `terminated`, which is exactly the CO-191 class the step exists to catch.
- Fix: exit non-zero at the deadline (e.g. `app.exit(70)`). Make the walk grace deadline + margin (≥15 s), and fail
  the walk on `app.quit-deadline` in the ops log.

**M6. In steady state the Keychain is read on a timer, about 31 `security … -w` calls per hour.**
- After a successful reading there is no hold. When the 120 s TTL expires, the next 60 s renderer poll calls
  `token()` → `readKeychainToken()` again (quota.ts:282, 289–293).
- Probe with an injected token counter and 60 s polls for 1 h: `credential reads=31, usage requests=31`
  (`scratchpad/quota-probe.mjs`).
- This contradicts ADR §2 ("at most once per hold … never in a loop") and AGENTS.md:144–145. LC-04 says
  "never `/usr/bin/security … -w` on a timer".
- Fix: keep the bearer in memory once read. Drop it on a 401/403, on `forget`, or on unlock. Usage polling can
  stay on its TTL.

**M7. The walk reads the operator's real Claude credential and may cause Keychain prompts.**
- `start-paths.mjs` spawns the app without `--use-mock-keychain`, without a `security` stub and with the real
  `HOME` (start-paths.mjs:62).
- The real app runs `security find-generic-password -s Claude Code-credentials -w` as soon as the window opens.
  My stub logged one call per launch (`scratchpad/realapp/run.log`). In a walk this reads the real token and
  sends it to api.anthropic.com.
- This breaks LC-14 (tests never touch the real user domain) and LC-04.
- Fix: the walk adds `--use-mock-keychain`, a PATH-first `security` stub (exit 44) and a throwaway
  `CLAUDE_CONFIG_DIR`, or the app gains an env switch that disables the quota credential read.

**M8. The new watchdog also depends on `process.exit`, the path that deadlocked in B2.**
- `finish()` (workspace.mjs, sync branch) and the default uncaught-exception exit in `publish` both go through
  `Environment::Exit → DisposePlatform`.
- If that deadlocks in the sync process itself, after a step timeout or the watchdog, the supervisor hangs and
  launchd skips intervals again. The 75-min step bound only limits a hung child.
- Fix: on terminal paths, write status, flush, then `process.kill(process.pid, 'SIGKILL')` (a JS-side SIGKILL
  cannot deadlock). Give `publish` an `uncaughtException` handler that does the same, and have the parent map
  SIGKILL-after-status to "failed". Separately, report the Node 26.8.2 deadlock upstream with the stack above.

### MINOR

**m1. A second SIGTERM during a drain hard-kills the app.**
- Measured: 3 s drain, second SIGTERM at +1 s → `code=null signal=SIGTERM` after 1011 ms, with no shutdown-end
  (Chromium's handler is one-shot).
- launchd, a walk interrupt and `kill` twice abandon the drain receipts.
- Fix: own SIGTERM/SIGINT in main (`process.on(sig, () => app.quit())`), which is idempotent through the
  coordinator. Prove it with the probe above.

**m2. No deadline margin.**
- The legitimate bounds add up to the deadline: Stop is 8 s (nativeStopRuntime.ts:80, attempts run in parallel)
  and `surface.stop()`'s grace is 2 s (closeHttpServer.ts), which equals `QUIT_DEADLINE_MS` (10 s, quit.ts:44).
- The worst legitimate drain is cut and logged as `app.quit-deadline`.
- Fix: derive the drain budget from the deadline (e.g. a 7 s Stop budget during quit), or set the deadline to
  12 s and check it against LC-01's ≤10 s busy bound.

**m3. Unlocking the screen drops every hold, including 429 back-offs.**
- `quota.forget()` with no key (index.ts:737) clears every hold, including a 429's `Retry-After`, the failure
  back-off and the cached readings.
- Probe: after a 429 with `Retry-After 3600`, then forget, a request goes out at t = 120 s.
- Fix: on unlock, reset `keychainRefused` and clear only `no-credential` holds.

**m4. A Keychain refusal or timeout is shown as "not signed in".**
- `readToken` falls through to the file branch and returns null, so the reading is `no-credential`:
  "No credential to read it with — Claude Code is not signed in on this machine." (en.ts:186). That is the
  invented diagnosis the M199 comment warns about.
- Fix: add a `keychain-refused` problem.

**m5. `denied` also covers non-refusals.** It catches a JSON parse failure of the item and a spawn error
(quota.ts:172–176), so they are mislabelled and lock out the Keychain until unlock.

**m6. A manual `sync` overwrites the scheduled job's status.** `sync` writes the machine-wide status record and
takes the lock *before* the checkout guard (workspace.mjs:127–129). A refused manual `sync` in a dev checkout
replaces the scheduled job's record with running → failed. Move the status write after the guard.

**m7. Log rotation has several gaps.**
- Rotation renames the file launchd holds open. The rotating run writes into `.1`, the first `.1` is
  unbounded (22.8 MB today), and `$LOG` does not exist until the next run, so `--status` shows no tail.
- The log is 0644 at the root of `~/Library/Logs`. LC-12 asks for 0600 in a product directory.

**m8. The step limits are inconsistent.** `LIMIT.publish` (75 min, workspace.mjs:17) is less than what publish
may legitimately spend: two gates at 40 min each, plus npm test and verify at 10 min each, plus git.

**m9. ADR §3 says workspace.mjs "runs nothing without it" (boundedRun). The helpers do.**
- They call `execFileSync('git' …)` (workspace-snapshot.mjs:11) and
  `execFileSync('heroku' …)` **with no timeout** (workspace-release.mjs:59).
- `fetchTip` sets no ssh BatchMode.
- The test only regex-checks workspace.mjs's own imports.

**m10. The contract's own checks are missing.**
- No test hangs a sync step and asserts a non-zero exit plus the status record (LC-03). The workspace test is a
  regex.
- LC-01's "busy product" check runs only on a fixture. My real-app run covers it; the repository does not.

**m11. AGENTS.md:144 says "Fabric opens no listening port of its own".** That is false: `agentSurface.ts:285`
listens on `127.0.0.1:0`. LC-09 requires naming the ports the product owns.

**m12. The walk receipt omits the quit verdict.** `walk.json` is written (start-paths.mjs:209) before the
`app-quits-gracefully` step is pushed (216), so a walk can exit 1 with every recorded step OK.

**m13. A quit during startup orphans `supabase start`.** Quitting during the splash (`ready()` false) lets the
app exit while `supabase start` (`execFile`, 240 s) keeps running with ppid 1 (LC-02).

**m14. `--purge` runs an unguarded `rm -rf`.** `install-workspace-sync.sh --uninstall --purge` runs
`rm -rf "$STATE"` from `FABRIC_WORKSPACE_STATE_DIR` without checking what it points to.

**m15. The job's PATH is built from only 5 tools.** `ci.sh fast` also needs python3, rg and more. It works here
only because they all live in `/opt/homebrew/bin`.

**m16. The two new tests are wired into `ci.sh` only.** `quit.test.mjs` and `stack-services.test.mjs` are not in
`apps/desktop` `pnpm test`, so there are two lists of tests that can drift.

## Docs against code

| Claim | Verdict |
|---|---|
| ADR §1 / CO-191 closure: an idle app quits; the walk fails a killed app | **True for the product** (real app: 158 ms idle, 2.15 s busy). Exceptions: M3, M4, m1. The cited test is red in CI (B1). A deadline-forced exit can pass the walk (M5). |
| ADR §1 "a 10 s hard deadline ends the process if anything stalls" | False during a sync modal (M4). Elsewhere it holds, with exit code 0. |
| ADR §2 / AGENTS "reads Claude Code's item at most once per hold" | **False**: about 31 reads per hour in steady state (M6). |
| ADR §2 "a refused Keychain read is not retried by any timer" | True. The refusal is mislabelled as not signed in (m4). |
| ADR §3 "one machine-wide lock, never race" | **False under contention** (M2). |
| ADR §3 "killed whole on timeout" | **False for nested steps** (M1). |
| ADR §3 "runs nothing without it" | Partly false (m9). |
| ADR §3 watchdog / status / rotation | Present in code. Never ran in production yet: the live job still runs the old code and is wedged (B2). |
| ADR §4 / AGENTS stack row | True. |
| AGENTS "no listening port" | False (m11). |
| AGENTS "Cmd+Q / SIGTERM ends it within 10 s" | False for M3 (loses work), M4 (never), m1 (killed). |

## Transparency note

While checking for safeStorage use, I ran one attribute-only lookup by mistake:
`security find-generic-password -s "Fabric Safe Storage"`. It had no `-w`/`-g` and its output was discarded. It
reads no secret and does not normally prompt. It is reported here because the brief forbids Keychain access
beyond stubs.
