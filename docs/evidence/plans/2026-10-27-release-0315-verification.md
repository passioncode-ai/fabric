# Release verification: Fabric 0.3.15, the screens as the operator approved them, three independent iterations

0.3.15 brings the screens shipped in 0.3.14 to the mockup the operator approved on 2026-10-26 (P-30,
[plan, conflict rules and gap maps](../../reports/2026-10-27-mockup-parity/README.md)), agreed as 0.3.15 by the
coordinator (MD-16, fabric-workspace `knowledge/integration.md`), target 2026-10-29. The board dispatcher and load
governor, numbered 0.3.15 until 2026-10-27, is now the release of 2026-11-05 (P-29), numbered at its tag.

**No schema step.** The local database stays at schema 98, as in 0.3.14: upgrading is the new bundle alone, and going
back is the 0.3.14 bundle alone ([CHANGELOG](../../../CHANGELOG.md), «Upgrading»).

## Protocol

The protocol is 0.3.14's ([0.3.14 ledger, Protocol](2026-10-26-release-0314-verification.md#protocol)), unchanged:
fresh reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the candidate;
their reports are committed under `docs/evidence/reviews/0.3.15/iteration-N/` as written, with one
`fabric-release-reviews/1` receipt per level. A reviewed candidate is never rebased.

## Rollout on the operator's Mac

0.3.15 is the bundle alone (schema 98 unchanged). The Mac runs Fabric 0.3.14 on Colima, under the broker target
`fabric.desktop`. The rollout holds the broker target first (`lifecycle.py hold --target-id fabric.desktop`, released
after the swap), as [the runbook](../../launch/release-mac.md) says. The quit is the person's.
