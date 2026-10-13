# ADR-0152 — Resource preflight and durable reservation are distinct

**Status:** accepted local implementation design; activation and portable compatibility remain open.
**Date:** 2026-10-13. **Scope:** CO-282 resource packets R1/R2.
**Decision authority:** implementation design within the operator-authorized autonomous harness work;
this record does not claim that the operator personally selected these technical fields.

## Context

The existing [admission receipt](../../apps/desktop/src/shared/admission.ts) is the answer of
`admit_task_launch`. The [quota reader](../../apps/desktop/src/shared/unattendedAdmission.ts)
consumes provider quota readings. Neither is a host resource reservation. The
[resource packet](../execution/harness-waves/resource-implementation.md) explicitly permits
injected internal interfaces before an external protocol is accepted.

## Decision

1. A pure local preflight validates explicitly injected host/pool scope, policy revision,
   fixed resource units, demand, reading freshness and independently checked ownership/input
   binding. Its eligible result only means that the caller may attempt reservation. It does
   not grant execution, spend, file ownership or a durable reservation.
2. Resource units are worker slots, memory bytes, disk bytes and CPU millicores. Limits and
   freshness are explicit inputs; this change chooses no machine-wide capacity defaults.
   Requested, reserved and observed values remain distinct. Missing or stale readings are
   unknown, not zero. An observed overlap may reduce double accounting only with explicit
   evidence; the initial SQL path conservatively gives no unproven overlap credit.
3. R2 uses a host/pool-scoped internal SQL ledger with trusted configuration and observations.
   Atomic admission binds the immutable attempt, native session, demand and input identities.
   Repeated identical requests recover the original result; changed retry inputs refuse.
   Child usage belongs to the same estate and consumes its parent's envelope, without
   creating another host pool. A parent cannot release while children remain held.
4. Existing migration62 authorization, generation, operational stop and compensation rules
   remain authoritative. A timeout, journal replay, request to stop or missing local process
   handle is not release proof. Restore must not manufacture a live reservation or operational
   release authority. Exactly scoped never-spawned or observed-ended evidence is required.
5. The current migration order and reserved104–106 are preserved. R2 DDL is implemented as a
   pending migration applied explicitly by isolated fixtures. It is not added to the active
   migration ledger or supported schema range until those ordering dependencies resolve.
   This is a real activation dependency, not a reason to stop local implementation or review.
6. Public cross-product reservation/receipt/event schemas remain owned by fabric-agent-contract.
   An internal function or pending SQL implementation is not protocol-owner approval. R3 must
   cover actual entry paths, and native/provider acceptance remains separate from fixture tests.

## Consequences and checks

R1 can progress while the project board awaits access. R2 can be tested without touching the
operator's database. Neither establishes live resource enforcement or measured energy savings.
R3–R6 retain their own [acceptance packets](../execution/harness-waves/resource-implementation.md).
Review must exercise hostile runtime inputs, capacity races, changed retries, nested accounting,
stale release, restore and ambiguous results against production decision/SQL code.

Implementation and verification status live in the [graph](../execution/harness-waves/graph.json)
and [resource-wave review](../reports/2026-10-13-resource-admission-contract/README.md), not this
architectural decision. A later change to these decisions requires a new ADR.
