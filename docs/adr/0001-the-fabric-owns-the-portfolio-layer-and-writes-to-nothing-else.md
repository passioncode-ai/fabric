# The fabric owns the portfolio layer and writes to nothing else

- **Status:** Accepted
- **Consequences / affects:** `docs/vision.md`, `CONTEXT.md`, `registry/domains.yaml`
- **Source:** run `2026-08-16-software-fabric` — stage-0 grill, question 1

The operator already runs four things that overlap parts of this request:
a personal-assistant system holds an agent roster and scheduled routines, Linear holds a
backlog, `task-pipeline` runs the goal→spec→plan→build cycle, and `agent-sync`
coordinates concurrent agents. Building without a boundary would make the fabric a
fifth source of truth — the failure the operator's own wiki doctrine names as worse
than having none.

**Decided:** the fabric owns the *portfolio* layer — the asset registry, the goal
graph, the agent roster, the CEO — and has its own task store. The personal-assistant
system keeps the *personal* layer (inbox, calendar, people, digests) and its Linear backlog;
the fabric neither reads nor writes either. Linear is not wired in at all.

**Why, measured rather than assumed:** the personal-assistant system's project memory holds two
files against roughly sixty projects, and the operator's Linear team holds ten projects of
which five are `canceled` — including the live flagship product, and another
project's website repository, which committed on the day of this measurement. Neither
register grew into a portfolio registry, and both are already wrong about the estate.
