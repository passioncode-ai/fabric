# Fabric 0.3.19 release verification

Release gate ledger for 0.3.19 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under `docs/evidence/reviews/0.3.19/`.

0.3.19 carries CO-559 (every addressee on the board woken and watched, [the on-demand spec
§3.8](../specs/2026-11-04-on-demand-sessions.md#38-every-addressee-woken-and-watched-co-559)), CO-561, CO-556, CO-551
stage A, the scenario walk of 2026-11-11, and 0.3.18, which was not published on its own (the decision is in
[the 0.3.18 handoff](../../handoffs/2026-11-09-release-0318.md#decisions)).

## Protocol

- Baseline: `bbc90b7ae4bccd65e9b8a8d8e95cb9582a14f359`, 0.3.18's release commit, never tagged. The reviewers read one
  clean detached checkout of the candidate, write nothing in it and record HEAD and `git status --short | wc -l`
  before and after.
- Tests are run by file on the twin worktree at the same commit, under `nice -n 10`, one run at a time.
- The review copies are redacted for publication (ADR-0096): home paths are `/Users/example`.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- Machine load on 2026-11-11 ran from 90 to 140 on 14 cores and the disk filled once (ENOSPC, cleared by pruning tool
  caches and a merged worktree); a timing test that fails under that load and passes alone is recorded as such.

## What 0.3.19 carries

Schema 100 to 101: one migration, `supabase/migrations/20261111000128_board_inbox_operator.sql`. The `## 0.3.19`
section of [`CHANGELOG.md`](../../../CHANGELOG.md) names every person-visible change since 0.3.17, 0.3.18's included.

## Iteration 1

Candidate `3138e829902836d54f1a796b590fa4f04e94c869`.

_In progress._

## Iteration 2

Candidate `d08877d6d243f4ded4524d2e4a263e8573b570d0`.

_In progress._

## Iteration 3

_Not started._

## Release close

Executable in this order, each act with its actor; a failure stops the close and takes a fix through a new candidate.

1. Hosted `ci` on the final candidate: its push run and a full run green (actor: this session, `gh run`).
2. The release commit on `main`: `apps/desktop/package.json` 0.3.19, the `## 0.3.19` section finalized,
   `docs/launch/release-gate.json` naming this ledger, the final candidate and the fifteen receipts.
3. `v0.3.19-rc.1` on the release commit: `release.yml` builds macOS, Windows and Linux; every job green.
4. The board database suite (`apps/desktop/test/run-project-board-operator-db.mjs`) and the upgrade rehearsal from
   schema 100 on a disposable cluster, their receipts here (iteration 1, DA-1).
5. The rc installed on this Mac: a database backup; «Служба доски» off and Quit (0.3.18's switch-off ends Fabric at
   once in launchd's own copy, so live terminals are closed first); the rc installed; the migration up to schema 101;
   the first start read back (schema 101, `hub.json`, the board).
6. 0.3.18's open checks on the rc: the Settings line «Служба доски» and the legacy login item; N6 (d) with a live
   terminal session opened from Fabric's window; `chat-activation-native`; the Docker-stopped start (it stops every
   container, so with the operator present); the Windows nightly failures of `platforms.yml` ruled or fixed (CO-560).
7. The lifecycle broker's `fabric.desktop` policy restored to revision 29's `always_on` (held off at revision 30 since
   0.3.18's close).
8. The board dispatcher: the backlog of unread board messages triaged (announcements and messages that need nothing
   marked read through the operator's door), then the switch on, then one live request run and one live inbox run
   watched end to end (accepted, read marks, workflow closed, `finished`), then the first hour of `board.dispatch.*`
   lines and Switchboard's usage read (iteration 1, PL-1 and PL-6).
9. `v0.3.19` on the same commit, published; this Mac updated to the published build.
10. The Mac Studio: 0.3.19 installed for both accounts with studio-agent; Switchboard's version read; the dispatcher
    switch decided explicitly there (`dispatchTarget` stays unset on both machines).
11. The workspace published and pinned; the knowledge base rows; the site's download links checked.
12. Board replies on threads `90b6921f` and `f408566b`; CO-562 and CO-560 are the next release's.
