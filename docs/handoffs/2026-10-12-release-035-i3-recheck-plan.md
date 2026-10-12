# Release recheck: Fabric 0.3.5, iteration 3, plan and roadmap

- **Reviewer run:** `release-035-i3-recheck-plan-20261012b`
- **Final candidate:** `89718e92704981809f7dc5a7d7e2c4cc64de7bf3`. This is the read-only detached checkout `.claude/worktrees/rv-035`, and it equals `origin/main`.
- **Previous candidate (iteration 3 read it):** `01783787665f400a8a7b7f2ec804ad5b6be9c87e`. Iteration 3's plan report is `scratchpad/rv3/plan.md` (PL-1…PL-9).
- **Delta read:** `git diff 01783787..89718e92 -- docs/evidence docs/handoffs .github`, in full. It covers `ci.yml`, `platforms.yml`, the backlog, the 0.3.5 ledger, the carry-over spec, the resolution matrix and the fix-wave handoff. I also read the names of every changed file, the runbook's diff, the `apps/desktop/package.json` and `seedRepair.ts` diffs, and the 0.4.0 plan's *Decision, 2026-10-12*.
- **Read-only:** I made no edits, commits or pushes. I launched no app, did not touch ports 54321/54322 and started no stack. Every `gh` call was a read. I ran scratch scripts from the scratchpad only (`scratchpad/rc3-plan/sim3.mjs`, test log `rc3-plan/tests-b.log`).
- **Verdict:** **0 blocking, 6 non-blocking (PLR-1…PLR-6).**
  - Fixed: PL-1, PL-3, PL-5/PL-8 (in the handoff) and PL-6.
  - Partly fixed: PL-4 (fixed in P-17, but the 0.4.0 Decision still has the old wording).
  - The gate can clear with `89718e92` as iteration 3's candidate and as `verifiedCommit`.
  - `verifiedCandidateProblem` accepts the expected release-commit file set.
  - CI is green on `89718e92`: fast on the push to main, and fast plus full on the dispatched run. The four native jobs are green on `01783787`, and the delta changes no native-path code.

## What I ran

| Command | Exit | Result |
|---|---|---|
| `git rev-parse HEAD`; `git diff --stat` / `--name-only 01783787..89718e92` | 0 | HEAD = `89718e92…`; 2 commits (`ab21e2dd`, `89718e92`) |
| `git diff 01783787..89718e92 -- docs/evidence docs/handoffs .github` | 0 | Read in full (findings below) |
| `node --test scripts/test/release-gate.test.mjs scripts/test/release-mac.test.mjs` | 0 | 40 tests, 40 pass, 0 fail |
| `node scratchpad/rc3-plan/sim3.mjs <rv-035>`: `releaseGateProblems`, `validatedReviewArtifactPaths`, `verifiedCandidateProblem`, `changelogProblem`, `workspacePinProblem` | 0 | See "Gate simulation" |
| `gh run list -R passioncode-ai/fabric -w ci.yml -L 12` | 0 | On `89718e92`: **38221434237** (push, main) success; **38219258686** (dispatch) success; 38219258334 cancelled (superseded) |
| `gh run view 38219258686` | 0 | `fast — no database` success, `full — with a disposable stack` **success**, `gate` skipped |
| `gh run view 38216064295` (platforms, `01783787`, dispatch) | 0 | windows x64 success, windows arm64 success, linux x64 success, linux arm64 success; clock skipped |
| `gh run view 38216066979` (ci dispatch, `01783787`) | 0 | Conclusion **failure**: fast success, full failure. `89718e92` ("three full-tier tests catch up with 0.3.5") fixed it, and 38219258686 is green |
| `grep` on crons, the handoff's next-task line, and P-17 / CO-238 / `releaseMetadata` in the handoff and runbook | 0 | Inputs to PLR-3…PLR-6 |
| `bash scripts/ci.sh fast/full`, `release-mac.mjs --check-only`, any dispatch | NOT_RUN | These are outside a read-only recheck. The hosted runs above are the receipts |

## Gate simulation (sim3.mjs)

