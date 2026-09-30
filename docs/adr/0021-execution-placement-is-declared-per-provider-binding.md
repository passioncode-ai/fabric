# Execution placement is declared per provider binding

- **Status:** Accepted
- **Consequences / affects:** `docs/architecture/passioncode-platform.md`,
  `docs/architecture/federation.md`, `docs/evidence/backlog.md`, future provider and
  runner manifests
- **Source:** operator, 2026-08-29 — resolves CO-068

A personal Estate is a control, knowledge and authority boundary, not a promise that
its code runs in one place. Execution placement depends on the provider and is pinned
by each immutable provider-binding revision.

The placement vocabulary is:

1. **`local_harness`** — work runs in the coding agent or terminal the person already
   uses, such as Claude Code, Codex, OpenCode, Kilo, Pi, Goose or a DeepSeek/Kimi-based
   conforming client. The runner connects outward, advertises a passport and heartbeat,
   and needs no inbound port.
2. **`provider_managed`** — the provider executes inside its own agent/service, usually
   in that provider's cloud. Fabric sends only the scoped request and receives typed
   progress, artifacts and receipts.
3. **`estate_managed`** — the person or organization runs an admitted worker on its own
   machine or cloud account.
4. **`platform_managed`** — PassionCode.ai runs the admitted workload in an isolated
   estate-scoped execution environment. This profile engages the sandbox, custody and
   operational obligations that local/provider-managed execution does not.

A personal Estate may therefore use managed cloud memory and synchronization while all
effect execution remains local. Conversely, one Estate may bind different capabilities
to different placements.

Placement never changes silently. A move creates a new binding revision; active Runs
remain pinned to the old revision. An unavailable local runner leaves work queued or
waiting with a visible reason. It is not rerouted to a cloud executor unless that
executor was already an eligible, policy-equivalent placement in the binding.

Third-party code runs only where its admitted execution profile says it runs. Merely
discovering, installing or binding a provider does not authorize PassionCode.ai to
execute that code on platform infrastructure.

Still open at the next layer: CO-074 defines the runner passport/fixture matrix;
CO-045 chooses isolation technology for `platform_managed`; CO-069 defines vault
custody. Network topology, regional placement and local offline queue limits belong to
those implementation profiles, not to the Estate ontology.
