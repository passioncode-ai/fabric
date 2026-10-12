# Release verification — Fabric 0.3.5, Windows and Linux, agents in your terminal, who works on what: three independent iterations

Run `2026-10-12-release-035-verification`. The operator's rule (2026-10-03, plan row P-02, kept for every release):
before the release, three independent testing iterations across every level of the project, every finding fixed,
and only then the release. This file is the ledger for **Fabric 0.3.5**: everything on `main` since v0.3.4 —
Windows and Linux (CO-238), a coding agent opened in any terminal enrolling into a project through `fabric-mcp`
([ADR-0134](../../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)), claims with
«Who is working» and «Where work is» (REQ-38), the operator's board (COM-06/07), `fabric://` links (SCN-142) and
the bug-fix wave of 2026-10-12 ([handoff](../../handoffs/2026-10-12-release-035-fix-wave.md)). Schema 79 → 84.
The operator decided on 2026-10-12 that this ships as 0.3.5; 0.4.0 stays the agents-first plan
([plan](2026-10-11-release-040-agents-first.md)).

## Protocol

The protocol is 0.3.4's, unchanged ([0.3.4 ledger, Protocol](2026-10-10-release-034-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.5/iteration-N/`.
