# 0.3.4 verification, iteration 3 recheck — data, memory, orchestration, harness

Candidate: `2e04073125db85d1fe3763267cd85c3d78fabaf2`, in the detached checkout `<cache>/cand4`.
- `git rev-parse HEAD` printed that hash, and `git status --short` was empty before and after the recheck.
- The delta read is `git diff 06c5234c..2e04073125db85d1fe3763267cd85c3d78fabaf2`: 26 files, most of them the five iteration-3 reports and ledger rows.

I worked read-only. The one plant was made in a `git archive` copy in my scratch directory, not in the checkout. I started no app or Supabase stack. I did not address the operator's database (Docker `fabric`, 54321/54322) or `~/Library/Application Support`.

## What was run

| Command | Exit | Result |
|---|---|---|
| `node --experimental-strip-types apps/desktop/test/seed-repair.test.mjs` | 0 | `seed-repair: all green` |
| Same test, on a scratch copy with `EVENT_READ_LIMIT = 1000` planted | 1 | `AssertionError: the repair reads 1001 rows, more than the API returns (1000)` |
| Same test, on a scratch copy with the limit at 999 and `max_rows = 999` planted | 1 | `the repair reads 1000 rows, more than the API returns (999)`. The bound follows the config; it is not hard-coded |
| `node apps/desktop/test/run-first-install-db.mjs` | 0 | `fresh` 4/4 PASS, `legacy` 8/8 PASS, "full migration chain … on isolated PostgreSQL" |
| `node scripts/check-regions.mjs` | 0 | `PASS code regions: 202 marker(s)` |
| `node scripts/check-registers.mjs` | 0 | — |

## Iteration-3 findings at this level

| finding | holds? | evidence |
|---|---|---|
| DA-1 → V3-1 (the read of `EVENT_READ_LIMIT + 1` rows went past `max_rows`) | **yes** | **Code.** `seedRepair.ts:32` sets `EVENT_READ_LIMIT = 999`. The read is `.limit(EVENT_READ_LIMIT + 1)` (`:103`), 1000 rows, which equals `supabase/config.toml:18` `max_rows = 1000`. The refusal is `events.length > EVENT_READ_LIMIT` (`:62`). Worked through: a journal of 1000 or more events returns 1000 rows, so it is refused; 999 or fewer are read whole. The used estate behind 999 hub requests from i3 (1001 rows) is now refused. No other `max_rows` / `PGRST_DB_MAX_ROWS` override exists in the repository (git grep).<br>**Test.** `seed-repair.test.mjs:124-133` reads `max_rows` from the config and asserts `EVENT_READ_LIMIT + 1 <= maxRows`. I watched it fail with 1000, as the row claims, and with `max_rows` lowered. The pure case at `:28` still feeds 1 + `EVENT_READ_LIMIT` events. `first-install-db.test.mjs:71` imports the constant.<br>**Docs.** The `seedRepair.ts:25-31` comment and ADR-0131 §2 (line 39, "(999) events in all — so the read of one more stays within the API's `max_rows`") now state the bound that holds. The ledger's V2-6 row still says 1000, but it is the dated record of iteration 2, and V3-1 supersedes it |
| DA-2 → V3-10 (`--make-fixture` seeds with the current seed) | **yes**, with one overstatement (DAR-1) | **Script.** The `rehearse-upgrade.mjs:18-21` header now says the seed is this checkout's, that the fixture's estate is owned by the app's person, and that it rehearses the upgrade's counts, not CO-241, which `first-install-db.test.mjs` holds. That is option 2 of the fix I offered, and it is true for every documented fixture: migrations 58 and 59 already honour `owner_person_id` (`…058:120-123`, `…059:56-59`), so N = 69/75/78 all give an app-owned estate.<br>**Runbook.** `release-mac.md:246` still calls `--make-fixture 75` "a synthetic 0.3.0-shaped dump". That is acceptable: the step it supports is the counts rehearsal, and the script states its own limit.<br>**Upgrade path.** The ledger cell also says the upgrade-then-repair path "was measured by iteration 3's UX and data reviewers". The UX reviewer did measure it (`iteration-3/2026-10-10-ux.md:42`, `upgrade-then-repair.mjs`, 4 runs). The data reviewer did not: it read the path from the migrations by grep and said no committed test runs it (`iteration-3/2026-10-10-data.md`, shapes table and DA-2). See DAR-1 |

## The delta at this level

- **`seedRepair.ts`.** Only the constant and its comment changed. The predicate, the reads and the RPC are unchanged.
- **`seed-repair.test.mjs`.** One block was added. It reads the real config through `new URL('../../../supabase/config.toml', import.meta.url)`, which resolves from `apps/desktop/test/` to the repository root.
- **`scripts/ci.sh`.** Two comments changed:
  - "it skips off macOS" is true: `universal-mac.test.mjs:15,55` skip when `process.platform !== 'darwin'`.
  - "these five" matches the five runners in the loop (`ci.sh:358`).
- **`scripts/rehearse-upgrade.mjs`.** Only the header changed; the behaviour is the same (`:168` `seed: true`).
- **`release-mac.md` §What the installed app needs.** It now says the npm darwin-x64 build was measured under Rosetta. It also says the packaged, re-signed framework matches no tuple on either architecture, and that nothing in the app reads the tuple yet. This agrees with i3's reading: `isMeasuredRuntime` is reached only through `createOwnedBackendProcessRegistry`, which nothing in `apps/desktop/src` instantiates.
- **ADR-0131 §2, CO-243 (next free id CO-244), the P-15 range wording.** These are consistent with the code. The registers gate exits 0.
- **Regressions.** I found nothing false, broken or misleading at this level.

## New findings

### DAR-1 — non-blocking — V3-10's disposition credits the data reviewer with a measurement it did not make

**Evidence.**
- The ledger (`docs/evidence/plans/2026-10-10-release-034-verification.md`, row V3-10) says: "the upgrade-then-repair path was measured by iteration 3's UX and data reviewers on their own databases".
- The iteration-3 data report's shapes table, row "0.2.0 / 0.3.0 / 0.3.1 database (69/75/78) upgraded to 79", gives grep as its evidence ("only function bodies, plus 58:79").
- Its DA-2 says outright that no committed test runs that path. Only the UX report measured it (`upgrade-then-repair.mjs`, 4 runs).

**Why it is not blocking.** The claim it supports still holds on the UX reviewer's receipt. Nothing in the product depends on it.

**Smallest fix.** In the V3-10 cell, write "measured by iteration 3's UX reviewer (`upgrade-then-repair.mjs`, 0.2.0/0.3.0/0.3.1); the data reviewer read it from the migrations". Make the edit in the release commit, under the lease.

VERDICT: 0 blocking, 1 non-blocking
