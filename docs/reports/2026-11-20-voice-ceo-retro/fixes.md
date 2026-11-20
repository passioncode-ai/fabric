---
report: fabric-voice-ceo-retro
date: 2026-11-20
project: fabric
kind: fix-ledger
---

# Fixes for the voice CEO retro, 2026-11-20

The retro: [README.md](README.md) (the owner's words, four calls, ten findings). Branch `feat/voice-retro`, stacked on
`feat/ceo-board-ux` (session 8343a070), which already carries finding 9 and the Fabric side of finding 2. The split was
agreed with that session on 2026-11-20 (agent-sync lease `VOICE-RETRO`, a direct message between the two sessions):
this branch does not touch `consoleOpen.ts#deliverFirst`, the shell refusal in `fabric_ceo_session_start` or
`first_task`.

Every finding below: where it was checked in the code, the test that catches it (each watched red with its mechanism
removed, R-006), and the fix. Tests: `apps/desktop/test/voice-retro.test.mjs` (14 tests) and
`apps/desktop/src/renderer/src/ceo/voiceCall.test.ts` («voice retro finding 1»).

| # | Finding | State | Code | Test |
|---|---|---|---|---|
| 1 | The call is not kept | fixed | `main/ceoVoiceJournal.ts`, `renderer/src/ceo/voiceCall.ts#createCall` | «finding 1: …» (2), voiceCall «voice retro finding 1» |
| 2, 3 | The voice works by hand in a shell | fixed | `main/ceoVoice.ts#voiceInstructions`, `main/ceoTools.ts` (`VOICE_INPUTS`) | «findings 2, 3: …» (2) |
| 4 | Project names heard by voice | fixed | `shared/heardName.ts`, `shared/ceoAgent.ts#findProject`, `main/ceoProjectAliases.ts` | «finding 4: …» (3), «heard names …» |
| 5 | Junk in the project registry | rule fixed, 18 records archived, list below | `shared/scratchFolder.ts`, `main/sessionEnroll.ts`, `main/board.ts` | «finding 5: …» (2) |
| 6 | The voice types into the CEO's console | fixed | `main/ceoTools.ts` (`input`, voice door) | «finding 6: …» |
| 7 | The CEO's answer does not come back | fixed: `ceo_reply` | `main/ceoVoiceTools.ts#assistantSince` | «finding 7: …» |
| 8 | A burst of the same refused call | fixed | `main/ceoTools.ts` (`notOne`, `VOICE_REPEATS`) | «finding 8: …» |
| 9 | A start loses its first task | 8343a070, `3dbbe573` | `main/consoleOpen.ts#deliverFirst` | `console-open.test.mjs` |
| 10 | Missing voice tools | fixed for five of six; one delegated | `main/ceoVoiceTools.ts`, `main/ceoTools.ts` (`task`, `alias`, `launches.via`) | «finding 10: …» |

## 1. The call journal

Checked: before this change the lines lived in the window's state and its `localStorage` only
(`CeoCall.tsx#useVoiceCall`, `keep`), and main logged a tool's name alone (`ceo.voice.tool`). Nothing tied a reply to
the tool calls behind it.

Fix: main opens a journal when it mints the call's secret and hands the window its `callId`; the window writes each
line the owner said and the voice answered (`voiceLine`), main writes each tool with its arguments, answer and time
(`IPC.ceoAgentVoiceTool`), and the window writes the end with the length and price it measured (`voiceEnd`), bounded in
main by the wall clock since the secret. One JSONL file a call in `<userData>/ceo/calls/` (folder 0700, files 0600),
so the CEO's console reads its calls where it works; the CEO's brief says so. Every text and argument passes
`shared/redact.ts` before it is written; a call stops at 2 MB with one `cut` line and still gets its end; files older
than 30 days are removed at start, nothing else in the folder. A person's line opens a turn and the tools after it carry
its number. A call whose window closed mid-call is closed in its journal by the next call (`end: not-closed`).

## 2-3. The voice delegates

Checked: `voiceInstructions` (6af0ee5c) listed the tools and said nothing about who does the work; nothing bounded
`session_input`. The shell side (a task in words is refused for `runner shell`) is 8343a070's `2fcd0996`.

Fix: the instructions say the voice does no work by hand, new work goes to the project's agent with the task in words,
a shell only on the owner's ask and without a task, input only to answer a question or pick an option. The voice door
types into one console at most 3 times in 3 minutes for a shell and 6 for an agent console, then is refused with the
next step (`session_start`, `ask_ceo`). The CEO's console door (MCP) is not limited.

## 4. Project names heard by voice

Checked: `findProject` after 8343a070's `d5b4b0cc` compared names with spaces, hyphens and underscores alike and let a
worktree copy give way. «DC» (dissy), Cyrillic names and a worktree folder still missed; a folder query matched every
project by words, since every folder starts with the home folder.

Fix: `shared/heardName.ts` folds a name into a rough sound (Cyrillic to Latin with a hard «г», a spelt acronym to its
letters' names, English spellings of one sound to one letter, a magic e, doubled letters to one) and compares by edit
distance: a key of four letters must sound the same («диск» is not dissy), one edit up to seven, a quarter beyond. A
project answers to its name, its folder, each run of its words of four letters or more, and each alias the owner gave
(`fabric_ceo_project_alias`, by voice `session_alias`, kept in `<userData>/ceo/project-aliases.json`). `findProject`
tries id, folder (the deepest project holding it, or a session's working folder, never a match by words; a folder
holding projects answers `too-broad`), exact name or alias, folder name, a worktree folder's last part through the
sessions working there, words, then sound; a match by sound says `heard`, and the start and the project list answer
`understood_as`. Measured cases: «DC», «Диззи» → dissy; «ПлейСинг» → playsing; «Саунд энджин» → sound-engine;
«фабрик» → fabric; «свитчборд» → fabric-switchboard; «обсерватория» → project-observatory.

## 5. The project registry

Checked: 137 active projects on 2026-11-20; 18 had their folder in `~/.cache`, `/private/tmp` or the system's
temporary folder (probes and scratch clones of agents), 13 in agents' worktree folders, and two names twice
(`fabric-agents-database` in `~/DATA` and in `~/.cache`, `research-agent` in two folders). Enrollment made a project of
any plain folder not right under the home folder (`sessionEnroll.ts#resolveAgentFolder`).

Fix: `shared/scratchFolder.ts#isScratchFolder` (a cache or temporary folder or one inside it). Enrollment refuses such a
folder with `SCRATCH_FOLDER_MESSAGE`, and the agent's `fabric-mcp` waits longer each time, like a too-broad folder
(`fabricMcp.ts#LASTING_SCRATCH`); the CEO's start refuses it; a lookup prefers the copy outside one. A folder an existing
project already holds is still answered by that project.

Archived (journal `project.archived@1`, actor this session, the owner's words as the reason; folders on disk not
touched): the 18 records in caches and temporary folders. Each had at most its automatic «Познакомиться с проектом»
task open. Afterwards no active project has its folder in a cache or temporary folder (`select count(*) … = 0`).

For the owner to decide (not touched, worktrees and duplicates): `b276-scratch`, `b337-neutral`, `board-r28`, `ceo`
(a CEO acceptance copy), `fabric-board-25a11adb`, `fabric-board-client`, `fd-242-probe`, `neutral-1111`,
`pc-board-7809`, `playsing-figma-inter`, `sound-engine-fix-swarm-a`, `tools`, `ws`, all under `~/DATA/_worktrees/`;
and `research-agent` twice (`~/DATA/research-agent`, `~/DATA/0xDEV/research-agent`).

## 6-8. The CEO's console, its answer and refusals

Checked: `ceoTools.ts#input` refused the CEO's own console with «answer in your reply instead», words for the CEO
itself, not the voice; `ask_ceo` typed into the console and returned; a refused lookup said only «no project».

Fix: the voice door's refusal for the CEO's console names `ask_ceo` and `ceo_reply`. `ceo_reply` waits (25 s by
default, 60 at most) for the CEO's answer after the ask: the assistant turns of the CEO's Claude Code transcript written
after the ask, once its console has been quiet 4 s, redacted; `still_working` with what it said so far when the wait
ends; the console's screen when the CEO runs on another runner. A lookup that finds no one project answers `choices`
(three at most) with «ask the owner which one», or `near` (three nearest names) with the next step; the third refusal of
one tool by voice in 30 s adds `stop`.

## 10. Missing voice tools

Compared with the CEO's console (every `fabric_ceo_*` tool and every MCP server of the computer):

| Asked | Now |
|---|---|
| search the board and tasks | `board_search`: the board's messages through the operator's read door (`commsOperatorRead.ts#search`). Tasks are not searched by voice: tasks are per project, and the operator's door reads none across projects. |
| the computer's state | `machine_status`: free disk, load, memory, uptime, consoles and Claude Code sessions |
| a message to the owner | delegated: the voice holds no messaging credential; it asks the CEO (`ask_ceo`), whose console sends through the personal communicator |
| what changed since the last call | `recap`: sessions started and ended since the previous call's end in the journal, else the last 24 hours |
| stop its own hung starts | `session_launches` with `via: voice`, then `session_stop` |
| did a started session take its task | `session_task` (`fabric_ceo_session_task`): `first_task` and the screen's last lines |
