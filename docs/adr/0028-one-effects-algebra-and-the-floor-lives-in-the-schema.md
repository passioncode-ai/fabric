# ADR-0028 — One effects algebra: every ceiling composes by minimum, and the floor lives in the schema

**Status:** Accepted · **Date:** 2026-08-31 · **Source:** run `2026-08-31-iteration-ladder`,
accepting audit finding A2 · **Extends:** ADR-0004, ADR-0007, ADR-0023 · **Narrows:** CO-059

## Context

Six permission vocabularies had grown without a map — `autonomy_level` on the goal
(ADR-0004), the floor (ADR-0004), grants, `accessCeiling` on connection bindings,
provider trust tiers, and execution placement (ADR-0021) — and CO-059 records the cost:
"what `accessCeiling: effect` means under `autonomy: safe` is defined nowhere". Worse,
enforcement had two candidate homes: ADR-0004 puts the floor in the database where
raising it is a migration, while ADR-0023's policy bundles are signed artifacts a
control plane ships — two change-control costs for one boundary, unreconciled. ADR-0007
had already ruled "there is no second policy object"; the Cedar port risked becoming one.

## Decision

1. **Each vocabulary answers exactly one question, and none substitutes for another:**

   | Vocabulary | Carrier | Question it answers |
   |---|---|---|
   | floor | estate schema (constraints) | what is never automatic |
   | grant | named, expiring row | which single exception is open |
   | `autonomy_level` | goal | how much freedom this outcome gets |
   | `accessCeiling` (read/draft/effect) | connection binding | what this external resource may be used for |
   | trust tier | provider revision | how far the implementation is trusted |
   | placement | provider binding | where execution physically runs |

2. **Composition is minimum.** An effect is allowed iff it is ≤ the minimum of every
   applicable ceiling. The floor is absolute: `floor_class ∈ {money, deletion,
   publication}` requires a live, unexpired, matching grant — and that requirement is a
   database constraint (`effect_intents.floored_needs_grant`), so code that bypasses the
   policy module still hits the schema.
3. **The floor's home is the schema; the policy port sits above it.** ADR-0023's
   evaluator receives `autonomy_level`, ceilings and grant state as *context* and may
   forbid more than the schema does; it can never permit past it. Raising the floor
   remains a migration (ADR-0004 confirmed); shipping a policy bundle is not a floor
   change. This resolves the ADR-0007 tension: autonomy has one definition — the goal
   field — and the decision port consumes it rather than defining a second one.
4. **A decision receipt precedes the effect.** `policy.decided@1` is appended to the
   journal before the effect executes, carrying the verdict, the inputs' revisions and
   the grant consumed. `indeterminate` never grants, exactly as ADR-0023 states.
5. **The provider trust vocabulary is the contract's** — `untrusted / verified /
   admitted / privileged` (`fabric-agent-contract` registry). The `core / verified /
   user` table in `agent-composition.md` §8 reads as historical; ADR-0015's mandatory
   canary applies regardless of tier.

## Alternatives considered

- **Floor as Cedar forbid-policies** — rejected: a signed bundle is easier to ship than
  a migration, which is exactly the property the floor must not have (ADR-0004's
  argument survives contact with ADR-0023).
- **One merged "permission level" enum** — rejected: the six answer different questions
  for different carriers; merging them re-creates CO-059 one abstraction lower.

## What would reverse this

A hosted deployment whose operators cannot run migrations would need a floor-change
path that is not DDL; that record must state who signs it and why a bundle becomes
un-reasonable-around. Until then, minimum-composition plus schema-floor is the algebra
every module implements.
