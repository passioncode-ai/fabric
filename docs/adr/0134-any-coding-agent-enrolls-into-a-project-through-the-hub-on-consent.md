# ADR-0134 — Any coding agent enrolls into a project through the hub, on consent

**Status:** accepted · 2026-10-11 · operator decision D-03 of the
[0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#decisions) · extends
[ADR-0115](0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md) (a third principal beside the
door and the binding) · applies [ADR-0026](0026-fabric-exposes-a-project-scoped-policy-enforced-mcp-control-surface.md) (a binding
names a finite set of Projects) · plan row P-16, canvas node C1, REQ-01…REQ-04, REQ-33.

## Context

Fabric's working tools (`fabric_*`, `com.*`) are served only behind a per-session bearer minted for sessions Fabric
launches itself (`agentSurface.ts#mint`, scope `AgentScope`). The hub's door serves agents *registered* on the Mac
(`services/`, `providers/`) asking for a product, and nothing else (`hubTools.ts#HUB_TOOLS`). A coding agent the
person opens in a terminal therefore cannot report work, read the board or use memory; a static MCP registration
cannot work either, because the door token rotates per start and `hub.json` is removed at quit; Codex, Cline and Kimi
Code get no Fabric tools even when Fabric launches them (`shared/agents.ts`, `surfaceAdapter: 'none'`). The operator
chose (D-03) the full working set in a project, on one consent per agent and project.

## Decision

1. **`fabric-mcp`, a stdio launcher shipped with the app outside the asar** (macOS
   `Contents/Resources/bin/fabric-mcp`, Windows `resources\bin\fabric-mcp.cmd`, Linux `resources/bin/fabric-mcp`),
   reads `hub.json` on every connect, refuses a dead or foreign `pid`, reads the door token from the file `hub.json`
   names, and relays to the hub's origin exactly as written. A registration therefore holds no secret and survives
   restarts: `claude mcp add --scope user fabric -- <path>/fabric-mcp`, `codex mcp add fabric -- <path>/fabric-mcp`.
2. **Enrollment is a door tool**, `fabric.session.enroll {cwd, runtime, runtimeSessionId}`. Fabric resolves the
   folder to a Project ([ADR-0136](0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md)); without a standing
   grant for (runtime, project) it asks the operator once — the prompt names the agent, the folder and the Project,
   through the existing consent presenter. Allow mints a **session principal of its own kind**, served by a server of
   its own built from the same tool catalogue a launched session gets (`shared/surfaceTools.ts`), scoped to that one
   Project. ADR-0115's rule stands: authority is the server a principal is given; the door never serves session tools.
3. **The grant is standing and revocable** (Agents & access), per (runtime, project); every enrollment, renewal and
   revocation is journalled. A revoked grant refuses the next call.
4. **One catalogue, three ways in.** Launched sessions, enrolled sessions and sessions handed off by another
   product's console ([ADR-0140](0140-a-session-is-handed-its-context-in-one-format-session-handoff-1.md)) see the
   same tools; `fabric_whoami` returns the context pack's text itself, not a path an ACP runner may not see.
5. **Family products in sessions (CO-194).** A session's `mcp.json` may carry a product's server when the operator
   granted that product to that Project, consented in Agents & access; Fabric-launched sessions keep
   `--strict-mcp-config`.
6. **Codex, Cline, Kimi Code** reach the same set through `fabric-mcp`; a runner is marked connected only by a probe
   ([ADR-0119](0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md) §4).

## Consequences

- New tables for enrollment grants (grants and RLS in migration 4's shape), new `event_types` rows with feed
  sentences, a principal kind in `accessService.ts#HubPrincipal`, a branch in `hubTools.ts#hubServerFor`, its own
  budget key in `agentSurface.ts`.
- A port alone still proves nothing: `fabric-mcp` re-reads `hub.json` and checks the `pid` before every connect.
- The same-user floor (CO-090) is restated: any process of this user can read the door token; consent, not the
  token, is what admits a session.

## Evidence

- The harness audit, 2026-10-10 (the plan, F-01; `agentSurface.ts#mint`, `hubTools.ts#HUB_TOOLS`, `hub.ts#publishHub`, `hub.ts#withdrawHub`).
- CLIs measured 2026-10-11: Claude Code 2.1.296 `claude mcp add --scope user <name> -- <cmd>`; Codex 0.162.1
  `codex mcp add <name> -- <cmd>`.
