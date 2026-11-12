# Simple screens: one input or one choice, a terse interface

**Status:** waves 1 to 3 built 2026-11-12, wave 4 in part (the task page; the cross-cutting rules; Главная; the Board's notes and words); the rest planned below · source: the operator, 2026-11-12, with a
screenshot of the task page:

> проработать UI этой и все другие страниц, наш принцип это простота, от пользователя только простой инпут или выбор, и
> ёмкий лаконичный интерфейс

**Vision check.** Aligned: it serves vision principle 4 («sourced state, not confidence theatre») and the operator's
earlier «максимально просто, нативно, но в то же время информативно» ([simple Fabric v2 §0](../2026-10-26-simple-fabric-v2.md#0-the-operators-words)).
It adds no capability; it removes what a person has to read or type.

## The rules every screen is held to

| id | Rule | Fails as |
|---|---|---|
| SP-1 | One title per screen: the top bar's. A page heads only the object it shows (a task, an agent), at most two lines, 24 px | a place named three times (top bar, kicker, `h2`) |
| SP-2 | No machine identifier reaches a person: a UUID, `agent:<uuid>`, a session, claim or task id, a hash, a journal `seq`, a capability name. Say who in words («агент», «вы», the project's name) | «назначено: agent:a44fb484-… → operator», «Занята: a44fb484» |
| SP-3 | The person types one simple input or picks a choice. Text an agent wrote is shown as text; it becomes a box only when the person presses «Изменить», one part at a time. No multi-field form | three open boxes of an agent's brief |
| SP-4 | A fact is said once on a screen | the status in a pill, a rail and a callout |
| SP-5 | No sentence about how the interface works, no placeholder row («—»), no value that has lapsed («до 0 с») | «Задача ещё не запускалась. Её описание и заметки хранятся здесь.» |
| SP-6 | What is read rarely is folded under one line and read only when opened | five tabs, one of them about the whole project |
| SP-7 | A hint is one short line or none; detail goes into the control's own words | a three-sentence lede under a switch |

The rules extend internal-screens IS-01, IS-04, IS-08 and IS-18 (super-ux, `ux-flows/references/internal-screens.md`): one question per screen, every element earns its place, density decided
once for the product.

## Wave 1, built 2026-11-12: the task page (SCR-32, SCN-174)

| | Before | After |
|---|---|---|
| Head | the project strip «Трудяга · Последнее событие · Пульс», «← На главную», a CAPS kicker `COMPANY-ASSESSMENT-AGENT / КОМАНДА / АГЕНТ`, a three-line `h2`, a subtitle | «← На главную», the title in at most two lines, one line of facts: state, «{агент} · {runner}», «агент → вы», «запуск 2, идёт», «занята: {агент}, ещё 12 мин» (only while it holds), «заведена …» |
| Left rail | a letter box, the name, `назначено: agent:<uuid> → operator`, «Задача 159acd40», «Запуск —», «Сессия —», «Заявка Занята: a44fb484, до 0 с», «Прошлые задачи» | gone; what it said is in the facts line, in words |
| Tabs | «Сейчас», «Контекст», «Решения» (the project's), «Задачи и сессии», «Дальше» | none: one column; «История» and «Что получает агент» are folds, the second read only when opened |
| No run | a callout «Запуска ещё не было / Задача ещё не запускалась…» | nothing: the state pill says it |
| Brief | a lede, three open boxes, «черновик: agent:<uuid>» above each | «Что сделать», «Зачем», «Готово, когда» as text, each with «Изменить» (or «Написать» on «Не написано»); one box with «Сохранить» and «Отмена» while changed |
| Notes | a tab, a lede, «agent a44fb484 · 3 ч назад» in mono, a big «Перенести в память» | «Заметки» under the brief: the text, «агент · 3 ч назад · В память проекта», one box with «Добавить» |
| Original instruction | always, as a quote with «Источник (document): …» | folded «Исходная постановка», and only when it differs from the title |
| Blockers | «Её ничего не держит.» when none | said only when something holds it |

Code: `apps/desktop/src/renderer/src/TaskPage.tsx#TaskPage`; styles in `scripts/product/launch.css` (the `.lp-task*`
rules), ported into the app by `scripts/launch/port-launch-css.mjs`. Tests: `apps/desktop/src/renderer/src/TaskPage.test.tsx`
(34, the UX28-01 guards against a brief written into the wrong task kept, now through «Изменить» and «Сохранить»).

## Waves 2 to 7: the rest, from the audit of 2026-11-12

The audit read every other screen's code (file:line evidence in each row). Order: what a person sees most first.

### Wave 2: cross-cutting (every screen)

**Built 2026-11-12:** X-4 and X-5 on Доска, Переписка, План, Пульс, Выпуски, Граф, Настройки, the project page, «Где работа», «Облик» and «Создать» (the kicker, the slogan `h2` and the lede gone; the `h2` kept visually hidden for focus; the strips gone; the top bar says «Доска · {проект}» and «Планирование · {проект}» on a project's). X-1 and X-2 where a renderer cut an id: the kanban card, the agent page's session line, «Сессия закончилась», «Без темы», the plan's work node (subtitled by its runner), Выпуски, Пульс, the feed, the estate's agents, the context's size line (no hash). X-3 is two ratchets in `scripts/check-design.mjs`: SP-2 (`scripts/sp2-baseline.txt`, 13 places still to go) and the em dash in a Russian string (`scripts/emdash-baseline.txt`, 133 strings still to go, eight fixed). The unused `HomeLive` is deleted. Left: X-6 (hints), X-8 (the prototype's task view), and what the baselines list, each in its screen's wave.

| # | Change | Where | Rule |
|---|---|---|---|
| X-1 | One helper names an agent in words («{проект} · {runner}»); replaces `sessionId.slice(0, 8)`, raw `program`, `agent`, `runner_id`, `agentId` | `runnerLabel.ts`; `AgentPage.tsx` (sessionWord), `KanbanBoard.tsx` (`launch.kanban.session`), `AgentsScreen.tsx` (`agentScreen.sessionGone`), `PulseScreen.tsx`, `SwitchboardSessions.tsx`, `ProjectLaunch.tsx` (team rows), `AgentAccessPanel.tsx` | SP-2 |
| X-2 | One project-name fallback «проект вне списка» instead of an id slice | `shared/projectDisplayName.ts`; `ReleasesScreen.tsx`, `PulseScreen.tsx`, `CommsScreen.tsx` | SP-2 |
| X-3 | A gate: `check-design.mjs` refuses `.slice(0, 8|12)` in renderer text and `{id}`, `{sha}`, `{hash}`, `{seq}`, `{capability}`, `{task}` placeholders in `ru.ts` | `scripts/check-design.mjs` | SP-2 |
| X-4 | The top bar's `h1` is the only screen title: the `lp-heading` kicker, `h2` and lede go from Board, Comms, Project, Pulse, Releases, Plan, Settings, History, Create; the panel title of Agent access | each screen; a shared rule in `launch.css` | SP-1 |
| X-5 | `FabricStrip`, `FeedStrip`, `ProjectStrip` leave the screens; freshness, where needed, is one quiet line | `launch/FabricStrip.tsx` and its callers | SP-1, SP-4 |
| X-6 | Hint paragraphs (`*.lede`, `*.note`, `*.body`) become one line or nothing | each screen | SP-7 |
| X-8 | The prototype's task view draws wave 1's page (the app's task page has no view of its own in `scripts/product/` yet; its styles already live there) | `scripts/product/launch.mjs` | SP-1 to SP-6 |
| X-7 | No em dash in `ru.ts`: `launch.project.way.unreadable`, `workspace.hint`, `launch.plan.lede`, `launch.releases.unreadRef`, `launch.pulse.formulaBody`, the onboarding «unavailable» separator | `i18n/ru.ts` | brand rule |

### Wave 3: Главная

**Built 2026-11-12:** the hero's kicker and «Fabric» heading (kept visually hidden), «Мой облик» on the home, the branch in an agent's row, «Новая тема появится здесь…». **Kept, with the reason:** the strip's «ждут вас» cell is where an unreadable count is said (`attentionHonesty.test.tsx`, `waitingForYou.test.tsx`); it goes once the greeting can say «не прочитано» itself. «Список неполный…» is not a note about the interface but a statement that the list is incomplete (0.3.19 review UX-6, UX-8), so it stays. The six cells become three in a later step of this wave, after the same honesty move.

- The waiting count said once (the «Нужны вы» column with its pill): the greeting is «Добрый день.» alone, the stat strip loses «ждут вас» (`EstateHome.tsx`, `HomeWork.tsx`, `HomeParts.tsx`).
- The hero: avatar and greeting; «Мой облик» moves to Настройки (`EstateHome.tsx`).
- Three stats, «Работают», «На проверке», «Брошено», not six (`HomeWork.tsx`).
- An agent row: name, task, «Работает · 12 мин»; no branch, no «ветка неизвестна» (`HomeInWork.tsx`).
- No «Список неполный…», no «Новая тема появится здесь…» (`HomeBoardWaiting.tsx`, `HomeParts.tsx`).
- Delete the unused `HomeLive` (`HomeParts.tsx`).

### Wave 4: Доска

**Built 2026-11-12, in part:** with nothing chosen the card says «Выберите запись слева», not the ritual panel; the list's foot note («просмотр не закрывает обязательство») and the card's «Ответ и квитанция сохраняются…» are gone, the keys hint stays; a proposal says «Агенты не договорились, решите вы», not «круг N из M»; an accepted proposal says «задача создана» with «Открыть задачу», never the task's id. **Next:** the tabs, «Добавить тему» as one input, «Отложить» in one press, the row's and the review card's repeats.

- A toggle «Нужны вы | По этапам», then three tabs «Сейчас», «Отложено», «Решено»; no strip, no heading block, no «Начать разбор» (`BoardScreen.tsx`).
- «+ Добавить тему» is one input «О чём спросить?», the project from the scope (`BoardScreen.tsx`).
- «Отложить» is one press; a reason is optional (`BoardScreen.tsx`).
- A row says project and kind once; the card's foot notes go (`BoardScreen.tsx`).
- With nothing chosen: «Выберите вопрос слева», not the ritual panel.
- The kanban card names the agent, not «Сессия a44fb484»; its column notes become a tooltip (`KanbanBoard.tsx`).
- «создана задача {task}» becomes «Задача создана» with «Открыть»; «круг {depth} из {bound}» becomes «Агенты не договорились, решите вы» (`ObligationActs.tsx`).
- The review card does not repeat its title and question (`ReviewDecision.tsx`).

### Wave 5: the project page

- One name (the top bar); the path and the revision move to the project's settings (`ProjectHome.tsx`, `ProjectLaunch.tsx`).
- The goal said once, in the head (`ProjectLaunch.tsx`, `ProjectProfile.tsx`, `ProjectWay.tsx`).
- One page with «Путь», «Нужны вы», «Агенты»; every other section behind «Ещё» (`ProjectHome.tsx`).
- The header's edit form becomes «Изменить» per fact, one input each (`ProjectHome.tsx#ProjectHeader`).
- «BL-523 в docs/backlog.md» becomes «Из бэклога»; a request card never titled by its capability (`WorkDirections.tsx`).
- `workspace.hint` goes.

### Wave 6: the agent page, Переписка, Доступ агентов

- Agent page: no «← Главная» and no `h3` under the title; «Сессия закончилась» without its id; status, project and last signal once; one task list with «В работе / Готово / Все»; no `openSessionNote`, `historyLede`, `say.lede`; no hash in the context's size line (`AgentPage.tsx`, `AgentsScreen.tsx`, `AgentWorkspace.tsx`).
- Переписка: no strip, kicker, `h2` or lede; «Без темы» for an untitled thread; no digest, hash or capability name; filters: the project and «Только открытые»; two modes, «Лента» and «Ветки» (`CommsScreen.tsx`, `CommsParts.tsx`).
- Доступ агентов: no panel title or three-sentence lede; no hub origin, server URL or agent id; a pending card is the name, «просит: …», «истекает через N мин», «Разрешить» / «Отказать» (`AgentAccessPanel.tsx`).

### Wave 7: История, Настройки, Создать, Пульс, Выпуски, План, Граф

- История: no `h2` or lede; one feed with the «Кто» chip; diagnostics move to Настройки (`HistoryScreen.tsx`).
- Настройки: one title; one short line per setting; the idle-agents list goes (`SettingsScreen.tsx`).
- Создать: one title, no filler lede; the two «open a folder» entries become one; «Новый проект» is one input «Как назвать проект?», the rest defaults the agent asks later; «Создать агента» is one input «Что должен делать агент?» (`start/StartPaths.tsx`, `Onboarding.tsx`, `start/AgentPaths.tsx`).
- Пульс, Выпуски, План, Граф: no kicker and slogan headings, no formula paragraphs, no id slices; «Что выпущено?» as one input, then «Работает» / «Сломалось» (`PulseScreen.tsx`, `ReleasesScreen.tsx`, `PlanScreen.tsx`, `GraphScreen.tsx`).

Each wave lands with its scenarios amended, its strings checked by the copy checker in both locales, the prototype's view and
its styles in `scripts/product/` where the screen has one, the design map and `ci.sh fast` green.
