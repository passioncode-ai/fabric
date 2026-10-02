# Fabric onboarding, start paths and the general plan — 2026-10-03

Run: `2026-10-03-onboarding-and-plan` · branch `claude/onboarding-and-plan` from `origin/main` `0ca25630`.
Route: task-pipeline (delivery), super-ux (scenarios, flows), sheleg-design (visual layer and icon),
copywriting (strings against `docs/brand/`), Asset Foundry (icon raster), agent-sync (guarded files),
evidence-docs (receipts).

## Operator request (2026-10-02/03, verbatim intent)

Bring the repository and the build up to date; work through Fabric's UI and its icon so everything is
in one style; make the basic mechanics work. Start with onboarding the user into Fabric, then: add an
own project, scan a projects folder, build a new project, build a new agent, or convert an old agent
into a Fabric agent. Detailed UX for every stage and every variant, no noise, good layout. Fix one
general development plan for this repository that every participant follows and extends. Bring Fabric
to a decent state, fix it, and build the plan for further progress.

Added mid-run (2026-10-03): before the DMG and the release, run **three independent testing iterations
across every level** — scenario, UI, UX, errors, code/document conformance, documentation links from
code, roadmap, documentation, the workspace publication — and fix everything found, including visual
style, data, memory, orchestration and the harness. Only then release.

## Decisions (grill, 2026-10-03)

| # | Question | Decision | Overrides |
|---|---|---|---|
| D1 | What reaches working code in this run | Onboarding + add project + scan folder + new project wired end to end; create-agent refined; convert-agent fully designed (screens, states), execution planned as the next module (AR-7/AR-11) | — |
| D2 | Scanning a projects folder | A checklist of discovered repositories; every checked one becomes its own Project; parts of one product (worktrees, submodules, nested repos) are grouped and can be split; unchecked ones stay candidates and can be imported later; nothing is created without a check | SCN-095 step 4, ONB-01 (ceo-onboarding.md) — new ADR |
| D3 | First run | Name and avatar first (Fabric persona), then executor detection, then "Where do we start" with five paths, then the project page with the first useful result | `single-entry.md:16`, `flows.md` "no personalisation form" — operator outranks, the documents are corrected in this run |
| D4 | Converting an agent | Inside Fabric with a dry-run plan; the executor writes the adapter on a branch with the Fabric Agent Adapter skills; the conformance probe decides; only a green agent enters the registry | SCN-015 recipe model becomes a non-default fallback note |
| D5 | App icon | The PassionCode mark, redrawn in Fabric's own visual language as a macOS app icon (raster through Asset Foundry, the mark as reference, variants for the operator to choose) | — |
| D6 | End of run | Notarized DMG 0.3.0 and publication on passioncode.ai — only after D7 | — |
| D7 | Release gate | Three independent full verification iterations; every finding fixed or ruled with an id; the third iteration ends with zero open blocking findings | — |
| D8 | Design surface | Code-first: `docs/ux/product-model.json` → `docs/reports/product.html` and the live app; no Figma file is recorded for Fabric (Observatory `figma_files.json` has none) | — |
| D9 | Home of the general plan | A guarded section in `docs/evidence/backlog.md` above `#build-order-by-layer`, referencing existing ids; narrative beside it in `docs/evidence/plans/`; the rule in ADR-0100; a gate that every id cited resolves | ADR-0044 §1 is extended, not replaced |

## Source ledger

| Source | Read | Finding |
|---|---|---|
| Code `apps/desktop` | recon 2026-10-03 | create project (`Onboarding.tsx#save` → `IPC.projectsCreate`), folder picker (`IPC.reposChoose`), agent from a prompt (`IPC.agentsCreate`) are wired; no first-run wizard, no folder scan, no conversion |
| `docs/ux/` | recon 2026-10-03 | all six journeys specified as draft target design, `Coverage: none yet`; three contradictions (first run ×3, scan semantics, conversion ×2); SCR-05/SCR-36/SCR-44 overloaded |
| Plan | `docs/evidence/backlog.md`, ADR-0044, plans/ | one queue home; F0–F4/F6 shipped; F5, F5A, F7 open; L3c open; launch focus AD00 → AD01/OX-01/D01; ADR-0099 reserved, next ADR-0100 |
| Design system | `renderer/src/tokens.*.css`, `check-design.mjs`, `components/registry.ts` | Paperclip + PassionCode v1.1.0 tokens; raw colours/sizes refused by gate |
| Icon | `scripts/stage-app-icon.mjs`, `assets/brand/brand-pack/` | the shared PassionCode icon, staged by hash |
| Retro | `docs/evidence/retro.md` standing instructions | R-001…R-010 bind this run |
| Graph | `graphify-out/graph.json` | present; staleness checked at stage 9 |
| Figma | Observatory `agent/figma-registry` | no Fabric file |

## REQ table

Frozen: adding is free, removing needs the operator.

