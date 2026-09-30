# UX Foundation

<!-- Managed with super-ux (ux-contract v4). The WHY layer: personas, jobs
to be done, customer journeys, user stories. Update when the understanding
of users changes; scenarios in scenarios.md trace to the IDs defined here. -->

## Personas

### P-01: Estate operator

One operator owns many repositories, domains, deployments and provider accounts and uses
terminal agents already. They want to direct projects and make decisions, not remember
which account, agent, routine or report belongs to which product. This persona is observed
directly from the operator's 2026-08-27 project-monitoring description.

- **Status:** confirmed

### P-02: Organization owner or team admin

A founder or co-owner configures projects, roles, agents, connections, policies and
budgets with other owners. They need shared control with complete attribution and no
single hidden super-user. Derived from the operator's 2026-08-29 team scenario; direct
user validation is still required.

- **Status:** proposed

### P-03: Member or specialist

A supporter, marketer, SMM specialist, developer or contractor serves one or more
declared roles. They want one focused queue and workspace with exactly the context and
actions required for their work, while retaining the option to use their own automation.
Derived from the operator's 2026-08-29 support and specialist scenarios.

- **Status:** proposed

### P-04: Provider builder

A developer already has an agent, script, MCP server, API or repository and wants to
make it compatible without learning the entire Fabric architecture first. They expect a
copyable bootstrap recipe, a safe change plan and precise conformance failures. Derived
from the operator's 2026-08-29 Bring Your Agent scenario.

- **Status:** proposed

### P-05: AI-native project builder

A founder, technical lead or independent builder already uses coding agents and can run
several of them at once. They are looking for the layer above the sessions: a way to turn
one product or initiative into a durable, increasingly automated Project without giving
up their existing agents. This persona comes directly from the operator's public-position
brief on 2026-09-03; direct external validation is still required.

- **Status:** proposed

## Jobs to Be Done

### JTBD-01: Establish a project organisation
- **Statement:** When I start a project or a cross-project function, I want to save its purpose and recoverable next step first, then equip it with the agents and connections needed for the next capability, so I can obtain useful context before completing organisational setup.
- **Personas:** P-01
- **Type:** functional
- **Forces:** push: agents, credentials and schedules are scattered; pull: one persistent project boundary and a clear next step; anxiety: setup may demand an executor or grant before it is useful; habit: configuring every terminal and account separately.
- **Success metric:** a saved setup Project exposes its purpose, source coverage, next step and unconfigured responsibilities; managed activation separately requires one admitted PM and explicit scope, with no secret copied into project configuration. First useful context and first successful return are measured separately from creation.

### JTBD-02: Know what every project is doing
- **Statement:** When several projects and agents run at once, I want to see their health, active work, reports and next scheduled runs from one place, so I can notice exceptions without opening every terminal and provider dashboard.
- **Personas:** P-01
- **Type:** functional
- **Forces:** push: silent failures and forgotten properties; pull: one sourced monitoring view; anxiety: a green badge may hide stale or unverified data; habit: checking Cloudflare, GitHub and analytics separately.
- **Success metric:** every project card exposes current work, attention items, last/next run and independently sourced health dimensions.

### JTBD-03: Route findings without breaking project boundaries
- **Statement:** When an observer detects a problem in another project, I want its evidence to reach that project's manager through an explicit decision path, so I can benefit from cross-project intelligence without granting invisible control.
- **Personas:** P-01
- **Type:** functional
- **Forces:** push: findings disappear in reports or duplicate work; pull: proposal with evidence and a target PM; anxiety: an observer may mutate production or another project's backlog; habit: manually copying a finding between tools.
- **Success metric:** a cross-project finding is accepted, refused or superseded once, and no direct effect occurs without a named grant.

### JTBD-04: Participate through one role workspace
- **Statement:** When an organization needs my human judgment or specialist work, I want one queue with only the relevant evidence and permitted actions, so I can contribute without learning the whole agent system or receiving its credentials.
- **Personas:** P-03
- **Type:** functional
- **Forces:** push: tasks arrive through unrelated chats and dashboards; pull: one accountable queue with SLA and context; anxiety: an agent may expose too much or act in my name; habit: resolving work in the source tool.
- **Success metric:** a member resolves an addressed interaction once, with actor, evidence, SLA and effect receipt preserved and no unrelated estate data exposed.
- **Status:** proposed

### JTBD-05: Bring an existing agent into a project
- **Statement:** When I already have useful automation or an agent repository, I want my coding agent to adapt it from one reproducible recipe, so I can reach a real conformance result without rebuilding it for a proprietary runtime.
- **Personas:** P-01, P-02, P-04
- **Type:** functional
- **Forces:** push: every host expects a different wrapper; pull: one contract and guided adapter; anxiety: copied instructions may overwrite code or leak a key; habit: manual integration and bespoke webhooks.
- **Success metric:** the repository produces a pinned provider bundle and local report with a reviewed diff, then reaches admission or a precise failed gate without receiving estate authority.
- **Status:** proposed

### JTBD-06: Shape a workspace around a role
- **Statement:** When a role uses several agents and sources, I want to compose their views into one workspace, so the person sees work rather than raw tools while the host still controls access and layout.
- **Personas:** P-01, P-02, P-03
- **Type:** functional
- **Forces:** push: provider dashboards fragment work; pull: role-specific tiles and actions; anxiety: third-party UI may receive ambient access or break responsiveness; habit: opening many tabs.
- **Success metric:** an owner adds a provider view with explicit data/tool scope and fallback, and a member sees it only in the roles and projects allowed by membership.
- **Status:** proposed

