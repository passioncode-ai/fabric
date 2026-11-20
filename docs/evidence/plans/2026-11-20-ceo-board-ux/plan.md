# Plan in waves: the CEO's board, creation and lists, sessions, cloud (2026-11-20)

Spec: [spec.md](spec.md). Owner's words: [owner-words.md](owner-words.md). Mockups: [mockups/index.html](mockups/index.html).
Research: [research-agent-analytics.md](research-agent-analytics.md). Modules review: [modules-review.md](modules-review.md),
ADR draft: [adr-draft-one-fabric-modules.md](adr-draft-one-fabric-modules.md).

## Коротко для владельца

Порядок задали вы: сначала то, что мешает работать (волна 0, сделана), потом проектируем интерфейс с вами по мокапам
(волна A), потом строим. Каждая волна ниже говорит, что она даёт, от чего зависит и где уже идёт похожая работа, чтобы
не делать её второй раз. Вопросы, где выбор за вами, в конце.

| Волна | Что | Когда |
|---|---|---|
| 0 | Починки «мешает работать» | сделано, выпуск 0.3.27 |
| A | Мокапы экранов, выбор с вами | мокапы готовы сегодня, выбор за вами |
| B | Создать, главная, проекты слева | после выбора в A |
| C | Доска CEO и база знаний, граф организаций, копия в облаке | ближайший выпуск после 0.3.27, на индексе `feat/knowledge-graph` |
| D | Менеджер сессий, дашборды внутри Fabric, экран «Компьютер» | после B |
| E | Аналитика использования, анонимная, на всех экранах, и «агентская» | каталог событий параллельно с B |
| F | Облако PassionCode после установки, онбординг, офферы (варианты) | после C |
| G | «Один Fabric, остальное модули»: ADR и согласование с владельцами | обсуждение сейчас, перенос кода позже |
| H | Несколько экземпляров Fabric | только архитектура и строка в бэклоге |
| I | Иконка приложения = аватар CEO | маленькая, с волной B |

## Wave 0: what blocks work

