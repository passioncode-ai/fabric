# ADR-0197: The CEO is a console session Fabric keeps, with a fallback runner, session control and a voice call

**Status:** accepted · 2026-11-18 · board tasks `a125cc0e` (the CEO session and its fallback), `b8fc11e4` (the home
composer and the floating popup), `3fc98668` (session tools), `e7ff5556` (voice), `ff3fe9c3` (the PM chain) · records
the operator's order of 2026-11-18 (paraphrased: a Fabric CEO agent that runs development, not only on a Claude
subscription with a mandatory fallback such as Hermes on OpenRouter, one per machine, with every MCP server; a chat on the
home screen that takes anything, text or a picture, and opens a floating popup chat over the screen; the floating button
back; a voice call over the xAI API; the CEO finds a project, finds its session or starts one, watches it and has full
control: start, answer, stop, kill, continue) · applies [ADR-0123](0123-the-conversation-is-the-runtimes-console-and-the-ceo-is-a-session.md)
(the CEO is a runtime session, not a chat surface) · retires the side panel's conversation for P-13 (the CEO is a
session) · extends [ADR-0125](0125-an-agent-launch-may-follow-the-operators-fallback-order.md) (the fallback walk) with an
order of the CEO's own.

## Context

Fabric had the CEO's parts and no CEO. The conversation store saved the person's messages and said «saved, no reply yet»
(`apps/desktop/src/renderer/src/CeoChat.tsx`); the manager's closed tool set (`managerTools.ts`) had no model behind it;
the floating button was removed with the rail (OF-05). Meanwhile every session on this computer ran in a terminal the
person had to find: to see what a session asked, answer it, start one in another project or stop one stuck, the person
left Fabric for another window. The operator's order is that he opens Fabric and talks to it, in writing or by voice,
and that the CEO does the rest.

Two constraints shaped the answer. ADR-0123 already decided that the CEO is a runtime session, so a second chat engine
inside Fabric (a model loop of its own) is the thing not to build. And the operator made the fallback mandatory: a CEO
that runs only while one Claude subscription has quota is not the CEO of the machine. Switchboard's automatic walk cannot
carry it today (its unattended walk refuses Kimi and Hermes over `permission_mode`, filed to fabric-switchboard), so the
walk is Fabric's own.

## Decision

1. **One CEO console per computer, in a folder of its own.** Fabric keeps one console in `<userData>/ceo`, whose brief is
   written there as `CLAUDE.md` and `AGENTS.md` at every start (role, tools, how to delegate, Russian, no em dash), with an
   `inbox/` for attachments. A console needs a project, so the folder is admitted as the project «Fabric CEO» (no
   onboarding task is filed for it; `projectAdmission.ts#create` takes `onboard: false`). It starts on first use (the
   popup opening, a message, a call) and keeps running; «Перезапустить CEO» stops it and starts it again. The console is
   started through `PtyManager.open` like any other, so it has its bundle, its surface and its journal records, and a
   Claude Code CEO keeps the person's own MCP servers (CO-325: not strict), Fabric's server winning the name `fabric`.
   (`apps/desktop/src/main/ceoAgent.ts`, `apps/desktop/src/shared/ceoAgent.ts`.)
2. **The fallback is Fabric's, and it is mandatory.** The console walks the CEO's own order, settings `ceoRunners`
   (default: Claude Code, then Hermes on OpenRouter), with ADR-0125's walk: a runner not installed, signed out, not
   answering or that could not be spawned is passed over. Two cases the walk cannot see are caught after the start: a
   runner that prints its usage limit (`ceoAgent.ts#LIMIT_SAID`) and one that ends within 20 seconds are set aside for an
   hour, the next runner starts, and the person's last message is typed again. The popup's head says which runner the CEO
   runs on and why any was passed over or set aside. Kimi Code and Codex are not CEO runners: Fabric cannot hold their
   model to the floor below. Hermes's ACP session keeps `HERMES_ACP_SKIP_CONFIGURED_MCP` as every Fabric Hermes console
   does, so a Hermes CEO has Fabric's tools (the CEO's included) but not the person's other MCP servers: recorded as a
   gap, not hidden.
   <a id="the-ceos-models"></a>**The CEO's models** (the operator, 2026-11-18, about 22:10: «модель минимум сонет на
   разговор CEO но лучше OPUS или GPT SOL ... под его оркестрацию если нет кодинг агента активного в нем»; it overrides
   the wiki model map for the CEO alone): one list, settings `ceoModels`, default `anthropic/claude-opus-5.5`,
   `openai/gpt-6.2-sol`, `anthropic/claude-sonnet-5.5` (`shared/ceoAgent.ts#CEO_MODELS_DEFAULT`), never below Sonnet 5.5
   (`ceoModelAllowed`: Opus or Sonnet from 5.5, GPT Sol from 6; anything else in the setting is dropped, and a list with
   nothing at the floor is the default, never the cheap model). Claude Code is launched with `--model opus` (`sonnet`
   when the list puts Sonnet first), never Haiku. Hermes is handed the list (`FABRIC_ACP_MODELS`, read by the ACP shell)
   and its session takes the first model it acknowledges through `session/set_model` before the brief; one that takes
   none sends no prompt and ends, so the walk moves on rather than run below the floor (`acpShell.ts`, region
   `acp-session-models`). An `openai/*` model answers on an organization's OpenRouter key only through BYOK, for keys
   Observatory issued: a CEO key issued later must be added to its workspace's BYOK list, and until then the model fails
   at its first turn with 403, so Opus first keeps the CEO on a model that answers.
