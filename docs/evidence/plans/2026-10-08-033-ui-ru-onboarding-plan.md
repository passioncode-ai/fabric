# Plan · 2026-10-08 · 0.3.3: screens, design quality, Russian, fresh onboarding, release

Operator request 2026-10-08. Status: **UI/RU half done** on `agent/ui-ux-ru-20261008` (rows A, B, C below); the onboarding half (R1–R3) and the release (Z) are open.

## Measured (2026-10-08, dev build of `main` 1190e261 and installed 0.3.2, launch demo estates en/ru)

- All 11 app-side launch views open in `ru` with no console errors (`launch-map`/`launch-design` are prototype meta views).
- The ru registry has full key parity (gate `check-design.mjs`, empty `ru-baseline.txt`); English reaches the window around it.

## Work, in order

| # | Item | Where | State |
|---|---|---|---|
| B2 | Task panel toolbar overflowed the project page by 105 px; the page itself grew past the window at 1280 px | `.toolbar` wraps (`components.css`), `.content` gets `min-width: 0` (`styles.css`); textareas in the body face; journal Open at the row end | **done** — 0 elements past the window, ru 1440/1280 |
| A1 | Agent descriptions and permission-mode ids shown raw in English | `harness.agent.*`, `agent.modeShort.*` in the registry, `HarnessSection.tsx` | **done** |
| A2 | Tool titles shown to the person in English | `harness.tool.*`, fallback to the contract for a tool with no key | **done** |
| A3 | Startup failure dialog English-only | `startupDialog` takes the translator and returns actions by index; ten causes in both registries | **done** |
| A4 | Folder-picker messages English-only (seven, not four) | `dialog.*` | **done** |
| A5 | The menu English-only | spelled out item by item with roles and registry labels; reinstalled on a locale change | **done** |
| A6 | «Live», «SHOULD», «seed»; decorative full stops in four screen titles | `i18n/ru.ts`, `en.ts`, `scripts/product/pulse.mjs` | **done** |
| B1 | Network-exposure warning: nine lines tall, command as prose | four lines: risk, one row per engine with code and copy, why behind a disclosure | **done** |
| B3 | Task page subtitle shows a raw hex id | agent · filing date (`launch.agent.subtitle`) | **done**; task number → CO-225 |
| B4 | "+ Project" source chooser leaves one orphan card | the planned path takes its own quiet row | **done** |
| C1 | Prototype elements missing: Fabric strip, Profile, «Обсудить с Fabric», Home «+ Добавить тему» | drawn (operator, 2026-10-08: «дорисовывай всё, чего не хватает»); «История на графе» and the task number stay out → CO-225 | **done** |
| R1 | Reset the operator's Fabric for a fresh onboarding | operator chose «Стереть всё полностью» (2026-10-08): full dump `~/Library/Application Support/Fabric/backups/pre-wipe-2026-10-08.dump` (184 736 475 bytes, `pg_restore --list` 1 427 entries, sha256 `f5f3853669a8…`) → the installed Fabric (pid 50963, started 01:09 by `open -a`, no window; the lifecycle broker refused, `not_started_by_broker`) quit on one SIGTERM by the operator's explicit choice, in 3 s → `supabase db reset --local` on the v0.3.2 migration set (identical to main): 771 estates / 162 582 events / every project gone; seed left one estate `org #1`, one event, no project → local state archived, not deleted, to `backups/pre-wipe-2026-10-08-userdata/` (drafts, persona, CEO conversations, private history, sessions, local/session storage, settings); `settings.json` keeps theme, `ru` and keep-awake, with `firstRun.completedAt: null`. Undo: stop Fabric, `pg_restore --clean -d <DB_URL> <dump>`, move the archived files back. Not verified: the first-run boot on the clean database — two probes (installed and dev build) opened no window in 400 s at load average 412 with swap 17.9/19.5 GB; REST answers the clean schema | **done**; boot check open |
| R2 | Onboarding: point at the repositories folder → projects found and configured in one pass | the scan already finds every repository and adds the ticked ones (SCN-128); what was missing was «сразу всё определил»: a scanned project arrived with a name and nothing else. Now each candidate shows what its repository says it is (manifest `description`, else the README's first prose paragraph; `main/projectDiscovery.ts#summaryFrom`) and Add makes it the purpose; SCN-127/128 amended | **done** |
| R3 | Setup through the base agent | detailed below (R3a → R3b → R3c) | R3a **done**; R3b needs an ADR; R3c follows P-13 |
| Z | Final: bug sweep, docs, wiki/knowledge base, design map, release 0.3.3 (with P-12) | release runbook | open |

## R3 in detail — setting a project up through the agent

The operator's ask: open the agent's console (or «встроенный чат с нашим базовым агентом») from Fabric and do the setup through it.
ADR-0123 already settles the shape: Fabric builds no chat of its own; talking to an agent is the agent's own console, and the CEO is a
runtime session (P-13, planned after 0.3.2). What a session may do is the agent surface (`apps/desktop/src/shared/surfaceTools.ts`):
it can file tasks, write memory, ask the owner and draft briefs, but no tool sets a project's purpose, goals or team. So:

| Phase | What | Needs | Authority |
|---|---|---|---|
| R3a | «Настроить проект с агентом»: a preset on the project page and a card in first-run step 3 that launches the default coding agent in the project folder with a setup instruction — read the repository, record what it learns in project memory (`fabric_memory_remember`), ask the owner what it cannot decide (`fabric_question_ask`), file the first tasks (`fabric_task_create`) | a new preset in `shared/presets.ts`, two entry points, copy | none new — every act is a tool the session already holds — **done 2026-10-08**: the `setup` preset first in `Tasks.tsx`, «Set up the first one with the agent» in the scan summary (`App.tsx` fills the draft and reveals the task panel); SCN-032/128 amended. A session of a coding agent not connected to Fabric (Codex, Cline, Kimi Code today) does not hold those tools — the preset says what to do, the harness panel says who can |
| R3b | The agent proposes the project's purpose, goals and default agent; the proposal lands on the board and changes nothing until the owner accepts it | one new surface tool (`fabric_project_propose`), the proposal kind on the board (ADR-0109's proposal path), an ADR for «an agent may propose project configuration» | operator acceptance per proposal |
| R3c | The CEO itself as that session (P-13): «Настроить с Fabric» opens the CEO runtime session with Fabric's context bundle | P-13 | as P-13 |

