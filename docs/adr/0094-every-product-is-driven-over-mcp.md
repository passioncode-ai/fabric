# ADR-0094 — Every product is driven over MCP

**Status:** accepted product principle.
**Date:** 2026-09-30. **Decided by:** the operator, requiring that every product be a working product
driven over MCP, 2026-09-30, consolidating brief OS-06/OS-13 and
[ADR-0090](0090-names-passioncode-is-the-organization-fabric-is-the-ceo-and-its-tools-carry-its-name.md)
(Fabric is the CEO the user talks to).

## Decision

1. **Every PassionCode.ai product exposes what it does as MCP tools**, so any agent — and Fabric,
   the CEO — can drive it. A capability with no tool is a gap, not a design choice.
2. **The interface is for seeing and for small corrections**; the work is asked of Fabric or of an
   agent in conversation, which calls the tools.
3. **Agents talk to agents over MCP** under `fabric-interop/0.1` (capabilities as tools, jobs,
   result envelope, trace context). Real A2A is a separate later track (brief CO-AR-01).
4. **Each product documents, in its README quick start, the registration command and one tool
   call that proves it works**, and that call is verified with a real client, not only an SDK
   (retro R-010).

## Consequences

- The repository standard (`fabric-workspace/knowledge/repository-standard.md`) makes the MCP
  quick start a required section; a product without MCP says what is missing and where it is
  planned.
- Today's gaps are listed in `knowledge/products.md`: Fabric's own northbound entry for other
  agents (plan AR-3), Fabric VR (relay, ADR-0088), Okolos, the site (no MCP; a site may stay so).
