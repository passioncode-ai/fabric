# ADR-0109 — An agent's learning lives in Fabric, and a problem anywhere becomes a proposal

**Status:** accepted.
**Date:** 2026-10-03. **Decided by:** the operator, 2026-10-03, in four answers and one correction
(run `2026-10-03-onboarding-and-plan`): insights belong to **the agent within a project**; a rule changes
an agent **only after the operator approves it through the Board**; Fabric Dashboards **lists and edits an
agent's insights through Fabric**, a removal being a retirement that keeps history; the **Fix** action in
Dashboards and Project Observatory **files a proposal in Fabric** carrying its evidence; and — asked
whether insights and retrospectives live in Project Observatory as [ADR-0105](0105-agent-memory-lives-in-project-observatory.md)
records — **"in Fabric; correct ADR-0105."**
**Narrows** [ADR-0105](0105-agent-memory-lives-in-project-observatory.md) §1 (its "learnings earned from a
failure/fix contrast" move from Observatory to Fabric; episodes, checkpoints, handoff packs and environment
facts stay where ADR-0105 put them). **Builds on** [ADR-0041](0041-insights-carry-a-category-and-only-service-categories-ever-leave.md)
(categories, the retro cycle, the Board as the one channel), [ADR-0029](0029-a-proposal-terminates-at-the-target-product-manager.md)
(a proposal terminates at the target project's manager) and the agent contract's DEC-0012 (a learning needs
contrast and cannot apply itself). Design and packets:
[the spec](../evidence/specs/2026-10-03-agent-learning-loop-and-fix-in-fabric.md).

## Context

Fabric already keeps project memory with an `agents` category (M182), a retro reader (M154) and a designed
but unbuilt retro cycle (M184); the agent contract specifies retrospectives, learning proposals that never
self-apply, and owner approval. What is missing: a fact names the *session* that wrote it, not the agent;
nothing asks for a retrospective; there is no object for "a rule this agent should follow", no approval
for one, no per-agent section in the context pack; goals exist per project only; and nothing outside a
Fabric session can reach Fabric at all — no URL scheme, no northbound MCP (AR-3 unbuilt). Project
Observatory and Fabric Dashboards see problems every day and can hand none of them to the system that
would fix them.

## Decision

1. **Where it lives.** An agent's retrospectives, insights, rule proposals and approved rules are Fabric
   memory, in the journal and its projections (ADR-0014, ADR-0069: one store), keyed to the **agent
   binding** — the agent within one project — so they belong to the project and survive replacing the
   agent's provider (vision alignment test 2). Observatory keeps what ADR-0105 gave it apart from
   learnings; an insight may cite an Observatory episode by reference, never by copy.
2. **The loop, on by default where Fabric is.** When a run of a bound agent ends (`session.ended@1` or a
   task run's end), Fabric asks that agent for a retrospective through its in-session surface and attaches
   what the host observed (outcome, duration, failures). A retrospective yields insights; an insight that
   recurs across distinct runs becomes a **rule proposal**. Without Fabric there is no loop: the store,
   the approval and the context that carries an approved rule are all Fabric's.
3. **Direction is explicit.** Each agent binding carries **goals** — what it should get better at. A
   retrospective, an insight and a rule proposal each cite one; a proposal that serves no goal is shown as
   off-goal and cannot be approved until a goal is chosen. This is the guard against improving in a
   direction nobody wants.
4. **Nothing applies itself.** A rule proposal reaches the operator on the Board (ADR-0041 §4 — no second
   ceremony). Approved, it becomes part of the agent binding's **next** instruction revision and enters
   that agent's context pack in a section of its own; rejected or retired, it stays in history. The rule
   backlog is a projection that moves as insights arrive, rules are approved and rules are retired.
5. **Fabric Dashboards is a view, not a second store.** It lists an agent's goals, insights and rules,
   and edits or retires them, by calling Fabric (its local MCP for outside callers, AR-3's first slice);
   with Fabric not running, the action opens Fabric. "Delete" is a retirement: the row leaves the backlog
   and the context, and its history remains.
6. **A problem becomes a proposal.** Dashboards and Project Observatory show **Fix** (⌘⇧F on the selected
   problem). It opens Fabric through a `fabric://` link carrying the problem's evidence — the finding id,
   its source and its text, never a secret — and Fabric shows the operator what will be filed and to which
   project before filing it: a link any program can open never files work silently. The proposal goes to
   the target project's manager (ADR-0029); a problem with no project goes to the CEO. It counts as fixed
   when the source no longer reports that finding on a later run, which closes observe-to-verify.
   Fabric not installed: the action offers the download page on passioncode.ai instead.
7. **Private agents stay private.** Insights about agents the operator marks private never enter any
   export or feedback channel (M183), by construction rather than by filter.

## Consequences

- ADR-0105 §1 no longer lists learnings among Observatory's records; `memory/0.1` `learning propose`
  is served by Fabric, not Observatory. Observatory's plan PB-137 carries this narrowing.
- Fabric gains its first door for outside callers (a URL scheme and a loopback MCP with per-client
  tokens), so its threat model now includes other local programs; §6's confirmation is the answer for
  filing, and §5's calls are scoped to the agents a client may see.
- The agent contract gains an `agent-instructions` target and the agent-private scope for learning
  proposals; the adapter documents the retrospective an agent should return.
- The work is planned as P-06 (the learning loop) and P-07 (Fix in Fabric) in lane 8 of the
  [general plan](../evidence/backlog.md#general-development-plan).
