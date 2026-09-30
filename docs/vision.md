# Vision — Fabric, the CEO AI agent by PassionCode.ai

**Date:** 2026-08-16 · **Amended:** 2026-09-26 · **Status:** ratified at the stage-0 grill of
the first pipeline run; amended through ADR-0070 — see *Amendments* at the end

## The sentence

One operator owns forty domains, sixty repositories and three cloud accounts. The
work of remembering which of them is alive, which is owed something, and which is
quietly costing money exceeds what one person can hold — so the portfolio is organised
as **persistent projects containing agents, goals, routines and runs**, with a **CEO
agent** routing between them, and the operator decides only what a person must decide.

That was the first concrete customer and remains org #1. The portfolio is now
**PassionCode.ai: a toolkit for AI-native teams. Fabric is the CEO AI agent within it,
coordinating agents and Projects, in development. Fabric Switchboard is the first
product selected for public download.** [ADR-0070](adr/0070-passioncode-toolkit-and-product-design-system.md)
updates this portfolio hierarchy; ADR-0018 still defines Fabric the technical kernel.
The thesis below describes Fabric’s intended operating model, not the current
capability of every tool in the portfolio.

## From vibe coding to passion coding

**PassionCode.ai — A toolkit for AI-native teams.**

Vibe coding made it normal to direct an agent through a prompt, a chat and a task. Its
coordination cost appears when one person tries to drive many agents across many
projects: purpose, authority, state and proof move back into that person's head.

Passion coding moves the control point up one level. The person operates Projects, not
individual agent conversations. Each Project keeps its purpose, accountable team,
roles, Routines, authority, work, Evidence and feedback loop together. It can enter as
an idea at zero, an existing repository or a running product, then progressively encode
and automate how it gets to one and continues operating.

**Stop managing agents one by one. Start operating projects.** The agent may change;
the Project's operating model and history remain. People remain accountable, and
automation never broadens authority by implication. This category narrative is decided
in ADR-0033; implementation claims remain governed by `docs/brand/facts.md`.

**Amended 2026-08-28 (ADR-0016, ADR-0017):** the sentence above describes **org #1**.
The product is the platform under it — AI-agent-native companies as federated
estates: organizations with N co-equal owners and members who participate at declared
interaction points, each person carrying a personal estate of their own, with
delegation, memory and access crossing estate boundaries only as artifacts through
declared points. The original scope claims this supersedes are struck below rather
than deleted; the estate-tool discipline survives as the sequencing rule — nothing
platform-wide is built before org #1 lives on it.

## Why it exists, measured rather than felt

The first act of this project was not a design. It was a measurement of the estate
it is meant to run — Cloudflare's API for zones and DNS, HTTP probes against every
host, `git log` across `~/DATA`, `gh repo list`, and the DigitalOcean API. What it
found, on 2026-08-16:

| Finding | Count | Evidence |
|---|---|---|
| Domains in the operator's own estate | 40 | 33 zones in one personal CF account + 2 in a second + 5 registered at Namecheap with no CF zone |
| Serving real content | 15 | HTTP 200 with a non-empty title |
| **Answering an error, or nothing, to recorded traffic** | **7** | 503 / 525 / 404 / no response; 16 075 recorded visits behind them |
| Zones with **zero DNS records** | 8 | `GET /zones/{id}/dns_records` returned `[]` |
| Domains with mail configured and no web | 4 | MX present, no apex or `www` A/CNAME |
| Live sites whose source is not on this machine | 6 | sites of the operator's other projects |
| Repositories committed to this week whose domain is dead | 4 | four of the operator's other projects |

The single sharpest number: **the highest-traffic property in the portfolio returns a
Heroku `Application Error`.** Nobody decided that. Nobody noticed it. That is the failure this project exists to make impossible — not a
missing feature, but a missing *observer*.

The second sharpest: an ADR in another of the operator's repositories (2026-08-15)
names a product's home domain, and that zone has zero DNS records. **A decision was
recorded and never reached the world**, and the gap between the two was invisible
because nothing compares them.

## What PassionCode.ai and Fabric are

**PassionCode.ai is the umbrella; Fabric is its CEO AI agent and operating environment
in development.** The Fabric product owns estates, projects, workspaces and human
decisions. Fabric the technical kernel owns the
portable contracts, durable work lifecycle, policy enforcement, admission, evidence
and projections. This boundary is canonical in
[`docs/architecture/passioncode-platform.md`](architecture/passioncode-platform.md).

A company with one human in it.

- **Assets** are what the company owns — a domain, a repository, an application, an
  account. They exist whether or not anyone is working on them, and they outlive
  every goal aimed at them.
- **Projects** are persistent agent workspaces under the estate. Each has one Product
  Manager, its own agents, connections, routines, runs, reports and memory. A software
  product and a portfolio observer are the same kind of project with different scope and
  seeded agents.
