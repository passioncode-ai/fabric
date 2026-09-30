# Provider views are sandboxed extensions; workspace layout is host-owned

- **Status:** Accepted
- **Consequences / affects:** `CONTEXT.md`, `docs/architecture/passioncode-platform.md`,
  `docs/architecture/agent-composition.md`, `docs/ux/`, future host and provider SDKs
- **Source:** operator workspace/widget scenario, 2026-08-29; MCP Apps specification
  reviewed 2026-08-29

An agent or skill may contribute an interactive view to a person's workspace, but it
does not own the host application or receive ambient access.

1. The interoperability boundary is **MCP Apps-compatible**: the provider references a
   UI resource, the host renders it in a sandbox, messages cross a typed JSON-RPC bridge,
   and the host remains the authority for tool calls and permission prompts.
2. Every provider view supplies a structured, non-interactive fallback. A missing UI
   extension can reduce fidelity, but cannot make the work, evidence or approval
   inaccessible.
3. PassionCode.ai owns workspace composition: placement, sizing, responsive behaviour,
   accessibility, visibility by membership/role, saved layouts and removal. A provider
   owns only the content inside its allotted surface.
4. Views read projections and request actions through declared tools. They do not query
   the store, vault or another widget directly, and they receive only the task/project
   context granted to that view instance.
5. View code and requested capabilities are versioned with the provider revision and
   re-reviewed on material change. Content security policy, origin isolation and audit
   events are host obligations.

The exact v1 layout — constrained grid or free-form canvas — remains CO-076. This ADR
settles the security and ownership seam without prematurely settling the interaction
model.

