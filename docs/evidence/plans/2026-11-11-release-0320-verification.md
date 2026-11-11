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
