# Providers, agents, memory and the manager — research and bounded packets

As of 2026-10-04. Fabric source snapshot `7b54dbaa7938933d25ef7e4017cb11500add3eba`. This is research and decomposition, not runtime delivery or a new canonical status register. Parent entry: [unified execution report](../README.md). Machine-readable task context: [82 packet records](../packets/agents-memory.json). Evidence and claim limits: [13 primary sources](../raw/agents-memory-sources.json).

## 1. What the existing direction gets right

The canonical plan keeps real-provider acceptance separate from release, agent binding separate from provider implementation, memory selection separate from source capture, and rule proposals separate from operator approval. Preserve those seams. A shipped desktop release cannot complete N1 or M199 live continuity. AR-3 external ingress can precede the full registry only by ADR-0115's specific exception; it does not complete project admission, jobs or walking-skeleton acceptance. MEM-P3 summaries are optional, while durable capture, scoped retrieval and current-task context are prerequisites. ADR-0109 explicitly moves learnings into Fabric but does not move every Observatory episode/checkpoint into Fabric.

The selective-reference approach is supported by [Anthropic's context engineering report](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents); its finite context argument supports bounded packs, not unlimited memory injection. [Long-running harness engineering](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) supports resumable Git-backed progress and one bounded implementation step at a time. These are engineering rationales, not proof that Fabric's implementation passes native acceptance.

## 2. Findings that change current work

**Hub first.** P-07.2 must reuse the existing hub consent, client binding, grants and revoke path from ADR-0115. Its older spec's standalone per-client-token wording must not become a second server or credential store. Registry `source: fabric` for a Fabric-started project session still requires AR-3.2/CO-194 consent design; grants held by an EXTERNAL agent do not transfer to that session. CO-193's underscore tool-name deviation needs an owning contract change and consumer pin proof, not quiet acceptance.

The pinned [MCP transport specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) requires local Origin validation and distinguishes stream disconnection from cancellation. Test hostile Origin/Host, native Origin-absent requests, revoked credentials and MCP-session-id-only authentication independently. P-08 must say whether its disconnect-cancels-forward behavior belongs to a documented custom transport/call contract; do not claim standard Streamable HTTP cancellation semantics when the pin says disconnection is not cancellation. [MCP security guidance](https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices) requires principal authorization beyond session handles. A [developer interoperability discussion](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/3370) identifies browser-origin differences; its remote-server debate is no reason to relax a local server's policy.

**First learning data task.** P-06.1 must use the actual current schema head, which already includes migration 77 in this snapshot, instead of assuming the old spec's 76-era context. The six agent events are 2 goal, 1 retro and 3 rule events; retirement of memory facts and binding attribution add further integration arms. Enumerate append-door checks, dispatcher/rebuild, projector functions, event catalogue, feed, RLS and restore before writing the migration. Verify binding+project+estate and actor authority before journal append; a projector-only refusal does not stop unauthorized history. Goal retirement, approval/edit/retire revision races, replay and restore resurrection are first-class negatives.

**Provider feasibility has changed upstream.** [Current official Claude authentication documentation](https://code.claude.com/docs/en/authentication) now describes config-directory-scoped macOS Keychain entries. [A June developer issue](https://github.com/anthropics/claude-code/issues/70697) describes a global singleton, linked to [the isolation thread](https://github.com/anthropics/claude-code/issues/20553). The repository's historical matrix also describes the older limitation, while current pins are Claude 2.1.289 and Codex 0.160.0 with verdicts intentionally invalidated. The correct next action is a non-destructive exact-build profile/metadata probe, followed only when authorized by two-account native certification. Neither an issue closed as duplicate nor rolling docs proves this Mac supports safe isolation. No live credentials were read, copied, switched or logged by this research.

**Observe-to-verify is underspecified.** P-07's source no-longer-reports criterion must consume a later successful complete comparable scoped scan. Offline, error, stale or partial scans cannot mean fixed. Finding identity, source run/version, coverage and recurrence need durable receipts. URI/path/hash renames must not silently become a different project/run or orphan the proposal; the owning identity is immutable and source location is revisioned.

## 3. Lane-by-lane execution and payloads

| Lane | Packet records | Parent/current work accounted for |
|---|---:|---|
| 5 | 4 | N1, CO-186 |
| 6 | 44 | AR-1, AR-2, AR-3, AR-4, AR-5, AR-6, AR-7, AR-8, AR-9, AR-10, AR-11, CO-188, CO-193, CO-194, CO-195, CO-196 |
| 7 | 9 | MEM-P0, MEM-P1, MEM-P2, MEM-P3, MEM-P4, MEM-P5, MEM-P6, MEM-P7, CO-183 |
| 8 | 25 | M153, M158, M157, M184, M166, M167, M169, M171, M194, M175, P-06, P-07, M183 |

**Lane 5:** N1 runs separate Claude and Codex canaries with exact source/build, bundle digest, thread/turn identity and HAR-R0-04 Stop/crash/stale-command matrix. Claude's named owned profile exists in the plan; Codex's October 3 usage reset is an old observation, so revalidate rather than assume exhausted or available. M199.ui wires existing pure intent/read producers and settings navigation; unknown quota remains unknown and default changes only new conversations. M199.acceptance remains separately gated on certified isolated test accounts and independent native identity/context/effect observations. Re-rendering Fabric's transcript is not proof of native continuation. CO-186 publishes N1 into a canonical living status source without rewriting a dated snapshot into an invented result.

**Lane 6:** Every AR-1.1…AR-11.1 child row has a packet with its original requirement and acceptance. Completed AR-1 rows are classified as completed receipts to verify, not scheduled for rebuild. AR-1.5 consumer-pin compatibility remains open. Registry next is AR-2.1/2.3/2.4, Fabric's dashboard action and native MCP inventory states; AR-2.2's reader is partial and does not prove state-precedence/private-agent semantics. AR-3.1/3.4 external hub slices remain partial; project config writing, CEO commands, job/interaction states and AR-3.6 real walking skeleton remain distinct. Later context, pipelines, traces, agent production, tools and optimizer follow the canonical order; AR-11 can migrate one agent once contract inputs exist, preserving private owners. Trace missing hops are incomplete evidence; optimizer never self-applies. AR-10 consumes MEM-P2/P4/M183, so no duplicate search/compiler/export truth.

**Lane 7:** MEM-P0 is the actionable baseline task, gated only on an owned test stack. The JSON embeds every canonical MEM-P0…P7 detail, dependency payload and negative acceptance. P1 passes sanitized durable chunks/coverage to P2. P2 passes authorized bounded candidates to P4 and UI. CW-N1 adds typed conversation provenance. P4 passes sealed checkpoint/pack to P5. P3 contributes optional derivatives; source ranges remain the receipt. P5 must separately prove native same-provider resume, fresh same-provider continuation and fresh cross-provider Run, including old-writer fencing and unknown-effect reconciliation. P6 UI reads existing DTOs and keeps Board/Projects/Agents structure. P7 returns per-capability native/browser/provider/storage receipts; restore/retention is not universally solved by a successful archive test. CO-183 supplies bounded fact tiers without forcing an expensive summary pipeline.

[PostgreSQL's FTS documentation](https://www.postgresql.org/docs/current/textsearch-controls.html) and [trigram documentation](https://www.postgresql.org/docs/current/pgtrgm.html) support a lexical first implementation with explicit language and identifier fixtures. Unbounded indexing coverage and bounded response bytes are compatible requirements. A language configuration alone does not prove mixed RU/EN/code identifier recall, cross-chunk recall or correct scope isolation.

**Lane 8:** M153 hygiene and M158 criticality can start from their shipped M152.commit producer. Their deep system task cards are embedded in JSON, as are every F5 manager task's algorithms, negative cases, dependency contracts and activation boundaries. M153 never closes by age or missing source, and exact dedup preserves blockers/authors/history. M158 human-decision floor overrides every trust/score; unknown impact is incomplete. M157 settles only a current applicable cited basis after M158/M168. M184's process recurrence N≥3 and P-06's agent-rule N≥2 are different policies. M183.local does not unlock upstream privacy/endpoint transport. M166 deterministic core works without provider; M167 absence remains unavailable. M169 caps total attempts across providers and switches only valid turn boundaries. M171 unknown usage is recorded as unknown. M194 external/built-in manager shares the same floor, epoch, pack and tools. M175's recoverable iteration refund never refunds attempts/deadline/cost and never trims unresolved effects or mandatory authority.

P-06.1…P-06.6 deliver data → honest host/agent retro → distinct-run proposal and Board decision → next instruction revision and pack → reachable UI → published compatible contract/adapter. P-07.1 and P-06.1 can progress independently where contracts are clear; P-07.2 precedes Dashboards UI. P-07.1 confirmation/no-answer/cancel never files or grants. P-07.3/4 belong to their owning repositories and cannot be completed by Fabric-only fixtures.

## 4. Research does not authorize automatic learning

[Reflexion's original paper](https://arxiv.org/abs/2303.11366) is evidence that reflective text can help on its studied tasks. Its benchmark does not guarantee Fabric gets better, and it does not override ADR-0109's Board decision. A correction needs goal, failed/verified contrast, applicability and source refs; a causal explanation stays a hypothesis. Measure held-out tasks, wrong/generalized-rule harm, instruction-budget impact and rollback by revision. Agent-authored text remains lower-trust data until an operator decision makes a rule approved. Repetition of one delivery is not recurrence across distinct runs.

[A developer compaction issue](https://github.com/anthropics/claude-code/issues/10232) motivates a negative fixture: approved rule/protocol loss after compact. Reassert the pinned revision; do not trust a free-form summary to restore the authority floor. Structured checkpoint fields and source refs carry the continuation contract, never hidden provider reasoning or tool credentials.

## 5. Concrete next order

1. Keep P-08 iterations 2/3 and exact-SHA release/schema/publication gates as the root's current work; send compatibility/transport findings immediately.
2. In parallel, read-only re-probe N1/provider readiness and run MEM-P0 synthetic baseline once the test stack is available. Do not use a stale quota reset as a new credential action.
3. After the current hub iteration, P-06.1 and P-07.1 are the earliest learning/fix implementations, with frozen event/authority/deep-link contracts. AR-1.5 and CO-193 owner branches resolve wire compatibility in parallel without changing production pins prematurely.
4. Advance each lane by its payload artifacts. Never unlock native continuation from memory UI, cross-provider support from a native-only test, or upstream feedback from a local queue.
5. One agent implements the selected first packet; research agents report current-impact findings before continuing future packets. The central plan owns priority, while canonical sources keep delivery status.

## 6. Packet handoff and evidence boundary

Each JSON record has canonical id, lane, owning repository, source SHA/paths, bounded implementation scope, dependencies with artifacts, concrete steps, failure modes, negative validation, DoD, stop conditions and priority rationale. Module parents point to child records. Proposed filenames explicitly say new/resolve; they are not claims that a file exists. Every source path was checked locally. Deep internal task cards are preserved as canonical detail so an executor has the exact contract rather than a vague title.

This research executed canonical/source inspection, primary-source browsing, JSON/schema-shape and lane/id/path coverage checks only. It did not run native acceptance, mutate providers, migrate a database, change canonical delivery statuses, modify code or execute a release. Raw sources are short excerpts plus claim/limitation mapping, not saved private histories. Parent coordinator owns the report header, combined plan, map, lease, checks, Git commit/push and publication.

## 7. Local receipts

- `docs/evidence/backlog.md:62` at `7b54dbaa7938` — | 5 ·
- `docs/evidence/backlog.md:63` at `7b54dbaa7938` — | 6 ·
- `docs/evidence/backlog.md:64` at `7b54dbaa7938` — | 7 ·
- `docs/evidence/backlog.md:65` at `7b54dbaa7938` — | 8 ·
- `docs/evidence/plans/2026-09-27-first-slice-plan.md:705` at `7b54dbaa7938` — ### N1
- `docs/evidence/plans/2026-09-29-agent-registry-plan.md:12` at `7b54dbaa7938` — ## Canonical module status
- `docs/launch/memory/plan.md:30` at `7b54dbaa7938` — ## MEM-P0
- `docs/evidence/specs/2026-10-03-agent-learning-loop-and-fix-in-fabric.md:22` at `7b54dbaa7938` — ### 2.1 Objects
- `docs/adr/0109-agent-learning-lives-in-fabric-and-problems-become-proposals.md:30` at `7b54dbaa7938` — ## Decision
- [apps/desktop/src/main/contextPack.ts](https://github.com/passioncode-ai/fabric/blob/7b54dbaa7938933d25ef7e4017cb11500add3eba/apps/desktop/src/main/contextPack.ts#L196) — export async function compileContextPack
- [apps/desktop/src/shared/providerCapabilityMatrix.ts](https://github.com/passioncode-ai/fabric/blob/7b54dbaa7938933d25ef7e4017cb11500add3eba/apps/desktop/src/shared/providerCapabilityMatrix.ts#L28) — export const PINNED_BUILDS
- [supabase/migrations/20261004000077_hub_access_at_the_door.sql](https://github.com/passioncode-ai/fabric/blob/7b54dbaa7938933d25ef7e4017cb11500add3eba/supabase/migrations/20261004000077_hub_access_at_the_door.sql#L1) — -- 77
- `docs/evidence/backlog.md:174` at `7b54dbaa7938` — | <a id="work-m153"
