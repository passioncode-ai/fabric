# ADR-0184: An agent closes or cancels a task only on the operator's relayed decision

**Status:** accepted · 2026-10-28, carry-over row CO-478 (the 0.3.15 release review, iteration 2, PL-7; prowlagent's
request `1c4d2a1c` on the board, thread `a888a8cb`) · the operator's dashboard-parity rule of 2026-10-24 ·
fabric-agent-contract DEC-0121 AP-2 · narrows the agent half of `shared/ladder.ts#mayMove`, which stays as it is.

## Context

The board's ladder (`apps/desktop/src/shared/ladder.ts`) holds that an agent does not close its own task: it moves work
to review and the person accepts or cancels it. Its comment names the way out: "when we do want that automated, it goes
through a grant like any other floored act". On 2026-10-24 the operator ruled that every action a dashboard offers them
as a button is an agent action too when they say it in chat, with their words recorded as the reason. On 2026-10-27 the
operator told prowlagent's session to cancel six wave cards of a closed project; the agent had no door
(`fabric_task_move` knows backlog, running and review, and the obligation `ladder.no-self-close` is refused), so the
cards waited in review for one click each.

DEC-0121 gives the shape for exactly this: a relayed decision, `{by: "operator", via: "relayed-instruction", action,
target?, instruction, at, source?}`, which Fabric's hub already checks and forwards for calls between agents
(`apps/desktop/src/main/hubAuthority.ts#decisionSchema`).

## Decision

1. The agent surface gains `fabric_task_close` (`apps/desktop/src/main/agentSurface.ts`, region
   `relayed-close-tool`): close a task as done or cancelled, carrying the operator's decision as an argument or as
   `_meta.decision`.
2. The decision is checked by `apps/desktop/src/main/relayedClose.ts#checkRelayedClose`: no decision is
   `operator-decision-required` with `{action: "task.close", target: <the task>}`; a decision that is malformed, for
   another action, names no target or another task (its id or a prefix of at least 8 characters), or says it was given
   more than five minutes ahead of this machine's clock is `decision-invalid`. Both are `isError` with
   `{error: {code, message, data}}`, as the hub's refusals are.
3. A passing decision is the person's move relayed, so the person's ladder applies (`mayMove('person', …)`): a closed
   task still does not reopen, and a cancellation still needs a reason.
4. The close writes the same `task.closed@1` the dashboard writes, with the agent as its actor and the decision in its
   payload (who, how, the action, the target, the words verbatim, when and where they were said), so the journal shows
   who closed it and on whose word.
5. `fabric_task_move` keeps no move to done or cancelled; the obligation `ladder.no-self-close` keeps its mode and names
   the new door.
6. Fabric does not judge whether the words mean "close this task"; the agent relays them and answers for them, and the
   record keeps them for the operator to read. Words the operator did not say are a breach of the agent's instructions,
   not something Fabric can detect.

## Consequences

- prowlagent's six cards, and any later relayed close, take one call instead of a click per card.
- A relayed close is visible as such in the journal; the home, the rhythm and the analytics count it as a close, as
  they count the dashboard's.
- Alignment with `docs/ux/vision.md` §6: the authority stays the person's (their words, recorded), so model confidence
  does not stand in for it.
- Tests: `apps/desktop/test/relayed-close.test.mjs` (the check), `apps/desktop/test/agent-surface.test.mjs` (the
  refusal, a decision for another task, the close and its journal record).
