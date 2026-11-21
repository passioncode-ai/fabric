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

The levels, as the owner named them at ~22:35 the same evening (brief
`ceo/inbox/2026-11-20-logging-passioncode-analytics-brain-levels-brief.md`, item 3): «есть брейн проекта, есть брейн
организации, где есть связи между разными проектами, есть брейн межорганизациями, есть брейн рабочего места, который
связывает конкретно твой вижен, и он не шарится внутрь, он твой персональный, в твоем облаке хранится». Every session
uses these names:

| Level | Is | Lives |
|---|---|---|
| **Memory проекта** | one project's documents, sessions, tasks, commits and the links among them | wherever the project's folder is; in every level above as that project's part |
| **Memory организации** | the links between an organization's projects from every member's machine, one growing data graph; only that organization's context | the organization's cloud on PassionCode (passioncode-platform) |
| **Memory между организациями** | links between projects of different organizations (reuse, borrowing, a decision carried over) | the owner's side only, as part of the level below |
| **Memory рабочего места** (= **Оболочка**) | one person's own view: built only from the links that concern that person, across his organizations and personal projects; operated by CEO Fabric; never passed inside an organization | the person's personal cloud, mirrored on his main machine |

The **index of a machine** (Memory машины, §1 to §6) is not a level: it is how every level is collected. Each machine
indexes the projects whose folders it holds and sends each level only its share.

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

### 7.5 Memory рабочего места (Оболочка) and Memory между организациями

The cross-context links (Memory между организациями) and the person's own links live in his Memory рабочего места as `layer = 'overlay'`, kept in his personal cloud and mirrored on his main machine (relates-to, cites, reuse, carried-over
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

## 8. «Сон»: cleaning, rebuilding and healing

The owner, 2026-11-20 ~22:30 (brief `ceo/inbox/2026-11-20-inbox-graph-and-brain-sleep-brief.md`): «Это ненужная
информация, устаревшая из мозгов, как сон, как происходит у людей, когда происходит перестроение, очистка мусора,
лечение». Every level runs a sleep phase, at night or when the machine idles, never during a pass:

| Step | Does | Undo |
|---|---|---|
| Archive | moves what aged out of use (a session nobody found or linked in 90 days, a superseded document section, a retracted fact) to `archive.sqlite` beside the index, with why and when | `memory.restore {id}` brings it back with its links |
| Rebuild links | recomputes derived links (cites, relates-to, the board pairs) from the documents that remain; drops an edge no document asserts any more | the previous edges are kept in the archive for one sleep |
| Heal | finds what is broken: an edge to a node that never appeared, a document whose file moved or vanished, a vector of a digest no document holds, an FTS row with no document; fixes what can be fixed and lists the rest | each repair is a log line with before and after |
| Compact | `VACUUM` and FTS `optimize` when the archive moved more than a tenth of the rows | none needed: derived |

A sleep writes one report (`sleep/1`: counts per step, time, what it could not heal) and Memory's overview shows the
last one. The pattern is recorded in the agents database (session 4deaa22b) for every brain: Memory, Memory
организации, Sound Engine's brain, the agents database, the data rooms.

## 9. Logs at every level

The owner, ~22:35: «на все должно логироваться … сборы данных типа обработки, передачи на разных уровнях логи. чистятся,
не засоряются». Each level writes its processing and transfer log in Fabric's operations log (`main/ops.ts`, rotated in
8 MB segments within a 96 MB budget, 7 to 30 days): a pass (`estate.index.pass`: counts and degraded, already there), a
bundle sent or taken (`memory.bundle.sent`, `memory.bundle.taken`: machine, context, cursor, counts, refused rows by
reason), a scope-gate refusal (`memory.scope.refused`), a sleep (`memory.sleep`), a source taken (`memory.source.taken`).
No document text and no secret reaches a log line: counts, ids, digests and reasons only. The cloud levels keep their
own logs under the platform's rotation.