3. <a id="the-session-control-tools"></a>**The session control tools.** One set of operations (`ceoTools.ts#createCeoOperations`) with two doors:
   - MCP tools on the agent surface, registered on the CEO console's own server and no other (`agentSurface.ts`, region
     `ceo-surface`; the surface knows the console is the CEO's from its first call because the CEO chooses the session id
     before the launch): `fabric_ceo_sessions`, `fabric_ceo_session_read`, `fabric_ceo_session_input`,
     `fabric_ceo_session_start`, `fabric_ceo_session_stop`, `fabric_ceo_session_resume`, `fabric_ceo_session_open`,
     `fabric_ceo_projects`;
   - the voice call's function tools (`session_*`, run in the main process).

   Each tool is one of Fabric's existing doors: the list joins the consoles Fabric runs with Switchboard's view of the
   machine (`switchboard --json sessions --rows`); reading is the console's screen decoded (`pty-decode.ts`) or a Claude
   Code transcript's last turns; typing is `PtyManager.write` (keys by name, never raw control bytes from a model); a
   start is the person's console launch (`consoleOpen.ts`); a stop is the person's stop (force kills); a Switchboard
   session is ended or continued through Switchboard; a process outside Fabric is sent SIGTERM only with `force`. The CEO
   never types into, stops or kills its own console. Every act needs a reason, is written to the operations log with it,
   and a start or a stop is also an act in История (`act.ceo.session.start`, `act.ceo.session.stop`, actor the CEO's
   session) with its inverse. The authority is the person's, delegated by the operator's order; the gates are the doors'
   own (folder locks, the stop runtime). The hub has no search and execute doors yet (task `e9af6c95`), so these tools
   take the hub's existing style; moving them behind the two doors is that task's.
4. <a id="the-popup-window"></a>**The popup window.** «Спросить CEO» on the home screen and the floating button on every screen of the main window open
   one window over the app (`ceoWindow`, kind `ceo`), whose body is the CEO's console itself (ADR-0123: not a second
   chat), with its head (runner, state, «Позвонить», «Перезапустить CEO») and a composer at its foot. A message is typed
   into the console; a file pasted, dropped or picked (at most 25 MB, ten at most) is saved in the inbox and named by
   path, so the CEO opens it with its own file tools. The window is its own kind in the IPC policy: its console's
   channels are its own (its subject follows each restart, `windowRegistry.ts#resubject`), it may not stop or dismiss a
   console, and it is the only window given the voice call's two channels. Help's examples and the Guide's «Поговорить с
   Fabric» open this window with the example in its composer; the side panel's conversation is no longer opened (P-13).
5. <a id="the-voice-call"></a>**The voice call.** «Позвонить» in the popup opens xAI's realtime socket (`grok-voice-latest`) from the CEO window with
   an ephemeral secret: main reads `XAI_API_KEY` from Observatory's vault (`fabric/prod`) for one request, spends it on
   `POST /v1/realtime/client_secrets` (five minutes), and hands the window the secret, the call's instructions and its
   tools, never the key (`ceoVoice.ts`). The microphone is read at 24 kHz and sent as PCM16; the answer's audio plays as
   it arrives and is cut when the person speaks over it; a function call runs in main through the operations above, plus
   `ask_ceo`, which types a request into the CEO's console. The popup's document is the renderer's second entry
   (`ceo.html`) with a policy of its own that admits exactly `wss://api.x.ai`; the main page still reaches nothing. The
   microphone permission is granted to the CEO window alone, for audio alone; every other permission keeps Electron's
   answer. The signed app carries the audio-input entitlement and a microphone usage sentence; macOS asks the person once.
   The call shows its length and its price at xAI's list rate (USD 0.08 a minute).
6. **The PM chain.** The CEO's brief tells it to enrol for the board capability `ceo.task` on its own project and to read
   its unread board messages; a PM agent gives the CEO a task as a board request to the «Fabric CEO» project with that
   capability. The session's own `com.enroll` grants the slot ([ADR-0190](0190-an-agent-decides-agent-access-on-the-operators-relayed-words-and-answering-is-granted-for-the-sessions-own-project.md): own project), so no second mechanism is built.

## Consequences

- The person can stay in Fabric: write or speak to the CEO, see what any session asks, have it answered, started,
  stopped, continued or opened, without another window.
- A day without Claude quota still has a CEO: the walk or the limit fallback moves it to Hermes, and the head says so.
- The CEO acts with the person's authority through the person's own doors; what it did is in the operations log and
  История. A CEO model that misreads an order can stop a session: every stop needs a reason and a read first by the brief,
  and a process outside Fabric is killed only with `force`.
- The side panel's conversation code stays in the tree unused until its removal is its own change (P-13's rest).
- Not built here: a Settings row for `ceoRunners` (set by hand in settings.json), Hermes with the person's MCP servers,
  a voice of the operator's choosing (the call uses `eve`), and the CEO's tools behind search and execute.
