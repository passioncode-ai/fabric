# 0.3.11 wave 4: the operator's walk of 2026-10-22 and 2026-10-23

The operator opened the installed 0.3.10 on 2026-10-22 and walked every place: the home, the board, the project page,
a task, Comms, Agents, История, Settings. Four dictated messages in Russian, paraphrased below and quoted where the
words decide something. Each item gets an id continuing [the walk of 2026-10-19](2026-10-19-operator-feedback.md)
(OF-01 to OF-13). Wave 4 of [the plan](README.md) (§6, now 0.3.11, P-20) works through them in the order of §3 below,
scenarios first (`docs/ux/scenarios.md`), then the prototype (`scripts/product/`), then the code. Status lives in this
table until each item's scenario or carry-over row takes it over.

The operator asked for the open choices to be decided, not asked back («тут надо, чтобы ты решил и подумал, как нам
сделать это получше»). Each decision is in §2 with its reason; a reversal is a new line, never an edit.

## 1. What the operator saw and what it must be

### The home (Главная)

| Id | What the operator saw | What it must be | Status |
|---|---|---|---|
| OF-14 | The home's board («На доске», 60) reads as written for agents: rows such as «SB-114: recovery after account limits» | The home says what is needed **from the person**, in plain words: who asks (agent and project), what for, how long it waits; a row opens in place to read all of it. Rows meant for agents leave the home and live on the Board screen (OF-19) | done 2026-10-23 on `agent/w4-home`: «Нужны вы» (`launch/HomeParts.tsx#HomeBoard`), each row a `<details>` opening the agent's detail and «Открыть на доске»; test `HomeParts.test.tsx`. The agents' titles follow P-24 |
| OF-15 | «Где остановились» and «Нужны вы» (questions to the person) are below the fold | Both on top, «Нужны вы» first: it is what blocks work | done 2026-10-23 on `agent/w4-home`: «Где остановились» moved under «Нужны вы» in the main column (`EstateHome.tsx`) |
| OF-16 | «Открыть переписку» is a separate action on the home | Removed from the home's head; the «Агенты в работе» widget carries one «Открыть переписку» button | done 2026-10-23 on `agent/w4-home`: «Открыть переписку» lives in «Агенты в работе» (`HomeWork.tsx#HomeAgents`, `onComms`); the requests-waiting note no longer carries its own |
| OF-17 | «Агенты в работе» grows with the page; its lines say «ещё не сказал, что делает» or the last action, which changes every second | The widget scrolls inside itself; active agents first, then idle ones; each line names the **planned task** the agent took, not its latest action (D-4); an agent holding no task says so once, not as a status | done 2026-10-23 on `agent/w4-home`: the task an agent holds is its line, the action only without one (D-4); active first; every agent in a box that scrolls (`.lh-scrollbox`); tests `HomeWork.test.tsx` |
| OF-18 | «Кто что делает» is a long list | Two columns, **В работе** and **Закончили**; pressing the section opens the Board screen (OF-19) | done 2026-10-23 on `agent/w4-board`: two columns, «В работе» (review marked inside it, its count beside the in-work count) and «Закончили» (the newest 20 finished tasks, `shared/homeLive.ts#composeHome` `done`, read in `main/workRead.ts#readHome`); «Открыть доску» in its head; tests `homeLive.test.ts`, `HomeWork.test.tsx` |

### The board (Доска)

