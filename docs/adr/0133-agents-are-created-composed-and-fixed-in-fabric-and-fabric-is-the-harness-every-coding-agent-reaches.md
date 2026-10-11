# ADR-0133 — Agents are created, composed and fixed in Fabric, and Fabric is the harness every coding agent reaches

**Status:** accepted · 2026-10-11 · operator decision D-01 of the
[0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#decisions) (one batch, the recommended answer
taken) · amends [`docs/ux/vision.md`](../ux/vision.md) §1, §3 and §7 · plan row P-16.

## Context

The vision (`docs/ux/vision.md`) says Fabric operates Projects, not agent conversations, and keeps agents replaceable,
not central (§5, principles 1 and 2). On 2026-10-10 the operator reviewed the new user's path and set the accent on
agency: Fabric is where agents are **created**, **composed into workflows**, **refined and fixed**; it becomes the
main app; and it is also an MCP server, so a coding agent even in a plain open console knows how to reach Fabric's
harness. The same day the knowledge base recorded principle 8, *Agents first* (setup, updates and fixes are handed
to the person's coding agent with the right context). The four-action onboarding of
[ADR-0129](0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md) already leads with
agents. None of this is in the vision, and AGENTS.md makes the vision the alignment test for every feature.

## Decision

1. **The vision is amended, not replaced.** §1 (essence), §3 (what the system does) and §7 (horizon) gain the
   agent-factory role: Fabric is where agents are created, composed into workflows and fixed, and the harness every
   coding agent reaches — launched by Fabric, opened in a terminal, or hosted by another product's console.
2. **The Project stays the operating unit.** An agent is built *as* a Project (its repository, purpose, team and
   evidence); a workflow lives *in* a Project; a session — wherever it was opened — works *in* a Project. Principles
   1 and 2 hold: a chat is still not the home of purpose or history, and a coding agent is still replaceable; what
   becomes central is the agent *the person builds*, which is a Project's product.
3. **The anti-vision is unchanged.** The one surface that contradicted it — the CEO chat, a second chat cockpit —
   retires in 0.4.0 (P-13, [ADR-0123](0123-the-conversation-is-the-runtimes-console-and-the-ceo-is-a-session.md)).
4. **Propagation (R-001).** The glossary gains Harness, Enrollment, Workflow, Schedule, Setup console and Session
   handoff ([`CONTEXT.md`](../../CONTEXT.md)); scenarios, flows, screens and the design map change with each wave of
   the plan that builds them.

## Consequences

- The alignment test (§9) asks, for an agent-facing capability, whether it strengthens the agent as a Project's
  product — not only whether it strengthens the Project.
- Built on this record: [ADR-0134](0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)
  (the harness for any console), [ADR-0135](0135-setup-runs-in-the-persons-coding-agent-and-fabric-shows-what-it-observes.md)
  (the Setup console), [ADR-0137](0137-workflows-are-versioned-graphs-of-agent-steps-and-a-schedule-starts-them.md)
  (workflows), [ADR-0138](0138-the-agent-registry-records-what-was-built-what-conformed-and-what-the-operator-admitted.md)
  (the registry).

## Evidence

- The operator's words, 2026-10-10: the plan's opening, request 1.
- The review findings F-01…F-18 ([The review](../evidence/plans/2026-10-11-release-040-agents-first.md#the-review)).
- Principle 8: `workspace/knowledge/principles.md` §8 (fabric-workspace `main` `e66b3a0`).
