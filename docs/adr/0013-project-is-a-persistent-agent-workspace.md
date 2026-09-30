# A project is a persistent agent workspace

- **Status:** Accepted
- **Supersedes:** the `Goal → Project` hierarchy in the original brief and glossary;
  ADR-0003's clauses describing Project as a unit beneath Goal while retaining its
  Asset ≠ Project decision; `agent-composition.md` §7's rule that a schedule belongs
  to a goal
- **Retains:** ADR-0003's asset/project separation, ADR-0004's goal autonomy,
  ADR-0005's immutable graph rebuilds, ADR-0010's project-first organisation and
  ADR-0012's external agent compatibility boundary
- **Consequences / affects:** `CONTEXT.md`, `docs/vision.md`,
  `docs/architecture/*.md`, `docs/ux/`, `schemas/`, future database migrations
- **Source:** operator clarification, 2026-08-27

The previous model used the word Project for a time-bounded unit of work beneath a
Goal. The product's organisation had already moved in the opposite direction in
ADR-0010: the CEO sees projects first, and every project owns a manager and agents.
Those two models cannot both drive one dashboard or one schema.

The operator resolved the conflict with two concrete examples:

1. a project may exist only to observe Cloudflare, Search Console, Analytics and all
   other projects;
2. another project may represent one software product and contain developers, QA,
   analytics, support, SEO, content and SMM agents.

Both are the same object. Their difference is configuration, not ontology.

## Decided

1. **Project is the persistent workspace directly under an Estate.** It survives the
   completion of goals and holds one purpose, exactly one Product Manager, agent
   bindings, connection bindings, target scope, goals, routines, runs, reports and
   isolated project memory.
2. **Goals live inside one project.** They may decompose recursively and then into an
   immutable work graph. A project with portfolio-wide scope is how a cross-project
   goal is represented; Goals no longer create Projects.
3. **A Routine owns recurrence.** It pins a capability, target scope, schedule or event
   trigger, agent-selection rule, concurrency and catch-up policy. Each tick creates a
   new Run. Agents may be replaced without destroying schedules or history.
4. **Templates seed; they do not type.** Every project begins with one Product Manager.
   `software-product` may additionally seed Developer and QA; `portfolio-observer` may
   seed Cloudflare/Search/Analytics observers and a reporter. All optional agents can be
   added, replaced or removed after creation.
5. **Connections live at Estate scope.** OAuth credentials and provider accounts are
   stored once as secret references. A versioned Project Connection Binding exposes
   only selected resources and an access ceiling; Agent Grants narrow it again.
6. **Connector and agent are separate.** A deterministic connector collects one sourced,
   timestamped observation once. Observer and Analyst agents consume pinned observation
   snapshots, derive findings and reports, and never become the credential or ingestion
   owner merely because their role mentions Cloudflare or Analytics.
7. **Portfolio Observer is an ordinary Project.** Its Target Scope may select projects or
   include all current and future projects. Read scope does not make it their parent or
   owner. A finding enters another project as a Proposal addressed to that project's PM;
   a direct cross-project effect requires a specific grant.
8. **Runs pin revisions.** Project configuration, agent/provider bindings, routines and
   connection bindings are versioned. Editing or rollback creates a successor revision;
   an active run never changes beneath itself.

## Why no project type enum

A hard `project_type = observer | software | content | support` makes the next mixed
project a migration. Templates give the useful creation shortcut without turning a
starter choice into a permanent boundary. Capability, scope and bindings state what the
project can actually do.

## Asset ownership and observation

ADR-0003 still holds. An Asset may have one owning project and may have none. Other
projects can observe or target it through scope bindings; that relationship never changes
ownership. This is how Portfolio Observer can watch forty domains without owning the
products behind them.

## Resulting hierarchy

```text
Estate
├── CEO
├── Connections
└── Projects
    ├── Product Manager
    ├── Agent and connection bindings
    ├── Goals → graph versions → nodes
    ├── Routines → immutable runs
    ├── Reports and proposals
    └── Project memory
```

## Migration consequence

There is no stored project data yet, so this decision requires no data migration. The
first database migration must implement this hierarchy directly and must not reproduce
the superseded `goal_id` parent on Project.
