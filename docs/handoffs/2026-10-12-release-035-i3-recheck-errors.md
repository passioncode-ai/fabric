# Fabric 0.3.5 final-candidate recheck: errors and boundaries

| | |
|---|---|
| Level | errors and boundaries |
| Final candidate | `89718e92704981809f7dc5a7d7e2c4cc64de7bf3`, read-only detached checkout `.claude/worktrees/rv-035` (`git rev-parse HEAD` = that SHA, `git status --short` empty) |
| Previous candidate (iteration 3 read) | `01783787665f400a8a7b7f2ec804ad5b6be9c87e` |
| Delta read | `git diff 01783787..89718e92 -- apps .github scripts`: 12 files, +58 −15. `.github/workflows/ci.yml` and `platforms.yml` gate step; `apps/desktop/package.json` `test` chain (+ `work-release-session`); `seedRepair.ts` region anchor; `harness.agent.codex` / `kimi-code` and `work.release.failed.unconfirmed` (en, ru); new `harnessAgentWords.test.ts`; three test fixtures (`ptys.get`, `.claude/agent-sync.json`, observer `codex` → `cline`); `scripts/test/release-mac.test.mjs` (+1 test) |
| Reviewer run id | `release-035-i3-recheck-errors-20261012` |
| Date | 2026-10-12 |
| Read-only statement | I made no edits, commits or pushes in the repository, and ran no installs, builds or stacks. I launched no app and did not touch ports 54321 or 54322. Everything I wrote is in the scratchpad (`rc3/`). `gh run list` was the only network read. |

## Verdict

**No blocking findings.** The delta regresses nothing at this level. The new gate expressions pick the right cron for both crons at both offsets, the workflows parse, and push, pull_request and dispatch runs cannot be skipped by the gate. CO-270 and CO-271 still describe the code. Iteration-3 ER-8 is closed: the test is now wired into the full tier.

There are 3 findings, all non-blocking: one DST-night edge, one latent cancellation, and one weak test.

## What I ran

| Command | Exit | Result |
|---|---|---|
| `python3 scripts/check-workflows.py` | 0 | `PASS workflows: 4 parse as YAML and name their jobs` |
| `node --test scripts/test/release-mac.test.mjs` | 0 | 21 pass, 0 fail, including the new "the nightly gates choose by the cron that fired, never by the hour the job started" |
| `node --experimental-strip-types test/work-release-session.test.mjs` (in `apps/desktop`) | 0 | 10 pass, 0 fail |
| `node_modules/.bin/vitest run src/renderer/src/harnessAgentWords.test.ts` (in `apps/desktop`) | 0 | 1 file, 2 tests pass |
| `node scripts/run-test-chains.mjs --list` | 0 | 142 lines; line 141 is `@fabric/desktop :: node --experimental-strip-types test/work-release-session.test.mjs`, so the full tier's chain runner picks it up |
| `python3 rc3/gate-sim.py .`: parses both workflows with PyYAML, takes the real `run:` body of `gate` / `clock`, substitutes each declared cron for `${{ github.event.schedule }}`, stubs `date` to print `+0100` or `+0200`, and runs it under `bash -e -o pipefail` with a temporary `GITHUB_OUTPUT` | 0 | 8 cases, each step exits 0. `ci.yml`: `0 21` with `+0200` gives `run=true`, `0 22` with `+0100` gives `run=true`, the other two give `run=false` with the skip message. `platforms.yml`: the same for `30 21` and `30 22`. |
| `python3 -c` with `zoneinfo` Europe/Warsaw: the gate's choice on 2026-10-24/25 and 2027-03-27/28 for start delays of 0, 60, 180, 189 and 240 min | 0 | see RC-1 |
| `gh run list -w ci.yml -L 40` and `-w platforms.yml -L 20` (read-only) | 0 | Last night's scheduled runs were created at 00:08Z and 01:09Z (ci) and 00:39Z and 01:33Z (platforms). Each took 0–2 min, which means both skipped under the old hour check. That is PL-1 as recorded. Dispatch durations: ci 15–24 min, platforms 15 min. |
| `git diff --quiet 01783787..89718e92 --` over `sessionEnroll.ts`, `agentSurface.ts`, `fabricMcp.ts`, `fabricMcpMain.ts`, `fabricMcpClient.ts`, `index.ts`, `linkRoute.ts`, `workTools.ts`, `workRelease.ts`, `hubTools.ts`, `agentSyncLeases.ts` | 0 | the files under CO-270 and CO-271 are unchanged |

