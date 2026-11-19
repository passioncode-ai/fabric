# The CEO agent: acceptance walk (ADR-0197)

**Status:** walked 2026-11-18 on branch `feat/ceo-agent` (before main with 0.3.23 was merged in `b2e350d3`); scenarios (a) to (i) pass, with the findings at the end. The
walk ran a development build with a data folder of its own, against a disposable database stack
(`scripts/test-stack.mjs`), never the operator's installed Fabric or its stack. There is no separate spec or plan: ADR-0197's six decisions and board tasks `a125cc0e`, `b8fc11e4`, `3fc98668`,
`e7ff5556` and `ff3fe9c3` are the plan of record. Decision: [ADR-0197](../../../adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md);
scenarios SCN-110 and SCN-182 to SCN-185 in [`docs/ux/scenarios.md`](../../../ux/scenarios.md).

## How the walk runs

`scripts/walk/ceo-acceptance.mjs` drives a built app (`npx electron-vite build` in `apps/desktop`) over the Chrome
DevTools protocol:

```sh
node scripts/test-stack.mjs up <work>/stack
node scripts/test-stack.mjs with <work>/stack -- node scripts/walk/ceo-acceptance.mjs launch <work> --port 9411
node scripts/walk/ceo-acceptance.mjs eval 9411 main "window.fabric.ceoAgent.send('…', [])"
node scripts/walk/ceo-acceptance.mjs shot 9411 ceo <file.png>
node scripts/walk/ceo-acceptance.mjs stop <work>
node scripts/test-stack.mjs down <work>/stack
```

`launch` gives the app a data folder of its own and a new estate with the first run marked done; `--no-claude` points
`CLAUDE_CONFIG_DIR` at an empty folder, so Claude Code reads as signed out (scenario h). The hub's port 47070 belongs to
the installed Fabric, so the walked app's hub stays closed and writes no `hub.json`; its consoles keep their own surface
on an ephemeral port, the CEO's tools included. The voice call runs with Chromium's fake microphone fed a recorded
phrase (`--use-file-for-fake-audio-capture`), and `--disable-features=AudioServiceOutOfProcess,AudioServiceSandbox`,
without which the fake capture is silent in Electron 44.

Work folder of the run: `~/DATA/_worktrees/fabric-ceo-acceptance` (outside the repository); the screenshots in this
folder are copies from it, scaled to at most 1000 px.

## Models

The CEO's model order is `anthropic/claude-opus-5.5`, `openai/gpt-6.2-sol`, `anthropic/claude-sonnet-5.5`
(`shared/ceoAgent.ts#CEO_MODELS_DEFAULT`, the operator's order of 2026-11-18): nothing below Sonnet 5.5 is accepted
(`ceoModelAllowed`, test "THE FLOOR"). Claude Code is launched with `--model opus` (never Haiku); Hermes gets the order
through `FABRIC_ACP_MODELS` and keeps the first model `session/set_model` acknowledges. In the walk, Claude Code ran on
Opus 5.5 and Hermes on `anthropic/claude-opus-5.5` through OpenRouter (the popup's header reads «работает на Hermes
Agent · claude-opus-5.5», `h-hermes-fallback.png`).

## Results

| | Scenario | Result | Evidence |
|---|---|---|---|
| a | Home composer «Спросить CEO» sends; the popup opens over the app; the floating button opens it from another screen | pass: the CEO (Claude Code, Opus 5.5) answered «42» to «6×7?» | `a-popup-answer.png`, `a2-floating-button.png` |
| b | An image attached to the message | pass: a red square, the CEO answered «Красный.» (after finding 1) | `b-image-answer.png` |
| c | «Какие сессии сейчас идут?» | pass: `fabric_ceo_sessions` listed the Fabric consoles with project and state, and Switchboard's sessions | ops log `ceo.tool.sessions` |
| d | Read a session waiting on a question | pass: `fabric_ceo_session_read` returned the console's screen, «choose 1/2:» | ops log `ceo.tool.read` |
| e | Answer it | pass: `fabric_ceo_session_input` typed `2` and Enter, the console printed «got 2» | ops log `ceo.tool.input` |
| f | Start a session in a project with a first task | pass: the CEO admitted the folder `demo-shop` as a project and started a console there | История: «CEO agent» started a session |
| g | Stop, kill, resume, open | pass: open showed the console in a Fabric window; stop answered `outcome_unknown` and the force kill ended it; resume started console `84ff0d5a`, which printed `resumed-ok`; every act in История with actor «CEO agent» and its reason | `g-popup-after-acts.png`, `g-opened-session-window.png` |
| h | Claude Code signed out: the CEO runs on Hermes | pass after findings 2 and 3: Claude Code set aside «не выполнен вход», Hermes on Opus 5.5 answered and called `fabric_ceo_sessions` through this session's surface | `h-hermes-fallback.png`, ops log `ceo.agent.fallback`, `ceo.tool.sessions` |
| i | Voice call «Позвонить» | pass: a token minted in main (the key never reached the renderer); typed and spoken «Покажи сессии» each called `session_sessions` (and `session_read`), the reply was spoken and transcribed, «Положить трубку» ended the call | `i-call-typed.png`, `i-call-spoken.png` |

Scenario (h) is a real refusal by Claude Code (signed out, its login and theme screens), and the walk that passes it
over is Fabric's own (ADR-0125's, `runnerFallback.ts`), not Switchboard's automatic fallback chain. Switchboard 0.7.119
(SB-481, board message `9a54a4de`) stops its own chain skipping Kimi Code and Hermes under `agents permissions
bypass`; the CEO does not depend on that chain.

