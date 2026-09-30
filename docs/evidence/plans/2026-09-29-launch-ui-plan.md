# The app rebuilt to the launch design (2026-09-29)

**Objective.** The Fabric app looks and behaves like the launch prototype — the "Целевой дизайн
запуска" series SCR-30…SCR-41 in [`docs/reports/product.html`](../../reports/product.html) —
screen by screen, on real data with honest empty and unread states. The operator's ruling,
2026-09-29: the earlier interface "никуда не годится … делаем то, как в мокапе, а не как ты
придумал". The design outranks earlier screen layouts; where it contradicts a scenario, the
scenario is amended in the same change (SCN-043 was the first).

**Paused behind it:** the 0.2.0 release (signed DMG, site download, screenshots, GitHub
description — [`docs/launch/release-mac.md`](../../launch/release-mac.md)). The DMG pipeline is
built and was verified end to end (signed, notarized, stapled, Gatekeeper accepted); it is re-cut
once the screens match, so the site's screenshots show the design.

## Method — how each screen is built

1. **Port, never redraw.** The prototype's own CSS rules for the launch series and its shell are
   copied into [`launch/launch.css`](../../../apps/desktop/src/renderer/src/launch/launch.css) by
   [`scripts/launch/port-launch-css.mjs`](../../../scripts/launch/port-launch-css.mjs), in the
   prototype's order. `--check` runs in `scripts/ci.sh fast` (step "interface"), so a hand-tuned
   ported rule, or a prototype that moved, fails the build. Only the frame variables and the
   window adaptations under the second marker are hand-written.
2. **The markup follows the prototype's renderer** (`launchHome`, `topicRows`, `homePulse`, … in
   the prototype's script): same classes, same order, same copy — through `t()` in both locales.
3. **Real data only.** Every number comes from a reader the app already has (journal feed, board
   query, favourites, sessions). A day, a count or a state the window cannot know is said to be
   unknown, never zero. A control whose screen does not exist yet is left out, not stubbed.
4. **Compare at 1440×900** against the demo estate:
   `psql "$DB_URL" -v ON_ERROR_STOP=1 -f scripts/fixtures/launch-estate.sql`, then
   [`scripts/launch/compare-shots.mjs`](../../../scripts/launch/compare-shots.mjs) `--view <view>`
   writes `<view>.mock.png` beside `<view>.app.png`. The fixture is its own estate
   (`…de30`, or `-v estate=<uuid>` for fresh dates) — never the operator's — and backdates its
   events through the same projector; its receipt must print `backwards_steps = 0`.

## Packets

