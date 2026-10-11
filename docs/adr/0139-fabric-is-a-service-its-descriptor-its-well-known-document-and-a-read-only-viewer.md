# ADR-0139 — Fabric is a service: its descriptor, its well-known document and a read-only viewer

**Status:** accepted · 2026-10-11 · resolution R-04 of the
[0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#decisions) (the operator's request for a Fabric
agent in Fabric Dashboards showing the current tasks per project) · keeps
[ADR-0031](0031-the-v1-surface-is-a-macos-desktop-app-with-the-terminal-inside.md) (no local web dashboard of
Fabric's own) · follows [ADR-0083](0083-local-agent-services-follow-fabric-service-and-dashboards-hosts-them.md) ·
plan row P-16, canvas node C9, REQ-18.

## Context

Fabric reads other services' descriptors and publishes none of its own; its loopback port answers `/mcp` and the
product connect route only. Dashboards lists a service from its `fabric-service/0.1` descriptor and its
`/.well-known/fabric-service` document, and puts a product with no dashboard surface under Background. Fabric's reads
across projects exist (`board.query({projectId: null})`, `estate.summary`), but every agent-facing tool is scoped to
one project.

## Decision

1. **Fabric writes `services/fabric.default.json`** at start (and only when it changes): origin the hub's stable
   port, `lifecycle.manager: none` (Fabric is an app), a 0600 viewer token file, its data and log paths.
2. **The agent surface answers `/.well-known/fabric-service`** with tiles (running, in review, waiting on you,
   sessions with no project), events built from the feed sentences, and `surfaces.mcp` — a **read-only viewer
   server**: `fabric.work.overview` (per project: open tasks by state, claims, heartbeat age, open questions, live
   sessions) and `fabric.project.tasks`. A new scope kind, `viewer`, reads across the estate and writes nothing.
3. **No `dashboard` surface**: Dashboards lists Fabric under Background and draws the tasks-per-project view itself;
   it stores nothing.
4. When the hub falls back to an ephemeral port the well-known document is absent — Dashboards reads that as «no
   answer», not an outage.

## Consequences

- The descriptor writer, the well-known handler, the viewer scope in `scopedStore.ts`, the viewer server, and
  Dashboards' own row (its P-07.3).

## Evidence

- The manager-flow research, 2026-10-11 (the plan, canvas C9; Dashboards `packages/service-host/src/descriptor.ts`,
  `health.ts`, ADR-0012 §5, ADR-0016).
