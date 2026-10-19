# ADR-0170: The person says an ended run's work is over

**Status:** accepted · 2026-10-19 · decides CO-327 (final pass step F5) · amends nothing in HAR-R0-04: its invariant 2
forbids *inferring* that a run is over, and this is not an inference · builds on
[ADR-0160](0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md) (an act happens at
once, is recorded and can be undone).

## Context

A managed Stop completes only with every proof the host can give, the provider's quiescence among them
(`record_task_run_stop_observation`, migration 67). No provider gives that receipt yet (CO-168, HAR-R0-05), so when a
coding agent's process ends, its Stop stays `outcome_unknown`, `task_has_unresolved_run_at` (migration 62) holds the
task, and every claim and admission of it is refused for good. Force adds only SIGKILL. CO-323 made the refusal say
`unresolved-run`; nothing let the task move.

HAR-R0-04 invariant 2 (`docs/launch/harness-r0/stop.md`, "Durable invariants") says a lapsed lease, a root exit, a raw
`run.ended` or a forged launch failure cannot manufacture clearance. That stands: none of them is used here.

## Decision

1. **The person may say the work is over.** «Работа закончена» on the console of an ended run completes its Stop with
   the basis `attested` (`attest_task_run_over`, migration 115): `run.stop_attested@1` with the person as its actor,
   `run.ended@1`, the task back to the queue, the old claim removed. `run_has_verified_stop` and every hold that reads
   it are unchanged; an attested Stop is a verified Stop with a different basis.
2. **Only then, and only by a person.** It is refused for any actor that is not a person (`person_required`), while the
   session's own process has not ended (no trusted `terminal.closed@1` and no backend exit receipt:
   `session_running`), and for a Stop the host already proved (`already_resolved`).
3. **It is an act with an undo** (`run.attest`, `run.unattest`, `actRunExecutors.ts`). The undo
   (`revoke_task_run_attestation`) returns the Stop to `outcome_unknown` and the task to its hold, unless the task has
   moved on since: a newer run, or a claim taken after the attestation (`task_moved_on`).
4. **Replay keeps it honest.** The projector removes the old claim for `run.stop_attested@1` only for the exact
   operational receipt, as for `run.stop_observed@1`; a revoked attestation is no longer that receipt.

## Consequences

- A task is never held for good by an agent whose process is gone: the person frees it in one press and can take it
  back.
- The record says who decided and on what basis; a provider receipt, when one exists, still completes a Stop without
  the person (`observed`).
- Not done here: an agent cannot attest for itself or for another agent; there is no automatic attestation after a
  timeout.
