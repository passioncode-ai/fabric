# ADR-0106 — Fabric adopts the product lifecycle contract

**Status:** accepted.
**Date:** 2026-10-03. **Decided by:** the operator's request of 2026-10-03 ("setup asks once; afterwards
the app runs silently, cheaply, and stops when told"), the organization's
[lifecycle contract](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/lifecycle.md)
(rules LC-01…LC-15) and the
[lifecycle audit](https://github.com/passioncode-ai/fabric-workspace/blob/main/docs/reports/2026-10-03-lifecycle-audit/README.md)
that produced it. **Closes** CO-191. Supersedes nothing.

## Context

The audit read and measured Fabric's start, stop, background work, credential reads and idle cost
([raw/fabric.md](https://github.com/passioncode-ai/fabric-workspace/blob/main/docs/reports/2026-10-03-lifecycle-audit/raw/fabric.md)).
Four findings were Fabric's own, and one more was found in the scheduled workspace sync that publishes it:

- **F1, blocking — the app did not quit.** An idle Fabric given `SIGTERM` closed its window and stayed
  alive, windowless, still running its 60 s cycle; twenty such copies sat in the operator's Dock. Cause:
  `before-quit` re-quit from a promise's `finally`, which ran inside Electron's own `Browser::Quit()` — not
  re-entrant — so `window-all-closed` arrived instead of `will-quit` and the macOS branch ignored it.
  Reproduced in the real app and in a 20-line Electron app.
- **F3 — the walk hid it.** Signalling the walk's whole process group delivered `SIGTERM` twice through
  the `.bin/electron` wrapper; Chromium handles only the first gracefully, so "terminated" meant "killed".
- **F4 — a credential poll.** `quota.ts` ran `security find-generic-password -w` with no timeout, held
  only a 429, and the renderer polled every 3 s: a Keychain read every 3 s while quota was unknown, and a
  dialog every 3 s whenever the keychain was locked.
- **F5 — a stack nobody asked for.** `supabase start` left 11 containers (~1.83 GiB idle), ~1.37 GiB of
  them services Fabric never calls.
- **The workspace sync wedged.** Its publish child deadlocked on exit; `execFileSync` had no timeout and
  launchd skipped every interval for 5 h 27 min. A manual publish and the scheduled one raced on the same
  remotes; every publication ran the full fast CI twice; four timing tests failed at load 35–135.

## Decision

### 1. Quit ends the process

`src/main/quit.ts` is the one owner of quitting (LC-01). The re-quit after the drain runs on a macrotask;
once quitting, `window-all-closed` quits on every platform; quitting stops every registered scheduler
first (the cycle, the notifier, transcript recovery), and the cycle starts nothing while quitting; a
10 s hard deadline ends the process if a drain or Electron's teardown stalls. `test/quit.test.mjs` proves
it twice: against a model of the non-reentrant native quit, and against a real Electron main process that
must exit with code 0, no signal, `will-quit` seen, after `SIGTERM`. Run with the old pattern the real
process is still alive 20 s later (watched 2026-10-03). The walk spawns the Electron binary itself,
signals only its pid, reaps its group after it has exited, and fails unless the app exited gracefully.

### 2. Credentials are read once and the outcome is kept

A Keychain read has a 5 s deadline and names its outcome — found, absent, denied, timeout (LC-04). Every
outcome is held: a missing credential for 10 minutes, a failed request with a doubling back-off from
60 s to 15 minutes, a 429 for its `Retry-After`. A refused or stalled Keychain read is not retried by any
timer: the next read waits for the person to unlock the screen (`powerMonitor` `unlock-screen`) or for
the next launch. The renderer asks for the quota every 60 s, not every 3 s. Fabric still reads Claude
Code's own item, because quota is a fact about that account; it does so at most once per hold, with a
deadline, and never in a loop.

### 3. A scheduled job is bounded, exclusive and observable

`scripts/lib/bounded-run.mjs` gives every command a deadline and its own process group, killed whole on
timeout (LC-02/LC-03). `scripts/workspace.mjs` runs nothing without it; git cannot wait on a person
(`GIT_TERMINAL_PROMPT=0`, ssh `BatchMode`). `publish` and `sync` share one machine-wide lock, so a manual
publication and the scheduled one never race; the sync runs under a 100-minute watchdog (below its 2 h
interval), writes `~/.cache/fabric-workspace/sync-status.json` (start, end, outcome, reason) and rotates
its log by size. The full fast gate runs only when Fabric's source changed since the published receipt —
its verdict otherwise stands — and the workspace's own tests and content verification still run on every
publication. The installer writes a minimal `PATH`, `ProcessType Background`, an `ExitTimeOut` longer
than the job's own stop path, and `--uninstall --purge` removes the checkout, state and logs (LC-14).

### 4. The stack runs only what Fabric calls

The app starts its stack with the services nothing in Fabric calls excluded — realtime, storage and its
image proxy, mail, postgres-meta, studio, edge functions, logs and their vector shipper, the pooler —
the same list the disposable test stack already excluded; `test/stack-services.test.mjs` keeps the two
equal (LC-09). The stack keeps running between launches, by design: a cold start takes minutes, and the
operator's data lives in it. That residency is declared in `AGENTS.md` → *Lifecycle*.

### 5. Builds and tests clean up after themselves

`AGENTS.md` names Fabric's build outputs, the release retention (current and previous) and the cache cap
(LC-15). Tests that touch the publication lock use a throwaway state directory, never `~/.cache`
(LC-14); the four load-sensitive tests now wait generously for outcomes they are not timing, while tests
about deadlines keep their own short ones.

## Consequences

- CO-191 is closed by §1 and its two tests; the walk now fails on an app that had to be killed.
- Quota can be up to a hold stale after a sign-in until the screen is unlocked or the app restarts; the
  reading says why (`no-credential`, `unreachable`, …), so nothing is invented.
- A publication triggered by another repository no longer re-runs Fabric's gate; Fabric's own source
  changes still do, twice, as before.
- The operator's running stack keeps its extra containers until it is next started fresh; the exclusion
  applies at the next `supabase start`.

## Amendment — after the independent review (2026-10-03, same day)

An independent reviewer read this decision and its code against the real built app
(on a disposable stack: exit 0 after `SIGTERM` in 158 ms idle and 2.15 s with a live shell). Its findings
changed the implementation, not the decision; recorded here rather than by editing §1–§5:

- **Unsaved work.** §1's "every trigger ends the process" now has one deliberate exception: an editor with
  unsaved changes stops the *first* quit before anything is shut down and shows its own choice; a second
  request within a minute quits anyway (`quit.ts` `blockers`). Before, the editor cancelled its unload
  after the drain and the deadline then ended the process, losing the work.
- **The deadline is visible.** A quit the deadline had to end exits with code 3, not 0, and the walk waits
  15 s, longer than the deadline, so a stalled shutdown can no longer pass as graceful.
- **The startup-failure dialog is asynchronous**, so a `SIGTERM` or a logout while it is open is answered.
- **§2:** the Keychain token is held in memory until five minutes before it expires (or a 401/403), so a
  signed-in Fabric reads the item about once per token lifetime instead of ~31 times an hour; unlocking the
  screen releases only credential holds, never a provider's 429 back-off; a refused read is reported as
  `credential-refused`, not "not signed in"; walks set `FABRIC_NO_KEYCHAIN=1` and `--use-mock-keychain`.
- **§3:** the lock file appears with its holder already written and a dead holder is replaced through one
  exclusive takeover file, with the holder identified by pid and start time (both held the lock in 20 of 20
  simultaneous starts before); nested bounded runs share the outer run's process group and timeouts end
  the whole process tree (a timed-out publish had left `ci.sh` and git under ppid 1); every exit after an
  error goes through `exitWithin`, which ends the pid if Node's own exit deadlocks; `heroku` calls have a
  60 s timeout.
- **Hosted CI:** the real-Electron quit case runs where there is a display (macOS, or Linux with `DISPLAY`)
  and says `NOT_RUN` elsewhere; the hosted Linux runner had no display.
- **Known and accepted:** a second `SIGTERM` during a drain is handled by Chromium itself and ends the
  process at once; the drain's own limits (8 s + 2 s) meet the 10 s deadline with no margin, and the
  deadline's exit code 3 makes that case visible rather than hidden.