The simulated gate is 0.3.5:
- `verifiedCommit` is `89718e92`.
- `releaseMetadata` lists the fix-wave handoff and the five `docs/handoffs/2026-10-12-release-035-i3-recheck-*.md` reports.
- Iterations 1–2 use the committed receipts (every receipt's `candidateCommit` matches `895302f1` and `3570f116`).
- Iteration 3 is `89718e92`.

| Case | Result |
|---|---|
| A. As committed (iteration 3 not written) | Only the expected problems: the 10 iteration-3 artifacts are absent, and "iteration 3 has not started" |
| B. Five synthesized closed iteration-3 receipts naming `89718e92` in full; a closed `## Iteration 3` section naming it in full; then a `## Release close` section | **clear**; 30 review paths admitted |
| B2. Iteration-3 receipts naming `01783787` (what the reviewers read) instead | Refused: "receipt does not match … exact candidate". The receipts must name the final candidate, as the handoff's step 2 says (the 0.3.4 precedent) |
| B3. Section naming only the short SHA | Refused: "does not name its candidate commit … in full" |
| `changelogProblem`: at HEAD, then with only the heading renamed to `## 0.3.5` | At HEAD: "found 0", as expected. Renamed: `null` |
| `workspacePinProblem(HEAD)` | `null` |
| `verifiedCandidateProblem`, release commit = `apps/desktop/package.json` (version only) + CHANGELOG + gate + ledger + MERGES + map + handoff + 5 recheck reports + iteration-3 reports and receipts | **`null` (accepted)**; the candidate chain `895302f1 → 3570f116 → 89718e92` holds |
| The same release commit plus one of: the backlog, the carry-over spec, `docs/brand/facts.md`, an ADR, `docs/reports/plan.json`, or an undeclared sixth handoff | Each is refused ("unverified changes follow the verified commit") |
| The same release commit, `package.json` changed beyond its version | Refused |
| The same release commit, `releaseMetadata` still 0.3.4's list | Refused: the fix-wave handoff and the recheck reports are unverified (PLR-4) |

`docs/reports/plan.json` is generated only from `docs/evidence/backlog.md`, and the release commit does not change the backlog, so its refusal does not bite.

## Verdict per item

| Item | Verdict | Evidence |
|---|---|---|
| PL-1 nightly gates | **Fixed**, with residue (PLR-6) | `ci.yml` and `platforms.yml` now choose by `github.event.schedule` and the Warsaw offset, not by the hour the job starts. Both crons are listed (`0 21`/`0 22`, `30 21`/`30 22`). `release-mac.test.mjs` adds a test. No scheduled run has fired since this landed (08:05Z), so the fix is unproven on a hosted schedule run until tonight |
| PL-2 (context) full tier and native builds | **Resolved** | Full: 38219258686 success on `89718e92`. Native: 38216064295, 4/4 success on `01783787`. The delta's app-source changes are strings in `en.ts`/`ru.ts`, one region comment in `seedRepair.ts`, tests, and the `test` script in `package.json`. No native-path code changed |
| PL-3 ledger run citation | **Fixed** | V2-38 now reads "the hosted fast job on `8c1c279e` passed (run 38207098935, whose full job failed …), and `ci` was green on `main` at `8af4b08f` (run 38210310607)". 38210310607 is success in `gh run list` |
| PL-4 P-17's Comms wording | **Fixed in P-17; residue in the 0.4.0 Decision** (PLR-1) | P-17: "the operator's read-only Comms screen over the project board (COM-06/07 open beyond it)" |
| PL-5 handoff status | **Fixed**, residue (PLR-2, PLR-3) | "Status at 2026-10-12 09:15 (iteration 3 closing)", which records iterations 1–2 closed on `01783787`, the iteration-3 final candidate, and CO-270…273 |
| PL-8 dump order | **Fixed in the handoff**; residue in the Decision (PLR-1) | Handoff step 6: dump before anything (`pre-0.3.5-2026-10-12.dump`), quit through the broker, upgrade 79 → 84, install, verify, then dump again and reset |
| PL-6 release-commit recipe | **Fixed**, with one gap (PLR-4) | Step 3 says "only release metadata after `verifiedCommit`". It lists the version, the finalized `## 0.3.5`, the gate (version, ledger, `verifiedCommit`, three receipt groups, the recheck reports), the ledger's release-close section, MERGES, and the map entry and refresh. Step 4 says an rc failure that needs a source change makes a new candidate. The iteration-3 rulings already have rows in the candidate (CO-270…CO-273, counter 274), so no new row has to be added after `verifiedCommit` |

## Findings

| ID | Blocking? | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| PLR-1 | No | **The 0.4.0 plan's *Decision, 2026-10-12* keeps both wordings that PL-4 and PL-8 named.** It says 0.3.5 ships "the operator's board (COM-06/07)", while the COM register has COM-06 and COM-07 open. It also names one dump ("the database dumped, upgraded 79 → 84, the app installed, then the local data reset"), while the handoff now names two and says the Decision "says the same order". | `docs/evidence/plans/2026-10-11-release-040-agents-first.md` lines 481 and 488–490; `2026-10-04-project-communications.md` lines 44–45 (`open`); handoff step 6 | This is a source document and is refused after `verifiedCommit`. In the release-close commit (after the tag), reword it like P-17: the read-only Comms screen, with COM-06/07 open beyond it. Name both dumps |
| PLR-2 | No | **The handoff cites a red run without its outcome**, the same pattern as PL-3. It says the dispatched full tier and the native builds "were started on it (runs 38216066979, 38216064295)". 38216066979 concluded **failure** (its full job failed). The green full run is 38219258686 on `89718e92`. | `gh run view 38216066979`: full failure; `gh run view 38219258686`: full success | In the release commit (the handoff is admitted once declared): give 38219258686 success (fast + full) and 38221434237 (push, main) on `89718e92`, and 38216064295 4/4 success on `01783787` |
| PLR-3 | No | **The handoff's next task is already done at the final candidate.** "**Next task:** step 1" (land the final candidate, hosted `ci` green). `89718e92` is `origin/main`, and 38221434237 is green. The next task is step 2 (the five rechecks). P-17's status also still says "iteration 3 next", although iteration 3 ran on `01783787`. A handoff cannot record that its own commit landed, but the release commit can. | handoff line 71; `gh run list` (38221434237 success); backlog P-17 status | Release commit: the handoff's status and "Next task" move to step 4 (the rc). P-17's status waits for the close commit, because the backlog is refused after `verifiedCommit` |
| PLR-4 | No | **Recipe step 3 lists "the recheck reports in `releaseMetadata`" but not the fix-wave handoff itself.** It also does not say that 0.3.4's six entries must be *replaced*. If the release commit edits the handoff without declaring it, or leaves 0.3.4's list in place, `verifiedCandidateProblem` refuses it. | sim3: "with 0.3.4 releaseMetadata left in place" → refused; `docs/launch/release-gate.json` still lists 0.3.4's six handoffs | Set `releaseMetadata` to exactly `docs/handoffs/2026-10-12-release-035-fix-wave.md` and the five `…-i3-recheck-{ux,errors,docs,data,plan}.md` |
| PLR-5 | No | **The after-release list (handoff step 7) leaves out plan and register rows that become false at the tag.** It names `facts.md`, the guides and the knowledge base. It does not name: P-17 → "done — released …" (CO-252: begin with `done`); CO-238 → resolved; lane 2's release list; the Now line; the 0.4.0 Decision (PLR-1). RM-19 is also no longer named, but it was already correct (V2-43). | handoff steps 5–7; grep of the handoff and runbook for `P-17`/`CO-238` returns nothing in the handoff | Put these in the ledger's release-close section (step 3 already plans that section) as the close commit's checklist |
| PLR-6 | No | **The nightly clock reads the Warsaw offset when the job starts, not at the cron's time.** On the two DST nights a year, a run delayed past 01:00 UTC sees the other offset. On 2026-10-25 this gives one or two batches. On 2027-03-28 it gives zero if the `0 21` run starts before 01:00 UTC and the `0 22` run after. The fix is also unproven until the first scheduled run tonight. Iteration 3 also suggested telling org-index's CI-BATCHING owner, and nothing in the delta does that. | `ci.yml` and `platforms.yml` `hour` steps (`off=$(TZ=Europe/Warsaw date +%z)`); crons `0 21`/`0 22`, `30 21`/`30 22` | After the release: take the offset at the scheduled UTC time of the cron's date, or run once per main SHA per day. Check tonight's `ci`/`platforms` schedule runs for real jobs, and record them in the ledger or a CO row |

## Operator questions

There are none new, and no approval request is owed: the release environment has no reviewers (ADR-0145). The Windows question now states its weaker basis ("covers starting the app, not the CO-267 paths"), as PL-7 asked.

**Counts: 0 blocking, 6 non-blocking (PLR-1…PLR-6). The gate can clear on `89718e92`.**
