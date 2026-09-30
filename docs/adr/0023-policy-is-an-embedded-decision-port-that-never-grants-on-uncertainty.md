# Policy is an embedded decision port that never grants on uncertainty

- **Status:** Accepted
- **Consequences / affects:** `docs/architecture/passioncode-platform.md`,
  `docs/architecture/federation.md`, future policy, grant, credential and effect APIs
- **Source:** operator request, 2026-08-29 — resolves CO-079 and the control-plane part
  of CO-061; Cedar and OPA primary documentation reviewed 2026-08-29

Fabric uses one typed `PolicyDecisionPort` at every enforcement point. The v1 reference
evaluator is an **embedded Cedar-compatible engine** fed by signed, versioned policy and
entity bundles. Evaluation happens beside the caller/worker rather than making every
effect depend on a synchronous central-policy HTTP request. A later OPA or managed-Cedar
adapter is allowed only if it preserves this decision contract and failure matrix.

The request is principal + action + resource + context. Context includes Estate,
Project, actor/membership/session, provider and binding revisions, effect class, target,
data classification, budget/grant state and current policy epoch. The response is:

- `allow`; or
- `deny` with stable reason/recovery codes (for example `grant_required`); or
- `indeterminate` when a trustworthy decision cannot be produced.

Every response yields a decision receipt containing request hash, outcome, determining
policy ids, diagnostic errors, policy/bundle digest and revision, entity-snapshot
revision, evaluator version, timestamp and whether a last-known-good bundle was used.
Sensitive inputs are redacted from the journal receipt.

Enforcement and failure semantics are fixed:

1. A Policy Enforcement Point runs at Run admission, provider/hop resolution, credential
   release and immediately before every external effect. Planning-time permission is not
   a lease to act later.
2. Default deny and forbid/floor precedence are mandatory. No policy, undefined output,
   malformed/missing entity data, invalid signature, expired bundle, evaluator error or
   timeout produces `indeterminate`; **no new effect, credential, scope or remote read is
   allowed**.
3. Cedar's native evaluator skips an individual policy that errors. Fabric's wrapper is
   stricter: for effect-bearing requests, any relevant evaluation diagnostic converts a
   would-be allow into `indeterminate`.
4. A control-plane outage is not itself a failure while the local evaluator has a valid,
   unexpired, signed last-known-good bundle and entity snapshot. An invalid new bundle is
   rejected atomically and the last-known-good revision remains active. Once its validity
   window expires or a revocation epoch invalidates it, enforcement fails closed.
5. An already-authorized UI may display its existing local projection under a short-lived
   visibility lease while refresh is unavailable. It may not fetch new protected data,
   expand scope or perform an effect. The surface shows that policy/identity freshness is
   degraded.
6. Policy or membership changes are re-evaluated before the next effect. They do not
   retroactively erase a completed effect; the Run records a policy interruption and
   stops or requests the named interaction/grant.
7. Break-glass is an explicit, signed, narrowly scoped, expiring grant with an actor and
   incident reference. It is never an implicit fail-open path.

Primary receipts:

- [Cedar authorization algorithm](https://docs.cedarpolicy.com/auth/authorization.html)
  — PARC requests, default deny, forbid-overrides-permit and diagnostic error semantics.
- [Cedar policy validation](https://docs.cedarpolicy.com/policies/validation.html) —
  validate policies against the schema before evaluation.
- [OPA operational failure modes](https://www.openpolicyagent.org/docs/operations) — an
  undefined/not-ready decision and fail-open/fail-closed handling belong to the caller.
- [OPA bundles](https://www.openpolicyagent.org/docs/management-bundles) — signed bundle
  activation keeps the prior active bundle when verification fails.
- [OPA decision logs](https://www.openpolicyagent.org/docs/management-decision-logs) —
  decision ids and bundle revisions as audit inputs.

CO-059 still owns the complete effect vocabulary/algebra; CO-071 still owns database and
session/RLS invariants. This record prevents either from being implemented as scattered
service-local booleans. Bundle/visibility TTL values, revocation transport, policy
authoring UI and performance budgets are implementation decisions that must be fixed by
fixtures before external tenants or effect-bearing schedules.
