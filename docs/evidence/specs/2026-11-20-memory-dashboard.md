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

## 7. Memory машины, Memory организации, Оболочка (the owner's extension, 2026-11-20 ~22:15)

The owner, the same evening, in the CEO window (brief `ceo/inbox/2026-11-20-memory-multimachine-org-overlay-brief.md`,
packages 1 and 2), verbatim in part: «Когда у нас несколько машин, каждая машина делает индекс проекта, который на ней,
и всё это мерджится в облако, в общий индекс … можно разбить связи: показать отдельно, какая связь пришла с каждой
машины и как она замерджилась»; «Оболочка не передаётся внутрь, но она связывает, и ей оперирует фабрика»; «в облаке
организации появляется глобальная memory организации всех её проектов, всех дел. Это большой единый датаграф». The
working names are the brief's and every session uses them:

| Name | Is | Lives |
|---|---|---|
| **Memory машины** | the estate index of one machine (§1 to §6): the projects whose folders are on it | that machine's `userData/estate-index` |
| **Memory** (главная машина) | the union of the owner's Memory машины, each link carrying where it came from | the owner's main machine |
| **Memory организации** | one growing data graph of an organization's projects from every member's machine; only that organization's context | the organization's cloud on PassionCode (passioncode-platform) |
| **Оболочка** | the owner's own layer of links between projects of different organizations and his personal ones (reuse, borrowing, a decision carried over); operated by CEO Fabric | the owner's main machine only; never exported |

### 7.1 Identity that survives a second machine

A node merges across machines only when its id does not depend on a folder: a task, a message and a decision already
carry their uuid, a commit its sha. A project's id becomes its canonical key: the repository's normalized remote URL
(`git@github.com:o/r.git` and `https://github.com/o/r` are one key), else Fabric's project id; a document is
`doc:<project key>/<path>`. A session keeps its runtime id and gains the machine it ran on.

### 7.2 Provenance on every link

Each machine has a stable id (`machine:<hash>` of its install id; its display name is the owner's). A pass writes, beside
`edges`, one row per assertion: `edge_origins(src, rel, dst, machine, first_at, last_at, digest)`. The merged edge is the
union; how it merged is read, never stored as a guess: `own` (one machine), `same` (several machines, one digest),
`differs` (several, different evidence, both kept). Decomposing is a delete: drop one machine's origin rows and every
edge left with no origin goes, so a machine's contribution can be shown alone, compared or taken back. Documents carry
`machine` the same way.

### 7.3 The bundle and the merge

A machine exports what changed since the receiver's cursor as one bundle per context: `memory-bundle/1` {machine,
context, cursor, docs (id, kind, title, the verbatim passage, path, lines, digest), nodes, edges with their origin},
signed with the machine's key. The main machine imports its other machines' bundles of every context; a cloud imports
only bundles of its organization's context. An import is idempotent by (machine, cursor) and never deletes another
machine's origin rows.

### 7.4 Isolation (scope-gate)

On export the gate keeps a document, node or edge only when its context is the target organization's
(`org:<id>`, §3.6 of the estate spec); an edge whose two ends stand in different contexts is never exported (it belongs to
the Оболочка). On import the cloud checks every row's context against the caller's token scope and refuses the bundle
whole on one foreign row. A member's personal projects and other organizations' never leave the member's machine.
Tests plant a cross-context edge and a foreign document and watch both refused at each end.

### 7.5 Оболочка

The cross-context links live in the owner's main Memory as `layer = 'overlay'` (relates-to, cites, reuse, carried-over
decision), written by the passes and by CEO Fabric through `fabric_knowledge_execute` (`overlay.link`, `overlay.list`,
`overlay.unlink`, the owner's words as the reason). No bundle carries them; an organization's Memory never sees them.
The Memory screen shows them as dashed lines between organizations, only on the owner's machine.

### 7.6 Waves

| Wave | Delivers | Done when |
|---|---|---|
| M1 | canonical ids (§7.1), `edge_origins` and the machine id, «по машинам» on the map (colour by origin, show one machine) | a two-machine test merges, shows and decomposes one link |
| M2 | `memory-bundle/1` export and import between the owner's machines (MacBook and Mac Studio over the existing tunnel) | the main Memory holds both machines' projects with origins, measured |
| M3 | the scope-gate and the cloud Memory организации on PassionCode (passioncode-platform: storage, keys, backup) | an organization's cloud graph grows from two members' machines, foreign rows refused in tests |
| M4 | the Оболочка layer and its CEO operations | the CEO links two projects of different organizations and no export carries it |

Wave 2 of the readiness report (the golden set and the shadow index, task `90cf6d17`) runs beside M1: every merge rule
is measured on the golden set before it is switched on.