| REQ | Requirement | Verified by |
|---|---|---|
| REQ-01 | Local checkout on current `origin/main`, dependencies installed, `ci.sh fast` green before changes | command receipts |
| REQ-02 | First-run onboarding: persona (name, avatar) → executor detection (Claude Code / Codex: found, version, signed-in; missing → install command; skippable) → "Where do we start" with five paths; re-entrant; never shown again once finished; persists across restart | renderer tests + main IPC tests + live app walk |
| REQ-03 | Add an existing project: folder picker → read-only preview (name, git, remote, stack, last commit) → confirm → Project created with the repository attached → project page | tests + live walk |
| REQ-04 | Scan a projects folder: pick a parent folder → bounded, cancellable scan → checklist of candidates grouped by product → each checked one becomes its own Project → unchecked stay candidates, importable later; already-imported repositories are marked, never duplicated | tests incl. a fixture tree + live walk |
| REQ-05 | Create a new project: name → location (new folder, optional `git init`) or idea-only → Project created → project page | tests + live walk |
| REQ-06 | Create a new agent: the existing flow tidied to the same visual language, every state (empty, invalid, saving, failed, created) | tests |
| REQ-07 | Convert an agent: full scenario, flow, screens and states designed (dry-run plan, branch, probe, registry admission); entry visible in the start screen as a planned path that says it is not yet available, with no fake action | docs + product model + tests on the entry |
| REQ-08 | Scenarios, flows, screens and product model updated and contradictions resolved (D2–D4), with ADR-0100 (scan/onboarding) and ADR-0101 (general plan) or one ADR covering both | `docs/ux/lint.py`, `sync-product-ux --check`, `build-product-report --check` |
| REQ-09 | Visual pass: the new screens and the home/start surfaces in one language, no noise; design gate green; checked in light and dark | `gates:design` + screenshots of the live app |
| REQ-10 | App icon: PassionCode mark in Fabric's style, staged in dev, the .app and the DMG | `stage-app-icon` hash + `iconutil`/Finder check on the built .app |
| REQ-11 | Strings through the brand pack, en and ru; no new `ru-baseline` debt | `docs/brand/lint.py`, i18n gate |
| REQ-12 | Code regions: new code fenced with `#region … docs:` pointing at its scenario/spec | `check-regions.mjs` |
| REQ-13 | General development plan in the backlog, ids resolving, gate added and watched failing on a planted dangling id | `check-registers.mjs` (or new gate) + plant |
| REQ-14 | Living map entry, MERGES entry, workspace published and pinned | `check-design-map.mjs`, `workspace.mjs check --require-child` |
| REQ-15 | Three independent verification iterations across all levels (scenario, UI, UX, errors, code↔docs, doc links in code, roadmap, documentation, workspace; data, memory, orchestration, harness, visual style); every finding fixed or ruled with an id; iteration 3 ends with zero open blocking findings | three dated iteration reports + ledger |
| REQ-16 | Notarized DMG 0.3.0 built from the final `main`, installed on this Mac and walked through onboarding | `release-mac.mjs` receipt, `spctl`, live walk |
| REQ-17 | Publication on passioncode.ai: download link serves 0.3.0 | `curl -I` on the download URL + site gate |
| REQ-18 | Handoff: tracked entry with objective, done, open, decisions, checks and the exact next task | handoff file + pushed branch |
| REQ-19 | The provider-capability pin stops `ci.sh` and the workspace publication after every Claude Code self-update (2.1.286 → 2.1.287 on 2026-10-02, → 2.1.288 on 2026-10-03). A tested command repins version-only rows from the measured `--version` when no current row holds a verified verdict, and refuses otherwise; the gate names it | unit test with a verified-row plant + gate message |

## General plan

The lanes live in [the backlog](../backlog.md#general-development-plan) (ADR-0101); this is why they
are in that order.

1. **Start first.** Nothing else in Fabric is reachable until a person can bring a project in. Before
   this run the only door was one form; the first run and the start paths make every later lane
   testable by a new person on a clean Mac.
2. **The release gate before more features.** The operator set it on 2026-10-03: three independent
   verification iterations, every finding fixed or ruled, then the release. It is a lane, not a
   habit, so it cannot be skipped by a later lane in a hurry.
3. **Real providers before the agent registry.** The registry (AR-2) and conversion (AR-7, AR-11)
   describe agents by what they can do; N1 and M199 are where those capabilities are first measured on
   the real CLIs instead of assumed. Building the registry first would list capabilities nobody saw.
4. **Agents, then the manager loop.** Retrospectives and the manager (F5 batch) learn from runs; they
   need agents that are registered and converted, with receipts, to learn from.
5. **Launch fit in parallel.** AD00 → AD01/OX-01/D01 and L3c touch the launch surfaces, not the
   provider or registry code, so they run beside lanes 3–4 where the files do not overlap.
6. **Reach last.** Connectors and the S4–S6 slices multiply whatever the loop does — they go after the
   loop produces receipts, so they multiply something verified.
7. **V1 rows keep their own order** inside their table; the plan does not re-sequence them.
