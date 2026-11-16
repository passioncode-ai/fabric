# The screens and protocols waves

Date: 2026-11-16. Owner: this repository's release session. Continues [the quality waves](2026-11-15-quality-waves.md).

The operator's words, 2026-11-16: «рефакторинг доски и протоколов коммуникации и запуска сессий, рефакторинг странички
агента проекта таски и доски разбора сделать хороший UI, качественный на все уровня не только на главной, пока все не
будет готово не заканчивать, волнами».

Every wave lands on `main` with `bash scripts/ci.sh fast` green, its map lane and its tests watched failing first.

## S1 · The screens stand and the screens' defects

Before this wave nothing rendered a real screen in a real browser: the tests ran in jsdom and the browser suites drew
hand-written markup. `apps/desktop/stand` builds the renderer's real screens (Агенты with an agent's page, a task, a
project, the Board by stage and «Нужны вы», Переписка) in the launch shell's stylesheets, fed one busy estate through a
fake `window.fabric` (`stand/fixtures.ts`): long paths, Russian text, many rows, Markdown bodies.
`scripts/test/screens-stand.browser.mjs` opens each screen in both themes, both languages and three widths and fails on a
page error, a call the stand does not feed, text past the window or under 11 px, and a leaked `undefined`, `NaN`,
`[object Object]`, raw `**` or a registry key (480 checks; watched failing on a note's raw Markdown).

Found by looking at the stand's shots and fixed:

| Screen | Defect | Fix |
|---|---|---|
| Agent page | A focus ring round the title on arrival | headings focused for a screen reader draw no ring |
| Agent page | «проект Atlas» beside the title «Atlas» | the project is not said twice |
| Agent page | the stage report repeated the task's brief word for word | a repeat is said as its step and note |
| Agent page | «Последний знак» broken over two lines | the facts share one label column (`subgrid`) |
| Agent page | «· прочитано 2 ч» on a line of its own under a sent message | each message is a block: words, then when sent and read |
| Agent page | the agent's own question cut to two lines | read whole on its page |
| Agent page | «как именно, не записано» | «причина не записана» |
| Agent page | the header's buttons broken over two lines in a narrow window | they keep one line and go under the title |
| Task page | a note's Markdown shown raw | `MarkdownText.tsx`: Markdown said as text, never as HTML |
| Task page | a blocker that is done listed under «Что её держит» | only unfinished blockers hold |
| Task page | four folds drawn four ways | one rule, one summary, no indent |
| Project page | a long path ran out of its card to the window's edge | card titles break a long word |
| Project page | «Сейчас» repeated its row's title | said once |
| Project page | hyphens on every second line of the narrow side column | hyphenation only in long text people wrote |
| Project page | «Как идёт работа» labels broken over three lines | each figure is its label over its value |
| Project page | «Связанные проекты» stuck to the text above | room above each part |
| Переписка | a thread without a subject named by raw Markdown | first words without the marks; the feed's preview too |
| Переписка | a body marked `text/markdown` shown raw | rendered by `MarkdownText` |
| Переписка | the check box stood above its words; the pending note ran into the filters | laid out on the filters' line |

## S2 · The board's protocol code (next)

`main/index.ts` (6 500 lines) still holds the board's IPC handlers; `agentSurface.ts` (3 400 lines) the agents' doors and
`boardDispatchRun.ts` (1 250 lines) the dispatcher. One module per concern with an explicit deps object, as
`homeView.ts` and `bugCapture.ts` were moved: behaviour unchanged, each with its own test.

State, 2026-11-16: the Board's three reads (what waits, answered, set aside) moved to `main/boardReads.ts` with
`test/board-reads.test.mjs` (a failed source is an error receipt, never an empty board; watched failing with the
receipt forced to ok). Next: `agentSurface.ts`, one factory of 2 900 lines, split along its code regions (the hub's
external door, the session registry, the work tools), one region per change.

## S3 · Launching sessions (next)

The session launch path (consoles, the dispatcher's runs, Switchboard calls) read end to end and split along the same
line; the launch dialog's states checked in the stand.

## S4 · The rest of the screens in the stand

The home, Pulse, Plan, the graph, Settings and Agent access join the stand, and their defects are fixed the same way.
