# ADR-0051 — Provider accounts are optional; conversation continuity is verified

- **Status:** proposed, 2026-09-09; ready for design review, not runtime acceptance.
- **Source:** the operator's request to design it, following [Orca/cswap research](../audit/2026-09-09-provider-accounts.md).
- **ID:** reserved through agent-sync in run `r-90bf1cfd8`.

## Proposed choice

Keep system CLI login as the optional default. Managed accounts are scoped to the local
principal, device and execution runtime. Pin each new conversation explicitly. A default
change affects future launches; switching an existing conversation is its own fenced,
checkpointed, idempotent restart and resume operation. A new TaskRun is admitted with
new frozen configuration, preserving the open Task and verified native conversation.

Do not globally replace credentials to simulate a per-conversation choice. Do not equate
history files, terminal transcript or a successful spawn with native continuation.
Unsupported continuity offers a separately named context handoff into a new conversation.
No automatic account rotation when a quota is exhausted in the first slice.

## Why and alternatives

[The source study](../audit/2026-09-09-provider-accounts.md) distinguishes Orca's restart
and account-home bridge from cswap's global credential replacement and opt-in shared
history. Fabric's current quota reader can disagree with the launched profile. A global
swap is smaller but conflicts with two conversations choosing different accounts;
per-session copies of rotating auth create competing refresh owners. Isolated per-account
auth plus a provider-specific selected-conversation bridge fits the Project's continuity
and authority model, conditional on actual provider support.

A pure account selector without continuation would be a smaller initial delivery; the
packet sequence permits that partial capability but must label resume unsupported.
A universal cross-provider transcript transfer changes semantics and is outside this ADR.

## Consequences and review

Native resume needs provider/version/runtime capability receipts. It can remain unavailable
while optional account login and per-account usage ship. Old TaskRun step verification is
not carried into a new run automatically. S09's authority floor is a dependency, not a
claim that application sign-in is already implemented. Existing accepted vocabulary stands.

Review choice: default changes leave existing conversations pinned; an explicit switch
creates a new execution run while preserving the conversation, conditional on certified
resume. Full [proposed contract](../architecture/provider-accounts.md),
[scenarios](../ux/scenarios.md#scn-081-добавить-аккаунт-провайдера),
[delivery packets](../evidence/plans/2026-09-09-provider-accounts.md#packets).
