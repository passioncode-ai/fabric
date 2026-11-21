# Brief: the canvas and its designer (first slice)

**Run:** task-pipeline, 2026-11-19, branch `feat/canvas`, worktree `~/DATA/_worktrees/fabric-canvas`.
**Order:** board request `979d8f84` (thread `5aa0f003`), the owner's words of 2026-11-19 21:09 to 21:15 (Warsaw), relayed
verbatim by the CEO: «нужен канвас на котором агент сможет наброски делать и борды крепить», «и будет тебя по нему
катать», «когда говоришь с ассисттом она передает CEO задачи в работу а проектировщику на канвасе быстро накидывать драфт
идей, типо сземки, заметки и тд, визуальнуд карту строить и тчобы мышко йтам мог тоже работать, типо как доска у
следователей или у журналистов», «и голосоое управление, что-то сразу а что-то через ердактора который рисует и создате
на канвасе контент, сделать». Fabric task `01c3a418`.
**Model:** Claude Opus 5.5, the session's model; the operator's standing rule (full delegation) records the choice
instead of a question.
**Decision record:** [ADR-0201](../../adr/0201-the-canvas-is-an-excalidraw-window-a-designer-draws-on.md).
**Scenarios:** [SCN-190](../../ux/scenarios.md#scn-190-draw-on-the-canvas-with-the-mouse),
[SCN-191](../../ux/scenarios.md#scn-191-the-canvas-is-drawn-and-shown-by-voice).

## Vision check

Aligned: the canvas serves the vision's «the person opens Fabric and talks to it» (ADR-0197's CEO) by giving the talk a
surface both sides can point at. It is not a second board of record: tasks stay on the board, the canvas links to them.

## What the first slice is

1. A canvas window: its own document (`canvas.html`), its own window kind (`canvas`, the canvas id as its subject), the
   Excalidraw editor in it. The mouse does everything the editor does: notes, shapes, arrows, freehand, text, moving,
   connecting.
2. The canvas is kept on disk in Fabric's data folder (`canvases/<id>.excalidraw`, Excalidraw's own file format, so the
   file opens anywhere Excalidraw does), saved as the person draws and opened again with what it held.
3. The CEO's voice call gets canvas tools. Simple acts run at once (open, add a note or a block, connect, look at,
   highlight, remove, read what is there). A sketch of a whole idea goes to the **designer**: one model call (Kimi K3.1
   Pro on OpenRouter, the model map's planning model, with Fabric's own key from Observatory's vault) that answers a
   diagram (nodes, links, groups) and a tour; the canvas lays it out, and the call walks the owner through it with
   focus and highlight while it speaks.
4. The window opens from the app menu («Окно → Канвас», Cmd+Shift+K) and by voice.

## What it is not (later slices, each a board row)

Pictures, screenshots and screen recordings on the canvas; links to tasks, sessions, PRs and dashboards as cards;
versions of a canvas; attaching a canvas to a task as context; knowledge-graph nodes; the CEO's text console drawing
(the hub's MCP tools); half-screen and full-screen placement by voice (the windows work of `feat/ceo-session-windows`).

## REQ spine

| REQ | Requirement | Verified by |
|---|---|---|
| CV-REQ-01 | A canvas window opens from the menu and by voice, one per canvas, focused again when already open | `test/canvas-host.test.mjs` (open twice, one window); the menu probe `test/menu.test.mjs` |
| CV-REQ-02 | The mouse draws notes, shapes and arrows (the editor's own tools) | browser check of the built `canvas.html` (stage 6) |
| CV-REQ-03 | The canvas is saved to disk and opens again with what it held; a file that is not Excalidraw's, too large, or a bad id is refused | `test/canvas-store.test.mjs` |
| CV-REQ-04 | The canvas window may call only its own canvas's channels; no other window kind may save a canvas | `test/ipc-window-policy.test.mjs` (planted: a session window saving a canvas) |
| CV-REQ-05 | The canvas page loads nothing from the network: fonts and assets are the app's own files, and the page carries the renderer's policy | `test/csp.test.mjs` (the policy, the fonts copied, canvas.html among the app's documents), the browser check's network log |
| CV-REQ-06 | Voice tools: open, add, connect, focus, highlight, remove, read, draw (a diagram the call composes) and design (the designer); each argument checked, a refusal said in words | `test/canvas-commands.test.mjs` |
| CV-REQ-07 | An element is found by the id the agent gave it or by its words; an unknown one is named back, never guessed | `test/canvas-commands.test.mjs` (`resolveRef`) |
| CV-REQ-08 | A diagram is laid out without overlaps, left to right by its links | `test/canvas-commands.test.mjs` (`layoutDiagram`) |
| CV-REQ-09 | The designer answers a diagram and a tour from one model call, bounded in tokens and time; a missing key, a refusal or an unreadable answer is a refusal in words, and nothing is drawn | `test/canvas-designer.test.mjs` |
| CV-REQ-10 | The call's instructions route: work in projects to the CEO (`ask_ceo`), drawing and showing to the canvas tools, a whole idea to the designer | `test/canvas-commands.test.mjs` (instructions name the tools); scenario SCN-191 |
| CV-REQ-11 | A command to a canvas that does not answer within 10 s is a refusal, and a late answer is dropped | `test/canvas-host.test.mjs` |
| CV-REQ-12 | Docs in the same change: ADR-0201, SCN-190/191, the design map, the lifecycle table if anything runs in the background (nothing does) | `bash scripts/ci.sh fast` |

## Source ledger

| Source | Read | Finding |
|---|---|---|
| Board request `979d8f84` | `com.get`, 2026-11-19 | the order and the CEO's reading; architect consulted by the CEO, no template |
| ADR-0197, `main/ceoVoice.ts`, `renderer/src/ceo/voiceCall.ts` | read in full | voice tools run in main through `ceoAgent.voiceTool`; the call's instructions and tools are composed in main |
| `shared/ipcWindowPolicy.ts`, `main/windowRegistry.ts`, `preload/api.ts` | read | a new window kind needs its rules and every `EVERY_WINDOW` row; the preload narrows by kind |
| `electron.vite.config.ts` | read | a renderer document is an `input`; the CSP plugin writes the policy into the built page |
| npm registry, 2026-11-19 | `npm view` | `@excalidraw/excalidraw` 0.18.1 MIT, React 17 to 19; `tldraw` 5.6.1 `SEE LICENSE IN LICENSE.md`; `@xyflow/react` 13.0.2 MIT |
| Excalidraw 0.18.1 `dist/prod` | grep | fonts load from `window.EXCALIDRAW_ASSET_PATH`, else `esm.sh`; 13 MB of fonts ship in the package |
| OpenRouter models API, 2026-11-19 | `GET /api/v1/models` | `moonshotai/kimi-k3.1-pro` listed |
| Observatory credentials, project fabric | `observatory_credentials` | `fabric/prod/OPENROUTER_API_KEY` and `fabric/prod/XAI_API_KEY` exist |
| Retro standing instructions R-001 to R-010 | read in full | R-003 (probe the window boundary by attempting), R-005 (one type per boundary), R-006 (watch each check red), R-010 (a surface checked as its user meets it) bind this run |

Contradictions: none found. The parallel runs (`feat/ceo-session-windows`, `feat/record-show`, `feat/knowledge-graph`,
`feat/session-launch-journal`, `feat/ceo-popup-redesign`) touch `main/index.ts`, `shared/ipcWindowPolicy.ts` and
`docs/ux/scenarios.md`; this branch rebases after their releases (0.3.25, 0.3.26).
