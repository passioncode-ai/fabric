# Handoff — Fabric 0.3.1 (the hub) verification, iteration 1 (2026-10-04)

**Status: iteration 1 closed on branch `agent/hub-0.3.1-verification` (from `main` at `67a5dc42`), pull request
"fix(hub): verification iteration 1 for 0.3.1 (ADR-0115)" open against `main`, not merged.** Iterations 2 and 3 have
not started. The version is still 0.3.0 and nothing is tagged: 0.3.0 is released separately from `5193022c`
(plan P-03); the bump to 0.3.1 comes after iteration 3 (plan P-08).

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
  (fabric-workspace knowledge pages), CO-197 (workspace publication / sync under load).
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

- Iterations 2 and 3: fresh reviewers, the same five levels, against this branch's head once merged (or the branch
  itself), without reading iteration 1 first.
- CO-193, CO-194, CO-195, CO-196, CO-197 (carry-over ledger).
- After iteration 3: bump `apps/desktop/package.json` to 0.3.1, point `docs/launch/release-gate.json` at the 0.3.1
  ledger, rename `## 0.3.1 (unreleased)` to `## 0.3.1`, the full tier green at the release commit, tag from CI.

## Checks run

Recorded with their outcomes in the ledger's iteration 1 section ("Gates on the final head of this iteration").

## Next task

Merge the iteration-1 pull request after review, then start **iteration 2** of the 0.3.1 ledger: five fresh
reviewers against the merged head, reports into `docs/evidence/plans/2026-10-04-hub-verification/iteration-2/`.
