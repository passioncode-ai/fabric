# Agent learning loop and Fix in Fabric — design

**Date:** 2026-10-03. **Decision:** [ADR-0109](../../adr/0109-agent-learning-lives-in-fabric-and-problems-become-proposals.md).
**Plan rows:** P-06 (the learning loop) and P-07 (Fix in Fabric), lane 8 of the
[general plan](../backlog.md#general-development-plan). **Vision:** serves the learning loop and "turns
signals into accountable work" ([vision](../../ux/vision.md), alignment tests 2, 3 and 4); the three
conditions the vision sets are §2.1 (owned by the project, keyed to the agent), §2.4 (nothing applies
itself) and §3.2 (a view over Fabric, not a copy).

## 1. What the operator asked for

> Every agent that works with Fabric gets a feedback-and-improvement loop: after its work, feedback is
> recorded — a retrospective, what to improve; on later passes this forms a backlog of rules that keeps
> changing; on by default where Fabric is, impossible without it. The more an agent works, the more
> insight accumulates and the better it works. Goals must be explicit so improvements go where we want
> them. Insights are visible per agent in Fabric Dashboards — list, edit, delete. And where Dashboards or
> Observatory show a problem: a Fix button and hotkey that hands Fabric a task to fix it, or offers to
> install Fabric. (Operator, 2026-10-03, translated.)

## 2. The learning loop (P-06)

### 2.1 Objects

| Object | Key | Meaning | Lives in |
|---|---|---|---|
| Agent goal | binding id + goal id | what this agent in this project should get better at; text, optional measure | new `agent_goals` projection (`agent.goal.defined@1`, `agent.goal.retired@1`) |
| Retrospective | binding id + run id | one run's account: goal cited, outcome, what failed, what fixed it, evidence refs | a `memory_facts` row, category `agents`, `about` = the binding, plus the run id (`agent.retro.recorded@1`) |
| Insight | binding id + occurrence | one observation from a retrospective, cites a goal; recurrences counted by occurrence identity (M182) | `memory_facts`, category `agents`, `about` = the binding |
| Rule proposal | binding id + proposal id | text of a rule for the next instruction revision, the insights behind it, the goal it serves | new `agent_rules` projection, state `proposed → approved / rejected → retired` (`agent.rule.proposed@1`, `agent.rule.decided@1`, `agent.rule.retired@1`) |
| Approved rule | binding id + revision | part of the binding's next instruction revision | `agent_bindings.instructions` revision + `agent_rules` row `approved` |

`memory_facts` gains a nullable `agent_binding_id` (the agent, not the session, wrote or is described);
an insight about an agent cites the binding, which outlives the provider behind it. Retirement without
replacement is a new `memory.retired@1` event (the "delete" of ADR-0109 §5), so history stays.

### 2.2 Flow

1. **A run ends** (`session.ended@1`, or a task run's terminal state). Fabric records what it observed
   (outcome, duration, exit, failures) and asks the agent, in its still-open surface or its next one, for a
   retrospective through the MCP tool `fabric_retro_record` — the schema of the agent contract's `retro`
   (goal, outcome, failed attempt, verified correction, causal hypothesis, evidence ≥ 2, recurrence signal).
   An agent that does not answer leaves the host-observed half only; nothing is invented.
2. **Insights accumulate.** Each insight cites a goal; the occurrence identity (M182) counts recurrences
   across distinct runs, never within one.
3. **A recurring insight becomes a rule proposal** — two distinct runs by default (configurable per
   binding), or one when the operator corrects the agent directly. The proposal names the insights, the
   goal and the exact rule text.
4. **The Board decides** (ADR-0041 §4): approve, reject, or edit then approve. Off-goal proposals are shown
   as such and need a goal chosen before approval (ADR-0109 §3).
5. **An approved rule** becomes part of the binding's next instruction revision and is injected into that
   agent's context pack in a section "Rules for this agent", cited by rule id; the previous revision stays
   the rollback basis (contract `versioned-setting`).
6. **Retire** removes a rule or an insight from the backlog and the context, keeping its history.

### 2.3 Guards

- Nothing self-applies (DEC-0012, vision anti-vision): only `agent.rule.decided@1` with an operator actor
  changes a revision.
- Goals are required on every proposal; the Board shows the goal beside the rule.
- An agent cannot retire or edit another agent's rules, nor its own approved ones (operator only).
- Private agents' insights never leave Fabric (ADR-0109 §7): the M183 export excludes bindings marked
  private at the query, not by a later filter.

## 3. Surfaces

### 3.1 Fabric

The agent page in a project shows Goals, Rules (approved, proposed) and Insights, each with retire; the
Board carries rule proposals as a kind of its own. The context pack shows the injected rules with ids.

### 3.2 Fabric Dashboards

Fabric appears as a listed agent host. For each Fabric agent: goals, rules, insights; edit and retire.
Every read and write is a call to Fabric's loopback MCP for outside callers (AR-3's first slice), with a
per-client token Fabric issues once at setup; Dashboards keeps no copy. Fabric not running: the action
opens Fabric on that agent (`fabric://agent/<binding id>`).

### 3.3 Fix (P-07)

| Where | Trigger | What is sent |
|---|---|---|
| Dashboards, Overview attention row (SCN-006) and a service's problem | **Fix** button, ⌘⇧F on the selected row | `fabric://propose?source=dashboards&finding=<service key>:<reason>&title=…&detail=…&link=fabric-dashboards://…` |
| Observatory, a finding on any page | **Fix** button, ⌘⇧F in the native app on the selected finding | `fabric://propose?source=observatory&finding=<type:subject>&title=…&detail=…&evidence=<ids>` |

- **Installed?** Both apps look Fabric up by bundle id (`ai.passioncode.desktop`) through LaunchServices.
  Absent: the button reads **Install Fabric** and opens the download page on passioncode.ai.
- **In Fabric:** the link opens a confirmation: what will be filed, the evidence, and the target project
  (mapped from the source subject when Fabric knows it; otherwise the operator picks one, or files it to
  the CEO). Nothing is filed without that confirmation; a link with a secret-shaped value is refused.
- **Filed** as a proposal (`proposal.filed@1`, origin kind `observation`, origin ref = the finding id) to
  the target project's manager (ADR-0029).
- **Verified** when the source no longer reports the finding: Observatory's next run (or Dashboards'
  next status) without that id closes the proposal's verification; a recurrence reopens it.
