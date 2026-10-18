# Fabric 0.3.7 — simple: the place a person starts, sees and steers (plan, 2026-10-15)

**Objective (the operator, 2026-10-15).** Fabric is too complex. It is software for people: the agents talk to each
other on their own, and what Fabric shows is shown to a person. Keep the flows and mechanics that serve that person,
remove the rest, and make Fabric the place where everything starts: open a console of your coding agents, see your
agents, set everything up, see your projects, see the questions waiting for you in plain words, create an agent,
create a project. **No permission prompts and no pop-ups — every act happens at once, is logged, and can be rolled
back,** so the cause of anything that went wrong can always be found and fixed.

In the operator's words: «никаких вот этих пермишенов, всплывающих окон не надо, но все должно логироваться, все
должно быть понятно исторически, каждое действие отматываемое всегда у нас в системе».

**Vision check** ([vision](../../../ux/vision.md)). Aligned: it serves §4 (the person is the operator and designer
of Projects and does not carry every session in their head) and §5.1 (Projects, not agent conversations). §5.3,
"every effect has a boundary, an owner and a receipt", holds: the receipt becomes the history entry with its undo,
not a dialog. The anti-vision's "multi-chat cockpit" is what the current screens drift towards (agents in twelve
places); this plan moves away from it.

**This plan absorbs** the [onboarding plan](../2026-10-13-onboarding-036/README.md) (P-19, written as 0.3.6): its
first-run wizard, scan, open, create-project and create-agent flows are kept and redrawn in the simpler frame below.

**Inputs.** The renderer inventory of 2026-10-15 (§1, read from the code at `940f14d3`); the
[0.3.6 release review](../2026-10-14-release-036-verification.md)'s UX findings; SCN-158…SCN-161; the onboarding
plan's wave 0 [funnel review](../2026-10-13-onboarding-036/2026-10-13-wave-0-funnel-review.md).

## 1. What is there today (read from the code, 2026-10-15)

- **Three layers of navigation at once:** the tab strip and the back button (`App.tsx`) and the left panel
  (`launch/LaunchShell.tsx`). Every project in the left panel has six links (Обзор, Команда, Циклы, Цели, Память,
  Настройки) that all scroll one page (`LaunchShell.tsx`, `PROJECT_SECTION_ANCHOR`).
