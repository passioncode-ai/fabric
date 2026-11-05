report: fabric-0316-final-candidate-code
# Fabric 0.3.16 final candidate 23e1e89c: the iteration-3 code fixes

A fresh verifier, independent of the five iteration-3 reviewers, read commit
`23e1e89c56ed231b7db091793be92589e4d87739` read-only against `344b09e8`, ran the changed tests one file at a time and
probed the real `createBoardDispatch` and `noteOf` at both commits. `git status --short` was empty before and after.
The verifier could not write files; its answer was saved here by the release session, unchanged in substance.

## Rows verified

| Row | Finding | Holds | Evidence |
|---|---|---|---|
| V3-1 | UX-1 | yes | `i18n/ru.ts`, `i18n/en.ts` `settings.permissions.lede`; `boardDispatchWiring.ts` always passes `--permissions all` |
| V3-2 | UX-2 | yes | `HistoryScreen.tsx`: the mark only without the `who` and `project` filters; test file 24 passed |
| V3-3 | UX-3 | ruled, present | CO-409 lists it |
| V3-4 | UX-4 | yes | `consoles.sessionTitle`, `session.back` project first in en and ru; callers pass named parameters; SessionWindow 9 passed |
| V3-5 | UX-5 | ruled, present | CO-511 |
| V3-6 | UX-6 | yes | `AgentAccessPanel.tsx`: a `section` as a page, an `aside` as a side panel; the `.shell>aside` rule does not reach it; 40 passed; `tsc -p tsconfig.web.json` exit 0 |
| V3-7 | ER-1 | yes | probe: 3 failed closes, a restart, 10 passes: 5 attempts and one `gave_up` (at `344b09e8`: 13 and still trying) |
| V3-8 | ER-2 | yes | probe, Switchboard always `unknown`: 2 launches, then to the operator, `emptyRuns [1,2]` (at `344b09e8`: 4 and going) |
| V3-9 | ER-3 | yes (NB-1) | the fresh-workflow branch never takes back, so no recursion; a failing fresh open backs off |
| V3-10 | ER-4 | yes (NB-2) | switch off: 0 board reads, no launch; a `running` record is followed to its end, not ended by the switch |
| V3-11 to V3-15 | ER-5 to ER-9 | ruled, present | CO-409 lists them |
| V3-16, V3-22 | ER-10, DA-4 | yes (NB-3) | every listed shape becomes `<path>`; refusal codes unchanged |
| V3-17, V3-18, V3-21 | ER-11, ER-12, DA-3 | ruled, present | CO-509 lists them |
| V3-19 | DA-1 | yes | CO-492 and CO-505 keep only Fabric's own interface string |
| V3-20 | DA-2 | partly (B-1) | a request's newest record is kept with `emptyRuns 1`; records in flight kept; but to-operator records are trimmed after 8 days |
| V3-32 | PL-1 | yes | the gitlink is `77e81ea1`, the receipt's commit; `workspacePinProblem` null at HEAD, a mismatch at `344b09e8` |

## Commands

| Command | Exit | Result |
|---|---|---|
| `node --experimental-strip-types --test test/board-dispatch-run.test.mjs` | 0 | 27 pass |
| `npx vitest run src/renderer/src/launch/HistoryScreen.test.tsx` | 0 | 24 passed |
| `npx vitest run src/renderer/src/AgentAccessPanel.test.tsx` | 0 | 40 passed |
| `npx vitest run src/renderer/src/SessionWindow.test.tsx` | 0 | 9 passed |
| `npx vitest run src/shared/abandonedSweep.test.ts` | 0 | 32 passed |
| `workspacePinProblem` at HEAD / at `344b09e8` | 0 | null / mismatch |
| `npx tsc --noEmit -p tsconfig.node.json`, `-p tsconfig.web.json` | 0 | no errors |
| probes over the real dispatcher at both commits | 0 | as above |

## Findings

- **B-1, blocking.** The trim kept an ended record only when it was its request's newest and started within 8 days; at
  `344b09e8` to-operator records were never trimmed. With more than 500 other ended records such a record is dropped,
  the to-operator mark is gone, `emptyRuns` restarts at 0 and the request gets up to two more full-permission runs and
  leaves «На проверке». Probe: a request with a deadline 20 days out, its to-operator record 9 days old, 600 older
  refusals: at `23e1e89c` `{toOperator: false, launches: 1}`, at `344b09e8` `{toOperator: true, launches: 0}`.
  Reachable: an explicit deadline has no upper bound; the dispatcher reads any thread active in the last 7 days; one
  refusing request makes about 143 trimmable records a day.
- **NB-1.** The `WorkflowClosed` check matched `/closed/i`, which a dropped MCP connection («Connection closed») also
  says; it then opened a second workflow.
- **NB-2.** The switch ends a `starting` record at once; if its run did start, a later start uses a new dispatch id and
  the earlier run is not followed. Belongs with ER-5 in CO-409.
- **NB-3.** `noteOf` let a path through after a backtick, `<`, `;`, `|` or `{`.
- **NB-4.** Two comments kept the runner-first order (`App.tsx`, `SessionWindow.test.tsx`).
- **NB-5.** The 24-hour cap can undercount by one per request after a trim.
- **NB-6.** A placeholder line in the ledger's iteration-3 section.

verdict: not ready (B-1)

## What the release session did (commit `822560c5`)

B-1: a request's newest record stays while the request can come back: started in the last 8 days, before its own
deadline (kept on the record as `until`), or read on the board this pass; tests «final candidate, B-1: …» watched
failing on `23e1e89c`'s dispatcher. NB-1: matched by the typed name `WorkflowClosed`; test «final candidate, NB-1: …»
watched failing. NB-3: the five characters added, with cases. NB-4: both comments. NB-2 and NB-5: CO-409. NB-6: the
ledger's paragraph is written in the release commit.
