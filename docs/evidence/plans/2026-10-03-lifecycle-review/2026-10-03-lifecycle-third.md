# Lifecycle fixes: third independent verification (2026-10-03)

Subject: `15335a0a` ("fix(lifecycle): the confirmation review — unsaved work is kept, the dialog has a parent, the
lock holds") and the "Second amendment" in `docs/adr/0106-fabric-adopts-the-product-lifecycle-contract.md`.
Earlier reports: `lifecycle-review.md` and `lifecycle-confirmation.md`.

This was a read-only run. I made no repository edits and no commits. While I worked, `git status` showed changes
in `AGENTS.md`, `index.ts`, `ci.sh` and others, plus an untracked `background-launch.test.mjs`. They belong to
another session in this checkout and are not mine.

Environment and safety:
- The live stack (54321/54322) was never addressed.
  - One disposable stack, `fabric_test_af3e39b9` on API 55421 / DB 55422, created by `test-stack up` and removed
    by `down`. Afterwards `docker ps | grep fabric_test_` returned 0.
  - Scenarios without a stack ran with a stub `supabase` first on PATH and no `SUPABASE_*` variables. The stub
    answers `status` with exit 1 and `start` with `exec sleep 300`.
- Keychain: every launch used `--use-mock-keychain`, `FABRIC_NO_KEYCHAIN=1` and a PATH-first `security` stub
  (exit 44). The stub recorded **0 calls**.
- I did not rebuild `apps/desktop/out`. It was already built at 15:12 from `15335a0a`: `files:recovery-keep` is
  in `out/main` and `out/preload`, and the parent-window code is in `out/main`. Leaving it alone avoided disturbing
  a concurrent walk.
- No launchd job was touched, and install/uninstall was not run.
- All temp dirs, app processes and stub processes I started are gone.
- **Machine load was extreme for much of the run:** load average 40–138 on 14 cores (`sysctl vm.loadavg`). This
  matters for the timing finding in N-A.

Probes: `scratchpad/third/`:
- `app.mjs` drives the real built app through CDP;
- `lock/det.mjs`, `lock/interleave.mjs` and `lock/chaos.mjs` race the lock;
- `job/run.mjs` exercises `superviseJob` and rotation.

Logs: `third/run-*.log`, `third/stall-sample-1.txt`.

## Gates (all green locally)

| Gate | Result |
|---|---|
| `quit.test.mjs` | 8/8 pass (both real-Electron cases ran) |
| `quota-reader.test.mjs` | all green (it includes "the person returning after ten minutes re-reads the token") |
| `stack-services.test.mjs`, `editor-recovery.test.mjs` | pass (editor-recovery: 3/3) |
| `vitest run src/renderer/src/EditorWindow.recovery.test.tsx` | 4/4 |
| `node --test bounded-run walk-cleanup workspace-release` | 27/27 |
| `session-bundle.test.mjs`, with `claude` on PATH and with it removed (`command -v claude` → none) | both "all green" |
| `docs/audit/2026-09-09-provider-accounts.probe.mjs` (stubbed `security`, temp `CLAUDE_CONFIG_DIR`) | exit 0, PASS/FIXED/STILL TRUE lines as before |
| Hosted CI on `15335a0a` | `ci` **success** (runs 37125374726 and 37125372820). `workspace publication` fails as "stale" until a sync pins |

The planted orphan-dialog shape still reproduces: the fixture in `dialog-orphan` mode was alive 20 s after SIGTERM
and needed SIGKILL. So the dialog test discriminates. That mode is not itself a test in the suite.

## Previous open items

| Item | Verdict | Receipt |
|---|---|---|
| N1: SIGTERM swallowed with unsaved work | **CONFIRMED-FIXED** (by design change) | Dirty editor + SIGTERM: exit 0 in 277–328 ms (`run-r1r2b`, `run-qm`, `run-ia`); the record is kept |
| N2: "Keep editing" not honoured | **CONFIRMED** (moot) | A quit no longer asks. The buffer is kept and offered back |
| N3: "Discard and close" drops the quit | **CONFIRMED** (moot) | Same reason |
| N4: a crashed dirty editor blocks the quit | **CONFIRMED-FIXED** | Renderer killed with -9, then SIGTERM: exit 0 in 282 ms |
| N5: `files:unsaved` accepted from any renderer | **CONFIRMED** (removed) | The new recovery IPC is root-checked; see m-R4 |
| M4: SIGTERM with the startup-failure dialog | **CONFIRMED-FIXED** | Corrupt `active-estate.json`, no inspector: exit 0 in 308, 337, 432 and 403 ms (`run-sfc`) |
| M4: Retry | **CONFIRMED** | I pressed the sheet's Retry through System Events after repairing the estate. Windows afterwards: only `@fabric/desktop`, so the parent window does not linger |
| L1: stale takeover double holder | **PARTIAL** | The claim generations hold. A **different** double-holder path remains (N-C) |
| L2: lock identity depends on locale/TZ | **CONFIRMED-FIXED** | Regression test passes. Separately, a contender whose `ps` fails still steals a live lock (m-L1, pre-existing) |
| Q1: cached token survives an account switch | **CONFIRMED** | `personReturned` on `browser-window-focus` drops a token held over 10 min; unit test passes |
| Q2: `expiresAt` unit | **CONFIRMED** | A value below 1e12 is read as seconds |
| m5: spawn or parse error counted as denied | **CONFIRMED** | `typeof err.code === 'number'` → denied; anything else → `unreadable`, which does not hold |
| m6: guard runs before the status record | **CONFIRMED** | A refused guard exits 1; the existing `sync-status.json` is unchanged (`job/run`: status=previous-run) |
| m7: log | **CONFIRMED** | Copy-truncate with an `O_APPEND` writer: live file 6 B after rotation, `.1` 2048 B, mode 600. A non-append writer would leave a 2054 B sparse file, but launchd's `StandardOutPath` appends |
| m8: "consistent" limits | **NOT accurate** | m-S1 |
| m9: git helpers bounded | **CONFIRMED** | `workspace-snapshot.mjs#git` and `workspace-sources.mjs` have 120 s, SIGKILL and BatchMode/ConnectTimeout |
| m10: hanging-step test | **CONFIRMED** | Test present. Real run: watchdog → exit 124, status `timeout`, step gone |
| m12: `walk.json` written before the quit step | **CONFIRMED** | `start-paths.mjs` pushes the step, then writes the file. The walk uses a throwaway `CLAUDE_CONFIG_DIR` |
| m13: quit during the splash | **CONFIRMED** | SIGTERM during a hanging `supabase start`: exit 0 in 171 ms and the stub is gone. A side effect is m-R6 |
| m14: `--purge` guard | **PARTIAL** | m-S3 |
| m15: job PATH | **CONFIRMED** | It covers node, git, heroku, pnpm, npm, python3, rg, docker, supabase, gh and uv; `ci.sh` calls nothing outside them |
| B0: session-bundle on Linux | **CONFIRMED** | Green locally both ways; hosted `ci` success |

Editor recovery, the paths that hold, all measured on the real app:
- **Kept as typed:** 0600 file in a 0700 dir, named `sha256(realpath)[:32]`.
- **SIGTERM and Cmd+Q both flush the last keystrokes:** text typed less than 50 ms before the quit was in the record
  for both `app.quit` and SIGTERM.
- **kill -9 of the main or of the renderer:** the debounced copy survives.
- **Restore then save:** disk equals the buffer and the record is removed.
- **Changed on disk:** the diff editor opens and the disk is unchanged. "Keep mine and save" overwrites with a grant
  and removes the record.
- **Discard:** the record is removed and the file is unchanged.
- **Path outside roots:** keep, read, `../` traversal and flush are all refused with `OutsideRoots`, the same way
  `files.read` is.
- **Size and input checks:** a buffer over 10 MiB gives `too_large`; content that is not a string gives `invalid`.
- **Startup:** the 30-day sweep and the 50-record cap are present.

## New findings

### Blocking
None.

### Major

**N-A. LC-01 "SIGTERM ends it within 10 s" fails under heavy load, and the quit deadline does not bound it.**

Measurements:
- With the real app, no CDP client, no `--remote-debugging-port` and no inspector, idle main window, I sent SIGTERM
  in 16 rounds (`run-pq`). Results included **27 027 ms**, 12 527 ms and 7 729 ms. **All exited with code 0**,
  never with code 3.
- With an open editor (`run-st`, 12 rounds), every page socket closed at +207–219 ms, so the drain and window close
  were prompt. The process then exited at 1.9 s, 4.1 s, 18.9 s and 25.7 s, or was **still alive after 40 s**
  (twice; I killed it with SIGKILL).
- One stalled process (`stall-sample-1.txt`, `run-s2`, still ALIVE after 60 s) had no child processes left. Its main
  thread was parked in `ElectronMain → … → mach_msg2_trap` for all 1705 samples. A LaunchServices exception queue
  thread was active.
- Every stall happened at load ≥ 55, most at ≥ 90. At lower load, quits took 140–330 ms.

Cause:
- The stall comes after `will-quit`: windows and helpers are gone, and the main thread waits, likely on a system
  service.
- `quit.ts` arms the deadline as a libuv `setTimeout`, and libuv timers no longer run in that phase.
- The `quit.ts` comment says the deadline covers "whatever stalls — a drain, a renderer that cancels unload,
  Electron's teardown". That is not true for teardown.
- This is probably not introduced by `15335a0a`.

Impact and fix:
- A walk's 15 s `endApp` grace, and launchd at logout, can see `killed`.
- Fix: a watchdog that does not depend on the event loop. Options: a native/worker thread, or a detached helper
  armed at `before-quit` that sends SIGKILL to the pid after N s, like `exitWithin` in `bounded-run.mjs`.

Two measurements I discarded as artifacts:
- With `--inspect` attached, the process printed "Waiting for the debugger to disconnect".
- In two runs my `sample` tool suspended the target for its 15 s timeout.

**N-B. The kept buffer is lost if the person types before choosing Restore or Discard.**

Real app, `run-r5r7`:
1. A record holding "HOURS-OF-WORK" was offered on relaunch.
2. I typed one character without choosing. The record on disk became `"Zhello\n"`, so the work was already
   overwritten.
3. I deleted that character, which made the buffer equal the file. The record was **deleted**, while the banner
   still offered Restore from memory.
4. After a quit, the next open offered nothing. The work is gone without a Discard.

Cause and fix:
- `EditorWindow.tsx`, `onDidChangeModelContent`, keeps `isDirty ? value : null` while `recovered` is pending. Any
  edit replaces or deletes the kept record.
- The same path loses it if the person types and then quits: the flush replaces the old buffer.
- SCN-034 ("nothing is lost") and the amendment ("§1 holds without exception") are therefore false.
- Fix: do not keep or discard under the same key while an offer is pending (or keep it under a second slot). Make
  only an explicit Restore or Discard settle the record.

### Minor

**N-C. Lock: a fresh holder can still be overwritten (`bounded-run.mjs#acquireLock`).**

Mechanism:
1. P's exclusive link fails with EEXIST.
2. The holder releases, so P's `readHolder` hits ENOENT and returns `held=null`, which P treats as the
   "unreadable" stale token.
3. P creates the claim `unreadable.0`. Its re-read also finds no file, so the null-to-null comparison says
   `sameStale` is true.
4. A fresh contender W links the lock in that window.
5. P's `renameSync` overwrites W. Both believe they hold the lock.

Receipts:
- **Deterministic repro:** `lock/interleave.mjs` → `{"PgotLock":true,"WcreatedExclusively":true,"lockFileNames":"P"}`.
- **Chaos run** (12 racers, random SIGKILL mid-acquire and mid-hold, generations 0–2 observed): 1 overlap and 1
  lost ownership in 266 holds.
- Four other chaos runs (190, 221, 160 and 266 holds, up to 24 racers) had 0 overlaps, 0 wedges, and the final run
  always acquired.
- In practice this is rare: there are at most 2–3 contenders.

Fix: on ENOENT, retry the exclusive create instead of taking over. Only rename over a file that exists and cannot
be parsed.

**N-D. Lock: generation exhaustion is a permanent, silent wedge.**
- With 16 dead claims for one dead holder, every run returns `null`. The sync reports `locked` and exits 0
  (`det.mjs` case 1: A=false, B=false).
- It needs 16 deaths between claim and rename. A failure while writing `.win.tmp` (disk full on this machine)
  leaves exactly such a claim each run.
- Claims are never reaped, and SIGKILLed contenders also leave `publish.lock.*.tmp` files behind (6–42 per chaos
  run).

**N-E. Two editor windows on one file.**
- `fileWindows` is keyed by the raw path, but recovery is keyed by the realpath. Opening `repo/./note.txt` beside
  `repo/note.txt` gives two windows that share one record, and the last writer wins.
- Measured: window 2's typing replaced window 1's record. At quit, the last flush won and window 2's work was lost
  (`run-r7b`).

**N-F. "Take the version on disk" leaves the kept record.**
- After choosing the disk version in the recovery conflict, the record stays, and the next open offers the same
  buffer again (`run-r3r4`).
- The pre-existing save-conflict "take disk" path does the same with the debounced buffer.

**N-G. Reopening a file whose editor renderer crashed only focuses the dead window.**
- There is no `render-process-gone` handling. After the renderer was killed, `openFile` focused the crashed window
  and opened no new one: `crashed:true, focused:true`.
- The kept buffer cannot be offered back until the person closes that window. This is pre-existing, but recovery
  now depends on it.

**m-S1. Watchdog limit math (`workspace.mjs`).**
- The comment says "a publish holds at most two gates, two workspace checks and its git" and budgets
  `LIMIT.publish = 60+20+6×3 = 98` min.
- The main publish path runs **8** git `run` steps (fetch, add, commit, push origin, push heroku, add, commit,
  push), so the worst case is 104 min plus the sync `git()` helpers.
- The sync runs about 28 min of steps before the publish child starts (plus 2 min per source `fetchTip`), and its
  watchdog is 110 min. The watchdog can therefore end a publish mid-way, for example between the heroku and origin
  pushes.
- Everything is still bounded; the ADR's "consistent" claim is the inaccurate part.

**m-S2. Two quick signals orphan a step and leave the status at `running` forever.**
- Two SIGTERMs (or two Ctrl+C presses) 30 ms apart: the job died by signal, `sync-status.json` stayed `running`,
  and the step (`sleep 300`, in its own process group) was **still alive** (`job/run`).
- Cause: `process.once` removes the handler. `killAll` → `killTree` runs a synchronous `ps -A` before killing the
  group, so the second signal's default action lands first.
- Fix: kill the group first, then walk descendants; ignore repeated signals.

**m-S3. The `--purge` guard (`install-workspace-sync.sh`) is bypassable, and the checkout removal is unguarded.**
- `case "$STATE" in "$HOME"/.cache/?*)` matches `$HOME/.cache/..`, which would `rm -rf` the home folder, and
  `$HOME/.cache/../Documents`. Tested with echo only.
- `rm -rf "$CHECKOUT"` (from `FABRIC_WORKSPACE_SYNC_DIR`) has no guard at all.
- Fix: resolve the path with `pwd -P` and require it to sit strictly under a resolved `~/.cache`. Apply the same to
  CHECKOUT.

**m-R6. A quit during the splash writes a false startup failure and builds the failure window.**
- After SIGTERM during `supabase start`, `startup-failure.log` reads `stack-start-timed-out / The local stack did
  not finish starting within four minutes.` The stack had run for about 3 s.
- `ops.failed('startup.bootstrap')` is recorded as well.
- `explainAndQuit` creates the parent `BrowserWindow` before checking `quit.quitting`. The exit was still 171 ms.

**m-R4. Recovery IPC is reachable from any window.**
- The main window could `recoveryKeep` and `recoveryRead` a record for a repository file
  (`{"content":"FROM-MAIN-WINDOW"…}`).
- It is bounded and root-checked, so this is a consistency note rather than a hole.

**m-L1. A contender whose `ps` fails takes over a live holder (pre-existing).** `startOf` returns null, so
`holderAlive` returns false (`det.mjs` case 4: contender won while the holder was alive). A 5 s `ps` timeout under
load would do the same.

**m-P. Privacy (acceptable, noted).**
- Records are 0600 in a 0700 dir and the file name is a hash. However, the JSON stores the full path and the unsaved
  content in plain text for up to 30 days.
- That includes unsaved edits to secret files (`.env`). The copy outlives deletion of the source, and Time Machine
  backs it up.
- Stricter than a typical 0644 source file, but it is a second, longer-lived copy.
- A buffer over the cap gives `too_large`, which the renderer ignores silently. Files over 2 MB cannot be opened
  anyway.

**m-Q. A malformed Keychain item is read again on every hold expiry.**
- `unreadable` is deliberately not held, so a malformed (non-JSON) item is re-read with `security` each time the
  10-minute credential hold expires.
- That is a timer-driven Keychain read, which LC-04 forbids. It is an edge case.

## Docs against code

| Claim | Verdict |
|---|---|
| SCN-034 / amendment: "nothing waits and nothing is lost", "§1 holds without exception" | **False**: N-B, N-E. "Nothing waits" is true |
| Amendment / SCN-034: a file changed on disk opens the diff and is never overwritten silently | True (measured) |
| AGENTS / ADR / `quit.ts`: SIGTERM ends it within 10 s, exit 3 when the deadline ends it, teardown covered | True at normal load. **False under heavy load** (N-A: exit 0 at 12–27 s; alive after 40–60 s) |
| Amendment: the dialog sheet quits in about 1.6 s | True (0.3–0.43 s on the real app) |
| Amendment: "no contender deletes another's claim" | True. One-holder exclusivity still has the N-C gap |
| Amendment: "the limits are consistent" | Inaccurate (m-S1) |
| Amendment: "`--purge` removes state only under ~/.cache" | Bypassable (m-S3) |
| AGENTS row: log in `~/Library/Logs/Fabric/`, 0600, copy-truncate; 110 min watchdog | True |
| Amendment: new tests run in `apps/desktop` `pnpm test` | True (`package.json` adds quit, stack-services and editor-recovery) |

Note: while I was writing this, another session modified `scripts/install-workspace-sync.sh` in the working tree (uncommitted). m-S3 refers to the file as committed at `15335a0a`.
