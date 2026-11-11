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

Schema 101, no migration. The `## Unreleased` section of [`CHANGELOG.md`](../../../CHANGELOG.md) names every
person-visible change.

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

Candidate `0912b4e2` (the iteration-1 wave plus the first live run on the Mac Studio). Five reviewers, one per level;
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

## Release close

What is owed after the tag, in order; each item is checked off here with its receipt.

1. The CI release run green on every platform, the published release and its notes from `## 0.3.20`.
2. Install 0.3.20 on this Mac, with Switchboard updated to 0.7.56 at the same time (its update restarts Switchboard, so
   no dispatched run may be in flight, or the dispatcher is paused first).
3. Install 0.3.20 on the Mac Studio in each space that runs Fabric.
4. Write `dispatchTargets` (the owners of the operator's repositories to their Studio spaces) once 0.3.20 runs, and watch
   one live run on the Studio end to end: started there, its answer posted in the request's thread, its workflow closed.
5. Read the nightly `platforms` run on the release commit for CO-560 (Windows on ARM) and report it to the coordinator's
   thread.
6. CO-563 on a live `-p` run (CO-564, item 1).
