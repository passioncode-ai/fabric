# ADR-0044 — Foundations determine delivery order; the living map closes each iteration

**Status:** accepted · 2026-09-07 · operator direction, restated in this iteration.

## Context

The operator asks for one prioritised backlog, an accessible retained audit, and an
updated design map with precise review links and a short retrospective after each
iteration. The rule already existed in `CLAUDE.md`, but the audit was left outside
the living map. The old build order still scheduled M97, M196 and M197 even though
their milestone rows recorded delivery. Evidence is retained in the
[audit and merged proposal](../audit/2026-09-07-merged-execution-plan.md), source
`153b4f029e626230d465d5d21d02fb8c9de5fadf`.

## Decision

1. The delivery queue has one home: [backlog](../evidence/backlog.md#build-order-by-layer).
   Order is dependency readiness, then integrity/authority risk, then the consumer
   a foundation enables. Effort is a tie-breaker within comparable outcomes; no
   unmeasured numerical business benefit is asserted. A refactor is not a prerequisite
   solely because its file is large. Fixes to loss of user work are foundation work.
2. Preserve all existing M/CO ids. CO-108 files the audit delta as named S01–S15
   subitems with existing owners, not fifteen competing milestone rows. Done items
   remain receipts, not scheduled work. Activation gates are separate from the
   implementation of a safe local/read-only subset.
3. [AGENTS.md](../../AGENTS.md#iteration-contract) is the common entry point for the
   operator's iteration contract. The stable [design map](../reports/map.html)
   derives from scenarios, screens, architecture and backlog. Its new top changelog
   entry has precise affected anchors, actual changes, remaining work and review
   instructions. Final delivery links those anchors and includes a 3–6-line retro.
4. Audit snapshots retain their source revision and evidence. The
   [audit index](../audit/README.md) is the discoverable entry point; the map links
   the specific report. Snapshot publication does not mark its proposed fixes shipped.
5. The map source/link gate runs with documentation CI. It catches changed input
   bytes, absent targets and duplicate/missing anchors. It cannot prove that the
   map faithfully describes the change; review remains necessary.

## Consequences and boundaries

- The audit's graph, manager, privacy and Run contracts remain implementation proposals
  where they amend accepted ADRs. This decision approves their place in the queue,
  not a silent rewrite of ADR-0030, ADR-0041, ADR-0042 or ADR-0043.
- Alignment: the queue serves durable Project authority, history and independently
  verified outcomes in [vision principles 1–5](../ux/vision.md); replaceable agents
  remain behind the same project contracts.
- Affects: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/DOCMAP.md`, backlog,
  carry-over, verification, retrospective, living map, audit index and documentation CI.
  No domain entity, cardinality or product runtime changes in this iteration.
