# Release verification — three independent iterations (P-02)

Run `2026-10-03-onboarding-and-plan`. The operator's rule (2026-10-03): before the DMG and the release,
three independent testing iterations across every level of the project, every finding fixed, and only
then the release. This file is the ledger; the plan row is
[P-02](../backlog.md#general-development-plan).

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

_Not started._

## Iteration 2

_Not started._

## Iteration 3

_Not started._
