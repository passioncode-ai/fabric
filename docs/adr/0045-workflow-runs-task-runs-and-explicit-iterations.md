# ADR-0045 — WorkflowRun, TaskRun and explicit iterations have different identities

**Status:** **accepted** · 2026-09-08 · under the operator's standing direction to decide
these calls against the vision and the architecture rather than raise them.
Proposed 2026-09-07 as an engineering baseline; accepted by the S10 run.
**Affected work:** S04, S05, S10, S15, M103, M188, M189, M190.

## Context

ADR-0030 defines Run as one graph execution; ADR-0042 defines it as a task/session
pair and assumes every loop iteration creates a session. The user requires a whole
plan and checkpoint history for every explicit iteration, and replaceable external
agents. These requirements cannot rely on an opaque provider session format.

Evidence: `CONTEXT.md#Run`,
`docs/adr/0030-a-run-is-one-execution-of-one-graph.md`,
`docs/adr/0042-a-run-is-the-unit-of-progress-and-every-graph-is-a-query.md`,
`packages/journal/src/index.ts#JournalEvent`,
`apps/desktop/src/main/pty.ts#PtyManager`, all read at `5051def`.

## Decision

1. Keep **WorkflowRun** for one execution of a pinned graph version. Existing wire
   `journal.run_id` retains that meaning. Do not turn old graph IDs into session IDs.
2. Introduce **TaskRun**, identified by a new `task_run_id`, allocated in the successful
   admission transaction for an existing unfinished task, before external spawn.
   Admission denial has a command receipt and no TaskRun. Failed spawn after admission
   is a terminal TaskRun with a proven `failed-to-spawn` reason.
3. Each **explicit task evaluation iteration** creates a new TaskRun with a fresh
   namespace of step claims. A retry of a tool or delivery is an Attempt inside the
   operation, not an iteration. Provider-internal model turns are not counted unless
   the provider explicitly emits the versioned Fabric iteration protocol.
4. Fabric session identity and opaque provider-native session reference are separate.
   Default local execution uses one new session per TaskRun. Reuse is admitted only
   when invocation-specific acknowledgement, trace correlation, cancellation and
   fencing are proven. A UI does not infer this from matching timestamps or prose.
5. Plan revisions are immutable. Step identity is
   `(task_run_id, plan_revision, step_id)`. Declared status remains a claim;
   independent observation and checkpoint verdict are separate fields.
6. A terminal Task stays terminal under `ladder.ts#LADDER`. A rerun of unfinished
   work may create another TaskRun; work after Task completion creates a new linked
   Task. WorkflowRun and TaskRun outcomes do not silently mark the Task `done`.
7. Graphs remain queries over durable event/relationship sources. SHOULD versions
   are DAGs; DID history can contain loops through distinct explicit executions.
   Unknown or missing telemetry appears as a coverage gap, not as an invented edge.

## Migration and compatibility

- Add event types/correlation fields in a versioned additive schema, plus rebuildable
  TaskRun/plan/step projections. Schema registration, projection and reader land together.
- Old events remain byte-identical. A legacy `(task_id, session_id)` can be displayed
  with a stable scoped synthetic legacy identity and `identity_quality=legacy_inferred`.
  Repeated ambiguous attachments do not receive guessed iteration numbers; show unknown.
- `run_id` continues to identify the graph. New `task_run_id` is never silently mapped
  into a field an older adapter interprets as graph execution.
- A running invocation pins contract/binding/plan revisions. Compatibility is negotiated
  before dispatch. Incompatible adapters remain on legacy telemetry with explicit limits.
- Wire schema in `fabric-agent-contract` must be versioned and its conformance cases
  pass before an external adapter uses the new identity. A host-only prototype cannot
  advertise this as a released compatibility guarantee.

## Rejected alternatives

- Keep the task/session pair as universal identity: cannot distinguish explicit iterations
  inside a reusable transport and leaves admission/spawn gaps.
- Count every tool/LLM retry as a run: resets the user's whole plan for an implementation
  detail and destroys comparable iteration history.
- Make every graph a mutable graph database: adds another truth store without a new need.

## Acceptance and propagation

The detailed algorithms and negative cases are in
[the engineering catalog](../architecture/engineering-specs.json), entries S04/S05/M188.
Required review: double launch, denied admission, admitted failed spawn, lost ack,
restart with unknown dispatch, two explicit iterations over one supported native session,
plan amendment, legacy attachments, terminal Task rerun and graph replay parity.

On acceptance update `CONTEXT.md`, the live architecture and affected UX contracts,
versioned schema/examples and external contract release together. Old ADRs remain
unchanged; the index will say this decision supersedes only the conflicting grain
clauses of ADR-0042 and clarifies the name in ADR-0030. Until acceptance, this is the
recommended target, not a retroactive claim about current runtime.


## Why it was accepted, 2026-09-08 (run `2026-09-08-s10-vocabulary`)

Three reasons, and the third is the one that made it not a preference.

1. **The contradiction is measurable and it sits on the load-bearing noun.**
   ADR-0030 defines Run as one execution of one graph; ADR-0042 defines it as a
   session bound to a task. `CONTEXT.md` carried only the first, so the glossary
   the product reasons from and half its own ADRs disagreed.
2. **The decision is additive on the wire.** `journal.run_id` keeps its meaning
   and old events stay byte-identical; `task_run_id` is new. The reversal cost is
   a column nobody reads, which is the cheapest kind of hard-to-reverse call.
3. **Without distinct identities, the vision's third claim is not expressible.**
   *Every claim the fabric makes carries its measurement* — and "which run" has
   no answer while one word means two things. A surface showing "run 3 of 3"
   cannot cite what it counted.

Accepted here does NOT mean implemented: `task_run_id`, the plan-step namespace
and the iteration protocol are `M188`'s work, and this ADR's own migration
section is the contract that work executes. What this acceptance changes today is
the vocabulary — propagated in the same run, per standing instruction R-001.
