# CONTEXT — the domain language of Fabric

The glossary this project is held to. A term used in code, a schema, a document or an
agent instruction means what it means here. Resolved during the stage-0 grill on
2026-08-16; extended the moment a new term is settled, never in a batch afterwards.

No implementation detail lives here — only terms a person running this estate would
recognise.

## The nouns

**PassionCode.ai** — the organization, whose toolkit is for AI-native teams (ADR-0086). Fabric
is its product; Fabric's tools carry its name (Fabric Inbox, Fabric Dashboards, Fabric
Switchboard, Fabric VR) and each also works on its own, with its own readiness (ADR-0070,
ADR-0090). Organization products that are not Fabric's tools keep their own name, "by
PassionCode.ai" (Project Observatory).

**Fabric** — the CEO AI agent that coordinates agents and Projects, in development
(ADR-0057, ADR-0070). In technical contracts, **Fabric the kernel** retains its existing
meaning: domain contracts, durable work lifecycle, policy enforcement, provider admission,
orchestration seams, Evidence and projections (ADR-0018). A deployment may embed or
self-host that kernel without adopting the product surface. The CEO name grants no authority.

**Fabric Switchboard** — the standalone desktop product for AI-provider account
management, short form **Switchboard**. Its beta release and platform verification have
their own receipts; they do not imply Fabric CEO readiness (ADR-0070).

**Asset** — something the company owns that exists independently of any work being
done on it: a domain, a repository, a deployed application, an account with a
provider. An asset outlives every goal aimed at it. `example.com` is an asset;
it was one before anybody set a goal about it and will be one after. An asset may
have one owning project, but any number of other projects may observe it through a
target scope; observing is not ownership.

**Project** — a persistent agent workspace under the estate, organised around one
purpose. It may be saved in setup before its Product Manager is configured; managed
activation requires exactly one admitted Product Manager. An unconfigured manager
responsibility is not an Agent, a provider binding or permission to run. The Project
owns its roster of agent bindings, goals, routines, runs, reports and isolated project
memory. It binds to assets and external connections through explicit scope; it does
not have to represent a software product or end when one goal completes.
`Portfolio Observer` and `PassionCode.ai` are both projects: one watches many other
projects, the other runs one product (ADR-0061).

> **These two are deliberately separate, and it is the most load-bearing distinction
> in the schema.** Collapsing them makes "closed" ambiguous between *the product is
> shut down* and *the work is finished*. That failure is already live in the
> operator's Linear, where the flagship product's domain is marked `canceled` while
> being the flagship. See `docs/adr/0003`.

**Goal** — an outcome one project is trying to achieve. Goals decompose into other
goals to any depth, then into work graphs. A cross-project outcome lives in a
project whose target scope covers those projects — normally an observer project —
and creates proposals for the target Product Managers rather than silently writing
their graphs.

**Project template** — a versioned starter that seeds a new project's agents,
routines and policy defaults. It is not a project type and creates no permanent
restriction: `software-product` may seed a developer and QA, while
`portfolio-observer` seeds observers and a reporter. Every project remains the same
kind of object after creation.

**Target scope** — the assets and projects a project may observe or address. It can
name owned assets, selected projects, all current projects, or all current and future
projects. Scope grants visibility; it grants no write or production effect by itself.

**Connection** — one estate-level link to an external account or service, such as a
Cloudflare account, GA4 property collection, Search Console account, GitHub
installation or mailbox. It stores provider identity and a secret reference, never a
secret value. Projects reuse it through narrower connection bindings.

**Project connection binding** — the versioned grant that exposes selected resources
from one connection to one project. It states the resource selectors, access ceiling
and which project agents may receive it. Reusing an account never means sharing all
of that account.

**Routine** — a recurring or event-triggered unit of intent inside a project. It pins
a capability, target scope, agent-selection rule, schedule, concurrency and catch-up
policy. Every tick creates a new immutable run; the schedule belongs to the routine,
not to an agent or a node.

**Task** — durable work with its own business state, moving through the ladder in
`shared/ladder.ts#LADDER`: `backlog · running · review · done · cancelled`. It outlives
any single attempt to do it — several TaskRuns may happen before it closes — and a
closed Task is never reopened: continuation creates a new, linked Task. *Blocked* is an
overlay carried by `blocked_by` on the row, never a rung: a blocked task is still
somebody's obligation, and a `blocked` status would let work leave `running` by being
stuck, after which "how much is running" stops being true.

