# Handoff — the hub: a local agent reaches a cloud product through Fabric, on consent (2026-10-03)

Branch `agent/ar-3-hub-consent` (pushed; not on `main`). The branch head is the commit that carries this
file; `git log origin/agent/ar-3-hub-consent -1` names it. Decision:
[ADR-0115](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md). Plan rows:
AR-2.2, AR-3.1, AR-3.4 in the [agent registry plan](../evidence/plans/2026-09-29-agent-registry-plan.md).
UX: SCN-132, SCN-133, FLW-75, FLW-76, SCR-76. The product side is passioncode-ai/fabric-inbox branch
`agent/hub-connect` (the connect link, `X-Fabric-Accounts`).

## Objective

ADR-0115 slices S1–S4 in Fabric: an agent registered on this Mac asks once, the operator allows once, and
the agent then calls a connected product through Fabric — narrowed by the grant and by the product's own
header — while the product's key stays in Project Observatory's vault.

## Done (on the branch)

- **S1 registry reader** — `apps/desktop/src/main/agentRegistry.ts`: `services/` and `providers/`
  (`FABRIC_SERVICES_DIR` / `FABRIC_PROVIDERS_DIR`) into one registry keyed `id[.instance]`; malformed files
  are problems with reasons; FAC-SEM-010 and FAC-SEM-013; refresh on demand and on change. Follows the
  contract's schemas, because `@passioncode-ai/fabric-service-host` is unpublished.
- **S2 hub ingress** — `agentSurface.ts` listens on `FABRIC_HUB_PORT` (default 47070), refuses a port a
  registered agent claims, and never falls back: the hub closes with its reason and sessions keep an
  ephemeral port with the ingress closed. `hub.ts` writes `hub.json` and the door token (0600, atomic,
  rotated, removed on quit by the writer only). Door token → `fabric.access.request`/`status`; binding
  credential (sha256 verifier, revocable) → `agent.call`, `fabric.access.grants`, more requests for its own
  agent. Sessions keep the one-shot bearer. Migration 76: `access_requests`, `access_bindings`,
  `access_grants`, `product_connections`, nine event types, a projector that refuses impossible transitions.
- **S3 consent** — `accessService.ts`, `consentPresenter.ts`: unknown agent refused before any prompt; a
  request expires in 10 minutes; native prompt with a parent window, or a notification and an `access` row
  in the queue (SCR-41) with Allow/Deny; Deny stands until cleared; the credential is minted on the first
  status read after Allow (exactly once, restart-safe); incremental consent; Settings → Agent access
  (`AgentAccessPanel.tsx`) lists products, waiting requests, grants with Revoke and denials with Clear.
- **S4 products** — `productConnect.ts` (link, single-use state, callback on the same server, 503 without
  Observatory), `observatoryVault.ts` (put/rotate on stdin; read only from a vault slot, through a named
  pipe), `productForwarder.ts` + `hubCall.ts` (grant coverage, `X-Fabric-Accounts`, redirects refused, one
  `hub.call.forwarded@1` span per hop as a child of `_meta.traceparent`, the interop envelope, idempotency).

## Checks run (this machine, 2026-10-03)

- `node apps/desktop/test/run-hub-access-db.mjs` — owned PostgreSQL with Supabase defaults:
  `hub-access-db.test.mjs` 11/11, `hub-door-db.test.mjs` 14/14; watched failing with
  `FABRIC_SKIP_MIGRATION=20261003000076_hub_access.sql` (11 FAIL) and on planted defects.
- `node --experimental-strip-types` on `agent-registry` 10, `hub-files` 5, `hub-products` 14,
  `consent-presenter` 5; vitest 1617/1617 (incl. `shared/access.test.ts` 17, `AgentAccessPanel.test.tsx` 6).
- `bash scripts/ci.sh fast` — see the pull request for the last run's exact outcome.

## Open

- CO-193: the contract's `capabilityName` has no `_`; Fabric accepts the product's tool names.
- CO-194: a session's declared server with `source: 'fabric'` still refuses (AR-3.2).
- CO-195: no live end-to-end run with the Fabric Inbox app; S5 (first consumer) in its own repository.
- `fabric.job.get/cancel` routing through the hub is not built (Fabric Inbox's tools are synchronous).
- `ci.sh full` (disposable Supabase) was not run on this branch.

## Next task

Merge passioncode-ai/fabric-inbox `agent/hub-connect`, install both apps on this Mac, connect Fabric Inbox
from Settings → Agent access, run one registered example agent through `fabric.access.request` → Allow →
`agent.call read_message`, and close CO-195 with the receipts (the journal's `hub.call.forwarded@1` row
and the Worker's narrowing).