## 10. Other sources: the connection point (fabric-inbox first)

A service that builds part of the graph (fabric-inbox from mail, the PassionCode analytics from metrics) gives Fabric
its share in the same format as a machine (`memory-bundle/1`, §7.3), as JSON lines in a folder Fabric reads on every
pass: `userData/estate-index/sources/<source>/*.jsonl`, one record per line:

```json
{"bundle":"memory-bundle/1","source":"fabric-inbox","context":"personal","kind":"doc","id":"mail:<message-id>","node":"mail:<thread-id>","doc_kind":"message","title":"Subject","body":"verbatim text a quote can be checked against","at":"2026-11-20T21:00:00Z","path":null,"retain_until":null}
{"bundle":"memory-bundle/1","source":"fabric-inbox","context":"personal","kind":"node","id":"mail:<thread-id>","node_kind":"thread","label":"Subject","at":"2026-11-20T21:00:00Z"}
{"bundle":"memory-bundle/1","source":"fabric-inbox","context":"personal","kind":"edge","src":"mail:<thread-id>","rel":"relates-to","dst":"project:<project id>","at":"2026-11-20T21:00:00Z","evidence":"why"}
```

A file is read from where the last pass stopped (as a transcript is); a line Fabric cannot read is counted and named in
the pass, never guessed. The source decides what enters: spam and noise never reach the folder (the owner: «Мы не должны
формировать Inbox, спам»); `retain_until` lets a source mark what the sleep archives at that date. Ids carry the source's
prefix (`mail:`, `metric:`), so two sources never collide; `context` follows §7.4 and a document of an organization's
context reaches only that organization's Memory. The PassionCode analytics (the analytics session) give their metrics
this way with `context: org:passioncode`, so they link into Memory организации PassionCode.

## 11. Access by the ownership graph, and smart delegation