| Id | What the operator saw | What it must be | Status |
|---|---|---|---|
| OF-19 | The board is unusable as it stands («вся доска ... пользоваться невозможно»); the operator expected a kanban (в работе, на проверке, and what comes after) and could not find or scroll it | A separate Board screen: a kanban of the fixed pipeline (D-1), **Очередь · В работе · На проверке · Готово**; the columns scroll sideways and each column scrolls down; a card is a task in plain words with its project, agent and age; filters by project and agent | done 2026-10-23 on `agent/w4-board`: the Board screen opens on the kanban «По этапам» (`launch/KanbanBoard.tsx`, `shared/taskBoard.ts#composeTaskBoard`, IPC `work:board` read by `main/workRead.ts#readTaskBoard`), Очередь · В работе · На проверке · Готово, sideways and per-column scroll, a project filter; a card opens its task in its project; «Нужны вы» is the second tab. Filtering by agent waits for the task page (OF-21) |
| OF-20 | The project's board mixes ideas, files and automation and «looks awful» | On the project page the board is that project's kanban strip (the same columns, its tasks only) and its plan (OF-24); ideas and files move under «Идеи и материалы», collapsed; automation moves to the project's settings | open |

### A task

| Id | What the operator saw | What it must be | Status |
|---|---|---|---|
| OF-21 | Opening a task, nothing says what the task is about | One task template: **Что сделать · Зачем · Что будет готово** (the brief, `fabric_task_brief`), the state and its history, who works on it, what blocks it, the project's tasks linked to it (follows, blocks, spawned), its result | done 2026-10-23 on `agent/w4-board`: the task page (`TaskPage.tsx`) opens on its template, «Что должно произойти · Зачем · Что будет готово» (the brief, editable), and the instruction the agent was given comes after it; its state, agent and claim stay in the left rail, related tasks of the same document below; test `TaskPage.test.tsx` (OF-21, OF-22) |
| OF-22 | «Назад к проекту» sits elsewhere | Back sits at the top left, above the title, as on any page; the same on a task, an agent and a project | done 2026-10-23 on `agent/w4-board`: «← К проекту» sits at the top left above the task's title (`.lp-back`), no longer among the actions on the right |

### The project page

