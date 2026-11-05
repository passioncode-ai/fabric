report: fabric-0316-final-candidate-delta
# Fabric 0.3.16 final candidate 822560c5: verification of the fix for B-1

A fresh verifier, independent of the iteration-3 reviewers and of the two verifiers of `23e1e89c`, read commit
`822560c5baec3d9cf4181e7f65acc8b79dd4819e` read-only and the whole of `git diff 23e1e89c..822560c5` (10 files, +72/−25).
`git status --short` was empty. The verifier's answer was saved here by the release session, unchanged in substance.
Verdict: ready.

## What was verified

| Item | Evidence | Result |
|---|---|---|
| B-1, `until` | `boardDispatchRun.ts#createBoardDispatch`: a new record gets `until: Date.parse(req.deadline)` only when it parses | correct |
| B-1, the keep rule | the end of `pass`: an ended record stays only as its request's newest and when it started within `KEEP_REQUEST_MS`, its `until` is ahead, or its request was read this pass; the rest is cut to the newest 500 | correct |
| probe (a) | a to-operator record 9 days old, its request read with a deadline 20 days out, 600 older records: 4 passes, 0 launches, still to-operator, 501 records | pass |
| probe (a2) | the same with newer filler first in the file: 0 launches | pass |
| probe (b) | request not read, `until` 20 days ahead: kept; when the request comes back, 0 launches | pass |
| probe (c) | request gone, `until` past, 11 days old: dropped; 500 records, and 1200 ended records also end at 500 | pass |
| probe (d) | a legacy record without `until` and a junk `until`: the pass runs, 500 records | pass |
| probe (f), end to end | two empty runs, to-operator, a restart 12 days later with 600 old records, the request leaving and returning to the read: 2 launches, never a third | pass |
| probe (e) | an unparsable deadline: no `until`, nothing starts | pass |
| the old defect | the same probe against `23e1e89c`'s dispatcher fails (a), (a2), (b) and (f) | reproduced |
| NB-1, thrown shape | `observatoryMemory.ts#createObservatoryClient` throws `observatory_handoff_create refused: {"error":"WorkflowClosed",…}`; `/\bWorkflowClosed\b/` matches and a new workflow opens | pass |
| NB-1, body shape | Observatory's `_workflow_error` answers `{error: "WorkflowClosed"}`; matched | pass |
| NB-1, a dropped connection | `Connection closed`, `MCP error -32000: Connection closed` and a `StoreError` about a closed database open no second workflow (at `23e1e89c` the first two did) | pass |
| NB-3, `noteOf` | paths after a backtick, `<`, `;`, `|` or `{`, with `~/` and `C:\` forms, are dropped; `refused: no_agent` and `a|b` unchanged | pass |
| comments and fixture | `App.tsx` and `SessionWindow.test.tsx` comments match `rail.agentTitle`, `consoles.sessionTitle`, `session.back`; `agent-registry.test.mjs` uses `C:\Users\example` | true |

## Commands

| Command | Exit | Result |
|---|---|---|
| probe over the real dispatcher | 0 | 13 of 13 pass |
| the same probe over `23e1e89c`'s dispatcher | 1 | 7 fail, as the defect predicts |
| `node --experimental-strip-types --test test/board-dispatch-run.test.mjs` | 0 | 30 pass |
| `node --experimental-strip-types --test test/agent-registry.test.mjs` | 0 | 17 pass |
| `npx vitest run src/renderer/src/SessionWindow.test.tsx` | 0 | 9 passed |
| `node scripts/check-registers.mjs` | 0 | PASS, 507 rows |
| `bash scripts/check-docs.sh` | 0 | PASS |
| `node scripts/check-design-map.mjs` | 0 | PASS, 7001 files, 985 anchors |
| `node scripts/check-regions.mjs` | 0 | PASS, 647 markers |

The document changes (AGENTS.md's dispatcher row, the CHANGELOG's Windows and Linux line and the board rule's «nothing
else enforces it», the on-demand spec §3.3, CO-409's NB-2 and NB-5, CO-439's part 1, the map's top entry) are each true
of the code. No added line carries an em dash or a home path other than `/Users/example` and `C:\Users\example`.

## Findings (none blocking)

1. A request's deadline has no upper bound on the board, so a kept record can outlive the 8 days by far; growth stays
   bounded by the dispatches (at most 20 per project a day) and one kept record per request.
2. Earlier than this change: an unparsable deadline makes `runEndsAt` throw and ends the whole pass; the board's
   `timestamptz` cast keeps it from the real door.
3. Earlier than this change: a run whose request was not read this pass ends as `unknown` without counting as empty
   (`watch`), so a request moving in and out of the read at its page bounds could get a third run.
4. The test stand-in for a closed workflow throws a made-up message; both real shapes were checked by the probe.
5. `SessionWindow.tsx` keeps two comments with the runner-first order.

verdict: ready
