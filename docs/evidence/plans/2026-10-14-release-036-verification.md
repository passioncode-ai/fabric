# Release verification — Fabric 0.3.6, the operator home, the project's way, settings as a screen: three independent iterations

Run `2026-10-14-release-036-verification` (`r-44ae60a75316`). The operator's rule (2026-10-03, plan row P-02, kept for
every release): before the release, three independent testing iterations across every level of the project, every
finding fixed, and only then the release. The operator asked on 2026-10-14, after Fabric would not open on their Mac,
for the fix and a new version, then for the whole run to be closed in one iteration with two or three checking rounds —
these three iterations are those rounds. This file is the ledger for **Fabric 0.3.6**: everything on `main` since
v0.3.5 — the operator home and project page in plain words (SCN-158, SCN-159), settings as a screen with the agents on
this computer (SCN-160), the stack-start retry (CO-294), comms wave 4 reads, the CO-282 harness waves behind their
flag, load-tolerant tests. The onboarding plan that held the 0.3.6 number moves to 0.3.7
([its note](2026-10-13-onboarding-036/README.md)).

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.6/iteration-N/`.

## Iteration 1

In progress — five fresh reviewers, 2026-10-14, against `034108c5` (`034108c5cf0f4019fa35f5be0ec46776dfdd3ed5`,
`main` after the stack-start retry), read-only in a detached checkout.

## Iteration 2

_Not started._

## Iteration 3

_Not started._