### JTBD-07: Close an operating loop across agents and people
- **Statement:** When a customer, production signal or market opportunity creates work, I want it to move through accountable roles to a checked outcome and the next measurement, so the company improves without me manually carrying context between tools.
- **Personas:** P-01, P-02, P-03
- **Type:** functional
- **Forces:** push: support, engineering and growth live in separate queues; pull: one evidence-backed lifecycle; anxiety: an agent may publish, deploy or answer beyond authority; habit: copying findings into a backlog and checking completion by chat.
- **Success metric:** the originating signal, routed work, independent check, human decision/effect receipt and follow-up observation are connected in one trace with no implicit cross-project mutation.
- **Status:** proposed

### JTBD-08: Let an external agent operate selected Projects
- **Statement:** When I want an agent outside Fabric to coordinate work across my existing tools, I want to give it one revocable MCP access path to selected Projects and operations, so it can participate in the automation chain without receiving my owner session or unrestricted Estate access.
- **Personas:** P-01, P-02
- **Type:** functional
- **Forces:** push: external agents need bespoke APIs or broad credentials; pull: one standard control surface with current Project context and durable Runs; anxiety: a token may silently reach every Project or survive revocation; habit: copying admin/API credentials into each automation.
- **Success metric:** an owner creates a time-bounded access binding, connects an external MCP client, observes an allowed read and Run admission, then revokes it and sees an out-of-scope or later call denied with a receipt.
- **Status:** proposed

### JTBD-09: Understand the move from agent control to Project operation
- **Statement:** When coordinating several agents stops scaling across my products, I want to understand how PassionCode.ai changes the operating unit, so I can judge whether it fits one real Project without buying into a vague autonomy promise.
- **Personas:** P-05
- **Type:** functional and emotional
- **Forces:** push: too many chats, prompts and status checks; pull: one durable Project with explicit loops; anxiety: a new platform may lock in my agents or overstate what is built; habit: adding another agent dashboard.
- **Success metric:** after one public-page visit, the reader can explain vibe coding, passion coding, PassionCode.ai and Fabric, identify the current product status and choose a concrete next reading path.
- **Status:** proposed

## Customer journeys

### JRN-01: Estate operator — establish a project organisation (JTBD-01)

A Project may be saved after its purpose and next step are known. Organisation setup is available on demand; managed activation requires one admitted PM (ADR-0061). Cancelling later setup preserves an already saved Project.

| # | Stage | User action | Touchpoint | Emotion (1-5) | Pain | Opportunity |
|---|---|---|---|---:|---|---|
| 1 | Decide purpose | choose what the project exists to do | project creation | 3 | project and product are easy to conflate | ask for purpose, not a hard type |
| 2 | Seed organisation | select a starting template | template choice | 4 | blank configuration is slow | preview exactly which agents/routines are seeded |
| 3 | Set scope | select owned assets, selected projects or estate-wide visibility | scope step | 3 | broad read can look like broad write | show read scope and effect grants separately |
| 4 | Bind accounts | reuse or connect accounts and choose resources | connections step | 2 | OAuth account/resource identity is hard to verify | return from OAuth to an explicit resource selector |
| 5 | Review agents | add, remove or replace optional agents | agent setup | 4 | provider presence can be mistaken for admission | show admission and project binding independently |
| 6 | Start | activate project configuration revision | review | 5 | user needs confidence nothing hidden was granted | one review of scope, accounts, agents and routines |

### JRN-02: Estate operator — monitor and intervene (JTBD-02, JTBD-03)

| # | Stage | User action | Touchpoint | Emotion (1-5) | Pain | Opportunity |
|---|---|---|---|---:|---|---|
| 1 | Scan estate | compare project cards and attention counts | estate home | 3 | one composite health hides the failing dimension | show independent sourced dimensions |
| 2 | Open project | inspect current work and scheduled work | project overview | 4 | status reported by the same agent is circular | link to durable trace and observation receipts |
| 3 | Investigate | open a run, report or finding | run/report detail | 2 | terminal transcript is noisy and incomplete | lead with typed result, evidence and unverified surfaces |
| 4 | Decide | accept, refuse, retry, pause or grant | proposal/run action | 4 | an intervention can mutate the wrong project | keep target and effect visible at decision time |
| 5 | Return | resume scanning with the decision reflected | estate/project home | 5 | stale cards create duplicate decisions | project view updates from the canonical journal |

### JRN-03: Member — receive and resolve role work (JTBD-04, JTBD-06)

| # | Stage | User action | Touchpoint | Emotion (1-5) | Pain | Opportunity |
|---|---|---|---|---:|---|---|
| 1 | Join | accept an estate invitation and inspect roles | invitation/access review | 3 | role names can hide real authority | preview visible projects, actions and exclusions |
| 2 | Orient | open the role workspace | role home | 4 | global dashboards contain irrelevant noise | show addressed work, SLA and next action only |
| 3 | Decide or work | open a task and use a human or delegated path | interaction detail | 3 | context may be incomplete or overexposed | typed payload, evidence, requester and allowed actions |
| 4 | Resolve | submit a response/approval/artifact | resolution review | 4 | duplicate or accidental effects | one idempotent resolution with effect preview |
| 5 | Verify | see receipt and queue update | role home | 5 | chat acknowledgements are not proof | link the resolution to actor, policy and effect receipt |

### JRN-04: Provider builder — adapt or create an agent (JTBD-05)

| # | Stage | User action | Touchpoint | Emotion (1-5) | Pain | Opportunity |
|---|---|---|---|---:|---|---|
| 1 | Choose intent | select adapt existing or create new | agent foundry | 4 | product language is implementation-heavy | ask for intent, capability and source |
| 2 | Bootstrap | copy a pinned recipe into the coding agent | recipe handoff | 4 | prompt drift and unsafe edits | show versions, checksum, dry-run and no-secret guarantee |
| 3 | Review | inspect proposed repository changes | coding workspace/report | 3 | generated wrappers can own too much code | minimal adapter diff and rollback instructions |
| 4 | Validate | run local fixtures and upload signed report | conformance | 4 | pass/fail without a precise gate is unusable | independent shape/protocol/semantic results |
| 5 | Admit and bind | approve revision, project scope and canary | admission/binding | 5 | compatibility can be mistaken for authority | separate admission from project grant visibly |

