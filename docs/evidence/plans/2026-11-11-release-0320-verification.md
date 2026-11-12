# Fabric 0.3.20 release verification

Release gate ledger for 0.3.20 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.20/`.

0.3.20 carries what the live board runs of 2026-11-11 found after 0.3.19 was installed: CO-563 (a dispatched session
had only `fabric_whoami`), `PacketFrozen` on a later run, `--reason inbox`, three runs on a machine, the project asked
by Fabric's id first, CO-560 (Windows owner read without PowerShell), `dispatchTargets` (a run on the machine of its
repository's owner) and, from the first live run on the Mac Studio, a run on another machine carrying the request
and its thread in its packet.

## Protocol

- Baseline: `3533e16b`, 0.3.19's release commit (tag `v0.3.19`). The reviewers read the candidate's checkout without
  writing in it and record HEAD and `git status --short | wc -l` before and after.
- Tests are run by file under `nice -n 10`, one run at a time.
- The review copies are redacted for publication (ADR-0096): home paths are `/Users/example`.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.

## What 0.3.20 carries

Schema 102: one migration past 0.3.19, `20261112000129_responder_replace_no_transfer.sql` (migration 129, landed
after iteration 2; until then this line said «Schema 101, no migration», which iteration 3 found false: PL-20, DO-30,
UX-31). The upgrade from 0.3.19 is [the runbook's 0.3.20 paragraph](../../launch/release-mac.md#upgrading-an-existing-database).
The `## Unreleased` section of [`CHANGELOG.md`](../../../CHANGELOG.md) names every person-visible change. The screen
work of 2026-11-12 (the simple screens' waves 1 to 4, the Board's decision card, board runs shown as at work) landed
after iteration 2, so iteration 3 is the only release review that reads it (PL-21).

## Iteration 1

