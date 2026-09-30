# ADR-0065 — Conversation-led work and explicit context bundles

**Status:** accepted target direction · 2026-09-26; native implementation remains open.
**Source:** operator requests in this iteration: remove duplicate project navigation; choose several project folders with a changeable primary; Board tickets open CEO sessions; planning is conversational; repeatable operations use scripts, hooks, gates, skills and flows, with bounded logging.
**Refines:** [ADR-0063](0063-ceo-first-discovery-and-explicit-continuation.md). It does not change Project ownership, provider interchangeability or the authority floor.

## Decision

1. Selected folders form primary and related Sources within one stable Project. They do not silently create nested Projects. The first selected source is primary; changing it preserves Project ID, decisions, tasks and existing Runs. Source knowledge grants no write authority.
2. Context is assembled at estate → Project → question → Task → Run boundaries. Each Run pins a revisioned packet: primary working source, related source index, purpose, allowed access, selected evidence, accepted decisions and exact task. Related content is loaded only as needed under its own read permission and token budget.
3. Each Board question has an addressable CEO conversation. Discussion yields a versioned proposed outcome, then a validated command and a receipt. Reading, closing the window or text saying “done” cannot resolve the question. Repeated application of the same proposal is idempotent. Work results return to the originating question.
4. Free conversation handles intent, ambiguity and creative alternatives. Repeatable changes follow named flows, versioned skills, deterministic scripts and validated commands. Hooks observe committed events; gates enforce schemas, permissions, revisions, preconditions and evidence. Natural-language output is neither authorization nor an execution receipt.
5. The UI exposes conversation, current state and necessary decisions. Plan/Board are projections of durable work, not forms the operator must manually maintain. Technical report controls are opt-in. The floating CEO retains persona, scoped conversation and evidence-backed statistics.
6. Redact or reject secrets before durable logs, summaries, telemetry or model context. Credentials use a secret store and opaque references. Never log hidden reasoning. Model token counts/costs are numeric telemetry; context budgeting prevents replaying full histories or all related repositories by default.

## Evidence and implementation boundary

The pre-change mockup at [319d036](https://github.com/passioncode-ai/fabric/tree/319d0369f399dd9cf06075331aee8251d7d6a5e5) had a single-source model, a manual Plan input and Board accept/defer buttons without a ticket conversation. This iteration changes target fixtures only. The [handoff and checks](../launch/context-board.md) names exact files and checks; [agent operation contract](../launch/agent-first-contract.md) specifies native obligations. Prototype redaction covers selected known formats only and does not certify native secret protection.

## Propagation / affects

- [Scenarios](../ux/scenarios.md): SCN-041/042/095; [flows](../ux/flows.md): FLW-25/55; [screens](../ux/screens.md): SCR-27/40/41/44.
- [Product model](../ux/product-model.json) and `scripts/product/first-release.mjs`: connected fixtures and source selection.
- [Strategy](../launch/first-release-strategy.md): FR-A/C/E/F/G native packets; CO-168 remains open.
- [Context glossary](../../CONTEXT.md): no new entity, hierarchy or wire/schema contract; Source remains a source of a Project. Names here are target presentation, not runtime schema additions.
