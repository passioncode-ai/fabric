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
| R1 | Reset the operator's estate of test projects (769 estates) for a fresh onboarding — **destructive: show exact scope and ask yes first**; backup `~/Library/Application Support/Fabric/backups/post-0.3.2-migration-2026-10-08.dump` exists | local stack | open |
| R2 | Onboarding: point at the repositories folder → projects found and configured in one pass | scan-folder start | open |
| R3 | Setup through the base agent: open the agent console from Fabric (P-13, ADR-0123) | runtime session | open |
| Z | Final: bug sweep, docs, wiki/knowledge base, design map, release 0.3.3 (with P-12) | release runbook | open |

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
