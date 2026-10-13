# ADR-0154 — Logical worker pools retain unresolved start intents

**Status:** accepted local design; launcher coverage and runtime activation remain open.
**Date:** 2026-10-13. **Scope:** CO-282, N031/N032 local worker inventory.
**Decision authority:** implementation design within the operator-authorized autonomous
harness work. This does not claim the operator personally chose the technical fields.

## Context

[ADR-0152](0152-resource-preflight-and-durable-reservation-are-distinct.md) separates
resource preflight, durable reservation and execution authority. The implemented
[host sampler](../execution/harness-waves/resource-host-observation.md#contract)
requires a complete independently supplied inventory for its explicit worker pool.
The [source-bound continuation review](../reports/2026-10-13-resource-admission-contract/raw/closing/worker-inventory-next-design.json)
shows that the in-memory PTY map appears after spawning and cannot cover uncertain starts
or earlier invocations. Native process-tree observation and provider quiescence are
separate evidence; an exit event alone cannot safely retire every unit.

## Decision

1. The first local pool concerns explicitly enrolled Fabric-controlled logical execution
   units. One durable unit consumes one worker slot. A unit may include a process tree
   and provider work; it is not one slot per OS process. Foreign CLIs, ordinary unmanaged
   terminals and other applications are outside this logical pool unless their actual
   launch paths are enrolled. Physical host CPU, memory and disk readings still include
   their effects. This is not a claim of machine-wide worker enforcement.
2. Record a durable start intent before its concrete launcher may create the unit.
   Bind it to independently refreshed N028 assignment, host installation/invocation,
   pool/policy identity and exact adapter-coverage revision. A matching caller label,
   PID or file path does not prove membership. Preserve duplicate identities as a
   conflict; exact retries may recover the identical durable record without creating
   a second one. Partial writes and interrupted operations remain visible and unknown.
3. Desired coverage in a manifest does not prove entry-point coverage. N031 supplies
   only bounded durable intents and returns incomplete inventory. N032 must wire an
   actual controlled launcher and bind real session/process observations before any
   complete result can be implemented. The existing N022 input must remain unavailable
   until that additional contract is actually met; an empty directory is not proof
   of zero workers. No generic `complete` or `ended` callback grants that evidence.
4. Do not retire an intent because of timeout, root exit, absent in-memory handle,
   restart or a changed invocation ID. Require the concrete never-spawned boundary
   or the relevant process-tree and provider quiescence evidence. Without it, retain
   the unit and its uncertainty. A future complete inventory of conservatively charged
   unretired units must prove the complete controlled set and explicitly name those
   semantics; it may not call uncertain units observed-live or hide missing coverage.
5. Storage and outstanding operations have explicit finite bounds. Exhaustion refuses
   new starts. A caller timeout does not release pending I/O occupancy. Retained record
   cleanup/recovery needs its own concrete ownership and evidence contract; this change
   introduces neither stale-lock stealing nor automatic ID reuse.
6. This decision does not redefine R1 `held`, create a numeric ownership fence, acquire
   a Git lease, activate SQL or configure a pool. Assignment, intent, reservation,
   logical-worker accounting and native authority retain their distinct contracts.

## Consequences and verification

The [execution graph](../execution/harness-waves/graph.json) owns implementation status.
Required N031 checks exercise actual owned filesystem writes and real assignment readback, restart,
corruption, collision, manifest/host/membership drift, mid-write uncertainty and retained
I/O. N032 must exercise actual managed/PtyManager boundaries with synthetic native
fixtures before live activation. No source fixture establishes provider or native-host
acceptance. Existing non-resource launch behavior must remain unchanged.