### JRN-05: Estate operator — connect an external control agent (JTBD-08)

| # | Stage | User action | Touchpoint | Emotion (1-5) | Pain | Opportunity |
|---|---|---|---|---:|---|---|
| 1 | Define access | choose explicit Projects, resources, commands and expiry | MCP access | 3 | a short scope label can hide broad authority | preview effective access and excluded Projects before issuance |
| 2 | Issue | create the binding and reveal its credential once | credential detail | 2 | secret handling is easy to get wrong | copy-ready client configuration without retaining the raw value |
| 3 | Connect | add the endpoint and credential to the external agent | external MCP client | 4 | protocol/auth failures look alike | test discovery and show the exact failed layer without exposing the token |
| 4 | Operate | allow reads, submissions or Run admission within scope | Fabric audit/Run detail | 4 | the owner cannot tell what the agent actually invoked | every request links principal, Project, policy and command/Run receipt |
| 5 | Restrict | rotate or revoke access and inspect in-flight work | MCP access detail | 5 | revoking control can be confused with cancelling work | state exactly what stopped, what remains and the explicit cancellation path |

### JRN-06: Project builder — evaluate passion coding (JTBD-09)

| # | Stage | User action | Touchpoint | Emotion (1-5) | Pain | Opportunity |
|---|---|---|---|---:|---|---|
| 1 | Recognise | see the shift from vibe coding to passion coding | landing hero or social card | 4 | category language can be empty wordplay | define the shift immediately as agents → Projects |
| 2 | Reframe | compare session-level control with Project-level operation | transition section | 4 | another cockpit looks like more supervision work | show the operating unit and what persists |
| 3 | Understand | follow the Project loop from purpose through learning | operating-model section | 3 | architecture jargon obscures the useful change | use verbs, one loop and one concrete Project frame |
| 4 | Trust | inspect agent-agnostic boundaries and current status | principles/status section | 3 | autonomy and availability are easy to overclaim | state replaceability, authority and what is not public yet |
| 5 | Continue | open the organization or technical foundation | final CTA | 5 | private repositories can become dead-end CTAs | link to the public organization and identify each repository's job |

## Product mechanics

- **Personalization:** rule-based — saved project filters and target scopes; every inferred scope remains editable.
- **Engagement mechanics:** measured-only presence and milestones — **operator override
  2026-09-12, superseding the earlier "none"** («с элементами геймификации в виде
  Fabric-CEO», V1 design brief). Four mechanics, each a recomputed projection of the
  journal and never a stored award: the Fabric greeting band (the digest, voiced),
  milestone lines with ornament badges, autonomy-raise proposals with named evidence,
  and honest streaks/trends that disappear when no longer true. Jobs reinforced
  (BP-141): JTBD-02 (re-entry) and the ST-018 autonomy decision path. Recovery flow
  (BP-142): a lapsed streak is simply recomputed away — no loss-aversion messaging.
  Bans stand: no points, no stored badges, no daily-login mechanics, no leaderboards.
  **Extended by the operator the same evening:** a personal AI-generated Fabric avatar
  (each user generates their own, in the set style; the look never changes authority —
  ADR-0057) and a COMPUTED level shown with its formula line and register inputs
  (days worked, tasks accepted, decisions, agents) — recomputed, never stored, so it
  stays a measurement wearing a game face rather than an award.
  Design idioms: [design language](plans/2026-09-12-v1-design-language.md) §3; ADR-0057.
- **Accessibility regime:** EAA (EU) — owner: Fabric UI implementation; every state and control must remain keyboard and screen-reader operable.

## Design tooling

- **Figma:** disabled
- **Figma file:** none — this architecture iteration is Markdown/text-only by operator choice
- **Style pack:** `paperclip` (SHELEG style packs), adopted 2026-08-31. Its register names
  this product — "agent teams and orchestrators, scheduler and cron surfaces, job runners" —
  it is dark-first with a light twin, and it is the one pack that ships a `--terminal`
  surface, which this application hosts literally. `workbench` (the generic product-UI
  default) was the alternative and was declined for naming neither.
- **Calibration dials:** `DESIGN_VARIANCE 4 · MOTION_INTENSITY 3 · VISUAL_DENSITY 5` —
  recalibrated 2026-09-12 on the operator's explicit request for a spacious layout and gamification:
  variance down one step because the five lanes are deliberately uniform; motion up one
  step buying ONLY rare-path moments (greeting, milestone) under the frequency table —
  the console clause survives unchanged: **nothing animates beside a streaming terminal
  or on a keyboard path**; density 5 sits one step below the product-surface floor
  (6–8) as a named operator override — spaciousness is bought with progressive
  disclosure and rhythm, not emptiness ([design language](plans/2026-09-12-v1-design-language.md) §0–§1).
  Previous values `5 · 2 · 7` (2026-08-31) superseded.
- **Token layer:** `apps/desktop/src/renderer/src/tokens.paperclip.css` (copied verbatim
  from the pack) plus `tokens.app.css` (semantic aliases). Components consume `var(--…)`
  only; `scripts/check-design.mjs` enforces it.

## User stories

### ST-001: Create a persistent project
- **Story:** As P-01, I want to create a project from a starter or an empty configuration, so that its purpose and organisation persist beyond any one goal.
- **Traces:** JTBD-01, JRN-01/#1, JRN-01/#2
- **Acceptance criteria:**
  - Given no project exists for the purpose, when I save the creation review, then one persistent Project appears with its purpose, the producer-returned configuration revision and explicit setup/readiness state; a repository, PM or developer may remain unconfigured.
  - Given a PM or executor is deferred, saving creates no fabricated provider/binding, grant, Session, TaskRun or enabled routine; the next necessary setup action remains reachable.
  - Given I request managed activation, exactly one current admitted PM assignment and the capability's actual authority/readiness checks are required; missing, conflicting or unread evidence refuses activation without losing the Project.
  - Retrying the original create command reconciles its original payload and Project identity; configuration revisions are opaque equality values, never assumed to be literal `1`.
