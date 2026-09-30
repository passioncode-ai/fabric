# Iterations — how the product ships, slice by slice

**Status: canonical**, decided at the operator grill of run `2026-08-31-iteration-ladder`
under ADR-0016/0018 (the picture) and ADR-0027…0031 (the preconditions). The whole
picture stays visible from the top; **only the blocks that ship next are detailed**, and
each later block is elaborated at its own intake grill, never in advance. The sequencing
rule of ADR-0016 §5 governs throughout: nothing platform-wide before org #1 lives on it.

> **Vocabulary note, 2026-09-08 (S10 · [ADR-0045](../adr/0045-workflow-runs-task-runs-and-explicit-iterations.md)):**
> where this document says **run** it means a **WorkflowRun** — one execution of one
> pinned graph version, the wire's `run_id`. A **TaskRun** is a different identity: one
> admitted attempt at one Task. The bare word is no longer used alone, and
> [`CONTEXT.md`](../../CONTEXT.md) defines both. This note clarifies the reading; the
> text below is unchanged and remains the record of its own decision.


## The picture from the top

**The end product is unchanged**: PassionCode.ai, the operating environment for
AI-native teams, on the Fabric kernel — a platform of estates with owners, members,
personal estates and federation ([`passioncode-platform.md`](passioncode-platform.md),
horizons 0–5 in its §15). This file does not restate it; it sequences the road there.

**An iteration is a working version the operator uses in real work** — the vision's own
rule: every iteration must be something they can touch (`docs/vision.md`). An iteration
ships as **slices** of one to three weeks, each independently touchable; horizons stay
the strategic layer above.

## Iteration 1 — the operator's working version

