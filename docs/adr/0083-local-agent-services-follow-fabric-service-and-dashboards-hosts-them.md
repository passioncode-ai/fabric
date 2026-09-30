# ADR-0083 — Local agent services follow `fabric-service/0.1`; Fabric Dashboards is their host

**Status:** accepted architecture across repositories; the Fabric kernel is unchanged.
**Date:** 2026-09-28. **Decided by:** the operator, approving the
[Fabric Dashboards design](https://github.com/passioncode-ai/fabric-dashboards/blob/main/docs/design/2026-09-28-fabric-dashboards-design.md)
(stage-2 gate of that run) and choosing the three homes for protocol, skills and app.
**Normative text:** Fabric Agent Contract `docs/specification/service.md`, DEC-0015
(branch `agent/fabric-service-m1`, PR #6). Changes no meaning of Project, Provider, Agent or
Binding; discovery through a descriptor grants no Project access.

## Context

The local agents on the operator's Mac each ran a dashboard with its own health shape, start
method and state location. Six live services answered six different health contracts; none
guaranteed one copy before side effects; two defaulted to ports another service held; one
stray server listened on every interface. Nothing could find them, so the operator opened a
browser tab per port.

## Decision

1. A long-running local agent process is a **service** and follows the `fabric-service/0.1`
   extension of the Fabric Agent Contract: an installer-written descriptor, an unauthenticated
   well-known document with build identity, pid and `degraded`, a token-gated events feed, and a
   one-time operator login code. A port is a machine-wide claim; the instance lock comes before
   any side effect; launchd is the only supervisor; state never lives in the service's code.
2. **Fabric Dashboards** is the toolkit product that hosts them — a separate desktop app, not a
   kernel feature (ADR-0070). It never starts a service process; Stop is `bootout` + `disable`.
   The kernel keeps no always-on process (ADR-0037, ADR-0052 are unaffected) and ADR-0031's
   rejection of a local web dashboard as *Fabric's* v1 surface is unaffected.
3. The rules an agent author follows live in the `building-fabric-services` skill of
   `fabric-agent-adapter`, with Python and Node reference kits and the `check_service.py` probe.
4. The name is **Fabric Dashboards**, never "Boards": "the Board" is the operator's decision
   queue (ADR-0035).

## Consequences

- Project Observatory's server was migrated (PR #75 in `project-observatory-dashboard`).
  Agents that an operator builds for themselves implement the protocol in their own
  repositories; they are not PassionCode.ai products and are never named in its artifacts.
- A kernel that later wants to show services reads the same descriptors and well-known
  documents; it does not need a second protocol.
- Index of the cross-repository run: `org-index/docs/runs/2026-09-28-fabric-dashboards/`.