- **The same thing in many places:** agents in twelve or more components (the home's strip, «Кто что делает»,
  «Агенты в работе», the live feed; Agents; Where work is; the project's team, Who is working, the agents section,
  created agents, the harness section; Settings' catalogue and Agent access); the board in eight; the journal in four.
- **The project page** is the launch header plus about twenty sections (`ProjectHome.tsx`, over 2 300 lines), among
  them «Что получает сессия» — the list of the ~45 MCP tools a session gets, a page written for agents.
- **Confirmations and pop-ups: sixteen kinds.** One guards a real boundary — a coding agent opened outside Fabric
  asking to join a project (ADR-0134), and it is shown three times (a native dialog, the board, Settings → Agent
  access). The others are steps: release a claim (three presses), stop a session, detach a repository and discard a
  draft (`window.confirm`), replace a task's text, the workspace-folder question, the usage-count notice, the
  deep-link offer, the review ritual.
- **Jargon on the person's screens:** «заявка», «аренда agent-sync», «строка бэклога», «сессия», «журнал»,
  «пространство», «CEO», «Пульс», «Циклы», «шаг N из M», «молчит», «никто не отмечается», a raw runner id, an
  eight-character project id.
- **No undo.** Nothing an operator does can be taken back from the interface, except a granted access.
- **Dead ends:** «Поговорить с Fabric» and «Обсудить с Fabric ↗» open a conversation that is not switched on.

## 2. The target — five places, nothing else on the rail

| Place | What the person does there | Replaces |
|---|---|---|
| **Главная** | sees what needs them (questions in plain words), what is being done now (one line per agent at work), and their projects (favourites first, then latest activity) | the home, the Board screen, Where work is, Pulse, the live feed |
| **Проект** (one page per project, opened from the list) | reads where it came from and where it goes, answers its questions, sees its board, opens a console, starts a task | the project page's twenty sections; Team, Cycles, Goals, Memory as separate links |
| **Агенты** | sees every agent — coding agents on this computer and agents built in Fabric — with what each is doing; opens a console in one press; creates an agent | Agents, the catalogue in Settings, Agent access's list, created agents |
| **История** | every act, by whom (person or agent), when, on what — with **Отменить** where the act can be undone, and why not where it cannot | the journals, Pulse, diagnostics, the releases log |
| **Настройки** | how Fabric behaves: language, appearance, sleep, the fallback order, usage counts, an agent's access | Settings, Quotas, Private history (as a section) |

The left panel holds the five places and, under Главная, **the projects list**: name, a dot when an agent works
there, a count when something waits for the person; favourites on top. One «+» at the top opens **Создать**: проект
· агента · открыть папку с проектами. No tab strip; Back is the system's own (⌘[ and the swipe).

Off the rail (kept in code, reachable where they belong): Comms (inside a project, «Переписка с другими
проектами»), Planning (inside a project's way), Releases (a filter of История), the conversation with Fabric (hidden
until it is switched on, RM-09).

## 3. The rule: act, log, undo — no confirmation dialogs

Recorded as an ADR in wave 0. On the operator's own machine (the operator, 2026-10-11: this machine is the
operator's workplace):

1. **An act happens at once.** No «Вы уверены?», no `window.confirm`, no native dialog. Releasing a claim, stopping
   a session, detaching a folder, discarding a draft, replacing a task's text, answering a question — one press.
2. **Every act is a history entry with its actor and, where one exists, its inverse:** a stopped session can be
   started again from where it stood, a released claim taken again, a detached folder attached again, a discarded
   draft restored, an answered question reopened, a moved task moved back. История lists them with **Отменить**; an
   act with no inverse (a message sent to another project, a published release) says so and why.
3. **A coding agent that asks to join a project is let in** and told the rules; the person sees it in История
   («Codex подключился к проекту Fabric из терминала») and in Агенты, with **Отключить** one press away. The native
   dialog, the board item and the Agent-access queue for it go (ADR-0134 and ADR-0115 amended). What stays a
   boundary: another person's machine (ADR-0144), spending money above a limit, publishing outward and deleting
   what cannot be restored — those still stop and ask, in one place (a question on Главная), never as a pop-up.
4. **Notices stop being banners.** The usage-count question moves into the first run's language step; the "database
   is reachable from your network" warning becomes a question on Главная with its fix; a deep link opens what it
   links to.

## 4. Words for people

- **Agents report in plain words** (asked of them since 0.3.6); Fabric shows the agent's sentence, never a machine
  status. A session that has said nothing shows what it is working on; one gone quiet says «давно не отзывался —
  {time}».
- **One vocabulary**, from `CONTEXT.md`, in the person's language: проект, агент, задача, вопрос, история. Never on a
  person's screen: claim/заявка, lease/аренда, session/сессия, stage, journal/журнал, estate/пространство, harness,
  runner id, backlog row, MCP tool names. The harness section moves to the agent's own view (its console's info).
- **A question is asked as a question to the person:** what is asked, why it matters, the options as buttons, and
  what each will do — written by the agent that asks, checked by Fabric against the board's rules.

## 5. What goes away (the cut list)

Removed from the interface (code kept only where another place uses it, otherwise deleted with its tests): the tab
strip; the six per-project rail links; the Board screen as a separate place (its questions live on Главная and in
the project); Where work is; Pulse; the live feed; «Ещё на этой странице»; the profile block on the home; the
project's Harness, Diagnostics, Workspace canvas, Automations, Transcripts, Decisions and Retro sections (their
content reachable from История or the agent's view); the revision banners of the project header (a save is
immediate, a conflict is settled by the later write and recorded); every confirmation in §1 except the boundaries
in §3.3.

Each removal is a scenario retired with its reason (`docs/ux/scenarios.md`, `Status: retired`), never a silent
deletion.

## 6. Waves

| Wave | Closes | Exit check |
|---|---|---|
| 0 · Decide | the act-log-undo ADR; the ADR-0134/0115 amendments; the cut list | done 2026-10-15 (ADR-0160) |
| 1 · Spec | scenarios for the five places and История's undo; retirements for the cut list; flows and screens; the prototype drawn for every place and state (`scripts/product/`), in ru and en | `docs/ux/lint.py`, the product-model and report checks, the prototype walked |
| 2 · History and undo | the inverse of every operator act in the main process (stop → start again, release → take again, detach → attach, discard → restore, answer → reopen, move → move back), recorded with its actor; the История read | a test per act: do, undo, both in history |
| 3 · Shell | the five-place rail with the projects list; Создать; no tab strip; the confirmations removed; the coding agent let in, with Отключить | component tests; the walk in ru and en |
| 4 · Places | Главная, Проект, Агенты, История, Настройки rebuilt to the prototype; the onboarding plan's wizard, scan and create flows in the new frame | screenshots against the prototype; the walk from zero on a disposable stack |
| 5 · Release | three verification iterations, CHANGELOG, docs, map; 0.3.7 tagged, published, installed | the release run green; the installed bundle verified |