> **This entry retires the ban on the bare word "Task"** that stood in *Terms
> deliberately NOT used*. The ban was written when a unit of work was a `node` in an
> execution graph and "task" meant a row in somebody else's tracker. The product has
> since built `project_tasks`, a state ladder, a permission table and a whole surface on
> the noun — a glossary forbidding the word its own schema is built on teaches people to
> ignore the glossary.

**WorkflowRun** — one execution of one pinned graph version: a routine tick or a
goal-graph launch, immutable once terminal (ADR-0030, named by ADR-0045). It pins the
project, configuration, routine, graph version, agent bindings and provider/binding
revisions resolved at its start; nodes are children of exactly one WorkflowRun.
Replacement and rollback affect future ones only. On the wire it is `journal.run_id`,
and that meaning does not move.

**TaskRun** — one admitted execution attempt of one Task, identified by `task_run_id`
(ADR-0045; the id itself arrives with M188). Allocated inside the admission transaction,
before any external spawn — so a refusal leaves a command receipt and no TaskRun, and a
spawn that fails after admission is a TaskRun that terminated with a proven reason
rather than an invisible gap between "we accepted the work" and "nothing started".

> **Bare "Run" is now ambiguous and is not used alone.** ADR-0030 and ADR-0042 both
> defined it, incompatibly, and this glossary carried only the first. Say which.

**Iteration** — one explicit evaluation cycle of a Task, and the operator's own rule:
*if there is a loop, every iteration of it counts as a whole run*. Each iteration opens
a new TaskRun with a fresh namespace of step claims, so history keeps every attempt.
A retry of one tool call or one delivery is an **Attempt**, not an iteration, and a
provider's internal model turns are not counted at all unless the provider emits the
versioned Fabric iteration protocol — Fabric never infers them from text or timing.

**Attempt** — one try of one call, delivery or effect, identified by `attempt_id`. A
retry does not reset the Task's plan and does not create an iteration. This is the
grain at which "we do not know whether it happened" is recorded: an attempt whose
outcome is unknown is reconciled, never silently retried.

**Session** — one transport: a PTY and the process on the other end of it, identified by
`fabric_session_id`. A provider's own opaque session reference is a DIFFERENT thing and
is never treated as a Task or a run identity. By default one new session per TaskRun;
reusing one is admitted only where invocation-scoped acknowledgement, trace correlation,
cancellation and fencing are proven.

**CycleInvocation** — one firing of a repeating intent in one window: a routine tick,
a chain advance, the manager's cadence. It carries the window key, the cursor it
committed and its outcome, so a window that was skipped or merged is visible as that
rather than as silence.

**Transcript** — the whole output of one session, recorded verbatim when it ends and
kept as durable project memory (ADR-0032). It is an OBSERVATION: Fabric watched it, and
nothing summarised, extracted or judged it on the way in. Exactly one per session that
produced anything, read in three tiers — a one-line annotation, a bounded excerpt, the
full text — so a reader chooses what to spend context on before spending it. The agent's
own account of the same session is a claim and lives apart, in `agent_stages`.

**Node** — one unit of work in the execution graph: one input, one result, one agent.
"Research it, summarise it and check the sources" is three nodes wearing one name.

**Edge** — a dependency **that carries data**. It exists when B consumes what A
produced, not when B merely happens after A. Every edge is labelled with what crosses
it; an edge whose payload cannot be named is not an edge and is deleted.

**Department** — a grouping of roles that shares instructions and a skill set:
engineering, design, marketing, copywriting, analytics, architecture. The department
is what makes hiring an agent a lookup rather than an invention — it decides which
instructions and which skills a new agent of that kind is born with.

**Pipeline** — the route development takes, as a versioned record rather than as code: a
named sequence of stages. Editing a pipeline creates a new version pointing at its
predecessor with a reason; a running graph pins the version that was in force when it
started (ADR-0009).

**Stage** — one step of a pipeline. It names the department that holds it, the skills it
requires, and the gate that closes it. A stage is not a node: the stage is the template,
the node is the instance of it that one agent actually held.

