# ADR-0046 — Manager role slots use canonical roles, scoped epochs and explicit handoff

**Status:** proposed · 2026-09-07 · recommended engineering baseline, not operator acceptance.
**Affected work:** M166, M167, M168, M169, M171, M175, M176, M194, S02, S15.

## Context

ADR-0043 makes the manager selectable but uses `role=manager` without settling
estate CEO versus project Product Manager execution scope. Existing bindings and the
released external schema require a project; canonical roles already distinguish
`ceo` and `product-manager`. A fake project used to satisfy that type would change
ownership without saying so.

Evidence: `CONTEXT.md#CEO`, `CONTEXT.md#Product manager`,
`supabase/migrations/20260831000001_migration_one.sql#agent_bindings`,
`docs/adr/0043-the-manager-seat-is-a-binding.md`, and the pinned sibling contract
sources listed in [engineering-specs.json](../architecture/engineering-specs.json), M194.

## Proposed decision

1. **Manager is a UI family label.** Canonical role values stay `ceo` for estate
   scope and `product-manager` for project scope. Do not add a third ambiguous role.
2. Introduce a durable RoleSlot identified by
   `(estate_id, role, scope_key)` with explicit scope discriminant. A configured managed role keeps one canonical assignment. Replacement atomically
   switches its binding revision while runtime is suspended/transitioning; zero live
   invocations is valid, zero canonical assignments is not the handoff mechanism.
   Two simultaneous writers are never valid. An unconfigured role is shown as such
   before manager capability activation. No fabricated project for an estate CEO.
3. Each invocation leases the slot with a monotonically increasing fencing epoch.
   Every mutating tool checks role scope, binding revision, invocation lease and epoch
   inside the trusted command boundary. A stale process may keep running but cannot
   retain write authority after rebind/revoke.
4. Wake consumes a fixed signal batch with a source high-water mark. Coalesce duplicate
   wake requests; checkpoint the cursor only with durable outputs. Ignore the manager's
   own bookkeeping as a wake source, while admitting relevant worker-result deltas.
   Global attempt/token/money/time budgets include retries and fallbacks.
5. Built-in and external managers use the same typed tools, checker, policy floor,
   read envelope and trace contract. Only the judgement loop changes. `ModelPort=null`
   retains deterministic ranking/gathering and exposes unresolved judgement explicitly.
6. Handoff is explicit: stop new admissions, checkpoint outstanding obligations and
   cursor, invalidate old epoch, admit the new binding, build a fresh context pack,
   start a new invocation and acknowledge continuation. Preserve unknown effects for
   reconciliation; never blindly repeat them. Vendor-private state is not portable.
7. Local desktop, remote host and provider-native resume are declared capabilities.
   Desktop app-off remains unavailable. No always-on guarantee appears merely because
   a cadence is configured or an external manager is selected.

## Compatibility and activation

The external contract needs a versioned estate-scoped execution envelope before an
external estate CEO can be activated. Project manager support can be developed and
verified separately. The picker shows support per capability, with reasons for disabled
choices, rather than an undifferentiated provider list.

A strict MCP server list alone does not intercept every native tool. Adapter admission
must demonstrate boundary enforcement for built-in tools, filesystem, network, subprocess
and external effects. Unsupported enforcement yields restricted/observe-only capability,
not an `allowedTools` promise. Concrete upstream sources are retained in the research/catalog.

## Rejected alternatives

- `manager` as an unversioned alias: breaks role validation and hides scope.
- Kill old process and assume single writer: a remote or delayed process can still act.
- Wake on every journal event: the manager wakes itself indefinitely.
- Copy provider transcripts as execution state: loses typed obligations and may carry
  untrusted instructions or vendor-private content across providers.

## Acceptance and propagation

Use M194/M176 conformance: simultaneous wakes, stale epoch write, loss after external
call, self-wake loop, absent model, role/scope mismatch, incompatible adapter and handoff
with open questions. Every refusal has a receipt. Two executors must pass the same
required safety fixtures before portability is claimed.

On acceptance propagate the role/scope table into glossary, project architecture,
UX picker/lifecycle scenarios and versioned external contract. This proposal narrows
ADR-0043 without accepting an unimplemented always-on service or changing the floor.
