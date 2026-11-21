# One index of everything the agents did, and Fabric's knowledge graph on it

**Status:** design and spec, 2026-11-19; built in the same run (branch `feat/knowledge-graph`, Fabric task `57781f0d`).
Decisions: [ADR-0199](../../adr/0199-the-ceo-navigates-with-direct-tools-over-one-index-not-a-router-agent.md) (no
router agent) and [ADR-0200](../../adr/0200-the-estate-index-and-graph-live-in-fabrics-core.md) (where the index lives).

**Source.** The operator's words to the CEO agent, 2026-11-19, relayed verbatim in the task: «Бэклог: сделать так, чтобы
можно было искать задачи по всем сессиям и проектам», «Продумать и реализовать векторную базу знаний для всего Fabric:
связанный граф задач, действий, данных … Цель: по графу легко бегать и искать связи, что к чему относится», «нужен поиск
по всем сессиям и транскриптам, список проектов с путями, быстрый запуск сессии по имени папки без ошибок». The CEO's
observations of the same day are the regressions this closes: `fabric_ceo_session_resume` answered «Switchboard has no
record of that session» for a session that ran in a Fabric console; after a reload Fabric's consoles left
`fabric_ceo_sessions`; a transcript was found only by `grep` over `~/.claude/projects`, which did not finish in two
minutes; `fabric_ceo_projects` matched only by substring while one name named several projects.

**Samples followed, not copied.** Sound Engine's knowledge base (`~/DATA/sound-engine/Tools/kb/kb.py`, `quotes.py`,
`vectors.py`: SQLite FTS5, a stemmed BM25 ranking, a trigram ranking, local vectors through Ollama, reciprocal rank
fusion with k = 60, verbatim quotes at `path:lines`, `degraded` instead of a failure) and the agents database's
`hybrid-retrieval` pattern (R33 O17, decision D-78), which is that module's stdlib port. Fabric is TypeScript, so the
engine here is a port into `node:sqlite` (Electron 44 carries Node 24.18.1, whose SQLite has FTS5 and the trigram
tokenizer: checked with `ELECTRON_RUN_AS_NODE=1 Electron -e "…create virtual table t using fts5(x, tokenize='trigram')"`).

## 1. What was measured before the design (2026-11-19, this Mac)

| What | Measured |
|---|---|
| Claude Code transcripts | `~/.claude/projects`: 21 GB, 5 344 `.jsonl` files (`du -sh`, `find … -name '*.jsonl' \| wc -l`) |
| Switchboard homes | `~/Library/Application Support/ai.passioncode.fabric-switchboard/runtimes`: 695 MB, one Claude home per account |
| Codex sessions | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`: 2.1 GB, 105 files |
| Fabric's projects | 135 active; three names held twice (`fabric-agents-database`, `fabric-board-client`, `research-agent`), 30 folders under `~/.cache`, `/private/tmp`, `/private/var/folders/…/T` or `_worktrees` (`select name, repo_path from projects where archived_at is null`) |
| Observatory's projects | 363 in `registry/projects.json`, each with `organization` and `local_folders` |
| A phrase over the transcripts with `grep -rl` | 4 s with a warm file cache; the CEO's cold run did not finish in 120 s |
| What links a Fabric console to its Claude session | `session.turn.observed@1` carries `session_id` (Fabric's) and `runtime_session_id` (Claude's), written by the session hooks on every turn (`main/workTools.ts#fabric_session_observe`); `terminal.opened@1` carries the console's project, folder and runner (`main/pty.ts`) |

## 2. What the person and the CEO get

