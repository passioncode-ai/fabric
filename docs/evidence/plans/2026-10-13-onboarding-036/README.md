# Fabric 0.3.6 — onboarding that lands in a working project (plan, 2026-10-13)

**Objective (the operator, 2026-10-13).** Open Fabric, set up the whole zone in one pass — who I am, which coding
agents work for me, which PassionCode tools I use — then open a folder, let Fabric find every project I work on,
choose which of them Fabric works on, and land in a project where an agent is already writing on its board. Every
start action is redesigned and drawn: create a project, open a project made of one or several folders, scan a
projects folder, create an agent, adapt an agent. Released as **0.3.6 from `main`**, in task-pipeline waves.

**Decisions recorded (operator, 2026-10-13, this session):** the first run's order is persona → coding agents → connection and tools → projects → the first project at work — this supersedes the order of REQ-39 / SCN-126's 2026-10-11 rewrite (projects folder before agents); ADR-0135's rule stands (setup runs in the person's coding agent); 0.3.6 from `main` (the COM work already on `main` ships
with it); products are **found and offered** — Fabric installs nothing without the person's press, and checks that an
install worked; coding agents ticked by default are the **found and ready** ones, the default being the first ready in
the fallback order (ADR-0125) with the reason beside it; design is drawn as the **in-repository prototype**
(`docs/reports/product.html`, `scripts/product/`), not in Figma.

**Inputs.** [Wave 0 funnel review](wave-0-funnel-review.md) (23 findings); the real-app walk in Russian
(`scripts/walk/start-paths.mjs`, recorded beside it); SCN-126…SCN-131, SCN-136; 0.4.0's REQ-39, REQ-40, REQ-41
([plan](../2026-10-11-release-040-agents-first.md)) — this run builds them; ADR-0100, ADR-0125, ADR-0129, ADR-0134;
[products](../../../../workspace/knowledge/products.md).

## The canvas — the target state

### 1. The first run is one wizard of five steps, resumable