Done in this session ([spec section 3](spec.md#3-wave-0-done-in-this-session-fix-what-blocks-work)): `3dbbe573`,
`1f682c6a`, `d5b4b0cc`, `2fcd0996`. Ships as 0.3.27 through the release process (review iterations, CI, tag).

Found while looking for half-done work, each becomes a row with its evidence:

| Row | Evidence | Next step |
|---|---|---|
| A hub client is refused 401 «unknown or revoked credential» every 20 s since Fabric restarted at 12:08 UTC, and the log does not say who | 334 lines `mcp.other` status 401 between 12:08:53 and 13:59:10 UTC, gaps 20.0 s; at that time two Python clients reached the hub (Ania's board bridge and the agents database service) | log the client's kind and binding id (never the credential) on a refusal; tell the client's project. Ania told on thread `7e7889f6` |
| Two or three CEO projects on the board (`ceo`, `Fabric CEO`) | task `543e0340`; request `51d22d2b` item 1 | settle with the CEO which one holds `ceo.task`, remove the other through the project's own door |
| Board dispatch runs end without an answer | `board.dispatch.ended exited-without-answer` 18 times today, `empty_runs` 2 | read three runs' screens; the CO-559 retry rule already stops at three |
| `com.list` refused `not_authorized` 182 times today in one project's sessions | operations log, `tool.com.list error_code not_authorized`, project `c160aa8b` | find the call shape the agent repeats; the refusal text must say what to do instead |

## Wave A: design with the owner (mockups)

Eight screens as local HTML, each with what it decides and the recommended option: [mockups/index.html](mockups/index.html).
The owner picks; then each choice goes into `docs/ux/scenarios.md`, flows, screens and `docs/ux/product-model.json` (sync
and product report), and the design map. Existing board tasks this wave absorbs, so nothing is designed twice:
`226f3fa6` (Агенты: running first, search, expand with sessions), `340012fe` (a waiting session must not look stopped;
filters; where it runs), `ccd5c232` (nested agents under a session), `c15ae8cc` (press an agent to open its console),
`c0e6b2d2` (sessions started outside Fabric), `247266f0` (the CEO manages windows and dashboards).

## Wave B: creation, home, the projects list (build)

After the owner's picks. Scope: «Создать» with the four starts and drafts (`start/StartPaths.tsx`); «Новая сессия» moves
to the project row and the agent row (new or last); Главная's recently closed sessions (from the launch journal,
`main/sessionLaunches.ts`) and recently active projects; the left column's search, sort (the person's activity: their own
acts in История and their messages; the agents' activity: turns and commits) and organisation filter, with the project's
sessions under a chevron. Organisation comes from the repository's GitHub owner, mapped to an organisation in wave C's
graph; until then the GitHub owner itself is the filter value. Tests per screen; the built app walked.

## Wave C: the CEO's board and the knowledge base

The owner: «давай его сделаем в этом апдейте». 0.3.21 to 0.3.26 are out, so it is the first release after 0.3.27.

1. **Land the estate index first.** `feat/knowledge-graph` (ADR-0199, ADR-0200, task `57781f0d` in review) indexes every
   session, transcript, task and commit with a graph and gives the CEO direct tools. Its owner session merges it; this
   wave builds on it and adds no second index.
2. **The corporate graph** (A5): nodes organisation, GitHub organisation, legal entity, project, person, access grant;
   edges «owns», «operates», «has access via». Sources: the GitHub owner of each repository (read), the agents database's
   organisation records (through its door), Observatory's projects and keys by name only (through `project_resolve`,
   never a secret). A fact without a source is not shown.
3. **The CEO's board** (A10): a screen in Fabric and a `fabric-service/0.1` page so it is found in search and in Fabric
   Dashboards; plans per organisation kept apart (the North Star and roadmap per organisation, the board's requests, the
   CEO's own plan rows). The CEO keeps it current; the owner reads it.
4. **One knowledge base with cited answers** (A11): hybrid retrieval (BM25, trigrams, local vectors, RRF) over the index
   and the organisation's documents, answers kept only when their quote is found verbatim (path, lines, date). Method
   from the agents database's etalons named by the architect on 2026-11-20 (`data-room` 1.11.1, `estate-engine` 1.3.8,
   `org-administrator` 1.35.8; patterns `hybrid-retrieval`, `compiled-wiki`, `process-graph`, `scope-gate`,
   `compact-mcp`, `org-copy-export`). Sound Engine's and the data room's own methods are asked on the board (requests to
   `sound-engine` and the data room's project), never read from their code.
5. **A copy in PassionCode's cloud** (A12): the board's records and the graph, not the transcripts, exported as one
   versioned archive to passioncode-platform; restore drilled once. Needs a request to passioncode-platform for the
   storage door and its scope.

Traps the architect names for this template (consulted again in this session, `audit.py consult`, `org-administrator`
1.35.8): no reading of a person beyond what the North Star allows (no scoring of people), nothing that shipped is changed
or deleted (a new version sits beside the old), every landed change has its backlog and changelog line.

Exit: the CEO answers «что запланировано у организации X», «кто имеет доступ к Y» with citations, on the built app; the
restore drill passes.

## Wave D: sessions, dashboards inside Fabric, the machine screen

- **«Сессии»** (A8): every session by machine (this Mac, Mac Studio, the cloud), state, agent, project, who may type or
  stop, and the acts (open, continue, stop, move), on Switchboard's mechanisms (`switchboard --json sessions`,
  `dispatch`, `machines`) as Fabric already reads them (`main/switchboardSessions.ts`). Nothing of Switchboard's UI is
  copied.
- **D on an agent row** (A6): the agent's dashboard opens in a Fabric pane through the service descriptor and the
  `open_link` contract of Fabric Dashboards (decision for the owner, question 1).
- **«Компьютер»** (A18): load, disk, memory, what holds the space, the few Observatory findings that need a person;
  everything else stays under the hood.

## Wave E: usage analytics

Rules: the operator's event rules (an event is never renamed; a moved button keeps its name and changes its `screen`
property; new meaning is a new event; a retired one is marked with its date; a catalogue of event, status, screens with
`file#symbol`, properties, updated in the same change). Consent stays as ADR-0127 has it: nothing leaves before the person
answered the switch (`docs/ANALYTICS.md`).

