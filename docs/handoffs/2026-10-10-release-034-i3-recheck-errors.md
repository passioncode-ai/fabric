# 0.3.4 verification, iteration 3 recheck — errors and boundaries

Candidate: `2e04073125db85d1fe3763267cd85c3d78fabaf2`, in the detached checkout `<cache>/cand4`
(`git rev-parse HEAD` = that commit; `git status --short` empty before and after). The delta under review is
`06c5234c65d3f4cbdbf5f2a6c50740a9c556d6b3..2e04073125db85d1fe3763267cd85c3d78fabaf2`.

I worked read-only. I edited, committed and pushed nothing in the candidate. I started and stopped no app. I did not
touch the operator's stack (project `fabric`, ports 54321/54322) or `~/Library/Application Support`. Logs and one
gate-simulation script are in `<cache>/i3r/errors-work/`, outside the checkout.

## What I ran (exit codes)

| # | Command (in `cand4`) | Result |
|---|---|---|
| 1 | `apps/desktop: node --experimental-strip-types test/seed-repair.test.mjs` | `seed-repair: all green`, exit 0. Includes the new `max_rows` case |
| 2 | `apps/desktop: node --experimental-strip-types test/run-first-install-db.mjs` (owns its own isolated PostgreSQL) | 4 `fresh` + 8 `legacy` PASS, "full migration chain … PASS", exit 0 |
| 3 | `apps/desktop: npx vitest run src/shared/startupFailure.test.ts` | 33 passed, exit 0 (new title asserted) |
| 4 | `apps/desktop: npx tsc --noEmit -p tsconfig.node.json` | exit 0 |
| 5 | `node scripts/check-registers.mjs` | PASS, 243 carry-over rows, exit 0 |
| 6 | `errors-work/gate-sim.mjs <cand4>` runs `releaseGateProblems` and `release-mac.mjs#verifiedCandidateProblem` against a 0.3.4 gate built as *Release close* item 1 describes it. It runs once with `verifiedCommit` = `06c5234c` and once with `2e040731`. It also evaluates the V3-1 assertion at 1000 and at 999 | Output quoted under V3-5 and ERR-1 |

## Iteration-3 findings on this level

