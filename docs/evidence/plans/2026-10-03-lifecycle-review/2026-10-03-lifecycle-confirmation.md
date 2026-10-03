# Lifecycle fixes: independent confirmation (2026-10-03)

Subject: `dcb3e458` ("fix(lifecycle): the independent review's findings…"), which is HEAD of
`claude/onboarding-and-plan` and of `origin/main`. Earlier report: `scratchpad/lifecycle-review.md`.

This was a read-only run. I made no repository edits and no commits, and `git status` is clean. The live stack
(54321/54322) was not touched. Disposable stacks: `test-stack run` twice (`fabric_test_473146e2`,
`fabric_test_d9a2a85b`) and `test-stack up/with/down` once (`fabric_test_e154a659`), all on API 55421 / DB 55422,
all removed (`docker ps | grep fabric_test_` → 0). For the Keychain, every app launch used `--use-mock-keychain`,
`FABRIC_NO_KEYCHAIN=1` and a PATH-first `security` stub (exit 44). The stub recorded **0 calls** across 8
real-app launches. Every process, temp dir and stack I started is gone. One side effect to disclose:
`workspace.mjs export` (step 6) runs `fetchTip`, which fetched into the shared cache
`~/.cache/fabric-workspace/sources`. The sync does the same fetch.

Probes are in `scratchpad/confirm/`:
- `app.mjs` drives the real built app at `apps/desktop/out` (built 14:00 and containing `files:unsaved` and
  `exit(3)`), through CDP plus the main-process inspector;
- `dmain.mjs`/`drun.mjs` are a dialog fixture that uses the production `quit.ts`;
- `race.mjs`, `racer*.mjs` and `late.mjs` race the lock.

Logs: `confirm/app-run.log` plus the outputs quoted below.

Numbering. The fix cites "finding 4…12". From its comments: 4=M8, 5=M1, 6=M2, 7=M3, 8=M4, 9=M5, 10=M6, 11=M7,
12=m3+m4. Items 1–3 are taken as B1, B2 and one of the uncited claimed items (heroku/m9, the AGENTS port/m11).

## Gates run (all green locally)

| Gate | Result |
|---|---|
| `node --experimental-strip-types apps/desktop/test/quit.test.mjs` | 9/9 pass (real-Electron case ran, 265 ms) |
| `apps/desktop/test/quota-reader.test.mjs` | "all green" (cache, forget, retryCredential cases included) |
| `node --test scripts/test/bounded-run.test.mjs walk-cleanup.test.mjs workspace-release.test.mjs` | 22/22 pass |
| the same bounded-run tests with `FABRIC_BOUNDED_RUN=1` leaked into the env | 12/12 pass |
| `node --experimental-strip-types docs/audit/2026-09-09-provider-accounts.probe.mjs` | exit 0: PASS / FIXED / STILL TRUE lines as before |

**Hosted CI on `dcb3e458` is still red, but for another reason.** Run 37121459542 shows the quit case as
`﹣ … # NOT_RUN: a real Electron window needs macOS or a DISPLAY`, so B1 is fixed. `fast` now fails later, at
`apps/desktop/test/session-bundle.test.mjs:183`: "spawn failed with Error, wanted SpawnFailure — a credential
outlives what it was minted for". It fails on Linux only and passes on macOS locally. That file last changed in
`47c8d804 fix(boundaries)`, not in a lifecycle commit. It was hidden behind B1 because `ci.sh` runs it at line
274, after `quit.test.mjs` at line 191. The `workspace publication` check is red with "Workspace is stale" until
the next sync publishes.

## Per finding

### B1: CI red on Linux, from the real-Electron test. CONFIRMED-FIXED
- The skip is `skip: noDisplay ? 'NOT_RUN: …'` (quit.test.mjs).
- The hosted run prints NOT_RUN instead of failing.
- CI is still red because of the unrelated session-bundle failure above.

### B2: the live sync wedge. RESOLVED operationally
- pids 26961/28261 are gone.
- `launchctl print` shows `state = not running, runs = 1, last exit code = 1`.
- The job's checkout is at `9ae998ca`. Its next run loads the bounded code; the `dcb3e458` lock arrives when
  that run checks out `origin/main`.