Candidate `1fa2d1d912d08a20aec0f447b94cb2e999603dd1`. Five reviewers, one per level; their reports and receipts are in
`docs/evidence/reviews/0.3.20/iteration-1/`. 45 findings, 9 blocking (UX-1, UX-2, ER-1, ER-2, DO-1, DA-1, DA-2, PL-1,
PL-2), five distinct defects. Two more came from the first live run on the Mac Studio the same hour and are in the
same wave: the run had only the request's id (its packet now carries the request and its thread) and its workflow's
close was refused for status `failed` (now `blocked`). Every new test was watched failing on the old code or its
fixture encodes the refused value. Non-blocking findings not fixed are in CO-564.

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V1-1 | UX-1 | blocking | spec and map said Observatory keeps board-message: | fixed in the iteration-1 wave (candidate 2): spec §3.8 says board-message: is still redacted until Observatory takes it |
| V1-2 | UX-2 | blocking | git origin read documented as 5 s, ran under 60 s | fixed in the iteration-1 wave (candidate 2): remoteTargetFor reads through agentSyncLeases.ts#originOf, 3 s |
| V1-3 | UX-3 | non-blocking | CHANGELOG called dispatchTargets a Setting | fixed in the iteration-1 wave (candidate 2): CHANGELOG and spec say the settings.json key, no Settings row |
| V1-4 | UX-4 | non-blocking | CHANGELOG lines read as internal notes | fixed in the iteration-1 wave (candidate 2): CHANGELOG rewritten for readers |
| V1-5 | UX-5 | non-blocking | "well under a second" unmeasured | fixed in the iteration-1 wave (candidate 2): claim removed |
| V1-6 | UX-6 | non-blocking | localized N/A read as another account | fixed in the iteration-1 wave (candidate 2): an account without a backslash is unread |
| V1-7 | UX-7 | non-blocking | CO-563 not verified live | ruled: CO-564, item 1 |
| V1-8 | UX-8 | non-blocking | misplaced doc comments, map typo | fixed in the iteration-1 wave (candidate 2): comments moved, typo fixed; the range wording in a dated map entry kept |
| V1-9 | UX-9 | non-blocking | em dashes in fabric-mcp agent answers predate this release | ruled: CO-564, item 2 |
| V1-10 | ER-1 | blocking | board-message: claimed kept | fixed in the iteration-1 wave (candidate 2): as UX-1 |
| V1-11 | ER-2 | blocking | 60 s git read in the pass | fixed in the iteration-1 wave (candidate 2): as UX-2 |
| V1-12 | ER-3 | non-blocking | repos read failure skipped dispatchTarget | fixed in the iteration-1 wave (candidate 2): index.ts falls back to dispatchTarget |
| V1-13 | ER-4 | non-blocking | localized N/A, hub.ts comment says SID | fixed in the iteration-1 wave (candidate 2): as UX-6; hub comment carried |
| V1-14 | ER-5 | non-blocking | 10 s wait through a server cooldown | ruled: CO-564, item 3 |
| V1-15 | ER-6 | non-blocking | owner parsing of GitLab subgroups and local paths | ruled: CO-564, item 4 |
| V1-16 | ER-7 | non-blocking | alias answer not checked to be a project | fixed in the iteration-1 wave (candidate 2): only a project: canonical is kept |
| V1-17 | ER-8 | non-blocking | three Windows commands at 30 s each | fixed in the iteration-1 wave (candidate 2): WIN_COMMAND_MS 10 s each |
| V1-18 | DO-1 | blocking | 5 s claim | fixed in the iteration-1 wave (candidate 2): as UX-2 |
| V1-19 | DO-2 | non-blocking | dispatchTargets called a Setting | fixed in the iteration-1 wave (candidate 2): as UX-3 |
| V1-20 | DO-3 | non-blocking | CO-560 counted resolved before the nightly; evidence names | fixed in the iteration-1 wave (candidate 2): row names winOwner and readListenerOwner; the nightly result is a release close item |
| V1-21 | DO-4 | non-blocking | AGENTS row missing the new child processes | fixed in the iteration-1 wave (candidate 2): git config and switchboard --version named |
| V1-22 | DO-5 | non-blocking | "the release after 0.3.19" stays | fixed in the iteration-1 wave (candidate 2): AGENTS.md, CO-560 and CO-563 say 0.3.20 |
| V1-23 | DO-6 | non-blocking | stale wording in notes | fixed in the iteration-1 wave (candidate 2): as UX-4 |
| V1-24 | DO-7 | non-blocking | comments on the wrong declarations | fixed in the iteration-1 wave (candidate 2): as UX-8 |
| V1-25 | DO-8 | non-blocking | map typo | fixed in the iteration-1 wave (candidate 2): as UX-8 |
| V1-26 | DO-9 | non-blocking | CO-560 row says unknown, code only exact N/A | fixed in the iteration-1 wave (candidate 2): as UX-6 |
| V1-27 | DA-1 | blocking | 60 s git read | fixed in the iteration-1 wave (candidate 2): as UX-2 |
| V1-28 | DA-2 | blocking | board-message: claim | fixed in the iteration-1 wave (candidate 2): as UX-1 |
| V1-29 | DA-3 | non-blocking | inherited GIT_DIR reads another origin | fixed in the iteration-1 wave (candidate 2): originOf ignores it |
| V1-30 | DA-4 | non-blocking | repos read failure skips dispatchTarget | fixed in the iteration-1 wave (candidate 2): as ER-3 |
| V1-31 | DA-5 | non-blocking | invalid dispatchTargets entries dropped without a log line | ruled: CO-564, item 5 |
| V1-32 | DA-6 | non-blocking | owner parsing | ruled: CO-564, item 4 |
| V1-33 | DA-7 | non-blocking | later inbox run keeps the first frozen thread | ruled: CO-564, item 6 |
| V1-34 | DA-8 | non-blocking | Settings wording | fixed in the iteration-1 wave (candidate 2): as UX-3 |
| V1-35 | DA-9 | non-blocking | real names in a test fixture | fixed in the iteration-1 wave (candidate 2): owner-a and node-a |
| V1-36 | PL-1 | blocking | fabric:<id> resolution claimed to work, Observatory holds no aliases | fixed in the iteration-1 wave (candidate 2): CHANGELOG says it helps once Observatory records the ids |
| V1-37 | PL-2 | blocking | 5 s claim | fixed in the iteration-1 wave (candidate 2): as UX-2 |
| V1-38 | PL-3 | non-blocking | repos read failure | fixed in the iteration-1 wave (candidate 2): as ER-3 |
| V1-39 | PL-4 | non-blocking | dispatchTargets not patchable, older Fabric drops it | fixed in the iteration-1 wave (candidate 2): documented in CHANGELOG and spec; a Settings row ruled: CO-564, item 7 |
| V1-40 | PL-5 | non-blocking | launch records read thread and project from the latest checkpoint | ruled: CO-564, item 6 |
| V1-41 | PL-6 | non-blocking | Studio runs take this Mac's slots, inbox runs never go there | ruled: CO-564, item 8 |
| V1-42 | PL-7 | non-blocking | tasklist N/A is unknown, PowerShell not asked | fixed in the iteration-1 wave (candidate 2): unread now covers any placeholder; PowerShell stays the fallback when the commands cannot run |
| V1-43 | PL-8 | non-blocking | release close items owed | fixed in the iteration-1 wave (candidate 2): listed in the ledger's release close |
| V1-44 | PL-9 | non-blocking | apt still needed for PostgreSQL and Linux release steps | ruled: CO-564, item 9 |
| V1-45 | PL-10 | non-blocking | text nits | fixed in the iteration-1 wave (candidate 2): as UX-8 and UX-3 |

