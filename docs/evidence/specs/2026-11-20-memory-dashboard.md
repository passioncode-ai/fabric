# Memory: Fabric's knowledge base as a section of its window

**Status:** design, 2026-11-20 · Fabric task `34c42a6e` · scenario [SCN-190](../../ux/scenarios.md#scn-190-see-what-fabric-knows-about-every-project-and-where-each-answer-comes-from),
screen [SCR-92](../../ux/screens.md#scr-92-memory) · builds on [ADR-0200](../../adr/0200-the-estate-index-and-graph-live-in-fabrics-core.md)
and [the estate index and graph](2026-11-19-estate-index-and-graph.md) · readiness measured in
[the 2026-11-20 report](../../reports/2026-11-20-memory-readiness/README.md).

The owner, 2026-11-20, in the CEO window (session 53895bdc), verbatim: «Эта база должна быть внутри. у нас доступно в
виде давай какой-нибудь там brain или memory, давайте ее называем memory это будет и это memory должна у нас
рендерится вот в виде дашборда прям фабрики, вот в том также рендерится хорошо как рендерится сейчас вот типа тот у
нас brain типа для sound engine». And the same evening, the order for this run: overview, a graph of organizations and
projects, search with citations, freshness, what changed; one shared module, not a copy of Sound Engine's code; two MCP
doors, search and execute (R33 O17).

## 1. What the person gets

One place in the left column, «Memory», under «Переписка». It opens a dashboard of everything the index holds:

| Part | Shows | Read from |
|---|---|---|
| Header | how many documents, projects, sessions; when the index last read; the first index's progress while it runs | `memory.overview` |
| Freshness | one chip per source (sessions, Fabric rows, board, commits and documents, vectors): when it was last read, and its state: fresh, catching up (what is left), not read (the reason) | `memory.overview` `sources` |
| Graph | organizations and their projects, WebGL (sigma 4 over graphology, ForceAtlas2), the same open engine Sound Engine's brain draws with and none of its code; an organization is a hub in its colour, a project a node sized by what the index holds of it; a line between two projects is the board's requests between them, its weight the count; hover lights a node's neighbours, a press opens its card | `memory.graph` |
| Project card | the project's counts by kind, its last activity, its newest changes, «Искать в проекте» | `memory.graph`, `memory.changes` |
| Search | the hybrid search of ADR-0200 with each hit's verbatim passage, `path:lines`, how it was found; «Проверить цитату» runs `quote.check` on the passage and marks it verified or says why not | `fabric_knowledge_search`, `quote.check` |
| What changed | the last 24 hours (or 7 days) by project: new sessions, tasks, board messages, commits, documents and decisions, newest first | `memory.changes` |
| The same as text | under the drawing, the organizations and their projects with their counts: nothing is only on the drawing | `memory.graph` |

States, each its own (never a zero): the index not open (its reason), the first index still reading (what is left),
vectors unavailable (the search is by words), a source not read (its reason), nothing found (said as «not found in what
is read», never «did not happen»), a graph with no WebGL (the text list alone, said).

## 2. One module, three callers

The operations live once, beside the index (`main/memoryRead.ts`, pure shaping in `shared/memory.ts`), and are run by
name through the existing execute door (`main/knowledgeTools.ts#createKnowledgeOperations`):

| Operation | Input | Answer |
|---|---|---|
| `memory.overview` | none | totals by kind, source and context; projects with documents; vectors; the file's size; each source's last read and state; the last pass |
| `memory.graph` | `context?` | organizations (contexts, with the names Observatory gives them) and projects (counts, last activity, role), the edges project to organization and project to project (board requests, counted) |
| `memory.changes` | `hours` 1 to 168, `project?` | per project and kind, what the index got in that window, at most 8 newest each |

Three callers, the same operations: the window (IPC `memory:run`, an allow-list of these, `quote.check` and the
search), the CEO's MCP doors `fabric_knowledge_search` and `fabric_knowledge_execute` (their names and inputs
unchanged, R28; `operations: true` lists the new ones), and the voice tools. That is dashboard parity both ways: what
the window shows, an agent can read, and the reverse.

## 3. Freshness

Each source writes its own mark when a pass reads it: `read:<source>` with the time, beside the pass's existing
`last_pass` (`estateRun.ts`). A source is fresh when read within 10 minutes (twice the pass interval), catching up
while transcripts are left, documents were deferred or the board answered `more`, and not read when the pass named it
in `degraded`; the chip says which and since when.

## 4. What does not change

The journal stays the spine; the index stays derived and deletable (ADR-0200). Vectors only from a local Ollama
(embedding-policy/1). No organization's name is written in code: contexts and their names come from Observatory's
registry. The organizations' ownership shares and people stay in the owner's data, never in this repository
(agreed with session 8343a070, 2026-11-20). The doors stay the CEO's until CO-422 narrows them for project sessions.

## 5. Not here

A golden question set with recall@5 and MRR, faster vectors, query synonyms, the disk line, the live layer of agents on
the graph, the organization graph connector (CO-600) and doors for project sessions (CO-422): rows of the carry-over
ledger, the report's waves 2 and 3.

## 6. One graph module

The owner, 2026-11-20 ~21:30, relayed by session 8343a070: «Граф решений и граф Memory: общий модуль графа с сессией
0daa75f1 (Memory) и sound-engine e150fe59 (3D-граф), не три копии». So the graph is a package of its own,
`packages/graph` (`@fabric/graph`), with a data model that names no source and views that draw it:

| Part | Is | Used by |
|---|---|---|
| `@fabric/graph/model` | `GraphNode {id, kind, label, at?, actor?, state?, ref?, group?, size?, attrs?}`, `GraphEdge {from, to, kind, weight?}`, and pure helpers: `neighbours`, `byTime`, `collapseAgents`, `groupsOf`, `joined` | every view, any host, tests |
| `GraphMap` | the network on WebGL (sigma 4, graphology, ForceAtlas2); without WebGL it says so and shows the table | Memory |
| `GraphTimeline` | cards in time order with their state, lanes by group (`groupBy`), agents' steps between people's commands folded (`onlyPeople`); no WebGL | the decision graph (8343a070) |
| `GraphTable` | the same data as a table | every view's text twin |

Memory maps its organizations and projects into this model (`shared/memory.ts`); the decision graph maps the journal's
tasks, decisions, the owner's commands and session launches into it. A three-dimensional mode for Sound Engine's hub
is offered to sound-engine on the board as a bundle of the same module, not built here.
