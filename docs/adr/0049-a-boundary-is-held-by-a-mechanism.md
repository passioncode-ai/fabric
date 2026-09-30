# ADR-0049 — A boundary is held by a mechanism, not by a convention

**Status:** accepted · 2026-09-08 · operator direction: decide the open questions
against the vision and the architecture rather than raising them.

## Context

Three open questions arrived together, and they turn out to be one question.

1. `S02.acl` added an event trigger that strips `anon` rights from every new
   table. Keep database-level machinery, or revert to writing a `revoke` in each
   migration?
2. `CO-110`: the projector matches rows by a UUID taken from an event payload.
   Sweep it, and if so with what?
3. The dependency map points nine downstream nodes at the `S02` umbrella when
   what most of them actually need is `S02.store`.

The vision already answers them, in the claim it says would falsify it:

> **Autonomy is a property of the goal, bounded by the schema.** … Below all three
> sits a floor written in the database, not in a prompt … *Broken if:* an agent
> ever performs a floored action, or **the floor turns out to live in an
> instruction a model can reason its way around.**
> — [`docs/vision.md`](../vision.md) §"Three claims", claim 2

"Written in a migration by whoever remembers" is that instruction with a
different audience. It failed measurably three times in eight days, each time in
the same shape — the safe form was the longer form:

| Where | Held by | How it failed |
|---|---|---|
| application reads | remembering `.eq('estate_id', …)` | 87 of 116 queries omitted it while `estate_id` was already a column on 23 of 26 tables |
| table grants | remembering `revoke … from anon` per migration | six tables skipped it and were exposed in one environment and not the other |
| the projector | the caller having validated the id | 26 of 38 mutating statements matched on a bare uuid |

The third is the one that settles the argument, because it cannot be fixed by a
more careful caller at all. Under [ADR-0014](0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md) a
projection is DERIVED, and `rebuild_estate_projections(A)` replays estate A's
journal with **no writer present**. Proven before it was fixed:

```
estate B: task bbbb…ff is running
estate A: append task.abandoned@1 with payload {"id": "bbbb…ff"}
estate B: task bbbb…ff is cancelled, carrying A's reason
```

## Decision

**A boundary this product claims is held by something that cannot be omitted.**
Where the platform offers a mechanism, the mechanism is used; where it does not,
a gate refuses the omission; a convention is never the last line.

1. **The event trigger stays.** `deny_anon_on_new_tables` is a floor in the
   database, which is where claim 2 says a floor belongs. It kills inheritance
   rather than intent — it fires at `ddl_command_end`, so a deliberate later
   grant still wins — and it exists because the migration role was measured
   unable to make the inherited default uniform: it can alter neither another
   grantor's default privileges nor take that role.

2. **Every projector statement narrows by the event's estate.** 26 statements
   across eight functions gain `and estate_id = e.estate_id`; two subqueries gain
   it as well, because the write was already confined while the READ still
   crossed. A rebuild must be a function of one estate's events, and while an arm
   matches on a bare id it is a function of every estate's rows.

3. **Where no mechanism exists, a gate does.** `scripts/check-scope.mjs` refuses
   an application query and a projector statement that omit the predicate, naming
   file, function and line. A gate is weaker than a constraint and stronger than
   a convention: it cannot prevent, but it cannot be forgotten either.

4. **A dependency names its real prerequisite, not the umbrella that contains
   it.** [ADR-0044](0044-foundation-first-delivery-and-the-living-design-map.md)
   says to take the lowest READY foundation; pointing a node at a parent whose
   other parts it does not need invents a wait the plan then honours.

## Consequences

- One gate now covers both halves of the same boundary, and its message names
  the mechanism to use rather than the rule that was broken.
- `P26` proves the projector boundary against the live database, with two
  controls: the arm still moves the task it may, and rebuilding one estate leaves
  the other byte-identical. Watched failing with the predicate removed from the
  arm the probe exercises.
- Cost, stated: a database-level trigger is machinery a reader does not see in
  the migration that creates a table. It is discoverable (`\dy`), it is named
  after what it does, and `P21` checks the same property independently — the
  trigger prevents, the probe detects, and neither is the only line.
- **This is not a claim that the schema now refuses every cross-estate write.**
  A predicate is a statement in a function, not a constraint; it is enforced
  because every statement carries it and the gate refuses one that does not. A
  constraint-level version — composite identity plus composite foreign keys, as
  the `S02` card proposes — remains open and is not asserted here.

## What would falsify this

A mechanism that is routinely disabled to get work done, or a gate whose failures
are waived rather than fixed: at that point the mechanism has become a convention
with extra steps, and the honest response is to remove it rather than keep a
floor nobody stands on.