Exit for iteration 1: every finding disposed above. Blocking findings open: none.

## Iteration 2

Candidate `0912b4e2797fb4ba54ad8e72465e2cb079709ac6` (the iteration-1 wave plus the first live run on the Mac Studio). Five reviewers, one per level;
their reports and receipts are in `docs/evidence/reviews/0.3.20/iteration-2/`. 42 findings, 13 blocking (UX-10, UX-11,
ER-9, DO-10 to DO-13, DA-10, PL-11 to PL-13), four distinct defects: a remote run's `notes` over Observatory's 4000,
the CHANGELOG header the wave cut, the spec's `status: failed`, and two claims the wave left false (`board-message:`
kept, «each given 10 seconds»). Every new test was watched failing on the old code.

Two more came from the live board in the same hour and are in the same wave. A run of `fabric-agents-database` (launch
`26586b8b`) did its work and posted its answer, but its attempt lapsed after `com.accept` and the request stayed
`accepted`: the packet now names the way back (`com.responder_replace` with a transfer), and the project was told on
the board (thread `9f829c89`). Writing that line also showed the remote run's first constraint at 511 characters when
the thread could not be read, past Observatory's 500 for a constraint: it is now 440 at most, and a test holds every
constraint of both packets to 500. And at 16:45 a PM agent's session saw the board as unavailable: one admitted folder deleted from disk failed every
new enrollment from 16:30 (CO-566, resolved in this wave, worked around live at 16:46).