- **Amended 2026-09-17:** ADR-0061 separates saved setup from managed activation. Target acceptance only; Product evidence remains unobserved.
- **Priority:** must
- **Status:** validated
- **Product:** unobserved

### ST-002: Add or replace a project agent
- **Story:** As P-01, I want to attach a compatible agent to one project, so that I can expand its capabilities without changing its identity, routines or history.
- **Traces:** JTBD-01, JRN-01/#5
- **Acceptance criteria:**
  - Given an admitted provider and a project, when I approve its role and project binding, then the agent appears in that project only and its granted capabilities are visible.
- **Priority:** must
- **Status:** validated
- **Product:** unobserved

### ST-003: Reuse an account through scoped resources
- **Story:** As P-01, I want to connect an external account once and bind selected resources to projects, so that agents receive least privilege without repeated OAuth setup.
- **Traces:** JTBD-01, JRN-01/#3, JRN-01/#4
- **Acceptance criteria:**
  - Given an estate connection, when I select resources, access ceiling and eligible agents for a project, then only that binding is visible in the project and no credential value is displayed or stored there.
- **Priority:** must
- **Status:** validated
- **Product:** unobserved

### ST-004: Monitor all projects from one home
- **Story:** As P-01, I want to scan every project and its independent health dimensions, so that I can find what needs attention before opening a detail view.
- **Traces:** JTBD-02, JRN-02/#1
- **Acceptance criteria:**
  - Given several projects, when the estate home loads, then each card shows PM, agents, active work, attention count, last run, next run, connection health and repository state when configured.
- **Priority:** must
- **Status:** validated
- **Product:** unobserved

### ST-005: Inspect a run with evidence
- **Story:** As P-01, I want to open a running or completed execution, so that I can understand its result, proof, artifacts and unverified surfaces without reading an entire terminal transcript.
- **Traces:** JTBD-02, JRN-02/#2, JRN-02/#3
- **Acceptance criteria:**
  - Given a run, when I open it, then I see pinned project/agent/routine revisions, live state, typed result, proof, artifacts, errors and available recovery actions.
- **Priority:** must
- **Status:** validated
- **Product:** unobserved

### ST-006: Manage recurring work independently of agents
- **Story:** As P-01, I want routines to retain their schedules when an agent is replaced, so that operational cadence survives provider changes.
- **Traces:** JTBD-01, JTBD-02, JRN-01/#5, JRN-02/#2
- **Acceptance criteria:**
  - Given a routine assigned to an agent, when the project binds a replacement provider, then future runs resolve the new binding while past runs and the schedule remain unchanged.
- **Priority:** must
- **Status:** validated
- **Product:** unobserved

### ST-007: Route an observer finding to its target project
- **Story:** As P-01, I want a portfolio observer to submit an evidence-backed proposal to another project's PM, so that the target project decides its own work.
- **Traces:** JTBD-03, JRN-02/#3, JRN-02/#4, JRN-02/#5
- **Acceptance criteria:**
  - Given a finding about a target project, when its observer submits it, then the target PM can accept, refuse or supersede it exactly once and the decision remains linked to the source evidence.
- **Priority:** must
- **Status:** validated
- **Product:** unobserved

### ST-008: Invite a member into declared roles
- **Story:** As P-02, I want to invite a person with explicit estate/project roles, so that they see and resolve only the interaction points those roles address.
- **Traces:** JTBD-04, JRN-03/#1
- **Acceptance criteria:**
  - Given an authenticated owner, when they review and send an invitation, then the invitee sees the roles, visible projects, permitted action classes and exclusions before accepting.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-009: Resolve work from a role workspace
- **Story:** As P-03, I want one queue of addressed tasks with evidence and allowed actions, so that I can contribute without receiving unrelated context or credentials.
- **Traces:** JTBD-04, JRN-03/#2..5
- **Acceptance criteria:**
  - Given an unresolved interaction point addressed to my role, when I submit one allowed resolution, then it is recorded once with my actor id, policy revision and any external effect receipt and disappears from the open queue.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-010: Adapt an existing project into a provider
- **Story:** As P-04, I want a pinned bootstrap recipe to inspect and minimally adapt my existing repository, so that I receive a compatible provider bundle without surrendering its architecture.
- **Traces:** JTBD-05, JRN-04/#1..4
- **Acceptance criteria:**
  - Given a repository and chosen capability, when the recipe completes, then I receive a dry-run-approved diff, pinned manifest, fixtures and local validation report with no embedded estate secret.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-011: Create and admit a new provider
- **Story:** As P-01 or P-04, I want the foundry to scaffold and test a new provider, so that I can admit an exact revision and bind it to a project under canary supervision.
- **Traces:** JTBD-05, JRN-04/#1..5
- **Acceptance criteria:**
  - Given a locally valid provider bundle, when independent conformance passes and an owner admits it, then only that revision becomes eligible for a separately reviewed project binding.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-012: Add a provider view to a role workspace
- **Story:** As P-02, I want to place a provider's scoped view into a role workspace, so that members get a useful interface without granting the provider control of the host.
- **Traces:** JTBD-06, JRN-03/#2..4
- **Acceptance criteria:**
  - Given an admitted provider view with a structured fallback, when I add it to a role layout, then the review names its data/tool scope and eligible roles, constrains placement to non-overlapping grid spans, preserves a canonical keyboard/focus order and previews narrow linearization before the layout revision is saved.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-013: Resolve a customer request through agent and human roles
