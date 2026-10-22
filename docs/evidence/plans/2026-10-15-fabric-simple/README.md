# Fabric 0.3.7 — simple: the place a person starts, sees and steers (plan, 2026-10-15)

*2026-10-22: wave 4, which this page numbers 0.3.10, is now 0.3.11 (P-20); 0.3.10 became the scroll patch (P-23).*

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
| 2 · History and undo | the inverse of every operator act in the main process (stop → start again, release → take again, detach → attach, discard → restore, answer → reopen, move → move back), recorded with its actor; the История read | a test per act: do, undo, both in history — **done 2026-10-17**, [§8](#8-wave-2--history-and-undo-done-2026-10-17) |
| 3 · Shell | the five-place rail with the projects list; Создать; no tab strip; the confirmations removed; the coding agent let in, with Отключить | component tests: **done 2026-10-18**, [§9](#9-wave-3-the-shell-done-2026-10-18); the walk in ru and en is folded into wave 4's walk from zero |
| 4 · Places | Главная, Проект, Агенты, История, Настройки rebuilt to the prototype; the onboarding plan's wizard, scan and create flows in the new frame | screenshots against the prototype; the walk from zero on a disposable stack. **Moved to 0.3.8 on 2026-10-20, renumbered 0.3.9 and then 0.3.10 on 2026-10-21** (P-20; 0.3.8 became the audit patch, 0.3.9 the core): the final pass shipped waves 0 to 3 and F1 to F9 as 0.3.7, and the places, the onboarding flows and SCN-163 to SCN-171 are built in 0.3.10 ([0.3.7 ledger](../2026-10-20-release-037-verification.md), PL-1) |
| 5 · Release | three verification iterations, CHANGELOG, docs, map; 0.3.7 tagged, published, installed | the release run green; the installed bundle verified |

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

## 8. Wave 2 — history and undo, done 2026-10-17

Main process and data only; the История screen (SCR-88) is wave 4, and only the read it needs is built. Decided by the
agent under the standing go (§6), recorded for the operator to correct asynchronously:

- **One record for every act: a companion event, not a field in eight payloads.** `act.recorded@1` (journal-only)
  carries the kind, the person-readable subject, a sentence key with its words, the inverse (a command and its
  arguments) **or** `why_not`, and `undoes` (the seq of the act it reverses). Its actor is the journal row's. Three of
  the acts are written inside SQL commands that know nothing about undo (`answer_question`, the claim and task
  projectors); a companion record says the same thing for all of them without touching eight writers
  (`apps/desktop/src/shared/acts.ts`, `main/acts.ts`). The cost is that the act and its record are two appends; a
  record that fails to write is reported to the ops log (`acts.record`) and the act stands, never the other way round.
- **Each act and its inverse are one pair of executors that meet the same rules.** A task moves along the ladder
  (`mayMove`), a folder is attached only where no other project holds it, a claim is taken again only where its owner
  is still here and the lease is free, a console is started again only where its runner is still installed. An undo
  that the world no longer allows is refused with a code (`task_gone`, `ladder`, `already_there`, `held_by_other`,
  `owner_gone`, `runner_gone`, `folder_gone`, …), and one whose object moved since says so (`changedSince`: the
  object's state now) and still does what the button says — never a silent overwrite (SCN-169).
- **An undo is an act, so it can be undone** (redo): `undo` is `perform` of the recorded inverse with `undoes` set, and
  its own record carries its own inverse. Which acts are undone **now** is read from the newest record down
  (`analyseActs`): reversed twice, an act is in force again. A second press while the first runs, or on an act already
  undone, is refused `already_undone`; it never doubles the inverse.
- **Refused with a reason, in the record itself, before and after:** a move into done or cancelled (`task_closed`: a
  closed task does not reopen, `ladder.ts`), a closing, a release recorded (`published`), a disconnect of an agent
  (`credential_gone`), and the reopening of an answered question (`answer_needs_person`: Fabric takes an answer back,
  it does not re-give it, because an answer is the person's own words). The plan also names "a message to another
  project": the operator has no send in the main process today (`comms:*` are reads), so there is no act to record; the
  code `delivered` is reserved for the wave that adds one.
- **Reopening an answered question needed a new command** (`reopen_answered_question`, migration 90, suffix 112;
  `reopen_question` only returns a question that was set aside). The question is `open` again under a new revision, so
  a screen holding the old one cannot answer blind; what it blocks is blocked again; the second answer is a second
  resolution with its own decision (`question_resolutions` is no longer one row per question). The earlier answer stays
  in the journal and the decision it recorded stays in memory as history. The revision is counted from the journal, not
  incremented: a rebuild replays the event over rows that already hold its effect, and an increment gave 3 where the
  database said 2 — watched failing in `reopen-answer-db.test.mjs` before the count replaced it.
- **A discarded draft is kept where the person keeps their own state, not in the journal.** `discarded-drafts.json`
  (at most 20, oldest out) holds the words; the record carries the draft's name and the id it is kept by, so «Отменить»
  restores it under its own tab, or under the keeping id when that tab is taken meanwhile. The words never reach the
  journal.
- **Start again "from where it stood" means the place and the way it ran**: the same project and folder, the same runner
  and permission mode, and the same task for a managed one (through the same launch the person's own «open» uses). The
  agent's own conversation is the runner's to resume; Fabric does not reach into it.
- **Not recorded yet, and why.** Acts of an agent through its MCP tools (an agent moved a task, released its claim) are
  already in the journal as their own events with the agent as actor; they are not wrapped in `act.recorded@1` — wave 4
  reads them into История from their events, with no inverse offered. «Disconnect → let back in» has no inverse in this
  wave: a revoked credential is gone, and the "kept out until let back in" state arrives with wave 3 (the coding agent
  let in without consent, ADR-0160 §3), so the disconnect records `credential_gone` today.
- **FLW-97 stays on the unmeasured-flows debt.** Its measured coverage comes from a screen citing an implementing file;
  SCR-88 is wave 4's, and a main-process file is not a screen. Citing one would make the flow look measured while it is
  not.
- **IPC** (`FabricApi`): `acts.history(query)` (newest first, cursor `next`, filters `actorKind`, `projectId`, `category`,
  `text`; every row with `undo`: `available` (with `changedSince`), `undone` (with `by`), or `cannot` (with `why`)),
  `acts.undo(seq)`, `drafts.discard(tabId)`, `drafts.restore(discardId)`. The renderer words `said.key` and the
  reason codes in the person's language (wave 4).
- **Evidence.** `apps/desktop/test/acts.test.mjs` (pure, 12 cases; three planted defects watched failing: a naive undo
  analysis, no in-flight guard, a restore that overwrites an occupied tab), `acts-db.test.mjs` (a disposable stack: every
  database act done, undone and redone, both acts in the journal with the person as actor, and the read),
  `reopen-answer-db.test.mjs` (an owned cluster, in the fast tier: the command, its idempotency and refusals, a rebuild).

**Next task (as it stood after wave 2).** Wave 3, the shell: recorded in [§9](#9-wave-3-the-shell-done-2026-10-18).

## 9. Wave 3: the shell, done 2026-10-18

Renderer, plus the disconnect's main-process half. Decided by the agent under the standing go (§6), recorded for the
operator to correct asynchronously:

- **The rail** (`launch/LaunchShell.tsx`, SCN-162, SCR-84): «＋ Создать», Главная, Агенты, История, Настройки, then the
  projects list. Favourites are the home's pins (`favourites.list`, local to this computer), then latest activity from
  the journal the shell already reads (`shared/railProjects.ts`). A dot is a running console in the project; a count is
  the board's own per-project count (the same `board.query` the board runs, M151), so the rail and the board never
  disagree. The foot says «Вы» and how this computer is (`ok` / `reading` / `trouble` from the shell's own reads):
  Fabric holds no person's name, and inventing one would be a claim nobody made.
- **No tab strip, no Back.** The working set (`tabs`) is still kept and restored, it is just not drawn. ⌘[ and ⌘] walk
  the places the person was at (route plus whether Настройки was in front), skipping a project removed since; an editor
  or a console keeps the keys. The trackpad swipe needs a main-process event and is not wired yet (wave 4).
- **Places that left the rail** stay reachable where they belong until wave 4 gives each its home: Board, Pulse and the
  guide from Главная as today; Plan from the project; Messages between projects, account limits, Help (and the first
  run) and Fabric's name and look from a «Ещё» section in Настройки. Where work is and the scope bar's Profile and
  «Discuss with Fabric» are gone from the interface (the cut list); the conversation with Fabric shows on the rail only
  when it answers that it is switched on.
- **«Создать»** (`start/StartPaths.tsx` region `create-place`, SCN-171, SCR-90) replaces the four-card start menu: the
  projects folder first, then project and agent, one folder or several and an agent built elsewhere a line beneath.
  With no tab strip, the unfinished project drafts are listed there; «Создать проект» always opens a new one. The first
  run still ends on the four cards (`StartCards`); wave 4 redraws the first run in this frame.
- **The act line reads the journal, not the control.** `ActLine.tsx` shows the newest `act.recorded@1` the PERSON did
  since they came to the place, from the journal events the shell already polls every 2 s. One source for every act,
  whichever control did it; an undo is an act, so the line is replaced by «Отменено: …» with its own «Отменить». The
  cost is up to two seconds before the line appears. An agent's act never takes the person's line.
- **История** (`launch/HistoryScreen.tsx`, SCR-88) is wave 3's minimum: the acts by day, who, the sentence, the project,
  «Отменить» or why not, «Ещё раньше», a failed read said with «Повторить» and the last list kept. Filters, the detail
  pane, the agents' own acts and the button text for `changedSince` are wave 4's. The act sentences and every refusal
  code are worded in both languages (`launch/actWords.ts`); an unknown code reads «Fabric не может это отменить», never
  the code.
- **Confirmations removed** (ADR-0160 §1): Stop and Force stop (one press each; the stop's undo is "start again"), Release
  in a row's … menu (one menu press, then at once), removing a folder including the primary one, discarding a draft
  (wave 2's `drafts.discard`; «Отменить» restores it and reopens it), replacing your words with a shortcut (at once, with
  «Вернуть мой текст» beneath: the field is the person's local text, not an act on the world, so its undo is local), and
  the deep-link offer (a link waiting through the first run opens). `noConfirmations.test.ts` holds the renderer to no
  `window.confirm`/`alert`/`prompt` and no `alertdialog`, watched failing against the code before.
- **Boundaries and notices are questions on Главная** (ADR-0160 §4–§5): an agent's ask of a product's resources no longer
  calls the native prompt or a notification; it waits as the board's access item with Разрешить / Не разрешать, which
  Главная's board block and the rail's count show. The usage-count question (ADR-0127: nothing is sent until it is
  answered, here or in Настройки) and the database-exposure warning render on Главная only, as question cards. The
  first run's language step the plan names does not exist yet; the usage question moves there with wave 4's wizard.
- **«Отключить» built on ADR-0164's admission** (which landed first, so the let-in is its): `main/keptOut.ts`. Disconnect
  revokes every live credential of that coding agent (its consoles end through the revocation listeners) and keeps it
  out of every project; the door refuses a kept-out agent before any admission write and before anything is
  journalled (`accessService.ts` region `kept-out-door`). «Пустить снова» is the disconnect's inverse and the disconnect
  is let-in's, so wave 2's `credential_gone` refusal on a disconnect became a real undo. A single credential revoked in
  Настройки → Доступ агентов still records `credential_gone` (that is a key, not the agent).
- **The kept-out list is a file on this computer** (`kept-out-agents.json`, beside the hub's credentials), not a journal
  projection: it guards this machine's door, and a projection would need a migration for one set of keys. The acts
  that change it are in История. Unreadable, it keeps nobody out (fail-open) and Агенты says so: failing closed would
  lock every coding agent out of every project over one damaged local file.
- **Evidence.** Component tests: `Rail.test.tsx` (13), `ActLine.test.tsx` (14), `actLineShell.test.tsx` (the shell wires
  «Отменить» to `acts.undo` with the act's seq; watched failing with the line unwired), `HistoryScreen.test.tsx` (6),
  `CreateChoices.test.tsx` (5), `JoinedAgents.test.tsx` (7), `SessionStop.test.tsx`, `WhoIsWorking.test.tsx`,
  `Tasks.test.tsx`, `noConfirmations.test.ts`, `entityAddress.test.tsx` (⌘[ and ⌘]); pure: `railProjects.test.ts`,
  `test/kept-out.test.mjs` (6), `test/session-enroll-request.test.mjs` (the kept-out door). Each new test was run and
  seen failing before its code. FLW-93 and FLW-97 left the unmeasured-flows debt (SCR-84 and SCR-88 cite files).
- **Not done in this wave: the walk of the built app in ru and en.** The rule for this wave was not to drive the
  operator's running Fabric or its database, and the shell alone on a fresh stack shows today's home and project pages
  that wave 4 replaces; the walk is folded into wave 4's walk from zero on a disposable stack. The prototype was not
  changed by this wave.

**Next task.** Wave 4, the places: Главная, Проект, Агенты, История and Настройки rebuilt to the prototype
(`scripts/product/simple.mjs`), with История's filters and detail pane, the agents' own acts read from their events,
«Отменить»'s text when the object changed since, the trackpad swipe, the first run redrawn in the new frame (the usage
question in its first step, «Создать»'s choices at its end), and the onboarding plan's wizard, scan and create flows;
then the walk from zero on a disposable stack in ru and en, screenshots against the prototype.
