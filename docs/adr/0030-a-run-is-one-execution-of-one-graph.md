# ADR-0030 — A Run is one execution of one graph

**Status:** Accepted · **Date:** 2026-08-31 · **Source:** run `2026-08-31-iteration-ladder`,
accepting audit finding A8 · **Extends:** ADR-0005, ADR-0013, ADR-0022 · **Fires:** R-001

## Context

"Run" appears in nine of ten architecture documents and three ADRs pin machinery to it —
ADR-0013 ("each tick creates a new Run"), ADR-0022 (a Run pins its engine and workflow
build), ADR-0026 (`run.cancel`) — while its grain was never defined: a routine tick, a
graph execution, or a single node's execution were all readable. The schemas hold only
`runSummary`, a view. Cost, budget, cancellation and checkpointing all need one parent
object, and each implementer would have invented a different one.

## Decision

1. **A Run is one execution of one graph** — a routine tick or a goal-graph launch. It
   pins the project, configuration revision, routine (where one triggered it), graph
   version (ADR-0005), agent bindings and provider revisions resolved at start.
2. **Nodes are children of exactly one Run.** A node's cost, transcript, questions and
   typed result roll up to its Run; `run_id` and `node_id` are correlation fields on
   every journal event they produce.
3. **A Run's terminal state never mutates.** Continuation after a terminal state is a
   new Run linked to its predecessor — the same rule ADR-0005 gives graphs and A2A gives
   tasks, applied at the same grain `run.cancel` (ADR-0026) targets.

Cardinality changed by this record (Run 1—N Node, Routine 1—N Run, Run 1—1 graph
version), so **R-001 fires**: the propagation inventory is in the run's brief; the
glossary's Run entry is sharpened in the same change, and ADR-0013's tick wording,
`runSummary`'s view-only description and SCN-008 were checked consistent.

## Alternatives considered

- **Run = node execution** — rejected: multi-node chains would need an invented parent
  for budget and cancel, which is this object under another name.
- **Run = the routine's whole lifetime** — rejected: replay, pinning and "replacement
  affects future runs only" (CONTEXT.md) all assume per-execution grain.

## What would reverse this

Nothing observed; a durable-execution engine whose unit cannot map 1:1 onto this grain
would surface at the ADR-0022 fixture suite and would need its own record.