**Skill** — a registry object with a name, a source, a version and the departments allowed
to use it. A skill the operator wrote registers exactly as a shipped one does; there is no
privileged tier. A stage declares the skills it needs and the fabric provisions them before
the node runs — a node that cannot be equipped fails at its gate instead of running
underequipped.

**Provider** — a reusable, versioned implementation that can satisfy declared
capabilities through a local runner, repository, API, MCP server or A2A peer. Discovery
or listing does not grant access. A provider revision becomes eligible only after
conformance and estate admission.

**Agent** — one provider revision bound into one project to do work: a role, capability
set, terminal/runtime, project grants and the node it currently holds. The project
binding is what makes it a member of one project. Agents are added, replaced and
retired; project routines and history survive them.

<a id="coding-agent"></a>
**Coding agent** — a program on the operator's machine that writes code in a project folder — Claude
Code, Codex. The first run's word for what the code calls an executor or runner (`AGENTS`,
`shared/agents.ts`); the interface says "coding agent" wherever a runner is meant, and "agent" only for
the configuration bound into a project. It is *on this machine* when its program is on the PATH,
*responding* when it also answers `--version`, *connected* when the runner catalogue marks it as handed
Fabric's credential (`connectsToSurface` in `shared/agents.ts` — a property of the runner, not a measurement),
and becomes an Agent only when bound into a project. Detection never verifies its account (CO-176).
[ADR-0100](docs/adr/0100-first-run-and-start-paths.md).

**First run** — the three skippable steps an estate with no project meets once: Fabric's name and look
(the persona, a preference that grants nothing), the coding agents on this machine, and the start
paths. Finished or skipped, it is stamped in `settings.firstRun` and reopened from Help. ADR-0100.

**Start path** — one way a project or an agent comes into Fabric: add a project (one folder), scan a
projects folder, new project, new agent (inside a project), convert an agent (designed, not built).
ADR-0100.

**Candidate** — a repository a scan found and listed, not yet a Project. Only a tick turns it into
one; a worktree or nested repository is a *part* of its product's candidate group. A kept scan lists
candidates; it grants no access to them. ADR-0100 §3.

**Agent Bootstrap Recipe** — a copyable, version-pinned onboarding instruction that a
coding agent runs to inspect an existing repository or create a new provider, apply an
adapter, validate it and emit a provider bundle. It is not the compatibility contract,
contains no standing credential, and cannot admit or bind what it produces (ADR-0019).

**Provider view** — an optional interactive presentation contributed by a provider and
rendered inside a host-owned sandbox. It receives scoped context and requests declared
tools; it does not receive store or vault access. Every provider view has a structured
fallback (ADR-0020).

**Role workspace** — the host-owned projection for a person serving declared roles: the
tasks, evidence, controls, SLA state and provider views that membership and interaction
points allow. It is a view over canonical work, not a separate task store.

**Remote surface** — Fabric on a device other than the Mac that holds the Estate: the Quest
or the phone (ADR-0088). It reads projections and sends typed commands through the northbound
MCP only, and shows a change only once Fabric's receipt arrives. It is a surface of the same
Fabric, never a second one, and holds no copy of the journal.

**Relay** — the always-on, authenticated endpoint that carries the northbound MCP between
remote surfaces and the Mac, which connects out to it (ADR-0088). It caches projections and
queues commands, and holds no authority. It is not the hosted estate of ADR-0016.

**Product manager** — the cardinal agent role accountable for one project's goals,
graphs, roster, routines and report upward. A Project in setup may leave this role
explicitly unconfigured; managed activation requires exactly one current admitted PM
assignment. Pending configuration is not runnable, and selecting a developer does not
fill the PM role. The name applies to an observer or operations project as well as a
software product; it is a cardinal role, not a project category (ADR-0061).

**CEO** — the single agent that reads the estate, proposes or retires projects, routes
goals and cross-project findings to the right project, hires the Product Manager each
project needs, and escalates to the operator at the line a goal's autonomy level draws.
**It holds no node.** Exactly one per estate — a cardinal role over the project set,
the same way `product manager` is cardinal for a managed project (ADR-0010, ADR-0012,
ADR-0013, ADR-0061).

**Observation** — a measured fact with a source and a timestamp: an HTTP status, a
DNS record set, a Search Console row, a last-commit date, an agent's exit code. An
observation is never a judgement. "The site returned 503 at 14:22 UTC" is an
observation; "the site is broken" is a conclusion drawn from it and must cite it.