1. **Screens:** one `screen_viewed` and one `action` event family across every screen, anonymous (the shared install id
   only), into PassionCode's Aptabase. Catalogue first, then code.
2. **Agent-era analytics, concept** (from [the research](research-agent-analytics.md)): raw events are too low to show
   the task behind them (C1); task instances can be recognised from the event stream and emitted as task-level events
   (C2). Proposal for Fabric: a `task_episode` built on the device from what Fabric already knows (the task, its source,
   the session, the agent, how it ended) with coarse fields only: where the work came from (board, CEO, a screen, a
   routine), what kind of work, how it ended, what came next. Intent from free text is not sent: models still trail
   people at goal identification (C4), and a summary of text would leave the device. Aggregation with a formal privacy
   bound (differential privacy, C9 to C11) before anything is read across installs; the OpenTelemetry GenAI conventions
   (`gen_ai.conversation.id`, C29) as the session key so agent sessions and app sessions join (C21). Privacy modes as in
   Amplitude's agent analytics, metadata only by default (C20, C25).
3. **Where it is read:** the analytics agent owns the guidance and the reading; Fabric only emits.

## Wave F: PassionCode cloud, onboarding, offers

- **Cloud after install** (A13): Fabric signs in to PassionCode's cloud as a step of the first run, after the local
  setup works offline; the cloud adds the backup (wave C) and later the runners.
- **Onboarding**: one path a new person walks: install, first project, first agent session, the CEO, the board; each step
  says why. Walked by the design tester persona panel before it ships.
- **Offers, variants for the owner (not chosen here):**

| Variant | What the person gets | What we need first | Risk |
|---|---|---|---|
| V1. Our model key by subscription | the CEO and agents run on PassionCode's key, no own key to set | metering per install, a wallet and limits (the estate's spending rules), billing | spend above the estate limit; abuse |
| V2. Cloud runners | agent sessions run in PassionCode's cloud, the Mac stays free | the session manager (wave D) moving a session to a machine; a runner image | cost per hour; data leaving the Mac |
| V3. «Virtual company» image | a cloud machine with Fabric, the CEO, the board and agents ready, which builds more agents and projects | V2 plus the CEO's board (wave C) | the largest build; support load |
| V4. Free local Fabric, paid cloud only | everything local stays free; V1 to V3 are add-ons | none beyond V1 to V3 | none new |

## Wave G: one Fabric, the rest as modules

[modules-review.md](modules-review.md) and [the ADR draft](adr-draft-one-fabric-modules.md): what Switchboard, Fabric
Dashboards, Inbox and the adapter duplicate, the shared modules proposed and a reversible migration. No code moves in this
order. Each owner project gets the review on the board with its questions; the ADR is accepted only after they answer.

## Wave H: several Fabric instances (architecture only)

What exists: Fabric already runs on a data folder of its own with `--user-data-dir` (the acceptance walks use it), each
machine user gets its own hub port (CO-505), and `hub.json` names the running instance. A profile would be a named data
folder with its own hub port, CEO and board, chosen at start; the default stays one. Backlog row only; nothing built.

## Wave I: the app icon is the CEO's avatar

One setting: the character the person chose in Your Fabric is the Dock and window icon (macOS `app.dock.setIcon`,
Windows the window icon); PassionCode's mark stays the organisation's. Mockup: [08-app-icon.html](mockups/08-app-icon.html).
Known limit to settle in the build: `main/appIcon.ts` sets the Dock icon only in a development run, because the packaged
bundle carries its own `.icns`; at runtime the Dock follows the avatar while Fabric runs, and Finder and Launchpad keep the
bundle's icon (changing the bundle itself would break its signature). The shipped `.icns` becomes the default character.

