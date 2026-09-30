# The development pipeline is data the operator can edit, not code

- **Status:** Accepted
- **Consequences / affects:** `CONTEXT.md`, `supabase/migrations/`, `docs/evidence/backlog.md`
- **Source:** operator decision, 2026-08-19

All development in this estate is done by agents. The route that development takes — which
stages exist, which kind of agent holds each one, which skills that stage requires, and what
gate closes it — must be **editable by the operator**, including with skills the operator
wrote themselves.

If that route is expressed in code, every change to it is a release. If it is expressed as a
record, the operator changes it in the product and the change is auditable.

## What was decided

1. **`pipeline` is a first-class, versioned record.** A named sequence of stages, each stage
   naming the department that holds it, the skills it requires, and the gate that closes it.
2. **Editing a pipeline creates a new version**, pointing at its predecessor with a reason —
   the same rule ADR-0005 set for graphs, for the same reason: a run must be explicable by
   the pipeline that was in force when it ran, not by the one that exists now.
3. **A running graph pins its pipeline version.** An edit never reaches work already in
   flight.
4. **`skill` is a registry object, not a string in a prompt.** Skills carry a name, a source,
   a version and the departments allowed to use them. The eight members of the operator's own
   family register the same way an operator-written skill does — there is no privileged tier.
5. **A stage declares the skills it needs; the fabric provisions them before the node runs**,
   and a node whose skills cannot be provisioned fails at its gate rather than running
   underequipped.

## Why versioned rather than mutable

The failure this prevents is the one ADR-0005 already names in another shape: if the pipeline
can change under a running graph, *the route the work took* and *the route the product
describes* stop being the same document, and every claim about how something was built
becomes unfalsifiable from outside. A pipeline that cannot be reconstructed cannot be audited,
and an audit trail over an unknown route is decoration.

## What this does not decide

Whether the default pipeline shipped with the fabric is the operator's own `task-pipeline`
stage list, a reduced set, or something derived per department, is a stage-2 question — it
needs the module map before it can be answered honestly. Recorded as CO-026.