| Row | Finding | Severity | Defect | Disposition |
|---|---|---|---|---|
| V2-1 | UX-10 | blocking | the fix wave cut CHANGELOG's header and its `## Unreleased` heading | fixed in the iteration-2 wave (candidate 3): header restored from `1fa2d1d9`, heading back |
| V2-2 | UX-11 | blocking | spec §3.7 said a remote-ended workflow closes `failed` | fixed in the iteration-2 wave (candidate 3): §3.7 and §3.4 say `blocked`, which Observatory takes |
| V2-3 | UX-12 | non-blocking | map, test comment and CHANGELOG still read as if Observatory keeps `board-message:` | fixed in the iteration-2 wave (candidate 3): map lane, test comment and CHANGELOG corrected |
| V2-4 | UX-13 | non-blocking | thread text from the oldest 100 messages | fixed in the iteration-2 wave (candidate 3): up to ten pages read, newest first |
| V2-5 | UX-14 | non-blocking | a run here without `com.*` tools would write its answer to an unread result file | ruled: CO-564, item 12 (a run here has `fabric-mcp`, CO-563) |
| V2-6 | UX-15 | non-blocking | bare UUIDs redacted, double space, order unstated | fixed in the iteration-2 wave (candidate 3): `fabric-project:<uuid>`, one space, the order said in the text's first line |
| V2-7 | UX-16 | non-blocking | stale comments at `WIN_COMMAND_MS` and in `types.ts` | fixed in the iteration-2 wave (candidate 3): both rewritten |
| V2-8 | UX-17 | non-blocking | §3.4 contradicted §3.7 and §3.8 on kept references and `failed` | fixed in the iteration-2 wave (candidate 3): §3.4 says what Observatory 0.35.14 keeps and `blocked` |
| V2-9 | UX-18 | non-blocking | map links to §3.7 and §3.8 opened the top of the spec | fixed in the iteration-2 wave (candidate 3): the links carry the section anchors |
| V2-10 | ER-9 | blocking | notes past Observatory's 4000 never open | fixed in the iteration-2 wave (candidate 3): `THREAD_TEXT_MAX` 3900, request cut at `REQUEST_TEXT_MAX` 3000; test asserts the bound |
| V2-11 | ER-10 | non-blocking | a retried open re-read the target and thread | fixed in the iteration-2 wave (candidate 3): `retryOpen` keeps the machine and text; test `ER-10, DA-11` |
| V2-12 | ER-11 | non-blocking | `readConnectionOwner` gave Windows commands 30 s | fixed in the iteration-2 wave (candidate 3): `WIN_COMMAND_MS` there too, PowerShell keeps 30 s |
| V2-13 | ER-12 | non-blocking | Windows account names decoded as UTF-8, not the console code page | ruled: CO-564, item 10 |
| V2-14 | ER-13 | non-blocking | oldest 100 messages called the newest | fixed in the iteration-2 wave (candidate 3): as UX-13 |
| V2-15 | ER-14 | non-blocking | `winOwner`'s comment above `WIN_COMMAND_MS` | fixed in the iteration-2 wave (candidate 3): as UX-16 |
| V2-16 | DO-10 | blocking | CHANGELOG preamble cut | fixed in the iteration-2 wave (candidate 3): as UX-10 |
| V2-17 | DO-11 | blocking | §3.7 `status: failed` | fixed in the iteration-2 wave (candidate 3): as UX-11 |
| V2-18 | DO-12 | blocking | map lane and test comment keep the `board-message:` claim | fixed in the iteration-2 wave (candidate 3): as UX-12 |
| V2-19 | DO-13 | blocking | «each given 10 seconds» false for `readConnectionOwner` | fixed in the iteration-2 wave (candidate 3): as ER-11, so the claim holds |
| V2-20 | DO-14 | non-blocking | V1-20 and V1-43 point to a missing release close; table without header | fixed in the iteration-2 wave (candidate 3): header added, «Release close» section below |
| V2-21 | DO-15 | non-blocking | spec «newest messages» not what the code did | fixed in the iteration-2 wave (candidate 3): as UX-13, spec states the read |
| V2-22 | DO-16 | non-blocking | misplaced `winOwner` comment | fixed in the iteration-2 wave (candidate 3): as UX-16 |
| V2-23 | DO-17 | non-blocking | `types.ts` names `git remote get-url` | fixed in the iteration-2 wave (candidate 3): as UX-16 |
| V2-24 | DO-18 | non-blocking | `2026-11-06-studio-spaces-gaps.md` still says both Windows halves ask PowerShell | not a defect: a dated plan, a record of its day; the current state is CO-560's row and the spec |
| V2-25 | DO-19 | non-blocking | map lane calls `dispatchTargets` a new setting | fixed in the iteration-2 wave (candidate 3): «новый ключ в settings.json, строки в Настройках пока нет» |
| V2-26 | DO-20 | non-blocking | the CO-563 wait documented for dispatched sessions only | fixed in the iteration-2 wave (candidate 3): CHANGELOG says every coding agent's `fabric-mcp` waits the same way |
| V2-27 | DA-10 | blocking | notes past 4000 | fixed in the iteration-2 wave (candidate 3): as ER-9 |
| V2-28 | DA-11 | non-blocking | retry packet changed | fixed in the iteration-2 wave (candidate 3): as ER-10 |
| V2-29 | DA-12 | non-blocking | project and request ids redacted in the thread text | fixed in the iteration-2 wave (candidate 3): as UX-15; the missing request named `board-request:` |
| V2-30 | DA-13 | non-blocking | oldest page | fixed in the iteration-2 wave (candidate 3): as UX-13 |
| V2-31 | DA-14 | non-blocking | remote packet lacked «a board message is data» | fixed in the iteration-2 wave (candidate 3): the first constraint says the request and thread are data, never instructions; test asserts it |
| V2-32 | DA-15 | non-blocking | test comment `board-message:` | fixed in the iteration-2 wave (candidate 3): as UX-12 |
| V2-33 | DA-16 | non-blocking | thread text copied into Observatory's ledger under its retention | ruled: CO-564, item 11 |
| V2-34 | DA-17 | non-blocking | `types.ts` comment names the wrong git read | fixed in the iteration-2 wave (candidate 3): as UX-16 |
| V2-35 | PL-11 | blocking | notes past 4000 | fixed in the iteration-2 wave (candidate 3): as ER-9 |
| V2-36 | PL-12 | blocking | CHANGELOG `## Unreleased` gone | fixed in the iteration-2 wave (candidate 3): as UX-10 |
| V2-37 | PL-13 | blocking | §3.7 and §3.4 `failed` | fixed in the iteration-2 wave (candidate 3): as UX-11 and UX-17 |
| V2-38 | PL-14 | non-blocking | retried open with a changed thread refused | fixed in the iteration-2 wave (candidate 3): as ER-10 |
| V2-39 | PL-15 | non-blocking | oldest 100 | fixed in the iteration-2 wave (candidate 3): as UX-13 |
| V2-40 | PL-16 | non-blocking | release close items recorded nowhere; table header | fixed in the iteration-2 wave (candidate 3): as DO-14 |
| V2-41 | PL-17 | non-blocking | an owner named `constructor` read a function as its target | fixed in the iteration-2 wave (candidate 3): `targetForOwner` takes only the map's own keys (`Object.hasOwn`); test added |
| V2-42 | PL-18 | non-blocking | text nits | fixed in the iteration-2 wave (candidate 3): as UX-16 |

