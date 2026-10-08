# Plan · 2026-10-08 · 0.3.3: screens, design quality, Russian, fresh onboarding, release

Operator request 2026-10-08. Status: **draft, work in progress** on `agent/ui-ux-ru-20261008`; nothing landed.

## Measured (2026-10-08, dev build of `main` 1190e261 and installed 0.3.2, launch demo estates en/ru)

- All 11 app-side launch views open in `ru` with no console errors (`launch-map`/`launch-design` are prototype meta views).
- The ru registry has full key parity (gate `check-design.mjs`, empty `ru-baseline.txt`); English reaches the window around it.

## Work, in order

| # | Item | Where | State |
|---|---|---|---|
| B2 | Task panel toolbar overflowed the project page by 105 px (button over the next column, right column past the window) | `components.css` `.toolbar` wraps, selects bounded | **done in branch, not yet re-measured** |
| A1 | Agent descriptions and permission-mode ids shown raw in English | `shared/agents.ts#AGENTS` `description`, `HarnessSection.tsx` | open |
| A2 | Tool titles shown to the person in English | `HarnessSection.tsx` (tools list) | open |
| A3 | Startup failure dialog English-only | `shared/startupFailure.ts#startupDialog`, `main/index.ts` | open |
| A4 | Folder-picker messages English-only (4) | `main/index.ts` `dialog.showOpenDialog` | open |
| A5 | Custom menu labels English-only | `main/menuTemplate.ts` | open |
| A6 | `launch.home.live.title` "Live"; "SHOULD" on Planning; "seed" on Persona | `i18n/ru.ts` | open |
| B1 | Network-exposure warning: large, on every screen but Home, command not set as code | stack-exposure banner | open |
| B3 | Task page subtitle shows a raw hex id | `TaskPage.tsx` | open |
| B4 | "+ Project" source chooser leaves one orphan card | start chooser | open |
| C1 | Prototype deltas without a defect: no "Fabric · last observation" row on Pulse/Plan/Agent; no Profile / Discuss buttons; Releases default selection | record in ledger, not drawn silently | open |
| R1 | Reset the operator's estate of test projects (769 estates) for a fresh onboarding — **destructive: show exact scope and ask yes first**; backup `~/Library/Application Support/Fabric/backups/post-0.3.2-migration-2026-10-08.dump` exists | local stack | open |
| R2 | Onboarding: point at the repositories folder → projects found and configured in one pass | scan-folder start | open |
| R3 | Setup through the base agent: open the agent console from Fabric (P-13, ADR-0123) | runtime session | open |
| Z | Final: bug sweep, docs, wiki/knowledge base, design map, release 0.3.3 (with P-12) | release runbook | open |

Tooling used for the measurements (scratch, to be committed as `scripts/launch/walk-shots.mjs` with this work):
walk every launch view beside its mock; overflow probe (elements past the window / content wider than its box).
Note for scripts: `active-estate.json` must be mode 0600 or Fabric refuses it.

## Housekeeping done 2026-10-08

Removed merged worktrees `_worktrees/fabric-rc032`, `-rc032-work`, `-rc032-review`, `-bisect`; deleted merged branches
(local 13; on origin: agent/agent-support-20261005 `489082c3f30c`, agent/analytics-20261005 `04d801c2a567`,
agent/co198-rehearse-upgrade `2932fbbd066b`, agent/readme-20261005 `c73c5ca76246`, agent/release-0.3.1 `0b6dd1d03e1c`,
agent/release-032-candidate `6d02b0b6d240`, agent/release-032-land `bbc691033055`, agent/release-032-work `c35432275618`,
agent/release-032-close-20261008 `1190e261`); 6 865 stale `$TMPDIR/fabric-*` test folders. Restore a branch with
`git push origin <sha>:refs/heads/<name>`.
