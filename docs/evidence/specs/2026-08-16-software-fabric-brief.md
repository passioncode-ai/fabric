# Task brief — software-fabric

> Stage-0 intake artifact. Confirmed by the operator before stage 1.

> **Historical baseline:** this brief remains frozen as the provenance of the first
> architecture run. [ADR-0013](../../adr/0013-project-is-a-persistent-agent-workspace.md)
> supersedes its Goal → Project hierarchy: a Project is now the persistent workspace,
> and goals, routines, graphs, agents and runs live inside it.

- **Date:** 2026-08-16
- **Task (one line):** build the operator's software fabric — an asset and domain
  registry, a goal graph decomposing to arbitrary depth, and a CEO agent that hires
  and runs terminal agents against it, on a local desktop with a dashboard.
- **UI verdict:** **yes** — a local dashboard is required from the first visible
  milestone. The stage-3 UX, COPY and VISUAL tracks are armed, and gated (below).

## Knowledge sources (phase-1 harvest — written BEFORE the first question)

| Source | What it says about this task | Fresh? | Authority | Stale after this run? |
|---|---|---|---|---|
| `$HOME/DATA/software-fabric` | empty directory, greenfield | 2026-08-16 | code | no |
| `~/CLAUDE.md`, `~/.claude/CLAUDE.md` | machine layout, skill family, routing, quality bar, ops autonomy | 2026-08-16 | convention | no |
| wiki `concepts/graph-shaped-agent-work.md` | node/edge doctrine, the fake-edge test, the checker node, **static graph where a run must be auditable** | 2026-08-15 | context | no — honoured in ADR-0005 |
| wiki `projects/` (37 pages) | holds five of the operator's other projects that are absent from `~/DATA` | 2026-08-15 | context | **yes — stage 9 adds `projects/software-fabric/`** |
| the operator's personal-assistant system (2328 commits) | already an operator OS: `agents/` (5), `routines/` (4 YAML), `memory/projects/` (2 files), Linear backlog | 2026-08-13 | code | no — boundary set in ADR-0001 |
| the operator's Linear team | 10 projects, 5 `canceled` — including the live flagship product and another project's website repository that committed today | **stale** | context | **yes — recorded as wrong; not fixed by this run (out of scope)** |
| the flagship's SEO-agent repository | its ADR-0001 audience is a portfolio owner; its ADR-0009 (2026-08-15) names the flagship's domain as the product home; Prisma models `Property`/`Observation`/`ChangeEvent`; `docs/audit/` holds five diagnosed production defects | 2026-08-16 | context | no |
| `agent-sync` v1.11.1 | leases with TTL, race-free id reservation, run journal, generated board | 2026-08-14 | convention | no |
| Cloudflare API (3 accounts) | **66 zones**, not the 33 the operator pasted; DNS record sets per zone | measured 2026-08-16 | observation | no |
| HTTP probes, 40 domains | 15 live, 7 error, 1 parked, 8 empty-zone, 4 mail-only, 5 no-zone | measured 2026-08-16 | observation | no |
| DigitalOcean API | 2 apps: the flagship's app → its domain (fra, professional), the flagship's SEO agent → a subdomain of it (sfo, basic) | measured 2026-08-16 | observation | no |
| `gh repo list ssheleg` | 49 repos; several live sites have source only there (three of the operator's other projects) | measured 2026-08-16 | observation | no |
| `docs/evidence/{backlog,verification,retro}.md` | **none found** — seeded by this run | — | — | no |
| `graphify-out/graph.json` | **not built** — repository has no code yet; `/graphify .` after the first module | — | index | build at stage 9 |

**Two sources were proved wrong by measurement during the harvest** and are recorded
as such: Linear's project states, and the personal-assistant system's project memory as a
portfolio register. Neither is repaired by this run — ADR-0001 puts both out of
scope — but neither may be cited as true by a later one.

## Documentation (phase-1b inventory)

| Question | Answer |
|---|---|
| **Regime** | governed — seeded this run |
| **Decision home** (exactly one) | `docs/adr/` (`ADR-NNNN`). No `docs/DECISIONS.md`. |
| **Open questions** | `docs/OPEN_QUESTIONS.md` — seeded at stage 2 when the first one outlives a stage |
| **Doc map** | `docs/DOCMAP.md` — written at stage 2 alongside the module map |
| **Gate** | `scripts/check-docs.sh` — written at stage 5 with the first module |
| **Shared state** | `agent-sync` initialised this run; before that the run is `ungated` and says so |
| **Intent vs as-built** | first reconcile at stage 9 |

- **Doc repos this project names:** none. The flagship SEO agent's `docs/audit/` is read, never written.
- **Knowledge wiki:** installed — stage 9 writes `projects/software-fabric/`.
- **Retro, in force:** seeded empty this run; no standing instructions bind it.
- **Code graph:** not built; build after the first module ships.

## Scope

**In scope**

- The asset registry over the **personal** and a **second personal** Cloudflare account plus the
  five Namecheap-only domains — 40 assets — with every state field measured.
- The repository inventory over `~/DATA` (71 entries, 60 git repos, measured 2026-08-16).
- Supabase as the single store; the declared layer mirrored to git.
- The goal graph: goals to arbitrary depth, projects, nodes, typed payload-bearing
  edges, versioned rebuilds.
- Departments, the agent roster, agent hiring, and terminal execution
  (Claude Code first).
- The CEO agent: reads the estate, proposes and decomposes goals, hires, escalates.
- Own collectors: Cloudflare, HTTP probe, GitHub, Google OAuth + Search Console, GA4.
- A local dashboard, and escalation to Telegram / macOS / dashboard queue / webhook.

**Out of scope / explicitly deferred**

- A corporate account (31 zones, out of scope). Recorded in the registry as visible and
  unmanaged; not watched, not acted on.
- The operator's personal-assistant system and Linear — neither read nor written (ADR-0001).
- Any cloud deployment. The control-plane ↔ runner seam is a contract from day one so
  the move is a deployment, not a rewrite; **latest it can be decided:** before the
  first collector runs on a schedule.
- The desktop shell choice — Electron end-to-end versus a local web UI over a
  privileged daemon. **Latest it can be decided:** stage 2, before the dashboard
  module is specified. Leading option recorded: local web UI + privileged daemon,
  Electron wrapper later.
- Repairing the seven broken properties. Finding them is this run; fixing them is the
  fabric's first real goal, not part of building it.

## Requirements (the REQ spine)

| ID | Requirement | How it's verified | Status |
|---|---|---|---|
| REQ-001 | The registry holds all 40 in-scope assets with a measured state each | `pnpm registry:verify` re-measures Cloudflare + HTTP and exits 0 on agreement | open |
| REQ-002 | Refreshing observed fields never touches declared fields | test `registry-refresh-preserves-declared` | open |
| REQ-003 | Repository inventory: every git repo under `~/DATA` with remote, last commit, dirty count | `pnpm collect:repos` output diffed against `git log` for 3 sampled repos | open |
| REQ-004 | Assets with a live site and no local source are flagged as orphans | query returns exactly the 6 recorded in `registry/domains.yaml` | open |
| REQ-005 | Namecheap inventory is complete | count in registry equals the operator's export; **blocked on a Human step** | open |
| REQ-006 | Schema for asset, project, goal, node, edge, department, agent, observation, decision | `supabase db reset` succeeds from empty | open |
| REQ-007 | Declared layer round-trips: DB → YAML → fresh DB with no loss | test `declared-layer-roundtrip` | open |
| REQ-008 | Goals decompose to arbitrary depth | recursive-CTE test returns a full 5-deep subtree | open |
| REQ-009 | An edge with no payload label is rejected | DB constraint + test `edge-requires-payload` | open |
| REQ-010 | A running graph is immutable; a rebuild emits a new version with predecessor and reason | test `graph-rebuild-versions-not-mutates` | open |
| REQ-011 | The floor refuses money, deletion and outward publication at `maximum` | test attempts each floored action at `maximum` and asserts refusal | open |
| REQ-012 | A grant opens exactly one named action, one target, with an expiry | tests: grant honoured; grant expired; grant scoped to another target refused | open |
| REQ-013 | Cloudflare collector over both in-scope accounts, watermarked after the data | test `watermark-written-after-rows` + a crash-injection test | open |
| REQ-014 | HTTP prober records status, title and final URL per asset | test against a local fixture server incl. 503, 525, redirect | open |
| REQ-015 | GitHub collector: repos, last commit, open PRs | `pnpm collect:github`, spot-checked against `gh` for 3 repos | open |
| REQ-016 | Search Console collector, with the four known traps covered | tests: 5 000-row day ceiling; watermark-after-data; no backfill of quiet properties; wildcard `robots.txt` honoured | open |
| REQ-017 | GA4 collector | test against a recorded fixture response | open |
| REQ-018 | Nothing is stored that the source can re-serve, except history the source discards | per-collector retention note + test asserting no full-page bodies in the store | open |
| REQ-019 | Departments carry instructions and a skill set | fixture department produces the expected agent brief | open |
| REQ-020 | The CEO can hire an agent of a department, recorded with its skills | test `ceo-hires-agent-of-department` | open |
| REQ-021 | The runner spawns a real Claude Code agent in a workspace, streams output, records exit | integration test: agent creates a file in a temp workspace, exit recorded | open |
| REQ-022 | Node lifecycle under leases: claim, run, result, failure, retry, escalate | concurrency test: two runners, one node, exactly one claim | open |
| REQ-023 | The CEO decomposes a goal into a graph and assigns an agent per node | acceptance: one real goal from the estate decomposed end to end | open |
| REQ-024 | The dashboard shows the asset map, each state citing its observation | scenario `SCN-…`, checked in a browser via chrome-devtools | open |
| REQ-025 | Every escalation lands in the dashboard approval queue with its context | scenario + test | open |
| REQ-026 | Notifications reach Telegram, macOS, the queue and the webhook; approvals return by the channel that asked | integration test per transport | open |
| REQ-027 | Service terminals (Claude Swap, agentgateway) appear on the same board | dashboard shows both with a live health reading | open |

Status lifecycle, written at three checkpoints only (stage 4, 5, 10):
`open` → `planned` → `built` → `verified` | `partial` | `deferred` | `dropped`.

> **Frozen.** Appending is free. Removing or narrowing a row needs the operator's
> explicit agreement, recorded in the carry-over ledger.

## Users & context

- **Who:** one operator, running a 40-domain / 60-repository estate
  alone. Secondary reader: the CEO agent, which consumes the same registry.
- **Where it runs:** macOS desktop. TypeScript + pnpm + Vitest; Supabase local stack
  in Docker (API 54321, DB 54322, Studio 54323). Cross-platform JavaScript for the
  shell — Rust ruled out by the operator on cost.
- **Constraints:** terminal agents must execute where the repositories and
  credentials are, so the runner is local by necessity, not by preference.

## Decisions locked

| # | Decision | Chosen | Rationale |
|---|---|---|---|
| 1 | Boundary against the personal-assistant system and Linear | own layer, own store, writes to neither | ADR-0001 |
| 2 | Substrate | local now, control-plane ↔ runner seam as a contract | agents need local creds; cloud later is a deployment |
| 3 | Store | Supabase (Postgres + pgvector), declared layer mirrored to git | ADR-0002 |
| 4 | Ontology | asset ≠ project; 9 types | ADR-0003 |
| 5 | Autonomy | goal field over a schema floor, grants as the only exception | ADR-0004 |
| 6 | Graph rebuilds | new version, never a mutation | ADR-0005 |
| 7 | Google data | own OAuth and own collectors; reuse the audit knowledge, not the code | ADR-0006 |
| 8 | Language | TypeScript + pnpm + Vitest | every modern repo in the estate already is |
| 9 | Interface | dashboard from the first visible milestone; shell choice deferred to stage 2 | operator requirement |
| 10 | Notifications | Telegram + macOS + dashboard queue + outgoing webhook; the queue is the canonical journal | a channel without a journal loses what was scrolled past |
| 11 | Docs language | English, matching every other repo in the estate | operator may override |

## Autonomy (the sweep)

| Stage | Question | Answer |
|---|---|---|
| run-wide | Model | Opus 5 (1M) for the whole run; no per-stage overrides |
| run-wide | Escalation | decide alone while it stays in this repository and is reversible; escalate money, outward acts, anything under the operator's name |
| run-wide | Pacing | **iteration → show → operator says continue.** Not item-by-item without a check-in. The operator's stated condition: every iteration must be touchable |
| 0 Harvest | Doc sources beyond this repo | wiki (stage 9 writes `projects/software-fabric/`); the flagship SEO agent's `docs/audit/` read-only; graph not built |
| 0 Duplicates | which copy the build reads | n/a — greenfield, single tree |
| 0 Fixtures | recreate command | `supabase db reset` — migrations + seed from zero. Local Docker stack is the only persistent state |
| 0 Source | `git rev-list --count HEAD..@{u}` | n/a — repository initialised this run, no upstream yet. Remote `ssheleg/software-fabric`, private, created at the first push |
| 0 Work-list | register + read command | `docs/evidence/backlog.md`; later the goal graph itself |
| 0 Setup audit | entry audit over existing docs | **no** — greenfield, nothing to audit. Recorded, not re-asked |
| 0 Docs regime | home, writer, lease, gate | `docs/adr/`; `agent-sync` initialised this run; `scripts/check-docs.sh` at stage 5 |
| 1 Docs | libraries to fetch via context7 | Supabase CLI + migrations + pgvector + RLS, Google OAuth, Search Console API, GA4 Data API, Cloudflare API, GitHub API, node-pty, Next.js, Vitest |
| 2 Decompose | platform or module | **platform** — module map at stage 2, walking skeleton first, no deploy cadence (nothing ships outward yet) |
| 2–3 Spec | UI verdict | yes — UX + COPY + VISUAL tracks armed |
| 3 Design surface | Figma on or text-only | **STOP AND ASK** — gated: the dashboard module may not enter stage 3 until answered. Figma MCP is connected |
| 3 Design file | team + file | **STOP AND ASK** — no file recorded; nothing will be created without a named team and explicit authorization |
| 4–5 Dev | branch policy | base `main`; work in `feat/<module>`; Conventional Commits; `main` not off-limits but reached by PR |
| 5 Integration | how the branch lands | PR, merged by the agent when lint and the full suite are green (operator granted this at grill Q7) |
| 6 Tests | command and meaning of green | `pnpm test` (Vitest) — **the whole suite**, plus `supabase db reset` for migrations. No known-red baseline |
| 7 Lint | command | `pnpm lint` (ESLint) + `pnpm typecheck` (`tsc --noEmit`) |
| 7 Deploy | target and authorization | **nothing outward on the early milestones** — all local. First outward target: **STOP AND ASK** |
| 8 Post-deploy | logs and health | local: `supabase status`, the runner's journal, the dashboard health panel |
| 9 Docs+wiki | what gets updated | module docs; wiki `projects/software-fabric/`; `/graphify .` after the first module |
| 10 Acceptance | sign-off and deferrals | the operator signs off; deferrals go to `docs/evidence/backlog.md` |

## Human steps

Only what genuinely needs a person. Not spread through the run — collected here.

1. **The full Namecheap inventory.** Supplied so far: the alphabetical tail
   `site-k.example` → a `.trading` sibling of `site-l.example`, 12 rows. Needed: a CSV export from the panel,
   or a Namecheap API key with this machine's IP allow-listed. Blocks REQ-005.
2. **A Google Cloud project and OAuth client** for Search Console and Analytics.
   Blocks REQ-016 and REQ-017.
3. **Figma: team/organization name**, if the dashboard is designed visually. Blocks
   the dashboard module's stage 3 — deliberately, so it cannot ship undesigned.

## Done-criteria

- `pnpm registry:verify` exits 0 against a live re-measure of all 40 assets.
- `supabase db reset` builds the schema from empty and the declared YAML restores
  every declared row.
- The floor refuses all three floored action classes at `autonomy_level = maximum`,
  proven by a test that was watched failing when the constraint was removed.
- One real goal from this estate — the seven broken properties — is decomposed by the
  CEO into a graph, assigned, and executed to the first escalation.
- The operator has looked at each milestone and said continue.

## Open assumptions / risks

| Assumption | How it is validated | If wrong |
|---|---|---|
| `site-p.example` serves from a Pages project in a fourth Cloudflare account | ask the operator, or check other accounts | the 200 is cached and the site is already gone |
| the `.spot` sibling of `site-l.example` is a real domain | `.spot` is not a delegated TLD; check the Namecheap panel | one registry row is a transcription error |
| Terminal agents can be spawned and controlled headlessly from a daemon at the fidelity needed | spike in the runner module before REQ-021 is specified | the shell choice changes, and stage 2's deferred decision is forced early |
| the flagship SEO agent's `docs/audit/` lists all the collection traps worth carrying | read it at stage 1; treat the list as a floor, not a ceiling | REQ-016 ships with a defect class nobody named |
| Cloudflare "unique visitors" is bot-heavy and unusable as a demand signal | replace with the Analytics API; compare a live property's GA4 against it | prioritisation by traffic is prioritisation by crawler |
