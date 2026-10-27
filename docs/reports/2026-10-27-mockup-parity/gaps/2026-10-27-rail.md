# Gap report: left rail and window shell, mockup vs shipped 0.3.14

Scope: the left rail, the top bar and the session tabs. Not the home content.
Read-only. Worktree `/Users/sshlg/DATA/_worktrees/fabric-mockup-parity` at `35757c9d`.
Mockup: `docs/reports/2026-10-26-simple-fabric/mockup.html` (cited as `M:<line>`).
Shipped code: paths under `apps/desktop/src/` (cited relative to it).
Screenshots compared: `mock-full.png`, `m-rail-agents.png`, `m-console.png`, `real-home-1x.png` (plus three crops of it made for this report: `crop-brand.png`, `crop-trunc.png`, `crop-foot.png`, same folder).

## 0. Two things to know before reading the table

1. **Theme.** The mockup is the dark theme (`M:19`, `color-scheme:dark`). The shipped screenshot is light because the
   operator's own `settings.json` holds `"theme": "light"` (read 2026-10-27; the app default is `dark`,
   `shared/types.ts:498`, applied in `renderer/src/App.tsx:143-157`). So «+ Создать» black-on-light versus
   cream-on-dark is the same rule (`ink` background, `bg` text): `launch/rail.css:14` equals `M:50` except the bottom
   margin. Every colour difference below was checked against the dark tokens, not the light ones.
2. **The mockup is v1, the build also follows v2 and later reviews.** The mockup draws spec v1
   (`docs/ux/2026-10-26-simple-fabric.md`). The build adds v2 items the mockup never showed: back / forward / home
   (R-7, `docs/ux/2026-10-26-simple-fabric-v2.md:93,207`), the console icon on agent rows (R-6, v2:222-225), the status
   word on every agent row (UX-26, `renderer/src/launch/LaunchShell.tsx:306-307`). Rows marked **[v2]** below are
   intended differences from the mockup; the operator decides whether they stay. Spec v1 also says the Проекты view
   lists **every active project** alphabetically (`docs/ux/2026-10-26-simple-fabric.md:96`): the build follows the
   spec text, the mockup's seven names were sample data. Matching the mockup there means amending the spec
   (super-ux route), not only the code.

## 1. Gap table

