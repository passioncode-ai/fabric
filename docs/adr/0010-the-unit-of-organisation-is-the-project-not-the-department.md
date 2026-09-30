# The unit of organisation is the project, not the department

- **Status:** Accepted
- **Consequences / affects:** `CONTEXT.md`, `docs/vision.md`, `docs/architecture/agent-family.md`, `docs/architecture/agent-composition.md`, `supabase/migrations/`
- **Source:** operator decision, 2026-08-25

Every agent-team product on the market organises the same way: you have a team, you have
employees, and you work with them. The operator's instruction is that this fabric does not.

> The focus must not be *you have a team and you work*. It is that **you have projects**.
> There is one CEO over all of them, working with you — and inside, it decomposes not into
> employees but first into **projects**. Each project already has its own manager and its
> own agents.

That reads as a preference and is not one. It decides where the org chart lives, and an org
chart in the wrong place is the failure that shows up two years in as "which of my sixty
agents is working on the thing that is broken".

**Decided:**

1. **The top-level decomposition is CEO → projects.** Not CEO → departments, and not CEO →
   agents. The CEO's own job narrows accordingly: which projects exist, what each is for,
   which is starved, and working with the operator. **The CEO holds no node.**
2. **Every project has exactly one `project manager`** — an agent that owns that project's
   graph, hires into it, reports upward, and answers to the CEO.
3. **A `department` is a type catalogue, not an org unit.** `copywriter` is not a person in
   a company; it is a role type from which a project instantiates the agents it needs. Two
   projects each running a copywriter have two agents and one department.
4. **Agents belong to a project.** An agent is hired into a project, holds nodes in that
   project's graph, and is retired with it. There is no floating pool of employees.

## Why this and not the org chart everyone else ships

**Because the estate is a portfolio, not a company.** Forty domains and sixty repositories
do not share a marketing team; they share *nothing* except an owner. A global department of
copywriters would have to be told which of sixty products it is writing for on every single
task, and that instruction is exactly the context a per-project agent already carries.

**Because it makes the blast radius nameable.** A misbehaving agent is scoped to one
project by construction. Under a global org chart, "pause the copywriter" is a decision
about sixty products at once.

**Because it strengthens ADR-0003 rather than complicating it.** That record separated
`asset` from `project` so `closed` could not mean two things. This adds the distinction
that makes the separation obvious from the outside: **an asset has no manager, and a
project does.**

## What this does not change

`autonomy_level` stays a field on the **goal** (ADR-0004). A project holds goals; the
project manager works inside the levels those goals carry and **cannot raise them** — the
inheritance rule that already forbids a sub-goal exceeding its parent applies unchanged to
a manager acting under one.

The floor is unchanged, and it is not per project. Money, deletion and outward publication
under the operator's name are refused across the whole estate, because the thing they
protect is the operator, not the project.

## The cardinality that has to be enforced rather than intended

`CONTEXT.md` says there is exactly one CEO. There are now **N project managers**, one per
project, and that is a constraint the schema holds rather than a convention a prompt
describes — a project that acquires a second manager has two agents deciding what its graph
is, and neither of them knows it.

So `project manager` is a department type with a cardinality of exactly one per project,
and the CEO is a department type with a cardinality of exactly one per estate.
