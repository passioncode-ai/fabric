---
report: fabric-mockup-parity
project: fabric
date: 2026-10-27
status: in-review
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
- Gap maps, one row per difference with its cause at `file:line`: [home](gaps/2026-10-27-home.md), [rail and shell](gaps/2026-10-27-rail.md),
  [agent page, cross-project panel, console](gaps/2026-10-27-agent.md). Built read-only on `35757c9d`, database facts from
  read-only `SELECT`s on the local stack.

## What the maps found

The difference has two causes of about equal weight.

1. **Layout and copy.** The home's hero and strip sit outside the two-column grid, so «Нужны вы» starts low and narrow
   ([home A3](gaps/2026-10-27-home.md)); a flex rule overrides the hero's grid ([B2](gaps/2026-10-27-home.md)); the strip is six cards, not
   one strip ([C1](gaps/2026-10-27-home.md)); «Нужны вы» renders closed `<details>` with hidden answers ([F3](gaps/2026-10-27-home.md)); the
   agent page keeps the 0.3.12 list styling ([agent](gaps/2026-10-27-agent.md)); the rail clips names without an ellipsis and
   carries two badges the mockup has not ([rail 6, 9, 13](gaps/2026-10-27-rail.md)).
2. **Data.** The rhythm chart reads only the newest 500 events, under two hours of this journal
   ([D1](gaps/2026-10-27-home.md)); «working» means any ping in ten minutes, so every open agent window counts and the cards
   reshuffle by ping time ([D3, D4](gaps/2026-10-27-home.md)); every re-enrolment mints a new session id, so stage reports and
   claims from the same agent's earlier ids are lost to the home and the agent page ([D5, D6](gaps/2026-10-27-home.md)); the task
   row shows the brief sentence as its title ([agent](gaps/2026-10-27-agent.md), «Сейчас» rows).

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
| 1. Layout and copy | Home grid, hero card, joined strip, «Нужны вы» as open cards, «В работе» cards and rows, «Запросы без ответа» block; rail rows, ellipsis, badges, brand subtitle, top-bar titles, tabs; agent page cards, step bar, milestones timeline, task cards, pills, back links, «Агент» fact; console box; the dropped-tab notice; the LAN notice names Colima | `renderer/src/EstateHome.tsx`, `renderer/src/launch/{HomeParts,HomeInWork,HomeWork,HomeBoardWaiting,LaunchShell,AgentPage,AgentsScreen,ConsoleTabs,CrossProjectConsole}.tsx`, `renderer/src/{App,SessionWindow,StackExposureNotice,ProjectHome,consoles}.tsx`, `launch/launch.css`, `launch/rail.css`, `styles.css`, `i18n/*`, `duration.ts` |
| 2. Data the screens need | Rhythm per day from the journal; one definition of results and decisions; «at work» apart from «connected»; sort by work; «работают без задачи» counted from the reading; hold time; waiting requests listed; task title apart from its brief; rail dots and «projects at work» from the home reading; display names; an agent's own questions; release notes read from claims | `main/{workRhythm,agentWork,commsWaitingList,projectNames,index}.ts`, `shared/{workRhythm,agentWork,homeLive,homeProjects,railProjects,railAgents,projectDisplayName,sessionTasks,board,commsRead}.ts` |
| 3. One agent, one identity | Stage reports, heartbeats, turns and claims of a re-enrolled agent joined by its runtime session, so a restart of Fabric does not empty every row; stage reports stamped with the session's live claim | `shared/agentIdentity.ts`, `main/agentIdentity.ts`, `main/agentSurface.ts`, `shared/spawnParent.ts`, `shared/agentTrail.ts` |

Each wave is proven by screenshots of the real renderer with fixture data beside the mockup
([`shots/`](shots/)), the renderer tests, `bash scripts/ci.sh fast` and the design map.

## What closed and what stays open

Closed in 0.3.15, as the release review's plan level read the maps against the diff (iteration 1, PL-1): home A2, A3,
A5, B1 to B3, C1, D1 to D7, D9, D11; rail 1 to 6, 8 to 11, 13, 20 to 22; the agent page's header, step bar, milestones,
questions card, console box and back link. The other rows of the maps were restyled in wave 1 and are not ticked one by
one here; the later review iterations read them again against the shots.

Left open, each with its reason and its home:

| Gap | Why it stays | Home |
|---|---|---|
| Home D8, E7: the branch of an agent that joined from a terminal («ветка неизвестна») | needs an optional `branch` on the turn hook, a protocol change | CO-459, the release of 2026-11-05 (P-29) |
| Home A7: the folded «Ещё на этой странице» block | its panels (quotas, the journal) have no other home yet | CO-460, the release of 2026-11-05 |
| Rail 24: a status on console tabs | v2 places it with the session tabs | P-29, the release of 2026-11-05 |
| Rail 25: pinned «Обзор», ⌘1 to 9, ⌃Tab, the bell | v2 places them with notifications | P-29, the release of 2026-11-05 |
| Rail 7: the brand mark | the mockup's gradient tile is no brand asset | kept, ADR-0100 |
| Rail 18, 19: the console icon, back and forward | decided later than the mockup (v2) | kept |
| Agent page lane tabs | v2 §3.3 decided the lanes after the mockup | kept, restyled to the mockup's quiet type |
| Home H: global tokens (mono font, button heights, `.lp h2/h3` sizes) | the app's type scale and theme are the person's setting; the waves restyled the mockup's screens, not the app's tokens | kept |
| Display names on Pulse, History, Comms, Releases, the feed and the graph | those screens are not in the mockup | CO-471, the release of 2026-11-05 |