**Wave 3's folder step landed ahead of it (2026-10-18, CO-328).** A coding agent in a folder no project holds is no longer told to have the person add it: Fabric attributes the folder itself on enrollment — to the project with the same remote, the asking agent's project by parent folder or owner, the one project of that owner, or a new project — as the agent's journalled act with its cause ([ADR-0164](../../../adr/0164-a-folder-with-no-project-is-attributed-by-fabric-never-handed-to-the-person.md)). Wave 2 owes these acts their **Отменить** in История (`project.repo.detached@1`; for a made project also `project.archived@1`) and the memory that keeps an undone folder from being attributed again; wave 3 still owes letting the agent in without the grant prompt.

**No go is awaited (the operator, 2026-10-17).** «а как сделать чтобы не ждать моего слова больше и не блочить процесс мной? я же и так изначальную задачу даю»: the operator's instruction is the go. Waves run one after another without asking; each lands with what it shows (the prototype, screenshots), and the operator corrects asynchronously — a correction becomes the next change, never a stop. What still stops and asks: the human gates (a sign-in, a consent, a payment, a secret typed by a person), spend above a limit, and a capability that contradicts `docs/ux/vision.md` (its alignment rule in `AGENTS.md`).

## 7. Wave 1 — the spec, done 2026-10-17

Decided by the agent under the standing go (§6), recorded here for the operator to correct asynchronously:

- **Scenarios** (`docs/ux/scenarios.md`, section "Fabric 0.3.7 — simple"): SCN-162 rail, SCN-163 Главная, SCN-164
  questions with options as buttons and «Отменить» on an answer, SCN-165 Проект, SCN-166 Агенты, SCN-167 a coding
  agent let in with «Отключить», SCN-168 История, SCN-169 undo, SCN-170 Настройки, SCN-171 «Создать». The onboarding
  plan's scan, open, create-project and create-agent paths are **amended in place** (SCN-126…SCN-129, SCN-136) and
  entered from «Создать» rather than duplicated.
- **Retired** with the cut list as the reason: SCN-026 (live feed), SCN-030 (workspace canvas), SCN-044 and SCN-093
  (profile block), SCN-055 (Board/Inbox), SCN-056 (Automations), SCN-062 (Retro), SCN-073 (Diagnostics), SCN-094
  (Pulse), SCN-141 (Where work is). **Amended** for ADR-0160 or the new frame: SCN-028, 031, 033, 036, 040, 041, 047,
  049, 050, 096, 126, 127, 128, 129, 132, 134, 136, 137, 140, 142, 158, 159, 160. Built screens stay `built` with a
  dated "0.3.7 target" note until the wave that removes them; designed-only cut screens are retired (SCR-42, SCR-45,
  SCR-54).
- **ADR-0115 for product capabilities:** an agent's ask of a product's resources (not an ask to join a project) is no
  longer a native prompt, notification or queue item; it is a question on Главная with «Разрешить» / «Не разрешать»,
  and a grant is withdrawn with «Отозвать» or «Отменить» (SCN-132 amendment). An ask to join a project is let in
  (SCN-167).
- **The act line:** after an act, one quiet line at the foot of the place, «{что сделано} · Отменить», until the next
  act or leaving the place; История keeps every act. No toast, no banner, no dialog.
- **Flows** FLW-93…FLW-98 (FLW-40 amended); **screens** SCR-84…SCR-90. FLW-93 and FLW-97 are added to the
  unmeasured-flows debt until waves 3 and 2 land their screens.
- **Prototype:** `docs/reports/product.html#view-simple-home` and the other `simple-*` views
  (`scripts/product/simple.mjs`, `simple.css`), every state of every new scenario in Russian and English
  (`?lang=en`), walked in Chrome: 52 states × 2 languages, no page errors; journey PJ-42. The prototype hides the
  conversation with Fabric on these views (RM-09).

**Next task.** Wave 2: the inverse of every operator act in the main process — stop → start again, release → take
again, detach → attach, discard → restore, answer → reopen, move → move back, disconnect → let back in, rename →
old name — each recorded with its actor and `undoes`, tested do-then-undo with both acts in the journal; then the
История read (SCR-88) that SCN-168/169 describe.