R3a is buildable on 0.3.2's contract; R3b needs the ADR first; R3c follows P-13.

Tooling used for the measurements (kept as session scratch, not committed — the receipts are in [the audit](../../ux/audits/2026-10-08-launch-chrome-ru.md)):
walk every launch view beside its mock; overflow probe (elements past the window / content wider than its box).
Note for scripts: `active-estate.json` must be mode 0600 or Fabric refuses it.

## Housekeeping done 2026-10-08

Removed merged worktrees `_worktrees/fabric-rc032`, `-rc032-work`, `-rc032-review`, `-bisect`; deleted merged branches
(local 13; on origin: agent/agent-support-20261005 `489082c3f30c`, agent/analytics-20261005 `04d801c2a567`,
agent/co198-rehearse-upgrade `2932fbbd066b`, agent/readme-20261005 `c73c5ca76246`, agent/release-0.3.1 `0b6dd1d03e1c`,
agent/release-032-candidate `6d02b0b6d240`, agent/release-032-land `bbc691033055`, agent/release-032-work `c35432275618`,
agent/release-032-close-20261008 `1190e261`); 6 865 stale `$TMPDIR/fabric-*` test folders. Restore a branch with
`git push origin <sha>:refs/heads/<name>`.

## State update — 2026-10-08, 0.3.3 verification iteration 1 (PL-5)

The status line and row Z above are as written at the time. Since then: R1, R2 and R3a are done; R3b is
CO-227 and R3c is P-13 (after 0.3.3, ADR-0123 amendment 1); the onboarding grew into the four actions
([brief](2026-10-08-onboarding-four-actions.md), [ADR-0129](../../adr/0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md)).
Row Z's release runs as P-14 in its [ledger](2026-10-08-release-033-verification.md), with the operator's scope D4:
**without P-12** (self-update moves after 0.3.3). R1's boot check on the wiped database is CO-228.