| # | Area | Mockup | Shipped | Cause | Fix proposal |
|---|---|---|---|---|---|
| 1 | Projects list: which rows | 7 rows, only projects with work (`M:218-226`) | every active project, ~80 rows (`real-home-1x.png`) | spec + code: `railProjects` keeps every non-archived project (`shared/railProjects.ts:37-48`), per spec v1 §1.3 (`docs/ux/2026-10-26-simple-fabric.md:96`) | Show «projects at work»: a pulse with `live>0 \|\| inWork>0 \|\| review>0` (`shared/homeLive.ts:96-104`, built for every project at `shared/homeLive.ts:308`, already read into `homeReading` at `renderer/src/App.tsx:791`), plus `waiting.byProject>0` (`App.tsx:775`), plus pins (`App.tsx:761`), plus the project on screen. Last row «Все проекты · N» unfolds the full alphabetical list (or opens a projects index). Amend spec v1 §1.3 and SCN-162 in the same change. |
| 2 | Projects list: names | display names: Copylot, Dashboards, Fabric, Mobile Publisher, Observatory, Research Agent, Switchboard (`M:219-225`) | folder slugs: agent-stack, copylot-agent, fabric-dashboards… | DATA: `projects.name` is the only name (`supabase/migrations/20260831000001_migration_one.sql:40-50`), set from the folder's basename at admission (`main/projectAdmission.ts:100`); the rail prints it (`LaunchShell.tsx:270`) | See §2. Short term: a `displayNameOf(project, registry)` in `shared/` used by the rail, the agent rows, the tabs and the titles (one function, every screen). |
| 3 | Projects list: sort | alphabetical by display name (Fabric between Dashboards and Mobile Publisher) | alphabetical by slug | follows from #2 (`shared/railProjects.ts:46`) | Sort by the display name once #2 exists. |
| 4 | Projects list: live dot | green on the 4 projects with an agent at work (`M:219-222`) | grey on all rows, although the home says 37 agents work (`real-home-1x.png`, «hyperframes-agent · Claude Code · Работает» with a grey rail dot) | DATA: the live set is only Fabric's own terminals, `sessions.filter(running)` (`App.tsx:789`); a terminal-joined agent (most of them) never lights its project | Build `live` from `homeReading.view.live[].projectId` (or `view.projects[].live>0`) united with the running terminals (`App.tsx:789-792`). |
| 5 | Projects list: row height | 28px rows (`M:55`: `min-height:28px;padding:3px 8px`) | 26px rows (`launch/rail.css:29`) | CSS | `.rail-projects a{min-height:28px}`. |
| 6 | Projects list: long names | ellipsis («Kimi Code · Mobile Publis…», `m-rail-agents.png`) | clipped without ellipsis («bvi-dogs-wolfs-appwolves-w», `crop-trunc.png`) | CSS: `.rail-projects ul{display:grid}` (`launch/rail.css:28`) makes each `li` a grid item with `min-width:auto`, so the track takes the text's full width and `.rail{overflow:hidden}` (`rail.css:9`) clips it before `.rail-name`'s ellipsis (`rail.css:30`) can apply. The mockup list is a block `ul` (`M:54`). (Reading of the CSS, matching the crop; not run in a browser.) | `.rail-projects ul{grid-template-columns:minmax(0,1fr)}` or `.rail-projects li{min-width:0}`; check both lists and the 64px narrow mode (`rail.css:93-100`). |
| 7 | Brand mark | 26px conic-gradient tile (`M:47`, `M:210`) | the PassionCode passion-fruit mark (`LaunchShell.tsx:20,223`, `assets/brand/favicon/transparent/passioncode-favicon-64.svg`) | asset choice; the mockup's gradient exists in no brand asset (the app icon is the same mark on a graphite tile, `assets/brand/app-icon/README.md`, ADR-0100) | Decision for the operator: keep the mark (brand pack) or use `assets/brand/app-icon/fabric-icon.svg` at 26px (a tile, closer to the mockup's tile look). Do not ship the CSS gradient: it is not a brand asset. |
| 8 | Brand subtitle | «PassionCode.ai» (`M:211`) | «by PassionCode» | copy: key `rail.brand` (`renderer/src/i18n/ru.ts:2822`, used `LaunchShell.tsx:224`) | Use the existing `launch.brand.umbrella` «PassionCode.ai» (`ru.ts:930`); same in `en.ts`. |
| 9 | Brand: yellow «5» | no badge on the brand (`M:209-212`) | gold pill «5» (`crop-brand.png`) | missing-in-mockup element: `waiting.total` drawn on the brand (`LaunchShell.tsx:226-228`, style `.rail-n` `rail.css:25`) | Remove it: the home already says «5 ждут вас» and «Нужны вы 5», and per-project gold counts stay on rows. If kept, it should not be a filled pill (the mockup uses only gold text counts, `M:59`). |
| 10 | Brand: active background | none; the brand is a plain button (`M:46`) | a 5% ink box behind the brand at home, which also frames the window's traffic lights (`crop-brand.png`) | CSS `.rail-home.on` (`launch/launch.css:723`) | Drop the `.on` background for the brand (home is already said by the title and the ⌂ button's `aria-current`, `LaunchShell.tsx:363`), or start the box below the traffic lights. |
| 11 | «+ Создать» | `margin:0 4px 12px` (`M:50`) | `margin:0 4px 10px`, plus a gold ring when on the create path (`rail.css:14-15`) | CSS | 12px bottom margin. The `+` is a separate span with a space (`LaunchShell.tsx:233`); the mockup has «+ Создать» as one text: same look, keep. |
| 12 | Toggle Проекты / Агенты | segmented control (`M:51-53`) | identical values (`launch/launch.css:726-728`) | none | No change. |
| 13 | Foot: «Настройки» badge «427» | no badge (`M:234-237`) | gold «427» (`crop-foot.png`) | element not in mockup: Comms threads with a message newer than the operator's read mark, `unreadOf` (`renderer/src/launch/commsList.ts:75-78`), polled every 5 s (`App.tsx:97,486-487`), drawn on Настройки because Comms opens from Настройки → Ещё (`LaunchShell.tsx:104-106,328-338`) | Remove from the rail. Spec v2 puts unread counts on a bell in the top bar (v2:207-210, «Уведомления», 0.3.15); until then the count belongs inside Настройки → Ещё → Переписка. 427 mostly says the operator never opens Comms, not that 427 things need him. |
| 14 | Foot links size | `min-height:28px`, 12.5px, 13px icon (`M:69,71`) | `min-height:30px`, 13px, 14px icon (`rail.css:18,21`) | CSS (shared with the old places list) | Scope `.rail-foot a{min-height:28px;font-size:12.5px}` and `.rail-foot .rail-i{width:13px;height:13px}`. |
| 15 | Agents list: name | «Claude Code · Copylot» (`M:228`) | «Claude Code · copylot-agent» | DATA, as #2: `LiveAgent.projectName` is `projects.name` (`shared/homeLive.ts:49`; `LaunchShell.tsx:292`) | The same display-name function as #2. |
| 16 | Agents list: second line | branch in mono 10.5px info colour; a word only when quiet: «· молчит» (`M:65-66,229`) | branch in mono 11px; a word on every row: «· Работает», «· Простаивает», «· Ждёт» (`LaunchShell.tsx:303-307`, `launch/launch.css:734-735`) | [v2] a later decision (UX-26, comment at `LaunchShell.tsx:306`) and v2 §4.5 vocabulary (v2:372-388) | Operator's choice. If the mockup wins: hide the word for `working`, keep it for the others; mono at 10.5px. |
| 17 | Agents list: dots | green filled (working), orange filled (quiet) (`M:62-63`) | five shapes: green dot, yellow square (waiting), red diamond (error), hollow grey ring (idle), outline (ended) (`launch/launch.css:834-838`) | [v2] R-19 (v2:105, §4.5): colour plus shape | Keep (it carries R-19 and colour-blind shapes). The mockup's orange «молчит» maps to v2's «Ждёт» (yellow) or «Простаивает» (grey) by `agentStatus` (`shared/railAgents.ts:48`). |
| 18 | Agents list: console icon | none (`M:227-233`) | a 24px `›_` button per row, dashed when the session runs outside Fabric (`LaunchShell.tsx:311-318`, `launch/launch.css:815-820`) | [v2] R-6 (v2:222-225) | Keep or drop by decision. Note: most rows are terminal-joined, so most rows carry a dashed decorative box that does nothing and narrows the name. v2 asked for an outlined icon with an arrow that opens the agent screen as a tab (v2:223-224); the shipped dashed one is inert (`role="img"`). Either make it act or hide it for outside sessions. |
| 19 | Top bar: back / forward / home | title only (`M:241-244`) | ‹ › ⌂ before the title (`LaunchShell.tsx:355-367`, `launch/launch.css:808-813`) | [v2] R-7 (v2:93,207) | Keep (operator's second review asked for it). |
| 20 | Top bar title on an agent's screen | «Claude Code · Fabric» (`M:478`) | «Агенты» | code: `placeTitle` maps `agents` to `rail.agents` (`App.tsx:959`) | When `active.session` is set: `${runnerLabel} · ${displayName(project)}` from the rail row already in hand (`railAgentRows`, `App.tsx:792`). |
| 21 | Top bar title on a session | «Сессия · Claude Code · Fabric» (`M:478`) | the project's slug only (`consoleTitleOf`, `renderer/src/consoles.tsx:68-77`; `App.tsx:971`) | code + DATA (#2) | `Сессия · {runner} · {display name}`; the runner is known (`App.tsx:923`). |
| 22 | Session tab text | «› Fabric · Claude Code» in one line, 12px, ink (`M:78,488`) | `›_` mono sign, name 12.5px, runner 11px muted in a separate span (`ConsoleTabs.tsx:41-43`, `launch/rail.css:52-55`); name is the slug | CSS + copy + DATA (#2) | Sign `›` (or keep `›_` by decision), one string «{project} · {runner}» at 12px, display name. |
| 23 | Session tab look | always `panel-quiet` background, ink text; the active tab only gets the strong border (`M:78`, `M:487`) | inactive tabs transparent and muted; the active one 7% ink background and strong border (`launch/rail.css:50-51`) | CSS | Match: `.fab-console{background:var(--app-panel-quiet);color:var(--app-ink)}`, `.on` only changes the border. |
| 24 | Session tab status | none in the mockup | none | v2 lists the status dot on tabs for 0.3.14 (v2:523 «on rows and tabs»; R-19); `ConsoleTab` has no status field (`ConsoleTabs.tsx:9-15`) | Gap against v2, not the mockup: add `status` to `ConsoleTab` from `agentStatus` and draw the same `.rail-dot s-*`. |
| 25 | Pinned «Обзор», ⌘1-9, ⌃Tab, bell | not in mockup | not built (no handler in `App.tsx`; grep for `Digit`/`Tab` shortcuts finds none) | v2 places them in 0.3.15 (v2:538) | Out of 0.3.14; listed so it is not mistaken for a regression. |
| 26 | Red banner «Что-то не сработало · Не открыто вкладок: 1…» | none | a red shell error at the top of every page (`real-home-1x.png`) | code: the pre-0.3.7 draft-tab working set is still restored at start and a dropped tab is reported through `setError` (`App.tsx:404-412`; copy `ru.ts:133`, title `ru.ts:220`, drawn by `OperatorError.tsx:74`) | That tab strip no longer exists (SCN-162, `LaunchShell.tsx:4-5`). Say a dropped restore once as an act line or not at all, never as «Что-то не сработало»; or retire the legacy working-set restore. |
| 27 | Fonts | Inter 14px base (`M:23,37`) | Inter, bundled (`renderer/src/main.tsx:8-13`), rail sizes equal | none | No change. Inter is bundled at 400/500/600 only, so `font-weight:550` on Создать (`rail.css:14`, `M:50`) renders as 500 or 600 in both. |
| 28 | Rail width, padding, borders, top bar height | 216px, 12px 10px, 44px (`M:44-45,75`) | same (`rail.css:8-9,45`) | none | No change. |

## 2. Where display names could come from

What exists today (verified):

- `projects.name text not null` is the only name column (`supabase/migrations/20260831000001_migration_one.sql:40-50`).
  `display_name` exists only on `persons` (same file, line 16). It is filled with the folder's basename at admission
  (`main/projectAdmission.ts:100`).
- It is already renameable: the act `project.rename` appends `project.updated@1` with a new `name`
  (`main/actExecutors.ts:211-225`), and the projector applies it (`supabase/migrations/20260831000004_tasks.sql:62-67`).
  So the cheapest path is renaming the projects, but that also renames them everywhere a slug is expected, and the
  slug is how other tools (Observatory, agents) name the project.
- The project profile (`fabric_project_profile`) has `goal`, `summary` («one line: what the project is»), `business`,
  `plan` (`shared/types.ts:102-107`). `summary` is a sentence, not a name.
- Observatory's registry names projects by slug too (`observatory_status`: `"name":"agent-stack"`), so it is no
  source.
- Fabric service descriptors carry a human name and a repository: in
  `~/Library/Application Support/ai.passioncode.fabric/services/` (33 files), e.g. `copylot-agent.default.json`
  name «Copylot», repository `https://github.com/ssheleg/copylot-agent`; `mobile-publisher.default.json` «Mobile
  Publisher»; `research-agent.main.json` «Research Agent»; `project-observatory.default.json` «Project Observatory».
  Fabric already reads them, `name` and `repository` included (`main/agentRegistry.ts:57,66-79`). Fabric itself,
  Dashboards and Switchboard have no descriptor there, and some descriptors carry instance suffixes («Copylot
  (облако)», «Frame Agent (preview)»).

Proposal, in order of preference:

1. **A `display_name` on the project**, written by the profile tool (`fabric_project_profile` gains an optional
   `name`, the agent that knows the product fills it) and by the person (the existing rename act, aimed at
   `display_name` instead of `name`). Projector: a new per-concern function plus a nullable column, per the repo's
   migration rule. The slug stays the identity.
2. **Fallback, no migration:** match a project to a service descriptor whose `id` equals the project's folder name or
   whose `source.repository` equals one of the project's repository remotes (`project_repos`), take the descriptor
   whose instance is `default`, and use its `name`.
3. **Last fallback:** humanise the slug (split on `-`, drop a trailing `agent`, capitalise), so «research-agent»
   still reads «Research Agent» only when 1 and 2 have nothing. Mark it as derived, never as the project's name.

One shared function (`shared/projectDisplayName.ts`) used by the rail, agent rows, tab labels, top-bar titles and
the home cards, so every screen says the same name.

## 3. «Which projects to show», from data already read

All inputs are already in `App.tsx`; no new read is needed:

- `homeReading.view.projects: ProjectPulse[]` with `live`, `inWork`, `review`, `lastActivityAt` per project
  (`shared/homeLive.ts:96-104,126`, built for every project at `shared/homeLive.ts:308`, read at `App.tsx:791`);
- `homeReading.view.live[].projectId` for terminal-joined agents (`shared/homeLive.ts:46-49`);
- `waiting.byProject` (`App.tsx:775`); `pins` (`App.tsx:761`); the open project (`railAt`, `App.tsx:949-956`).

Rule: show a project when `live>0 || inWork>0 || review>0 || waiting>0 || pinned || it is open`, sorted by display
name; a dot green when `live>0` (fixes #4 at the same time); a final quiet row «Все проекты · N» that unfolds the full
alphabetical list. A project with only `lastActivityAt` inside, say, 7 days could be added if seven names feel too
few; that threshold is a decision, not a fact.

## 4. What the two badges count

- **«5» on the brand** = `waiting.total`: the board's person-only query `board.query({ personOnly: true, limit: 1 })`
  total, over the whole estate (`App.tsx:771-776`), the same number as the home's «ждут вас» and «Нужны вы». Drawn at
  `LaunchShell.tsx:226-228`.
- **«427» on Настройки** = Comms threads whose last message `lastSeq` is newer than the operator's read mark
  `settings.commsReadThrough[threadId]` (`launch/commsList.ts:75-78`, `App.tsx:495`), from `comms.heads()` polled every
  5 s (`App.tsx:97,480-487`). It is on Настройки because Comms lives under Настройки → Ещё since 0.3.7
  (`LaunchShell.tsx:104-106`). It is a count of unread board threads, not of decisions.
