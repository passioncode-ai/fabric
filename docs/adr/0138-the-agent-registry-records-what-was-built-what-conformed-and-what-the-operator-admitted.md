# ADR-0138 — The agent registry records what was built, what conformed and what the operator admitted

**Status:** accepted · 2026-10-11 · canvas node C6 of the
[0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#canvas) (review finding F-04: a built agent
appears nowhere as an agent) · applies [ADR-0019](0019-agent-onboarding-is-a-bootstrap-and-admission-lifecycle.md)
(adaptation is not admission) and [ADR-0129](0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md)
§3 · plan row P-16, REQ-13; registry plan AR-2, AR-7, AR-11.

## Context

«Create an agent» and «Adapt an agent» (ADR-0129) mark a task with a preset and nothing else (`TaskRow.preset`). The
project of an agent being built says «No agent has been set up for this project yet»; the conformance report the
adapter skill produces never reaches Fabric; «Set up agents» is a monitor of sessions; the role agent of a project's
team shares the label «Create an agent». SCN-121…SCN-123 have no coverage.

## Decision

1. **An ecosystem agent is a record of its own**, built from events against its Project: `agent.build.started@1`
   (create or adapt, the runner, the session), `agent.build.reported@1` (a conformance report in the contract's
   `conformance-report` shape, as a task result), `agent.admitted@1` (the operator's act), and the link to its
   installed registry entry by repository. The projector gains `apply_agent_builds`.
2. **States, in order:** building → built → conformance passed / failed → admitted → installed. Admission is the
   operator's, never the report's (ADR-0019 invariant 4). Canary binding and promotion stay in the registry plan
   (AR-7) as carried work.
3. **An Agents page** lists every ecosystem agent with its state and the one next step; the project page of an agent
   being built says where it is being built and that its questions are answered there.
4. **Names:** the session monitor becomes **Sessions**; the in-project role form becomes **Add a team role**.

## Consequences

- A migration, feed sentences, the conformance report ingested through the task result path, SCN-121…SCN-123 and
  the registry scenarios redrawn to the console route, the Agents page in the product model.

## Evidence

- Review F-04; the code study (the plan, canvas C6: `shared/types.ts:189`, `…000021_created_agents.sql`).
