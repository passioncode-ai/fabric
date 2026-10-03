# ADR-0105 — Agent memory lives in Project Observatory; Fabric keeps its own

**Status:** accepted architecture decision. Execution is Observatory PB-137; the Fabric side is
modules M0 (this record) and M8 of the plan.
**Date:** 2026-10-03.
**Decided by:** the operator, 2026-10-03. Asked where memory lives, the operator answered:
"Fabric keeps memory about itself — services, conditions, plans, roadmaps. Agent memory — what
happened, the work of different agents on different projects, shared agents — we manage through
the global memory in Observatory." The operator also chose that external access goes through
Fabric's gateway, and that embeddings use a local model by default and OpenAI per project.

**Design:**
- Project Observatory, `docs/plans/2026-10-03-agent-memory.md`, with decision DEC-0250
  (`ssheleg/project-observatory` at `26db19f`). That plan carries the as-is receipts, the
  memory model, the `memory/0.1` capability list, the security model, the eval set and
  modules M0–M10.

## Decision

1. **Two memories, split by subject.**
   - **Project Observatory holds the only store of agent memory**, across every project and
     every agent. This covers episodes (what a session, step or run did and found), workflow
     working state (checkpoints written after each step), immutable handoff packs between
     executors, environment facts with validity windows, and learnings earned from a
     failure/fix contrast.
   - **Fabric keeps its own domain memory**: its services, conditions, policies, plans and
     roadmaps.
   - **Fabric also keeps run execution state** — what `DurableExecutionPort` resumes a run
     from (ADR-0022): queues, waits, retries and the step ledger of the orchestration itself.
   - What an agent *learned or did* inside a run is agent memory, and goes to Observatory.
2. **Fabric is a client of agent memory, through `memory/0.1`.** This is a capability family
   specified in `fabric-agent-contract` and served by Observatory as `fabric-interop/0.1`
   tools:
   - checkpoint write and latest;
   - handoff create, accept and get;
   - record;
   - learning propose;
   - search, recall and explain;
   - forget.

   **Nothing is copied into Fabric's journal.** The agent-registry design's rule — "Project
   Observatory's recorded narrative is read through its MCP when present — never copied into a
   second store" (design §11) — becomes the general rule. `fabric_memory_search` and
   ContextPack assembly read through `memory/0.1`.
3. **External access only through Fabric's gateway.** An agent off this machine reaches agent
   memory through:
   1. the relay (ADR-0088);
   2. the northbound MCP (ADR-0026: access bindings, OAuth 2.1, effect ceiling);
   3. the hub's `agent.call` (interop C3.5);
   4. Observatory.

   Observatory publishes no public entry of its own. **Authorization is checked at every hop:**
   Observatory re-verifies the binding on the credential Fabric mints for the call, and
   redacts on egress. Remote bindings never see the `private` or `secret-adjacent` data
   classes. Peer estates come later, over A2A (track CO-AR-01, ADR-0094 §3).
4. **Session handoff is built on this memory.**
   - **Switchboard's switch through a new session** (ADR-0051, ADR-0052) builds on handoff
     packs. Observatory, not the outgoing agent, assembles the pack, because an agent that hit
     its limit cannot answer.
   - **Same-provider resume** additionally carries the client-side transcript. This needs a
     probe first.
   - **Cross-provider handoff** carries only the pack.

## What this supersedes, in part

- **[ADR-0032](0032-project-memory-is-verbatim-first-and-built-not-adopted.md) and
  [ADR-0069](0069-project-memory-is-source-addressed-and-authority-bounded.md).**
  - **Replaced, for agent memory only:** "Fabric's project memory is stored in Fabric's
    journal". Agent memory moves to Observatory.
  - **Unchanged and still binding, now on Observatory's implementation:**
    - built, not adopted;
    - no LLM on the write path;
    - bi-temporal validity;
    - source-addressed, authority-bounded entries;
    - ContextPack as immutable delivery evidence.
  - **Domain memory stays in Fabric's journal** under both records.
- **[ADR-0032](0032-project-memory-is-verbatim-first-and-built-not-adopted.md)'s "embeddings only
  after full-text search measurably fails".** It now reads: hybrid retrieval exists in
  Observatory (FTS5 + sqlite-vec, RRF). The local model is chosen by measurement on the
  Observatory eval set, and the model version is pinned per index.
- **[ADR-0034](0034-an-agent-reaches-another-mcp-server-through-the-machine-gateway.md).**
  - **Superseded.** The machine agentgateway it relies on was switched off on 2026-09-14.
  - **What replaces it:** agents reach other agents' capabilities through Fabric's hub
    (`agent.call`), and remote callers through the northbound MCP.
  - **Still open:** the code path in `apps/desktop/src/main/gateway.ts` remains to be removed.
    That is plan AR-3.1, which this record discharges on paper.

## Consequences

- **`fabric-agent-contract` gains `memory/0.1`** (Observatory plan module M7). Its DEC-0014 pilot
  of an external `mcp-memory-service` is replaced: Observatory is the first `memory/0.1`
  provider.
- **AR-10.1** (CEO `query_memory`, Russian full-text search) is served by `memory.search`
  instead of a Fabric-side table.
- **AR-3** (hub and northbound MCP) carries the external path. Observatory module M8 waits for
  it; everything before M8 works locally.
- **Observatory's prerequisites become Fabric's dependencies:** redaction on every output
  (PB-033) and privacy scopes (PB-070). External exposure must not ship before both.
- **`org-index/repositories.json`** names `project-observatory-dashboard` as the agent-memory
  provider in the same change that lands `memory/0.1` (M7).
