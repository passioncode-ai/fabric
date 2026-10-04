# Handoff — the hub: a local agent reaches a cloud product through Fabric, on consent (2026-10-03)

**Status (updated 2026-10-04): merged to `main` as 67a5dc42 (PR #7, squash, 2026-10-03T22:23:15Z); the branch
`agent/ar-3-hub-consent` is deleted.** Unreleased: it ships in Fabric 0.3.1 (plan P-08), whose verification runs in
[its own ledger](../evidence/plans/2026-10-04-hub-verification.md). Decision:
[ADR-0115](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md). Plan rows:
AR-2.2, AR-3.1, AR-3.4 in the [agent registry plan](../evidence/plans/2026-09-29-agent-registry-plan.md).
UX: SCN-132, SCN-133, FLW-75, FLW-76, SCR-76. The product side is merged in passioncode-ai/fabric-inbox:
#16 (`733182d`, keys limited to mailboxes), #18 (`fc615c4`, the connect link and `X-Fabric-Accounts`) and #24
(`e7cc73b`, a comma is never part of an account id); the narrowing the hub relies on is the **server's**, deployed as
Worker version `4fd02b75` after #24 (CO-195).

## Objective

ADR-0115 slices S1–S4 in Fabric: an agent registered on this Mac asks once, the operator allows once, and
the agent then calls a connected product through Fabric — narrowed by the grant and by the product's own
header — while the product's key stays in Project Observatory's vault.

## Done (on `main` since 67a5dc42)

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
  status read within 10 minutes of Allow (exactly once, restart-safe; amendment 12); incremental consent; Settings → Agent access
  (`AgentAccessPanel.tsx`) lists products, waiting requests, grants with Revoke and denials with Clear.
- **S4 products** — `productConnect.ts` (link, single-use state, callback on the same server, 503 without
  Observatory), `observatoryVault.ts` (put/rotate on stdin; read only from a vault slot, through a named
  pipe), `productForwarder.ts` + `hubCall.ts` (grant coverage, `X-Fabric-Accounts`, redirects refused, one
  `hub.call.forwarded@1` span per hop as a child of `_meta.traceparent`, the interop envelope, idempotency).
- **The security review's rules** an inheritor must keep — reconnect only by the operator's Reconnect, secret first in its own slot, then the record inside the 8-second deadline (amendment 13), one live grant per binding/callee/capability/resource, idempotency per binding, `create_address`
  extras as their own capabilities — are written in ADR-0115's
  [Amendments 1–5](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#amendments--security-review-of-pr-7-2026-10-03);
  what the 0.3.1 verification changed follows them in the same ADR. Iteration 1 added migration 77 beside 76 and landed as `2927a087` (PR #8); see the [verification handoff](2026-10-04-hub-verification.md).

## Checks run

Measured at the merge commit 67a5dc42 by the independent reviewers of the 0.3.1 verification, iteration 1
(2026-10-04; reports linked from [the ledger](../evidence/plans/2026-10-04-hub-verification.md)):

- `node test/run-hub-access-db.mjs` (apps/desktop, owned PostgreSQL with Supabase defaults) →
  hub-access-db `{"status":"PASS","cases":12}`, hub-door-db `{"status":"PASS","cases":15}`.
- `node --experimental-strip-types --test` on `agent-registry` (11), `hub-files` (5), `hub-products` (25),
  `consent-presenter` (5) — all pass; `npx vitest run` → 145 files, 1632/1632 (`shared/access.test.ts` 30,
  `AgentAccessPanel.test.tsx` 7).
- `FABRIC_PG_BIN=/opt/homebrew/opt/postgresql@17/bin bash scripts/ci.sh full` → exit 0, "full tier green. The
  live stack was not addressed" (disposable stack, migrations 76 + seed); browser suites NOT_RUN (no
  `FABRIC_PLAYWRIGHT_MODULE`), said by the script.
- Hosted CI on 67a5dc42 (run 37158269890): the fast job passed; the full job was skipped, as on every push.
  Before the merge (2026-10-03) the counts were lower (11/14 and 10/14/17/6); the ones above supersede them.

## Open

- CO-193: the contract's `capabilityName` has no `_`; Fabric accepts the product's tool names.
- CO-194: a session's declared server with `source: 'fabric'` still refuses (AR-3.2).
- CO-195: no live end-to-end run with the Fabric Inbox app; S5 (first consumer) in its own repository.
- `fabric.job.get/cancel` routing through the hub is not built (Fabric Inbox's tools are synchronous).
- The 0.3.1 verification's findings and their dispositions: [ledger](../evidence/plans/2026-10-04-hub-verification.md).

## Next task

Finish the 0.3.1 verification (P-08: iterations 2 and 3 in [the ledger](../evidence/plans/2026-10-04-hub-verification.md)).
Then, with a build of `main`, the Fabric Inbox 0.9.0 app and the Fabric Inbox server at Worker version `4fd02b75`
or later (it carries fabric-inbox#24): connect Fabric Inbox from Settings → Agent access, run one registered
`example-agent` through `fabric.access.request` → Allow → `agent.call read_message` on `news@example.com`, and
close CO-195 with the receipts (the journal's `hub.call.forwarded@1` row and the Worker's narrowing).
