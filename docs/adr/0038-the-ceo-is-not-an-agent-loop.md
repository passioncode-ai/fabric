# ADR-0038 — The CEO is not an agent loop: arithmetic, four typed model calls, and the runner that already exists

**Status:** accepted · 2026-09-05 · extends [ADR-0036](0036-the-ceo-settles-what-it-can-cite-and-trust-is-autonomy-on-a-different-subject.md), rests on [ADR-0021](0021-execution-placement-is-declared-per-provider-binding.md) · design in [`../architecture/ceo-runtime.md`](../architecture/ceo-runtime.md)

## Context

ADR-0035 and ADR-0036 decided what the CEO does. The remaining question was what
executes it: an off-the-shelf agent runtime such as `pi`, a framework, a provider
SDK loop in the main process, or the PTY runner Fabric already spawns for coding
agents.

Every one of those answers assumes the CEO **is an agent loop**. Decomposing its
work says otherwise:

- withdraw stale questions, merge exact duplicates, recompute priority, settle by
  citing a keyed decision fact, score a decision change, compose the evening
  letter — **all arithmetic**;
- merge questions that are the same in different words, propose a re-order the
  arithmetic cannot express, draft an answer where no key matches, read a chat
  thread — **judgements, but each a single transform with a typed output**, not a
  goal pursued with tools until it is met.

There is no loop to host. Reasoned against the `agent-orchestrator` skill;
measured against this tree, where `pi` is **not installed** — the `~/.pi/agent`
directory was created by `obsidian-wiki setup`, whose agent list is fixed rather
than discovered.

## Decision

### 1. Three parts, and only one of them is an agent

- **Core** — deterministic modules in `shared/`, driven by the existing routine
  tick. This is the CEO as ADR-0036 defines it, and it ships with no provider.
- **Advisor** — four typed, single-shot model calls, present only when a provider
  is. Each **proposes**; none decides.
- **Delegation** — when real work is needed, the CEO creates a task and the PTY
  runner that already exists does it, inheriting the loop bound, the chain depth
  limit, the grant floor and the quota gate.

The orchestrator skill's §13 settles the shape: *static unless you can name what
forces dynamic — a graph that picks its own next nodes cannot be audited
afterwards.* ADR-0036 requires every CEO settlement to be cited and every
priority to carry its components. That is a requirement to be auditable, so it
decides the question.

### 2. The core is also the checker

§13 requires a checker before anything consumes a model-produced result, and the
skill's checklist adds that *a checker which has never rejected anything is a
finding*. Here it costs nothing: the deterministic half validates every advisory
output against facts — a proposed merge must name two questions that exist and
share a project; a drafted answer must cite a fact that exists and is current; a
re-order must move within a stated band.

A refused proposal is **journalled with its reason**, which is both the stored
verdict the checklist asks for and the evidence that lowers the CEO's trust level
when a provider misbehaves.

### 3. Written ourselves — a router and four functions, not a framework

| Refused | Why |
|---|---|
| `pi` or another coding-agent CLI **as the CEO** | it is a *runner*, and running the CEO on one hands a terminal, a working directory and file access to something whose job is to rank and cite |
| our own PTY runner | it returns a transcript, and *a return value proportional to the input is a function call wearing a costume*; it also spawns a process and mints a credential, per tick |
| Pydantic AI, LangGraph and the rest | a graph engine for four single-shot calls is ceremony, and they are Python — a permanent second runtime inside an Electron app |
| a provider SDK client in the main process | §6: **a router in front of the providers, not a provider client in front of the app** |

`pi` remains worth adding **as a third runner descriptor** in `shared/agents.ts`
if the operator wants it. That is orthogonal and does not touch the CEO.

### 4. `ModelPort | null` is the design, and null is a state

The port is a contract in `shared/` with one implementation in `main/`. With no
provider: the core runs unchanged, the advisory calls are **skipped rather than
stubbed**, and the interface names which capabilities are unavailable — never a
silent degradation.

The router carries the three traps §6 names, each a real bill: attempts capped
**in total** rather than per provider (three providers × three retries is nine
calls for one prompt); an unhealthy provider probed **on a schedule**, because a
check that only runs on failure never recovers and the chain runs one short with
every request still succeeding; and failover **between turns only**, because
reasoning carries a vendor credential and stripping it to move mid-turn is what
produces the 400.

Model, window and price resolve at **one boundary from configuration** — never a
table of vendor ids in source.

### 5. Placement is ADR-0021's, not a new concept

The advisor is a provider binding, and ADR-0021 already makes placement a
property of each binding: `local_harness`, `provider_managed`, `estate_managed`,
`platform_managed`. Today only `local_harness` exists — the Electron main
process, holding the key with the same custody as the Supabase service key. When
hosted estates arrive the binding's placement changes and the port does not.

### 6. None of the loop guards are implemented, and that is a decision

§2's list — in-loop trimming at 80%, wrap-up injection at 70%, a max-iteration
guard, an iteration refund on a recoverable error, budget awareness in the prompt
— are guards on a loop that decides its own next step. The CEO's calls have no
tools, take one turn and return a typed value: nothing to bound, no history to
trim, no context that grows.

**The moment any advisory call gains a tool it becomes a loop and inherits every
one of them.** Recorded so that day is a decision rather than a drift.

## Consequences

- **The product is complete without a provider.** Steps 1–3 of the build order
  are the whole CEO that ADR-0036 defines; the advisor is additive. That property
  is what made this shape worth choosing over a framework that would have
  required a key before anything ran.
- Every model call is journalled as `model.called@1` with provider, model, tokens
  and cost. §9 asks the observable feed to be *a view over a durable trace, never
  the record itself* — a stream nobody stored is a run `agent-evals` cannot
  evaluate — and the journal already is that trace.
- `quotaGate.ts` and `routine.ts` already prevent a CEO that burns budget
  re-ranking a board nobody opened. No new metering machinery.
- No new language runtime, no agent framework, and no second place where a model
  is called from.
- Each advisory call receives **only what its transform needs**, never the estate:
  a sub-agent's value is its own window, and a call handed everything has none.

## Refused

- **Hosting the CEO on any agent-loop runtime**, ours or a third party's. It
  cannot be audited afterwards, and being auditable is what ADR-0036 requires of
  every settlement.
- **A framework for four calls.** The smallness of the alternative is the
  argument.
- **Stubbing the advisor when no provider is present.** A stub returns something,
  and something is what a person acts on. Skipping is honest; stubbing is not.
- **Giving an advisory call a tool without re-reading §2.** It stops being a
  transform and becomes a loop, and the guards this ADR declined are the price of
  that change.
