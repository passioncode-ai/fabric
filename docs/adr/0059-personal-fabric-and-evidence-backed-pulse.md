# ADR-0059 — Personal Fabric and an evidence-backed pulse

**Status:** proposed · 2026-09-15. Product scope explicitly requested by the operator; the detailed architecture below is the design for review, not runtime admission.

## Context

After reviewing the priority-first wiki and interactive launch design, the operator requested a colourful personal avatar generated during onboarding, an activity chart, releases, heartbeat/live detail and an incremental architecture plan. [The source brief](../launch/pulse.md) preserves the independently verifiable requirements. [ADR-0057](0057-the-ceo-agent-is-named-fabric.md) keeps Fabric the CEO's name; [ADR-0040](0040-a-heartbeat-is-a-positive-signal-and-silence-is-ambiguous.md) keeps a heartbeat a sourced claim. Neither record is rewritten.

## Proposed implementation decision

1. An estate's durable Fabric identity owns versioned appearance. R0 offers deterministic coloured SVG variants from a stable seed; selection is an explicit revision-checked command. Provider replacement leaves identity and appearance intact. Optional AI-generated candidates use the same asset/selection boundary later.
2. Home keeps profile, attention Board and projects ahead of accumulated activity. A compact pulse opens detailed observations, day history and release receipts. Appearance is never an authority or liveness signal.
3. Activity, health and releases project the journal through existing scope/read/command contracts. Heartbeat, host observation, cycle schedule, publication and verified outcome remain separate. Unknown coverage never yields a fabricated zero or success.
4. UI pause buffers displayed events without stopping workers. Durable cursor replay and dedup are required before a real live claim. No transcript or private project context is sent to an avatar generator.
5. Build by capability: D01 producer/read contract map, identity, event projection spine, activity/releases, pulse/context, bounded review cycles, then expanded manager/AI appearance. Existing backlog and CO-165 retain every deferred item.

## Consequences and alternatives

This keeps the first useful return independent of image-model availability and a 24/7 host. The cost is an explicit asset revision and a shared projection boundary, plus reconciliation of historical event semantics before counting progress. A client-only random avatar per visit was rejected because it destroys recognition. A second live event store was rejected because it can disagree with the history the user is trying to recover. A green heartbeat as proof of success was rejected because a live process may be waiting, wrong or unverified.

The [detailed contract and execution packets](../architecture/personal-fabric-pulse.md) specify storage, commands, migration, invariants and acceptance. `scripts/product/pulse.mjs` implements a synthetic local design example only; it does not establish these backend guarantees.
