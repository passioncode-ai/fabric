# Final scoped review — committed snapshot and pending status, 2026-09-07

Scope: only `verifyCommittedSnapshot`, its publisher/receipt call sites, generated-content force-add, the ignored-log fixture, child commit `e34586e` as present in `9bcc811`, and the pending receipt status fix. Read-only review; no repository or deployment changes.

## Result

No blocker found for publishing the current snapshot.

- `scripts/workspace-snapshot.mjs:62` checks manifest-listed files against committed Git bytes rather than trusting local files that Git may ignore. Extra committed content files are also rejected.
- `scripts/workspace.mjs:50` force-adds only the exporter-owned `content` directory. `:52` verifies committed bytes before GitHub/Heroku pushes. `checkReceipt` invokes the same committed-byte guard after canonical manifest and working-byte checks.
- The new ignored-log fixture reproduces a locally present but omitted historical `.log` file, requires the committed guard to fail, then demonstrates repair through force-add. Child `e34586e` contains the 17 historical logs, adds the generated-content `.log` exception, and wires `heroku-postbuild` to `npm run verify:content`.
- `scripts/workspace.mjs:16` now reports a pending parent commit and recommends `publish --resume` when the staged pin/receipt are valid but not committed. This closes RW-N1 without weakening the precommit receipt gate.

## Resolved follow-up in the new helper

**P2 — Use NUL-delimited Git paths when verifying the committed tree — CLOSED.**

Location: `scripts/workspace-snapshot.mjs:64`.

`git ls-tree -r --name-only HEAD content/` uses Git's default C quoting for non-ASCII paths, while manifest paths are literal UTF-8. A fully committed `docs/заметки.md` therefore produces the false error `Published snapshot commit omits manifest file (possibly ignored by Git): docs/заметки.md`. This was reproduced in an isolated temporary source/child pair using the real exporter and new committed verifier. Existing current snapshot paths are unaffected.

Repair: request `-z` output and use `.split('\0').filter(Boolean)`; retain all existing committed-byte and cardinality checks. Add a Unicode-path case to this fixture family. This is confined to the newly added helper and does not require expanding the audit.

Closure verified by source inspection: `verifyCommittedSnapshot` now uses `ls-tree -rz` and `.split('\0').filter(Boolean)`. The added fixture exports, commits and verifies `docs/заметки проекта.md`, exercising Unicode and spaces together. The supplied `/tmp/fabric-workspace-protocol-tests-final.txt` records this case passing and 11/11 protocol tests passing, zero failures. No open findings remain in this final scoped review.

Existing passing suites were not rerun. Remote Heroku state, final source/child pins and CI completion remain the root implementer's verification scope.
