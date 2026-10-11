# ADR-0137 — Workflows are versioned graphs of agent steps, and a schedule starts them

**Status:** accepted · 2026-10-11 · resolutions R-02 and R-03 of the
[0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#decisions) (the operator's request that agents
are composed into workflows and refined and fixed in Fabric) · builds on
[ADR-0009](0009-the-development-pipeline-is-data-the-operator-can-edit.md) (a pipeline is versioned data),
[ADR-0045](0045-workflow-runs-task-runs-and-explicit-iterations.md) (WorkflowRun, TaskRun, iteration) and
[ADR-0054](0054-a-reading-authorises-one-unattended-start.md) (one gate per unattended start) · closes CO-099's
naming · plan row P-16, canvas node C7, REQ-14, REQ-15.

## Context

Fabric runs routines (`routines`, `routineTick.ts`) and chains — `task_links` with `rel='follows'` plus handoffs,
advanced by `chainAdvance.ts` on the 60 s cycle. There is no workflow entity, no version to refine, no step that calls
a registered service, no screen that shows a graph, and one feature carries four names in the interface (Cycles,
Project cycles, Automations, Routines — CO-099). Principle 8 says the coding agent does the work and the interface
shows the result.

## Decision

1. **A Workflow is a versioned graph in one Project**: `workflow.defined@1` creates it, `workflow.revised@1` adds a
   revision; the projector gains `apply_workflows` (tables `workflows`, `workflow_revisions`), added beside the other
   projector functions.
2. **A step is `agent`** (a session of a named agent or runner, with its brief) **or `call`** (`agent.call` to a
   registered service, under an internal principal, inside the operator's grants).
3. **A run materialises tasks and `follows` links**, so `chainAdvance` runs it under the one gate (ADR-0054) with the
   runner the step names ([ADR-0125](0125-an-agent-launch-may-follow-the-operators-fallback-order.md) §5); a run is
   the WorkflowRun of ADR-0045.
4. **A Schedule starts a workflow** on time or on an event; today's routines become schedules of a one-step workflow,
   migrated by an event, their history kept.
5. **The coding agent composes and revises** through MCP tools (`fabric_workflow_list|get|propose|revise|run`); a
   proposed revision takes effect only when the operator approves it on the Workflow screen (graph, runs, the diff of
   the revision). A failed run offers **Fix with agent**: a console handed the failure's context
   ([ADR-0140](0140-a-session-is-handed-its-context-in-one-format-session-handoff-1.md)).
6. **Names, one per concept:** Workflow, Schedule, run. «Automations», «Cycles» and «Rhythm of work» retire as labels;
   CONTEXT.md defines Workflow and Schedule.

## Consequences

- A migration with grants and RLS in migration 4's shape; `event_types` rows with feed sentences; surface tools and
  their registration (`check-surface-tools.mjs`); the Workflow screen in the product model and the prototype.
- An unattended run of a non-Claude runner still needs an explicit budget (ADR-0119 §6) and the spend policy's grant
  check (REQ-36).

## Evidence

- The code study, 2026-10-11 (the plan, canvas C7: `chainAdvance.ts#createChainAdvance`, `apps/desktop/src/main/index.ts#TICK_MS`, `routines` migration 22).
