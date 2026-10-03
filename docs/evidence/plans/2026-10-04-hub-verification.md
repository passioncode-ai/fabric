# Release verification — Fabric 0.3.1, the hub (ADR-0115): three independent iterations

Run `2026-10-04-hub-verification`. The operator's rule (2026-10-03, plan row P-02, kept for every release
since): before the DMG and the release, three independent testing iterations across every level of the
project, every finding fixed, and only then the release. This file is the ledger for **Fabric 0.3.1**,
whose new content is the hub — [ADR-0115](../../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md),
squash `67a5dc42` (PR #7) on `main` — and the plan row is [P-08](../backlog.md#general-development-plan).
0.3.0 was cleared by its own ledger, [2026-10-03-verification.md](2026-10-03-verification.md); the release
gate now refuses a ledger whose title does not name the version it clears (V1-1 below), so 0.3.1 cannot be
released on 0.3.0's record.

## Protocol

- **Independent** means each iteration is read by fresh reviewer agents that have not seen an earlier
  iteration's findings or fixes. They read the product and the code first and form their own findings;
  only then is the ledger compared, and a finding an earlier iteration already closed is checked again
  rather than skipped.
- **Levels**, each with its own reviewer per iteration:
  1. *Scenarios, UX and UI* — every SCN/FLW/SCR of the change against the live app and the code;
     every state drawn; visual language, layout, noise; light and dark.
  2. *Errors and boundaries* — failure behaviour of every new path, the file-root boundary, retries,
     idempotency, cancellation, the main-process event loop.
  3. *Code ↔ documentation* — `#region … docs:` markers, ADRs, scenarios, CONTEXT terms, the design map,
     the knowledge base; every claim with its receipt.
  4. *Data, memory, orchestration, harness* — the whole project's stack-backed tier (`ci.sh full`),
     the journal and projections, memory, runs and the provider harness.
  5. *Plan and roadmap* — the general plan, the backlog, the workspace publication.
- **A finding** gets an id `V<iteration>-<n>`, its level, evidence (file:line, command and output, or a
  screenshot) and a disposition: **fixed** (with the commit and the test that now catches it),
  **ruled** (a register row id and the reason it is not a release blocker), or **not a defect** (with
  the measurement). A count is never a disposition (R-002).
- **Exit.** The release proceeds only after iteration 3 ends with zero open findings marked blocking.

## Iteration 1

_In progress._

## Iteration 2

_Not started._

## Iteration 3

_Not started._