Every CEO act was journalled with its reason (`ceo.session.*` acts in История) and every tool call wrote one
`ceo.tool.<name>` line to the operations log.

## Findings and what was done

1. **Claude Code swallowed the Enter after a pasted image path** (the line stayed in its input as «[Image #1]»). Fixed:
   for Claude Code a line with attachments gets a second Enter 1.5 s later (`main/ceoAgent.ts`), covered by the
   attachments test.
2. **A signed-out Claude Code was not passed over.** Its auth probe may not answer in time under load, so the console
   starts and shows its login menu, its words placed by cursor moves (`\x1b[9G`) and cut across chunks; a first run
   shows the theme picker before it. Fixed: the console's output is read through a rolling buffer that turns cursor
   moves into spaces, and `SIGNED_OUT_SAID` names both screens; the walk passes to Hermes and a message sent meanwhile
   is typed there. Tests «a runner that shows its sign-in screen…» and «a runner on its first-run theme picker…», the
   second watched failing with its alternative removed.
3. **On Hermes the CEO lost its tools and acted on another Fabric.** Hermes keys its MCP connections by name and keeps
   the one already connected: the `fabric` server in the person's own Hermes config (the installed Fabric's
   `fabric-mcp`) answered in place of this session's surface, also named `fabric`. Measured: the walked Hermes CEO
   created a project «ceo» (`70d8992b`) with a `ceo.task` slot in the operator's installed Fabric and saw none of the
   `fabric_ceo_*` tools. Fixed for every ACP session: the surface goes under a random name per session, `fabric_` and
   eight hex digits, as Codex's already did (`main/sessionBundle.ts`, test «random name per session», watched failing
   with the name set back to `fabric`); the brief tells the CEO that another `fabric` server belongs to another Fabric.
   After the fix the CEO called `mcp__fabric_c1a55ee4__fabric_ceo_sessions` on this session's surface. Hermes still
   loads the person's own `fabric` server beside it (its ACP adapter puts configured servers in the agent's toolsets
   whatever `HERMES_ACP_SKIP_CONFIGURED_MCP` says), which is why the brief names it. **Left in the installed Fabric:**
   project «ceo» (`70d8992b`), its enrolled session `73ac60b2` and three memory facts, written by the walked Hermes CEO
   before the fix; to archive (board task `543e0340`, CO-597 item 7).
4. **The PM chain's `com.enroll` on `ceo.task` answers `not_authorized` where the runner never enrolled through
   `fabric-mcp`**: the own-project grant (ADR-0190) needs a live binding of the runner, and the disposable estate had
   none (ops log `board.own-respond`: «no live credential of this session or its runner»). On the operator's machine
   Claude Code and Hermes hold bindings (`fabric_access_list` on 2026-11-19: nine live
   credentials of `claude-code`, one of `hermes`). Not changed in 0.3.24: CO-597 item 1.
5. **Switchboard's sessions were unreadable in the signed-out run**: with `CLAUDE_CONFIG_DIR` pointing at an empty
   folder, `switchboard --json sessions --rows` failed, and the CEO said the list was incomplete instead of guessing.
   Expected for that setup.
