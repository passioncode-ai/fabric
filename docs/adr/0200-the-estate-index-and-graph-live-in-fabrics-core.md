# ADR-0200: The estate index and its graph live in Fabric's core, and the organization's graph reads them through Fabric's doors

**Status:** accepted · 2026-11-19 · Fabric task `57781f0d` · design and spec:
[the estate index and graph](../evidence/specs/2026-11-19-estate-index-and-graph.md) · records the operator's order of
2026-11-19, relayed by the CEO agent verbatim: «Продумать и реализовать векторную базу знаний для всего Fabric: связанный
граф задач, действий, данных. Посмотреть в Sound Engine, как там сделан обновляемый граф, взять за пример. Цель: по графу
легко бегать и искать связи, что к чему относится» · follows R33 O17 (decision D-78) and the `hybrid-retrieval` pattern of
the agents database · keeps [ADR-0014](0014-the-event-journal-is-the-spine-and-every-register-is-a-projection.md) (the journal is the spine).

## Context

Two homes were open for Fabric's searchable graph: Fabric's own process, or a connector in the organization's knowledge
graph (`knowledge-graph.passioncode`, template `passioncode-ai/template-knowledge-graph`, data-room 1.9.1), which already
holds nodes and edges in one SQLite with FTS5 and vectors behind search and execute.

What decides it is what the graph is made of. Most of it is private to this machine and to its person: the Claude Code
and Codex transcripts (21 GB in `~/.claude/projects`, 2.1 GB in `~/.codex/sessions`, every Switchboard home), the
consoles Fabric ran and the Claude sessions they ran as, the operator's board and tasks across his own projects, his
organizations' and his partners'. The organization's graph is shared by the organization's members; a partner's or a
personal transcript in it would cross the line the contexts design draws (personal is seen by no organization). And the
agents database's rule is that a project serves its own corpus behind its own two doors, while the organization's graph
reads a project through those doors, never by copying it (D-78, «one engine, two layers»).

## Decision

1. **The index is Fabric's**, covering all of Fabric and this computer's harness (sessions, transcripts, tasks, the board,
   the journal's acts, documents, decisions, commits), a derived SQLite file in `userData/estate-index/index.sqlite` (`main/estateIndex.ts`),
   rebuilt by deleting it. Nothing reads it to decide a write; the journal stays the spine.
2. **One engine with the organization's graph**, ported, not copied: the words ranking uses Fabric's own Russian and
   English stemmer (`shared/boardSearch.ts#terms`, so a word means the same as in `fabric_board_search`), a trigram
   ranking finds parts of identifiers, local vectors from Ollama join when a model is installed, and the three are fused
   by reciprocal rank with k = 60, as in Sound Engine's knowledge base and the pattern. The quote rule is `quotes.py`'s.
3. **Nodes and edges live in the same file** (project, task, session, console, board message, act, commit, record; edges
   belongs-to, spawned, blocks, did, ran-as, changed, cites, answers, relates-to, waits-on), written by the same pass
   that writes the documents, read by `graph.neighbours` and `graph.path`.
4. **The doors are two**, on the CEO's own hub server: `fabric_knowledge_search` and `fabric_knowledge_execute`
   (`main/knowledgeTools.ts`), and the window's search panel calls the same operations (dashboard parity both ways).
5. **The organization's graph reads Fabric as a connector through these doors**, scoped to the organization's context;
   that connector is the knowledge graph's to build, asked on the board (CO-600), never a copy of this file.
6. **No remote model sees the text**: vectors only from a local Ollama (`embedding-policy/1`); without it the search is
   lexical and says `vector-unavailable`.

## Consequences

- With documents and decisions (amendment of the same day, the operator's «весь фабрик весь харнес был граф векторный»),
  a first index of this Mac took four passes (138, 127, 37 and 13 s): 792 transcripts, 24 197 commits, 4 702 document
  files cut into sections, Fabric's rows and memory facts, 179 510 documents and 109 221 edges in about 880 MB. The FTS
  tables are contentless (schema 2): with a copy of the text in each they took 2.5 GB. The trigram half reads the first
  1 200 characters of a document. A search answers in 0.1 to 0.6 s once the file is cached (`EstateIndex#ranked` asks
  the FTS index alone and filters after; a join with the documents took 4 s).
- Embedding the whole index takes many passes (400 passages a pass, about 10 s with `embeddinggemma`): meaning ranks the
  newest passages first and the rest over the following hours.
- A project session's own narrowed search waits for CO-422 (contexts as estates); until then only the CEO, the operator's
  own agent, gets the doors, and every hit names its context.