## Questions for the owner

The mockups carry 26 smaller choices, each with the recommended option in its «Что здесь решаем» box
([index](mockups/index.html)). The owner answers those on the pages, by voice to the CEO, or leaves them to us: an
unanswered choice is built as recommended. The three below change a wave's scope, so they are asked directly.

1. Fabric Dashboards inside Fabric: embed its pages through the same contract (recommended: one host contract, no second
   UI), or move the whole app into Fabric.
2. The projects list's default sort: by your own activity (recommended: you asked for it first), or by the agents'.
3. Which offer to work out first: V1 own key by subscription (recommended: smallest step, uses wave 0's CEO), V2, V3 or
   V4.

## Rows this plan opens

Filed on the Fabric board as tasks with this plan as their source: wave 0's four found rows, waves B to I one row each.

## Amended 2026-11-20, evening: part 5 of the owner's words

[Part 5](owner-words.md#часть-5-2026-11-20-вечер-то-же-окно-ceo) adds to the plan, appended here rather than written into
the waves above, which stay as they were planned.

- **Wave 0 grows by one fix.** The red banner «База данных не отвечает. Скорее всего, локальный стек остановлен» during a
  disk stop Fabric made itself: branch `fix/stack-outage-banner` (the stack watch's notice speaks alone during an outage,
  the banner goes when the database is back, the log counts the outage's failures into `stack.back`, the disk is said under
  15 GB). Disk cleanup and the disk watchdog stay with the Observatory session.
- **The owner's dictation tail** («Продолжение следует» is no order): in the CEO's brief and the voice's instructions,
  branch `fix/ceo-dictation-tail` on top of 0.3.27 (`shared/ceoAgent.ts#DICTATION_TAIL`).
- **The CEO's window** moves and resizes freely, opens where it was left on any display, never off every screen; then two
  or three polish iterations of that window and the home's greeting block with captures before and after (sheleg-design,
  focused visual work: composition, states, finish; the project's own tokens, no new pack). The greeting block stays light.
- **Wave C's model** is checked against the owner's first data: [org-graph-model.md](org-graph-model.md) (shares, roles,
  PM agents, a project of several repositories, the personal organisation). The data stays on the owner's computer.

## Wave J: the CEO's editor mode (not a priority; design only)

The owner: «пока не приоритет, а все остальное приоритет». A row on the board (`b291a1e5`) and this sketch; nothing is
built until the owner raises it.

- **The switch.** «Режим редактора» in the CEO's window. On, the CEO stops delegating elsewhere: each thing the owner
  says becomes a Fabric task on the board at high priority (ahead of other sessions' non-critical work, behind a critical
  bug in progress), and the CEO starts or reuses one Fabric developer console on it.
- **Who may change code.** Only a Fabric run from its own source (a development checkout: `electron-vite dev`, which
  already rebuilds the renderer on save and restarts main). Fabric knows it is one by `app.isPackaged === false` and a
  repository at its root; the developer console runs in that checkout's own worktree, so the owner's running window
  keeps working while the change is made, and a feature switch (the settings file) turns a new behaviour on for the
  owner only until it is reviewed.
- **Everyone else.** An installed build has no source: the same switch files a feature request to PassionCode (the board
  of the Fabric project, kind request, with the words and the screen it is about) instead of a code change.
- **Design mode for a request.** The request can carry a mockup: the current screen opened in a copy where its parts can
  be moved and changed, saved as a static HTML page attached to the request. The renderer's screens stand
  (`apps/desktop/stand`) already renders each real screen from fixtures, so the copy needs no live data.
- **Traps to settle before building.** A hot rebuild under a live CEO must not restart the CEO's own console; a change the
  owner did not see through review must not ship in a release (the switch defaults off in a packaged build); the board
  priority needs a field the board does not have yet (today the order is the register's own, ADR-0101 §3).
