# Handoff — Fabric 0.3.1 (the hub) verification, iteration 1 (2026-10-04)

**Status (recovery 2026-10-04): iteration 1 landed on main as squash `2927a087` (PR #8).**
Its individual pre-squash receipts belong to PR #8, available through `refs/pull/8/head`.
Iteration 2 reviewers completed their read-only reports; their fixes are being recovered from the interrupted
Claude worktrees. Iteration 3 has not closed. The application remains 0.3.0: a pushed recovery branch is not a release.

Entry point: the ledger, [2026-10-04-hub-verification.md](../evidence/plans/2026-10-04-hub-verification.md) — its
`## Iteration 1` table names every finding (V1-1…V1-56), its commit and the test that now catches it.

## Objective

Release the hub (ADR-0115, squash `67a5dc42`) as Fabric 0.3.1 only after three independent verification iterations
across the five levels, every finding fixed or ruled (operator's rule of 2026-10-03, P-02 → P-08).

## Done in iteration 1

- Five fresh reviewers' reports kept in `docs/evidence/plans/2026-10-04-hub-verification/iteration-1/` (64 findings,
  56 rows). All nine findings the release owner called blocking are **fixed**, none ruled: release gate per version
  (PL-1), the product row (UX-1), consent in the operator's language with a regression check (UX-2), registry reads
  (ER-1), the per-request poll secret (ER-2), the callback deadline with the secret stored first (ER-6/DO-9), migration
  77 at the door (DA-1) and across a restore (DA-2), a secret slot per estate and connection (DA-6).
- Every other finding fixed except three cross-repository ones, ruled: CO-193 (fabric-agent-contract), CO-196
  (fabric-workspace knowledge pages), CO-197 (publication at the final source SHA; the original under-load diagnosis is superseded by sync recovery).
- Schema 77 (migration `20261004000077_hub_access_at_the_door.sql`); the task-pipeline persistence contract re-reserved
  its two migrations to 78/79.
- ADR-0115 amendments 6–19; CONTEXT gains Poll secret; CHANGELOG `## 0.3.1 (unreleased)`; plan P-08; design map lane
  `#iteration-2026-10-04-hub-verification-1`.

## Decisions taken here (recorded in ADR-0115's amendments)

- The connect callback stores the secret FIRST and records the connection only inside an 8 s deadline (amendment 13,
  replacing amendment 4's record-first order).
- The vault slot names the estate and the connection (amendment 14); superseded slots stay until removed in the vault.
- Through the door, status needs the request's poll secret; requests written before migration 77 cannot be read and
  their agents ask again (amendment 11).
- The FIFO stays for `vault.read` (opened non-blocking): Observatory's `use_secret.py run` closes inherited fds, so a
  pipe on fd 3 is not available (V1-21).

## Open

- Iteration2 reports are complete; recover/disposition their fixes, then review iteration3 independently
  across the same five levels at the exact converged SHA before comparing earlier findings.
- CO-193, CO-194, CO-195, CO-196, CO-197 (carry-over ledger).
- After iteration 3: bump `apps/desktop/package.json` to 0.3.1, point `docs/launch/release-gate.json` at the 0.3.1
  ledger, rename `## 0.3.1 (unreleased)` to `## 0.3.1`, the full tier green at the release commit, tag from CI.

## Checks run

Recorded with their outcomes in the ledger's iteration 1 section ("Gates on the final head of this iteration").

## Next task

Converge the core, surface and root iteration-2 recovery patches, run the combined gates, and disposition the
iteration-2 ledger under its lease. Then conduct iteration 3 independently at the converged SHA. The surface
packet is [surface-resume.md](surface-resume.md); it identifies focused checks and outstanding acceptance gates.
