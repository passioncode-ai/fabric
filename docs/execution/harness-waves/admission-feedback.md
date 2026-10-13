# CO-282 — admission and feedback contract proposal

**SPECIFICATION, not a running scheduler.** Owner: Fabric harness; task-pipeline
supplies eligible work and evidence requirements. Protocol changes belong to
fabric-agent-contract. Service lifetime belongs to the lifecycle broker;
measurements and lesson quality belong to Observatory.

This is N-006's design output under the
[execution plan](../../evidence/plans/2026-10-13-harness-waves.md). Completing this
document does not establish REQ-009 runtime acceptance. Upstream boundaries and
delivery dispositions are in [owner packets](owner-packets.md).

## One admission decision

A runnable graph node is eligible, not authorized or admitted. The installed
pipeline's [work-graph contract](https://github.com/ssheleg/task-pipeline/blob/52fa75d/plugins/task-pipeline/skills/task-pipeline/references/work-graph.md#L119)
explicitly separates the frontier from scheduling. The proposed admission check
combines:

- current input/contract revisions;
- exclusive mutable scope and a live claim/fence;
- applicable authority and provider limits;
- host capabilities required by this task;
- available worker, memory, CPU, disk and provider capacity.

Builders, reviewers and tests draw from one pool. A review of module A may overlap
building independent module B. A seam check waits only for that seam's producers.
Queue aging prevents cheap work from indefinitely starving required expensive work.
An eligible item still must satisfy its safety and authority preconditions when aged.

This run's declared limits are three workers plus root and one expensive-check
slot. These are session operating limits, not a machine-wide enforced scheduler
or universal defaults. Admission beyond this run requires the owning runtime's
implementation and receipts. Recheck disk availability before disk-heavy work.

## Admission receipt and lifecycle

Proposed receipt fields: task/node, candidate/input digests, owner, attempt/fence,
resource class, reservation ID, start/deadline, cancellation target and resume
point. Keep requested, reserved and observed usage separate. Do not put provider
secrets or lease tokens into public receipts.

Proposed states: eligible → reserved → running → completed/released.
Failed, expired and cancelled attempts retain their receipts. Recovery creates a
new fence; the old worker cannot publish a current result. Release a reservation
exactly once, including failure paths. Account for nested children so they do not
create an unmetered second pool. A reservation is not a spend grant or file lease.

Reservation cannot by itself prove that a process was launched or stopped.
Reconcile observed process/session identity before reclaiming capacity after an
uncertain stop; never kill a foreign process to make the accounting balance.

## Waiting without holding execution capacity

A watcher records owner, condition, deadline, next check, authorized next action,
idempotency key, cancellation and durable resume point. Release execution slots
while waiting; keep only the ownership needed to prevent contradictory work.
On wake, recheck candidate, inputs, lease and authority. Reconcile an uncertain
external effect before retrying. An unavailable board is a recorded dependency,
not an infinite polling loop.

A watcher can schedule an authorized next action; it cannot convert silence or
elapsed time into approval. Shared event-driven watches are preferable when the
runtime supports them. Otherwise use bounded polling at the pace the condition
changes, with a clear owner and cleanup path.

## Feedback at dispatch and completion

At dispatch, retrieve bounded relevant lessons with revision, applicability,
confidence and adoption state. Record why each was selected or rejected. At
completion, record symptom, cause, correction and positive/negative evidence.
Preserve hypotheses, negative outcomes and failed attempts.

**Found** means retrieval succeeded. **Applied** means the lesson changed an
identified decision or action. **Helped** requires an outcome comparison;
retrieval or retrospective counts alone prove nothing.

Confidence never grants authority. A policy change requires the owning decision
record and compatible scope/version. Superseded lessons remain historical. A
repeated record from the same origin is not independent corroboration. The
[owner lesson packet](owner-packets.md#pipeline-and-observatory-lessons-remain-evidence-until-adopted)
defines the consumer tests that must accompany this distinction.

## Deterministic acceptance matrix

These are proposed tests, **NOT_RUN** as scheduler acceptance in this task.

| Boundary | Positive case | Negative case |
|---|---|---|
| Shared pool | Reviewer enters when capacity is free | Builder plus reviewer cannot exceed the same reservation limit |
| Exclusivity | Independent scopes overlap | Shared mutable scope cannot dispatch twice |
| Freshness | Exact input closure accepted | Changed producer invalidates dependent receipt |
| Recovery | New fence resumes from durable point | Expired worker cannot publish current completion |
| Disk | Work within configured reserve starts | Insufficient reserve prevents disk-heavy admission |
| Watchers | One wake schedules one next action | Duplicate wake, timeout or uncertain result does not duplicate effects |
| Fairness | Aged eligible task eventually enters | A stream of small tasks cannot starve it indefinitely |
| Cleanup | Completion releases owned capacity | Crash leaves a detectable reservation for bounded reconciliation |
| Lessons | Adopted applicable rule informs work | Observed foreign note cannot replace current project policy |

Use fake clocks, injected resource readings and isolated owned scratch. No native
process restart or paid model call is required for these logic checks. Exercise
the scheduler's real decision code with fake boundaries rather than implementing
a second scheduler inside the tests. A passing fixture is not live enforcement.

## Evidence and rollout limits

Required receipt: command/exit, candidate SHA, input digests, test environment,
negative control observed failing before the fix, resource observations and known
host limitations. Report native/provider acceptance separately from pure fixtures.
No universal enforcement claim until every required admission path enforces the
contract or explicitly refuses unsupported autonomous work.

First measure queue delay, accepted throughput, peak resource use, review cost
and repeated-failure rate on representative fixed tasks. Change one admission or
retrieval policy at a time; preserve equivalent acceptance scope, record outcome
and rollback conditions. More active agents or fewer checks is not a success
measure on its own.

Implementation remains follow-up work in the admitted owner path. N-006 may close
as a reviewed specification while CO-282 and its runtime obligations remain open.