| Step | What the person does | What Fabric does |
|---|---|---|
| 1 · Знакомство | names Fabric, picks a character (one row; variants live in Profile), picks the language | keeps it; nothing else is asked |
| 2 · Агенты | sees every coding agent on this Mac as a compact row — ready, needs sign-in, not installed — with the ready ones ticked and one marked default (and why); can untick and change the default | keeps the ticks and the default as the fallback order (ADR-0125); not-installed rows fold into «Ещё N агентов» with how to install |
| 3 · Подключение | sees what makes the agents work with Fabric and the PassionCode tools — Fabric's MCP in each ticked agent, the Fabric Agent Adapter skills, Project Observatory, Fabric Dashboards, Fabric Switchboard, Fabric Inbox — each with one line of what it gives, marked done / installed / running / not yet, the missing ones ticked | «Подключить» opens the Setup console on the default agent, which installs and registers the ticked items on the person's consent there (ADR-0135 §3: Fabric itself installs nothing and writes no agent's configuration); Fabric observes and shows each row's outcome; every row can be skipped with what is lost |
| 4 · Проекты | chooses how projects arrive: **Scan a projects folder** (primary), **Open a project** (one or several folders), **Create a project** | runs that path inside the wizard (§2, §3) |
| 5 · Старт | picks the first project to set up (default: the most recently active) | starts the setup session on the default connected agent in that project and opens the project: the agent reads the repository, posts a note to the project's board (`com.submit`, kind note), files its first tasks; the board and the feed show it live |

The first run is recorded finished only after step 5 or an explicit «Закончить позже»; the step reached is kept, so a
quit resumes there (F-04). With no ready agent, step 5 opens the project without a session and says what to install
(F-09).

### 2. Scan a projects folder — find, group, choose what Fabric works on

- **One picker, one folder** — the folder where the person keeps projects (last location remembered, full path with
  Change…). Read-only, bounded, cancellable, with a live count, a «slow» line after 10 s and a «denied» state with
  Open System Settings (F-06).
- **Grouped for a person with many repositories and much junk:** sections by **owner** from the git remote
  (`github.com/passioncode-ai`, `github.com/ssheleg`, …, largest first), then **Local repositories** (no remote),
  then **Folders without git** (collapsed, unticked). Inside a section one row per **product**: name, one line of
  what it says it is, last activity («3 дня назад»), badges for uncommitted changes and worktrees; its worktrees and
  nested repositories fold under it (F-05).
- **Ticked by default = active:** a product head with a commit in the last 30 days or uncommitted changes is
  ticked; older ones are unticked and say «давно не менялся». Per-section «Отметить все», a filter and «Только
  активные».
- **The choice is the tracking decision.** Ticked → a Project: Fabric works there (the harness, the board, agents
  enroll). Unticked → remembered as found but not tracked; `fabric-mcp` in that folder answers «not a project»; the
  Projects list says «Найдено, но не отслеживается: N» and adds any of them later. A tracked project can be paused
  later (priority tier `paused`), which is not removal.
- **Result:** every imported project listed with Open; the first-run's step 5 follows; outside the first run, «Set up
  {name} with the agent» starts the same session (F-02, F-07).

### 3. Open a project — one project from one or several folders

The system picker allows several folders at once. The chosen folders are listed (Add another… / Remove each), the
first is primary and can be changed, the name comes from the primary's repository. One Project holds them all
(`projects.create` `repoPaths[]`; `repos.attach`, `repos.detach` on its page). A folder already in a Project says so
and opens it (REQ-04).

### 4. Create a project · create an agent · adapt an agent

Kept as SCN-129, SCN-136, SCN-131, redrawn in the same wizard frame (progress, Back, one primary), the adapter skills
already installed by step 3 (F-10), errors through `explainError` (F-16), the new-folder action with its own git
switch (F-17), the same radio rows for choosing an agent everywhere (F-20).

### 5. The system and the project as the person sees them

- **The start menu** (after the first run): two groups, one primary — Проект: Сканировать папку с проектами (primary),
  Открыть проект, Создать проект; Агент: Создать агента, Адаптировать агента. Card titles say what you get, buttons
  are verbs (F-03, F-08, F-19). One name for Home (F-12); the sidebar entry is «+ Начать» (F-13).
- **The sidebar's projects** carry a heading with the count, a filter and the owner groups the scan found (F-07).
- **Copy** in plain Russian and English, terms from `CONTEXT.md`, no machine ids or full paths on screen (F-14, F-15,
  F-16, F-22).

## Out of this release (carried, with rows)

Reading coding-agents' own session stores to rank activity (`~/.claude/projects`, Codex sessions) — another tool's
private files need their own decision; git signals only in 0.3.6. Cloud and organization contexts (RM-28).

## Waves

| Wave | Closes | Exit check |
|---|---|---|
| 1 · Spec | SCN-126 rewritten, SCN-127/128 amended, new SCN for steps 2–3 and the landing; flows FLW-69/70/71 and new ones; screens and `docs/ux/product-model.json`; the prototype drawn for every screen and state (`scripts/product/`, `node scripts/sync-product-ux.mjs`, `node scripts/build-product-report.mjs`); en/ru copy through the brand pack; the visual record | `python3 docs/ux/lint.py`, product gates green; **the operator approves the prototype** |
| 2 · Main process | scan: owner from the remote, uncommitted-change and activity signals, folders without git, the tracked/untracked record; the multi-folder open picker; product detection (`/Applications`, the lifecycle broker's targets, `services/*.json`) and install actions; the connection step's checklist and its observation of the Setup console's outcomes (SCN-138); first-run progress kept | unit tests seen failing first, `ci.sh fast` |
| 3 · Renderer | the five-step wizard, the start menu, open-project, scan results, the result list, the sidebar's projects, copy fixes | component tests, the walk re-run in ru and en, screenshots against the prototype |
| 4 · First impact | the setup session started from step 5 and from the result list; the setup preset asks the agent to post its note to the board and file tasks; the project opens on its live board | a walk on a disposable stack ending on a board note |
| 5 · Release | three verification iterations (release gate), CHANGELOG, docs, wiki, map; **0.3.6** tagged and published; installed here; the operator's data reset; the operator walks it from zero | the release run green; the installed bundle verified |

**Next task.** Wave 1 — the scenarios, after the operator's go on this canvas.
