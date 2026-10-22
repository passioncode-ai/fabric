# Fabric 0.3.10 release review, iteration 3: third verification of the final candidate (unit and seam)

- **Read:** `ea9adf06` as a whole. Unit tier: `apps/desktop/src/shared/opsLog.ts` with `redact.ts`, `launch/rail.css`,
  the ledger rows V3-20 to V3-26. Seam tier: every caller of the ops sink in `apps/desktop/src/main` and `shared`, every
  reader of `operations.jsonl`, every scroll user in the renderer, the other windows.
- **Date:** 2026-10-22. Detached worktrees, removed after; the repository's `git status` stayed empty.
- **Verdicts:** unit fail, on one finding; seam pass.

## Unit tier

Held: 61 error inputs, none threw or dropped the record; eleven secret field names masked as keys; 2 052 layout
configurations (widths 1280, 800, 640; heights 240 to 1400; 0 to 3 notices; five act lines; Home and Settings) with the
act line and «Вернуть» in the window and every page reaching its foot; print; the console; each claimed test fails when
its fix is undone.

| ID | Severity | Finding |
|---|---|---|
| VF3-1 | breaks | A plain-object error with a `{name, value}` header pair named `cookie`, `set-cookie`, `password` or `token` reaches the record in clear (v0.3.9 wrote «[object Object]») |
| VF3-2 | risk | A bare `Bearer <token>` is not redacted (in an Error message as in v0.3.9; in a plain-object field a new path) |
| VF3-3 | risk | An Error's name and message are read twice; a changing getter gives a number |
| VF3-4 | risk | One secret counted twice; a marker can swallow a closing quote |
| VF3-5 | risk | A plain object with a message keeps only message and code (PostgREST `details`, `hint` dropped) |
| VF3-6 | risk | A detail key `__error` collides with the error's slot |
| VF3-7 | risk | In `detail`, header pairs and keys such as `x-agw-key` and `apikey` stay in clear (as in v0.3.9) |

## Seam tier

Held: the record's shape `{ name, message }` and `redactions` unchanged for every caller and reader; nothing depends on
«[object Object]»; the sink handles 4 000-character messages (lost 0); merged counts correct; the board tick reads
«permission denied (42501)»; the scroll reset, `revealSection`, the html and body overflow, the console, the other windows
(no `.launch-root`), the ported launch CSS check; 199 vitest files and 2 381 tests, the ops, retention, board, comms and
stack neighbours green.

| ID | Severity | Finding |
|---|---|---|
| VS-1 | risk | A plain-object message cut at 4 000 characters carries no truncation marker |
| VS-2 | risk | A value whose meaning is in a prototype `toString` is now said as its own data fields |
| VS-3 | risk | ProjectHome's top-of-page reset now runs before `revealSection` aligns a section; the section lands because the alignment re-runs for 1.5 s |

Dispositions: V3-29 to V3-34 in the ledger.
