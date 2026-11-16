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

Then the hub's external door (ADR-0115 §1) left `agentSurface.ts` with the only state it keeps (its budgets, in-flight
admissions and recently known bearers): `main/externalIngress.ts` (`ExternalIngress#handle`), and the body reading and
the JSON refusal every door shares in `main/requestBody.ts`. The surface hands it every bearer that is not a session's
and re-exports what tests and callers imported from it. `agentSurface.ts`: 3 397 lines to 3 127. Checked by
`test/hub-surface.test.mjs` (16 tests; watched failing with the admission slot never given back: 6 fail).

Then Agent access's three tools (`fabric_access_list`, `_decide`, `_revoke`, CO-506) left `serverFor` for
`main/relayedAccessTools.ts`, with `test/relayed-access-tools.test.mjs` that needs no database (3 tests through the
surface; watched failing when «asked by you» compared the session id instead of the binding: 1 fail).
Then the project's own tools (`fabric_project_profile`, `fabric_project_folder_attach`, `_detach`) left for
`main/projectTools.ts`, with `test/project-tools.test.mjs`, no database (2 tests; watched failing with the folder sent
for the estate instead of the project, and with the profile written as the person's: 1 fail each).
Then the floor's two tools (`fabric_effect_request`, `fabric_effect_report`, ADR-0050) left for `main/effectTools.ts`,
and the reference check every tool shares for `main/agentReference.ts`, with `test/effect-tools.test.mjs`, no database
(3 tests; watched failing with the grant looked up without the project: 1 fail; `test/agent-http-ingress.test.mjs`
watched failing with the target's secret check dropped). Then the owner's questions (`fabric_question_ask`,
`fabric_question_check`) left for `main/questionTools.ts`, with `test/question-tools.test.mjs`, no database (3 tests;
watched failing with a foreign task let through as blocked: 1 fail). `agentSurface.ts` now 2 699 lines. `serverFor`
still registers 19 tools inline; the next group is the task tools.

## S3 · Launching sessions (next)

The session launch path (consoles, the dispatcher's runs, Switchboard calls) read end to end and split along the same
line; the launch dialog's states checked in the stand.

State, 2026-11-16: the person's launch of a console left `index.ts`'s `terminal.open` handler for
`main/consoleOpen.ts` (`createConsoleOpen`): the folder lock (CO-236), the place the agent starts in (UXA-C04), the
fallback order's walk (ADR-0125) and the first instruction's delivery with the attach claim it holds until then
(CO-229). `test/console-open.test.mjs` (5 tests, no database; watched failing with the claim released before the
instruction was delivered, and with the folder lock skipped: 1 fail each); `runner-fallback`, `pty-launch-failure`,
`chain-launch-failure` and `managed-launch` still green. Then the person's «start a task» (`tasks.start`) left for
`main/taskStart.ts` (`createTaskStart`): the fallback choice resolved to a runner before the task exists (ADR-0125), the
setup preset's surface (0.3.3 verification), a known id brought forward or admitted again. `test/task-start.test.mjs`
(5 tests, no database; watched failing with the fallback choice recorded instead of the runner: 1 fail);
`task-retry` still green. `index.ts` 6 345 lines to 6 298. Then the task form (`Tasks.tsx`) joined the stand with the
fallback order configured (1 120 checks): its presets read as plain lines of text and are now quiet chips. The stand
showed that `useFallbackChoice` reads `settings.read` and `terminal.fallback` without a null check; main always
answers both, so that stays as it is. An English pass over the stand found the task notes breaking a long address at a
syllable with a written hyphen (`seg-ment`), from W6's hyphenation of people's text: that text now breaks where it must
with nothing added. The dispatcher (`boardDispatchRun.ts`) is already one factory with explicit deps, regions and its
own test, and the board's IPC is one line per call over `commsRead`; neither is split further in this wave.

## S4 · The rest of the screens in the stand

The home, Pulse, Plan, the graph, Settings and Agent access join the stand, and their defects are fixed the same way.

State, 2026-11-16: Pulse, История and Plan joined the stand (720 checks). Fixed from their shots:

| Screen | Defect | Fix |
|---|---|---|
| Pulse | an event's «Основание события» louder than the event | a quiet fold |
| Pulse | «7 дн.» and «28 дн.» did not show which was on | a pressed button says so, here and on every screen |
| История | a giant uppercase muted title where every other screen names itself in the top bar | the heading kept for focus and a screen reader |
| История | «В этой строке нет объекта, к которому она относится.» printed on every agent row | said to a screen reader and on hover |
| История | the search's hint cut | the search takes the rest of the line |
| План | the project named by its folder (`atlas-desktop`) in the trail and the project buttons | its display name |
| План | «Пока ничего не запланировано» twice in one card | once |

Then the home and the graph joined it (880 checks):

| Screen | Defect | Fix |
|---|---|---|
| Home | a question naming a long path cut at the card's edge | the words break the path |
| Graph | a heading twice every page's size | the size of an agent's page heading |
| Graph | the columns pressed against a square frame | the panels' radius and room inside |
| Graph | «Связи списком» stuck to the canvas | a gap between them |

Then Agent access and Settings joined it (1 040 checks):

| Screen | Defect | Fix |
|---|---|---|
| Agent access | the page titled by an 11 px uppercase kicker | the size of every page's heading |
| Agent access | a request was seven lines of grey of one weight: who asked, what and until when lost among them | who and until when on one line, what is asked in bold, the agent's reason as a quote, the floor in sight, what changes after an answer one fold away («Что изменится после ответа», checked by the copy engine in both locales) |
| Settings | the groups' names fainter than the cards they hold | the eyebrow every screen uses |
| Settings | the power and board-service notes a 42ch column beside full-width hints | the card's width |

S4 is done: every screen of the left column renders in the stand under the gate.
