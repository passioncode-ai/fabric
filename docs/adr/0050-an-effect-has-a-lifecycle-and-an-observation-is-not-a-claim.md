# ADR-0050 — An effect has a lifecycle, and an observation is not a claim

- **Status:** accepted
- **Date:** 2026-09-09
- **Supersedes:** nothing. Refines [ADR-0028](0028-one-effects-algebra-and-the-floor-lives-in-the-schema.md) decision 4.
- **Related:** [ADR-0014](0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md), [ADR-0023](0023-policy-is-an-embedded-decision-port-that-never-grants-on-uncertainty.md), [ADR-0049](0049-a-boundary-is-held-by-a-mechanism.md)

## Context

ADR-0028 gave the authority plane a decision receipt: `policy.decided@1` is appended
before the effect executes. It said nothing about what happens *after* — so the effect
itself has exactly two observable states in the tree today, permitted and executed, and
one of them is written on the strength of the caller saying so.

**Measured at `5051def`, before this ADR:**

- `agentSurface.ts#fabric_effect_request` calls `policy.decide(...)` and, on `allow`,
  immediately calls `policy.recordEffect(...)`. Between those two lines nothing happens.
  `recordEffect` appends `effect.executed@1` — rendered to the operator as *"an effect
  was carried out"* — and the tool answers the agent `Allowed once, for this target.`
  The act itself occurs afterwards, outside Fabric, and may never occur at all.
- `index.ts` (operator file overwrite) is honest by construction: it writes the file and
  records only `if (result.ok)`. The two paths disagree, and the dishonest one is the
  one carrying the higher risk.
- `effect_intents` has no state column. There is no value for *"the external act was
  started and we do not know how it ended"*, so a crash between the act and its receipt
  leaves no row — a completed, irreversible effect is indistinguishable from one that
  never happened.

The floor introduced in S03.boundary is real: a floored effect needs a live reservation,
enforced by a trigger. That floor guards *authorisation*. Nothing guards the claim that
the authorised thing was done.

## Decision

1. **An effect is a lifecycle, not a flag.** `effect_intents.state` is one of
   `reserved → dispatching → succeeded | failed_known | outcome_unknown`, plus
   `cancelled_before_dispatch` off `reserved`. The state is projected from events; no
   command writes it directly.

2. **`outcome_unknown` is not a failure and not a success.** It is what the estate
   records when the external act was started and its result was never observed. It is
   *unresolved*: reconciliation may replace it with evidence, and nothing else may.
   Reading it as either extreme is how a paid invoice gets paid twice, or a published
   post gets published twice. This is the same third answer `ReadEnvelope.partial`,
   `ToolOutcome.unknown` and `OpsOutcome.unknown` already keep.

3. **An OBSERVATION and a CLAIM are different events and only one of them can end an
   effect.** `effect.observed@1` carries structured evidence from the party that
   performed the act — Fabric itself for a local effect, a provider receipt for an
   external one — and may resolve the state. `effect.claimed@1` is what an agent says
   happened; it is recorded, it is attributed, and it *never* moves the state out of
   `outcome_unknown`. An agent that performs an act Fabric cannot see leaves an effect
   Fabric honestly does not know the outcome of.

4. **The dispatch fence is where the grant is spent, not the receipt.** A grant is
   consumed when the act is *started*, because after that point the estate cannot know
   whether it happened. Consuming at the receipt means a crash mid-act returns the grant
   to `available`, and the retry is a second authorisation for what may already be one
   effect. Adapter-level retries reuse the same effect idempotency key and do not consume
   again — one grant authorises one *logical* effect.

5. **The rule is a schema constraint, not a convention.** `state = 'succeeded'` requires
   an `effect_attempts` row carrying an observation reference. A caller that appends a
   claim and sets success is refused by the database, exactly as a floored effect without
   a live reservation is. ADR-0049's form: the boundary is held by the mechanism that
   cannot be forgotten.

6. **History is classified, never rewritten.** Existing `effect.executed@1` events remain
   in the journal unchanged (ADR-0014). Their projected rows carry
   `provenance = 'legacy_unverified'`: they are a claim by the old permission path, and
   they are not promoted to `succeeded` by this migration. Displaying them as verified
   would launder exactly the defect this ADR names.

## Alternatives considered

- **Keep one `executed` event and add a `verified` boolean.** Rejected: the boolean
  would default to something, and whichever default is chosen is wrong for half the
  callers. Two events cannot be defaulted into each other.
- **Let the agent's report resolve the effect when the agent is trusted.** Rejected: the
  trust tier says how far an implementation is trusted to *act*, not how far its prose is
  trusted as *evidence*. A trusted agent that is wrong produces a receipt that is wrong
  and looks identical to one that is right.
- **Refuse the agent path entirely until an adapter can observe it.** Rejected: it would
  remove the operator's ability to authorise an act at all until every provider is
  wired, and an agent blocked by a floor with no route invents a way around it
  (M177's finding). A permit with an honest unknown outcome is better than no permit.

## What would reverse this

An execution plane where every effect is performed by an adapter Fabric owns, so that
`outcome_unknown` becomes reachable only by crash rather than by design. At that point
`effect.claimed@1` would have no callers and could be retired — but the state would stay,
because the crash window does not close.
