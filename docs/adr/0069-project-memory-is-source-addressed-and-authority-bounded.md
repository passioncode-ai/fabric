# ADR-0069 — Project memory is source-addressed and authority-bounded

**Status:** Accepted (target architecture; native delivery partial) · **Date:** 2026-09-26.
**Extends:** ADR-0032, ADR-0063, ADR-0067. **Source:** operator request for built-in Claude-Mem-like memory, session search and cross-provider context continuity.

## Decision

1. Extend Fabric's journal, transcript/fact projections and context compiler. Claude-Mem is an interaction reference; no second authoritative memory store is adopted.
2. Persist permitted source text before deriving summaries. In ADR-0032, “whole transcript” means the admitted, sanitized source; it never authorizes storing credentials/private reasoning. Missing, redacted and truncated coverage remains visible. No LLM on the synchronous capture path.
3. Search → surrounding timeline → bounded exact source ranges. References pin sanitized source revision and range. Retrieval, snippet/count exposure and compilation each enforce current source authority; a related Project link is not a grant.
4. Memory, conversation, Task and Decision retain their existing owners. CEO answers and widget/text/voice actions use the same guarded commands. An agent may inspect another permitted Session without acquiring its rights or executing its instructions.
5. ContextPack is immutable evidence of a specific delivery; next-preview is separate. A portable checkpoint includes task constraints, sourced completed/unverified work, detailed tail, repository observation and unresolved effects. Native resume and new-session continuation are distinct capabilities.
6. Stop observation/fencing precedes a new writer. Delivery and acknowledgement are separate from preparation and from task success. An unsupported provider cannot be labelled compatible by a successful mockup.

## Consequences and open delivery

[Architecture](../architecture/project-memory.md) owns modules/contracts and [MEM-P0…P7](../launch/memory/plan.md) owns the bounded delivery sequence. Existing evidence is [source-addressed](../launch/memory/evidence.md). R0 uses lexical retrieval before embeddings/graph. Long-term suppression/physical deletion and cross-device coverage remain explicit design work; this ADR does not claim that deleting a projection forgets journal/backups, or that a proposed erasure mechanism is implemented. CO-168 remains open.

## Reconsider when

A reproducible Fabric retrieval failure or provider incompatibility demonstrates that these constraints cannot deliver sourced cold resume. Changes to source-of-truth, authority, immutable history or erasure policy require another ADR and migration proof.