NOT_RUN:
- `node apps/desktop/test/runtime-observer.test.mjs` needs a stack, which the task forbids. I read its delta instead (RC item 1c).
- `scripts/ci.sh fast|full`: out of scope, since it builds and, for full, starts a disposable stack.
- A real scheduled run of the new gate. Its first chance is tonight at 21:00Z.

## Verdict per item

### 1. The delta regresses nothing at this level: PASS

**a. Gate expressions, both crons and both offsets: correct.** Warsaw is UTC+2 in summer and UTC+1 in winter. 23:00 local is therefore `0 21` UTC at `+0200` and `0 22` UTC at `+0100`. The 23:30 batch is `30 21` and `30 22`. Both workflows map them this way:

- `ci.yml` gate: `want="0 22 * * *"; [ "$off" = "+0200" ] && want="0 21 * * *"`
- `platforms.yml` clock: the same with `30`

The simulation runs the real step bodies for all 8 combinations: exactly one cron per offset runs. The `[ … ] && want=…` line is not the step's last command, so a false test does not fail the step under `bash -e`. The step ends with the `if`, which exits 0 on both branches. `date +%z` prints `+0200` / `+0100` on GNU coreutils, the form the comparison expects. `${{ github.event.schedule }}` is the cron string from the workflow file, which no outside actor can control, so the interpolation is not an injection point.

**b. Parse: yes.** `check-workflows.py` exit 0.

**c. A dispatch or push run cannot be skipped.** `gate` and `clock` have `if: github.event_name == 'schedule'`. `fast` (ci) and `windows`/`linux` (platforms) use `!cancelled() && (github.event_name != 'schedule' || needs.<gate>.outputs.run == 'true')`. The status function replaces the implicit `success()`, so a skipped gate does not skip them on push, pull_request or workflow_dispatch. `full` keeps `github.event_name == 'workflow_dispatch' || needs.gate.outputs.run == 'true'`. So it runs on dispatch and on the chosen cron, and does not run on push, which was already the case before the delta. None of these `if:` lines changed in the delta.

**d. Other delta items.**
- `seedRepair.ts` region now points at `#amendments`. It is a region anchor only, no code change.
- `harness.agent.codex` and `kimi-code` now say "connected". `agents.ts` gives `codex` `surfaceAdapter: 'codex-config-home'` and `kimi-code` `'acp-session'`, and the new vitest holds en and ru to the catalogue.
- The observer fixture swaps to `cline`, which is still `surfaceAdapter: 'none'` in `agents.ts`. The case "an adapter-less session is never called stalled" still tests an adapter-less agent.
- `ptys.get` stubs follow the surface's `get` use.
- The `work-claims-db` fixture adds `.claude/agent-sync.json`, matching UX-5.
- `work.release.failed.unconfirmed` changes "below" to "above". This is wording only.

None of these weakens an error path.

### 2. Touched tests: PASS
`release-mac` 21/21, `work-release-session` 10/10, `harnessAgentWords` 2/2. `runtime-observer` was NOT_RUN because it needs a stack.

### 3. CO-270 and CO-271 still describe the code: YES
None of the files named by the two rows changed in the delta (`git diff --quiet` exit 0). Spot checks on the candidate:

- **CO-270.**
  - ER-2: `fabricMcpMain.ts:64` is still the only exit path, `process.stdin.once('end', …)`, with no SIGTERM, SIGHUP or SIGINT handler.
  - ER-1/ER-4: `sessionEnroll.ts:231–237` still evicts from `liveOf(binding.id)` across projects, before the mint.
  - ER-10: `fabricMcp.ts:325` still says `enroll answered ${code}`.
  - ER-11: `sessionEnroll.ts:58` `evictedReason` is unchanged.
- **CO-271.**
  - ER-6: `index.ts` `cachedOrigin` still catches the `originOf` failure (line 1191) and caches the promise (line 1195).
  - ER-7: `linkRoute.ts:70` is still `named.length === 1 ? named[0].id : null`.

