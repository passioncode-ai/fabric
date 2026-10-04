# Future COM-04/07 local lifecycle packets

Entry: [RPT fabric/2026-10-04-local-agent-lifecycle](../reports/2026-10-04-local-agent-lifecycle/README.md).
This is a dated research input from Fabric source `95e942212f6cc2bdc7f7f274fbc93449c27f0457`.
Canonical COM plan, task status, root architecture decisions and dispatch authority remain in
their existing owner sources. Proposed operation labels are not existing APIs.

Completed: official current Claude/Codex hook, session, scheduler and app-server research;
exact installed CLI help/offline schema capture; version-scoped primary developer thread review;
seven [future packets](../reports/2026-10-04-local-agent-lifecycle/packets/packets.json) and 33
[designed acceptance vectors](../reports/2026-10-04-local-agent-lifecycle/packets/negative-cases.json).
Local commands never invoked a model, app, account reader, session inventory, live board or server.
Artifact checker tests are not execution of the future production negative cases.

Existing owners: [Adapter issue 31](https://github.com/passioncode-ai/fabric-agent-adapter/issues/31)
at source `907acb286abe55c627bfeb4500906b76d0284e81`, and
[Switchboard issue 36](https://github.com/passioncode-ai/fabric-switchboard/issues/36)
at `5e275caf50436f6a95eabad9c8e16bedade1ffe5`. No duplicate issues or comments created.
Shared module context is the [preceding ten COM-02/03 packets](2026-10-04-project-comms-implementation-packets.md)
and [architecture report](../reports/2026-10-04-project-communication-architecture/README.md).

Open decisions for root COM-01: Adapter currently declares no background footprint; hooks/
resident renewal require explicit owner lifecycle adoption. Claude session polling cannot
guarantee the proposed 20-second renewal. Decide helper presence versus model attention,
timeouts/freshness, trusted-definition/managed-policy handling and optional channel negotiation.
Startup API-not-ready means deferred catch-up, never dropped message or fake ACK. Neither CLI
version nor static schema proves Desktop behavior; app scope/source/version receipts remain
required. SessionEnd cannot prove crash handling or instant availability.

Exact next task: after hub convergence, root settles those normative boundaries and prerequisites;
Adapter issue 31 refreshes its source, reads current owner policy and authors watched-red fixtures
before a provider-neutral helper. Then qualify exact current Claude and Codex sessions separately,
with actual permitted tools, explicit enrollment and request ACK, before neutral crash replacement.
Switchboard issue 36 supplies source-qualified owned-launch provenance; Desktop takeover remains
separate. Accepted/begun effects stay unknown until authorized reconciliation, not automatic resend.

Checks and limits: [verification.json](../reports/2026-10-04-local-agent-lifecycle/raw/verification.json).
Root alone integrates map/merge-log/adoption notes and wiki report index. This branch authors only
unguarded report/handoff files, with no lease acquired or outstanding. No canonical/source-owner
activation, shared SQL/configuration change, release approval or all-session ACK claim.

Delivery is a normal pushed research branch; its exact SHA is returned to root and verified
against origin. It is not merge, runtime acceptance, installation or publication of a COM feature.
