# Fabric 0.3.10 release review, iteration 3: verification of the final candidate's difference

- **Level:** unit tier certification (task-pipeline verifier-unit), blind to the iteration-3 reviewers.
- **Read:** `git diff 39b72c07..17793816`: `apps/desktop/src/shared/opsLog.ts` (then `errorShape`), `launch/rail.css`,
  `opsLog.test.ts`, `appRoute.test.ts`, `scripts/test/shell-scroll.browser.mjs`, and the ledger's Iteration 3 table.
- **Date:** 2026-10-22. Detached worktree at `17793816`, removed after; the repository's `git status` stayed empty.
- **Verdict:** fail. The code that changed is sound; two rows marked fixed were false on cases their findings named.

## What held

- No secret field of a plain-object error reached the record in any probe (password, token, cookie, authorization,
  api_key, client_secret, access_token, nested headers, arrays, null-prototype objects); a URL password in a message and
  an assignment in a code were redacted.
- No getter or `toJSON` ran; circular, BigInt, symbol-keyed, throwing-Proxy, 10 000-deep and 5 MB inputs left a record.
- Error instances unchanged; above 640 px the final stylesheet laid out 480 probed configurations as the reviewed one.
- Plants: the two new log tests fail on `39b72c07`'s code; the tiny-window case fails with the reviewed stylesheet; the
  App key test and the new `scrollKeyOf` cases fail on their plants. All 69 ledger rows match the gate's pattern.

## Findings

| ID | Severity | Finding | Where |
|---|---|---|---|
| VF-1 | breaks the ledger row | V3-4: above 640 px, three notices and a refusal of about 1 000 characters still push the act line out (1280 x 720: 472 to 742; «Вернуть» out of the window after focus); the page floor `min(50%, 100% - 8rem)` does not prevent it | `rail.css` page floor, notice cap, act line cap |
| VF-2 | breaks the ledger row | V3-3: a revoked Proxy still makes the record throw, because `e instanceof Error` runs before the guard | `opsLog.ts` the error branch of `opsRecord` |
| VF-3 | risk | The DA-2 test passes with getters running, without the guard and without the bound; circular and BigInt untested | `opsLog.test.ts` |
| VF-4 | risk | Redaction runs twice for a message-less object: the structural pass's counts are lost, and the text pass's header rule swallows the rest of the JSON | `opsLog.ts` |
| VF-5 | risk | The App key test matches source text and passes with the expected text kept in a comment | `appRoute.test.ts` |
| VF-6 | risk | V3-5 holds only when both act-line caps go | `rail.css` |
| VF-7 | risk | The ledger's Iteration 3 intro kept the `__FINAL__` placeholder | the ledger |

Dispositions: V3-20 to V3-24 in the ledger (VF-1 to VF-5); VF-6 is covered by V3-20's ten-size case, which fails with
the act line's cap removed; VF-7 is filled in the release commit.