| finding | holds? | evidence |
|---|---|---|
| ER-1 → V3-1 (the repair's read of `EVENT_READ_LIMIT + 1` rows exceeded `max_rows`) | **holds** | `seedRepair.ts:32` `EVENT_READ_LIMIT = 999`. `:103` reads `.limit(EVENT_READ_LIMIT + 1)` = 1000 rows, and `supabase/config.toml:18` `max_rows = 1000`. A journal of 1000 or more events therefore returns 1000 rows, and the guard `events.length > EVENT_READ_LIMIT` (`:62`) refuses it. The unit case `[seedEvent, ...Array(EVENT_READ_LIMIT)]` is now exactly the 1000 rows the real read can return. `seed-repair.test.mjs:124–133` reads `max_rows` from `config.toml` and asserts `EVENT_READ_LIMIT + 1 <= maxRows` (run 1 green). Watched by arithmetic (run 6): at 1000 that test's check is `1001 <= 1000 → false`, so the assertion fires with the message the ledger quotes. ADR-0131 §2 says "(999) … so the read of one more stays within the API's `max_rows`". The code comment now gives the same reason. No other document states the old 1000 (`git grep EVENT_READ_LIMIT` in `docs/adr`, `CHANGELOG.md`, `docs/launch`, `apps/desktop/src`). |
| ER-2 → V3-5 (no exit lines or receipts, so the gate would refuse the ledger) | **holds, as far as it goes** | The ledger now carries `Exit for iteration 1: …` and `Exit for iteration 2: …` as the last line of each section. *Release close* item 1 names the fifteen receipts and the exit line per iteration. In run 6 the only gate problems left are the 15 absent receipts and iteration 3's exit line, both of which item 1 assigns to the release commit. One more refusal is in the same class and is not named: see ERR-1. |
| ER-3 → V3-4 (the runbook said the shipped Intel app runs on a measured runtime) | **holds** | `docs/launch/release-mac.md:14–17` now reads: "Electron 44.0.0's npm darwin-x64 build was measured under Rosetta and admitted as a runtime; the packaged app's framework is joined and re-signed, so neither architecture of the shipped app matches a measured tuple, as the arm64 one never did (N1; nothing in the app reads the tuple yet)". This matches `runtimeAdmission.ts` region `measured-runtimes` and the type-only imports of `ownedBackendProcessRegistry.ts`. |

Earlier dispositions on this level that the delta touches still hold:
- **V2-4** (the `identity-refused` match, `startupFailure.ts:100`): unchanged. Run 3 passes.
- **V2-3** (the gate's place before the retry point and the hub): `index.ts` is not in the delta. Run 1's wiring-order
  case passes.

## The delta, read for regressions

- **`seedRepair.ts`**: only the constant and its comment changed (see V3-1). Run 2 passes. That runner applies SQL
  directly, not through PostgREST, so the `max_rows` bound is held by run 1's config test and by the arithmetic, not
  by run 2.
- **Refusal text** (`startupFailure.ts`, en/ru `startup.identity-refused.*`, `strings.md`): the new sentence "If they
  say something could not be read, retry first" is accurate.
  - The details under this cause carry the repair's reason, and three of the repair's reasons say exactly that:
    "the estate's journal / members / membership decisions could not be read: …" (`seedRepair.ts:80–85`).
  - The refusal is retryable (V2-3).
  - The classifier and its test agree on the title (run 3), and en and the classifier say the same text.
- **`scripts/ci.sh` comments**: "it skips off macOS" matches `universal-mac.test.mjs:15,55`
  (`skip: process.platform !== 'darwin'`). "these five" matches the loop's five runners.
- **`rehearse-upgrade.mjs`**: the change is a header comment only. It describes what the fixture does without
  overstating it.
- **Registers**: CO-243 now exists (`2026-08-16-software-fabric-carryover.md`), and V2-15 and V3-13 rule with it. The
  next free id is `CO-244`. Run 5 passes.

## New finding

### ERR-1: non-blocking. *Release close* item 1 sets `verifiedCommit` to "the iteration-3 candidate", but the code changed after that candidate, so a release commit built as item 1 says would be refused by preflight

- **Evidence.**
  - *Release close* item 1 asks for "`verifiedCommit` = the iteration-3 candidate". The ledger's *Iteration 3*
    section names that candidate as `06c5234c65d3…` in full. It names the final candidate only as "the final
    candidate", with no hash.
  - The delta from `06c5234c` changes runtime code (`seedRepair.ts`, `startupFailure.ts`, en/ru `i18n`), tests,
    ADRs, `scripts/ci.sh` and `scripts/rehearse-upgrade.mjs`.
  - `release-mac.mjs#verifiedCandidateProblem` allows after `verifiedCommit` only these release-metadata paths:
    - the version-only `apps/desktop/package.json`;
    - `CHANGELOG.md`, the gate, the ledger, `MERGES.md` and `map.html`;
    - `.md` files under `docs/handoffs/` or `docs/reports/` that the gate's `releaseMetadata` lists;
    - the declared review reports and receipts.
  - Run 6, with `verifiedCommit` = `06c5234c`, gives: "unverified changes follow the verified commit:
    apps/desktop/src/main/seedRepair.ts, apps/desktop/src/renderer/src/i18n/en.ts, …" (19 paths).
  - With `verifiedCommit` = `2e040731` that check passes. The gate then adds one problem: "iteration 3 of the ledger
    does not name its candidate commit 2e04073125db85d1fe3763267cd85c3d78fabaf2 in full" (`release-gate.mjs:129`).
  - Two more points for the same release commit:
    - The receipts must carry `candidateCommit` = `2e040731…` (`release-gate.mjs:47`). This is the 0.3.3 precedent,
      where `verifiedCommit` and iteration 3's receipts name the final candidate `fa9cdf6b`.
    - This recheck's five reports must sit somewhere preflight allows. A recheck report committed under
      `docs/evidence/reviews/0.3.4/iteration-3/` that is not a receipt's declared `report` is an unverified change.
      0.3.3 put its NB-1 recheck under `docs/handoffs/` and listed it in `releaseMetadata` for this reason.
- **Why it is not blocking.** It is a closed failure: preflight refuses, and nothing wrong ships. As with ER-2, it
  would surface in the protected release run after an approval was spent, unless it is caught first.
- **Smallest fix.** Change item 1 to read:
  - `verifiedCommit` and iteration 3's receipt `candidateCommit` = the final candidate
    `2e04073125db85d1fe3763267cd85c3d78fabaf2`, named in full in the *Iteration 3* section beside `06c5234c`.
  - The recheck reports are either iteration 3's declared `report`s or `.md` files under `docs/handoffs/` listed in
    `releaseMetadata`.

  Then run `node scripts/release-mac.mjs --check-only --tag v0.3.4` (or `verifiedCandidateProblem` plus `releaseGateProblems`) on
  the release commit before tagging.

VERDICT: 0 blocking, 1 non-blocking