| # | Screen (prototype view) | State | Evidence |
|---|---|---|---|
| L1 | Shell: side navigation, scope bar, Fabric launcher, window tabs (SCR-30) | **done** | [`LaunchShell.tsx`](../../../apps/desktop/src/renderer/src/launch/LaunchShell.tsx); ported CSS; tests updated to the new controls (`onboardingDraft.persist`, `entityAddress`) |
| L2 | Home (`launch-home`, SCR-30/SCR-01): identity + rhythm of 28 days, where you left off, top three of the board, My projects with ★ ↑ ↓, Live | **done** | [`EstateHome.tsx`](../../../apps/desktop/src/renderer/src/EstateHome.tsx), [`launch/HomeParts.tsx`](../../../apps/desktop/src/renderer/src/launch/HomeParts.tsx), [`shared/homeView.ts`](../../../apps/desktop/src/shared/homeView.ts) + test, `favourites.move` (`shared/favourites.ts#planMove` + test); walked on the demo estate in `ru`, no page or console errors |
| L3a | Board (`launch-board`, SCR-41) as a screen: current, resolved and all topics; details with the answer and the obligation's acts; review mode | **done** | [`launch/BoardScreen.tsx`](../../../apps/desktop/src/renderer/src/launch/BoardScreen.tsx) + test (16 cases, the 10 CEO-panel cases moved with the acts), [`launch/ObligationActs.tsx`](../../../apps/desktop/src/renderer/src/launch/ObligationActs.tsx), `board.resolved` ([`shared/boardResolved.ts`](../../../apps/desktop/src/shared/boardResolved.ts) + test); `AttentionPanel` retired; SCN-050 amended |
| L3b | Board: «На следующий раз» (set aside with a reason, return to the board), «+ Добавить тему» (a topic the owner writes) | **done** | migration [`20260929000068_board_deferral_and_topics.sql`](../../../supabase/migrations/20260929000068_board_deferral_and_topics.sql) (`question_deferrals`, `defer_question`, `reopen_question`, `ask_topic`; schema 68 qualified as a private-archive source), [`board-deferral-db.test.mjs`](../../../apps/desktop/test/board-deferral-db.test.mjs) via `pnpm test:board-db` (11 groups, including a deferral naming another estate's question refused by the database itself), `commandIngressAdapters.ts#commitBoardCommand` + adapter tests, `commandIngress.ts#prepareDeferralReason`/`#prepareTopic`, `board.deferred`, BoardScreen 20 cases; runtime schema contract 68–68; the pipeline reservation moved to 69/70 |
| L3c | Board: Back restoring filter and selection; the `?item=` address | open | SCN-050 step 5 |
| L4 | Project (`launch-project`, SCR-31/SCR-03): now → next step, the project's board, its work, goal, team, rhythm, resources; the journal full width; the navigation's six project sections | **done** | [`launch/ProjectLaunch.tsx`](../../../apps/desktop/src/renderer/src/launch/ProjectLaunch.tsx) + test (5 cases); the Board scoped to a project and opened at a row (`AppRoute` `{ kind: 'board', projectId, item }`, `appRoute.test.ts`, `BoardScreen.test.tsx`); the detailed sections stay below under «Все разделы проекта» |
| L5 | Agent workspace (`launch-agent`, SCR-39): an open task as the whole page — the run rail (agent, state, task, run, session, hold), tabs Now / Context / Decisions / Tasks and sessions / Next, and the console on demand | **done** | [`TaskPage.tsx`](../../../apps/desktop/src/renderer/src/TaskPage.tsx) in the prototype's `lp-ide` layout, every earlier part kept (brief, notes and promotion, siblings, links, receipts, research, open session); [`launch/AgentWorkspace.tsx`](../../../apps/desktop/src/renderer/src/launch/AgentWorkspace.tsx) + test (the run's state in words, the pack this run was given beside the next one, the console read only when opened). **Numbering to settle:** `docs/ux/screens.md` names SCR-39 «Estate agents» (`EstateAgents.tsx`), the launch series uses SCR-39 for this workspace; the registry row was left as it is |
| L6 | Planning (`launch-plan`, SCR-40): every project → a project's goals → a goal's open work; Plan / History, zoom, the same plan as a list; «Планирование» in the navigation; the project's «План» and «Цели и критерии» open it | **done** | [`launch/PlanScreen.tsx`](../../../apps/desktop/src/renderer/src/launch/PlanScreen.tsx) + test (5 cases) on `planOf` and `goalProgress` (a capped closed count is a floor, said so); `AppRoute` `{ kind: 'plan', projectId }`. **Not drawn:** edges between work — the order under a goal is priority, not dependency, and task links live on each task's page; the prototype's fourth level (stages of one task) has no data behind it yet |
| L7 | Pulse (`launch-pulse`, SCR-42 in the launch series): the rhythm over 7 or 28 days with any day's events, decisions and results apart; running sessions as observed; the next cycle; what the pulse means. Reached from «Вся активность →» and the rhythm on the home, «Пульс →» on the Board and the project | **done** | [`launch/PulseScreen.tsx`](../../../apps/desktop/src/renderer/src/launch/PulseScreen.tsx) + test (4 cases), `homeView.ts#eventKind`/`#eventsOfDay` + test; a day the feed window cut off stays unknown when filtered to one project. The home keeps its folded journal (its mark-read act has no other home yet). **Numbering to settle:** `screens.md` names SCR-42 «Inbox» |
| L8 | Releases (`launch-releases`): per project, a release's name, where it applies, what went in (tasks), why (decisions), its verification and receipt, and what comes next; record a release, record its verification, roll back by a new record; «Релизы →» and the latest verified result on the Pulse | **done** | [ADR-0084](../../adr/0084-a-release-is-a-record-with-its-basis.md); migration [`20260929000069_releases.sql`](../../../supabase/migrations/20260929000069_releases.sql) (`releases`, `record_release`, `verify_release`; schema 69 qualified as a private-archive source), [`releases-db.test.mjs`](../../../apps/desktop/test/releases-db.test.mjs) via `pnpm test:releases-db` (6 groups: refusals of an agent, another project's task or decision, an unknown rollback; the latest verification stands; a rollback leaves the old record as it was); [`shared/releases.ts`](../../../apps/desktop/src/shared/releases.ts) + test (the state derived, never stored); `commandIngressAdapters.ts#commitReleaseCommand`, `commandIngress.ts#prepareRelease`; [`launch/ReleasesScreen.tsx`](../../../apps/desktop/src/renderer/src/launch/ReleasesScreen.tsx) + test (8 cases); `AppRoute` `{ kind: 'releases', projectId, release }`; runtime schema contract 69–69; the pipeline reservation moved to 70/71 and ADR-0085. **Numbering:** the launch series files this under SCR-42 beside the Pulse |
| L9 | Persona (`launch-persona`, SCR-36): character, variants, preview, keep or skip; every avatar in the window takes the kept look | **done** | [`launch/PersonaScreen.tsx`](../../../apps/desktop/src/renderer/src/launch/PersonaScreen.tsx) + test (3 cases), [`launch/persona.tsx`](../../../apps/desktop/src/renderer/src/launch/persona.tsx) (one read per window), [`shared/persona.ts`](../../../apps/desktop/src/shared/persona.ts) + test, `main/persona.ts` (`persona.json`, a preference of this machine like the pins, not journalled); «Мой облик» on the home. The look changes no role and no authority. **Numbering:** `screens.md` names SCR-36 «Estate record»; the launch series uses it for this screen |
| L10 | Help (`launch-help`, SCR-44 of the launch series) and the guide (`launch-guide`): how to work with Fabric, examples that open the conversation with their words in the composer; the first useful result on a project with the path counted from the estate | **done** | [`launch/HelpScreens.tsx`](../../../apps/desktop/src/renderer/src/launch/HelpScreens.tsx) + test (4 cases); `CeoChat` takes a `suggestion` only into an empty composer — never over a kept draft, never sent (`CeoChat.test.tsx`); the first task is filed to the backlog (`tasks.fileIdea`), starting nothing; «Помощь Fabric» in the navigation. `launch-start` is the prototype's older first-run surface, not the launch series; onboarding (`+ Проект`) stays as it is. **Numbering:** `screens.md` names SCR-44 «Manager lifecycle» |
| L11 | Manage: «Настроить агента», «Квоты», «Настройки приложения», «Личная история» — the quota moved off the home onto its own screen | **done** | [`launch/QuotaPanel.tsx`](../../../apps/desktop/src/renderer/src/launch/QuotaPanel.tsx) (the home's quota panel, moved; its durations now through the shared `until`), `AppRoute` `{ kind: 'quota' }`; `quotaHonesty.test.tsx` and `halfShipped.test.tsx` now hold the panel itself. **Not offered:** «Полномочия Fabric», «Аккаунты ИИ», «Уведомления» — the app has no estate-level surface or reader for them yet, and a link to nothing is not drawn; the prototype's `providers`/`manager` screens are its older "far horizon" style, not the launch series |
| R | Re-cut the 0.2.0 DMG, publish it and the site page with real screenshots from the demo estate | **done** | receipt [`docs/releases/fabric-0.2.0-mac.json`](../../releases/fabric-0.2.0-mac.json) (commit `f356999`, notarized, stapled, Gatekeeper accepted); packaged smoke PASS; [`fabric-v0.2.0`](https://github.com/passioncode-ai/passioncode-ai.github.io/releases/tag/fabric-v0.2.0) (asset downloaded anonymously, SHA-256 match, `Notarized Developer ID`); site PRs #7/#8 deployed (Worker `3726c08e…`, 9 live files equal the build); screenshots from the packaged app on the English demo estate (`-v lang=en`); repository description and homepage, the organisation profile (`.github` #2) updated |

**Temporarily on the home, folded under «Ещё на этой странице»:** the profile and the journal (the
quota moved to «Квоты» in L11). The design puts them behind Profile, Manage → Quotas and Pulse; they move when
L7 and L11 land, rather than disappearing before their screens exist.

**Known gaps of L2, each owned by a later packet:** «+ Добавить тему» on the board panel has no
command behind it yet (no estate-level question-ask API) — L3b; a Live row names the program of
a running session, or «Агент» when the session is not held by this window — L5; «Профиль» in the
scope bar — L9/L11.

## Decisions

- **SCN-043 amended to the design** — favourites and order from the second project, the order a
  preference of this machine (`project-order.json`) that changes no task priority
  ([scenarios](../../ux/scenarios.md), SCN-043 "Amended 2026-09-29").
- **The Russian registry is complete.** 406 keys were translated in this change and
  `ru-baseline.txt` holds no debt; the fallback to English is still tested
  (`components.test.tsx`, "an untranslated key falls back to English").
- **Durations speak the reader's language** (`duration.ts#since`, `#until` with `t`), and the
  local copies in `ProjectHome.tsx` now delegate to them.

## Checks run for L1+L2 (2026-09-29)

`bash scripts/ci.sh fast` green; `node scripts/check-registers.mjs`, `bash scripts/check-docs.sh`,
`node scripts/check-design-map.mjs` pass. Planted and watched red: the unknown-day rule and the
per-project unread count (`homeView.test.ts`), the stale-screen filter and the arrival order
(`favourites.test.ts`), a hand-tuned ported rule (`port-launch-css.mjs --check`), the English
fallback (`components.test.tsx`).

## Next task

**L3c — the Board's Back restoring its filter and selection, and the `?item=` address** (SCN-050
step 5), the last open packet of the series. Then N1 on real agents after the Codex quota resets
(2026-10-03). A newer Fabric build follows [`release-mac.md`](../../launch/release-mac.md) steps 1–6.

## Checks run for L8 (2026-09-29)

`pnpm test:releases-db` 6/6 on an owned cluster (full chain 1–69); the archive runners on 69;
`releases.test.ts` 4/4, `ReleasesScreen.test.tsx` 8/8, `PulseScreen.test.tsx` 6/6, adapter tests
24/24. Planted and watched red: a task of another project accepted, an earlier verification
replayed over a later one, a project key without its estate, a rollback naming another project's
release (DB); a rolled-back release shown as verified, the first rollback standing over a later one
(model); a retry recorded as a second act, an unfinished task offered as what went in, an unread
source shown as «no releases», a rolled-back release offered as the latest result (screen).
Walked on `…de37` in `ru`: Pulse → «Релизы →», the rolled-back 0.4.1 with its receipt and what
replaced it; a release recorded and verified through the window reached the database
(`recorded_by_kind = person`, one task, one decision, `accepted`).

## Checks run for L11 (2026-09-29)

`quotaHonesty.test.tsx` 6/6 against the moved panel, `halfShipped.test.tsx` 17/17; vitest
1510/1510. Planted and watched red: an unread quota shown as a measurement. Walked on `…de36` in
`ru`: «Управление → Квоты» read the real quota of this Mac (12 % of 5 hours, 49 % of 7 days).

## Checks run for L10 (2026-09-29)

`HelpScreens.test.tsx` 4/4, `CeoChat.test.tsx` 20/20; vitest 1510/1510. Planted and watched red: a
suggestion replacing a kept draft. Walked on `…de36` in `ru`: help and the guide against the
design, no page or console errors.

## Checks run for L9 (2026-09-29)

`PersonaScreen.test.tsx` 3/3, `persona.test.ts` 2/2. Planted and watched red: avatars that ignore
the kept look. Found and fixed while testing: a refused save was reported as a problem READING the
look, so the screen said two things at once. Walked on `…de36` in `ru`: the persona screen against
the design, no page or console errors.

## Checks run for L7 (2026-09-29)

`PulseScreen.test.tsx` 4/4, `homeView.test.ts` 12/12; vitest 1500/1500. Planted and watched red:
the window's unknown days computed from the project-filtered feed. Walked on `…de36` in `ru`: the
pulse against the design, no page or console errors.

## Checks run for L6 (2026-09-29)

`PlanScreen.test.tsx` 5/5; vitest 1494/1494. Planted and watched red: an `'unknown'` closed count
read as a real fraction, work without a goal dropped from the project level. Walked on `…de36`
in `ru`: the portfolio level against the design, no page or console errors.

## Checks run for L5 (2026-09-29)

`AgentWorkspace.test.tsx` 4/4 and `TaskPage.test.tsx` 17/17 (three cases open their tab first;
the "no siblings panel" case now opens the tab too, so it cannot pass vacuously). Planted and
watched red: the context tab defaulting to the next pack, the console read before it is opened.
The walk found that the port generator dropped `.lp-agent-body` rules — its `body` exclusion
matched class names ending in "-body"; fixed in `port-launch-css.mjs` (elements only) and the
port regenerated (+3 rules, `--check` green). Walked on `…de36` in `ru`: a task opens as the whole
page at the top, no page or console errors.

## Checks run for L4 (2026-09-29)

`ProjectLaunch.test.tsx` 5/5, the scoped Board case, `appRoute.test.ts` 22/22; the whole vitest
suite 1485/1485. Planted and watched red: the project's board read without its project, board
routes of two projects compared equal. Walked on the demo estate `…de36` in `ru`: the project
top against the design, no page or console errors.

## Checks run for L3b (2026-09-29)

`pnpm test:board-db` 11/11 on an owned cluster with the full chain 1–68; every other owned-cluster
runner (`test:archive-db`, `test:recovery-db`, `test:restore-db`, `test:ceo-db`, `test:ingress-db`,
`test:stop-db`) passes on the 68 chain. Planted and watched red: the projector keeping a settled
question set aside; defer without the person check (also refused by the table's own check); an
import refusing schema 68; an unbounded reason; any command error read as a refusal; a new
command id per retry for a deferral and for a topic; raw kind keys on set-aside and resolved rows;
hours past two days. Walked on the demo estate `…de36` in `ru`: the set-aside tab and its details,
the topic form; the walk found two defects the unit tests could not — `question_deferrals` missing
from the scoped-store registry, and raw kind keys — both fixed with a test.

## Checks run for L3a (2026-09-29)

`BoardScreen.test.tsx` 16/16 and `boardResolved.test.ts` 4/4. Planted and watched red: one
shared outcome slot, acts that stay live after a decision, open questions leaking into
«Разобрано», a draft cleared by a refusal, an option label guessed for a stale id. Walked on the
demo estate in `ru`: the Board list and a question's details, no page or console errors.
