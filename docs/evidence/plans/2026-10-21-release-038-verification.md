# Release verification: Fabric 0.3.8, the patch of the operator's audit, three independent iterations

Run `r-8db0598178fb`. The operator's rule (2026-10-03, plan row P-02, kept for every release): before the release,
three independent testing iterations across every level of the project, every finding fixed or ruled, and only then
the release. The operator asked on 2026-10-21 to check everything done for 0.3.7, gather the logs, errors, documents
out of step and anything half done or misread, build the fixes, and release. This ledger covers everything on `main`
since v0.3.7: the audit's fixes (CO-361, CO-335) and the renumbering of wave 4 to 0.3.9 (P-20, P-21).

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.8/iteration-N/`.

## The audit that opened this release

The installed 0.3.7's operations log from 00:15 to 01:04 UTC on 2026-10-21: 336 warnings `mcp.notifications/initialized`
(an accepted notification, HTTP 202, read as `unknown`), 148 errors `tool.fabric.session.enroll` with no reason (typed
refusals, CO-335), 5 `com.submit` and 2 `com.list` the same. The machine: OrbStack stopped with «I/O error» three
times on 2026-10-20 with the disk under 1 GB (swap 45 GB, `fseventsd` 9 GB), and the startup failure named only the
missing Docker socket. The release lead's own board session was ended four times by its subagents at the 8-session
cap. A History sentence promised the agents' acts «в 0.3.8», which is now the patch.