**ER-8 is closed, not carried.** `work-release-session.test.mjs` is now the last link of `apps/desktop/package.json` `test`, and `run-test-chains.mjs --list` shows it. It therefore runs in `ci.sh full`, nightly or on dispatch, not in `fast`. That is one of the two places iteration 3 suggested.

## Findings

| ID | Blocking? | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| RC-1 | No (low; one night a year each way) | **On the nights the clocks change, the gate reads the offset after the change.** The step takes Warsaw's offset when the job starts, not when the cron was due. Measured start delays are about 3 h, and the changes happen at 01:00Z on Sunday. Effects: (a) on the night of 2026-10-24/25 both crons run the batch. The `0 21` run starts about 00:08Z at `+0200`, and the `0 22` run starts about 01:09Z at `+0100`, so the nightly runs twice. (b) On the night of 2027-03-27/28 neither runs. The `0 21` run sees `+0100` and the `0 22` run sees `+0200`, so there is no nightly that night. The same applies to platforms (`30 21` / `30 22`, delays about 3 h). The new comment says runs start "one to three hours late". Last night measured 3 h 03 min – 3 h 09 min. | `rc3` zoneinfo model: 2026-10-24 cron 22:00 at delay 180/189 min gives `run` while cron 21:00 at 189 min gives `run`; 2027-03-27 cron 22:00 at 180/189 min gives `skip` while cron 21:00 at 189 min gives `skip`. `gh run list`: ci schedule runs created 2026-10-12T00:08:12Z and 01:09:58Z, platforms 00:39:34Z and 01:33:15Z. | Read the offset as of a moment safely before the start: `off=$(TZ=Europe/Warsaw date -d '6 hours ago' +%z)` (GNU date on ubuntu). This holds for any delay under about 9 h. Say "about three hours" in the comment. |
| RC-2 | No (latent at today's durations) | **A later run in the same concurrency group can cancel the real nightly.** Both workflows use a workflow-level `concurrency` group keyed only on the ref, with `cancel-in-progress: true` (`ci-${{ github.ref }}`, `platforms-${{ github.ref }}`). In summer time the cron that skips (`0 22` / `30 22`) arrives about 60 min after the one that runs. Any real run still in progress then is cancelled by a run that does nothing. A push to `main` (ci) or a dispatch (both) during the nightly cancels it too. Today the full ci run takes 15–24 min and platforms 15 min, so this does not bite yet. But `full` allows up to 45 min (`FABRIC_FULL_TIMEOUT_S`) plus setup, and the Windows jobs allow 75 min. The concurrency config predates the delta, but the delta's fix now depends on the two scheduled runs not overlapping. | `ci.yml` and `platforms.yml` top-level `concurrency:` blocks; the measured gap between the two schedule runs is 61 min (ci) and 54 min (platforms); `ci.yml` `full` comment and `scripts/ci.sh` `FABRIC_FULL_TIMEOUT_S:-2700`; `platforms.yml` `windows` `timeout-minutes: 75`. | Key the group by event and do not cancel scheduled runs. For example: `group: ci-${{ github.ref }}-${{ github.event_name }}` with `cancel-in-progress: ${{ github.event_name != 'schedule' }}`, and the same in `platforms.yml`. A skipping scheduled run then waits as pending and costs nothing. |
| RC-3 | No (low; test strength) | **The new test checks the shape of the gate, not its choice.** `release-mac.test.mjs` asserts three things: no `date +%H`, a mention of `github.event.schedule`, and each declared cron quoted somewhere. A swapped mapping (`+0200` → `0 22`) would pass it, and so would an `if` that always chooses `run=true`. Both would mean a nightly that never runs, or one that runs twice. The step's actual behaviour is proven only by the simulation in this recheck. | `scripts/test/release-mac.test.mjs`, the last test. Read: a swapped `want=` pair still contains `"0 21 * * *"` and `"0 22 * * *"`. `rc3/gate-sim.py` exercises the real step body. | Make the test run the extracted `run:` body with a stubbed `date` for each cron × offset (as `rc3/gate-sim.py` does). Assert exactly one `run=true` per offset, and watch it catch a swapped mapping. |

Counts: 3 findings, 0 blocking, 3 non-blocking (RC-1 to RC-3). The scratch files for this recheck are `rc3/gate-sim.py`, `rc3/chains.txt`, `rc3/harness-words.log`, and `rc3-release-mac.log` / `rc3-wrs.log` in the scratchpad.
