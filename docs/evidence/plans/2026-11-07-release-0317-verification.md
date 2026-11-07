# Fabric 0.3.17 release verification

Release gate ledger for 0.3.17 ([the release runbook](../../launch/release-mac.md#how-a-release-is-made), P-02).
Three iterations, five reviewers each (ux, errors, docs, data, plan), every reviewer a fresh context reading the
candidate read-only; findings are disposed here and in the receipts under
`docs/evidence/reviews/0.3.17/`.

Asked on the project board on 2026-11-07 (request `fe51a4a6`, thread `c7c8ae82`), relaying the operator's words of
that day: release the version with CO-506 (a session's own project answers its requests at once; `fabric_access_*` on
the operator's word) and install it on the operator's Mac. Promised there: 0.3.17 by 2026-11-09.

## Protocol

- Baseline: tag `v0.3.16`. The reviewers read one clean checkout of the candidate, write nothing in it and record HEAD
  and `git status --short | wc -l` before and after.
- The review copies are redacted for publication (ADR-0096): private names replaced, home paths made `/Users/example`.
- A finding is fixed (with its test or check), ruled (with its register id), not a defect (with why), not recoverable,
  or stopped.
- Machine load on 2026-11-07 ran from 55 to 260 on 14 cores; a timing test that fails under that load and passes alone
  is recorded as such, never as a pass, and the hosted CI on the candidate is the tier's verdict.

## What 0.3.17 carries

No schema step: the database stays at schema 100 (the newest migration is `20261030000127`). The `## Unreleased`
section of [`CHANGELOG.md`](../../../CHANGELOG.md) lists the person-visible changes: CO-506, CO-409's dispatcher
(wake on a new request, crash, timed-out, the mandate, following a request out of the read window, settled workflows),
CO-514 and CO-528 (a credential only to a hub this account runs), CO-530 (DEC-0152), CO-508, CO-489, CO-315, CO-378,
CO-503, CO-509 and CO-517. Built but not active: the manager's tool set and its port (CO-522 wave D step 4) and the
schema step's admission and backup (CO-364 step 1).
