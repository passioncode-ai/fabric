# ADR-0041 — Insights carry a closed category, and only service categories ever leave the project

**Status:** accepted · 2026-09-06 · design in [`../architecture/retro-and-signals.md`](../architecture/retro-and-signals.md)

## Context

Retro insights (`finding` / `trap` in `memory_facts`) say what an insight *is*
but not what it is *about*. The operator wants insights about the tool itself —
agents, the harness, Fabric — swept across every project into one base,
anonymised, feeding Fabric's own product backlog; sending on by default,
switchable off, and carrying no leak risk because it binds to nothing. And the
retrospective gets a cycle: the CEO closes, updates, and raises to the Board.

## Decision

### 1. `category` is a closed vocabulary on `memory_facts`

`project` (default) · `agents` · `harness` · `fabric` · `process`. Closed with a
CHECK, because an open field grows four spellings of "fabric" in a week — the
same enumeration rule the harness applies to statuses. `kind` and `category` are
orthogonal: a trap about the harness is `kind=trap, category=harness`.

### 2. The anonymisation contract is enforced by ABSENCE, not policy

Only `agents` / `harness` / `fabric` are ever eligible for the cross-project
base. A `project` insight is **refused in the schema** — not stripped, not
redacted — because the essence of a project insight IS project data and no
redaction makes it safe.

What a `fabric_feedback` row carries: category, the claim after the M95
redaction pass plus identifier stripping (paths → basenames, UUIDs → `‹id›`,
emails/URLs → placeholders), the Fabric version, and a WEEK-coarse date.
**No estate id, no project id, no actor, no session — the columns do not exist.**
Anonymity that depends on nobody joining tables is a promise; anonymity by
absent columns is a property.

### 3. Default-on is defensible because of §2, and only because of it

The known failure of default-off telemetry is that the most useful feedback
never arrives. The known failure of default-on is a leak — and the leak here is
prevented structurally. The switch is one setting, journalled when flipped, and
the pending queue is VISIBLE on the harness screen: the operator can read every
row that would leave, delete any, or turn it off.

Two hops: estate-level collection ships now (and for this operator already IS
the product backlog feed); upstream transport **waits on an endpoint** and is
named as waiting, never half-built.

### 4. The retrospective is a cycle the CEO runs, and judgement is proposed

Mechanical, on the tick (scripts): merge exact duplicates (same category +
`about`), mirror service categories into `fabric_feedback`, count recurrences,
detect references to files/facts that no longer exist. Judgement — "is this trap
still true?" — is a **proposal** the operator confirms, because a retired insight
that was still true is worse than a stale one: the next agent re-learns it the
hard way. Retirement is supersession; nothing is silently deleted.

**A recurring trap (same `about`, N≥3) becomes a Board question of kind
`process`** — retro reaches the operator through the same ranked top-5 as
everything else, not through a separate ceremony.

### 5. The inbox is a view over the feed and the Board, not a third store

Two lanes split by one question — *does this need you?* "Needs you" is the
Board's slice and can never be marked read (attention.ts's rule); "happened" is
notable events, expandable, owing nothing. Every module's signals are already
journal events or derived obligations; a new notification store would be a second
copy of the truth.

### 6. Density is a standing principle; the review is a milestone

Primary information and primary controls visible; everything else behind a
disclosure; ONE disclosure primitive in the component set so screens fold the
same way. Customisable disclosures (per-operator settings screens) are
deliberately later. The sweep across every screen is M187, not this iteration.

### 7. Cycles get one estate-wide view

Every cadence — routine tick, chain advance, CEO hygiene, retro cycle, evening
letter, board review — with last run, next due, and health in the SAME five-state
vocabulary as agents (ADR-0040), because a cycle that silently stopped is a
stalled agent one level up.

## Consequences

- Service insights stop drowning in project memory; the sweep across projects is
  a query, and Fabric's product backlog gains a data feed.
- The CEO's retro tick is scripts plus proposals — no model required, consistent
  with ADR-0038/0039's line.
- The inbox and cycles view add ZERO new stores; both are views.
- M95's redaction gains a second caller, which is the argument that kept it a
  shared module.

## Refused

- **Redacting project insights into eligibility.** The essence is the data;
  refusal is the only safe transform.
- **Anonymity by policy** ("we store the id but do not use it"). Columns that do
  not exist cannot leak.
- **A separate retro ceremony.** The Board is the one queue the operator reads;
  a second queue is where retro goes to die.
- **A notification store.** A view over the journal and the Board, or it drifts.
- **Building customisable disclosures now.** Noted, designed later — the density
  principle comes first, the customisation after the review proves where it is
  needed.