| Id | What the operator saw | What it must be | Status |
|---|---|---|---|
| OF-23 | «Агенты на проекте» spends three lines per agent | One line per agent: name, the task it works on, since when | open |
| OF-24 | The goal shows text taken from the README; the plan and backlog are not on the page | The goal, the team and the plan are written by the agent that onboards the project (OF-31) in the working language; the page shows **Цель, Команда, План** (the project's backlog as its plan: done and next) and an analytics strip in the right column (OF-39) | open |
| OF-25 | «Откуда идём, где мы, куда» is good, but must be current and tied to who works on what | The page's head keeps it, and each line names the agents and tasks behind it, read live | open |
| OF-26 | «Что получается в этом проекте» is unclear | Replaced by the analytics strip (OF-24) and the done column of the project's kanban | open |
| OF-27 | Several people work on some projects; Fabric sees only agents | Fabric tracks a project's **people** too: the Git authors of its repositories (by name and email, last commit), shown in Команда beside the agents, and used to route a question to the person who owns that part (D-5) | moved to 0.3.12 (D-6) |

### Questions to the person

| Id | What the operator saw | What it must be | Status |
|---|---|---|---|
| OF-28 | Questions are unclear and cannot be answered in words | A question is a sentence with its context (project, agent, what it blocks) and options when there are options; the person can always answer in their own text; once answered it is marked answered, the answer goes back to the asking agent through the board, and the agent picks it up at its next call (`fabric_question_check` returns it) | open |

### Comms (Переписка)

| Id | What the operator saw | What it must be | Status |
|---|---|---|---|
| OF-29 | Comms is unreadable: nothing says what the projects are talking about | A feed, newest first, like a timeline: each post shows the project, its kind (просьба, ответ, находка, объявление), a short summary and its thread; a focus filter (one project, requests only, waiting for an answer) | done 2026-10-23 on `agent/w4-comms`: Comms opens on «Лента», the newest 100 posts of every thread first, each with its project, kind, time and text, filtered by «Только просьбы» and by project; a post opens its thread in «Ветки» (`launch/CommsFeed.tsx`, `CommsScreen.tsx`); test `CommsFeed.test.tsx` |

### Agents and История

| Id | What the operator saw | What it must be | Status |
|---|---|---|---|
| OF-30 | The Agents screen says «выберите агента слева» and nothing can be chosen; agents did not load; the layout is glued together | The list loads (or says why not); selecting an agent opens its page beside the list; the page is its flow (OF-09): the task it works on, what it did, results, then history | done 2026-10-23 on `agent/w4-agents`: the Agents place lists every agent at work from the home's reading, a terminal's included, each by the task it holds (`launch/HomeWork.tsx#AgentsAtWork`); the console panel below says once that Fabric holds no console instead of three empty columns (`EstateAgents.tsx`); tests `HomeWork.test.tsx`, `unreadSessions.test.tsx` |
| OF-34 | История is empty | История shows what agents and people did, newest first, from the journal; empty only when nothing happened, and then says so | done 2026-10-23 on `agent/w4-agents`: История keeps the acts done through Fabric and adds «Что делали агенты», the journal's events in plain words (`launch/HistoryScreen.tsx`, `Feed`); cause: История read only `act.recorded@1`; test `HistoryScreen.test.tsx` |

### Projects: onboarding and the graph

| Id | What the operator saw | What it must be | Status |
|---|---|---|---|
| OF-31 | A project added to Fabric is not processed | Adding a project starts an onboarding task for an agent: what the project is and is for, its repositories and remotes, its goal, its relations to other projects (by remote, organization, shared dependencies and board threads); the result fills the project page (OF-24) and the graph (OF-32) | moved to 0.3.12 (D-6) |
| OF-32 | No map of how projects relate | A graph of all projects: nodes are projects with a one-line summary, edges are relations (organization, dependency, board threads, cross-project requests); a repository of the same GitHub organization that is not cloned here is a node of its own kind; the organization is the level above its projects. Opened as a whole, and from each row of the rail's projects list (a graph icon opens the graph centred on that project) | moved to 0.3.12 (D-6) |

### Settings and the machine

| Id | What the operator saw | What it must be | Status |
|---|---|---|---|
| OF-33 | Settings: the limits and the project-to-project comms need a design and logic review | Settings reviewed section by section against SCN-170: each setting says what it changes, and nothing in Settings belongs elsewhere | open |
| OF-35 | Account quotas exist in Fabric although Switchboard owns accounts and quotas | D-3: Fabric's quota panel is retired; Fabric reads Switchboard where a choice depends on it | done 2026-10-23 on `agent/w4-agents`: «Квоты аккаунта» is gone from Settings (D-3); quotas are Switchboard's |
| OF-36 | Does «не давать компьютеру засыпать» work? | Measured 2026-10-23: the operator's setting is `keepAwake: 'never'` (`settings.json`), so Fabric holds no assertion; the two `PreventUserIdleSystemSleep` holders on this Mac were Claude Code sessions' own `caffeinate -i -t 300` (`pmset -g assertions`). To verify: switch the setting on, start a console, read Fabric's assertion in `pmset -g assertions`, stop the console, read it gone | open |

### The working language (P-24, amended)

| Id | What the operator said | What it must be | Status |
|---|---|---|---|
| OF-37 | Agents localize what Fabric shows, but the documentation inside projects must not change; data entering Fabric's interface goes through a localization pass with context | D-2: documents in a project's repository keep their own language; only text that reaches Fabric's interface is in the working language. Text an agent wrote in another language is localized for display with its context (a model call with the project's glossary); the original is kept and one press shows it | partly done 2026-10-23 (ADR-0174): a repository's documents keep their language and the rule says so; the display pass with a model moves to 0.3.12 |
| OF-38 | A switch in Settings | «Переводить тексты агентов на язык интерфейса», on by default and following the language; off keeps the agents' own language everywhere (the hub then names no working language) | done 2026-10-23 on `agent/w4-agents` (ADR-0174): «Агенты пишут на языке интерфейса» under «Язык», on by default (`settings.agentLanguage`); off, the hub names no working language; tests `appSettings.test.ts`, `protocol.test.ts`, `SettingsScreen.test.tsx` |

### What else (the operator: «подумать, что ещё упустили»)