- **Goals** live inside projects and state what that project is trying to achieve. Each
  one carries its own **autonomy level**, so "restore a site that fell over" and
  "launch a new product" are not governed by the same rule.
- **The graph** is how work is actually shaped. One node is one task with one result
  produced by one agent. An edge exists only where data crosses it, and it is
  labelled with what crosses.
- **Pipelines** are the route development takes, held as a versioned record rather than
  as code: a sequence of stages, each naming the department that holds it, the skills it
  requires and the gate that closes it. The operator edits them, and their own skills
  register exactly as the shipped ones do (ADR-0009).
- **Agents** do the work in real terminals — Claude Code, Cursor, OpenClaw — cloning
  repositories, creating them, running tests, opening pull requests. **Those terminals run
  inside the fabric**, so an operator never opens a second application to see what an
  agent is doing, and the CEO reads progress from the running session rather than from the
  agent's report about itself (ADR-0008).
- **The CEO** reads the estate, proposes or retires projects, routes goals and findings
  to the right project, hires each project's Product Manager, **answers the agent's
  questions inside the level the goal sets**, and escalates to the operator only where
  it may not answer — which makes escalation the exception rather than the step
  (ADR-0007, ADR-0013).

## Three claims, and what would break each

A vision that cannot be falsified is a mood. These are the claims, each with the
observation that would kill it.

**1. The estate can be known without being copied.**
The fabric reads Cloudflare, Search Console, Analytics, GitHub and the live web, and
stores only what cannot be re-fetched — history that the source itself discards, and
the derived judgements nobody else holds. *Broken if:* the store grows into a mirror
of the internet, or a question about the estate can only be answered from a stale
local copy.

**2. Autonomy is a property of the goal, bounded by the schema.**
The operator sets `safe`, `guarded` or `maximum` per goal. Below all three sits a
floor written in the database, not in a prompt: money, deletion and outward
publication under the operator's name are never automatic. Specific, named,
expiring grants are the only way through it. *Broken if:* an agent ever performs a
floored action, or the floor turns out to live in an instruction a model can reason
its way around.

**3. Every claim the fabric makes carries its measurement.**
"The site is down" means an HTTP status with a timestamp. "The project is abandoned"
means a last-commit date. Every node returns what became true, the proof, the scope it
covers and **what it did not verify** — four fields, and silence in the fourth is not an
answer. A dashboard that asserts without citing is the same
failure as Linear marking the flagship product's domain as `canceled` while it is the
live flagship. *Broken if:* any surface shows a judgement whose observation cannot be
opened.

## What this is not

- **Not a replacement for the operator's personal-assistant system.** That is the
  operator's personal optimiser — inbox, calendar, people, digests — and it keeps its own Linear
  backlog. The fabric owns the portfolio layer and writes to neither.
- **Not a task tracker for humans.** Its graph is executed by agents. Linear stays
  personal and is not wired in.