- Still true: the log is 22.8 MB, mode 0644, at `~/Library/Logs` (m7, not addressed). `sync-status.json` does
  not exist yet.

### M1: nested `boundedRun` orphans. CONFIRMED-FIXED
- A nested step now spawns `detached: !NESTED` inside the outer group. `killTree` kills the ps-snapshot
  descendants, then the group, then the pid.
- The new test "a timed-out run ends the nested runs it started too" passes.
- Side effects of the env propagation (`FABRIC_BOUNDED_RUN=1` reaches `ci.sh` and every test):
  - Only `workspace.mjs` and its tests use `boundedRun`, and the suite still passes with the variable leaked.
  - Latent: a top-level `workspace.mjs` started from an environment that already has `FABRIC_BOUNDED_RUN=1`
    runs every step non-detached and never group-kills a finished step. Its leftovers then survive with ppid 1.
    This is minor.
- `killTree` costs one `ps -A` (5 s timeout) per call, which is acceptable.

### M2: the lock is not exclusive. PARTIAL
Fixed for the common races (8 real processes per round):
- fresh start: **30/30** rounds had exactly one holder;
- dead holder with no takeover file: **30/30**.

Still broken:
- **A stale `<lock>.takeover` (a holder killed mid-takeover) plus contenders.** Over 40 rounds of 8 racers:
  - **4/40** rounds had a contender **throw `ENOENT`** out of `acquireLock` (`renameSync(takeover, file)` after
    another contender had moved it). The sync maps this to `failed`, exit 1, instead of stepping aside as
    `locked`.
  - **2/40** rounds had a winner whose lock file carries **another process's token**.
- Mechanism (`bounded-run.mjs`, the takeover block): `rmSync(takeover)` deletes a takeover that another
  contender has just created, and both then believe they own the takeover. The single `rename` moves one of them
  under the other's name. The winner's `release()` then no-ops, because the token does not match. Once the named
  loser exits, the lock looks stale while the winner is still working.
- **Proven end to end**: in `late.mjs`, a late run acquired the lock **while the winner still held it** in 1/60
  rounds. That is two publishers, the failure the lock exists to prevent.
- **Identity depends on locale and timezone.**
  - `startOf()` runs `ps -o lstart=` in the caller's environment:
    `LC_ALL=ru_RU.UTF-8` → `суббота,  3 октября 2026 г. 02:50:41`; `de_DE` → `Sa.  3 Okt.`;
    `TZ=UTC` → `00:50:41` against local `02:50:41`.
  - A holder that ran with `LC_ALL=ru_RU` (record `"started":"суббота,  3 октября…"`) was taken over **while
    alive** by a contender running with `LC_ALL=C` (`{"won":true}` with the holder still running; also with
    `TZ=UTC`).
  - A `ps` failure or timeout (`startOf` → null) also reads as a dead holder.
- Fix:
  - run `ps` with `env:{LC_ALL:'C',TZ:'UTC'}`, or compare a numeric start time;
  - never `rmSync` a takeover file that another process may have just created; take over a stale takeover by
    `rename` to a unique name and re-read;
  - treat `ENOENT` on the final rename as "lost";
  - after the rename, verify `readHolder(file).token === token` before returning.

### M3: unsaved editor work lost on quit. PARTIAL
Measured on the real built app, on a disposable stack. The editor became dirty: the head shows `unsaved` and the
text reads `UNSAVED-EDIT xyzhello`.

What holds:
- **Interactive quit (app.quit, as Cmd+Q):**
  - Request #1 left the app alive after 12 s and showed the editor's banner ("This file has changes that are
    not on disk… Keep editing / Discard and close").
  - Request #2 at +13 s **exited with code 0 after 248 ms**. The drain ran, `will-prevent-unload` overrode the
    editor's `beforeunload`, and the deadline was not needed.
- **Non-editor windows are never counted.** Only `EditorWindow` calls `reportUnsaved`. A destroyed or closed
  editor is dropped by both `destroyed` and `webContents.fromId → undefined`.
- **Can the first quit be blocked forever?** Not by a stale entry: the second request always passes. But every
  request that comes more than 60 s after the last question asks again (by design), so a supervisor that sends
  one signal at a time is never answered.