- **Story:** As P-02, I want routine customer questions answered automatically and sensitive/unresolved cases handed to support with context, so customers receive timely help without giving the agent unlimited authority.
- **Traces:** JTBD-07, JRN-03/#2..5
- **Acceptance criteria:**
  - Given an inbound customer request, when the support provider cannot safely close it, then one deduplicated interaction reaches the support role with customer/context/evidence/SLA and the final response/effect receipt links back to the request.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-014: Turn a production signal into a verified release
- **Story:** As P-01, I want production failures routed through diagnosis, implementation, tests, release approval and monitoring, so incidents close on observed recovery rather than a developer's completion message.
- **Traces:** JTBD-02, JTBD-07, JRN-02/#1..5
- **Acceptance criteria:**
  - Given a sourced production failure, when the product project accepts the finding, then the resulting graph retains the signal, independent checker verdicts, release grant/receipt and post-release observation before the incident resolves.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-015: Turn research into governed publication and feedback
- **Story:** As P-02, I want research, content, SEO and channel roles to produce and validate publication artifacts, so growth work is timely while every public claim and effect remains reviewable and measurable.
- **Traces:** JTBD-07, JRN-02/#3..5
- **Acceptance criteria:**
  - Given a scheduled research run, when a topic is accepted, then drafts, SEO validation, publication authorization/receipt and subsequent analytics/Search Console observations remain linked as one content cycle.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-016: Connect an external agent through scoped MCP access
- **Story:** As P-01 or P-02, I want to issue revocable MCP access for explicit Projects and operations, so that an external agent can read current state, submit information and start permitted Runs without receiving Estate-wide authority.
- **Traces:** JTBD-08, JRN-05/#1..5
- **Acceptance criteria:**
  - Given I am an Estate owner, when I review and create an MCP access binding, then its credential is revealed once and its detail continues to show Projects, scopes, expiry, status and audit without showing the secret.
  - Given a connected client, when it requests an allowed resource or command, then the result links to the same Project projection, policy decision and command/Run receipt as an equivalent internal request.
  - Given a revoked, expired or out-of-scope credential, when the client calls Fabric, then no read or mutation occurs and the denial is visible without exposing the credential.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-017: Work inside a project's hosted terminal
- **Amended 2026-09-11 (UXA-C06) — the SURFACE moved, the need did not.** The criteria below
  say "terminal tab", and SCR-23 was superseded on 2026-08-31 by SCR-25: sessions are detached
  windows, so closing one never ends the session it shows. The story stands as written — a
  live, typeable session per project, inside the product — and SCR-25 is what satisfies it.
  The criteria are kept in their original words rather than rewritten, because a contract
  edited to match what shipped stops being one; what changed is recorded here instead.
- **Story:** As P-01, I want a live, typeable Claude Code terminal per project inside the product, so that one window covers the estate and the sessions working on it and I never open a second application to see or steer an agent.
- **Traces:** JTBD-02, JRN-02/#1
- **Acceptance criteria:**
  - Given a project with a bound repository, when I open its terminal tab, then a real PTY session starts in that project's working directory, I can type into it, and `terminal.opened` is journalled.
  - Given the app window is closed and reopened, when the session was still running, then the tab reattaches to the same PTY without losing the session.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-018: Approve or refuse a floored or escalated action
- **Story:** As P-01, I want every action the goal's autonomy level or the floor cannot answer to arrive in one approval queue with its evidence, so that a thirty-second decision costs thirty seconds and nothing floored ever happens silently.
- **Traces:** JTBD-02, JRN-02/#2
- **Acceptance criteria:**
  - Given a node blocked on a question, when I open the queue item, then I see the node, its goal's autonomy level, the requested action class and the evidence, and my resolution resumes the node and is journalled with a receipt.
  - Given a floored action (money, deletion, outward publication) with no matching grant, when it is attempted, then it is refused with a receipt and appears in the queue as a refusal, never as a pending approval that defaults open.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-019: Keep several projects open at once
- **Story:** As P-01, I want projects open as tabs, so that I can move between the work of several projects without losing where I was in each.
- **Traces:** JTBD-01, JTBD-02, JRN-02/#1
- **Acceptance criteria:**
  - Given several projects, when I open two of them, then each is a tab I can return to, and closing a tab leaves the project and its sessions untouched.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-020: Choose what holds a session
- **Story:** As P-01, I want to choose between an agent session and a plain terminal when I launch, so that the same window serves both supervised agent work and my own hands-on work.
- **Traces:** JTBD-02, JTBD-05, JRN-02/#2
- **Acceptance criteria:**
  - Given a project, when I launch, then I pick from the options available on this machine, the choice is recorded on the session's journal event, and an unavailable option is disabled with its reason.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-021: See a project's work on one canvas
- **Story:** As P-01, I want a workspace canvas per project, so that agent state, activity and results are readable in one place — and so an agent can later render its own result there without the layout moving.
- **Traces:** JTBD-02, JTBD-06, JRN-02/#1
- **Acceptance criteria:**
  - Given a project, when I open its workspace, then host-generated widgets render on a constrained grid with a layout revision, each fact tracing to its projection.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-022: Configure a project before it exists
- **Story:** As P-01, I want a new tab to preserve a project setup draft, so that I can save its purpose and first work progressively, with repositories, memory and runner choices explicit when applicable rather than hidden or compulsory before intent exists.
- **Traces:** JTBD-01, JRN-01/#1..3
- **Acceptance criteria:**
  - Given an empty application, when I open a new tab, then it is an onboarding form that creates no shared project until I save; a recoverable local draft is not a project record, and discarding it creates none.
  - Given the form, when I choose repositories, then I choose folders through the system picker rather than typing a path, and I can remove any of them before saving.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-023: Start work by saying what should happen
- **Story:** As P-01, I want to ask for work in one field and have it open a session, so that starting is writing the instruction rather than assembling a launch.
- **Traces:** JTBD-01, JTBD-02, JRN-02/#1
- **Acceptance criteria:**
  - Given a project, when I write an instruction and run it, then a session opens in the primary repository with that instruction typed in, and what I asked is recorded.
  - Given a preset, when I pick it, then its instruction fills the field and stays editable; nothing is sent until I run it.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-024: See what was asked and how it ended