| Id | What is missing | What it must be | Status |
|---|---|---|---|
| OF-39 | Product management and analytics | Per project: tasks done per week, lead time (created to done), time in review, questions waiting and their age, the share of tasks reopened; per estate the same summed. Read from the journal; no new tracking | moved to 0.3.12 (D-6) |
| OF-40 | Notifications | A question or a review waiting for the person reaches them outside Fabric too (the operator's private Telegram chat through the communicator, per the 2026-10-21 rule), once, with a link back | moved to 0.3.12 (D-6) |

## 2. Decisions (2026-10-23, on the operator's instruction to decide)

- **D-1. The pipeline is fixed, not customizable, in 0.3.11.** The board shows the ladder Fabric enforces
  (`apps/desktop/src/shared/ladder.ts`): Очередь (backlog), В работе (running), На проверке (review), Готово (done),
  with Отменено as a filter. A customizable pipeline needs a stored, versioned pipeline definition, which is the
  task-pipeline persistence contract (reserved as ADR-0173, since 2026-10-23 ADR-0175; migrations 117 and 118); customization waits for it.
  Reason: a column a person can add but the ladder does not know would show a state nothing enforces.
- **D-2. Localize the interface, never the repository.** Agents write Fabric's data (titles, briefs, stages, board
  messages, questions) in the working language (ADR-0172); documents in a project's repository keep the language the
  project chose. What still arrives in another language is localized for display, with context, keeping the original.
  This narrows ADR-0172's decision 1 ("the documentation an agent writes for the person"); a new ADR records it when
  OF-37 is built.
- **D-3. Quotas belong to Switchboard.** Fabric's quota panel (`apps/desktop/src/renderer/src/launch/QuotaPanel.tsx`,
  reading Claude Code's credential) duplicates Switchboard and reads a credential Fabric does not need. Fabric reads
  Switchboard's usage where it chooses a runner and shows nothing of its own.
- **D-4. What an agent does is its claimed task, not its last action.** The line under an agent is the title of the
  task it holds (`work_claims`), falling back to its reported stage only when it holds none. Reason: the operator
  wants plan-level progress, and an action changes every second.
- **D-5. People are read from Git, not asked.** A project's people are the authors of its repositories' commits
  (local `git log`, deduplicated by email; the GitHub organization's members when a door to it exists), so a team of
  several people shows up without setup. Nobody's address is shown outside the project page.

- **D-6. What waits for 0.3.12 (2026-10-23, the operator: «давай доделывай все сам автономно и выбирай лучшие решения ... и новая версия»).**
  Project onboarding by an agent (OF-31), people from Git (OF-27), the project graph (OF-32), analytics (OF-39),
  notifications (OF-40) and the display pass that localizes with a model (OF-37's second half) each bring a model of data
  or a spend of their own, and together they cannot pass the release's three review iterations in this release. 0.3.11
  ships the home, the board, the task, Agents, История, Comms, Settings and the project page's order; the rest is the
  next release's first wave.

## 3. Order of work (wave 4, 0.3.11)

1. **Scenarios** for every item above (new and amended SCN rows), then the prototype for the home, the Board screen,
   a task, the project page, Comms, Agents and История, in ru and en.
2. **The home and the board** (OF-14 to OF-19, D-1, D-4): what the person sees first.
3. **A task and the project page** (OF-20 to OF-26, OF-28).
4. **Agents and История** (OF-30, OF-34): they are broken, not only unclear.
5. **Comms as a feed** (OF-29).
6. **Settings, quotas, sleep** (OF-33, OF-35, OF-36).
7. **The working language's display pass and its switch** (OF-37, OF-38).
8. **Project onboarding, people and the graph** (OF-31, OF-27, OF-32), then analytics and notifications (OF-39,
   OF-40); these may move to 0.3.12 if the release gate needs the time.

Sources: the operator's messages of 2026-10-22 and 2026-10-23 in this Fabric session (four dictated parts), with the
screenshot of the home's «Сначала важное · На доске 60».
