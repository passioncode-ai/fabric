---
report: fabric-mockup-parity
project: fabric
date: 2026-10-27
status: in-progress
---

# Fabric: the shipped screens against the approved mockup

**Operator, 2026-10-27:** «Разница по дизайну и по контенту между тем макапом, который ты показывал, и тем, что
получилось, огромная; давай его дорабатывать, делай нормально.»

- Mockup: [`docs/reports/2026-10-26-simple-fabric/mockup.html`](../2026-10-26-simple-fabric/mockup.html), spec v1
  [`docs/ux/2026-10-26-simple-fabric.md`](../../ux/2026-10-26-simple-fabric.md), spec v2
  [`docs/ux/2026-10-26-simple-fabric-v2.md`](../../ux/2026-10-26-simple-fabric-v2.md).
- Shipped: Fabric 0.3.14, captured from the operator's window on 2026-10-27
  ([`shots/shipped-0314-home.png`](shots/shipped-0314-home.png)); the mockup's views in
  [`shots/`](shots/).
- Gap maps, one row per difference with its cause at `file:line`: [home](gaps/home.md), [rail and shell](gaps/rail.md),
  [agent page, cross-project panel, console](gaps/agent.md). Built read-only on `35757c9d`, database facts from
  read-only `SELECT`s on the local stack.

## What the maps found

The difference has two causes of about equal weight.

1. **Layout and copy.** The home's hero and strip sit outside the two-column grid, so «Нужны вы» starts low and narrow
   ([home A3](gaps/home.md)); a flex rule overrides the hero's grid ([B2](gaps/home.md)); the strip is six cards, not
   one strip ([C1](gaps/home.md)); «Нужны вы» renders closed `<details>` with hidden answers ([F3](gaps/home.md)); the
   agent page keeps the 0.3.12 list styling ([agent](gaps/agent.md)); the rail clips names without an ellipsis and
   carries two badges the mockup has not ([rail 6, 9, 13](gaps/rail.md)).
2. **Data.** The rhythm chart reads only the newest 500 events, under two hours of this journal
   ([D1](gaps/home.md)); «working» means any ping in ten minutes, so every open agent window counts and the cards
   reshuffle by ping time ([D3, D4](gaps/home.md)); every re-enrolment mints a new session id, so stage reports and
   claims from the same agent's earlier ids are lost to the home and the agent page ([D5, D6](gaps/home.md)); the task
   row shows the brief sentence as its title ([agent](gaps/agent.md), «Сейчас» rows).

## How conflicts are decided

The order the operator's rules give: recorded decisions first. So:

- **v2 and later reviews win over the mockup** where they decided later (back/forward/home, the status word and shape on
  agent rows, the console icon, the «Цель» line). They stay, restyled to the mockup's quiet type.
- **The mockup wins over spec v1's text** where v1 was written before the operator approved the mockup: the rail shows
  the projects at work, with «Все проекты · N» unfolding the rest (spec v1 §1.3 is amended in the same change).
- **The theme is the operator's setting** (`settings.json` `"theme": "light"`); every rule is checked in both themes.
- **The brand mark stays the PassionCode mark:** the mockup's gradient tile is no brand asset (ADR-0100).

## Waves

| Wave | What | Where |
|---|---|---|
| 1. Layout and copy | Home grid, hero card, joined strip, «Нужны вы» as open cards, «В работе» cards and rows, «Запросы без ответа» block; rail rows, ellipsis, badges, brand subtitle, top-bar titles, tabs; agent page cards, step bar, milestones timeline, task cards, pills, back links, «Агент» fact; console box; the dropped-tab notice; the LAN notice names Colima | `renderer/src/launch/*`, `App.tsx`, `consoles.tsx`, `i18n/*` |
| 2. Data the screens need | Rhythm per day from the journal; one definition of results and decisions; «at work» apart from «connected»; sort by work; «работают без задачи» counted from the reading; hold time; waiting requests listed; task title apart from its brief; rail dots and «projects at work» from the home reading; display names; an agent's own questions; release notes read from claims | `main/workRead.ts`, `shared/homeLive.ts`, `shared/homeProjects.ts`, `shared/sessionTasks.ts`, `main/homeStrip.ts`, `shared/commsRead.ts` |
| 3. One agent, one identity | Stage reports, heartbeats and claims of a re-enrolled agent joined by its runtime session, so a restart of Fabric does not empty every row; stage reports stamped with the session's live claim | `shared/homeLive.ts`, `main/agentSurface.ts`, `shared/agentTrail.ts` |

Each wave is proven by screenshots of the real renderer with fixture data beside the mockup
([`shots/`](shots/)), the renderer tests, `bash scripts/ci.sh fast` and the design map.
