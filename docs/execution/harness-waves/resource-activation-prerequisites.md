# Resource activation prerequisites after the local kernel wave

**Disposition, 2026-10-13:** local producer and composition work remains executable.
Production resource enforcement is not active. This document bounds the next work;
it neither enables a policy nor publishes a portable contract. The owning
[wave plan](../../evidence/plans/2026-10-13-harness-waves.md) and
[ADR-0152](../../adr/0152-resource-preflight-and-durable-reservation-are-distinct.md)
retain task status and the activation decision.

## Evidence boundary

The source audit reads Fabric commit
[`ae197a1552231a9252754f9ee296736f94269471`](https://github.com/passioncode-ai/fabric/tree/ae197a1552231a9252754f9ee296736f94269471).
Its combined fast gate PASS is a parent-run receipt, not an independently repeated
suite here. The subsequent N020 correction is
[`d4ae7a295ec0c7a146c34e4b3afc6f52763a238a`](https://github.com/passioncode-ai/fabric/commit/d4ae7a295ec0c7a146c34e4b3afc6f52763a238a):
it bounds unsettled adapter operations per entry. The pre-fix timeout accumulation
finding must not become a duplicate task. This audit does not certify a native
provider, active database migration or production deployment.

## What already produces authoritative facts

| Existing producer at the source pin | Fact it can support | Fact it cannot substitute for |
|---|---|---|
| [identity.ts:64–101][identity] calls `resolve_subject` and rechecks the held subject | Estate membership and authority revision | Exclusive mutable-file ownership, resource demand or remaining machine capacity |
| [stopHostIdentity.ts:7–16][host] creates a persistent installation ID and a fresh invocation ID | A local host identity suitable for explicitly binding configuration | A globally approved pool policy, an OS boot observation or authority over a previous process |
| [managedLaunch.ts:73–101][launch] begins, validates and binds the durable generation | Exact task/run/session admission and the final SQL launch guard | Current input/scope ownership supplied by the resource adapter |
| [runLifecycle.ts:155–163][reconcile] counts runs not observed locally | Explicit unresolved state | Proof that an absent process ended or that capacity can be released |
| [pending107:66–108][pool] configures a pool, records readings and checks reserved plus observed usage | Atomic database enforcement **after** DDL and trustworthy inputs are available | A producer of those readings or an authority to invent their values |
| [workTools.ts:314][claims] claims a task and reports related/overlapping work | Task ownership and coordination warnings | An exclusive lease over every declared touched file |
| [agentSyncLeases.ts:3–15,109][leases] reads remote lease refs | Bounded visibility of refs and their object hashes | The verified owner, scope, expiry and fence of a particular usable lease |

The existing runtime observer is a liveness/capability observer; its capability
cache explicitly distinguishes declarations from observations
([runtimeObserver.ts:30–47][observer]). It is not a CPU/memory/disk sampler.

The source audit found no application caller of `configure_resource_pool` or
`observe_resource_pool`, no `freemem`/`statfs` sampler, and no resource-pool setting
in `appSettings.ts`. Reproduce the bounded source search at the pin:

```sh
git grep -n -E 'configure_resource_pool|observe_resource_pool|freemem|statfs' ae197a1552231a9252754f9ee296736f94269471 -- apps/desktop/src
git grep -n -E 'resource|pool|capacity' ae197a1552231a9252754f9ee296736f94269471 -- apps/desktop/src/shared/appSettings.ts
```

Both searches returned no matches (exit 1). This is an absence claim limited to
those committed sources, not to other projects or the operator's machine.

## Ordered, bounded local continuation

These are implementation packets, not new canonical task IDs or requests for
operator re-authorization. Each needs its own reviewed source and evidence.

1. **Fabric policy and observation producer.** Select one explicitly configured
   installation/host/pool. Read validated policy with resource units, demand
   profiles, capacity, freshness and revision; bind configuration to the existing
   host identity. Implement actual local readings and the pending107 write/read
   seam. Required missing/failed/stale axes remain unavailable. Do not silently
   fill an unread axis with zero, infer a machine-wide pool, or enable guessed
   defaults. A conservative zero *overlap credit* is distinct from zero observed
   usage: pending107 intentionally charges observations plus reservations.
   Verification: real supported host readings, deterministic stale/missing/changed
   policy cases, and isolated SQL readback. Unsupported host readers refuse.

2. **Fabric input and ownership proof.** Derive the admitted input closure and
   mutable scope from current source-owned task/repository state. Verify the
   actual owning lease record, including scope, owner, freshness and fencing, or
   restrict the first supported path to an independently proven isolated scope.
   Bind the proof to the same identity and snapshot consumed by
   [ResourceChecks:54–66][checks]; re-read it in the adapter's trusted
   [current callback:31–43][adapter]. Neither a matching request echo nor a
   warning-only task claim is proof. Implementing a local reader of an existing
   authority is available work; changing a foreign lease protocol belongs to that
   protocol's owner. Verification: changed input, lost/expired lease, stale fence,
   scope mismatch and unavailable owner state all prevent spawn.

3. **Fabric composed supported path.** Supply the same required resource adapter
   to [index.ts:2456][admit-composition] and
   [index.ts:3161–3205][launch-composition], including the chain's separately
   admitted receipt. Preserve subject and provider-quota gates. Exercise the
   actual composed factories and pending SQL on a disposable fixture: ordinary
   task launch, pre-admitted chain, changed currentness, refused preparation,
   uncertain response and exact compensation. Add no second launcher or
   independent skill-side reservation system. Local composition and its tests
   can be prepared before active migration; production enabling cannot.

4. **Fabric activation and bounded native acceptance.** Promote pending DDL in
   valid migration order; configure the reviewed producer for the explicit
   supported host/pool; connect lifecycle reconciliation and the durable wait
   consumer only through the enforced dispatcher. Validate one owned supported
   native path before expanding coverage. Preserve outstanding reservations and
   unknown generations on restart, policy change or rollback. Evidence must
   separate implemented, configured, observed and accepted states.

This sequence ends at one demonstrated supported production path. Additional
hosts, broad backend rollout and optimization experiments are separate expansion,
not prerequisites for claiming that narrower path correctly.

## Real dependencies and excluded claims

- **Active schema ordering, Fabric integration owner:** at the source pin,
  [schemaContract.json:3–4][schema] supports schema87. Pending107/108 are not active;
  reserved105–106 ordering must be reconciled through migration policy. This is a
  real activation dependency, not a blanket block on packets 1–3.
- **Authoritative ownership:** the necessary producer is not present in the
  audited resource composition. Its local verification can be built now; an
  external owner request is needed only if the existing authority cannot supply
  the required semantics. Do not manufacture a held lease to bypass this gap.
- **Path coverage:** direct operator terminals still call `ptys.open` without
  managed resource admission ([index.ts:4597–4623][terminal]). The owned backend
  registry has its own local active cap ([ownedBackendProcessRegistry.ts:39][backend]),
  not a common machine resource pool. The audit found no production composition
  of `createBackendLaunch`/`createOwnedBackendProcessRegistry` in `index.ts`.
  Neither path is covered by merely wiring the existing managed PTY launcher.
- **Native/operational acceptance:** successful injected and disposable SQL tests
  cannot certify Windows/Linux/native provider behavior, running services or
  installed configuration. A required login, consent, credential or spend grant
  retains its actual human boundary; no such gate is invented for local code.
- **Portable contracts and owner integrations:** `fabric-agent-contract` owns
  portable reservation/ownership/event semantics; `agent-sync` owns changes to
  its lease authority; task-pipeline owns eligibility/certification/adoption;
  Observatory owns its aggregation and lesson contract. Requests remain
  **PREPARED / NOT_SENT** through [owner packets](owner-packets.md) while the
  consent-gated Fabric board is unavailable. This audit sends no request and
  records no owner acceptance. Local Fabric implementation is not blocked merely
  by that board state. Optional export and cross-project adoption do not need to
  precede the bounded local path.

## Audit checks and handoff

Read-only source search and commit comparison were performed; no production
configuration, migration, native provider or foreign-owner state was changed.
The next bounded work is packet 1 and the concrete authority investigation in
packet 2, followed by their composed test in packet 3. Do not create additional
placeholder modules instead of completing those producers. The current wave's
integration owner retains final gate, source receipt and publication duties.

[identity]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/identity.ts#L64
[host]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/stopHostIdentity.ts#L7
[launch]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/managedLaunch.ts#L73
[reconcile]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/runLifecycle.ts#L155
[pool]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/supabase/pending-migrations/20261013000107_resource_reservations.sql#L66
[claims]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/workTools.ts#L314
[leases]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/agentSyncLeases.ts#L3
[observer]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/runtimeObserver.ts#L30
[checks]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/shared/resourceAdmission.ts#L54
[adapter]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/resourceLaunchAdapter.ts#L31
[admit-composition]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/index.ts#L2456
[launch-composition]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/index.ts#L3161
[terminal]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/index.ts#L4597
[backend]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/main/ownedBackendProcessRegistry.ts#L39
[schema]: https://github.com/passioncode-ai/fabric/blob/ae197a1552231a9252754f9ee296736f94269471/apps/desktop/src/shared/schemaContract.json#L3
