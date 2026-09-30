# ADR-0027 — The Event Journal orders per estate, replays from the table, and projects in the append transaction

**Status:** Accepted · **Date:** 2026-08-31 · **Source:** run `2026-08-31-iteration-ladder`,
accepting audit finding A1 of 2026-08-30 · **Extends:** ADR-0014 · **Amends:**
`federation.md` §1/§3 wording and `project-workspaces.md` §9

## Context

ADR-0014 made the journal the spine and every register a projection, and ADR-0022 and
ADR-0026 lean on it — but the journal itself had no contract: no ordering scope, no
envelope, no evolution rule, and no answer to the dual-write question the
`project-workspaces.md` §9 "durable event bus" quietly introduced. Two external facts
force the contract before migration 1 rather than after it: Postgres sequences leave
gaps and commit out of issue order, so "replay from the last id you saw" over a bare
sequence silently skips events; and Supabase Realtime is at-most-once with replay by
timestamp, so it cannot be the record. The first migration freezes this shape —
ADR-0014's own words are "cannot be added later at any price".

## Decision

1. **Order is per estate, and it is gapless.** Every event carries `(estate_id, seq)`;
   `seq` is assigned at commit inside one `append_event(...)` database function holding a
   per-estate advisory lock. That function is the only writer in the entire codebase.
2. **Consumers replay from the journal table** — `WHERE estate_id = ? AND seq > ?`.
   Realtime is a wake-up signal only; a reconnecting client reads the table, never the
   stream. The feed is a view over the durable trace, never the record.
3. **v1 projections apply synchronously in the append transaction.** Projectors are
   SQL functions registered beside the event types; a failing projector rolls the append
   back rather than diverging silently. There is no bus, so there is no dual-write. Every
   projection also implements `rebuild()` from replay, and a fixture that proves
   `rebuild() == current state` is part of the slice that introduces it.
4. **No partitioning in v1.** The `(estate, month)` partitioning named in
   `federation.md` is deferred: partitioned tables cannot enforce a global unique
   `(estate_id, seq)` declaratively, and at v1 volume the management cost buys nothing.
   Revisit at a measured threshold, not a date.
5. **The envelope is Fabric's own minimal struct**: `estate_id, seq, type, schema_rev,
   actor {kind, id}, occurred_at, project_id?, run_id?, node_id?, payload`. CloudEvents
   remains a boundary mapping for a future external consumer (CO-078), never the internal
   shape.
6. **Types are versioned as `noun.verb@N`.** An additive field bumps `schema_rev`; a
   change of meaning is a new `@N+1` with an upcaster registered beside the projections.
   The journal itself is append-only at the database level: `UPDATE` and `DELETE` are
   revoked in migration 1.

## Alternatives considered

- **Realtime as the delivery mechanism** — rejected: at-most-once, no queue for
  disconnected clients, replay by timestamp with a 25-message fetch cap.
- **One global sequence** — rejected: couples estates on every write and makes the
  later per-estate move (federation.md §9 "an estate needs its own") a data migration
  instead of a filter.
- **Async projectors behind an outbox from day one** — deferred, not rejected: the
  contract's replay semantics make the move an implementation swap when a projector's
  measured cost demands it.

## What would reverse this

A measured projector latency that holds the append lock past tens of milliseconds at
real volume moves that projection to an async consumer replaying from the table — the
contract survives; only clause 3's "synchronous" narrows to the cheap projections. A
second store for ordering (Kafka-class) requires a new record and pays ADR-0002's
single-store price out loud.
