# Fabric 0.3.10 release review, iteration 3: second verification of the final candidate

- **Level:** unit tier certification (task-pipeline verifier-unit), blind to the iteration-3 reviewers and the first
  verifier.
- **Read:** `git diff 17793816..a5ab2548` and the result as a whole: `apps/desktop/src/shared/opsLog.ts` (`errorParts`,
  `opsRecord`), `apps/desktop/src/shared/redact.ts` (unchanged since v0.3.9), `launch/rail.css`, the tests and the
  ledger rows V3-20 to V3-24.
- **Date:** 2026-10-22. Detached worktree at `a5ab2548`, removed after; the repository's `git status` stayed empty.
- **Verdict:** fail, on one finding.

## What held

- `opsRecord` returned a record for every error input probed (revoked Proxy, Proxies with throwing traps, an Error
  subclass with a throwing name getter, circular, BigInt, symbol keys, null prototype, 10 000 deep, 5 MB, 5 000 keys,
  primitives); v0.3.9 threw on five of them.
- Error instances give the same `{ name, message }` as v0.3.9.
- Field-name redaction of a plain-object error is now counted; non-secret fields are kept.
- Layout, 3 780 configurations (widths 1280, 800, 640; heights 240 to 1400; 0 to 3 notices; short and very long act
  lines; home, Settings, console): the act line and «Вернуть» always in the window, the page always reachable, neither
  the document nor the place scrolls; with no notice, 540 of 540 configurations identical to `17793816`.
- Each claimed test fails when its fix is undone (seven plants).

## Findings

| ID | Severity | Finding | Where |
|---|---|---|---|
| VF2-1 | breaks | The one-pass redaction dropped the text rules over a plain-object error's body: a header given as a name/value pair, an `x-agw-key` header and an `apikey` field reach the log in clear, which `17793816` masked and v0.3.9 never wrote | `opsLog.ts` `opsRecord` |
| VF2-2 | risk | An Error with a non-string message gives `null`, an object name passes through, a circular message throws (the throw as in v0.3.9) | `opsLog.ts` `errorParts` |
| VF2-3 | risk | The text rules miss a bare `PASSWORD=` and a lowercase `password=` (v0.3.9 too) | `redact.ts` assignment rule |
| VF2-4 | risk | With notices the page keeps 40 % of the place instead of 50 % | `rail.css` |

Dispositions: V3-25 to V3-28 in the ledger.
