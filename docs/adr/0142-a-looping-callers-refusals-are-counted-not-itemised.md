# ADR-0142 — A looping caller's refusals are counted, not itemised

**Status:** accepted · 2026-10-11 · CO-200 · Fabric 0.4.0 wave 1 (REQ-32 of the
[0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#req-table)) · amends
[ADR-0115](0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md) §5 ("one span per hop, refusals
included").

## Context

At the per-credential budget (120 calls a minute) one looping agent filled the private export's and the verified
restore's ceiling of 65,536 events (`PRIVATE_ARCHIVE_LIMITS.events`) in about nine hours: every refusal wrote one
`hub.call.forwarded@1`.

## Decision

1. A hop Fabric ends before forwarding — refused, failed having sent nothing, or cancelled before the forward — has
   its span only as the first of its (binding, error code) in a ten-minute window (`NOT_SENT_WINDOW_MS`). The codes
   are Fabric's own closed set, never a caller's strings.
2. The window's later ones are counted and journalled once as `hub.call.refusals.summarized@1` — the caller
   (binding id, agent id), the outcome, the error code, how many were suppressed, the first and the last time and the
   window — when the window closes, when the next one of the same key arrives, when the binding is revoked, or at
   quit. Its shape is checked at the door; it projects nothing.
3. A hop that was forwarded, or may have been, keeps one span each, unchanged.

## Consequences

- Refusals cost at most two events per binding and code per ten minutes: an hour of refusals at 120 a minute is 12
  events, not 7,200.
- A count not yet written when the process dies is lost; its window's first span is not.
- Successful forwards are still one event each, so a successful loop can still reach the ceiling in about nine hours;
  bounding that is a separate decision (the export ceiling, or the rate budget).
- `binding-revoked`, `idempotency-conflict` and `idempotency-capacity` refusals were never journalled, and still are
  not.

## Rejected

A single global counter (it loses who looped); sampling one in N (it loses the exact count); dropping refusals (it
loses the record).

## Evidence

`apps/desktop/src/main/hubCall.ts#notSentSpan`, `refuse_hub_write_rules` (migration
`20261011000082_write_rules_at_the_door.sql`), `apps/desktop/test/hub-call-window.test.mjs` (four planted defects
watched failing), `apps/desktop/test/write-rules-db.test.mjs`.
