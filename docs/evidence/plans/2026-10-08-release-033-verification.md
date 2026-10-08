# Release verification — Fabric 0.3.3, the onboarding release: three independent iterations

Run `2026-10-08-release-033-verification`. The operator's rule (2026-10-03, plan row P-02, kept for every release):
before the DMG and the release, three independent testing iterations across every level of the project, every
finding fixed, and only then the release. This file is the ledger for **Fabric 0.3.3** — plan row
[P-14](../backlog.md#general-development-plan): the onboarding into PassionCode.ai as four actions
([brief](2026-10-08-onboarding-four-actions.md), operator decisions D1–D4 of 2026-10-08) plus what landed on `main`
after 0.3.2 — the launch screens drawn from the prototype and in Russian, the scan's repository summary, the
"Set up this project with the agent" shortcut, the fallback order (ADR-0125) and usage counts held until the
person answers (ADR-0127). No schema change: 0.3.3 runs on schema 79. 0.3.2 was cleared by its own ledger,
[2026-10-06-release-032-verification.md](2026-10-06-release-032-verification.md).

## Protocol

The protocol is 0.3.2's, unchanged ([0.3.2 ledger, Protocol](2026-10-06-release-032-verification.md#protocol)):

- **Independent** — each iteration is read by fresh reviewer agents that have not seen an earlier iteration's
  findings or fixes; they read the product and the code first, and a finding an earlier iteration closed is
  checked again, not skipped.
- **Levels**, one reviewer each: scenarios, UX and UI (UX-n); errors and boundaries (ER-n); code ↔ documentation
  (DO-n); data, memory, orchestration, harness (DA-n); plan and roadmap (PL-n).
- **A finding** gets an id `V<iteration>-<n>`, its source, evidence and a disposition: **fixed** (with the test that
  now catches it, its planted defect watched), **ruled** (a register id and the reason it is not a release blocker),
  or **not a defect** (with the measurement).
- **Exit** — the release proceeds only after iteration 3 ends with zero open findings marked blocking.

Reviewers work read-only in a detached checkout of the candidate. Their reports are committed as written, with
machine paths replaced by `<scratchpad>/`, `<worktrees>/` and `~/`; their probes and screenshots stay outside
the repository (the operator's rule of 2026-10-06: media does not go into git). Iteration 3's reports are
committed under `docs/evidence/reviews/0.3.3/iteration-3/`, because after `verifiedCommit` the release gate admits
review artifacts only under `docs/reports/` or `docs/evidence/reviews/`.

## Iteration 1

_Not started._

## Iteration 2

_Not started._

## Iteration 3

_Not started._