- **Story:** As P-01, I want the tasks I have started listed with their outcome, so that I can reach a running session, see how a finished one ended, and ask for the same thing again without retyping it.
- **Traces:** JTBD-02, JRN-02/#2
- **Acceptance criteria:**
  - Given tasks started in this project, when I look under the field, then each shows its instruction, whether it is running or finished with which exit code, and offers its session and a reuse action.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-025: Read and correct a file without leaving the product
- **Story:** As P-01, I want to open a repository file, read it and fix something, so that a one-line correction does not require another application — and I want to be told, not overruled, when an agent changed that file while I was editing.
- **Traces:** JTBD-02, JRN-02/#2
- **Acceptance criteria:**
  - Given a file open in the editor, when the file changes on disk before I save, then nothing is written, a diff of both versions is shown, and I choose which one survives.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-026: Follow an agent without reading its transcript
- **Story:** As P-01, I want each working agent to tell me where it is in the work, so that I can follow several at once — and I want that told apart from what the system measured, so I never mistake a claim for a fact.
- **Traces:** JTBD-02, JRN-02/#1
- **Acceptance criteria:**
  - Given an agent that reports its stage, when I look at its tile, then the stage is shown under a label naming the agent as its source, beside the state and output Fabric observed.
  - Given an agent that reports nothing, when I look at its tile, then only observation is shown and nothing is invented in its place.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-027: Evaluate PassionCode.ai from the public page
- **Story:** As P-05, I want the public page to distinguish passion coding from managing agent sessions, so that I can decide whether to follow the Project model further.
- **Traces:** JTBD-09, JRN-06/#1..5
- **Acceptance criteria:**
  - Given I arrive without prior category knowledge, when I read the hero and transition section, then I can state that vibe coding controls prompts/tasks while passion coding operates Projects.
  - Given I question vendor lock-in or autonomy claims, when I inspect the operating model, then I see that Providers are replaceable, people remain accountable and current availability is stated.
  - Given I want more detail, when I reach either CTA, then I can open the GitHub organization or the named technical foundation without encountering a private-repository download promise.
- **Priority:** must
- **Status:** delivered
- **Product:** unobserved

### ST-028: See what this project remembers, and what it forgot to answer
- **Story:** As P-01, I want one surface naming every store the project keeps — facts, transcripts, context packs, retrievals — with who wrote each and when it was last read, so that the project's knowledge is an asset I can inspect rather than a black box I hope is filling.
- **Traces:** JTBD-02, JRN-02/#1
- **Acceptance criteria:**
  - Given four stores exist, when I open Memory, then each names what it holds, who wrote it and when it was last read.
  - Given retrievals that found nothing, when I read the surface, then misses are shown separately from hits, because "nobody wrote it down" and "it is untrue" are different answers.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-029: Remember why we are here, not what was typed
- **Story:** As P-01, I want a project I return to cold to open with the history of DECISIONS and why they were taken, so that I can rejoin the work without reading a transcript — and I want every line to cite what it rests on, so the summary is evidence rather than a story.
- **Traces:** JTBD-02, JRN-02/#1
- **Acceptance criteria:**
  - Given a project with journalled work, when I open it, then recent decisions are shown newest first, each citing the event, transcript or fact it came from.
  - Given a summary that cannot cite a line, when it is compiled, then that line is omitted rather than asserted.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-030: Work a board the agents keep current
- **Story:** As P-01, I want the project's work on one board that agents move themselves, so that the state of the work is a project fact rather than something I maintain — and I want each card to name who put it there and on whose authority.
- **Traces:** JTBD-02, JTBD-07, JRN-02/#2
- **Acceptance criteria:**
  - Given an agent that changes a task's state, when I look at the board, then the card has moved and names the agent that moved it.
  - Given a card, when I read it, then it names who assigned it, to whom, and the observation or request it came from.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-031: Reach the estate's manager from wherever I am
- **Story:** As P-01, I want to reach the CEO from any surface and have it already know where I am, so that a decision I take in conversation becomes a configured agent, a proposal or a recorded decision — never advice that lives only in a chat.
- **Traces:** JTBD-01, JTBD-05, JRN-01/#2
- **Acceptance criteria:**
  - Given I am inside a project, when I open the CEO, then its proposals are scoped to that project rather than to the estate.
  - Given a conversation that produces a decision, when it ends, then it has produced an artefact — a binding, a proposal or a journalled decision — or it has produced nothing and says so.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-032: Lead with the projects I actually work
- **Story:** As P-01, I want up to five projects pinned to the front of the estate home, so that a portfolio of many does not bury the two I touch today.
- **Traces:** JTBD-02, JRN-02/#1
- **Acceptance criteria:**
  - Given more than six projects, when I open the home, then favourites lead and the rest are one action away.
  - Given six or fewer, when I open the home, then no favourites step is offered at all.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-033: See what the estate has actually done
- **Story:** As P-01, I want the estate's own record — work completed, agents managed, projects under management — shown as measurements with their sources, so that the number is something I can check rather than a score the product awards itself.
- **Traces:** JTBD-02, JRN-02/#1
- **Acceptance criteria:**
  - Given a figure on the profile, when I look at it, then it names the register it was counted from.
  - Given a figure the system cannot measure, when the profile is rendered, then it is absent rather than estimated.
- **Priority:** could
- **Status:** proposed
- **Product:** unobserved

