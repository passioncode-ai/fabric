# The event journal is the spine, and every register is a projection

- **Status:** Accepted
- **Partially supersedes:** ADR-0002's disagreement gate only — its declared/observed
  split, its "who wrote it" line and its git mirror remain accepted
- **Consequences / affects:** future `supabase/migrations/`,
  `docs/architecture/project-workspaces.md` §9 (the durable event bus), `registry/`
  (the mirror becomes a generated projection once the store ships)
- **Source:** operator decision, 2026-08-27, accepting finding FND-01 of the
  architecture review of the same day

Append-only-with-supersession has been adopted five times, separately: graph versions
(ADR-0005), pipeline versions (ADR-0009), project configuration revisions (ADR-0013),
decisions (ADR-0001 onward, one file per record), and proposals with observations
(`work-producing-agents.md` §1). Built table-first, each of the five grows its own
mechanism and its own bugs — and none of them can answer "what happened" for anything
that predates its own introduction, because a journal cannot be retrofitted into
history that was never written down.

**Decided:**

1. **The first migration creates one append-only event journal** —
   `event(id, occurred_at, actor, kind, subject, payload, idempotency_key)` — and
   every state change in the fabric is an event before it is anything else.
2. **Every register is a projection of the journal**, rebuildable without changing
   identity or history: graph versions, pipeline versions, project configuration
   revisions, the board, the dashboard read models. Contract 0.1.0's memory invariant
   already states this rule for memory ("derived projections MUST be rebuildable");
   this record makes it hold fabric-wide.
3. **The git mirror of the declared layer is a projection too** — generated YAML,
   written only by the projector. ADR-0002's gate ("a gate fails when the two
   disagree") is retired: a projection cannot disagree with its source, so the gate
   has nothing left to catch. Everything else in ADR-0002 stands — declared versus
   observed is still decided by *who wrote it*, the mirror is still diffable and
   `git blame`-able, and observed data still never mirrors.
4. **The durable event bus of `project-workspaces.md` §9 is this journal**, with
   `LISTEN/NOTIFY` as an accelerator. That document already carries the sentence —
   "streams accelerate the view; the stored event log is the record" — this record
   applies it to the bus itself, so no second queue system ever holds its own truth.

**The price, named:** writing events instead of rows is a discipline the first
migration must set and every writer must keep, and projection rebuild is engineering
that plain tables would not need. It is paid because this is the one foundation in the
review's list that cannot be added later at any price — every other one degrades
gracefully when deferred; this one loses history permanently, from the first row that
bypasses it.