New defects in this flow:
- **N1 (MAJOR). With unsaved work, SIGTERM is swallowed with no deadline, and the second SIGTERM hard-kills the
  process.**
  - SIGTERM #1 left the app alive after 12 s with the banner shown. SIGTERM #2 gave
    `code=null signal=SIGTERM after 11 ms`: Chromium's one-shot handler, so no drain, no Stop receipts and no
    exit 3.
  - A single SIGTERM from launchd, logout, a walk or `kill` is therefore never answered until SIGKILL.
  - The AGENTS table says "a second within a minute quits anyway". For signals, the second one *kills*, and the
    amendment's "known and accepted" note covers only a second SIGTERM *during a drain*.
  - The earlier recommendation was to keep the hard deadline for signals and logout. Fix: own SIGTERM/SIGINT
    in main (`process.on(sig, …)`), apply blockers only to interactive quits, and for a signal either proceed
    or arm the deadline.
- **N2 (MAJOR, narrow). "Keep editing" is not honoured.**
  - Sequence: quit #1, the banner appears, the person clicks "Keep editing" (the banner closes, the text is still
    `unsaved`), then quit #2 about 6 s later.
  - Result: `EXITED code=0 after 255 ms`. The unsaved edit was lost and nothing asked again.
  - `askedAt` is never reset when the person chooses to stay. Fix: an IPC from the banner's "Keep editing" that
    resets the confirm window, or ask every time while blockers exist and let only an explicit "Discard" button
    continue the quit.
- **N3 (minor). "Discard and close" drops the quit.** The editor closes, the app stays running, and a second
  Cmd+Q is needed. On macOS, a quit that pauses for an unsaved document normally continues after "Don't save".
- **N4 (minor). A dirty editor whose renderer crashed blocks the first quit.**
  - After `Page.crash`, app.quit #1 left the app alive after 12 s, focusing a dead window that can show no
    banner. app.quit #2 exited with code 0.
  - Fix: drop the id on `render-process-gone`.
- **N5 (minor, hardening).** `files:unsaved` is accepted from any renderer. Main does not check that the sender
  is in `fileWindows`.
- **Logout: not measured.** I did not log out. Electron's `applicationShouldTerminate` returns cancel and calls
  `Browser::Quit`. With a dirty editor, the quit is blocked and macOS reports the logout as cancelled. This is
  plausible behaviour (it matches TextEdit), but nothing in the repository verifies it.

### M4: SIGTERM ignored while the startup-failure dialog is open. NOT-FIXED
- **Real built app.** A corrupt `active-estate.json` in a temp userData made `startup-failure.log` say
  `active-estate-unreadable`, and the dialog was up. SIGTERM #1 left the app **ALIVE after 20 s**. SIGTERM #2
  gave `code=null signal=SIGTERM after 7 ms`.
- **Root cause (fixture `dmain.mjs`, production `quit.ts`).** On macOS, `await dialog.showMessageBox(opts)` with
  **no parent window** still blocks the main thread:
  - not one 1 s `setInterval` tick fired while it was open;
  - SIGTERM #1 left it alive after 20 s;
  - two SIGTERMs gave `signal=SIGTERM`.
  - With a visible parent window (a sheet), SIGTERM gave `before-quit → dialog-closed quitting=true → exit 0`
    in **410 ms**.
  - Electron runs `runModal` for a parentless box whether the API is sync or async.
  - `explainAndQuit` passes no window: the splash is destroyed in a `finally` before the failure surfaces.