The owner, 2026-11-20 ~23:20 and ~23:25 (briefs `2026-11-20-datarooms-graph-of-graphs-tasks-brain-ai-native-manifest-brief.md`,
package 2, and `2026-11-20-estate-graph-central-brain-ownership-access-brief.md`, package 4; the CEO's reading of them):
an agent reaches another's graph only on a person's approval, with the sections and gates of that graph fixed when the
key is issued; several independent people may share one brain, each giving the part his agent selected for the task;
access is decided by the ownership graph (who owns what: whole, partial, by share, for a time) and checked at every
door; a client of our agents never reaches our internal brains (the agents database, PassionCode's projects) directly.

| Piece | Is |
|---|---|
| Ownership edges | `owns` edges from a person or an organization to a project, a section or a source, each with `kind` (whole, partial, share with its fraction, temporary with `until`) and the evidence it came from (a registry, a contract row, the owner's words); kept in the level that owns them, never inferred |
| Grant | `memory-grant/1` {holder (an agent key), graph, sections (node kinds, projects or tags), gates (read, cite, link, write back), purpose, until, approved_by, approved_at}; issued only on a person's approval, never widened by the holder |
| The door's check | `fabric_knowledge_search` and `fabric_knowledge_execute` answer only nodes inside the caller's grant and his ownership path; a hit outside is not said to exist (no count, no title); a refusal names the gate, never the content |
| Shared brain | a task's brain is the union of the parts each owner's agent selected and granted for that task; each part keeps its owner on every node and link, and leaves with its grant |
| Never direct | a client's key never resolves to the agents database or a PassionCode internal project: those answer only through our own agents' doors, which return results, never their graph |

The grant format and its check are wave M5, after the scope-gate (M3) they generalize.

## 12. The contribution map

Every brain shows who built it: per person, project and agent, how many documents, links and decisions each
contributed, over time, and which of their links others use most (a link followed by a search or a walk). The data is
already there (every document has its project, every turn its session, every commit its author's role, never a
person's name where a role suffices); it becomes `memory.contributions` beside `memory.overview`, and a panel on the
Memory screen: a stream chart of contributions by week, the projects that feed each organization, and the most used
links. It counts work, never ranks people (the agents database's rule on readings of a person).

## 13. Tasks as a brain

A task is a node of the same graph, linked to what it is about: the product's nodes (a scenario, a screen, a module, a
document section), the sessions and commits that worked on it, the decisions it waits on, the risks and what to study
first. An agent taking a task gets its neighbourhood (`graph.neighbours` from the task) instead of a list; a person gets
the picture (the map and the time line of `@fabric/graph`). The task graph's design is Memory's (agreed with session
8343a070 on 2026-11-20, the owner's package 4); its research of the task manager is the input (`docs/evidence/plans/2026-11-20-task-manager/README.md`
on branch `feat/pages-wave` at `d1908672`: tasks journal-first, five states, `shared/ladder.ts#mayMove`, priority only as a position
inside a goal, no OKR or metrics, the backlog in two places; its advice: our own core, a product layer in five steps,
no open-source engine under it). Its project and task pages draw the task graph with Memory's views. People management
reads only work facts (claims, releases, reviews), never a score of a person.

## 14. The estate graph and the central brain

project-observatory (session 5330262a) builds the estate graph (projects, machines, worktrees, Switchboard's sessions,
Fabric's services) on this engine, through the connection point of §10 (`source: observatory`, ids `obs:`); the agents
database (session 4deaa22b) is the central brain that records how graphs and memories are built (patterns
`hybrid-retrieval`, `brain-sleep`, the levels) and rolls improvements out to the projects that contributed.

## 15. The owner's people directory (Memory рабочего места)

The owner, 2026-11-21 05:05 (Telegram, relayed by CEO request `467a13ba`), verbatim: «Мне нужно, чтобы это ещё в фабрик
передавалось в мою личную память, которая там будет, чтобы навигация правильно работала и оттуда тоже, когда я буду
говорить, кому отправить.»

**What it is.** A directory of the people the owner deals with, kept in his Memory рабочего места (the Оболочка layer of
§7.5): personal, in his personal cloud and on his main machine, never carried by a bundle, never seen by an
organization's Memory or by another person's delegation (§11). Each entry holds:

| Field | Meaning |
|---|---|
| who | the person as the owner calls them, with every name form he uses (a first name, a diminutive, a role) |
| relation | why they matter to him (family, a colleague, a contractor, a partner) and in which context (personal or `org:<id>`) |
| channels | where to reach them (a Telegram id, a chat, mail), with which channel is preferred for what |
| purpose | what the owner writes to them about, so a request can be matched to the right person |
| namesakes | the other entries sharing a name form, so an ambiguous name is known as ambiguous |

**Namesakes are the point.** Two people with the same first name (for example two colleagues both called Alex) are
two entries; «отправь <name>» with a name that matches more than one entry is never resolved by guess.

**Who reads it.** CEO Fabric and the voice read the directory whenever the owner says «отправь X», «напиши X», «кому
отправить». One match: the channel of that entry for that purpose. More than one match, or none: they ask the owner
which person he means (through the communicator, naming the candidates by relation, never sending first), and the
answer may add a name form to the entry with his words as the reason.

**Until the Оболочка exists (wave M4, §7.6).** CEO Fabric keeps the directory in `ceo/people.md`, a file in its own folder
that Fabric never rewrites (local to the owner's machine, never in a repository); `ceo/CLAUDE.md` is rewritten from the
brief at every start, so a directory kept there would be erased (the 0.3.28 review, DO-8). M4 moves it into the Оболочка as `kind = 'person'` nodes of `layer = 'overlay'`
with the fields above in `attrs`, read through `fabric_knowledge_execute` (`overlay.people.find`), and the CEO's file then
points to it. Names, ids and channels never enter this repository, its tests or its fixtures (check-private P1).
