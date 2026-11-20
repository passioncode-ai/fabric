# The launch journal, the agents' one-press console and sessions outside Fabric

Date: 2026-11-19. Source: the owner's order to the CEO agent, board request `eef5abeb` (thread `e9deb1c1`), points 1 to 4,
and his words in the session of this work the same evening («либо новую, либо последнюю, две кнопочки в списке
проектов»; in Агенты a new session for a chosen project, running agents first, then the rest). Point 5 (the vector
graph) is session `0ec7dd36`'s. The restore of consoles after a restart (board request `508c1048`) is built on this
journal and comes in the next part.

## 1. What changes

| Before | After |
|---|---|
| Nothing on disk said who started a console, from where, in which branch, or which Claude session id it ran | Every console Fabric opens is a line in the launch journal (§2 to §4); the CEO reads it (`fabric_ceo_launches`) and the agent's page shows it |
| `fabric_ceo_sessions` answered `machine_sessions.unread: "Command failed: …/switchboard --json sessions --rows"` and saw nothing outside Fabric | The failure is named (deadline, signal, missing program), a read is tried once more, and when Switchboard is still unread the Claude Code processes are read from Claude Code's own files (§5) |
| A press on an agent in the left column opened its page; its line said «Работает» | A press opens its console when Fabric holds it; the line says «Fabric · терминал» or «терминал вне Fabric», its runner and its branch (else its folder); the page is the small button beside |
| No way to close a session from its page | «Закрыть сессию» on the page, asked once more, the person's own stop |
| Sessions outside Fabric showed only through Switchboard, read-only | «Сессии вне Fabric» on Агенты: last messages, «Продолжить в Fabric», «Закрыть» |
| A project's row only opened the project | «＋» starts a new session with the project's agent; «↻» continues its last session that is not running, wherever it was started |

## 2. The record

One JSON line per event (`apps/desktop/src/shared/sessionLaunches.ts#parseLaunchLine`), version `v: 1`:

- `opened`: the session id, project, folder, branch (git, 2 s), runner and launch option, program (no arguments), who
  asked (`by`: person, ceo, routine, chain, answer, board-dispatch, restore, fabric), through what (`via`: screen,
  console, voice, restart, task, board, switchboard), the reason given (redacted, 1 000 characters), the parent
  session (the CEO's console for the CEO's starts), task and board request when known, the machine, Fabric's pid and
  version, the console's pid.
- `runner-session`: the runner's own session id, read from Claude Code's `<config>/sessions/<pid>.json` 2, 6, 20 and
  60 s after the start and every 5 minutes while it runs (it changes after `/clear`); written once per change.
- `stop-asked`: the person or the CEO asked it to stop.
- `ended`: the exit code, the signal and the end: `exited`, `stopped` (asked), `crashed` (a signal nobody asked for),
  `app-quit` (Fabric quitting, unless a stop was asked first).

A launch with no `ended` line ran when Fabric last wrote: it is running, or it was cut by a crash or a power cut. The
restore of `508c1048` reads exactly those, and `app-quit` ones.

## 3. Who started it

The caller of a launch runs it inside `withLaunchOrigin` (`apps/desktop/src/main/launchOrigin.ts`), an
`AsyncLocalStorage`; `PtyManager.open` reads it when it writes the line (`apps/desktop/src/main/pty.ts#setLaunchSink`).
A launch nobody annotated is written as `fabric`'s own, never guessed as the person's. Annotated today: the person's
console launch (`terminal.open`, `person`/`screen`), a task's launch (`person`/`task` for the person's, else the
trigger), «start it again» from История (`person`/`restart`), the CEO's `fabric_ceo_session_start` (`ceo`, `console` or
`voice`, its reason, its console as the parent), «Продолжить последнюю» and «Продолжить в Fabric» (`person`/`screen`).

## 4. On disk

`<userData>/launches/launches-YYYY-MM.jsonl` (`apps/desktop/src/main/sessionLaunches.ts#createLaunchJournal`), the
folder 0700 and the files 0600, appended in order and never rewritten; files older than 13 months are removed at
start, nothing else in the folder. A read takes the last two months, a file over 8 MB from its tail. A failed write
is said once per kind in the operations log (`launches.write`) and never stops a console. Quitting waits for the
queued lines (`flush`) before the agent surface stops.

## 5. When Switchboard does not answer

`execFile` says only «Command failed: …» for a child that gave no exit code. `switchboardFailure`
(`apps/desktop/src/main/switchboardSessions.ts`) names it: not answering within the deadline, ended by a signal (the
app's binary being replaced by its own update), the program missing, an output over the buffer (now 16 MB; 445 rows
measured 184 KB). The deadline is 30 s, not 10 (Switchboard measured, in board thread 3ca40854, a median of 28 s for its slow answers
at a load average of 120). A read (`--json sessions …`, `--json recovery`) is tried once more a second later with the
same deadline; an act (`sessions end`, `continue`) never, since it may have acted. Measured on 2026-11-19: the same call
answers in 0.1 s with exit 0 from a full, a minimal and an empty environment, so the CEO's failure was a killed call,
not a refusal; no request to Switchboard's project was needed.

Without Switchboard the machine's sessions come from Claude Code's own `<config>/sessions/<pid>.json` files
(`apps/desktop/src/main/diskSessions.ts#liveClaudeSessions`, the person's home and every Switchboard home; a file whose
process is gone is skipped). The same reading backs «Сессии вне Fabric» (`apps/desktop/src/main/machineSessions.ts`):
a close sends SIGTERM only while the process still names that session (a pid can be reused); «Продолжить в Fabric»
stops it, waits up to 10 s for it to end (never SIGKILL), then opens a Fabric console in its folder with
`claude --resume <id>` and the Claude home it ran in, in the project that holds the folder or the repository it is a
worktree of (`apps/desktop/src/main/projectResume.ts#projectForFolder`).

## 6. Not here yet

- The restore of consoles after a restart (`508c1048`): the next part, reading §2's open and `app-quit` launches.
- Resume for Codex, Kimi Code and Hermes: their session ids are not read yet; «Продолжить последнюю» finds Claude Code
  sessions only.
- The board dispatcher's runs are Switchboard's launches and are not written here (`by: board-dispatch` is reserved).
- The project page's centre («по центру причесать», the owner, 2026-11-19) is not changed in this part.