- Consequences:
  - The ADR amendment ("The startup-failure dialog is asynchronous, so a SIGTERM or a logout while it is open
    is answered") is **false on macOS**.
  - A walk against a failing start still ends as `killed`.
- Everything else in the path is correct: the `quit.quitting` checks stop Retry and the loop after a quit, and
  nothing loops or retries after a quit.
- Fix: give the dialog a parent, either a small visible window or by keeping the splash alive until it closes.
  Or have a main-side SIGTERM handler that calls `app.exit` directly while the modal is up (the coordinator
  cannot run inside `runModal`).

### M5: deadline exit code and walk grace. CONFIRMED-FIXED
- Real Electron with the production `quit.ts` and a stalled shutdown:
  `before-quit → shutdown-start → DEADLINE at +10 261 ms → exit 3` (`code:3` at 10 042 ms after the signal).
- `endApp` grace is 15 000 ms. Any non-zero exit maps to `signalled`, and the walk passes only on `terminated`.
- The quit test asserts `[3]`.
- Docs agree: AGENTS row, ADR amendment and the `cleanup.mjs` comment.
- Minor:
  - no test feeds exit 3 to `endApp` (the mapping is generic: `code === 0`);
  - m12 is still open: `walk.json` is written before the `app-quits-gracefully` step is pushed
    (start-paths.mjs, the `finally` block).

### M6: Keychain read on a timer. CONFIRMED-FIXED, with caveats
- The token is held until `expiresAt − 5 min`; a token without `expiresAt` is held 60 min.
- A 401 or 403 drops it, and only for the default reader (`!deps.token && !key`, which is production:
  `createQuotaReader()` with no deps).
- Unit tests pass. The dated probe still exercises the real seam: its span still contains `cachedToken` and the
  synthetic token has no `expiresAt`.
- Caveats (minor):
  - **The `expiresAt` unit is assumed to be milliseconds, with no guard.** If it were seconds, `until` would be
    in 1970, the cache would never hit, and the reader would silently fall back to a read on every reading. No
    receipt in the repository states the unit.
  - **An account switch is invisible until the token expires or is rejected.** `quota.forget()` no longer runs in
    production (there are no call sites), and neither unlock nor forget clears `cachedToken`. After
    `claude /logout` and a login to another account, Fabric keeps reading the **old** account's headroom
    (`account` = the old fingerprint) for up to the token's lifetime, unless the old token is revoked. That
    feeds `mayStart` for unattended work (FA-03 / M199 attribution). Before, the reader re-read every 2 min.
  - An already-expired item is never cached. It is re-read once per failure back-off (1→15 min), which is
    bounded and acceptable.
- `credential-refused` works:
  - it is set only for the default reader, when `keychainRefused` is set;
  - it has en and ru strings and is in both maps in `quotaReading.ts`;
  - `retryCredential()` clears only the `no-credential`/`credential-refused` holds and keeps a 429 (test passes).
- `FABRIC_NO_KEYCHAIN=1` is honoured in `readToken`. The stub recorded 0 calls.
- m5 is not addressed: a JSON parse or spawn error is still labelled `denied`.

### M7: the walk reads the real Keychain. CONFIRMED-FIXED
- `start-paths.mjs` passes `--use-mock-keychain` and `FABRIC_NO_KEYCHAIN: '1'`, and the walk-cleanup test
  asserts both.
- Residual (minor): the file fallback still reads `$CLAUDE_CONFIG_DIR`, defaulting to `$HOME/.claude`, under
  the real HOME. On this machine `~/.claude/.credentials.json` does not exist (checked with `test -e`, not read);
  on another machine the walk would send that token. Set a throwaway `CLAUDE_CONFIG_DIR` in the walk.

### M8: watchdog exits through `process.exit`. CONFIRMED-FIXED
- `finish()` and every non-sync error path (`die`) go through `exitWithin`: a detached `sleep 5; kill -9 <pid>`
  reaper, then `process.exit`. `die` is the `uncaughtException`/`unhandledRejection` handler.
- Measured:
  - `status` exit 0; `check` exit 1 on a stale workspace (unchanged semantics); an unknown command prints the
    usage stack and exits 1;
  - `export HEAD <tmp>` works (exit 0); export into the repository root exits 1;
  - `lag` keeps its explicit `process.exit(0|1|2)` (code read, not run: it needs the network);
  - no reaper process was left 6 s later.
- A reaper killing a recycled pid is theoretical. macOS pids are allocated sequentially (66529…66535 measured),
  so reuse within 5 s would need a full wrap of the pid space.
- The sync's lock and watchdog interplay is unchanged. `holdPublication` releases on `exit`, and that handler
  runs before Node's `DisposePlatform` step, so a reaper SIGKILL after it does not leak the lock.

### m-items the fix claimed
- **m3** (unlock clears 429): FIXED.
- **m4** (refused shown as not signed in): FIXED.
- **m9** (helpers unbounded): PARTIAL.
  - `heroku` now has `timeout:60000, killSignal:'SIGKILL'`.
  - `workspace-snapshot.mjs` `git()` still has no timeout.
  - `fetchTip` has 120 s but no ssh `BatchMode`/`ConnectTimeout`.
- **m11** (AGENTS listening port): FIXED.
- **m10** (contract checks): PARTIAL. Lock and nested tests were added; no test hangs a sync step and asserts its
  status record.

### Still open and not claimed by the fix
m1 (accepted in the ADR), m2 (accepted), m5, m6, m7, m8, m12, m13, m14 (`rm -rf "$STATE"` at
install-workspace-sync.sh:39 is still unguarded), m15, m16.

## New findings (introduced or exposed by `dcb3e458`)

| Id | Severity | Finding | Receipt |
|---|---|---|---|
| N1 | MAJOR | A dirty editor makes the first SIGTERM wait with no deadline. The second SIGTERM hard-kills (no drain). LC-01 "SIGTERM ends it within 10 s" is false in this state. | `app.mjs unsavedSigterm`: alive after 12 s, then `signal=SIGTERM after 11 ms` |
| N2 | MAJOR (narrow) | After "Keep editing", a quit within 60 s discards unsaved work without asking. | `app.mjs keepEditing`: exit 0 in 255 ms, edit lost |
| M4' | MAJOR (not fixed) | The async dialog does not help on macOS: a parentless box is `runModal`. | `drun.mjs noparent`: no ticks, alive after 20 s; `parent`: exit 0 in 410 ms; real app alive after 20 s |
| L1 | MINOR (rare) | A stale `.takeover` file lets two contenders both claim the takeover: ENOENT throws (4/40), a misrecorded owner (2/40), and a double holder (1/60). | `race.mjs stale-takeover 8 40`, `late.mjs` |
| L2 | MINOR (latent) | Lock identity is `ps lstart` text, which depends on locale and TZ. A live holder is stolen across environments. | `LC_ALL=ru_RU` holder taken over by an `LC_ALL=C` contender and a `TZ=UTC` contender |
| Q1 | MINOR | The cached token survives an account switch; there is no invalidation besides expiry or a 401/403. | quota.ts `readToken` / `forgetCachedToken` call sites |
| Q2 | MINOR | The `expiresAt` unit is unguarded (ms assumed). | quota.ts `cachedToken = { …until: read.expiresAt - TOKEN_EARLY_MS }` |
| N3 | MINOR | "Discard and close" does not continue the quit. | `app.mjs discardThenQuit` |
| N4 | MINOR | A crashed dirty editor blocks the first quit. | `app.mjs crashed` |
| N5 | MINOR | `files:unsaved` is accepted from any renderer. | index.ts `ipcMain.on(IPC.filesUnsaved…)` |
| B0 | info | CI `fast` is still red on Linux: `session-bundle.test.mjs:183`. Not lifecycle (it came with `47c8d804`); it was hidden behind B1. | run 37121459542 |

## Docs against code (after the fix)

| Claim | Verdict |
|---|---|
| ADR amendment: "the startup-failure dialog is asynchronous, so a SIGTERM or a logout while it is open is answered" | **False on macOS** (M4') |
| AGENTS: "Cmd+Q / SIGTERM ends it within 10 s, exit code 3 when the deadline had to end it" | True idle (149 ms, exit 0) and stalled (exit 3 at 10 s). False with unsaved work for SIGTERM (N1) |
| AGENTS: "With an editor holding unsaved changes the first quit stops nothing and shows the editor's choice; a second within a minute quits anyway" | True for an interactive quit. For SIGTERM the second one kills it. Ignores "Keep editing" (N2) |
| ADR amendment §3: "the lock file appears with its holder already written … one exclusive takeover" | Holds for fresh and stale-holder races. Not exclusive with a stale takeover file (L1). Identity depends on locale and TZ (L2) |
| ADR amendment §2 / AGENTS: "reads … once per token lifetime" | True (unit test), assuming `expiresAt` is in ms (Q2) |
| ADR amendment: "Hosted CI: … says NOT_RUN elsewhere" | True (run 37121459542) |