**Target picture** (decided at the grill): org #1 with two projects — **Fabric itself**
(dogfood: the first project the system manages is the system, per ADR-0015's bootstrap)
and **PassionCode.ai** (the public product and its site,
`passioncode-ai/passioncode-ai.github.io` — live on Cloudflare Workers, with its own CI) — and an eight-agent roster in
three loops plus management: analytics monitor, developer, bug/crash reporter, product
manager, trend researcher, social publisher, support/feedback handler, custdev agent.
That roster is the §9 worked scenario of the platform architecture, staffed for real.

**The surface** is a macOS desktop application with the Claude Code terminal hosted
inside from the first slice (ADR-0031, fulfilling ADR-0008 §3). The module-level design
for slices 1–3 is canonical in
[`iteration-1-modules.md`](iteration-1-modules.md).

**The PM is a role binding, not a hard-coded agent**: any admitted provider can hold any
role including product manager (ADR-0012; `federation.md` §8), and replacing it is a
binding revision that survives routines, history and memory (ADR-0013). In iteration 1
the admitted set is {Claude Code, `local_harness`} until a second runner passes
conformance — that is CO-074 and the horizon-3 gate, not a schema assumption.

### The slice ladder

| # | Slice | What the operator touches | Acceptance (each line is a check, not a mood) |
|---|---|---|---|
| 1 | **Terminal and projects** | create org #1; add Fabric and PassionCode.ai as projects; open a live, typeable Claude Code terminal per project; watch the journal-fed activity feed | app restart loses nothing (journal + projections); `supabase db reset` rebuilds from migrations; planted tests fail correctly: cross-tenant read, floored effect without grant, second PM, journal UPDATE |
| 2 | **Project memory** (transcripts + eval shipped 2026-08-31) | session transcripts captured whole and searchable; facts remembered per project; a context pack compiled into each session's cwd | transcripts land without manual export and survive a restart — **ADR-0032 puts this before facts, not after**; a fact recorded in project A appears in a new A session and never in B; a fixture fails when memory is switched off |
| 3 | **Agents, runs, chains** — *partly shipped 2026-09-05, see the note below* | bind PM + developer (admitted-provider selector); routines tick on cron into immutable Runs; chains pass named payloads between nodes; the approval queue answers `canUseTool` | a cron tick produces a Run visible in the app; a two-node chain hands artifact A→B; the developer returns the typed result envelope (done/proof/scope/notVerified) on a real Fabric task; a floored action without a grant is refused with a receipt |
| 4 | **The observer** | Cloudflare + HTTP-probe + GSC/GA4 connectors (ADR-0006); analytics-monitor and bug/crash-reporter agents file reports and proposals to the target PM (ADR-0029) | a broken property appears as an attention row **without manual checking** — the horizon-0 gate of §15; a weekly analytics report artifact exists with sources |
| 5 | **The voice** | trend researcher produces evidence-backed topic artifacts; publisher drafts posts into the approval queue; publishing is a one-shot grant per post | a post publishes only after approval, with a receipt; without approval the floor refuses (ADR-0004/0028); the standing channel grant stays CO-036 |
| 6 | **The feedback loop** | support/feedback agent over PassionCode.ai's channels; custdev agent synthesises feedback and prepares interviews | inbound feedback becomes a typed artifact with a drafted response; a custdev report cites its sources; channels decided at this slice's grill (CO-085) |

Slices 1–3 are designed to module depth; slices 4–6 hold their boundaries here and get
their detail at their own grills — connector field schemas, the crash source
(CO-086) and support channels (CO-085) are deliberately not invented in advance.


#### Slice 3, measured against what shipped (2026-09-05)

Three of its four lines are done and the fourth is done DIFFERENTLY, which is the
part worth reading rather than the part worth ticking.

- **Routines tick** — `routineTick.ts`, with the quota gate in front (M94) and the
  loop bound behind (M68). **The unit is a TASK, not a Run object**: the board
  made the task the thing that carries work (M146), and a second immutable
  wrapper around it would be two records of one act.
- **Agents are bound** — created from a prompt (M125), each a named configuration
  of a runner, with the servers it asked for checked against the project's grant.
- **A floored action without a grant is refused with a receipt** — the policy
  floor, and the refusal reaches the operator's queue with the act that resolves
  it.
- **CHAINS ARE BUILT** (2026-09-05). A `follows` link carries the names its
  follower NEEDS; `fabric_task_handoff` records what a predecessor PRODUCED; and
  the advancer starts the follower only when the one before it finished and every
  named input arrived. The two halves are separate on purpose — one is the plan,
  written when the chain is drawn, and the other is the record, written when the
  work happens — because the whole question at a chain boundary is whether what
  was promised arrived.
- **THE APPROVAL QUEUE DOES NOT ANSWER `canUseTool`, AND THE DIFFERENCE MATTERS.**
  What shipped is `fabric_effect_request`: the agent ASKS, presenting nothing, and
  the surface finds the grant. The hook this line names would intercept every tool
  call the runner makes. The one built intercepts only what the agent chooses to
  ask about — so **an agent that does not ask is not stopped**. What closes it is
  the runner's own permission hook, which is per-runner, and no runner other than
  Claude Code has one this product has verified.

### What iteration 1 deliberately defers

The diet table with return triggers is in
[`iteration-1-modules.md`](iteration-1-modules.md) §12: the durable-execution engine
behind the port (first multi-day run), the Cedar evaluator behind the decision port
(second principal or hosting), journal partitioning (measured volume), runner
conformance passports (second runner), pgvector memory (FTS measurably stops finding — ADR-0032, and the row carries the model name and version), and pgvector memory's return trigger still stands.

**Two of that list shipped on 2026-09-05 and are struck here rather than left to
rot in it.** The declared git mirror is built (M118) — as FILES the app writes on
every declared change, not as a projection: the estate is the store and the
workspace is its mirror, so a divergence is a report about the files. And the
first notification transport is built (M8): the operating system's own, once per
waiting thing and one message for a burst. The other three transports each need a
credential, a budget and somewhere to put a failure, and are named rather than
scheduled.

## Iteration 2+ — direction, not plan

Held at horizon grain on purpose; each opens with its own grill.

| Iteration | Theme | Gate to enter (from §15) |
|---|---|---|
| 2 | **Durability and the second pair of eyes** — durable-execution adapter under multi-day runs (ADR-0022 fixtures), checker independence (CO-060/061), goal decomposition in the UI, the cofounder as second owner (M38 identity/memberships begin) | one real finding reached observed recovery end-to-end in iteration 1 |
| 3 | **Bring and compose** — Bring Your Agent lifecycle live (ADR-0019), second runner passport (CO-074), sandboxed provider views (ADR-0020/0024), project-scoped MCP control surface implemented (M15/ADR-0026) | a non-owner resolves work without owner credentials (CO-071/072/073) |
| 4 | **Federate and host selectively** — personal estates, A2A slots and delegation, per-binding placement beyond local (M39–M41) | second provider/runner passport plus ADR-0026 fixtures pass |
| 5 | **Open ecosystem** — public registry, signing/provenance, marketplace economics | CO-080, privacy/export and production SLOs accepted |

## Where this file sits

The backlog (`docs/evidence/backlog.md`) maps milestone rows onto these slices and
stays the task-state register; this file owns the sequencing narrative. Where the two
disagree, the backlog's status column is the fresher fact and this file gets amended in
the same change that moves it.
