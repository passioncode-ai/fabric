# ADR-0201: The canvas is an Excalidraw window the person draws on and a designer draws on by voice

**Status:** accepted · 2026-11-19 · board request `979d8f84` (thread `5aa0f003`), Fabric task `01c3a418` · records the
owner's order of 2026-11-19 (paraphrased: a canvas on which an agent sketches and pins boards and walks the owner through
it; the voice assistant hands project work to the CEO and quick drafts of ideas, schemes and notes to a designer on the
canvas; the mouse works there too, like a detective's or a journalist's board; some voice commands act at once, some go
through the editor that draws) · extends [ADR-0197](0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md)
(the voice call gets the canvas's tools) · brief:
[`docs/evidence/specs/2026-11-19-canvas-brief.md`](../evidence/specs/2026-11-19-canvas-brief.md).

## Context

The CEO's call (ADR-0197) lets the owner talk to Fabric, and Fabric acts on sessions while they talk. What it lacked is a
surface both sides can point at: when the owner thinks aloud, the idea has nowhere to land but the transcript. The order
is a board in the sense of an investigator's wall: notes, schemes, arrows, pinned boards, pictures, links to work; the
owner works on it with the mouse, and an agent fills it fast and walks him through it.

Three questions decide the shape: which editor draws the canvas, where the canvas lives, and how the voice reaches it.

## Decision

1. **The editor is Excalidraw** (`@excalidraw/excalidraw`, MIT, 0.18.1 measured on npm 2026-11-19, React 17 to 19). Its
   file is a plain JSON scene anyone can open; its editor is complete for the mouse (shapes, arrows that bind to shapes,
   freehand, text, images later); and it has the agent's API: elements from a skeleton
   (`convertToExcalidrawElements`, labels and bound arrows included), `updateScene`, and `scrollToContent` with
   animation, which is how the designer looks at and walks through a part of the canvas.

   Weighed and not taken:

   | Engine | Licence (npm, 2026-11-19) | Why not |
   |---|---|---|
   | tldraw 5.6.1 | `SEE LICENSE IN LICENSE.md`: the tldraw licence, a paid key for production use | Fabric is AGPL-3.0 with a commercial licence (ADR-0092); a dependency whose production use needs a vendor's key cannot ship in either |
   | React Flow (`@xyflow/react`) 13.0.2 | MIT | a graph of nodes and edges only: no freehand, no free text, no shapes the mouse draws; the board the owner described is more than a graph |
   | Our own SVG canvas | ours | months of editor work (selection, binding arrows, undo, text editing) that Excalidraw already does |

2. **The canvas is its own window and its own document** (`canvas.html`, window kind `canvas`, the canvas id as the
   window's subject). The editor is about 4 MB of script and 13 MB of fonts; it loads only in this window, never in the
   main one. The page carries the renderer's policy unchanged (no network); its fonts are the app's own files
   (`window.EXCALIDRAW_ASSET_PATH`, copied into the build). Excalidraw 0.18.1 still names its `esm.sh` fallback after
   the app's own file for every font face, and the page's policy refuses each one: measured 2026-11-21 on the built
   page in Chromium and WebKit, 230 fallback attempts, every one refused by the policy and none answered, while the
   fonts drawn loaded from `excalidraw-assets/` (the brief's browser check). Nothing left the computer. The fallback is since taken out of the bundle
   (`electron.vite.config.ts#excalidrawNoFallback`): the build removes the one place the fallback is added to a font
   face's sources and the origin's name, and fails unless each was found exactly once, so an Excalidraw upgrade cannot
   bring it back unnoticed; `csp.test.mjs` reads the built scripts for the name. Measured again 2026-11-21 on the
   rebuilt page in Chromium and WebKit: 0 fallback attempts, 0 console errors (the brief's second browser check).

3. **A canvas is a file in Fabric's data folder**, `canvases/<id>.excalidraw`, Excalidraw's own format, written atomically
   (a temporary file, then a rename) as the person draws, at most 20 MB, readable by the owner alone (mode 0600). Not
   the journal: a canvas is a working surface, not a record of what happened; the decisions and tasks drawn on it stay on
   the board. Versions and attaching a canvas to a task are the next slice.

4. **The voice reaches the canvas through the call's tools, run in main** (ADR-0197's path): `canvas_open`,
   `canvas_read`, `canvas_add`, `canvas_connect`, `canvas_focus`, `canvas_highlight`, `canvas_remove`, `canvas_draw` and
   `canvas_design`. Main checks the arguments (`shared/canvas.ts#parseCanvasTool`), opens the window when it is closed,
   sends the command to it and waits at most 10 s for its answer; the window applies it with Excalidraw's API and answers
   what it drew, what it looked at, and any element it could not find by name. An element is named by the id the agent
   gave it or by its words; a name that matches nothing, or several things equally, is said back, never guessed.

5. **Simple acts run at once; a whole idea goes to the designer.** The call's model does a simple act itself (one
   note, one link, look here). «Набросай / нарисуй схему ...» goes to `canvas_design`: the **designer**, one model call
   in main (`main/canvasDesigner.ts`) that answers a diagram (nodes with their kind and group, links with labels) and a
   tour (which node to show, and what to say there). The model is Kimi K3.1 Pro on OpenRouter, the model map's planning
   model (owner's map of 2026-11-06), with Fabric's own key `fabric/prod/OPENROUTER_API_KEY` read from Observatory's
   vault for that one call; at most 2 500 tokens out and 60 s. The canvas lays the diagram out left to right by its
   links (`shared/canvas.ts#layoutDiagram`), and the call walks the owner through the tour with `canvas_focus` and
   `canvas_highlight` while it speaks. The designer is a function, not a session: it keeps nothing and runs nothing in
   the background.

6. **The call's instructions route.** Work in projects goes to the CEO (`ask_ceo`, as before); drawing, showing and
   walking go to the canvas tools; a whole idea goes to the designer.

## Consequences

- The renderer gains a third document and a fifth window kind. Every rule open to every window (`EVERY_WINDOW`) names
  the canvas too; the canvas's own channels are open to it alone and only for its own canvas.
- The app grows by Excalidraw's bundle and fonts (measured at build, stage 6 of the run).
- The designer spends on OpenRouter per sketch: a few cents at Kimi's price; the ops log records each call
  (`canvas.design`) with its tokens.
- The CEO's text console cannot draw yet: the hub's MCP tools for the canvas are a later slice, as are pictures,
  screenshots, links to tasks and sessions, versions, and the graph's nodes.

## Alternatives not taken

- **The canvas inside the CEO popup.** The popup is 520 px wide and holds the console; a board needs the screen.
- **The designer as a coding-agent session.** A session starts in seconds to minutes and holds a terminal; a sketch
  is wanted while the owner is still speaking. One bounded model call answers in seconds.
- **The call's own model draws everything.** It does the simple acts; for a whole idea a planning model lays out a
  better diagram than a realtime voice model composing JSON between sentences.
