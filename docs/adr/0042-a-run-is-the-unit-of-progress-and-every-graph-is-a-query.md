# ADR-0042 — A run is the unit of progress, a step status is a claim, and every graph is a query

**Status:** accepted · 2026-09-06 · design in [`../architecture/agent-visibility-and-runs.md`](../architecture/agent-visibility-and-runs.md)

## Context

The operator wants real-time visibility of an agent's work: the current task's
plan with checkpoints, where every loop iteration counts as a whole run and every
step carries a status; a per-agent history graph (what it did, what tasks it
added, where they went); and project-level task and plan graphs — previews on the
pages, full graphs on their own screen.

Measured first: the edges already exist (`task_links.rel` + `needs`,
`origin_kind/ref`, `question_blocks`, `assigned_by/to`, the pack lockfile,
`task.session.attached@1`). What does not exist is a run entity and any reader.

## Decision

1. **A run is a session bound to a task.** No new id: `task.session.attached@1`
   already journals the pair. Every loop iteration opens a session, so every
   iteration is a whole run — the operator's rule, adopted as stated. A re-run
   starts fresh step statuses; history keeps every run.
2. **The in-task plan is declared by the agent and tracked by events** —
   `plan.declared@1`, `plan.step@1`, statuses ENUMERATED
   (`planned·active·done·blocked·skipped·failed`), keyed to (task, run).
   Projection rebuildable; ADR-0014 unchanged.
3. **A step status is a CLAIM and is rendered as one.** What Fabric observes —
   session alive, heartbeat phase, subtask states, question blocks — is drawn as
   fact. Claim and observation are never averaged into one indicator (ADR-0002's
   rule at widget scale).
4. **Every graph is a query; no graph is stored.** The DID graphs (agent
   history, project tasks) are assembled from the journal — they cannot be wrong
   about the past. The SHOULD graph (plan) is assembled from declarations (goals,
   `follows`/`needs`). **They are two screens, not one with a toggle**, because
   overlaying them invites reading a plan as history.
5. **Previews on pages, full graphs on one screen (SCR-40).** The preview obeys
   the density principle (ADR-0041): the main number and a one-line strip;
   everything else behind the open.

## Refused

- A stored graph or a stored run table beyond the projection — a second copy of
  the truth, the Board's own argument.
- One merged graph with a did/should toggle.
- Free-text step statuses.
- Inferring run progress from output volume — silence is ambiguous (ADR-0040);
  progress is claims plus observations, each labelled.
