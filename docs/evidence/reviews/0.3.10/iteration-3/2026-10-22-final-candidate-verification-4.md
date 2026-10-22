# Fabric 0.3.10 release review, iteration 3: fourth verification of the final candidate (unit and seam)

- **Read:** `1b57a73a`. Unit tier: `apps/desktop/src/shared/opsLog.ts` (`opsRecord`, `errorParts`) with `redact.ts`,
  against v0.3.9. Seam tier: the callers and readers of the operations log; `main/`, `test/` and `scripts/` unchanged
  since `ea9adf06`.
- **Date:** 2026-10-22. Detached worktrees, removed after; the repository's `git status` stayed empty.
- **Verdicts:** unit fail, on two findings; seam pass.

## Unit tier

Held: Error messages redacted as in v0.3.9 with the same counts and cap; plain objects without a message write no field
value except `code`; no throw for any input (v0.3.9 threw on a revoked Proxy); no getter or `toJSON` of a plain object
run; a detail key `__error` kept; a PostgREST refusal reads «permission denied for table t (42501)». Each claimed test
fails when undone, except the message half of the single-read test.

| ID | Severity | Finding |
|---|---|---|
| VF4-1 | breaks | An Error's name is no longer redacted or capped (v0.3.9 masked a token in a name and capped it at 624 characters) |
| VF4-2 | breaks | A plain object without a message writes its `code` |
| VF4-3 | risk | The single-read test does not watch the message half |
| VF4-4 | risk | Beside a message, a `code` is any string up to 32 characters |
| VF4-5 | risk | A letters-only key can be a secret |
| VF4-6 | risk | An Error's own getters run once (as in v0.3.9); a thrown function prints its source (as in v0.3.9) |

## Seam tier

Held: every caller and reader works; the PostgREST bodies of the board and comms reads take the unchanged message path;
nothing reads `detail.__error`, the old JSON text or an object pass; sampling, retention and `lost()` untouched; vitest
199 files and 2 379 tests, ops 16, retention 6, board service 40, comms 19, stack watch 14, all green.

| ID | Severity | Finding |
|---|---|---|
| VS4-1 | risk | An Error's name is no longer redacted or capped (the unit tier's VF4-1) |
| VS4-2 | risk | A plain object without a message now says only its field names (the stated trade) |

Dispositions: V3-35 to V3-38 in the ledger.
