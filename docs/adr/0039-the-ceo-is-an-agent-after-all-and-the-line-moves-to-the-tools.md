# ADR-0039 — The CEO is an agent after all, and auditability moves from the shape of the run to the tools it holds

**Status:** accepted · 2026-09-06 · supersedes [ADR-0038](0038-the-ceo-is-not-an-agent-loop.md) §1 and §6; the rest of ADR-0038 stands · design in [`../architecture/agent-system-map.md`](../architecture/agent-system-map.md) §5

## Context

ADR-0038 argued the CEO was not an agent: its work decomposed into arithmetic
plus four typed, tool-less, single-shot model calls, and the `agent-orchestrator`
rule *"a run that must be auditable is static"* forbade a self-directing loop.

The operator overrules the conclusion, with a reason ADR-0038 did not weigh: the
CEO must be **flexible**, must **work with tools**, and must **run pipelines**.
Those are the exact conditions under which `agent-harness` says build an agent
rather than a workflow — *"the task is open-ended, step count is unpredictable and
cannot be hardcoded."* ADR-0038 conceded the hinge itself: *"the moment any
advisory call gains a tool, it becomes a loop and inherits every guard."* The
operator is saying those calls will gain tools. So the CEO is an agent.

The design problem this raises is not "how to build a loop" — `agent-orchestrator`
§2 is that. It is: **ADR-0036 requires every CEO settlement to be cited and every
priority to carry its components, and ADR-0038 protected that with staticness. If
the loop is now dynamic, what protects it?**

## Decision

### 1. The CEO is an agent — a small tool-calling loop, ours, in the main process

Over the `ModelPort` router ADR-0038 already defined, with the four
`agent-orchestrator` §2 guards that ADR-0038 declined and now requires:
in-loop trimming, wrap-up injection, a max-iteration guard, and an iteration
refund on recoverable provider errors. This is roughly 150 lines of the skill's
tool-calling loop, not a framework.

The runtime alternatives are unchanged from ADR-0038 and still refused: not a
coding-agent CLI (`pi`, claude-code) — its loop is opaque to us and running the
CEO on one hands file access to something whose job is to rank and cite; not a
Python framework — a second runtime inside Electron for a handful of calls per
tick.

### 2. Auditability moves from the shape of the run to the tools the agent holds

This is the core of the ADR. ADR-0036's requirement was never "static" — that was
ADR-0038's *means*. The requirement was that settlements are cited and priorities
carry their components, and that is enforceable at the **tool boundary** no matter
how the loop wanders:

- **The tools are the floor.** `settle_by_citation` refuses a settlement with no
  resolving fact id **in the schema**, exactly as the effect floor (ADR-0004)
  refuses an ungranted write. The agent may reason however it likes; it cannot
  call the tool without a basis that exists.
- **Every tool call is journalled, so the trajectory IS the audit trail.** A
  dynamic loop whose every step is recorded is auditable in a way a static
  diagram is not: the diagram showed what was *meant*; the journal shows what
  *happened*.
- **The checker survives (ADR-0038 §2).** The deterministic core validates every
  advisory result before it reaches the Board, and a refused proposal is
  journalled with its reason. The agent proposes through a gate it does not
  control.

So ADR-0038 was right that the CEO's *guarantees* must not rest on a model's good
behaviour, and wrong that the only way to secure them is a tool-less loop. **The
guarantees live in the tools and the schema floor; the loop above them is as
flexible as the operator asked for.**

### 3. `ModelPort | null` still holds — the product is complete without a provider

With no provider the CEO runs its **deterministic tools only** — rank, withdraw,
merge-exact, settle-by-citation, digest — which is the entire core ADR-0038
defined. The agent loop is what the advisory tools plug into when a provider
exists; it is dormant until there is one to drive it.

This is why the change is small: the arithmetic, the checker, the router and the
floor are all reused. What is added is a loop above them, four guards, and the
tool-level enforcement that replaces staticness.

### 4. The line generalises — script where computable, agent where variable

The operator's third instruction, recorded because it governs the whole product:
**variable data wants an agent; a computable answer wants a script.** The test is
whether the output can be wrong in a way a type or a comparison catches — if so, a
script, because a wrong number the code could have checked is an error an agent
introduces and a script cannot.

Applied to the CEO, almost everything it does is a script (rank, withdraw,
merge-exact, criticality, digest, settle-by-key), and the handful that are not are
one shape — a single judgement over open-ended input. The agent loop exists for
that handful and for the tools they reach; it does not replace the arithmetic, it
sits above it. `agent-system-map.md` §3 classifies the rest of the product on the
same rule.

## Consequences

- The CEO gains the four loop guards; a run that exhausts them composes a
  best-effort result from what the deterministic tools already produced, never
  nothing.
- **A trajectory eval becomes a precondition, not a nicety.** `agent-harness`:
  without evals every claim about an agent's behaviour is unfalsifiable. The CEO
  is now an agent, so its eval is the first build step — ahead of tuning its
  prompt. The journal already holds the trajectories the eval reads.
- The tools carry the guarantees, so the tool *descriptions* and the schema
  refusals become the reviewed surface — `agent-harness/references/tools.md` is
  the standard they are held to.
- No new runtime, no framework, no second place a model is called from. The loop
  is ours and journals itself by construction.
- ADR-0038 §2, §3, §4, §5 stand unchanged and are load-bearing here.

## Refused

- **Hosting the loop on a coding-agent CLI.** Its steps are opaque unless routed
  through our surface, and an audit trail you get only by luck is not one.
- **Protecting the guarantees with staticness now that the loop is dynamic.** It
  cannot be done, and it is not needed: the tools and the schema floor do it, and
  the journal proves it after the fact.
- **A tool-less CEO.** The operator requires flexibility and tools; ADR-0038's
  own hinge says that makes it an agent, and pretending otherwise would leave the
  guards unbuilt on a loop that has them.
- **Reclassifying a script job to an agent by adding "just one" model call inside
  a pure function.** That is a decision with a token cost and is made in the open
  (§4), not smuggled into a function that used to be checkable.
