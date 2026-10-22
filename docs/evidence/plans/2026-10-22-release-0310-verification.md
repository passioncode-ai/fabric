# Release verification: Fabric 0.3.10, the scroll patch, three independent iterations

The operator, 2026-10-22: «главный экран не скроллится … просмотреть вообще весь UI, какие есть еще нюансы, все
исправить», then «дальше до конца». Since 0.3.7 no page of Fabric could be scrolled. 0.3.10 is that patch (P-23):
everything on `main` since v0.3.9, which is the scroll fix (PR #36), CO-381's resolution with the corrected 0.3.9 notes
(PR #37), and the renumbering of the simple plan's wave 4 to 0.3.11 (P-20). Schema 95, unchanged.

## Protocol

The protocol is 0.3.5's, unchanged ([0.3.5 ledger, Protocol](2026-10-12-release-035-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.10/iteration-N/`.
