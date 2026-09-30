# Work-producing agents — where their output enters the graph

**Status: DESIGN, 2026-08-26.** It answers CO-035 and proposes the seam for the first
work-producing agent org #1 actually has. Written after ADR-0011 and retained under
ADR-0016/0018's org-#1-first sequencing, so its worked example assumes one
operator throughout.

`agent-composition.md` answers how an agent is *built* and how it *talks*. It does not
answer what happens when an agent produces **work** rather than a result — and three of the
roles in `agent-family.md` do exactly that: `seo-advisor`, `ops-watch` and
`support-manager`. Until now the fabric had one producer of work, the CEO.

---

## 1. CO-035, answered: neither goals nor nodes — observations, and a proposal

The row offered two branches. Both are wrong, and the existing records say why.

**Not nodes.** `ADR-0004` puts `autonomy_level` on the **goal**. A node with no goal above it
has no autonomy level, which means the floor has nothing to read when that node reaches for
money, deletion or the operator's name. That is a schema constraint, not a preference — the
floor is enforced by the database precisely so an instruction cannot reason around it.
`ADR-0010`, with the role renamed by ADR-0012, adds the second reason: exactly one product manager owns a project's graph. An
agent writing nodes into a graph it does not own gives that graph two authors, and neither
knows it.

**Not goals either.** A goal is what the company is trying to achieve, and deciding that is
the CEO's job in every record we have. An agent that files goals directly is a second
decomposition authority wearing the first one's name.

**What they file is what they actually have.** `CONTEXT.md` already carries the object:

> **Observation** — a measured fact with a source and a timestamp. An observation is never a
> judgement. "The site returned 503 at 14:22 UTC" is an observation; "the site is broken" is
> a conclusion drawn from it and must cite it.

So:

*(Amended 2026-08-31 under ADR-0029: the recipient below was originally drawn as the
CEO, while §5, `project-workspaces.md` §7 and the MCP surface all routed to the target
PM. ADR-0029 settles it — rule-first to the target project's PM; the CEO receives only
what has no deterministic route.)*

```
agent  ──observations──►  registry        (always; measured, sourced, timestamped)
       ──a PROPOSED goal──►  target project's PM   (a conclusion, citing the observations;
                              │                     the CEO only where no route resolves — ADR-0029)
                              ├─ accepts  → it becomes a goal, with an autonomy level
                              ├─ merges   → into a goal that already exists
                              └─ refuses  → recorded, with the reason, and the observations stay
```

**One decomposition authority survives per project, and the agent still produces something real.** A
proposal is a first-class row: it cites its observations, it has an author, and it has an
outcome. A refused proposal is not a lost finding — the observations under it remain, and
the next proposal citing the same ones is visibly the second time.

**The cost, stated:** latency, and a CEO that can become a queue. The mitigation is a
per-department **default autonomy** the CEO applies to accepted proposals of that kind, so
routine acceptance is a rule rather than a decision. That is a policy object the schema does
not have yet — recorded below.

---

## 2. The worked example is withdrawn

