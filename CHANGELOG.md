# Changelog

Release notes for Fabric. The next version's section is written as `## X.Y.Z (unreleased)` (or `## Unreleased`
before its number is known); the release pull request renames it `## X.Y.Z`, and the release workflow publishes
that section as the notes of the `vX.Y.Z` release
([docs/launch/release-mac.md](docs/launch/release-mac.md), [ADR-0111](docs/adr/0111-fabric-is-released-from-ci.md)).
Earlier versions: 0.2.0 (2026-09-29), receipt [`docs/releases/fabric-0.2.0-mac.json`](docs/releases/fabric-0.2.0-mac.json).

## 0.3.1 (unreleased)

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
  Project Observatory's vault, never into Fabric's database or logs. It needs a Fabric Inbox **server** with
  account narrowing (fabric-inbox#24). Fabric checks that the runtime reports version 0.9.0 or later, but a
  version check does not prove narrowing: the deployed source and a live acceptance remain open (CO-195,
  [fabric-inbox#26](https://github.com/passioncode-ai/fabric-inbox/issues/26)). The 0.9.0 app supplies the connect link.
- **Hardening from three verification iterations:** a per-request poll secret, so only the agent that asked
  can read its answer and collect its credential; the registry reads regular files only and never blocks the
  app; the connect callback answers the product within its 10 seconds and keeps nothing it could not confirm,
  except a late record whose withdrawal itself failed, which stays and is shown to you as such; hub authority
  restored from an archive comes back revoked, for you to approve again; each estate keeps its own product
  secret slot; the consent, grant and queue wording is in English and Russian; a call whose outcome is unknown
  is never sent again under the same key; a caller that disconnects no longer holds an admission slot; quitting
  can no longer hang on a special file planted at `hub.json`.
- **First run shows whether Claude Code and Codex are signed in** (CO-176), read with each tool's own read-only
  status command on the exact builds Fabric has verified; any other answer is shown as unknown, never as signed
  in, and the step never waits for it.
- **Stopping an agent:** asking again to stop a Claude Code or Codex run whose stop was already sent answers with
  that first outcome instead of a refusal that would read as "nothing was sent".
- **Smaller fixes:** the onboarding launcher no longer covers the project controls, onboarding scrolls inside
  narrow windows, and restoring saved drafts reads one consistent snapshot.
- **Schema 75 → 78** (migrations 76, 77 and the file with suffix 80; the schema version is the migration count).
  Fabric 0.3.1 does not migrate an existing database itself: it refuses a database below schema 78 and names the
  upgrade procedure ([release runbook, upgrading an existing database](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).
  Once a database is migrated to 78, Fabric 0.3.0 can no longer open it, so take the backup the procedure
  describes first.
- **Not done yet:** `agent.call` takes product tool names the agent contract's `capabilityName` pattern refuses
  (CO-193); a session Fabric starts cannot reach a product through Fabric (CO-194); no live end-to-end run with
  the Fabric Inbox app yet (CO-195); the knowledge base needs final released facts (CO-196); final-source workspace
  publication and acceptance remain open (CO-197).

## 0.3.0

- **Releases are built and signed in CI.** A `vX.Y.Z` tag on main runs `.github/workflows/release.yml`:
  after a member of `release-approvers` approves, the DMG is signed with the organization's CI Developer ID,
  notarized and stapled, then attested (Sigstore), listed in a GPG-signed `SHA256SUMS` and published as a
  prerelease of this repository while Fabric is an early preview. No signing identity or team id is written into the repository any more; a
  build made on a laptop is a debug build and is never published.
