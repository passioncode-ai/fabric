# ADR-0043 — The manager seat is a binding: the loop is selectable, the tools and the floor are not

**Status:** accepted · 2026-09-06 · rests on ADR-0010, ADR-0021, ADR-0039 · design in [`../architecture/agent-visibility-and-runs.md`](../architecture/agent-visibility-and-runs.md) §4

## Context

The operator wants the manager/CEO selectable — Fabric's built-in one or an
external agent such as Claude Code — which raises lifecycle questions: how to
wake it, how to verify it, how to pass data to and from it.

## Decision

1. **The manager is a ROLE BINDING** (ADR-0010): `role = manager`,
   `provider_ref = built-in | claude-code | codex | …`, placement per ADR-0021.
   Swapping the seat is re-binding, not re-architecting.
2. **What is fixed:** the deterministic core (rank, hygiene, criticality,
   digest), the checker with journalled refusals, the schema floor
   (`settle_by_citation` refuses a basis-less settlement), the trust ceiling,
   and the ONE manager tool surface. **What is selectable:** only the judgement
   loop above the tools. ADR-0039 is what makes this safe: auditability lives in
   the tools, so the loop above them may be anyone's — every settlement by any
   seat passes the same floor and lands in the same journal.
3. **Lifecycle by existing mechanisms.** Wake: the routine tick or a Board
   delta. Verify: the heartbeat (M178), the outside watch (M179 — an external
   manager is watched exactly like any agent, because it IS one), and the
   trajectory eval (M176) over its journalled tool calls. Data in: the MANAGER
   PACK — a context pack of the Board slice, open questions and trust level,
   lockfile journalled so "what did the manager know" stays answerable. Data
   out: **only through tools** — a manager's prose is not a channel.
4. **Cost is shown, not hidden.** An external seat spawns a session per wake;
   the built-in loop is in-process. The seat picker states the difference.

## Refused

- A second tool surface for external managers — one surface, or the guarantees
  fork.
- Trusting a manager's transcript as output — anything said outside the tools
  does not exist.
- A hardcoded manager — the binding is the seat, and the estate chooses.