### ST-034: Understand a task without asking anyone
- **Story:** As P-01, I want each task to carry its own page — what we are doing, why, the result expected, its resources and its relations — filled in by the agents working it, so that I can rejoin any piece of work cold without interrogating an agent or reading a transcript.
- **Traces:** JTBD-02, JTBD-07, JRN-02/#2
- **Acceptance criteria:**
  - Given an agent working a task, when it learns something the task needs, then the page carries it with the agent named as its author.
  - Given I edit what an agent wrote, when I save, then my version stands and the agent's remains readable rather than being overwritten.
  - Given a note that outlives its task, when it is promoted, then it moves to project memory and the task keeps a link rather than a copy.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-035: See where the work is going, not only where it is
- **Story:** As P-01, I want goals with their tasks, and a graph showing how we reached the present state and what remains to the goal, so that I can judge direction rather than infer it from a list.
- **Traces:** JTBD-02, JTBD-07, JRN-02/#1
- **Acceptance criteria:**
  - Given a goal, when I open the plan, then its tasks are shown with what is closed, what is running and what is next.
  - Given a task with no goal, when I open the plan, then it is listed separately, because a task nobody can justify is a finding rather than work.
  - Given an edge that would close a cycle, when it is drawn, then it is refused at that moment.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-036: Know what my agents can do here, and hold them to it
- **Story:** As P-01, I want each project to show which agents, skills and MCP servers it has, and I want agents to work the board through tools rather than through prose, so that the rules they follow cannot drift from the product that enforces them.
- **Traces:** JTBD-05, JTBD-07, JRN-01/#2
- **Acceptance criteria:**
  - Given a project, when I open its harness, then its agents, skills and servers are listed with the state of each grant.
  - Given an agent that must record progress, when it does so, then it calls a tool; no instruction document is the source of that contract.
  - Given two agents in one project, when one holds a task, then the other can see that lease before starting.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-037: Watch every agent I have from one place
- **Story:** As P-01, I want every running agent across every project on one screen — who they are, what they are doing right now and where they are doing it — so that I can move between them without opening a project per agent.
- **Traces:** JTBD-02, JRN-02/#1
- **Acceptance criteria:**
  - Given agents in several projects, when I open the screen, then the ones waiting for me are at the top and the finished ones are dimmed rather than gone.
  - Given a selected agent, when I look right, then I see the project, repository, folder, branch and how much is changed — the place its work is landing.
  - Given a selected agent, when I read its history, then I see what it DID — leases, grants, effects, facts — not what it printed.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-038: Rejoin one agent cold, where its console is open
- **Story:** As P-01, I want the surface that hosts an agent's console to also carry what we are doing, its progress and plan, its open questions and the decisions I already gave it, so that I can re-enter one agent's context in seconds without unwinding its transcript or leaving the terminal.
- **Traces:** JTBD-02, JRN-02/#2, JRN-02/#3, JRN-02/#4
- **Acceptance criteria:**
  - Given an agent working a task, when I open its console — in the agents screen or in a detached session window — then panels beside the terminal show the task brief, the agent's claim beside the observed state, its open questions with wait ages, and my prior commands and answers to this agent, each line citing its journal record.
  - Given an open question addressed to me, when I answer it in the panel beside the console, then the answer is journalled, the question leaves the lane, and the agent's work resumes without me switching windows.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved
- **Source note:** the console-first shape was decided by the operator on 2026-09-12: the five lanes live wherever the agent console is open, so the detached session window carries the panels as first-class elements, never as an optional drawer.

### ST-039: Fabric welcomes me back and marks progress by measuring it
- **Story:** As P-01, I want Fabric to open my return with the measured story of what happened, to mark milestones where the record earned them, and to propose autonomy raises with the evidence behind them, so that returning feels rewarding without the product ever awarding itself anything.
- **Traces:** JTBD-02, JRN-02/#1, JRN-02/#4
- **Acceptance criteria:**
  - Given a cold open, when the dashboard renders, then the greeting band states counts and ages computed from the journal, and each fact opens its record.
  - Given a goal or milestone closes, when I next read the digest, then its milestone line appears once with its citation and never replays on a later visit.
  - Given Fabric proposes an autonomy raise, when I read the proposal, then it names the evidence that earned it and nothing changes until I decide; my refusal is journalled.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-040: Fabric is my company page, with a face I generated and a level it earned
- **Story:** As P-01, I want the dashboard to open as Fabric's profile — my generated avatar of it, its computed level, its days worked and its measured record — and I want the history below it as one timeline I can scroll into the past and expand, or read as a left-to-right node graph, so that returning feels like opening my company's page rather than a toolbox.
- **Traces:** JTBD-02, JRN-02/#1, JRN-02/#5
- **Acceptance criteria:**
  - Given a cold open, when the dashboard renders, then the identity block shows the avatar, «Fabric · CEO», the level WITH its formula and register inputs, and days worked — before any lane.
  - Given I generate my Fabric, when I pick a style and generate, then the avatar becomes mine everywhere it appears, and neither the look nor the name changes any authority.
  - Given the decisions view, when I open it, then one timeline leads with «мы сейчас здесь» and scrolls into how we got here, each entry expanding to its grounds; the graph beside it shows the same records as nodes growing left to right.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

## Agent registry, in-machine protocol, pipelines, traces · 2026-09-29

Source: [brief](../evidence/specs/2026-09-29-agent-registry-brief.md) (REQ-01…REQ-24) and the
approved [design](../evidence/specs/2026-09-29-agent-registry-design.md). The operator talks to
Fabric and observes; these stories keep every agent replaceable and every call receipted.

### ST-041: See every agent on my Mac in one registry
- **Story:** As P-01, I want one place in Fabric that lists every agent available on this Mac — the coding agents I installed, my own agents, and Fabric's agents — with what each can do and whether it is healthy, so that I and Fabric know what we can use without remembering it.
- **Traces:** JTBD-05, JRN-04
- **Acceptance criteria:**
  - Given agents from the runner catalogue, `services/`, `providers/` and Fabric itself, when I open the registry, then each appears once in its group (coding agents, your agents, Fabric agents) with version, health and capabilities.
  - Given an agent whose manifest is invalid or whose port answers as another service, when I open it, then the card names that problem and offers no use action.
  - Given an agent with a service, when I choose Open dashboard, then it opens in Fabric Dashboards, or I am told Fabric Dashboards is not installed.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-042: See MCP servers apart from agents
