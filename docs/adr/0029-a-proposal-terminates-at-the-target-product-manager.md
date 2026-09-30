# ADR-0029 — A proposal terminates at the target Product Manager; the CEO is the residual route

**Status:** Accepted · **Date:** 2026-08-31 · **Source:** run `2026-08-31-iteration-ladder`,
accepting audit finding A7 · **Amends:** `work-producing-agents.md` §1 · **Extends:** ADR-0010, CO-067

## Context

Two recipient models were both stated as current. `work-producing-agents.md` §1 drew the
work-producing agent's proposal terminating at the **CEO** ("one decomposition authority
survives"), while the same document's §5, `project-workspaces.md` §7,
`mcp-control-surface.md`'s `fabric_proposal_submit` and `passioncode-platform.md` §9 all
route a proposal to the **target project's PM**, with the CEO receiving only what has no
deterministic route (CO-067). Left unreconciled, the first implementer picks one and the
second implementer picks the other.

## Decision

1. **Rule-first routing delivers a proposal to the PM of the project that owns the
   target.** The PM accepts, merges, refuses or supersedes it — once, recorded, with the
   observations preserved either way.
2. **The CEO receives only the residue**: a proposal whose target resolves to no owning
   project, or a genuinely cross-cutting one. The CEO also remains the authority that
   creates/retires projects and hires PMs — decomposition *within* a project was never
   its job (ADR-0010).
3. **The mitigation for PM queues stays what §1 proposed**: a per-department default
   autonomy for accepted proposals of a kind, so routine acceptance is a rule rather
   than a decision. That policy object lands with the proposals slice.

## Alternatives considered

- **CEO as single recipient** — rejected: the CEO becomes a queue (the cost §1 itself
  names), and every routine finding pays a two-hop latency for no added authority.
- **Direct goal/node writing by the producing agent** — already rejected by the CO-035
  answer: a node without a goal has no autonomy level for the floor to read, and a graph
  with two authors has none.

## What would reverse this

If per-department default autonomy proves insufficient and PM inboxes measurably drown,
a triage tier may be reintroduced — as a new record stating who staffs it, because that
is the CEO-as-queue cost coming back with a name.
