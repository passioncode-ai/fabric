# ADR-0036 — The CEO settles what it can cite, trust is ADR-0004's autonomy on a different subject, and a project's priority is declared

**Status:** accepted · 2026-09-05 · extends [ADR-0035](0035-the-board-is-a-query-and-the-ceo-is-a-mechanism-before-it-is-an-agent.md) · design in [`../architecture/board-and-ceo.md`](../architecture/board-and-ceo.md)

## Context

ADR-0035 left five questions for the operator. All five were answered, and three
of the answers changed the design:

- an answer that changes must be **assessed for criticality**, and critical
  changes go to the Board for approval;
- any session may ask, but **the CEO sets the priority** and keeps the board free
  of stale, unclosed and irrelevant questions;
- the top five is **the top five by priority**, with no floor beneath it;
- **the CEO must answer itself** — only what it judges worth discussing reaches
  the operator;
- projects carry a **priority scale that is tunable and dynamic**, and work in a
  high-priority project ranks higher.

Two of those overrule recommendations made in ADR-0035, and both overrulings are
correct for one reason: *a confirmation step the operator must press every day is
not a safety feature, it is a tax that trains them to press without reading.*

The hard part is that "answer itself" and "judge what is worth discussing" are
judgements, and **there is no model provider**. This ADR is how those become
executable without one, and where the boundary is drawn honestly.

## Decision

### 1. The CEO settles only what it can CITE, and that is the floor rather than a limitation

A question may carry `about` — a stable key naming its subject (`db.version`,
`deploy.window`, `tier.free.export`). A decision fact recorded with the same key
answers it **mechanically**. That is the whole mechanism by which a CEO with no
model answers anything at all.

It also builds the right incentive: an agent that names what it is asking about
gets a faster answer, because the estate can match it.

**A CEO answer with no basis is an invented answer.** `settled_basis` names the
fact or the prior question it reused, and a settlement without one is refused at
every trust level. Without a model this makes most questions un-settleable, and
that is the correct shape — not a gap to paper over.

### 2. Trust is ADR-0004's autonomy on a different subject, not a second scale

`goals.autonomy` governs what an agent may **do**. `ceo_trust` governs what the
CEO may **settle on the operator's behalf**. Building a second, differently
shaped trust concept beside the first would be the "two copies of a rule" failure
this repository keeps finding, so it borrows all three of ADR-0004's parts:

1. **an ordinal level with inheritance and a ceiling** — `ask` → `cited` →
   `routine` → `proposing`, set on the estate, overridable per project, and a
   project may never exceed the estate, exactly as a sub-goal may never exceed
   its parent's autonomy;
2. **a floor that does not move at any level**;
3. **a grant is the only way through the floor.**

The default is `cited`, not `ask`: a CEO that cannot answer "what is the staging
URL" from a fact it can point at is making the operator do clerical work to prove
a point.

### 3. The floor: four things the CEO may never settle

Refused in the schema, for ADR-0004's reason — *a constraint that refuses the
write does not have an argument.*

1. anything whose answer **reverses a decision the operator authored**;
2. anything whose answer **authorises what ADR-0004's floor refuses** — money,
   deletion, outward publication under the operator's name; settling a question
   *is* authorising its answer;
3. anything above the **criticality threshold**;
4. anything the CEO **cannot cite a basis for**.

A question that hits the floor is not refused. It goes to the Board, which is
where it was always going.

### 4. Safety is citation, visibility and reversal — not confirmation

Every settlement is **cited** (`settled_basis`), **visible** (a standing "settled
by the CEO" list beside the Board, not a notification that scrolls past) and
**reversible** (one press; the override is a decision superseding the CEO's, and
`decisions.ts` already models that).

A superseded CEO answer is **evidence about the trust level**. That is how the
level gets tuned from experience rather than from feeling, and it is why the
override must be a record rather than an edit.

### 5. A project's priority is DECLARED, and pressure is OBSERVED beside it

ADR-0002's rule applied to attention: declared and observed data are kept apart.

- **Tier** — `critical` · `active` · `steady` · `paused` — is the operator's
  claim, set explicitly and **never mutated by the system**.
- **Pressure** — blocked tasks, the age of the oldest open question, a goal due
  within the week, recent activity — is measured, capped, and added.

The obvious design is to let a busy project promote itself, and it is wrong: the
moment the system edits the operator's declaration, "what did you say this was"
stops being answerable, and the disagreement between claim and world — the
interesting signal — disappears because it has been silently resolved.

So the Board says both: *"you called this `steady`; it has 4 blocked tasks and a
goal due Friday."* That sentence is a prompt to re-declare. A tier that moved by
itself would have produced no sentence.

Pressure is **capped** so that it can lift a `steady` project above an idle
`active` one and can never lift it above `critical`. Attention follows evidence;
it does not overrule the operator.

### 6. The priority is assigned by the CEO and stored; the Board's order is not

The asker supplies evidence — what it blocks, why, what it is about — and never a
number. A queue where the shouting is done by whoever is asking rewards shouting.

The question's priority is **stored** with the components that produced it,
because an actor assigns it and because the model tier will later override it
with a recorded reason. The Board's **order** is still computed at read time,
because the derived half has no assigner. This is ADR-0035's authored/derived
distinction one layer along.

### 7. A decision that changes is scored, and the operator's own word is held

```
criticality = 40 × (the decision it replaces was authored by a PERSON)
            + 30 × (it governs an effect class that needs a grant)
            + 20 × (what it governs is already released or published)
            + min(5 × dependent_tasks_and_goals, 20)
            + project_effective_weight
```

Above the threshold it becomes an `approval` question carrying the original, the
proposed replacement and the components. The first term means any change to a
decision the operator personally made scores 40 before anything else is counted,
and the floor in §3 puts it beyond the CEO regardless of the total.

A decision the **CEO** made carries no such term. The estate may revise its own
reasoning freely; only the operator's word is held.

## Consequences

- **Weights are tunable and that is a risk taken deliberately.** A knob nobody
  tunes silently changes the board. The mitigation is not to forbid tuning but to
  make it legible: every Board item shows its components, so a mis-set weight
  produces an order the operator can see is wrong, with the number that made it
  wrong.
- **The top five has no floor.** It shows what is there. The honest failure mode
  — something waiting forever at rank six — is made *measurable* instead:
  "open, and never shown since the last review" raises its age weight and appears
  as such on the full board.
- **Per-project trust cannot exceed the estate's**, so raising trust everywhere
  is one deliberate act rather than four quiet ones in the projects nobody
  watches.
- **Most questions are un-settleable today.** With no model the CEO answers only
  what carries a matching key. That is visible in the numbers rather than hidden:
  the "settled by the CEO" list will be short, and its shortness is the honest
  measure of how much a model would add.
- Three build steps are added — **M156** (priority and trust), **M157** (CEO
  settlement), **M158** (criticality and approval) — and M156 moves ahead of the
  priority function, because the function reads the project weight.

## Refused

- **A second trust scale.** `goals.autonomy` already has the shape; a parallel
  one would drift, and the copy that drifts is always the one nobody is reading.
- **A tier that promotes itself.** It destroys the claim-versus-observation
  signal that makes the tier worth having.
- **Confirmation as the safety mechanism.** A daily press is a tax that trains
  the operator not to read. Citation, visibility and reversal do the work.
- **Uncapped pressure.** An "attention economy" in which the loudest project wins
  is the thing a declared tier exists to prevent.
- **A CEO answer without a basis, at any trust level.** This is the floor, and it
  is the reason the rest can be trusted.
