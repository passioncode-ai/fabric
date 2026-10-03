# Changelog

Release notes for Fabric. The next version's section is written as `## X.Y.Z (unreleased)` (or `## Unreleased`
before its number is known); the release pull request renames it `## X.Y.Z`, and the release workflow publishes
that section as the notes of the `vX.Y.Z` release
([docs/launch/release-mac.md](docs/launch/release-mac.md), [ADR-0111](docs/adr/0111-fabric-is-released-from-ci.md)).
Earlier versions: 0.2.0 (2026-09-29), receipt [`docs/releases/fabric-0.2.0-mac.json`](docs/releases/fabric-0.2.0-mac.json).

## 0.3.1 (unreleased)

Not released yet: the version bump and the tag follow the third verification iteration
([ledger](docs/evidence/plans/2026-10-04-hub-verification.md), plan P-08).

- **The hub: a local agent reaches a cloud product through Fabric, on your consent**
  ([ADR-0115](docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md)). Fabric listens
  for agents registered on this Mac on a stable loopback port, `FABRIC_HUB_PORT` (default 47070), published in
  `~/Library/Application Support/ai.passioncode.fabric/hub.json` beside a door token (both 0600, rewritten on
  start, removed on quit). An agent asks once with `fabric.access.request`; you answer once in a native prompt,
  or from the attention queue when Fabric is in the background; on Allow the agent collects a revocable binding
  credential and calls the product with `agent.call`, narrowed by your grants and again by the product.
  **Settings → Agent access** lists products, waiting requests, agents with their grants (Revoke, Revoke all)
  and standing denials (Clear).
- **Fabric Inbox connects once, by its own consent.** Connect opens the Fabric Inbox app; its key goes to
  Project Observatory's vault, never into Fabric's database or logs. Requires the Fabric Inbox **server** at
  Worker version `4fd02b75` or later, which carries fabric-inbox#24 (a comma is never part of an account id);
  the Fabric Inbox 0.9.0 app supplies the connect link.
- **Hardening from the first verification iteration:** a per-request poll secret, so only the agent that asked
  can read its answer and collect its credential; the registry reads regular files only and never blocks the
  app; the connect callback answers the product within its 10 seconds or keeps nothing; hub authority restored
  from an archive comes back revoked, for you to approve again; each estate keeps its own product secret slot;
  the consent, grant and queue wording is in English and Russian.
- **Schema 75 → 77** (migrations 76 and 77). An estate opened by 0.3.1 cannot be opened by 0.3.0.
- **Not done yet:** `agent.call` takes product tool names the agent contract's `capabilityName` pattern refuses
  (CO-193); a session Fabric starts cannot reach a product through Fabric (CO-194); no live end-to-end run with
  the Fabric Inbox app yet (CO-195); the knowledge base does not describe the hub (CO-196); the workspace
  publication is stale (CO-197).

## 0.3.0

- **Releases are built and signed in CI.** A `vX.Y.Z` tag on main runs `.github/workflows/release.yml`:
  after a member of `release-approvers` approves, the DMG is signed with the organization's CI Developer ID,
  notarized and stapled, then attested (Sigstore), listed in a GPG-signed `SHA256SUMS` and published as a
  prerelease of this repository while Fabric is an early preview. No signing identity or team id is written into the repository any more; a
  build made on a laptop is a debug build and is never published.