**Decision** — a settled choice with its reasoning, append-only, never edited in
place. A decision that is reversed gets a new decision that says so.

## The words about autonomy

**Autonomy level** — a field on a **goal**, one of three:

| Level | Meaning |
|---|---|
| `safe` | the agent prepares and proposes; the operator performs anything that leaves the repository |
| `guarded` | the agent acts freely except on high-risk actions — production, money, sensitive irreversible zones |
| `maximum` | the agent acts freely; only the floor stops it |

**The floor** — actions never automatic at any level, enforced by the schema rather
than by an instruction: spending money, deleting (repositories, zones, data,
production DNS records), and outward publication under the operator's name. An
instruction can be reasoned around; a constraint in the database cannot.

**Grant** — a named, specific, expiring exception that opens one floored or high-risk
action for one target under stated preconditions. "Deploy `software-fabric` to
staging once lint and the full suite are green" is a grant. "Just do everything" is
not, and authorises nothing.

**MCP access binding** — an immutable Estate-owned authorization record that lets one
external MCP client see and invoke a declared subset of Fabric for an explicit finite set
of Projects. A token is only a replaceable credential pointing to this binding; it is not
the authority itself, is never forwarded into a Run, and cannot broaden the Project set or
effect ceiling recorded by the binding (ADR-0026).

**Question** — a point where a running node cannot proceed without a permission or a
choice its instructions did not settle. Every question is answered by the fabric or
escalated to the operator; it is never silently allowed and never silently dropped.

**Escalation** — a question the fabric may not answer, routed to the operator with the
node's state preserved. Escalation is the exception: the fabric answers by default, and
what it may answer follows from the goal's autonomy level and the floor, not from a
separate policy (ADR-0007).

## The words about the estate

**Estate** — one organization's persistent workspace: its projects, agents, chains,
connections, vault, journal and memory (ADR-0016). An AI-agent-native company and a
person's default personal workspace are the same object seeded from different
templates. The fabric hosts many estates; **org #1** is the operator's own — two
personal Cloudflare accounts, 40 domains, with a corporate account visible in its
registry and explicitly not managed.

**Person** — a global identity across estates, switching between organizations the
way one switches workspaces. Authorization data lives in `app_metadata`, never in
user-editable metadata.

**Membership** — the triple (person, estate, role). `owner` — cardinality N,
co-equal: settings, analytics, accesses, agent management; one CEO agent reports to
all owners, and the agent cardinalities of ADR-0010/0012 are untouched. `member` —
participates only at the interaction points a chain declares, and never holds a
credential: a member holds decisions.

**Interaction point** — the declared place where a chain holds a human:
`respond` | `initiate` | `approve`, addressed to a role, with an SLA, an escalation
target, typed payload and resolution schemas, and a `delegable` flag. A `delegable`
point may be served by the member's own estate; a point whose meaning is the human —
anything floored — declares `delegable: false`, and accountability never delegates
either way (ADR-0017).

**Declared** — what the operator or the CEO has stated to be true: an asset belongs to
this project, this goal has that autonomy level. Declared data is versioned in git.

**Observed** — what a measurement returned. Observed data lives in the database, is
never hand-edited, and always carries its source and time.

**Cluster** — a set of assets serving one theme from one source, tracked together
because a decision about one is usually a decision about all: for example nine
domains of one side project served by one repository, five domains of one product,
or two personal sites.

## Terms deliberately NOT used

- **"Site"** — ambiguous between the domain, the deployment and the codebase. Say
  which.
- ~~**"Task"** on its own~~ — **retired 2026-09-08 (S10).** It was banned when a unit
  of work was a `node` and "task" meant a row in somebody else's tracker. `Task` is now
  a first-class noun with its own ladder and schema; it is defined above. Say `node`
  only for a unit inside an execution graph.
- **"Run"** on its own — say `WorkflowRun` (one graph execution) or `TaskRun` (one
  admitted attempt at one Task). Two accepted ADRs defined the bare word incompatibly,
  which is exactly the ambiguity this section exists for.
- **"Active"** for an asset — say what was measured: `live`, `broken`, `empty`,
  `mail_only`, `parked`, `no_zone`. "Active" is what Cloudflare calls a zone whose
  nameservers resolve, which is true of every dead property in this estate.
