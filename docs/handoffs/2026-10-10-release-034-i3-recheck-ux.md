# 0.3.4 verification, iteration 3 recheck — scenarios, UX and UI

- **Final candidate:** `2e04073125db85d1fe3763267cd85c3d78fabaf2`, in the detached checkout
  `<cache>/cand4`. `git rev-parse HEAD` printed the same SHA, and `git status --short` was empty before and after
  every run.
- **Previous candidate (iteration 3):** `06c5234c65d3f4cbdbf5f2a6c50740a9c556d6b3`. The delta I read is
  `git diff 06c5234c..2e04073125db85d1fe3763267cd85c3d78fabaf2`, which touches 26 files.
- **Reviewer:** read-only. Nothing was edited, committed or pushed, no app was started or stopped, and neither the
  operator's database nor `~/Library/Application Support` was touched. `run-first-install-db.mjs` builds its own
  isolated PostgreSQL.
- **Level:** what a person sees. This recheck covers iteration 3's UX-1 and UX-2 (dispositions V3-2 and V3-3) and
  any regression the delta brings to my level.

## What I ran

| Command (in the candidate checkout) | Exit | Output (short) |
|---|---|---|
| `node --experimental-strip-types test/seed-repair.test.mjs` (apps/desktop) | 0 | `seed-repair: all green`, including the new `max_rows` case |
| `npx vitest run src/shared/startupFailure.test.ts src/shared/errorText.test.ts` (apps/desktop) | 0 | 2 files, 41 tests passed. The identity case now expects "…the Estate it was opening." |
| `node --experimental-strip-types test/stack-folder.test.mjs` (apps/desktop) | 0 | `stack-folder: all green` |
| `node apps/desktop/test/run-first-install-db.mjs` | 0 | `fresh` 4 PASS, `legacy` 8 PASS, then "PASS full migration chain: a fresh install opens its estate, and a 0.3.3 install's database is repaired, on isolated PostgreSQL" |
| `python3 -I docs/brand/lint.py` | 0 | 0 errors, 1630 warnings, the same count as iteration 3. None of them is on `startup.identity-refused.*` |
| `python3 -I docs/ux/lint.py` | 0 | `OK — docs/ux is consistent` |
| `node scripts/sync-product-ux.mjs --check` | 0 | `PASS UX projections match canonical registries` |
| `node scripts/check-design-map.mjs` | 0 | `PASS: map source stamp (4616 files), 546 unique anchors and 1716 link targets` |
| `git grep -n "it opened\|которое он открыл"` outside dated reviews and audits | — | No startup string, doc or test is left with the old title. The hits are unrelated code comments (`files.ts`, `pty.ts`, …) |

## Iteration-3 findings at this level

| finding | holds? | evidence |
|---|---|---|
| UX-1 → V3-2: the title said "the Estate it opened" | **Holds.** | The new wording is in all four places the finding named: `en.ts:905` "Fabric does not have access to the Estate it was opening", `ru.ts:284` «…к пространству, которое он открывал», the classifier `shared/startupFailure.ts:103`, and the row at `docs/brand/strings.md:717`. `startupFailure.test.ts` asserts the new title, and 41 of 41 tests pass. Nothing else carries the old wording (the grep above). |
| UX-2 → V3-3: when a read failed, the remedy said "report" instead of retry | **Holds for the case the fix targets, the read failures. Narrower than the finding's evidence.** | The remedy now says "If they say something could not be read, retry first; otherwise copy them and report them…". It is in en (`en.ts:906`), ru (`ru.ts:285`, «Если там сказано, что что-то не прочиталось, сначала повторите; иначе…»), the classifier (`startupFailure.ts:104`) and `strings.md:718`. Retry is really on offer: the gate (`index.ts` region `seed-repair-wiring`) runs before `pastRetryPoint = true` (`index.ts:675`), and the dialog takes `retryable: !pastRetryPoint` (`:4625`). The button is "Retry" / «Повторить» (`en.ts:900`, `ru.ts:279`), so the remedy names the step on screen. The three "could not be read" reasons (`seedRepair.ts:81,83,85`) now point to Retry. Two of the reasons iteration 3 quoted do not say "could not be read": "the membership could not be granted: …" (`:89`) and "the repair could not run: …" (`:95`). See UXR-1. The ruling on the restored Estate ("unreachable today… not a defect") matches what iteration 3 measured: a restore grants `owner` (migration 66), and no surface revokes a membership. |

## Does the delta regress anything at my level?

**Nothing false, broken or misleading.** The parts of the delta a person meets:

- **The startup strings (en/ru/classifier/`strings.md`).** The four copies match, and the two locales mean the same
  thing. Both use the button's own verb ("retry" / «повторите»). In both, "them"/«их» still clearly means the details.
  The brand lint shows no new warning.
- **`EVENT_READ_LIMIT` 1000 → 999 (`seedRepair.ts:32`).** The visible outcome does not change for the shapes a person
  can have: `legacy` 8/8 and `fresh` 4/4 on the full chain. The new case in `seed-repair.test.mjs` reads `max_rows`
  from `supabase/config.toml` and holds the limit below it. The reason "the estate has more events than the repair
  reads" is unchanged.
- **`release-mac.md:15–17`.** The Intel wording no longer claims that the shipped app runs on a measured runtime. It
  now says the npm darwin-x64 build was measured under Rosetta and that neither architecture of the packaged app
  matches a tuple. This is more honest, and the CHANGELOG's user-facing Intel line ("not yet run on an Intel Mac")
  still matches it.
- **`docs/reports/map.html`.** There is a new top changelog entry, `#iteration-2026-10-10-release-034-i3`, and its
  claims at my level hold: the title «…которое он открывал» and the advice to press Retry first. The map gate passes.
- **No scenario, flow or screen record changed.** SCN-095, FLW-55 and SCR-36 still describe the gate before the hub,
  and that is still true. `lint.py` and the projection check pass.

## New findings

### UXR-1 — non-blocking — The "retry first" sentence covers failed reads, not a failed grant or a failed repair run

- **Evidence.**
  - Besides the three read failures, `repairSeedOnlyEstate` returns `the membership could not be granted: <error>`
    (`seedRepair.ts:89`) and `the repair could not run: <error>` (`:95`).
  - Either reason ends up in an `identity-refused` dialog when the second `identity.establish()` succeeds and still
    reads `not_a_member` (`index.ts` region `seed-repair-wiring`).
  - In that case the details say "could not be granted: fetch failed" or "could not run: TypeError: …". The remedy's
    new condition ("If they say something could not be read") does not match those details, so the person is again
    told to report a failure that may be passing.
- **Reach.** Very low. The two reads around the grant must succeed while the grant RPC itself fails, or code between
  them must throw. Retry is still the default button.
- **Smallest fix.** Widen the condition in en, ru, the classifier and `strings.md` to "If they say something could
  not be read, granted or run, retry first" (ru «…не прочиталось или не выполнилось…»). The alternative is to accept
  it as it stands with a carry-over row.

VERDICT: 0 blocking, 1 non-blocking
