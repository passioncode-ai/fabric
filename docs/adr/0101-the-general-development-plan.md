# ADR-0101 — The general development plan

**Status:** accepted.
**Date:** 2026-10-03. **Decided by:** the operator's instruction to fix one general development
plan for this repository that every participant follows and extends
([brief](../evidence/plans/2026-10-03-onboarding-and-plan.md), D9). **Amends**
[ADR-0044](0044-foundation-first-delivery-and-the-living-design-map.md) §1: the "one home of the
delivery queue" becomes two pages with one job each — the plan says *what next* (its lanes and the
Now/Next line), the build order schedules the batches it names (amended 2026-10-03 after verification
iteration 2, which found the original "replaces nothing" untrue).

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
   (`M*`, `CO-*`, `V1-M*`, `AR-*`, `FR-A…G`, `MEM-P*`, `F*` batches, `L*`, `S*`, `AD*`, `OX-*`,
   `D01`, `N1`, or a `P-*` row of the plan's own table for work no register held — a `P-*` id resolves
   only there, since `P-01…P-06` are also personas). `scripts/check-plan-ids.mjs` fails on an id the
   repository cannot resolve, an id of an unknown form, a lane that names no work, and a lane that
   schedules work its own register calls finished (the closing words the workspace's
   `normalizeStatus` knows, an adoption packet's `Status:` line or receipt); each was watched failing.
3. **Inside a lane the order is that register's own** — the strategy table for FR, the packets'
   prerequisites for AD, the registry plan for AR, the memory plan's graph for MEM-P. An entry rule
   restates the register's prerequisite; it never adds a gate the register does not have.
4. **Changing the plan** is an ordinary guarded edit under the agent-sync lease, in the same change
   as the work that moves it, with a living-map changelog entry (ADR-0044). Reordering lanes or
   adding one is a plan edit; reversing a recorded decision is a new ADR.
5. **The narrative** of why the lanes are in this order lives in the dated plan beside it
   (`docs/evidence/plans/2026-10-03-onboarding-and-plan.md#general-plan`); the cross-repository
   knowledge base links to the section rather than copying it.

## Consequences

- A newcomer reads three things: the vision, this plan, the build order — in that order.
- `docs/backlog-sources.json` declares the plan's `P-*` table so the common workspace backlog shows
  it beside every other register.
- The release gate the operator set on 2026-10-03 — three independent verification iterations
  before any release, each closed with no blocking finding open — is enforced by
  `scripts/release-mac.mjs` (`scripts/lib/release-gate.mjs`), not left to convention.
