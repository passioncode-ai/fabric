# ADR-0199: The CEO navigates with direct tools over one index, not a router agent

**Status:** accepted · 2026-11-19 · Fabric task `57781f0d` · answers the operator's question of 2026-11-19, relayed by the
CEO agent verbatim: «Вопрос на подумать: нужен ли отдельный роутер-навигатор или достаточно дать агенту правильные
инструменты напрямую» · builds on [ADR-0197](0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md)
(the CEO's session tools) · the index is [ADR-0200](0200-the-estate-index-and-graph-live-in-fabrics-core.md).

## Context

The CEO navigates all day: find where something was said, find the project a name means, start or continue a session in
it. Two shapes were open: a separate router agent (a model with its own context that takes «find X, open Y» and calls
tools), or a few exact tools the CEO calls itself. The CEO's own position was the second, with two or three tools over
one index; this record checks it against a measurement.

## Measurement

The CEO's own transcript of 2026-11-19 (`~/.claude/projects/-Users-sshlg-Library-Application-Support--fabric-desktop-ceo/e6675d55-8924-4129-935c-f78d52680842.jsonl`,
each tool call paired with its result by `tool_use_id`, times from the lines' timestamps) holds one whole navigation
task: after a reload, find the sessions it had started and continue them.

| Step (before) | Calls | Time |
|---|---|---|
| `fabric_ceo_sessions {include_ended, project: fabric}`: the reloaded consoles are gone | 1 | 0.2 s |
| `grep -l "сказано CEO-агенту Fabric 2026-11-19" */*.jsonl` over `~/.claude/projects` | 1 | 120.4 s, cut by the tool's limit |
| `ls`, a Python read of three transcripts, `head` of one | 4 | 1 s |
| `fabric_ceo_session_resume`: «Switchboard has no record of that session» | 1 | 0.2 s |
| the workaround: `fabric_ceo_session_start {runner: shell}` and typing `claude --resume <id>`, twice; two more `ls` | 6 | 1.5 s |
| three new sessions started over again, not continued | 3 | 0.6 s |
| **in all, 18:29:37 to 18:33:27** | **16 calls** | **3 min 50 s**, and three of the sessions lost their context |

The same task with the tools this run ships, on this Mac's index (56 812 documents, 776 transcripts, 2026-11-19):

| Step (after) | Calls | Time |
|---|---|---|
| `fabric_knowledge_search {query: "Задачи от владельца (CEO-агенту Fabric"}`: every session that holds the phrase, with its id, folder and continue command | 1 | 1.07 s cold, 5 to 83 ms for shorter queries |
| `fabric_ceo_session_resume {session_id}` per session: a Fabric console with `claude --resume <id>` in its project, also for a console from before the reload | 1 each | under 1 s each |
| **in all, three sessions** | **4 calls** | **about 4 s**, every session continued as itself |

A router agent cannot beat this: it calls the same two tools, and adds one model turn per request on top (its own prompt,
its own context, a second place where «which project did he mean» is decided). Its only gain would be to hide the
choice of tool, and the CEO already picks between two well-described doors without error in the transcript above (every
miss there was a missing tool, not a wrong choice).

## Decision

1. **No router agent.** The CEO navigates with direct tools: `fabric_knowledge_search` (find anything), the session
   tools of ADR-0197 made exact (`fabric_ceo_projects` with roles, `fabric_ceo_session_start` by a folder's name,
   `fabric_ceo_session_resume` that continues a Fabric console as itself after a restart), and
   `fabric_knowledge_execute` for the graph's walks. Three verbs: find, start, continue.
2. **One index under them** (ADR-0200), so «find» answers the same thing whether the CEO, the person in the window or a
   voice call asks, and a name means one project everywhere (`shared/estateSearch.ts#matchProject`).
3. **Ambiguity is answered, not guessed.** A name several canonical projects carry returns one list with each folder and
   role; a temporary, duplicate or worktree folder never wins over the canonical one.

## Consequences

- The CEO's prompt grows by two tool descriptions, not by an agent; the voice call gets the same two as functions.
- When a navigation task again takes more than a handful of calls, the fix is the missing tool or field, recorded the
  same way (the transcript, the count), not a router.
- Revisit if the CEO's tool list passes the size where its choice degrades measurably (the operator's two-door rule,
  2026-11-18, caps a server at search and execute plus at most three measured direct tools).
