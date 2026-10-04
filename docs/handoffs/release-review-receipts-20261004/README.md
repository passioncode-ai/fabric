# Release review receipt author packet

Objective: harden PL10 / I3PLAN05 without publishing or rewriting historical reviews.
Base: `7011ce429d2593951b9d99940f78ab5850f17309`. This is an author branch, not an
independent review, release approval, release or installation receipt.

## Scope and plan

1. Inspect the actual release gate and independently reproduce fabricated closure.
2. Agree a minimum versioned receipt contract with the root owner.
3. Add counterexamples first, implement bounded artifact checks, verify both exits.
4. Commit and push this author packet for independent review and root integration.

Owned files: release-gate library/tests and this packet. No guarded registers,
historical ledgers, gate JSON, living map, release workflow or production action.
Root owns committed-file loader wiring and integration metadata. Existing model
and authorization are inherited; no further intake questions are needed.

## Requirements and checks

| Requirement | Check |
|---|---|
| Three iterations with all five review levels | negative missing-level and positive closed-fixture tests |
| Each artifact exists in the candidate release commit | committed-file loader test, not working-tree reads |
| Exact reviewed commit and structured closure | stale candidate/open receipt counterexamples |
| Existing unfinished hub ledger always refuses | unconditional real hub ledger assertion |
| Historical evidence remains untouched | scoped Git diff and source file checks |
| No claim of cryptographic reviewer independence | explicit trust boundary below |

## Sources and first reproduction

`AGENTS.md`, `docs/AGENT_SYNC.md`, `docs/evidence/plans/2026-10-04-hub-verification.md`
(Protocol), `scripts/lib/release-gate.mjs`, `scripts/test/release-gate.test.mjs`,
`scripts/release-mac.mjs`, `scripts/lib/release-mac.mjs` were read at the base commit.
The local organization knowledge README, vision, principles, how-to-work and rules
were read. The policy check printed no pending update. Task-pipeline and
evidence-docs provide the selected source-only profile: intake/contract → TDD →
bounded validation → draft handoff; deployment and independent acceptance remain open.

A direct Node import of the actual gate at the base, given three closed sections
with one nonexistent report link each, returned `{"problems":[]}`. This reproduces
the source defect; it neither builds the app nor runs a release.

## Trust boundary

Committed bytes, content hashes, exact candidate declarations, level coverage and
structured closure can be checked mechanically. Reviewer identifiers are declared
provenance. Uniqueness cannot prove an agent had fresh context or was independent;
the review owner must verify reviewer provenance and freshness separately.

## Resume

Next: root selects the receipt schema; then add failing gate tests before implementation.
Open: code, focused verification, independent review, loader integration and push.