- ~~**Not a hosted product.**~~ **Superseded by ADR-0016** (2026-08-28), by
  ADR-0011's own reversal condition: the buyer is named — organizations and their
  people — and the four prices are paid line-by-line in that record. The sentence
  it replaced was true when written, and the seam it named ("a deployment rather
  than a rewrite") is exactly what made the reversal cheap.
- **Not built on somebody else's orchestrator.** Products exist that already run a
  company of agents, and adopting one for execution was measured and costed on
  2026-08-19. It was declined: one piece of software has to watch everything, because an
  operator who opens a second application to see an agent has the coordination problem
  back one layer up. What that rebuild costs is stated in ADR-0008 rather than left to be
  discovered.
- **Not a generic agent library or a chatbot builder.** Fabric is deliberately reusable
  as a kernel and open compatibility layer, while PassionCode.ai remains opinionated
  about the operating model: persistent estates/projects, typed work, bounded effects,
  independent checks and sourced evidence (ADR-0018).

## How it arrives

The operator's own condition: **every iteration must be something they can touch.**
No milestone ships as an internal refactor nobody can see.

1. **Foundation — the estate is legible.** The registry holds every asset with its
   measured state, refreshed from Cloudflare, GitHub and live probes. The dashboard
   shows the map. The seven broken properties stop being a discovery and become a
   row.
2. **Collection — the estate has a history.** Search Console and Analytics land
   through the fabric's own OAuth, so "losing ground" becomes a comparison rather
   than an impression.
3. **Goals — the graph exists and is executed.** Goals decompose into nodes; the CEO
   assigns agents; the operator approves at the line their autonomy level draws.
4. **The floor and the escalation path.** Notifications reach Telegram, macOS, the
   dashboard queue and an outgoing webhook; approvals return through the same
   channel that asked.
5. **Terminals.** Agents run in real shells with workspaces **hosted inside the
   fabric**, and the service terminals — the account manager, the MCP gateway — join the
   same board. Fabric also exposes its own project-scoped MCP control surface: an
   external agent can read authorized Project state, submit typed work and start or
   control permitted Runs without receiving an owner session or implicit access to every
   Project (ADR-0026).
6. **The pipeline becomes editable.** Stages, the department each one uses, the skills it
   requires — all of it a record the operator changes in the product, with their own
   skills registering like any other. Editing makes a new version; a running graph keeps
   the one it started with.
7. **Every source arrives the same way.** Connectors are plugins — Cloudflare, Search
   Console, Analytics, Mixpanel, Sentry, a log database, a mailbox — each with its own
   cadence and its own processing rule, so a new source is dropped in rather than wired in.

Each step is a milestone in `docs/evidence/backlog.md`, and each is refused entry
until the operator has looked at it. **Steps 6 and 7 are direction rather than plan:**
they are recorded as milestones and have not been through an intake grill.

## The names

**PassionCode.ai** is the organization. **Fabric** is its product, the CEO AI agent, and
**Fabric Switchboard** is Fabric's account-management tool that also works on its own
(ADR-0090). The working
positioning is **PassionCode.ai — A toolkit for AI-native teams.** The category line is **From vibe coding to passion coding.** The supporting
reframe is **Stop managing agents one by one. Start operating projects.** The secondary
slogan remains *Where people and agents run the business together.* The hierarchy and
category are accepted in ADR-0033; ADR-0070 updates the public portfolio hierarchy
while ADR-0018 retains the technical kernel boundary; ADR-0086 names teams in the
positioning and restores *The agent-agnostic operating system for AI-native teams.*

**Fabric is also the CEO's name** (ADR-0057, operator decision 2026-09-12): the estate's
manager agent — the protagonist who watches every project, compiles what the operator
reads on return, routes questions and ends every conversation in an artefact — bears the
kernel's name, and the product is named after its protagonist. The name grants no
authority and survives any provider replacement; which model runs the CEO role stays a
binding decision.

## Amendments

A ratified vision is amended in the open, with the date and the reason, or it quietly
becomes wrong. Nothing below replaced an earlier claim — each filled a gap the original
did not know about.

| Date | What changed | Why |
|---|---|---|
| 2026-08-19 | The CEO answers the agent's questions inside the goal's level; escalation became the exception | ADR-0007. Routing every question to the operator makes a thirty-second operation cost an hour, and routing none of them means the autonomy level decides nothing |
| 2026-08-19 | Terminals were named as running **inside** the fabric, and the product as standalone | ADR-0008, after measuring three shipping alternatives and declining to adopt one |
| 2026-08-19 | Pipelines, stages and skills entered the vision as first-class, operator-editable records | ADR-0009. If the route development takes is code, changing it is a release |
| 2026-08-19 | "How it arrives" gained steps 6 and 7, marked direction rather than plan | The operator described the connector and pipeline layers on 2026-08-19; neither has been grilled |
| 2026-08-25 | The org chart moved inside the project: one manager per project, one CEO per estate | ADR-0010. Recorded here late — that record names this file among what it affects, and this table did not carry it until 2026-08-26 |
| 2026-08-26 | **Two sentences above were challenged and upheld**: not a hosted product, not a general-purpose agent framework | ADR-0011, resolving CO-028. Three proposals had begun assuming users who are not the operator while the deciding row was still STOP AND ASK. The product branch is not deleted — it is costed in that record, and reversing this needs a named buyer and an answer to all four of its prices |
| 2026-08-27 | Project became the persistent workspace; goals and routines moved inside it | ADR-0013. The operator clarified that a portfolio observer and a software product are ordinary projects distinguished by scope, connections and agents, not different system layers |
| 2026-08-28 | **"Not a hosted product" was reversed by its own rule.** The fabric is a platform of estates: organizations with owners and members, personal estates, federation across them | ADR-0016 — the named buyer arrived and the four prices are paid in the record, which is what ADR-0011 demanded of a reversal. Closes CO-058 |
| 2026-08-28 | The federation seam entered the vision: interaction points, delegation with non-delegable accountability, the artifact-only aperture, A2A as the transport | ADR-0017, with `docs/architecture/federation.md` as the canonical design |
| 2026-08-29 | PassionCode.ai became the explicit product and Fabric its reusable technical kernel; low-friction agent bootstrap and sandboxed provider views entered the architecture | ADR-0018 through ADR-0020; canonical narrative in `docs/architecture/passioncode-platform.md` |
| 2026-09-03 | The public category became the shift from vibe coding to passion coding, with the Project rather than the individual Agent as the operating unit | ADR-0033; operator direction for the public launch surface |
| 2026-09-12 | The CEO agent received its name: Fabric. The product is named after its protagonist; kernel and character share the name deliberately, and the boundary of ADR-0018 is unchanged | ADR-0057; operator decision in the V1 context re-entry brief, ratified through the run's grill the same day |
| 2026-09-26 | PassionCode.ai becomes the umbrella toolkit; Fabric is the CEO AI agent in development and Switchboard is the first product selected for public download; shared dark/gold design system | ADR-0070; operator launch and design-system instruction |
