# Changelog

Release notes for Fabric. The next version's section is written as `## X.Y.Z (unreleased)` (or `## Unreleased`
before its number is known); the release pull request renames it `## X.Y.Z`, and the release workflow publishes
that section as the notes of the `vX.Y.Z` release
([docs/launch/release-mac.md](docs/launch/release-mac.md), [ADR-0111](docs/adr/0111-fabric-is-released-from-ci.md)).
Earlier versions: 0.2.0 (2026-09-29), receipt [`docs/releases/fabric-0.2.0-mac.json`](docs/releases/fabric-0.2.0-mac.json).


## Unreleased

- Agents write in Fabric's language (P-24, [ADR-0172](docs/adr/0172-the-interface-language-is-the-agents-working-language.md);
  the operator, 2026-10-22: «доска не на русском»). `fabric_whoami` names the interface's language and, right after the
  date, asks every agent to write what a person reads in it: task titles and briefs, stages, notes, board messages,
  reports and the documentation it writes for the person; code, commands and paths stay as they are, and a project's
  own rule for its documents wins. The first run asks the language first and says this; Settings says it under
  «Язык». Rows already on the board keep the language they were written in.
- A start that meets a database too busy to finish a query in time (PostgreSQL's statement timeout) waits and tries
  again, as it does when the database does not answer, instead of stopping on «could not work out why» (CO-389; seen on
  the 0.3.10 install with the disk nearly full).

- The home says what is needed from you, first (the operator's walk of 0.3.10, OF-14 to OF-17): «Нужны вы» heads the
  page and each row opens in place to read what the agent wrote, with «Открыть на доске»; «Где остановились» follows
  it. «Агенты в работе» names the task each agent holds rather than its latest action, lists active agents first, scrolls
  inside itself and carries the one «Открыть переписку».

- The Board screen opens on a kanban of every task by stage: «Очередь», «В работе», «На проверке», «Готово», the
  columns scrolling sideways and each one down, with a project filter; a card opens its task in its project, and
  «Нужны вы» is the second tab (OF-19). On the home «Кто что делает» is two columns, «В работе» and «Закончили», with
  «Открыть доску» (OF-18).

- A task opens on what it is for: «Что должно произойти», «Зачем», «Что будет готово», then the instruction the agent
  was given; «← К проекту» sits at the top left above its title (OF-21, OF-22).

- Агенты shows every agent at work, one opened in a terminal included, each by the task it holds; with no console
  held by Fabric the panel below says so once instead of «Выберите агента слева» over an empty list (OF-30). История adds
  «Что делали агенты», the journal's events in plain words, below the acts done through Fabric (OF-34). Account quotas
  leave Settings: Switchboard owns them (OF-35).
- Settings, under «Язык»: «Агенты пишут на языке интерфейса», on by default; off, Fabric names no working language to
  agents. Documents in a project's repository keep the language that project uses ([ADR-0174](docs/adr/0174-a-repositorys-documents-keep-their-language-and-the-working-language-can-be-switched-off.md)).

- Comms opens on «Лента»: the newest posts of every thread first, each with its project, kind, time and text, with
  «Только просьбы» and a project filter; a post opens its thread, and «Ветки» is the second tab (OF-29).

## 0.3.10

Fabric 0.3.10: the scroll patch. Since 0.3.7 no page of Fabric could be scrolled; now every page scrolls and the
window itself never does. Schema 95, unchanged: the upgrade is the bundle alone.

- Schema 95, unchanged: installing 0.3.10 over 0.3.9 replaces the bundle only.
- The operations log says what a database refusal was: a failure that is a plain object (PostgREST's
  `{ message, code }`) was written as «[object Object]», which hid every failed board upkeep pass and every board command answered «not available» (in the
  operator's log file as of 2026-10-22 19:04 UTC: 40 upkeep passes, 27 of them after the 0.3.9 rollout, in bursts; and
  23 commands, 14 after it); it now carries the message and a code of a fixed shape (a SQLSTATE such as `57014`), through the redaction rules.
  A plain object with no message is written as the names of its fields, never their values
  (`shared/opsLog.ts#errorParts`).
- What 0.3.9's notes promised for 0.3.10 moves to 0.3.11, because 0.3.10 is the scroll patch: the simple plan's wave 4
  (the five places rebuilt to the prototype, История's filters, the first run), the agents' own acts in История, and
  enrollment on the contract's resolver (CO-339).
- Correction to the 0.3.9 notes: a request stored before 0.3.9 without a deadline is not given one. It keeps
  `deadline` null and the board's tick expires it once its message is 7 days old (`board_tick`, migration 120;
  `project-board-core-holds-db.test.mjs`, BD-1). On the operator's database one such request, sent 2026-10-21, expires
  at the first tick after 2026-10-28 23:19 UTC unless its target answers (CO-381).
- Every page of Fabric scrolls again (the operator, 2026-10-22: «главный экран не скроллится»). Since 0.3.7 the
  shell grew past the window inside a box that clips, so a page longer than the window could not be reached at all.
  The shell now has the window's height and each page, Settings included, scrolls inside it: the rail, the top bar, a notice above the page, a side panel
  (search, Fabric chat, private history, agent access) and the «Отменить» line stay where they are, and the scan's «Add N as projects»
  stays above that line. A page keeps the window's width (no sideways scroll), a console still fills its page, and
  moving to another place, another project or the workspace opened from a project starts it at the top. Beside an open side panel the agents grid takes one
  column up to 1440 px instead of running under the panel. After moving by the rail, the keyboard (PageDown, Space) scrolls
  the page once focus is in it (CO-384); going back with ⌘[ opens the previous page at its top (CO-388).
  `scripts/test/shell-scroll.browser.mjs` holds the scrolling in
  Chrome with the renderer's own stylesheets.
- CI tells a publication still waiting for the scheduled sync apart from a broken one: the `workspace publication`
  workflow runs `node scripts/workspace.mjs check --allow-pending 6` on a push, which passes with a "pending
  publication" notice while the receipt, its digest and the parent pin verify and HEAD is under 6 h old, and still
  fails on a broken, foreign or overdue receipt. Every source push to `main` was red before
  ([report-workspace](docs/architecture/report-workspace.md#a-pending-publication-on-a-push)). The nightly schedule no
  longer cancels a push run on the same ref: `ci.yml` and `platforms.yml` name the event in their concurrency group,
  and `scripts/check-workflows.py` refuses a scheduled workflow whose group cancels in progress without naming
  the event.

## 0.3.9

Fabric 0.3.9: the core holds. The operator's priority of 2026-10-21: the hub is always there, Fabric knows which agent
works on what, and the project board works. Measured before it: Fabric was available about 86.9 % of the last 7 days
(22 outages, 22.0 h), 25 of 41 running Claude Code sessions had lost their session hooks after `/clear`, and all 6
board requests ever sent were still queued. Schema 95.

**Upgrading.** Quit Fabric before the migration (release-mac's rule: writers stopped, old code never on a newer
schema). 0.3.9 needs schema 95 (migration `20261021000120_board_core_holds.sql`); every install is at 94, and
0.3.9 refuses a schema-94 database on its first start until the upgrade in
[release-mac](docs/launch/release-mac.md#upgrading-an-existing-database) is run (back up first; 0.3.8 cannot open a
schema-95 database, so keep the backup until 0.3.9 runs). At the first minute after it, the board answers the requests
their target already replied to (on the operator's database all 9 queued on 2026-10-22) and gives the others without
one a deadline 7 days after they were sent (the migration's own header says "the six"). Coding agents pick up the new fabric-mcp when each restarts; the new fabric-mcp still works with a hub
that is not 0.3.9 yet.

- **Fabric no longer quits when Docker or the database is not ready at start.** It waits, says what it waits for, and
  tries again (10 s growing to 2 min). Agents get a 503 `stack-starting` with Retry-After and its reason instead of
  no hub at all, through fabric-mcp too. On Windows and Linux the end of a start that waited, and the startup dialog's
  Retry, no longer quit Fabric.
- **Fabric watches its database while it runs.** Every 30 s (a read waits up to 6 s; two refused or three slow reads
  in a row mean it is lost); a lost stack is said on every screen, agents are told `stack-unavailable`, and Fabric
  brings the stack back with one `supabase start` per try («Пробуем сейчас» while it runs). An external stack is
  waited for, never restarted; a stack stopped with `supabase stop` is not started again while Fabric runs; no try
  while its containers still run. A disk under 3 GB is named, first, as the likely cause. A held re-check is never
  shown as a try, and the watch keeps one chain of reads. When Docker is not running, the wait window and the notice
  say how to start it on each system (OrbStack or Docker Desktop on macOS, Docker Desktop on Windows,
  `sudo systemctl start docker` on Linux); the wait window comes forward once, not at every try. A quit is never undone:
  no `supabase start` runs after a quit began.
- **The operations log is sized for a week** in rotated segments within 96 MB (a cut inside the week is recorded);
  fast successful IPC calls and agents' keep-alive pings are counted, not written each time; failures and slow calls
  are always written. When the log cannot rotate it stops at its budget and says so once (`ops.rotate-failed`). `startup-failure.log` appends every failed start, keeping the newest 256 KiB.
- **A session keeps its identity after `/clear`.** An old "session ended" no longer ends a live, resumed session or
  releases its claims. After Fabric restarts, an agent rejoins by itself at once, as a new Fabric session (its claims
  were released at quit and their tasks are back in backlog). A connected coding agent signs every 2 minutes, so it
  is not shown silent while it works and its claims do not lapse. When an agent leaves, Fabric records its session's
  end: fabric-mcp leaves on SIGTERM, SIGHUP, SIGINT and stdin's end, even through a hub cooldown, and a hook's end for
  an agent whose process is gone ends the session (claims released, tasks back to backlog). The new fabric-mcp also works with an older Fabric still running. A coding agent picks this up when it restarts.
- **`fabric_agents_list` lists every session in the project**, the caller's included, with how each came in.
- **Tasks move on the board.** A claim moves its task to running; finishing it moves it to review; letting it go
  takes the task back to backlog.
  `fabric_agents_list` lists every agent in the project, and expired agent-sync leases are no longer shown as current.
- **Board requests get answered.** A reply from the asked project answers a request; a request whose target
  has no live responder says so in its receipt, and one sent without a deadline expires after 7 days; the home shows the requests between projects no agent is answering now,
  and how long the oldest has waited.
- **Agents read what is new.** `com.list` takes `unread` and `since` and says which messages are read; cursors survive
  a restart; `com.read_ack` marks up to 100 messages in one call.
- **What 0.3.8 said would come in 0.3.9 comes in 0.3.10**: the simple plan's wave 4, the agents' own acts in История,
  Fabric's enrollment on the shared attribution rules (CO-339).

## 0.3.8

The patch of the operator's audit of the installed 0.3.7 (2026-10-21): other products can now get the access that
`fabric.project.resolve` needs, the log says what happened, the startup failure names a full disk, and a coding agent
in a folder that is too broad stops asking every half minute. No schema change: 0.3.8 admits schema 94, as 0.3.7 did.

- **A full disk is named when the local stack will not start.** When the volume that holds Fabric's data has under
  3 GB free (decimal), the startup failure says first how much is free and that Docker stops when the disk runs out (in
  each system's own words), and the copied details and `startup-failure.log` carry the same number. On macOS the figure
  leaves out space the system could purge, so Finder may show more. The stack's own words only ever named a missing Docker socket.
- **Other products can ask Fabric which project a folder belongs to.** 0.3.7 shipped `fabric.project.resolve`, but a
  product had no way to get the access it needs: `fabric.access.request` refused every ask of Fabric itself but
  `session.enroll` and `board.respond` (Observatory's live check, 2026-10-21). Fabric now admits `project.resolve` on the
  resource `projects`, read-only, at once on the operator's own machine, for a registered service or a coding agent it
  knows (never for one the person disconnected). Settings → Agent access says it in words, and revoking it ends it:
  `fabric.project.resolve` now answers only while that grant, or a coding agent's enrollment, is live.
- **A coding agent in a folder that is too broad stops asking every half minute.** While Fabric refuses the folder as
  too broad (the home folder, a folder right under it, one that holds other projects), `fabric-mcp` waits twice as long
  each time, up to 10 minutes; a repeated failure waits up to a minute, and a 503 that names Retry-After is waited out.
  Every refusal the person can lift in Fabric keeps its wait (a detached folder 30 s, a denial 60 s), and the agent's
  own `fabric_whoami` still asks at once. A Hermes in the home folder had asked every 30 s for three days. A coding
  agent already running keeps its old `fabric-mcp` until it is restarted.
- **The log says why a tool turned a call down.** A tool's typed refusal (`needs-grant`, `no-session` and the like) is
  recorded at warn with its code, not as an error with no reason (CO-335); a product's or Fabric's own failure stays
  an error, and a call that may have run is `unknown`; an accepted MCP notification is no longer a
  warning (336 in 49 minutes of the 0.3.7 log).
- **Docker on Windows is waited for in its bare pipe form** too (`//./pipe/docker_engine`).
- **What 0.3.7 said would come in 0.3.8 comes in 0.3.9**: the agents' own acts in История and Fabric's own enrollment on
  the shared attribution rules (CO-339). 0.3.8 is this patch; История now says «in a later version».

## 0.3.7

- **Fabric starts when you log in** (macOS and Windows). It starts without a window, so agents and the board keep
  running; turn it off in Settings → «Компьютер». Settings shows the row only where Fabric registers a login item (not
  on Linux or in a development build) and says when the system itself does not start Fabric (turned off in Login Items
  or Startup apps, or waiting for your approval).
- **An agent's history reads as what it did.** In Агенты the picked agent's history is newest first and in words (a
  task it moved, a decision it recorded, its stage), with who did it, and it now includes what the agent wrote itself.
- **Other products can ask Fabric which project a folder belongs to.** Fabric's hub answers `fabric.project.resolve`
  with the shared rules all three products agreed on (DEC-0089), so Observatory and Switchboard attribute a folder by
  the same rules. When Git cannot be read in time the answer is `pending` with `git-unreadable` (DEC-0092), never a guess; a
  relative path is refused and one call is bounded at 8 s.
  Fabric's own enrollment of agents moves onto the same rules in 0.3.8 (CO-339).
- **A task is no longer stuck after its agent ended.** When an agent's process has ended but Fabric cannot prove its
  provider stopped, the console offers «Работа закончена»: the task goes back to the queue and can be taken again, and
  «Отменить» on the act line holds it again and puts the console back, so it offers «Работа закончена» again.
  After the press the console says «Вы отметили: работа закончена», not that Fabric confirmed the stop (ADR-0170).
- **A console is your own setup.** Claude Code in a Fabric console now has your MCP servers (Observatory, your plugins)
  beside Fabric's, and Codex runs with your own `AGENTS.md`, plugins, trust and sign-in instead of an empty copy,
  without copying your sign-in. A console also finds the same programs your terminal does. An agent you create in a
  project, and a console in a project that declares MCP servers of its own, still see only the servers they declare and
  run Codex in their own home with a copy of the sign-in (ADR-0169).
- **Every coding agent starts as a console, with fewer prompts by default.** A project's console can now start any
  coding agent of the catalogue this computer has (Gemini CLI, OpenCode, Goose, Cursor, Pi, OpenClaw and the rest),
  not only the five Fabric connects to its surface. Settings has «Разрешения агентов»: «Меньше подтверждений», chosen by default,
  or «Проверять вручную», one choice for every agent, and each agent's row shows how it starts. OpenCode's own
  `fabric-mcp` registration is accepted (ADR-0168).
- **Fewer generated-looking touches.** Thick coloured side stripes on notices and selected rows became a thin
  outline, and buttons and links no longer end in an arrow («Продолжить», not «Продолжить →»).
- **A quieter top bar and a denser rail.** The top bar holds the place's name and the open consoles, nothing else:
  search is ⌘K, the profile block and the conversation button are gone, and a line about this computer appears at the
  foot of the rail only when something needs a look. Projects take less room on the rail (OF-04, OF-05).
- **Consoles open inside Fabric, as tabs along the top.** «Консоль» no longer opens a separate window: the console
  fills the main area, and each open console is a tab in the top bar with its project's name and its coding agent, so
  you see which are open and switch with one press. Closing a tab never stops the session. «Открыть в отдельном окне»
  on the console still gives it a window of its own.
- **A console whose agent has ended says so.** It said «Остановка не подтверждена» and offered to force a stop of a
  process that was already gone; now it says «Сессия завершилась» with the exit code.
- **«Where you stopped» stays where you stopped.** It used to jump to whichever project an agent last touched; now it
  is the project of your own last act, and it still counts what happened there since.
- **Claude Code no longer asks «Do you trust this folder?» in Fabric's consoles.** When Fabric starts Claude Code in a
  project's folder, it marks the folder trusted first, as Orca does. Folders already trusted stay trusted.
- **A console no longer closes itself when it opens.** Opening a coding agent's console again sent the terminal's own
  answers into the agent, and Claude Code read them as «Esc» on its «Do you trust this folder?» question and quit.
- **Many coding agents at once no longer push each other out.** With dozens of Claude Code sessions open in
  different projects, they took turns disconnecting one another and then waited on Fabric's rate limit. The limit of
  eight sessions now counts one project, and each session gets its own share of calls; one coding agent still holds
  at most 64 sessions across all projects, and past that the oldest is ended.
- **One rail, five places** (SCN-162). The left of the window holds «＋ Создать», Главная, Агенты, История and
  Настройки, then your projects: favourites first, then by latest activity, a green dot where an agent works and a
  count where something waits for you. The tab strip, the Back button, the per-project links and the bar above each
  screen are gone; ⌘[ goes back and ⌘] forward; ⌘K opens search. Board, Plan, Messages between projects, account
  limits, Help and Fabric's name and look are reached from where they belong (Главная, the project page, Настройки).
- **«Создать»** opens in the window with three choices: open a projects folder, create a project, create an agent.
  Drafts you left unfinished are listed there to go on with.
- **История** lists every act you take, newest first by day, with «Отменить» where it can be taken back
  and the reason where it cannot. After an act, one quiet line at the foot of the place says what was done, with
  «Отменить».
- **No more «are you sure?»** (ADR-0160). Stop, force stop, releasing a task, removing a folder, discarding a draft and
  replacing your words with a shortcut happen at once and can be undone. A link opened while the first run was on
  screen opens what it links to. An agent's request to use a product, the usage-count question and the warning that
  the local database is reachable from your network are questions on Главная, never a pop-up or a banner.
- **«Отключить» for a coding agent that joined on its own** (SCN-167). Агенты shows each coding agent that joined
  from a terminal, with the fact that Fabric cannot prove which program it is. «Отключить» revokes its access, ends
  its consoles and keeps it out of every project until you press «Пустить снова»; either can be undone.
- **Docker no longer brings back services Fabric does not use.** Containers an older full start had left (the
  database studio, its logs, mail and file storage) started again with every Docker or OrbStack restart and took about
  1.4 GB of memory. Fabric now removes them when it starts its local database; the data stays.
- **An agent started deep inside a repository adds the repository, not the folder it started in**, and removing one
  copy of a repository from a project no longer keeps every other copy of it out. This is the first step of one
  shared answer to "which project is this folder" across Fabric, Switchboard and Project Observatory (ADR-0166).
- **Any folder an agent starts in becomes a project by itself**, not only a Git repository: a plain folder is added
  the same way, with the agent named in the operations log; the add is listed in История with the agents' own acts in 0.3.8. Only a container is skipped (the
  disk root, the home folder, a folder right under it such as Documents, or a folder that already holds projects).
- **Every act can be taken back** (ADR-0160, SCN-168, SCN-169). Moving a task, releasing
  a claim, removing or adding a folder, renaming a project, answering a question, stopping a console and discarding a
  draft are each recorded with who did it and how to undo it: a task moves back, a claim is taken again, a folder
  is attached again, the old name returns, a question is opened again, a console starts again where it stood, a
  draft is restored. An undo is itself recorded and can be undone. What cannot be taken back says why: a task
  closed, a release published, an agent's key revoked.
- **An answered question can be reopened.** The question is open again, what it blocks is blocked again, and a new
  answer is a new decision; agents no longer read the withdrawn answer as a current decision.
- **A task held by an unfinished run says so** (CO-323): `fabric_work_claim` and `fabric_task_claim` no longer refuse a
  task whose launched session exited with «another agent claimed it in the same moment»; they name the run that holds it,
  its session, since and until when, and that its stop is not proved; `fabric_work_list` lists that task as held,
  not open. An expired claim of a session that is gone is taken over by the next claim, as before.
- **A coding agent opened in an unknown folder gets its project automatically** through Fabric's enrollment: exact,
  ancestor, worktree and remote identity attach to the existing project, an otherwise unknown repository or plain
  folder is created once, and `session.enroll` is allowed at once on the operator's own machine. Containers (the disk
  root, the home folder, a folder right under it, a folder that holds projects) and ambiguity are refused; detached or
  archived projects are not brought back. Every create, attach and access decision is recorded and revocable
  ([ADR-0136](docs/adr/0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md), [ADR-0160](docs/adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md)).
- **Usage counts go to PassionCode's own analytics host** (`analytics.passioncode.ai`, [docs/ANALYTICS.md](docs/ANALYTICS.md)),
  no longer to the operator's personal instance; what is counted, and the switch that stops it, are unchanged.
- **Fabric waits for Docker at start.** Started at login before OrbStack or Docker Desktop is ready, Fabric waits up
  to 90 s for Docker to answer, saying so on the splash, instead of showing the startup failure at once.
- **A slow or prompting shell setup no longer holds Fabric's start.** The login shell's PATH is read with a 3 s
  deadline that holds; when the shell does not answer, the launch PATH keeps its old order.
- **The count of Comms threads with new messages is shown again**, on Настройки in the rail and on «Переписка между
  проектами», now that Comms is reached from Настройки → Ещё.
- **Act sentences name the chosen answer and the agent in your language**, never an option's id or a raw runner id.
- **«Где идёт работа» is gone as a screen.** Who is doing what is on Главная and on each project's page (SCN-141
  retired).
- **For agents: revision references hash the canonical JSON of their object** (CT-26, DEC-0043). A hub call's
  envelope names the binding and the hub as revisioned objects, and `contentHash` is `sha256:` over the RFC 8785
  canonical JSON of that object, so any verifier can reproduce it.

### Database

- **The database moves to schema 94** (from 89): five migrations, applied in order:
  `20261017000112_acts_and_reopened_answers.sql` (count 90: `act.recorded@1`, the record of an act with its inverse,
  and `reopen_answered_question`; three partial journal indexes, no stored row rewritten),
  `20261018000113_project_repo_identity.sql` (count 91: normalized remote and repository-kind identity, detach
  tombstones; it rewrites every stored `project_repos` row once, and creates the estate-path unique index only where no
  duplicate paths exist, with a warning otherwise), `20261018000114_private_archive_source.sql` (count 92: schemas 91
  and 92 as private-archive sources), `20261019000115_run_over_attestation.sql` (count 93: «Работа закончена», ADR-0170,
  and 93 as an archive source) and `20261020000116_withdrawn_answer_closes_decision.sql` (count 94: a withdrawn
  answer closes its decision, and answers taken back at schemas 90 to 93 are corrected during the upgrade; three
  journal indexes for an agent's history; 94 as an archive source). The arithmetic is in
  [release-mac.md](docs/launch/release-mac.md#upgrading-an-existing-database).

**Upgrading.** A database at schema 89 (0.3.6) is upgraded to 94 before 0.3.7 opens it: install 0.3.7 and start it
once (it refuses, and copies its migrations into Fabric's stack folder), quit it, make a verified backup, rehearse on a
copy, then run `supabase migration up --local` in that folder and start 0.3.7 again
([release runbook](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).
Until then 0.3.7 refuses to start its workspace services and says which schema it found. An older database takes the
same procedure; `supabase migration up` applies every missing migration in order. 0.3.6 cannot open a database at 94:
keep the backup if you may need to go back.


## 0.3.6

The home says who is doing what across every project, in plain words; a project's page says where it came from,
where it is and where it goes; Settings becomes a screen with the coding agents on this computer; and projects answer
each other's requests on the project board, which Comms now lets you read at any size.

- **The home says who is doing what** (SCR-30, SCN-158). Four counts at the top — agents working now, tasks in work,
  what needs you, what waits for review — each opening where it is counted. Beside "Needs you" («Нужно вам»), **"Who
  is doing what"** («Кто что делает») lists the tasks in work and in review across projects, each as a plain summary
  (the task brief's «what», else its title, never its instruction) with its project, agent, how long and the agent's
  current stage. **"Agents at work"** («Агенты в работе») shows every working session with what the agent says it is
  doing, in its own words; a session gone silent is marked "silent" («молчит»); a click opens the agent's console when
  Fabric holds one, else its project. The reading refreshes every 15 seconds and when the journal moves; a failed
  reading says so, keeps the last one on screen and shows the counts as «—». A claim whose agent stopped signing for
  it stays in work marked "nobody signing" («никто не отмечается»); a capped count is a floor («50+»), and a lane past six rows offers
  "{count} more" («Ещё N») on the Board. The rail's «Настроить агентов» is now «Агенты».
- **Projects on the home: favourites in your order, then by latest activity** (SCN-043, amended), each card with
  "Now: …" («Сейчас: …», what its agent is doing) or "Quiet for …" («Тихо уже …»). Projects that are not favourites lost their manual ↑ ↓ order:
  an order saved for them before is no longer used; favourites keep theirs.
- **A project's page says where it came from, where it is and where it goes** (SCR-31, SCN-159): the heading says what
  its agent is doing now; "Where we came from and where we go" («Откуда пришли и куда идём») shows recently done → in
  work and in review (with each agent's stage) → the goal and the queue in board order; then "Questions for you" («Вопросы ко мне»), the
  board at a glance (four columns with their counts and first cards; "Done 20+" («Готово 20+») when only the newest twenty were
  read) and "Agents on this project" («Агенты на проекте»), each opening its console. A project with no tasks shows its first step instead of an
  empty way.
- **Settings is a screen** (SCR-52, SCN-160), no longer a band over another page; the page you came from stays as it
  was underneath. It groups **the coding agents on this computer** (each with its version and path, not answering, or
  not installed with the vendor's install command), the launch fallback order, sleep ("Keep the computer awake", «Не давать компьютеру засыпать»,
  with what the OS will not do), theme and language, and Data and access: usage counts, private history and restore,
  and Agent access. When Switchboard 0.6.31 or later publishes its catalogue (`switchboard --json agents status`), its
  default and switched-off agents are marked and agents only Switchboard knows are added; Fabric reads that catalogue
  and never writes it, and an older or absent Switchboard is said.
- **Fixed: Claude Code sessions could not ask another project anything** (CO-292). In 0.3.5 the board tools published
  no argument types, so Claude Code sent nested arguments as strings and `com.submit`, and `com.list` with a `limit`,
  were refused `invalid_arguments`. Each board tool now publishes the shape its handler accepts; the board still
  validates every call itself.
- **Fabric waits for a stack that is still starting** instead of refusing to open: right after Docker (OrbStack)
  comes back, «container is not ready: starting» and «supabase start is already running» are waited out and retried
  (up to four tries, ten seconds apart, said on the splash in English, like the whole splash — CO-306); any other
  refusal, Docker unreachable among them, is shown at once, as before. Each try keeps its own four-minute start
  deadline, so a stack that never becomes ready can hold the splash for about 16 minutes before the refusal (CO-311).
- **The folder question on the home screen names what a folder will not bring back in your words** — goals, tasks,
  questions and routines — instead of an English sentence with table ids in it (seen in Russian on the 0.3.5 first run).

### How sessions start

- **A coding agent that connects to Fabric is not started while Fabric's agent surface is down.** In 0.3.5 only Kilo
  Code, Hermes Agent, Codex and Kimi Code were refused; Claude Code started unconnected — without its board tools,
  permissions and briefing, while appearing connected in the journal. Now every connected agent, Claude Code included,
  is refused before it starts, with "<Agent> was not started: Fabric's agent surface is not running, and this agent's
  permissions and connection are given with it. Start the session again once the surface is up (Settings → Agent
  access)." A launch through the fallback order moves on to the next agent.
- **Fixed: Kimi Code's Plan, Ask and Bypass modes are applied.** 0.3.5 passed `--plan` / `--auto`, which Kimi Code
  accepts and ignores (its session still started in `default`), so a Plan session ran with Kimi's ordinary approvals.
  The mode is now set on the session itself (ACP `session/set_mode`: `plan`, `default`, `yolo`).
- **A task's own words are always delivered whole**; memory that does not fit the session's context budget is left out,
  and the session is told what was left out. The budget now counts everything the pack writes (its head, separators
  and the omission note) when it selects memory; a task, brief and project identity larger than the budget are
  delivered whole and nothing is selected from memory. (Between 0.3.5 and this release a revision 4 that never
  shipped refused such a task; 0.3.5 itself, at revision 3, never refused one.) The context compiler is at revision 5, so a
  pack recorded by 0.3.5 names revision 3 and one compiled now names 5.
- **Agents are asked for plain-language stages.** Fabric's tool descriptions and its rules ask an agent to report its
  stage, write a task's brief and title a task as one plain sentence the project's owner understands, in their
  language — that is what the home and the project page show. The rules' hash changes with them, so each session's
  `session.oriented@1` names the rules it got.
- The resource admission and worker pools of the harness wave
  ([ADR-0152](docs/adr/0152-resource-preflight-and-durable-reservation-are-distinct.md),
  [ADR-0154](docs/adr/0154-logical-worker-pools-retain-unresolved-start-intents.md)) ship inactive: no launch in this
  release waits on them.

### Comms and the project board

- **Comms reads a long board a page at a time** (wave 4, [ADR-0156](docs/adr/0156-the-estates-owner-may-pause-the-project-board-and-list-or-unlist-projects.md) §8):
  threads newest activity first, 50 a page, with "Show older threads"; the filters — project, kind, coding agent, open
  request, activity — are answered by Comms itself, so they work on a board too large to hold, and a filter Comms did
  not answer keeps the last confirmed list and says so instead of saying nothing matches. The rail's count reads each
  thread's last message only and says "5000+" past its cap.
- **Comms says who answers each request and how it ended** (SCN-147): "Responder #n · <agent> · since <time>", a lapsed
  lease ("That says nothing about whether it worked."), or that no agent answers it now and why the last one left;
  the responder's reported outcome and its evidence, or the requester's reason for cancelling; an outcome nobody
  observed reads "may have happened — awaiting reconciliation" with who can settle it. Each message says which projects
  marked it read, and each file a message names shows its hash as the sender stated it — only `https:` links open.
  A request's timeline and the threads related to one (the same projects, or the same file) open on demand.
- **Search what projects told each other** (SCN-156), newest first; `%` and `_` are searched as themselves, and a search
  that runs out of time says so. **What waits for a project** (SCN-157): per project, the messages none of its agents
  has read, the oldest, and the requests nobody answers.
- **Projects answer each other's requests** (COM-03, [ADR-0149](docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md)
  Amendment 1): the project board serves all seventeen tools of `fabric-project-comms/0.1` at contract DEC-0073 —
  `com.reply` and `com.cancel`, `com.directory`, and the responder tools `com.enroll`, `com.claim`, `com.renew`,
  `com.accept`, `com.progress`, `com.effect_begin`, `com.complete`, `com.reconcile` and `com.responder_replace`. An agent
  answers a project's requests only once the operator allowed it ("Let <agent> answer <capabilities> requests for
  <project>?", Settings → Agent access); every responder call is fenced, so an agent that was replaced cannot record a
  late result. A session's end releases what it held. A service agent joins a project's board with `fabric.board.join`.
- **The responder consent says what the grant does not change**: "This grant itself lets it spend, publish or delete
  nothing; it still has its own tools, and a request is never an approval." In Russian the prompt now says requests
  are sent «проекту «…»», not «в проекте «…»».
- **Requests can be cancelled and expire; replies are threaded** (COM-02.3): the requester's Project may cancel a
  request (work that had begun becomes "outcome unknown" — it may have happened — until reconciled), a passed deadline
  expires a queued request (an accepted one is held), and a reply lands in the thread of what it answers. `com.reply`
  and `com.cancel` take the arguments contract DEC-0073 fixed, served since Fabric pinned it (COM-03).
- **Comms calls its source Comms** («Переписка»): "Comms did not answer." / «Переписка не ответила.», never "the
  board", which on the rail is the task board. **After a restore whose message texts did not come back** — the
  archive lacked them, or the board refused their restore while the estate itself was restored — Comms says
  "The texts did not come back" with how many messages the journal records, instead of saying none were exchanged.
- **A restore keeps the board's messages** (CO-212, SCN-146): an archive now carries `board.json` — threads,
  messages, texts and request outcomes — checked against the restored journal; an archive from before this release
  restores and says the messages' texts are missing.
- **A restored estate's board acts on nothing**: a request that was claimed is queued again, one in progress becomes
  "outcome unknown" (it may have happened; only an observed result settles it), and every project starts in a fresh
  idempotency window, so a retry from before the archive is refused instead of stored twice. Nothing is added to the
  restored history to do this.
- **The thread list narrows by filter** (SCN-143, the COM-07 filter slice): by participant project, by a kind the
  thread holds, or to threads with an open request — combined as AND, and a matchless narrowing says so in words
  with one press to clear. Since wave 4 (above) each filter change is one read the board answers.
- **Comms says what is new since you last looked** (SCN-143, the COM-07 unread slice): a thread with a message
  newer than your read mark carries a "New" marker, and the rail's Comms item counts such threads — the board is
  watchable without opening it. Opening a thread marks it read; "Mark all read" clears the list in one act. The
  marks are machine-local settings (`commsReadThrough`), never a fact about the estate; a board that does not
  answer keeps the badge's last confirmed count rather than zeroing.
- **The thread list narrows by last activity** (SCN-143, the COM-07 time-filter slice): last 24 hours, last 7
  days or all time, measured back from now and inclusive at the edge; since wave 4 the board answers it
  (`activeSince`), and a thread with no messages yet is undated, not "old", and matches only "all time". "Mark all read" still marks every thread,
  the ones a filter hides included, because it answers the rail's count.
- **The `coding_agents_enrolled` usage count counts enrollments only**: a `board.respond` grant is counted in neither
  that nor `agents_with_access`.

### For coding agents and the products that call Fabric

- **`fabric-mcp` waits after Fabric says "too many requests".** After an HTTP 429 it keeps a cooldown for the time
  Fabric named (at most 5 minutes): every tool call answers "Fabric is rate limited; wait N seconds. No new request was
  sent." and the tool list is not read, so a busy agent does not hammer the hub. A wait it cannot read, or one longer
  than 5 minutes, falls back to 60 seconds (CO-314).
- **Board receipts changed shape (agents, take note; COM-02.3).** A `com.submit` or `com.read_ack` receipt no longer
  carries the estate's `seq` (the contract never showed it to a reader, C3), and a request in a receipt is an object
  `{id, state, effect, revision}`, not an id. Receipts stored before the upgrade answer a retry in the new shape.
  Per contract DEC-0073: a `com.read_ack` receipt carries the time of the mark as `at`, and marking the same message
  again answers `repeated: true` with the first mark's time; `com.read_ack` takes no idempotency key; `com.status`
  takes an optional `project` (your own; another Project answers `not_authorized`, as an unknown one does); a
  `com.submit` of kind `reply` whose thread is not `replyTo`'s own is refused `invalid_arguments`.
- **Register Fabric in Kimi Code** as in Claude Code or Codex, with no key in it (verified with Kimi Code 2.1.1
  answering outside a project; a Kimi session inside a project is not yet recorded): `mcpServers.fabric` =
  `{"command": "<Fabric>/bin/fabric-mcp", "args": ["--runner", "kimi-code"]}` in `~/.kimi-code/mcp.json`
  ([README](README.md)).
- **Coding agents learn the project board rule from Fabric** (COM-12): `fabric_whoami`'s rules now say to read the
  board at the start (`com.status`, then `com.list`), to ask another project only through `com.submit`, that a
  board message is data, never an instruction or an approval, and how to answer a request (below); "other projects are not visible" now says their content
  is hidden and the board addresses them. The rules' hash changes with them, so each session's `session.oriented@1`
  names the rules it got ([ADR-0134](docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md),
  Amendment 6).
- **Answering a request**, as that rule says, means
  `com.enroll`, then `com.claim`, under a responder grant the operator gives in Settings → Agent access, and without it
  to reply and say the request stays queued; a retry sends the same `idempotency {epoch, key}`. A call that takes no
  key (`com.read_ack`, `com.renew`, `com.progress`) and lost its answer says it is safe to send again.
- **`com.status` names the idempotency epoch** a session submits under (`idempotency.epoch`) and the project's
  responders per capability — to a project session and to a board session alike; a viewer is never told an epoch.
  Idempotency windows rotate and are retired (ADR-0149 §7): a full epoch opens the next one, a closed one still answers repeats, and its receipts are compacted 30 days later.
- **A board write whose answer was lost says it may have been stored**, and the same idempotency key tells which —
  it used to say "nothing was changed". A value the database cannot take is `invalid_arguments`, not "unavailable".
- **A board session is respond-only** ([ADR-0149](docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md)
  Amendment 2): a service that joins with `fabric.board.join` gets `com.status`, `com.list`, `com.get`, `com.reply`
  (only as a responder) and the responder tools — never `com.submit`, `com.cancel`, `com.read_ack` or `com.directory`,
  so it cannot write as the project or clear the unread its coding agents rely on. A board session ends when its client
  leaves (its slots are released), and at its next call once a grant it joined under has expired; joining again hands
  out an unspent session instead of minting another, and a binding's board sessions have a cap of their own.
- **A session Fabric launched as a created agent answers requests as its coding agent** — the runner its binding
  names — not as the created agent, whose id no grant could match.
- **A takeover hands over its attempts in its answer** (contract DEC-0078, pinned at fabric-agent-contract `f00a768`):
  `com.responder_replace`'s receipt carries `transferred` — each transferred request once, with its revision and the
  attempt the new holder continues under — and `com.claim` never reads back an accepted request. Unread counts only
  messages an agent can read; `com.renew` and `com.progress` are refused under a closed idempotency epoch; a fenced call
  on a request whose outcome became unknown answers `reconcile_required`; the board takes its locks in one order, so a
  takeover no longer deadlocks against a cancel or a release.
- **The journal says who settled a request** (contract DEC-0081, FAC-SEM-109): every complete and reconcile transition
  carries `settled_by`, `responder` today; the repin to fabric-agent-contract `a59d04b` brings DEC-0079 (the host hold),
  DEC-0080 (the structured finding) and DEC-0081 (owner settlement) into Fabric's contract tests, each held to the
  contract's shared vectors as its node is built.
- **A session Fabric launches carries `FABRIC_LAUNCHED_SESSION=1`** in its environment, for every adapter that connects
  it to Fabric, so the fabric-agent-adapter's session hooks stay silent where Fabric already briefed the session. Not a
  secret; never inherited by a session Fabric did not brief.
- **The session hooks' turns are recorded in a folder git cannot describe**: `fabric_session_observe` takes `null`
  for a change count git could not give (a folder that is no repository, a repository with no commit) instead of
  refusing the turn.
- **`fabric-mcp` no longer tells an agent to open Fabric**: while Fabric is down it points at the local lifecycle
  broker (`lifecycle.ensure_running`), and a folder that is no project is the person's to add, never the agent's.
  Codex and Kimi Code give their MCP servers no session id (measured), so their terminal sessions enroll without one;
  only Claude Code's own `CLAUDE_CODE_SESSION_ID` names a session, for `--runner claude-code` only.

### Database

- **The database moves to schema 89** (from 84): five migrations, applied in order — the project board's thread
  aggregates (`20261011000100_project_board_thread_aggregates.sql`: the kinds a thread holds and its open requests,
  behind the Comms filters), the board's lifecycle (`20261012000103_project_board_lifecycle.sql`, ADR-0149: epochs,
  reply, cancel, expiry, deliveries, the outbox; it rewrites the stored idempotency receipts once, to the shape without
  `seq`), its responders (`20261012000104_project_board_responders.sql`: tables and functions, no stored row
  rewritten), the responders' fix round (`20261013000107_project_board_w2_fixes.sql`, functions only) and the
  operator's reads of the board (`20261013000108_project_board_operator_reads.sql`, ADR-0156 §8: the paged thread list,
  search, what waits, who answers and request timelines — functions and one partial index on the journal, no stored row
  rewritten). The arithmetic is in [release-mac.md](docs/launch/release-mac.md#upgrading-an-existing-database).

**Upgrading.** A database at schema 84 (0.3.5) is upgraded to 89 before 0.3.6 opens it: install 0.3.6 and start it
once (it refuses, and copies its migrations into Fabric's stack folder), quit it, make a verified backup, rehearse on a
copy, then run `supabase migration up --local` in that folder and start 0.3.6 again
([release runbook](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).
Until then 0.3.6 refuses to start its workspace services and says which schema it found. An older database (69, 75,
78, 79) takes the same procedure; `supabase migration up` applies every missing migration in order. 0.3.5 cannot open
a database at 89: keep the backup if you may need to go back.


## 0.3.5

Fabric on Windows and Linux, the way the other PassionCode.ai apps ship (CO-238); a coding agent you open
yourself in a terminal can work in your project through Fabric; and Fabric shows which agent works on what.

- **Fabric opens from a product's Fabric button.** A `fabric://` link from Fabric Dashboards or any product now opens Fabric in that product's project (found from the product's repository), or says why it could not; before, macOS answered that Fabric was not installed, because Fabric did not register the scheme. A link that starts Fabric is not lost while the window opens, and one that arrives during the first run waits for it to end.
- **A coding agent opened outside Fabric works in your project.** Register Fabric once in Claude Code or Codex —
  `claude mcp add --scope user fabric -- "<Fabric>/bin/fabric-mcp" --runner claude-code`, or
  `codex mcp add fabric -- "<Fabric>/bin/fabric-mcp" --runner codex` — with no key in it (on Windows:
  `claude mcp add --scope user fabric -- cmd /c "<install folder>\resources\bin\fabric-mcp.cmd" --runner claude-code`, with the install folder under
  `%LOCALAPPDATA%\Programs\`; not yet
  tried on a Windows machine). The first
  time the agent starts in a project's folder, Fabric asks you once whether it may work there; after Allow it gets what
  a session Fabric starts gets in that project, and its work is recorded like any session's. Revoke it in
  Settings → Agent access ([ADR-0134](docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md)).
  `<Fabric>/bin` is `Fabric.app/Contents/Resources/bin` on macOS and the install folder's `resources/bin` on Windows
  (`fabric-mcp.cmd`) and Linux. On Linux register it from the `.deb` (`/opt/Fabric/resources/bin/fabric-mcp`): an
  AppImage mounts at a new path each start, so a registration pointing into it breaks on the next start.
- **Who is working on what.** A project's page lists each agent's claim on a task — the agent, how it came in, what it
  touches, since when, its last sign of life — marks two claims that overlap as related, and lets you release a claim
  after asking (SCR-31). **Where work is** (SCR-78, in the rail) shows the same across every project, with the sessions
  that belong to none on the last row. Coding agents claim a task through Fabric before they start and are warned of
  related work (REQ-38).
- **The first run asks which coding agent to use** as one choice among the agents Fabric found, and an agent that
  cannot be chosen says why (REQ-40).
- **Fixed: agents registered on this Mac could not be connected through Fabric.** Since 0.3.1 the hub's requests,
  decisions and calls were refused by the app's own journal before they were saved, so an agent's request never reached
  you (CO-254). They are recorded now, and a test checks every event the app writes against the journal's policy.
- **The database moves to schema 84** (from 79): five migrations, applied in order. An existing database is upgraded
  by the [documented procedure](docs/launch/release-mac.md#upgrading-an-existing-database) before 0.3.5 opens it.
- **"Running for N days" counts from the day Fabric could first open your Estate**, not from an install that failed
  to start (CO-242).
- **The old first owner leaves a repaired Estate.** On a database the 0.3.4 repair gave to you, 0.3.5 revokes the old
  seed's second owner at its first start — through the membership door, recorded, never a delete — while that member is
  still the seed's own and nobody signs in as it (CO-242).
- **A database Fabric refuses at start says what to do in your language**: the schema it found and the one it needs,
  or that the stack did not answer — the copied details stay in English, for a report.
- **Codex and Kimi Code connect to Fabric's surface.** Sessions of both get the project-board tools
  (`com.submit`, `com.list`, `com.get`, `com.read_ack`, `com.status`) like Claude Code, Kilo Code and Hermes
  Agent before them — each through the way its own probe verified ([report](docs/reports/2026-10-11-codex-kimi-surface-probes/README.md)):
  Kimi Code over ACP with HTTP MCP (no bridge), Codex through an isolated per-session `CODEX_HOME` whose server
  name and token variable are random per session, because a project `.codex/config.toml` shadows any name it
  knows. So a Codex session Fabric starts does not read your own `~/.codex/config.toml` or `~/.codex/AGENTS.md`
  (a project's own `AGENTS.md` still applies); when you are signed in to Codex it uses a copy of that login, removed
  when the session ends, and otherwise Codex asks you to sign in for that session. One residue, recorded as CO-247: Codex 0.162.1 has no `--ignore-project-config`, so a project can still
  add MCP servers of its own — as it already could before Codex connected. Cline stays unconnected: its ACP
  `session/new` demands a sign-in no probe has passed.
- **The project board is visible to the operator: the Comms screen** (SCR-81, SCN-143). The left rail gains
  Comms / «Переписка»: the estate's threads and messages read with your own eyes — sender, principal and its
  provenance per message, a request's state and effect as two separate labels, live by cursor polling; a board
  that does not answer says so, never an empty list. Read-only by design; the read goes through two new SQL
  functions, sanctioned for the local estate by [ADR-0117](docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md) (D3).
- **Windows.** A per-user installer for Windows on Intel and AMD (x64) and on Arm (arm64): `Fabric-0.3.5-windows-x64-setup.exe`
  and `-arm64-setup.exe`, Authenticode-signed through Azure Artifact Signing. Terminals
  open PowerShell; the local stack needs Docker Desktop (WSL2) and the Supabase CLI (`scoop install supabase`).
- **Linux.** An AppImage and a `.deb` for x64 and arm64. The local stack needs Docker Engine and the Supabase CLI. Install
  the `.deb` to open `fabric://` links and to register `fabric-mcp`: it registers the scheme and keeps one path.
- **Not yet on Windows and Linux:** whether a coding agent is signed in is not read there (it says so, CO-244).
  **Not yet on Windows:** connecting a cloud product's secret through Project Observatory (CO-245); Agent access says
  so when you press Connect, before the product is opened.
- **Windows and Linux are offered on [GitHub Releases](https://github.com/passioncode-ai/fabric/releases)**; the
  download page on passioncode.ai offers the Mac build until its own change.
- **Usage counts** (only after you answer the switch): `agents_with_access` counts agents with access to a connected
  product, and coding agents enrolled in projects are counted apart as `coding_agents_enrolled`
  ([docs/ANALYTICS.md](docs/ANALYTICS.md)).

**Upgrading.** A database at schema 79 (0.3.2 to 0.3.4) is upgraded to 84 before 0.3.5 opens it: install 0.3.5 and
start it once (it refuses, and copies its migrations into Fabric's stack folder), quit it, make a verified backup,
rehearse on a copy, then run `supabase migration up --local` in that folder and start 0.3.5 again
([release runbook](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).
Until then 0.3.5 refuses to start its workspace services and says which schema it found. An older database (69, 75,
78) takes the same procedure; `supabase migration up` applies every missing migration in order.


## 0.3.4

Fabric starts on a new Mac, and one download now serves Apple silicon and Intel Macs. Every fresh install since 0.2.0
stopped before its first window with "identity could not be established: that person is not a member of this
estate": the database Fabric sets up on first start gave its first Estate to an owner Fabric never runs as
([ADR-0131](docs/adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md)).

### Fixed

- **A new install opens its Estate.** The database is set up with you as the owner of its first Estate, the same
  way Fabric itself founds one.
- **An install of 0.3.2 or 0.3.3 that could not start, starts.** On the next start Fabric finds the database
  untouched and makes you its owner. Untouched means nothing happened in it but its creation, and at most an
  agent asking for access while the start was failing. A database anyone has used is never changed this way.
  The old first owner stays a member in the database beside you; nobody signs in as it, and no screen shows it.
- **When Fabric still cannot open the Estate, it says why.** The startup window names the refusal and what Fabric
  found, instead of "could not work out why".

### Changed

- **One universal DMG for Apple silicon and Intel Macs** (`Fabric-0.3.4-universal.dmg`, in place of `-arm64.dmg`).
  Its Intel runtime was measured under Rosetta on an Apple silicon Mac
  ([receipt](docs/launch/harness-r0/checks.md#intel-x86_64-runtimes--2026-10-09)); the app has not yet been run on an
  Intel Mac. How the universal app is built: [release runbook, Universal macOS](docs/launch/release-mac.md#universal-macos).

**Upgrading.** No schema change: a database at schema 79 (0.3.2, 0.3.3) opens as it is. A database a 0.3.0 or 0.3.1
install made (75 or 78), or a 0.2.0 one (69), is refused for its schema first: upgrade it to 79, backup and
rehearsal included, and the next start repairs it. If Fabric never opened a window on that Mac, the database holds
nothing, and the runbook names the shorter way
([release runbook](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).

## 0.3.3

Fabric becomes the way into PassionCode.ai: the first screen offers four actions, and the work behind the two agent
actions happens in the console of a coding agent you already use, not in a chat of Fabric's own
([ADR-0129](docs/adr/0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md),
[ADR-0123](docs/adr/0123-the-conversation-is-the-runtimes-console-and-the-ceo-is-a-session.md)). The CEO chat itself
stays in this release; it moves to a session in a later one (amendment 1 of ADR-0123).

**Upgrading.** No schema change: a database at schema 79 (0.3.2) opens as it is. A database still at 75 (0.3.0)
or 78 (0.3.1) needs the upgrade to 79 first, backup and rehearsal included
([release runbook](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).

- **Four actions to start.** The first run and **+ Project** offer two pairs. *Agent:* create a new one, or adapt
  one you built elsewhere. *Project:* open one (one folder, or a folder of them), or create one. The role agent of
  a project is made from that project's Team.
- **Create an agent.** A name, one sentence on what it will do, where its folder goes and which coding agent
  builds it. Fabric creates the folder as a git repository and a project for it, then opens the coding agent's
  console with the `creating-fabric-agents` skill; the agent asks the rest there, one question at a time.
- **Adapt an existing agent.** Choose its folder: Fabric reads it without running anything and opens the coding
  agent's console with the `adapting-projects-to-fabric` skill. The agent shows its plan and waits for your yes;
  a folder that is not yet a repository is committed as it is first, with anything that looks like a secret kept
  out; the work goes on a new branch `fabric-adapter`, and the conformance report says what passed. Fabric writes
  nothing in the folder and does not admit the agent to its registry.
- **The Fabric Agent Adapter skills are checked before either starts**, with the version: for Claude Code, Codex,
  Kilo and Hermes in the folder each reads; for Cline and Kimi Code, which have no folder Fabric knows, only the
  shared `~/.agents/skills`, and the screen says so. When they are missing, the one command that installs them is
  shown to copy, with a note when it does not cover the chosen agent. Fabric installs nothing itself.
- **A retry is the same attempt.** A launch that fails after the folder or the project was made continues with
  the same folder, project and task, also after leaving the screen and coming back; a console that did not open
  is brought forward again; *Use another coding agent* gives the same project a new task, and *Start over* is the
  only way to another name or place.
- **A scanned project arrives with what its repository says it is** (the manifest's description, else the
  README's first paragraph), kept as the repository's words — "From README.md: …" — not as yours; a repository that
  says nothing gets none.
- **"Set up this project with the agent"**, the first shortcut on a project's task panel and the scan's next
  step: the agent reads the repository, records what it learns with the file each fact came from, asks you to
  confirm a one-sentence purpose and files the next three pieces of work. It changes no file, and it runs only on a
  coding agent that connects to Fabric's tools: by name, through a created agent, or through the fallback order,
  which passes over agents that do not.
- **Fallback order** (Settings): a list of coding agents a launch may walk, each with whether to start a new
  session or use an open one; once set, «Fallback order → agent» is offered in the agents and task panels ([ADR-0125](docs/adr/0125-an-agent-launch-may-follow-the-operators-fallback-order.md)).
- **Kimi Code** is in the coding-agent list and the launch menu, launched as itself; it does not connect to
  Fabric's tools.
- **Usage counts wait for your answer.** They stay on by default, but a release build sends nothing, the install
  included, until you have answered the switch once, on a first-run notice or in Settings
  ([ADR-0127](docs/adr/0127-no-usage-count-leaves-before-the-person-has-answered-the-switch.md), [docs/ANALYTICS.md](docs/ANALYTICS.md)).
  An install from 0.3.2, which may already have sent counts, is told so on that notice.
- **The launch screens follow the prototype**: «Discuss with Fabric ↗» (it opens the CEO chat) and *Profile* in the
  scope bar, the Fabric strip under it, a compact network-exposure warning, and nothing wider than the window. The default
  workspace reads *My workspace*.
- **Smaller fixes on the project page:** the toolbars wrap instead of running past the window, a task's subtitle
  names its agent and date instead of a raw id, and Home's «+ Add a topic» opens the board with its form.
- **Russian.** Every screen string, the startup failure dialog, the folder pickers and the app menu are in
  Russian when the app is. Not yet: messages written by the main process, the terminal prompts of ACP agents and the
  feed's verification tooltips are still in English (CO-225).
- Provider pins move to the installed Claude Code and Codex versions; the README names the commercial-licensing
  path (passioncode.ai/business).

## 0.3.2

A release built from a full audit of the 0.3.2 candidate (`e19e1b9e`, 0.3.1 plus the work merged after it): all 134 scenarios against their screens and code,
plus the trust boundaries ([report](docs/reports/2026-10-05-release-032-audit/README.md)). Every P0 and P1
finding is fixed or carried to a named row. It also ships the work that landed on `main` after 0.3.1.

- **Schema 78 → 79** (migration `20261005000081_project_board.sql`, the project board's core). Fabric 0.3.2
  does not migrate an existing database itself: it refuses a database below schema 79 and names the upgrade
  procedure ([release runbook, upgrading an existing database](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).
  Once a database is migrated to 79, Fabric 0.3.1 can no longer open it, so take the backup the procedure
  asks for first. The rehearsal is one command: `node scripts/rehearse-upgrade.mjs` runs the upgrade on a copy
  of your dump in a separate, disposable stack.
- **Usage counts, on by default in a release build, from the first start.** Fabric sends installs, days of use
  and how many projects, products and agents are connected, to PassionCode's self-hosted analytics. Every event
  carries the app version, the OS name, a session id and a random installation id that every PassionCode app on
  this Mac shares; never names, paths or content. Settings → *Share usage counts* turns it off for every
  PassionCode app on the Mac ([docs/ANALYTICS.md](docs/ANALYTICS.md)). Builds from source send nothing.
- **The project board.** Agents that connect to Fabric's surface (Claude Code, Kilo, Hermes) get the project-board tools (`com.submit`, `com.list`,
  `com.get`, `com.read_ack`, `com.status`): durable, project-addressed messages that survive the session
  ([ADR-0117](docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md)).
- **More coding agents in the launch menu: Kilo Code, Hermes Agent and Cline.** Hermes runs over the Agent Client
  Protocol through Fabric's terminal shell; Kilo through its session-config variable
  ([ADR-0119](docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md)).
- **The editor never damages a file it cannot show as text.** Binary and non-UTF-8 files open read-only and
  are never written back; a save no longer rebuilds the editor, so typing during a save is kept; "Keep mine"
  overwrites only the version you were shown; a conflict puts the focus on its explanation, not on the
  destructive button.
- **Agents run through ACP behave.** A turn has no two-minute deadline; a line typed ahead never answers a
  permission question, and Ctrl-C during one answers it as cancelled; stopping an agent ends its whole process
  group, including the tools it started, even when Fabric has to force the stop; Kilo and Hermes do not start
  in a mode their bundle cannot honour; one failed request no longer closes the stdio bridge.
- **Your project's servers go with Fabric's surface to every agent that connects to it.** Hermes, which takes no HTTP MCP servers,
  reaches each granted server through its own stdio bridge; a session whose granted servers cannot be carried
  is not opened.
- **Cline asks before each tool.** It now starts in Ask (`--auto-approve false`); Bypass is the only mode in
  which it approves tools on its own.
- **Keys stay out of transcripts in more spellings:** Kilo's config, ACP header pairs, the bridge's
  `FABRIC_BRIDGE_AUTHORIZATION`, escaped JSON and Python dicts (ADR-0119, amendment 4).
- **Not yet:** restoring a private-history archive into a new estate does not bring back project-board messages
  (CO-212); the archive keeps the board's events, not its stored messages.
- **Attention, Board, digest and history read true.** A granted refusal leaves the queue and repeats are one
  item; an answered question keeps its receipt on the Board screen (the project page's panel does not yet, CO-222); the digest no longer marks lines read while you read
  them and is no longer cut at 1000 rows; an agent's history shows its newest 200 events and says when earlier
  ones may exist.
- **Windows hold only Fabric.** A window can show only Fabric's own page, links leave for your browser, the
  built page carries a Content-Security-Policy, and the bridge refuses any other caller. A failure in a window
  is sent to Diagnostics; a broken screen shows a recovery screen, and a window whose page process died is
  reloaded instead of staying blank.
- **Fabric tells you when your local database is reachable from the network.** The Supabase CLI publishes the
  stack's ports on every interface with its default password, and Fabric cannot bind them to this Mac alone.
  Fabric checks after start and again while it is open, at most about ten minutes apart (and retries a check
  that failed); if the ports answer on your network address, a warning above every screen gives the remedy for
  OrbStack or Docker Desktop.

## 0.3.1

- **The hub: a local agent reaches a cloud product through Fabric, on your consent**
  ([ADR-0115](docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md)). Fabric listens
  for agents registered on this Mac on a stable loopback port, `FABRIC_HUB_PORT` (default 47070), published in
  `~/Library/Application Support/ai.passioncode.fabric/hub.json` beside a door token (both 0600, rewritten on
  start, removed on quit). An agent asks once with `fabric.access.request`; you answer once in a native prompt,
  or from the attention queue when Fabric is in the background; on Allow the agent collects a revocable binding
  credential and calls the product with `agent.call`, narrowed by your grants and again by the product.
  **Settings → Agent access** lists products, waiting requests, agents with their grants (Revoke, Revoke all)
  and standing denials (Clear).
- **Fabric Inbox connects once, by its own consent.** Connect opens the Fabric Inbox app; its key goes to
  Project Observatory's vault, never into Fabric's database or logs. It needs a Fabric Inbox **server** with
  account narrowing (fabric-inbox#24). Fabric checks that the runtime reports version 0.9.0 or later, but a
  version check does not prove narrowing: the deployed source and a live acceptance remain open (CO-195,
  [fabric-inbox#26](https://github.com/passioncode-ai/fabric-inbox/issues/26)). The 0.9.0 app supplies the connect link.
- **Hardening from three verification iterations:** a per-request poll secret, so only the agent that asked
  can read its answer and collect its credential; the registry reads regular files only and never blocks the
  app; the connect callback answers the product within its 10 seconds and keeps nothing it could not confirm,
  except a late record whose withdrawal itself failed, which stays and is shown to you as such; hub authority
  restored from an archive comes back revoked, for you to approve again; each estate keeps its own product
  secret slot; the consent, grant and queue wording is in English and Russian; a call whose outcome is unknown
  is never sent again under the same key; a caller that disconnects no longer holds an admission slot; quitting
  can no longer hang on a special file planted at `hub.json`.
- **First run shows whether Claude Code and Codex are signed in** (CO-176), read with each tool's own read-only
  status command on the exact builds Fabric has verified; any other answer is shown as unknown, never as signed
  in, and the step never waits for it.
- **Stopping an agent:** asking again to stop a Claude Code or Codex run whose stop was already sent answers with
  that first outcome instead of a refusal that would read as "nothing was sent".
- **Smaller fixes:** the onboarding launcher no longer covers the project controls, onboarding scrolls inside
  narrow windows, and restoring saved drafts reads one consistent snapshot.
- **Schema 75 → 78** (migrations 76, 77 and the file with suffix 80; the schema version is the migration count).
  Fabric 0.3.1 does not migrate an existing database itself: it refuses a database below schema 78 and names the
  upgrade procedure ([release runbook, upgrading an existing database](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).
  Once a database is migrated to 78, Fabric 0.3.0 can no longer open it, so take the backup the procedure
  describes first.
- **Not done yet:** `agent.call` takes product tool names the agent contract's `capabilityName` pattern refuses
  (CO-193); a session Fabric starts cannot reach a product through Fabric (CO-194); no live end-to-end run with
  the Fabric Inbox app yet (CO-195); the knowledge base needs final released facts (CO-196); final-source workspace
  publication and acceptance remain open (CO-197).

## 0.3.0

- **Releases are built and signed in CI.** A `vX.Y.Z` tag on main runs `.github/workflows/release.yml`:
  after a member of `release-approvers` approves, the DMG is signed with the organization's CI Developer ID,
  notarized and stapled, then attested (Sigstore), listed in a GPG-signed `SHA256SUMS` and published as a
  prerelease of this repository while Fabric is an early preview. No signing identity or team id is written into the repository any more; a
  build made on a laptop is a debug build and is never published.