- **Story:** As P-01, I want the MCP servers on this Mac listed separately from agents, from Project Observatory's inventory, so that I see which tools my agents can reach without mistaking a tool for an agent.
- **Traces:** JTBD-02, JRN-02
- **Acceptance criteria:**
  - Given Project Observatory is installed, when I open MCP servers, then each server shows where it is declared, its transport and whether it answers.
  - Given Observatory is absent, when I open the tab, then I see Fabric's own servers and one line recommending Observatory.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-043: Give Fabric any task and let it choose who does it
- **Story:** As P-01, I want to tell Fabric what I need in chat and have it choose the project (or create one), the agents and the tools, bringing an agent into a project when needed, so that I work with one CEO instead of configuring agents.
- **Traces:** JTBD-07, JRN-02
- **Acceptance criteria:**
  - Given a task in chat, when Fabric answers, then it names the project, the agent or pipeline and why, before anything with an effect starts.
  - Given the chosen agent is not in the project, when Fabric proposes it, then one confirmation runs its admission probes and binds it, or names the failed gate.
  - Given a job starts, when I look at the project, then the job shows its state and its trace until it ends with a result envelope.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-044: Answer an agent where it waits for me
- **Story:** As P-01, I want an agent's question ("pick a title variant") to reach me as one addressed choice, answered by Fabric itself when I allowed it, so that work never stalls silently and never proceeds on a guess.
- **Traces:** JTBD-07, JRN-02
- **Acceptance criteria:**
  - Given a job returns `input_required`, when it reaches Fabric, then an interaction point appears in the project and in my attention list with the agent's options.
  - Given the point is delegable, when Fabric answers, then the answer and its reason are recorded and I can see them.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-045: My agents and my coding agents work through Fabric
- **Story:** As P-01, I want Claude Code, Codex and my own agents to reach Fabric's projects and each other through Fabric's MCP, within the scope I granted, so that one protocol connects everything and every call is traced.
- **Traces:** JTBD-08, JRN-05
- **Acceptance criteria:**
  - Given a coding agent in the runner catalogue, when Fabric connects it, then its MCP config gains Fabric's entry with a scoped credential in a header.
  - Given an agent calls another through Fabric, when the call is outside its grant, then it is refused with the reason and recorded.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-046: Change what I see by asking the floating CEO
- **Story:** As P-01, I want the floating Fabric to know which screen and selection I have open, so that "rename this", "swap this agent" or "add a checker here" just works, with only tiny direct controls on the screen itself.
- **Traces:** JTBD-02, JRN-02
- **Acceptance criteria:**
  - Given a pipeline open, when I ask Fabric to change a stage, then it proposes the change on that pipeline and applies it only when I confirm.
  - Given a list, when I drag, rename, toggle or pin, then the change applies directly and is recorded.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-047: Pipelines Fabric composes, that I approve and reuse
- **Story:** As P-01, I want Fabric to compose chains of agents and tools as versioned pipelines — per project or global — that I see as a graph and approve, so that repeated work runs the same proven way.
- **Traces:** JTBD-07, JRN-02
- **Acceptance criteria:**
  - Given a proposed pipeline, when it is shown, then every edge passed the compatibility check, every effect has a checker upstream, and the graph has no cycle — or the failing edge is named.
  - Given a global pipeline, when a project uses it, then it runs with that project's bindings, and replacing an agent changes no stage.
- **Priority:** must
- **Status:** proposed
- **Product:** unobserved

### ST-048: Read a run as one graph
- **Story:** As P-01, I want every run drawn as one graph across nested agent calls — where it began, how it branched, what failed, where it waited — so that I can debug and trust a chain without reading logs.
- **Traces:** JTBD-02, JRN-02
- **Acceptance criteria:**
  - Given a finished run, when I open it, then every call is a node with caller, callee, capability, outcome, usage and time, and any node opens its input, output and error.
  - Given an agent reported no spans, when the graph is drawn, then that part is marked incomplete rather than shown as empty success.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-049: Fabric tools and the optimizer save tokens
- **Story:** As P-01, I want scripts that replace repeated agent work — proposed by an optimizer from real traces and kept as Fabric tools per project or global — so that deterministic steps stop costing tokens and get exact.
- **Traces:** JTBD-07, JRN-02
- **Acceptance criteria:**
  - Given a proposal, when I open it, then it shows the traces behind it, the script with its test, and the expected saving; nothing changes until I accept.
  - Given a tool without a passing test, when I try to enable it, then it stays disabled with the failing fixture named.
- **Priority:** could
- **Status:** proposed
- **Product:** unobserved

### ST-050: Create or convert an agent inside Fabric
- **Story:** As P-01 and P-04, I want to ask Fabric for a new agent from a coding-agent base, or to turn a project into an agent, and get one that already speaks every protocol and is wired in, so that making agents is a project Fabric runs, not a manual setup.
- **Traces:** JTBD-05, JRN-04
- **Acceptance criteria:**
  - Given a request, when production finishes, then the agent is in the registry as your agent, admitted, with a canary binding and its evals.
  - Given a gate fails, when production stops, then the draft is kept and the failed gate is named.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved

### ST-051: Fabric remembers and cites
- **Story:** As P-01, I want Fabric to answer from our project memory — in Russian or English — with the sources it used, so that I do not repeat myself and can check what it relied on.
- **Traces:** JTBD-02, JRN-02
- **Acceptance criteria:**
  - Given a question with recorded facts, when Fabric answers, then it cites the facts or transcripts it used.
  - Given nothing is recorded, when Fabric answers, then it says so instead of inventing.
- **Priority:** should
- **Status:** proposed
- **Product:** unobserved
