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

Every finding below: where it was checked in the code, the test that catches it, and the fix. Tests:
`apps/desktop/test/voice-retro.test.mjs` (14 tests for the retro and 24 more from the 0.3.27 review, 38 in all; the review's plants are named in its ledger, `docs/evidence/plans/2026-11-20-release-0327-verification.md`) and
`apps/desktop/src/renderer/src/ceo/voiceCall.test.ts` («voice retro finding 1»).

**Watched red (R-006).** Each mechanism below was removed in turn and its test went red (`ℹ fail 1`), then put back:
the voice's input limit (`if (recent.length >= limit)`, findings 2-3); the journal's redaction (`clean` without
`redact`, finding 1); the sound tier of `findProject` (finding 4); the CEO start's scratch refusal (finding 5); the
voice door's `ask_ceo` refusal for the CEO's console (finding 6); `assistantSince`'s `at < since` (finding 7). For the
review's iteration 1: the confirm of a sound match (UX-1), the worktree-only work folders (ER-1), the reply window after
the CEO's own record of the ask (UX-14), the field-by-field redaction of tool payloads (DA-1), the scratch check before
a remote attach (DA-7), and `written_unconfirmed` in `consoleOpen.ts#deliverFirst` (PL-2, `console-open.test.mjs`).
Findings 8 and 10 were not planted: their tests assert answers (`near`, `stop`, the four tools) no other code gives.

| # | Finding | State | Code | Test |
|---|---|---|---|---|
| 1 | The call is not kept | fixed; a window view of older calls from disk: CO-605 (4) | `main/ceoVoiceJournal.ts`, `renderer/src/ceo/voiceCall.ts#createCall` | «finding 1: …» (2), voiceCall «voice retro finding 1» |
| 2, 3 | The voice works by hand in a shell | fixed | `main/ceoVoice.ts#voiceInstructions`, `main/ceoTools.ts` (`VOICE_INPUTS`) | «findings 2, 3: …» (2) |
| 4 | Project names heard by voice | fixed; a tie answers a choice of three, still `ok: false` so no tool acts on a guess, and never counted as a failed guess | `shared/heardName.ts`, `shared/ceoAgent.ts#findProject`, `main/ceoProjectAliases.ts` | «finding 4: …» (3), «heard names …» |
| 5 | Junk in the project registry | rule fixed, 18 records archived, the rest CO-605 (1) | `shared/scratchFolder.ts`, `main/sessionEnroll.ts`, `main/board.ts` | «finding 5: …» (2) |
| 6 | The voice types into the CEO's console | fixed | `main/ceoTools.ts` (`input`, voice door) | «finding 6: …» |
| 7 | The CEO's answer does not come back | fixed: `ceo_reply` | `main/ceoVoiceTools.ts#assistantSince` | «finding 7: …» |
| 8 | A burst of the same refused call | fixed | `main/ceoTools.ts` (`notOne`, `VOICE_REPEATS`) | «finding 8: …» |
| 9 | A start loses its first task | 8343a070, `3dbbe573` | `main/consoleOpen.ts#deliverFirst` | `console-open.test.mjs` |
| 10 | Missing voice tools | five of six; board messages searched, tasks not: CO-605 (3); a message to the owner delegated: CO-605 (2) | `main/ceoVoiceTools.ts`, `main/ceoTools.ts` (`task`, `alias`, `launches.via`) | «finding 10: …» |

## 1. The call journal

Checked: before this change the lines lived in the window's state and its `localStorage` only
(`CeoCall.tsx#useVoiceCall`, `keep`), and main logged a tool's name alone (`ceo.voice.tool`). Nothing tied a reply to
the tool calls behind it.

Fix: main opens a journal when it mints the call's secret and hands the window its `callId`; the window writes each
line the owner said and the voice answered (`voiceLine`), main writes each tool with its arguments, answer and time
(`IPC.ceoAgentVoiceTool`), and the window writes the end with the length and price it measured (`voiceEnd`), bounded in
main by the wall clock since the secret. One JSONL file a call in `<userData>/ceo/calls/` (folder 0700, files 0600),
so the CEO's console reads its calls where it works; the CEO's brief says so. (The rule as released, after the 0.3.27
review: [ADR-0197 amendment 4](../../adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#amendment-4-2026-11-20-the-call-is-kept-on-this-computer-the-voice-delegates-and-finds-a-project-by-sound).) Every text and argument passes
`shared/redact.ts` before it is written; a call stops at 2 MB with one `cut` line and still gets its end; as released, calls
older than 30 days and past the newest 200 are removed at every call and at start, only files named as calls. A person's line opens a turn and the tools after it carry
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
tries id, folder (a project's own folder first; else the deepest project holding it, or an agent's worktree a session
worked in; never a match by words; the home folder, a root or a folder holding two projects or more answers
`too-broad`), exact name or alias, folder name, words, a worktree folder's last part through the sessions working
there, then sound; a match by sound says `heard`, and the start and the project list answer
`understood_as`. Cases from the retro (a personal project's name replaced by an example): «DC», «Диззи» → dissy; «ПлейТюн» → playtune; «Саунд энджин» → sound-engine;
«фабрик» → fabric; «свитчборд» → fabric-switchboard; «обсерватория» → project-observatory.

## 5. The project registry

Checked on 2026-11-20 with `select name, repo_path from projects where status='active' and archived_at is null` on the
local stack: 137 active projects; 18 had their folder in `~/.cache`, `/private/tmp` or the system's temporary folder
(probes and scratch clones of agents), 13 in agents' worktree folders, and two names twice (one in `~/DATA` and in
`~/.cache`, another in two folders). No project's folder was the home folder: the call's «~ names several projects»
came from a match by words, every folder starting with the home folder. Enrollment made a project of
any plain folder not right under the home folder (`sessionEnroll.ts#resolveAgentFolder`).

Fix: `shared/scratchFolder.ts#isScratchFolder` (a cache or temporary folder or one inside it). Enrollment refuses such a
folder with `SCRATCH_FOLDER_MESSAGE`, and the agent's `fabric-mcp` waits longer each time, like a too-broad folder
(`fabricMcp.ts#LASTING_SCRATCH`); the CEO's start refuses it; a lookup prefers the copy outside one. A folder an existing
project already holds is still answered by that project.

Archived on this computer only, by appending `project.archived@1` through `append_event` for each row of `select id,
estate_id, name from projects where status='active' and archived_at is null and (repo_path like '/Users/%/.cache/%' or
repo_path like '/private/tmp%' or repo_path like '/tmp%' or repo_path like '/private/var/folders/%' or repo_path like
'/var/folders/%')` (actor: session 9cda1c0f, kind agent; reason: the owner's order to remove only cache and temporary records; folders on disk not touched). Fabric has
no door that archives a project (CO-574), and nothing in the product brings one back. Receipt: journal seqs 214331 to
214348, 18 events, projects `5d15ab84`, `aaa422cb`, `82807ce6`, `b997f093`, `873895a0`, `20cfc0c6`, `30360255`,
`c0107261`, `e6e98108`, `dddbcd1d`, `b37d8b24`, `77eccbb5`, `6ef2ae91`, `62f69abc`, `43799c23`, `57159828`,
`700d99d5`, `471888e0`. Each had at most its automatic onboarding task open, left as it was under the archived project.
Afterwards `select count(*) from projects where status='active' and (repo_path like '/Users/%/.cache/%' or repo_path
like '/private/%' or repo_path like '/tmp%')` printed 0, and 119 projects were active. That query does not cover
`~/Library/Caches`, `~/.npm`, `~/.pnpm-store`, `~/.Trash`, `/var/tmp` or `/var/folders` outside `/private`, which
`isScratchFolder` also counts; no record there was looked for. Another install keeps its own.

For the owner to decide (not touched): 13 projects whose folder is an agent's worktree under `~/DATA/_worktrees/`, and
one name held by two projects in two folders. The list with names went to the owner privately, not into this file (CO-605 (1); the duplicate
name is CO-497).

## 6-8. The CEO's console, its answer and refusals

Checked: `ceoTools.ts#input` refused the CEO's own console with «answer in your reply instead», words for the CEO
itself, not the voice; `ask_ceo` typed into the console and returned; a refused lookup said only «no project».

Fix: the voice door's refusal for the CEO's console names `ask_ceo` and `ceo_reply`. `ceo_reply` waits (25 s by
default, 60 at most) for the CEO's answer after the ask: the assistant turns of the CEO's Claude Code transcript written
after the ask, once its console has been quiet 4 s, redacted; `still_working` with what it said so far when the wait
ends; the console's screen when the CEO runs on another runner. A lookup that finds no one project answers `choices`
(three at most) with «ask the owner which one», or `near` (up to three names, only those close enough) with the next step; the third refusal of
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
