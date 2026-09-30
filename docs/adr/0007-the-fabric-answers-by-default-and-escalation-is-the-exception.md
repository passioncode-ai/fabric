# The fabric answers by default, and escalation is the exception

- **Status:** Accepted
- **Consequences / affects:** `CONTEXT.md`, `docs/evidence/backlog.md` (M14), `supabase/migrations/`, `docs/architecture/external-contracts.md`
- **Source:** operator decision, 2026-08-19, resolving CO-021

A running agent stops and asks — for permission to use a tool, or for a choice its
instructions did not settle. Somebody has to answer. Routing every one of those to the
operator turns a thirty-second operation into an hour-long round trip and makes the agent,
in the manifesto's phrase, an expensive keyboard macro. Routing none of them to the operator
means the autonomy level on the goal decides nothing at the only moment it could.

The tension is real and was raised before this decision: **answering is deciding**, and
ADR-0004 put deciding on the goal's autonomy level.

**Decided:** the fabric answers by default. Escalation is the exception, and it is derived
rather than configured.

1. **The fabric answers almost every question itself.** The default is to answer, not to
   ask. A question reaching the operator is an event, not a routine step.
2. **What it may answer is derived from the goal's `autonomy_level` and the floor** — there
   is no second policy object. This is what keeps the decision consistent with ADR-0004
   rather than beside it: answering is the same authority, applied at a finer grain.

   | Level | The fabric answers | It escalates |
   |---|---|---|
   | `safe` | reads, local analysis, anything confined to the workspace | anything that leaves the workspace |
   | `guarded` | everything except the high-risk classes — production, money, irreversible zones | those classes |
   | `maximum` | everything | only the floor |

3. **The floor is never answered by the fabric, at any level.** Spending money, deleting,
   and outward publication under the operator's name go to the operator or to a grant.
   `maximum` means the fabric answers everything *the floor allows*; it does not mean the
   floor moves.
4. **Every answer is recorded as a decision** — append-only, with the question, the level it
   was answered under, the rule that permitted it, and the node it unblocked. An answer the
   operator cannot open afterwards is indistinguishable from an agent that was never asked.
5. **A judgment is labelled as one.** `manifesto.md:202-204` separates a gate that decides a
   fact a machine can establish from one that evaluates something with no deterministic
   check. The fabric may answer both, but a judgment is stored as a judgment — a verdict
   from an agent recorded as a check is how the two get quietly collapsed.

**Why derived rather than configured:** a separate "what may the fabric answer" policy is a
second place where autonomy is defined, and two definitions of the same thing drift. The
operator sets one field on the goal; everything else follows from it and from the floor.

**What this decision does not resolve.** `canUseTool` is not invoked for auto-approved tools
or for `AskUserQuestion` (`external-contracts.md:58-62`) — so answering the agent needs a
second channel for the questions that never reach the callback. Recorded as CO-025. And a
node blocked on a genuine escalation still holds a live process; CO-016 stays open, but its
blast radius shrinks from "every question" to "the exceptions", which is the difference
between a design problem and a design fork.