Exit for iteration 2: every finding disposed above. Blocking findings open: none.

## Before iteration 3: the dispatcher audit (2026-11-12)

The operator, 2026-11-12, on the board dispatcher: «чтобы работал корректно и на макбуке и на студии и повторы и
обработка ошибок и менеджмент памяти». A read-only audit of `boardDispatchRun.ts`, `boardDispatchWiring.ts` and
`shared/boardDispatch.ts` found four critical, five high and several medium defects; what this wave fixes is
[§3.9 of the on-demand spec](../specs/2026-11-04-on-demand-sessions.md#39-two-machines-sleep-retries-and-memory-2026-11-12),
and what it leaves is CO-567. Each fix has a test watched failing on `1a07dabe` (eight in `board-dispatch-run.test.mjs`,
one process-group test checked against the old `execFile`, three in `boardDispatch.test.ts`). Iteration 3 reads the
candidate that carries it.

| Audit | Severity | Fix |
|---|---|---|
| C1 two dispatchers on one board | critical | guard: on a board Fabric does not own, only `dispatchOnSharedBoard: true` dispatches; the board-side lease is CO-567 |
| C2 mass restarts after sleep | critical | liveness and run ends judged on time awake (`suspendedSince`) |
| C3 a timed-out start elsewhere also started here | critical | `remoteUnanswered`: no fallback here after an unanswered start there |
| C4 two answers; a Studio board's com.* tools | critical | settled read before posting; the packet names the project `fabric_whoami` must show |
| H1 one throw aborts the pass | high | per-request and per-start isolation with its own back-off |
| H2 an unread board stops all watching | high | runs in flight watched, none judged dead, nothing started |
| H3 long serial passes | high | the agent once a pass, the version once an hour; parallel watches are CO-567 |
| H4 an ssh child outlives a timeout | high | process group ended whole; output bounded |
| H5 a hung Studio never falls back | high | CO-567 (needs Switchboard to say nothing started there) |
| maps, records, Observatory child | medium | pruned after every pass; `until` at most 30 days; trimmed with the switch off; a failed handshake's child closed |
| self-target | medium | a target that is this machine runs here |

## Before iteration 3: a responder takeover without a transfer (2026-11-12)

The hyperframes project reported on the board (thread `e43efbf6`) that `com.responder_replace` answered
`invalid_arguments` «The board could not take a value in these arguments». The board service maps every SQLSTATE of
class 22 to that text (`apps/desktop/src/main/boardService.ts`, the refusal mapping). `board_responder_replace` walked
the transferred requests with `foreach … in array (select array_agg(…))`: with no `transfer` the aggregate is NULL and
PL/pgSQL refuses FOREACH over NULL with 22004. Since 0.3.6 (migration 104) every takeover without a transfer failed; the
responders suite replaced only with one. Migration 129 (schema 102) is migration 124's function with that loop reading
an empty array. The new test in `project-board-responders-db.test.mjs` failed with «FOREACH expression must not be
null» on the old chain and passes on the new one (24 of 24); the operator and core board suites pass (13, 33).
Iteration 3 reads the candidate that carries it.

## Iteration 3

### Run one, 9420da79 (superseded)

Candidate `9420da796407b0d7ec0ff480da134cf426169309` (iteration 2's wave, the dispatcher audit, migration 129, the
questions rule and the screen work of 2026-11-12). Five reviewers, one per level; their reports and receipts are in
`docs/evidence/reviews/0.3.20/iteration-3-9420da79/` (kept as the record; not this iteration's receipts). 45 findings, 11 blocking (UX-20, UX-21, UX-22, ER-20, ER-21, ER-22, DO-30, DO-31, DA-20, PL-20, PL-21), seven
distinct defects: the schema step documented nowhere, the screen changes missing from the notes, two task-page lines
(a claim's time left, the brief's author) and three dispatcher paths (a request run twice across records, an answer
lost to a board outage, non-Latin output split at chunk edges). DA-21, a trim that could drop a request given to the
operator, worked at `0912b4e2`, so it is fixed in this wave too. Every new test was watched failing on the old code.
The docs reviewer numbered from DO-20, which iteration 2 used; its ids are DO-30 to DO-37 here. The wave also carries
one fix from the live board the same morning: a `services/` descriptor whose `installedBy` is DEC-0061's object was
refused by the registry, so a PM agent could not ask for `board.respond` (`agentRegistry.ts#installedByOk`, test in
`agent-registry.test.mjs`, watched failing).

| V | Finding | Severity | What | Disposition |
|---|---|---|---|---|
| V3-1 | UX-20 | blocking | `## Unreleased` names none of the screen changes | fixed in the iteration-3 wave: the CHANGELOG names the task page, one title per screen, Главная, the Board's words and board runs at work |
| V3-2 | UX-21 | blocking | a live claim says «ещё 0 с» | fixed in the iteration-3 wave: `until()` counts to the expiry; `TaskPage.test.tsx` holds the time left, watched failing |
| V3-3 | UX-22 | blocking | «Написал: person:operator» | fixed in the iteration-3 wave: any `person:<id>` reads «вы»; two tests, the first watched failing |
| V3-4 | UX-23 | non-blocking | folds still show machine ids | ruled: CO-569 |
| V3-5 | UX-24 | non-blocking | «Почему просят» over the policy's own reason | ruled: CO-569 |
| V3-6 | UX-25 | non-blocking | a refused act worded three ways | ruled: CO-569 |
| V3-7 | UX-26 | non-blocking | a run's state said twice | ruled: CO-569 |
| V3-8 | UX-27 | non-blocking | the Plan's title after a level change | ruled: CO-569 |
| V3-9 | UX-28 | non-blocking | two titles on Граф and Облик | ruled: CO-569 |
| V3-10 | UX-29 | non-blocking | Settings' dispatch switch reads on while a shared board keeps it off | ruled: CO-569 |
| V3-11 | UX-30 | non-blocking | `screens.md` keeps the removed Fabric strip | ruled: CO-569 |
| V3-12 | UX-31 | non-blocking | «Schema 101, no migration» | fixed in the iteration-3 wave: as PL-20 |
| V3-13 | UX-32 | non-blocking | the notes box announced as «Добавить» | ruled: CO-569 |
| V3-14 | ER-20 | blocking | a request can run twice across records | fixed in the iteration-3 wave: an unanswered start there belongs to the request and a later record carries it; test «ER-20», watched failing |
| V3-15 | ER-21 | blocking | a remote answer lost during a board outage | fixed in the iteration-3 wave: no relay attempt while the board is unread; test «ER-21», watched failing |
| V3-16 | ER-22 | blocking | non-Latin output corrupted at chunk edges | fixed in the iteration-3 wave: stdout and stderr decoded as one UTF-8 stream; test «ER-22», watched failing |
| V3-17 | ER-23 | non-blocking | runs judged on stale states during an outage | ruled: CO-569 |
| V3-18 | ER-24 | non-blocking | one failed responders read backs every request off | ruled: CO-569 |
| V3-19 | ER-25 | non-blocking | output kept after the bound trips | fixed in the iteration-3 wave: as ER-22, nothing is kept past `OUT_MAX` |
| V3-20 | ER-26 | non-blocking | a remote `failed-to-start` leaves its workflow open | ruled: CO-569 |
| V3-21 | ER-27 | non-blocking | two catches without an ops line | ruled: CO-569 |
| V3-22 | ER-28 | non-blocking | back-offs forgotten when a request drops out of one read | ruled: CO-569 |
| V3-23 | ER-29 | non-blocking | on Windows the deadline ends Switchboard only | ruled: CO-569; the CHANGELOG and §3.9 now say so |
| V3-24 | ER-30 | non-blocking | a 0.3.19 record keeps an unclamped `until` | ruled: CO-569 |
| V3-25 | ER-31 | non-blocking | the shared-board guard is silent | ruled: CO-569 |
| V3-26 | DO-30 | blocking | the schema step documented nowhere | fixed in the iteration-3 wave: as PL-20 |
| V3-27 | DO-31 | blocking | the release notes miss the screen changes | fixed in the iteration-3 wave: as UX-20 |
| V3-28 | DO-32 | non-blocking | «since migration 107» is 104 | fixed in the iteration-3 wave: CHANGELOG, this ledger and the map say 0.3.6 (migration 104); the migration file is fixed by its ledger hash |
| V3-29 | DO-33 | non-blocking | AGENTS.md dispatcher row misses three facts | fixed in the iteration-3 wave: the row names `UNTIL_MAX_MS`, the hourly version read and `ssh -G` |
| V3-30 | DO-34 | non-blocking | «ends every process» holds on macOS and Linux only | fixed in the iteration-3 wave: the CHANGELOG and §3.9 say so |
| V3-31 | DO-35 | non-blocking | «Next free ID» stale; CO-567 reservation unrecorded | fixed in the iteration-3 wave: `CO-570`, CO-567 and CO-569 recorded |
| V3-32 | DO-36 | non-blocking | the plan counts 34 task page tests | fixed in the iteration-3 wave: 37 |
| V3-33 | DO-37 | non-blocking | «the address `ssh -G` resolves» | fixed in the iteration-3 wave: the `hostname` `ssh -G` prints, no DNS lookup |
| V3-34 | DA-20 | blocking | the schema step not documented | fixed in the iteration-3 wave: as PL-20 |
| V3-35 | DA-21 | non-blocking | a trim drops a request given to the operator | fixed in the iteration-3 wave: kept until a read shows it gone; test «DA-21», watched failing |
| V3-36 | DA-22 | non-blocking | migration 129's header understates the dropped dead line | ruled: CO-569; the file is fixed by its ledger hash |
| V3-37 | DA-23 | non-blocking | going back to 0.3.19 drops two 0.3.20 settings | fixed in the iteration-3 wave: the CHANGELOG says so |
| V3-38 | PL-20 | blocking | the schema step missing from the release plan | fixed in the iteration-3 wave: «What 0.3.20 carries», the runbook's 0.3.20 paragraph, the CHANGELOG's upgrade note and close items 2 and 3 |
| V3-39 | PL-21 | blocking | the declared scope false | fixed in the iteration-3 wave: as UX-20, and «What 0.3.20 carries» says iteration 3 alone reads the screen work |
| V3-40 | PL-22 | non-blocking | iteration 2 without a full candidate and an exit line | fixed in the iteration-3 wave: both added |
| V3-41 | PL-23 | non-blocking | simple-screens leftovers without a register row | ruled: CO-569 |
| V3-42 | PL-24 | non-blocking | §3.10 leftovers only on the board | ruled: CO-569 |
| V3-43 | PL-25 | non-blocking | the questions route does not reach a run without the board; G19 cited as built | fixed in the iteration-3 wave: §3.10 and the CHANGELOG say both |
| V3-44 | PL-26 | non-blocking | three checks missing from the close | fixed in the iteration-3 wave: items 3, 7 and 8 |
| V3-45 | PL-27 | non-blocking | text nits | fixed in the iteration-3 wave: `INBOX_GOAL`'s comment back above it; the indentation is each list's own, not a defect |

The fix wave is the next candidate: run two reads it with five fresh reviewers.

## Release close

What is owed after the tag, in order; each item is checked off here with its receipt.

1. The CI release run green on every platform, the published release and its notes from `## 0.3.20`.
2. Install 0.3.20 on this Mac, with Switchboard updated to 0.7.56 at the same time (its update restarts Switchboard, so
   no dispatched run may be in flight, or the dispatcher is paused first). The database moves from schema 101 to 102:
   take the backup and follow [the runbook](../../launch/release-mac.md#upgrading-an-existing-database), `FROM` 101, one
   migration, before Fabric is opened again (PL-20).
3. Install 0.3.20 on the Mac Studio in each space that runs Fabric, with the same backup and upgrade, and read that
   space's Switchboard version (0.7.56 or later for `--reason inbox` and `dispatch status`; PL-26).
4. Write `dispatchTargets` (the owners of the operator's repositories to their Studio spaces) once 0.3.20 runs, and watch
   one live run on the Studio end to end: started there, its answer posted in the request's thread, its workflow closed.
5. Read the nightly `platforms` run on the release commit for CO-560 (Windows on ARM) and report it to the coordinator's
   thread.
6. CO-563 on a live `-p` run (CO-564, item 1).
7. Migration 129 on the installed board: one `com.responder_replace` without a transfer answers a slot at its generation,
   and the hyperframes thread `e43efbf6` is told (PL-26).
8. One dispatched run that asks a question: its `people.ask` request reaches the PM agent's project (or the operator
   through `fabric_question_ask`), and the answer in its thread starts its next run (§3.10; PL-26).