- Both host webviews allow the `fabric://` scheme to leave the page (today they deny every non-web scheme).

## 4. Packets

| Packet | Repository | Delivers | Acceptance |
|---|---|---|---|
| P-06.1 | fabric | migration: `agent_binding_id` on facts, `agent_goals`, `agent_rules`, the six events with `event_types` rows and feed sentences, projectors added as functions, grants and RLS | owned-cluster tests: replay, estate isolation, a foreign binding refused at the door |
| P-06.2 | fabric | `fabric_retro_record` and the host-observed half on run end | a fake agent answers and one that does not; both leave honest rows |
| P-06.3 | fabric | recurrence → rule proposal; the Board kind; approve/reject/edit; off-goal guard | planted self-apply refused; off-goal proposal cannot be approved |
| P-06.4 | fabric | approved rules in the binding's next revision and the context pack section | a run after approval carries the rule with its id; rollback restores the previous revision |
| P-06.5 | fabric | agent page: goals, rules, insights, retire | scenario walk |
| P-07.1 | fabric | `fabric://` scheme (`propose`, `agent`), confirmation screen, proposal filing, CEO residue | a link never files without confirmation; a secret-shaped value is refused |
| P-07.2 | fabric | loopback MCP for outside callers, per-client tokens issued at setup; tools for agent goals/rules/insights and proposal status (AR-3.1 subset) | a client sees only what its token allows; Fabric stopped → clients get a clear "not running" |
| P-07.3 | fabric-dashboards | Fabric agents view (via P-07.2), Fix button and ⌘⇧F, install detection, scheme allowed | scenario walk; Fabric absent shows Install |
| P-07.4 | project-observatory-dashboard | Fix on findings, ⌘⇧F in the app, scheme allowed in the webview, install detection | finding → link carries type:subject; verification closes on the next run |
| P-06.6 | fabric-agent-contract, fabric-agent-adapter | `agent-instructions` target and agent-private scope for learning proposals; the retrospective an agent returns, documented | contract schema tests; adapter skill text |

Order: P-06.1 → P-06.2 → P-06.3 → P-06.4 → P-06.5; P-07.1 can start with P-06.1; P-07.2 before P-07.3;
P-07.4 after P-07.1. Each packet is a pipeline task with its own tests and scenario updates
(`docs/ux/scenarios.md`: SCN-062 grows the loop; a new scenario covers Fix).