| Need | Answer |
|---|---|
| Find a session by what was said in it | One field in the Fabric window (the search panel's new group «Везде») and one MCP door for the CEO, `fabric_knowledge_search`: Russian and English word forms, identifier parts, and meaning when a local model serves vectors. Every hit names its session id, project, folder, context, a verbatim passage at `path:lines` and the command that continues it |
| Projects with their folders | `fabric_ceo_projects` answers each project once more with its role: `canonical`, `duplicate` (of which), `worktree` (of which repository) or `temporary` (`~/.cache`, `/tmp`, the system's temporary folders); a search by name prefers the canonical one |
| Start a session by a folder's name | `fabric_ceo_session_start` takes a name with a typo or a part of a path: one clear match starts, several answer one list with each folder and role, temporary and duplicate ones never win over the canonical |
| Continue a console after Fabric restarted | `fabric_ceo_session_resume` with the console's id (or its Claude session id) reads the journal for the console's project, folder, runner and Claude session id and opens a Fabric console with `claude --resume <id>` (Codex: `codex resume <id>`). Switchboard is asked only for a session Fabric never ran |
| See what relates to what | `fabric_knowledge_execute` with `graph.neighbours` (N steps from a node) and `graph.path` (the shortest chain from A to B); the window's «Связи» screen draws the same neighbourhood |

## 3. The index

### 3.1 Where it lives (ADR-0200)

`userData/estate-index/index.sqlite`, opened with `node:sqlite` in the main process. It is derived: deleting the file
loses nothing, the next pass rebuilds it. The journal stays the spine (ADR-0014); nothing reads the index to decide a
write.

### 3.2 Documents

One table `docs` holds every searchable unit, one schema for every source (the `hybrid-retrieval` rule that every chunk
carries kind, path, lines, date and title):

| Column | Meaning |
|---|---|
| `id` | stable: `claude:<session>#<first line>`, `task:<uuid>`, `commit:<repo>@<sha>` … |
| `kind` | `session`, `turn`, `task`, `note`, `message`, `console`, `project`, `commit`, `document` |
| `source` | `claude`, `codex`, `fabric`, `git` |
| `node` | the graph node it belongs to (a turn belongs to its session) |
| `title`, `body` | what is searched; `body` is the verbatim text the passage quotes |
| `at` | ISO time of the newest part |
| `folder`, `project` | the folder it happened in, and the canonical project name of that folder when known |
| `context` | `personal` or `org:<id>` (§3.6) |
| `session_id`, `runtime`, `resume` | for sessions and turns: the id, the runner and the command that continues it |
| `path`, `line_start`, `line_end` | the file and its lines the passage stands at (a transcript's JSONL lines; null for a database row) |
| `digest` | sha256 of `body`: a quote is checked against it, a vector cached by it |

Two FTS5 tables index it: `docs_words` over the stemmed tokens (Fabric's own Russian and English stemmer,
`shared/boardSearch.ts#terms`, the one `fabric_board_search` uses, so a word means the same in both doors) and
`docs_tri` over the raw title and body with the trigram tokenizer (identifier parts, word forms the stemmer splits
otherwise, a pasted fragment). `vectors(digest, model, vec)` holds the meaning half when a local model serves it.

### 3.3 Sources and how each is kept current

| Source | Read | Incremental |
|---|---|---|
| Claude Code transcripts | every `projects/*/*.jsonl` under `~/.claude` and each Switchboard home | a file is re-read only when its size or mtime changed, from the byte offset it was read to (a transcript is append-only); `ai-title` names the session; typed prompts and the assistant's text become turns of at most 1 800 characters with their JSONL lines; tool results are skipped (they are most of the 21 GB and say little a person searches for), and so are subagents' transcripts (`<id>/subagents/*.jsonl`, CO-600) |
| Codex sessions | `~/.codex/sessions/**/rollout-*.jsonl` | the same; `session_meta` gives id and folder, `response_item` messages of the user and the assistant become turns; injected instructions (text starting with `<` or `# AGENTS.md`) are skipped |
| Fabric consoles | `terminal.opened@1` and `session.turn.observed@1` | by journal `seq` above the last one read |
| Tasks, notes, board messages, projects | Fabric's own tables, every project of the estate (the operator's door) | tasks and notes by `updated_at`/`created_at` above the last pass; board messages through the operator's thread door, newest 500 threads |
| Commits | `git log` of every canonical project folder, 120 days, at most 400 a repository | when the repository's HEAD changed |
| Documents | a canonical repository's tracked Markdown at HEAD: ADRs and decisions first, then specs and designs, briefs (README, AGENTS, CLAUDE, CHANGELOG, HANDOFF), the rest of `docs/`; at most 300 files of 300 KB, cut at headings into sections of 2 400 characters with their lines (`shared/estateSearch.ts#sections`); an ADR file is also the node `record:ADR-NNNN` | with the commits, when HEAD moved |
| Decisions and facts | Fabric's memory facts (decision, finding, trap, note); a decision is a node of its own | by `seq` |

A pass runs at start (after the stack is up), every five minutes, and on demand (`index.refresh`). One pass at a time; a
source that fails is named in the pass's `degraded` and the others still land. `index.rebuild` deletes the file and
runs a pass. A pass stops reading transcripts after a time budget (60 s at start, 20 s later) and goes on at the next one,
so a first index of 21 GB never holds the main process: the read is chunked and yields between files.

### 3.4 Search

`search(query, {kinds, project, context, limit})`: the words ranking (FTS5 `bm25` over stems), the trigram ranking
(FTS5 trigram `MATCH` of the query's fragments of three or more characters) and, when vectors exist, the meaning ranking
(cosine over the stored vectors), fused by reciprocal rank with k = 60. Each hit says which rankings found it
(`via: ["words","trigram"]`), carries a passage of about 300 characters around the first match, its `path:lines`, its
digest, and the fields of §3.2. A missing model is `degraded: ["vector-unavailable"]`, never a failure; an empty answer
says `matched: false` and is never read as «it did not happen». The CEO's query never leaves the machine: vectors come
only from a local Ollama (`embedding-policy/1`).

### 3.5 Projects without duplicates

`catalogue(projects)` gives every Fabric project a role from its folder alone: `temporary` when the folder is under
`~/.cache`, `/tmp`, `/private/tmp`, `/private/var/folders` or `/var/folders`; `worktree` when it is a linked Git
worktree (`.git` is a file) or under a `_worktrees` or `.claude/worktrees` folder, `of` naming the repository it belongs
to when Git says; `duplicate` when another project holds the same name and is the canonical one; `canonical` otherwise.
Among projects of one name the canonical one is the non-temporary, non-worktree folder, then the most recently active.
A name search prefers canonical over worktree over duplicate over temporary; an exact folder or id always wins.

### 3.6 Visibility: contexts never mixed

Every document carries its `context`, read from Observatory's registry by its folder: a project of the person's own
organization (the one Observatory's `config/organizations.json` marks as its default) is `personal`, of any other
organization `org:<id>`, so an organization's work and a partner's never mix with each other or with the person's; a
folder no project claims is `personal`. No organization's name is written in Fabric's code (`shared/estateSearch.ts#contextOf`).
The CEO is the operator's own agent on his own machine, so it sees every context, and every hit says which one it is in;
`context` narrows a search to one. When Fabric's contexts (CO-422) land, `org:<id>` maps to the estate of that
organization and a project session's search is narrowed to its own, as `fabric_board_search` already is.

### 3.7 Quotes that can be checked

`quote.check` (an operation of the execute door) takes claims `[{quote, doc}]` and keeps a claim only when its quote
(12 to 600 characters) stands verbatim in the cited document's body and the document's digest still matches; a claim
adding a number its quote lacks is refused with its reason. This is the base's `quotes.py` rule, ported.

## 4. The graph

### 4.1 Nodes and edges

Nodes live in `nodes(id, kind, label, at, attrs)`, edges in `edges(src, rel, dst, at, evidence)`, in the same file.

| Node kind | Id | From |
|---|---|---|
| `project` | `project:<fabric id>` | Fabric's projects, with folder and role |
| `task` | `task:<uuid>` | Fabric's tasks |
| `session` | `session:<runtime id>` (Claude, Codex), `console:<fabric id>` | transcripts, `terminal.opened@1` |
| `request` | `message:<uuid>` | board messages |
| `act` | `act:<seq>` | the journal's `effect.*`, `work.claimed@1`, `work.released@1`, `task.moved@1` |
| `commit` | `commit:<sha>` | `git log` |
| `document` | `doc:<repo>/<path>` | a file a commit or a turn names (ADRs and specs first) |
| `decision` | `decision:<fact id>` | memory facts of kind decision |
| `agent` | `agent:<kind>:<id>` | the journal's actors (an agent session, the system), by role, never a person's name |

| Edge | Meaning | Evidence |
|---|---|---|
| `belongs-to` | a task, session, console, commit, request to its project | the row's project, the session's folder |
| `spawned` | a task split off another | `task_links` rel `spawned` |
| `blocks` | a task blocks another | `task_links` rel `blocks` |
| `did` | a session claimed or released a task; an actor did an act | `work.claimed@1`, `work.released@1` |
| `ran-as` | a Fabric console ran as a Claude session | `session.turn.observed@1` |
| `changed` | a session's turn recorded a commit as HEAD | `session.turn.observed@1` `head` |
| `cites` | a commit, message or turn names a task (`57781f0d…`), a `CO-NNN` row, an ADR or a document | the text |
| `waits-on` | a task waits on a question or a request | `question.asked@1` `blocks` |

### 4.2 Update and rebuild

The same pass that writes documents writes their nodes and edges (an upsert by id; an edge is unique by `src, rel,
dst`). A rebuild drops the file. Edges point at nodes that may not exist yet (a commit named before its repository was
read): `graph.neighbours` answers such a node as `known: false` rather than dropping the edge.

### 4.3 Walking it

`graph.neighbours(node, depth ≤ 3, limit ≤ 200, rels?)`: breadth-first over edges both ways, each neighbour with its hop,
the edge that reached it and the edge's evidence. `graph.path(from, to, depth ≤ 6)`: the shortest chain, or
`found: false` with how far it looked. `node.get(id)`: a node with its documents and edge counts.

## 5. The doors

Two MCP tools on the CEO's own hub server (registered beside the session tools, `agentSurface.ts#serverFor`), and the
same as the voice call's function tools (`knowledge_search`, `knowledge_execute`):

| Tool | Does |
|---|---|
| `fabric_knowledge_search` | §3.4, over every source; `kinds`, `project`, `context`, `limit` |
| `fabric_knowledge_execute` | one operation by name: `graph.neighbours`, `graph.path`, `node.get`, `quote.check`, `projects.list`, `index.status`, `index.refresh`, `index.rebuild`; `operations: true` lists them with their input |

The session tools stay as they are, made exact (§2). The window's search panel gets the group «Везде» (method `ranked`,
the only group whose order is a relevance rank, said in its header) and the screen «Связи» draws a node's neighbourhood.

## 6. What is not done here (CO-600)

The organization's knowledge graph (`knowledge-graph.passioncode`) reads Fabric through these doors as a connector, never
by copying the index: asked on the board, not built from here. Agents and services, keys by name and people by role as
nodes beyond the journal's actors; vectors embedded in the background at scale (a first pass embeds at most 2 000
passages); a project session's own narrowed door (it waits for CO-422).

## 7. Measured on this Mac (2026-11-19, the run's evidence)

A pass over the real sources, the database read with `psql` (the same rows the store answers), the index file in the
scratchpad: the first pass 87 s (8 221 documents from Fabric's rows, 628 transcripts, 24 192 commits), three more to read
every transcript (776 sessions, 11 564 transcript passages), then 11 to 21 s for a pass over what changed; 56 812
documents, 78 350 edges, about 470 MB. Queries on it (`EstateIndex.search`, no vectors): «Задачи от владельца (CEO-агенту
Fabric» 1 070 ms, finding the sessions that hold the phrase with their continue commands; «роутер-навигатор» 5 ms;
«fabric_ceo_session_resume» 83 ms; «голосовой звонок CEO» 10 ms. With 400 passages embedded by `embeddinggemma`, a query
by meaning took 423 ms and answered `vectors-partial`.

After documents and decisions joined (the operator's addition of 2026-11-19, ~20:35: «весь проект весь фабрик весь
харнес был граф векторный векторный поиск граф по данным познаниям»): four passes on a fresh file (138, 127, 37, 13 s),
179 510 documents, 109 221 edges, about 880 MB with contentless FTS tables (2.5 GB with a text copy in each). Searches,
warm: «Задачи от владельца (CEO-агенту Fabric» 411 to 576 ms, «the journal is the spine» 212 to 302 ms (ADR-0014's own
sections first), «fabric_ceo_session_resume» 111 to 139 ms.
