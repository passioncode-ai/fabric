<p align="center">
  <img src="assets/brand/brand-pack/png/transparent/passioncode-icon-256.png" width="128" height="128" alt="PassionCode.ai passion fruit mark">
</p>

# Fabric — the CEO AI agent in the PassionCode.ai toolkit

> **From vibe coding to passion coding.**
>
> **PassionCode.ai — A toolkit for AI-native teams.**

Vibe coding puts you in charge of prompts, chats and agent tasks. Passion coding moves
the control point up one level.

**Stop managing agents one by one. Start operating projects.**

A Project keeps its purpose, team, Routines, authority, work, Evidence and
feedback loop together — from zero to one and beyond — while agents and Providers can
change.

**PassionCode.ai is the organization; its toolkit is for AI-native teams.** **Fabric** is the
product and CEO AI agent: it plans, coordinates agents, runs Projects and works with their data,
and it grows through its own tools — Fabric Inbox, Fabric Dashboards, Fabric Switchboard,
Fabric VR — each of which also works on its own (names: [ADR-0090](docs/adr/0090-names-passioncode-is-the-organization-fabric-is-the-ceo-and-its-tools-carry-its-name.md)). **Fabric 0.2.0 is an early preview for macOS on
Apple silicon**: a signed and notarized DMG, [downloadable from its product page](https://passioncode.ai/fabric/#download);
its build receipt is [`docs/releases/fabric-0.2.0-mac.json`](docs/releases/fabric-0.2.0-mac.json) and the
procedure [`docs/launch/release-mac.md`](docs/launch/release-mac.md). This repository holds
Fabric and its agent-agnostic technical kernel: portable contracts, durable work, policy,
admission, Evidence and projections.

**Current focus:** [Fabric's first useful run](docs/launch/README.md) ·
[interactive map](docs/reports/product.html#view-launch-map) ·
[private project workspace](https://wiki.passioncode.ai) (org members) ·
[publication and agent workflow](docs/architecture/report-workspace.md).

**Fabric Switchboard** is the first publicly downloadable product: a desktop beta
for managing AI-provider accounts. Every PassionCode.ai repository is open source under the
GNU AGPL-3.0, with a commercial licence available ([ADR-0092](docs/adr/0092-every-repository-is-agpl-3-0-or-commercial.md)); Switchboard releases up
to 0.4.0-beta.1 were released under PolyForm Noncommercial or Internal Use, and earlier ones under
MIT, and keep those terms. Its [product page](https://passioncode.ai/switchboard/)
and [source repository](https://github.com/passioncode-ai/fabric-switchboard) are the public
entry points; availability and platform acceptance are recorded in the
[launch handoff](docs/launch/passioncode-toolkit.md), not inferred from this description.

**Fabric Inbox** is the toolkit’s desktop email product, currently a development
preview. [Product page](https://passioncode.ai/inbox/) ·
[Source repository](https://github.com/passioncode-ai/fabric-inbox) ·
[Status and handoff](docs/launch/inbox.md). Its Cloudflare and Gmail implementation
has local/synthetic evidence; real-account acceptance and production deployment remain
unverified. Inbox is Fabric's tool and also works on its own; this registration adds no Fabric
kernel integration yet.

[ADR-0070](docs/adr/0070-passioncode-toolkit-and-product-design-system.md) defines this
portfolio hierarchy. The technical kernel boundary from ADR-0018 and CEO name from
ADR-0057 remain; a name grants no additional authority.

*Where people and agents run the business together.*

New here? Start with the [plain-language product guide](docs/guides/passioncode-overview.md).
The [product vision](docs/ux/vision.md) defines what PassionCode.ai is and refuses to
become.
The [organization profile](docs/public/organization-profile.md) is the publish-ready
public introduction; the [platform architecture](docs/architecture/passioncode-platform.md)
holds the complete technical narrative.

One operator owns forty domains, sixty repositories and three cloud accounts. The work
of remembering which of them is alive, which is owed something, and which is quietly
costing money exceeds what one person can hold — so the portfolio is organised as
**persistent projects containing agents, routines, goals and runs**. A **CEO agent**
routes work across projects, while each project has exactly one product manager and the
operator decides only what a person must decide.

The first act of this repository was not a design, it was a measurement. On
2026-08-16, across 40 domains: 15 serve real content, 7 answer an error to 16 075
recorded visits, 8 are Cloudflare zones with zero DNS records, 4 have mail and no web,
and 5 were never added to Cloudflare at all. The highest-traffic property in the
estate returns a Heroku `Application Error`, and a decision recorded in another
repository the day before named a domain as a product's home while that zone holds
nothing. Nobody chose either of those. That is the gap this project closes: not
a missing feature, a missing observer.

**Status: early preview (0.2.0).** Vision, ontology, decisions, the measured registry,
external contracts, project-workspace schemas and UX scenarios exist, and the desktop app
described under [Local development](#local-development) runs. The high-level
product/kernel architecture, Bring Your Agent lifecycle and provider-view boundary are
now canonical in
[`docs/architecture/passioncode-platform.md`](docs/architecture/passioncode-platform.md).
The schemas in
this repository explain and validate the design. What is implemented and verified is
recorded per requirement in [`docs/evidence/verification.md`](docs/evidence/verification.md),
not inferred from this description. As of
[ADR-0016](docs/adr/0016-the-fabric-is-a-platform-of-estates.md) the fabric is the
**platform of estates** under PassionCode.ai — organizations with owners and members,
personal estates, and a federation seam between them
([ADR-0017](docs/adr/0017-the-federation-seam-slots-delegation-and-the-artifact-aperture.md),
[`docs/architecture/federation.md`](docs/architecture/federation.md)); the estate-tool
plan survives as org #1 and builds first.

## Quick start for a new teammate

- **Install:** the signed, notarized preview for macOS on Apple silicon from
  [passioncode.ai/fabric/download/macos](https://passioncode.ai/fabric/download/macos); it needs
  Docker and the Supabase CLI for its local stack (below).
- **Configure:** Fabric uses the Claude Code and Codex logins already on the Mac; no key is typed
  into Fabric. Coordination in this repository needs your own Notion token in `.env.agent-sync`
  (org-index [ONBOARDING §4](https://github.com/passioncode-ai/org-index/blob/main/ONBOARDING.md#4-agent-tooling)).
- **MCP:** every agent session Fabric starts is given Fabric's agent surface automatically — a
  scoped, single-use `mcp.json` per session ([`agentSurface.ts`](apps/desktop/src/main/agentSurface.ts));
  nothing is registered by hand. Fabric's own entry for agents outside it — its northbound MCP
  with `agent.call`, which `claude mcp add` would register — arrives with plan AR-3 ([plans](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/plans.md)); until then you work with Fabric in the app, and Fabric
  drives the other products over their MCP servers ([products](https://github.com/passioncode-ai/fabric-workspace/blob/main/knowledge/products.md)).
- **Develop:** `pnpm install`, then `bash scripts/ci.sh fast` (no database) or `full` (with a
  disposable stack, never your live one) — [Local development](#local-development) below.

## Where things are

| Path | What |
|---|---|
| [Launch architecture and first useful release](docs/audit/2026-09-15-launch/index.html) | proposed R0/R1, retained ideas, source inventory and next packet D01; no new runtime claim |
| [The app rebuilt to the launch design](docs/evidence/plans/2026-09-29-launch-ui-plan.md) | the current packet order (L1–L11), how a screen is ported and compared, and the next task |
| [Living design map](docs/reports/map.html#changelog) | latest iteration, precise review links, module and screen map |
| [Interactive product walkthrough](docs/reports/product.html#journeys) | visual screen designs, product funnels, source findings and per-task UX handoff; fixture data, not production |
| [System and engineering contracts](docs/reports/system.html#system) | proposed implementation contracts, data graph, cycles and dependency payloads; [developer entry](docs/architecture/system-contract.md) |
| [Audit archive](docs/audit/README.md) | retained reports and evidence; [2026-09-07 merged report](docs/audit/2026-09-07-merged-execution-plan.html) |
| [General development plan](docs/evidence/backlog.md#general-development-plan) | the lanes everyone works to, each naming its work by id ([ADR-0101](docs/adr/0101-the-general-development-plan.md)) |
| [Current foundation-first queue](docs/evidence/backlog.md#build-order-by-layer) | dependencies, activation gates and all existing milestone references |
| [`docs/vision.md`](docs/vision.md) | what this is, what would falsify each of its claims, and how it arrives |
| [`docs/brand/`](docs/brand/) | canonical public facts, product terminology, voice and surface rules |
| [`docs/public/organization-profile.md`](docs/public/organization-profile.md) | publish-ready source for the PassionCode.ai GitHub organization profile |
| [`docs/guides/passioncode-overview.md`](docs/guides/passioncode-overview.md) · [`.ru.md`](docs/guides/passioncode-overview.ru.md) | the product model and one complete company loop in English and Russian |
| [`CONTEXT.md`](CONTEXT.md) | the domain language — asset, project, goal, node, edge, department, agent, observation, decision |
| [`docs/adr/`](docs/adr/) | the decision home and indexed status of each record, append-only; reversals add a record rather than rewriting one |
| [`docs/architecture/iterations.md`](docs/architecture/iterations.md) | **canonical sequencing** — the iteration ladder: iteration 1 (the operator's working version, six slices) in detail, iterations 2–5 at horizon grain |
| [`docs/architecture/iteration-1-modules.md`](docs/architecture/iteration-1-modules.md) | **canonical design for slices 1–3** — eight modules on the decided seams, cross-cutting contracts, migration-1 DDL sketch, the v1 diet with return triggers |
| [`docs/architecture/passioncode-platform.md`](docs/architecture/passioncode-platform.md) | **canonical high-level architecture** — product/kernel boundary, operating loop, planes, protocols, Bring Your Agent, workspaces, B2B SaaS scenarios, technology capability map and open-question map |
| [`docs/architecture/mcp-control-surface.md`](docs/architecture/mcp-control-surface.md) | **canonical design under ADR-0026** — Fabric as a project-scoped MCP server for external agents, with authorized resources, typed commands, durable handles, revocation and audit semantics |
| [`registry/domains.yaml`](registry/domains.yaml) | 40 assets with measured state, and the method that measured them |
| [`docs/architecture/external-contracts.md`](docs/architecture/external-contracts.md) | what the runner, the Google APIs, Cloudflare and Supabase impose — every number with its source |
| [`docs/architecture/adopted-doctrine.md`](docs/architecture/adopted-doctrine.md) | what the operator's own published standards impose — Proof of Done on the node contract, the skill family as the department registry |
| [`docs/architecture/agent-composition.md`](docs/architecture/agent-composition.md) | **design proposal under the canonical platform architecture** — how a chain binds to a capability instead of an agent, how a per-node bundle is compiled, which transport answers which question, and how a user adds their own agent |
| [`docs/architecture/project-workspaces.md`](docs/architecture/project-workspaces.md) | **canonical design** — projects as persistent agent workspaces, account bindings, routines, memory, cross-project scope, dashboard projections and the control-plane component map |
| [`docs/ux/`](docs/ux/) | validated org-#1 scenarios plus draft member, Bring Your Agent, provider-view and external MCP-control scenarios; foundation, flows and screen registry trace the same paths |
| [`schemas/`](schemas/) | explanatory JSON Schemas plus complete Portfolio Observer, product-project, cross-project proposal and estate-dashboard examples |
| [`fabric-agent-contract`](https://github.com/passioncode-ai/fabric-agent-contract/tree/74d3852f122f5ca5cbc4138a201483531dfa5006) | **normative contract 0.1.0** (public; the commit the Fabric Agent Adapter pins) — machine-checkable provider profiles, admission, binding, results, memory, coordination, execution contexts and governance |
| [`docs/architecture/work-producing-agents.md`](docs/architecture/work-producing-agents.md) | **design** — where the output of an agent that produces WORK enters the graph. Answers CO-035, and takes the estate's one existing work-producing agent as the worked example |
| [`docs/architecture/agent-production.md`](docs/architecture/agent-production.md) | **design** — where agents come from: production as a pipeline over an ordinary project, the template in three profiles, the cold-start shortcuts, and a bootstrap whose first products are the observer's own collectors. The model is decided in [ADR-0015](docs/adr/0015-agent-production-is-a-pipeline-over-an-ordinary-project.md); the milestone is M37 |
| [`docs/architecture/federation.md`](docs/architecture/federation.md) | **design, canonical under ADR-0016/0017** — the platform of estates: planes, the member model and interaction points, delegation, data transfer on A2A, memory storage and the sharing matrix, the access stack, runner agnosticism, and the v1 decision table |
| [`docs/architecture/agent-family.md`](docs/architecture/agent-family.md) | **role catalogue proposal under ADR-0018** — nineteen candidate departments, the growth loop as a pipeline, and the four public-voice roles that hit the effect floor; scope is settled, sequencing is not |
| [`docs/architecture-map.html`](docs/architecture-map.html) | **derived, pre-federation snapshot (2026-08-26)** — the product, the object model, the three planes, agent composition and the loops, on one page. Predates ADR-0014…0017; where it disagrees with the files above, the files win |
| [`docs/overview.html`](docs/overview.html) · [`.ru.html`](docs/overview.ru.html) | **derived, pre-federation snapshots (2026-08-26)** — the whole project in one readable pass, in English and Russian. Both predate ADR-0014…0017; where they disagree with the files above, the files win |
| [`docs/evidence/backlog.md`](docs/evidence/backlog.md) | current delivery state, foundation-first execution order and retained strategic roadmap |
| [`docs/evidence/specs/`](docs/evidence/specs/) | the task brief with its 27-row REQ spine, and the carry-over ledger |
| [`docs/evidence/verification.md`](docs/evidence/verification.md) | requirement-level evidence and explicit unverified rows; check coverage before relying on a capability |

## The shape

- **Store:** Supabase — Postgres + pgvector. One store for projects, registry, goals,
  routines, graphs, runs, observations and embeddings. The declared layer mirrors to `registry/*.yaml`
  so a portfolio decision arrives as a diff ([ADR-0002](docs/adr/0002-declared-data-is-mirrored-to-git-observed-data-is-not.md)).
- **Runs:** locally on the operator's desktop, because terminal agents must execute
  where the repositories and credentials are. The control-plane ↔ runner seam is a
  contract from day one, so a cloud move is a deployment rather than a rewrite.
- **Autonomy:** a field on the goal — `safe` / `guarded` / `maximum` — standing on a
  floor enforced by the database, not by an instruction. Money, deletion and outward
  publication are refused at every level; a named, expiring grant is the only way
  through ([ADR-0004](docs/adr/0004-autonomy-is-a-goal-field-standing-on-a-floor-in-the-schema.md)).
  Inside that level the fabric **answers the agent itself** and records each answer with
  the rule that permitted it, so escalation is the exception rather than the step
  ([ADR-0007](docs/adr/0007-the-fabric-answers-by-default-and-escalation-is-the-exception.md)).
- **Terminals:** real console sessions hosted and rendered **inside** the product, so one
  window covers the estate, the graph and the agents working on it — and progress is read
  from the running session rather than from the agent's report about itself
  ([ADR-0008](docs/adr/0008-the-fabric-is-standalone-and-the-terminal-runs-inside-it.md)).
- **Pipelines:** the route development takes is a versioned record the operator edits, not
  code — stages, the department each uses, the skills it requires. Operator-written skills
  register exactly as shipped ones do
  ([ADR-0009](docs/adr/0009-the-development-pipeline-is-data-the-operator-can-edit.md)).
- **Graphs:** immutable once running. A rebuild emits a new version pointing at its
  predecessor with a reason, so *the design* and *what happened* stay the same
  document ([ADR-0005](docs/adr/0005-a-rebuilt-graph-is-a-new-version-not-a-mutation.md)).

## What it deliberately does not do

It does not touch the operator's personal-assistant system or Linear — those are the
operator's personal layer and keep their own backlog ([ADR-0001](docs/adr/0001-the-fabric-owns-the-portfolio-layer-and-writes-to-nothing-else.md)).
It does not manage a corporate account's 31 zones; they are visible in the
registry and explicitly unwatched. It is not a generic agent library or chatbot builder:
Fabric is a reusable kernel, while PassionCode.ai requires persistent estates/projects,
typed work, bounded effects, independent checks and sourced evidence. And it is not built
on another orchestrator: adopting one that already runs a company of agents was
measured, costed and declined on 2026-08-19, because one piece of software has to watch
everything ([ADR-0008](docs/adr/0008-the-fabric-is-standalone-and-the-terminal-runs-inside-it.md)).

## Local development

```bash
pnpm install            # workspace: apps/desktop + packages/*; postinstall fixes node-pty's spawn-helper exec bit
supabase start          # local stack: API 54321, DB 54322, Studio 54323 (requires Docker) — the app's, holding your estates
bash scripts/ci.sh full # every probe, against a disposable stack (below) — never the one above
pnpm dev                # the macOS desktop app: projects, journal feed, hosted terminals
pnpm --filter @fabric/desktop package   # → apps/desktop/dist/mac-arm64/Fabric.app (unsigned, local)
```

The packaged app is `Fabric.app`. It carries the local stack's project (config, seed and
migrations) in its resources and starts that stack itself when the database is down, so it
needs Docker and the Supabase CLI but no checkout of this repository; `FABRIC_REPO` points
it at a checkout instead. It keeps PTY sessions alive when the window closes (Cmd+Q is the
real quit). The signed and notarized release is built by
[`docs/launch/release-mac.md`](docs/launch/release-mac.md).

**The walking skeleton of slice 1 runs** (ADR-0031; design in
[`iteration-1-modules.md`](docs/architecture/iteration-1-modules.md)): migration 1
(estates, projects, goals, the floor, the append-only journal with `append_event` as the
single door — ADR-0004/0013/0014/0016/0027), a journal-fed project list, and live
Claude Code terminals hosted per project. Agents, routines and chains arrive with
slice 3; collectors with slice 4.

### The disposable test stack

The probes that need a database never use the stack above. That stack is the one the desktop
app keeps your real estates in, and until 2026-10-03 the probes wrote into it. Now
[`scripts/test-stack.mjs`](scripts/test-stack.mjs) copies the root `supabase/` project into a
temporary folder. The copy gets its own `fabric_test_<hex>` project id and its own block of ten
ports (from 55420 up; `FABRIC_TEST_STACK_BASE` pins the block). Two runs started at once do not
pick the same block: a block is claimed with a lock file holding the run's pid from the choice until
`supabase start` has bound its ports, and a dead run's claim is taken over. It starts fresh, so the whole
migration chain and the seed are applied. It runs only db, auth, rest and kong. It is stopped,
with its volumes deleted, when the work is done.

```bash
bash scripts/ci.sh full                                   # starts it, runs every probe, removes it (trap)
node scripts/test-stack.mjs run -- pnpm test              # the same, around any command
node scripts/test-stack.mjs up <dir>                      # keep one up and rerun single probes:
node scripts/test-stack.mjs with <dir> -- node apps/desktop/test/identity.test.mjs
node scripts/test-stack.mjs down <dir>
```

A probe reads its connection only from `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`DATABASE_URL` and `FABRIC_TEST_STACK`, through `probeEnv()` in
[`scripts/lib/test-stack.mjs`](scripts/lib/test-stack.mjs). No probe in a tier falls back to
`supabase status` at the root. Two manual probes outside every tier still reach the live stack, by
design (CO-182): `apps/desktop/test/chat-activation-native.test.mjs` reads it through `supabase status`
and founds an estate there when run; `handshake-e2e.test.mjs` takes its addresses from the environment
with no guard. The live walk of the built app runs here too:
`node scripts/test-stack.mjs run -- node scripts/walk/start-paths.mjs <out-dir>`; it refuses to start
otherwise. Three things refuse an address on a live port: `up`, `guard`
and each probe itself. The live ports are whatever the root `supabase/config.toml` declares,
plus 54321 and 54322 in every case. A refusal is a FAIL with exit 1, and nothing connects
first. Two other things are refused as well: the live project id, and an address that is not
loopback. `DATABASE_URL` is read the way the probes' `pg` client reads it — pg-connection-string,
then `PGHOST` / `PGPORT` when the URL names no host or port — and a `host`, `hostaddr`, `port` or
`service` in its query string is refused, because it overrides the address the URL shows. The URL
must name its port explicitly. `probeEnv()` removes `PGSERVICE`, `PGSERVICEFILE` and `PGHOSTADDR`
from the environment, so a psql child cannot be moved through the service file either. `down` acts only on a
folder that carries the marker `up` wrote. It never runs `supabase stop --no-backup` for the live
project.

The full tier runs every package's test suites through
[`scripts/run-test-chains.mjs`](scripts/run-test-chains.mjs): each `a && b && …` link of each
package's `test` script runs on its own, and the tier fails at the end listing every suite that
failed — one failure no longer hides the suites behind it (`node scripts/run-test-chains.mjs --list`
prints them). Each suite runs in its own process group with its own limit (`FABRIC_SUITE_TIMEOUT_S`,
default 900): past it the suite's group is stopped, the suite is listed as failed with exit 124, and
the suites after it still run. The whole runner runs under [`scripts/with-timeout.mjs`](scripts/with-timeout.mjs)
(`FABRIC_FULL_TIMEOUT_S`, default 2700) as a backstop: past that limit the runner stops the suite it
is running, prints the list so far with the number of suites it never reached, and the tier fails
with exit 124 and the command named, so a hung probe cannot keep the tier running forever. A command
ended by a signal exits 128 plus that signal's number.

Thirteen owned-cluster runners (`apps/desktop/test/run-*-db.mjs` and `run-ceo-host-sql.mjs`) each own a
temporary PostgreSQL cluster. They need PostgreSQL 17 binaries (`FABRIC_PG_BIN`, default
`/opt/homebrew/opt/postgresql@17/bin`). Two (`run-estate-identity-db`, `run-read-schema-db`) run in the
fast tier; the other eleven run first in the full tier; every one runs, and the step fails at the end naming each that did not
pass.

### Test residue in the live database

[`scripts/residue-report.mjs`](scripts/residue-report.mjs) counts what earlier probe runs left
in the live database. It is read-only twice over: the session sets
`default_transaction_read_only=on`, and the query runs in a read-only transaction that is
rolled back. It removes nothing and prints no `DELETE`.

A row is classed only by a marker that a probe in this repository writes:
- the system actor that founded an estate;
- a probe's literal estate or person name, on a row that has no journal;
- a restore whose source estate is residue or gone;
- a project whose estate is gone.

Rows made by a path a person also takes are listed as **review** and are never counted as
removable: the desktop bootstrap's "org #1", the launch fixture, and a restore whose source
still exists.

```bash
node scripts/residue-report.mjs            # the live stack, from supabase/config.toml
node scripts/residue-report.mjs --json     # machine-readable
```

## License

Open source under the [GNU AGPL-3.0](LICENSE) ([ADR-0092](docs/adr/0092-every-repository-is-agpl-3-0-or-commercial.md)).
A [commercial license](COMMERCIAL-LICENSE.md) is available for use that does not meet the AGPL's
terms — contact@passioncode.ai. Contributions are accepted under [CLA.md](CLA.md). While this
repository is private, the Fabric binary is distributed under the commercial terms; whether to
publish the source is open (knowledge base licensing CO-KB-01).

