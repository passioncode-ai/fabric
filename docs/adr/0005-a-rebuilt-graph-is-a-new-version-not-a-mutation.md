# A rebuilt graph is a new version, not a mutation

- **Status:** Accepted
- **Consequences / affects:** `CONTEXT.md`, `docs/vision.md`, `supabase/migrations/`
- **Source:** run `2026-08-16-software-fabric` — stage-0 grill, question 2

The request asks for graphs that rebuild themselves when an agent hits a problem. The
operator's own adopted doctrine — wiki `concepts/graph-shaped-agent-work.md`,
2026-08-15 — says the opposite for anything that must be auditable: with a dynamic
graph "the executed shape is not the shape anyone drew, so *here is the design* and
*here is what happened* stop being the same document and every claim about the run
becomes unfalsifiable from outside."

**Decided:** both, by versioning. A graph is **immutable once running**. When a node
fails, or a dependency turns out not to hold, the CEO emits a **new graph version**
that references its predecessor and records the reason and the trigger; execution
moves to the new version. Nothing edits a running graph in place.

**What this buys:** every run still has one static shape to compare against, the
rebuild is itself an observation with a cause, and "why did this go a different way
than planned" is answerable by diffing two versions instead of being unanswerable.
The cost is storage for superseded versions, which is a rounding error against a
portfolio's worth of run history.

**Also settled here:** an edge exists only where data crosses it and is labelled with
what crosses. An edge whose payload cannot be named is deleted rather than kept for
tidiness — an unlabelled arrow looks orderly and buys a wait for nothing.
