# ADR-0101 — The general development plan

**Status:** accepted.
**Date:** 2026-10-03. **Decided by:** the operator's instruction to fix one general development
plan for this repository that every participant follows and extends
([brief](../evidence/plans/2026-10-03-onboarding-and-plan.md), D9). **Extends**
[ADR-0044](0044-foundation-first-delivery-and-the-living-design-map.md) §1; replaces nothing.

## Context

Execution order already had one home — the backlog's
[Build order by layer](../evidence/backlog.md#build-order-by-layer) (ADR-0044) — but the direction
above it was spread across about five dated plan series (launch L-series, agent registry AR-*,
V1-M*, the first-slice plan, the launch overlays AD/OX/D01) with no single page that says, for a
newcomer or another agent, *what we are building next, in what order, and why*. A sixth file with its
own task rows would compete with the queue; no page at all leaves each contributor to reconstruct the
order from chat.

## Decision

1. **One page of direction, inside the backlog.** The section
   [General development plan](../evidence/backlog.md#general-development-plan) sits directly above
   the build order. It is a sequence of **lanes** (stages of the product, in order), each naming
   its outcome, its entry rule and the existing ids that deliver it. It creates **no status**: a
   row's status lives in its own register, and the plan links to it.
2. **Ids, never prose promises.** Every work item the plan names is an id that resolves to a row
   (`M*`, `CO-*`, `V1-M*`, `AR-*`, `L*`, `S*`, `AD*`, `OX-*`, `D01`, `N1`, or a new `P-*` row
   created in the plan's own table for work no register held). `scripts/check-plan-ids.mjs` fails
   on an id the repository cannot resolve, and was watched failing on a planted dangling id.
3. **Changing the plan** is an ordinary guarded edit under the agent-sync lease, in the same change
   as the work that moves it, with a living-map changelog entry (ADR-0044). Reordering lanes or
   adding one is a plan edit; reversing a recorded decision is a new ADR.
4. **The narrative** of why the lanes are in this order lives in the dated plan beside it
   (`docs/evidence/plans/2026-10-03-onboarding-and-plan.md#general-plan`); the cross-repository
   knowledge base links to the section rather than copying it.

## Consequences

- A newcomer reads three things: the vision, this plan, the build order — in that order.
- `docs/backlog-sources.json` declares the plan's `P-*` table so the common workspace backlog shows
  it beside every other register.
- The release gate the operator set on 2026-10-03 — three independent verification iterations
  before any release — is a lane entry rule here, not a convention.