This section measured an external SEO agent (another organisation's repository) as the
first work-producing agent, and used it to show that work items, operator resolutions as
observations, a scheduled worker with a budget and a checker that may not introduce a fact
already existed outside this repository.

**The operator removed that product from this estate's scope on 2026-09-03.** The
measurement is withdrawn rather than rewritten without its subject: a table whose evidence
nobody here can re-run is an assertion, and this repository does not keep those.

What the section supported does not fall with it. The conclusion — that a proposal
crossing a project boundary terminates at the target product manager, and that one
resolution store must be authoritative — is recorded in
[ADR-0029](../adr/0029-a-proposal-terminates-at-the-target-product-manager.md), which
stands on its own. §3 below states the collision as a rule rather than as an observation
about a particular product.

---

## 3. The seam, and the collision it creates

That external SEO agent is not a department that happens to be written already. **It has its
own operator loop**: its own dashboard, its own sign-in, and a human who resolves work items
inside it. That is the difference that decides the seam.

- **Fabric does not absorb it.** Absorbing a product with its own operator surface means
  owning two of them.
- **Fabric consumes it as a provider**, over capabilities in the fabric's own vocabulary —
  `seo.findings@site`, `seo.audit@site` — resolved at hire time like any other
  (`agent-composition.md` §2).

**The collision, named because it is silent:** two surfaces now show the same work item, and
a resolution recorded in one is invisible to the other. An operator who dismisses a finding
in a producing agent's own dashboard and then sees it again in the fabric's board will stop
trusting whichever one they read second. **One resolution store, or one of the two surfaces stops
being authoritative** — and the store that already exists is the agent's.

Recorded as a carry-over row; it is a decision, not a detail.

## 4. Which protocol — and the case sharpens CO-029

`agent-composition.md` §5 gives the rule: MCP connects a model to a *capability*; A2A
connects you to a *peer* whose insides are not yours, and whose work has a task lifecycle.
The tell for having chosen wrong is inventing a task lifecycle on top of `tools/call`.

This agent has one. A work item is proposed, seen, and resolved by a human, over days — that
is a lifecycle, and it is exactly what A2A's task states model. But we own the code, and §5's
proposed answer to CO-029 is that the A2A boundary falls at the edge of what we own.

**Both halves of the rule point in opposite directions on the first real case, which is the
finding.** The proposed resolution: **MCP for the query, the agent's own store for the
lifecycle.** The fabric asks `seo.findings@site` and gets findings; it does not try to own
their resolution, because §3 already decided the resolution store is the agent's. No task
lifecycle is invented on top of `tools/call`, so MCP stays honest — and the reason it stays
honest is that we gave the lifecycle away rather than modelled it.

---

## 5. The loop, drawn

```
PROJECT  "Portfolio Observer"
  │
  ├─ GOAL     "the estate's search traffic does not quietly decay"
  │            autonomy: guarded
  └─ ROUTINE  "weekly search-decay review"   schedule: weekly
       └─ each tick: a NEW run (ADR-0005), never a mutation of the running one

     n1  seo.findings@site  ──findings, each citing its measurement──┐
         provider: example-agent, over mcp                           │
         (its own worker did the crawl and the ranking;              │
          the fabric asks, it does not re-measure)                   ▼
                                                        n2  observer PM: proposal
                                                              │  targets one product project
                                                              ▼
                                                        n3  target project's PM
                                                              accepts / merges / refuses,
                                                              then decomposes into nodes
                                                              (ADR-0010: one manager)
                                                              ▼
                                                        n4  developer, through task-pipeline
```

Four properties, each borrowed from a record rather than invented:

- **Every edge names its payload** (`agent-composition.md` §6). `n1 → n2` carries findings
  with citations; `n2 → n3` carries an accepted goal; `n3 → n4` carries nodes.
- **The schedule is on the routine, never on an agent, goal or node**
  ([ADR-0013](../adr/0013-project-is-a-persistent-agent-workspace.md)). Weekly is a
  property of the review routine, and each tick is a new run.
- **Concurrency `skip`, catch-up `latest only`** (§7, CO-043). A weekly crawl that takes
  eight days must not stack, and replaying four missed weeks of "what changed" is four stale
  reports.
- **An idempotency key on `(routine, tick, finding_id)`.** A retry must not open the same work
  twice. Cheapest line here, most expensive to add after the first duplicate.

---

## 6. What this forces

| # | What the schema does not have | Why it cannot be deferred past M1 |
|---|---|---|
| 1 | `proposal` — an author, cited observations, an outcome, and the goal it became | without it the CEO's refusal is not recorded and the same finding arrives forever |
| 2 | a department's **default autonomy** for accepted proposals | otherwise every routine finding is an operator decision, and the queue is the product |
| 3 | one **resolution store**, named, with the other surface reading it | two dashboards disagreeing about one finding is how both stop being read |

## 7. What it does not answer

- Whether `ops-watch` and `support-manager` fit this shape or need their own. Both produce
  work, but an incident has a clock a finding does not, and CO-034 already asks what
  `ops-watch` may change by itself.
- The capability vocabulary's owner and its drift lint (CO-041) — this document names two
  capability strings and does not create the register they belong in.
- Whether the fabric's board renders the agent's findings or links to them, which is the
  visible half of §3's collision.
