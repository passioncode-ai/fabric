# 0.3.4 verification, iteration 3 recheck — code ↔ documentation

- **Final candidate:** `2e04073125db85d1fe3763267cd85c3d78fabaf2` (detached checkout `cand4`; `git rev-parse HEAD` printed it).
- **Previous candidate:** `06c5234c65d3f4cbdbf5f2a6c50740a9c556d6b3`; delta `git diff 06c5234c..2e040731`, 26 files.
- **Scope:** iteration 3's docs findings DO-1…DO-6 against their dispositions (V3-4…V3-9), then the delta at this level.
  Read-only: `git status --short` in `cand4` was empty after every run. The one mutation ran on a `git archive` copy
  in my scratch folder. The CO counter was fetched into a scratch bare repository, not into `cand4`.

## What I ran (in `cand4` unless named)

| Command | Exit | Result |
|---|---|---|
| `node --experimental-strip-types apps/desktop/test/seed-repair.test.mjs` | 0 | `seed-repair: all green` |
| same, on a scratch `git archive` copy with `EVENT_READ_LIMIT = 1000` | 1 | `AssertionError: the repair reads 1001 rows, more than the API returns (1000)`, the message V3-1 cites |
| `node apps/desktop/test/run-first-install-db.mjs` | 0 | 13 PASS: `fresh` 4/4, `legacy` 8/8, full chain |
| `cd apps/desktop && npx vitest run src/shared/startupFailure.test.ts src/shared/errorText.test.ts` | 0 | 41 pass |
| `node scripts/check-regions.mjs` | 0 | 202 markers |
| `node scripts/check-design-map.mjs` | 0 | stamp 4 616 files, 546 anchors, 1 716 link targets |
| `node scripts/check-registers.mjs` | 0 | 243 carry-over rows; counts recompute |
| `PYTHONDONTWRITEBYTECODE=1 pnpm gates:docs` | 0 | fail 0 |
| `node --test scripts/test/universal-mac.test.mjs`, `node --test scripts/test/release-mac.test.mjs` | 0, 0 | |
| scratch probe: `release-gate.mjs#releaseGateProblems` on the candidate's ledger with a 0.3.4 gate stub | — | two problems left: `reviewReceipts schema fabric-release-reviews/1` and `iteration 3 must end with its one line "Exit for iteration 3: …"`. Iterations 1 and 2 are no longer reported. |
| `git ls-remote origin 'refs/agent-sync/ids/*'` + fetch of `refs/agent-sync/ids/CO` into a scratch bare repo | 0 | top commit `{"next": 244, … "rkey": "release-034-i3-site-known-issue"}`, so CO-243 was reserved under the key its row names |
| read-only git in `~/DATA/fabric/workspace` | 0 | `8639492c` (#92) is on `origin/main` and is not an ancestor of the pin `ca7b2b52`. The pin's `knowledge/roadmap.md:57` still says "v0.3.2 prerelease". |

## Iteration 3 findings at this level

| finding | holds? | evidence |
|---|---|---|
| DO-1 → V3-4 (runbook: the shipped Intel app runs on a measured runtime) | **yes** | `docs/launch/release-mac.md:15-18` now says the npm darwin-x64 build was measured under Rosetta and admitted. It also says the packaged framework is joined and re-signed, so neither architecture matches a tuple (N1, `checks.md:769, 823`), and that nothing in the app reads the tuple yet. That last claim holds: the only non-test consumer of `isMeasuredRuntime` is `ownedBackendProcessRegistry.ts:102`, and `createOwnedBackendProcessRegistry(` appears only at its definition (`:100`). The CHANGELOG Intel bullet makes the same claim and no more. |
| DO-2 → V3-5 (no exit lines; *Release close* did not name receipts) | **yes** | Ledger §Iteration 1 and §Iteration 2 each end in `Exit for iteration N: … Blocking findings open: none.`, and the gate probe no longer reports them. *Release close* item 1 now names the fifteen `iteration-N/<level>.json` receipts and the exit lines, written in the release commit. The probe's two remaining problems are exactly the ones item 1 leaves to that commit. |
| DO-3 → V3-6 (P-15 range and iteration state) | **yes** | `backlog.md` P-15 now reads "only the old seed (0.2.0, 0.3.0–0.3.3) has touched", and "iterations 1 and 2 closed 2026-10-10, iteration 3 at its final candidate". Lane 2 names P-14's 0.3.3 release (`1404dffe` / `fa9cdf6b`). The two optional test comments (`legacy-seed-0.3.3.sql:1`, `run-first-install-db.mjs:3`) still say 0.3.0–0.3.3. DO-3 called them optional, so this is not a defect. |
| DO-4 → V3-7 (pinned workspace predates #92) | **yes (ruled)** | The pin is unchanged at `ca7b2b52` (`git ls-tree HEAD workspace`). #92 is on fabric-workspace `main` and not in the pin, as V3-7 says. *Release close* item 4 ends with the workspace publication after the tag (`workspace.mjs publish`, `check --require-child`), and `release-mac.mjs#publicationPinProblem` admits a pin that lands after `verifiedCommit`. The ruling points to a close item, not a CO id. `release-gate.mjs` only requires the word "ruled" (`DISPOSED`), and V1-15 set the same precedent. The tagged tree's own roadmap will say 0.3.2 until that publication, as ruled. |
| DO-5 → V3-8 (*Release close* item 5 missed the map's family section) | **yes** | Item 5 now lists "the family section of `docs/reports/map.html`; … iteration 3, DO-5". |
| DO-6 → V3-9 (two `ci.sh` comments) | **yes** | `scripts/ci.sh:57-58` says "it skips off macOS", which matches `universal-mac.test.mjs:15, 55` (`skip: process.platform !== 'darwin'`). `:364-365` says "these five", which matches the loop at `:358` (five runners). |

## The delta at this level

I read every non-report file of the delta and found nothing false, broken or misleading:

- **`EVENT_READ_LIMIT` 999.** The code (`seedRepair.ts:32`, `.limit(EVENT_READ_LIMIT + 1)` at `:103`, `> EVENT_READ_LIMIT` at `:62`), its comment, ADR-0131 §2 (`:39`, "999 … so the read of one more stays within the API's `max_rows`") and `supabase/config.toml:18` (`max_rows = 1000`) agree. The new test case reads `max_rows` from the TOML and caught the 1000 plant. No living document still states 1000. The only remaining "1000" is V2-6, a dated ledger row about iteration 2's fix. `first-install-db.test.mjs:71` derives its read from the constant.
- **Refusal title and remedy.** `en.ts`, `ru.ts`, the classifier in `startupFailure.ts:103-104`, its test and `docs/brand/strings.md:717-718` carry the same text. The title has no full stop in the strings and the register, and the classifier adds one, as before. The map entry's «Повторить» is `startup.retry` in `ru.ts:279`.
- **ADR-0121 / ADR-0123 amendments 2 and their index rows.** They match P-12 ("planned after 0.3.4 … ≤ 0.3.4") and CO-238 ("the port is 0.3.5"). The ADR status headers still say 0.3.3, as they did after amendment 1. The ADRs are append-only, so this is not a regression.
- **CO-243** exists. Its id was reserved on `origin` under the key the row names, and the next free id is CO-244 in both the register and the counter. V2-15 and V3-13 cite it, and lane 1 lists it.
- **`rehearse-upgrade.mjs` header (V3-10).** The fixture path calls `startStack(dir, { migrationCount: count, seed: true })` (`:168`) with this checkout's seed. Since 0.3.4, that seed names the app's person, as the comment says.
- **Committed iteration-3 reports.** They are byte-identical to the reviewers' originals in `i3/`, except that the UX report has two machine paths replaced by `<cache>/cand3`. `grep -rl /Users/` over the committed folder finds nothing.
- **Design map.** The top entry `#iteration-2026-10-10-release-034-i3` matches the ledger (21 findings, 0 blocking, 999, the exit lines, amendments 2, CO-243). The stamp names `2026-10-10-release-034-i3`, and the gate passes.

Outside this level (not a finding here): the new remedy says to retry when the details say something "could not be read". The repair's other transient reasons ("could not be granted: …", "could not run: …") do not contain that phrase. Whether they should is a question for the errors level.

No new findings.

VERDICT: 0 blocking, 0 non-blocking
