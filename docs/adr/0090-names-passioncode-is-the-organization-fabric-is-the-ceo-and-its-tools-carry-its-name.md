# ADR-0090 — Names: PassionCode.ai is the organization; Fabric is the product and CEO agent; Fabric's tools carry its name

**Status:** accepted narrative decision; no identifier, data store or authority boundary changes.
**Date:** 2026-09-29. **Decided by:** the operator, in the agent-registry run of 2026-09-29
(brief OS-12 and Q8, [brief](../evidence/specs/2026-09-29-agent-registry-brief.md)).
Complements [ADR-0086](0086-positioning-names-teams-and-the-public-tools-are-source-available.md),
whose positioning and licence wording stay as they are. **Supersedes** the product claim of
[ADR-0018](0018-passioncode-is-the-product-fabric-is-the-kernel.md) ("PassionCode.ai is the user-facing product; Fabric
is not the product brand") and the matching sentence of
[ADR-0057](0057-the-ceo-agent-is-named-fabric.md) ("PassionCode.ai stays the user-facing product
and platform"). Neither record is edited.

## Context

Eleven repositories were read at `origin/main` on 2026-09-29 (brief §8). All of them call Fabric
the CEO agent, and none of them tells the rest of the story the operator gave: PassionCode.ai is
the **organization**; Fabric — the desktop app and its engine — is the CEO agent that plans,
manages agents, runs projects and works with data, and it grows by adding its own tools (Fabric
Inbox, Fabric Dashboards, …); the Fabric Agent Contract and the Fabric Agent Adapter exist so that
any agent is compatible with it; Fabric Workspace is the wiki where how everything works is kept.
Several surfaces still say the opposite: "PassionCode.ai is the user-facing product" (ADR-0018,
ADR-0057), "Vision — PassionCode.ai, powered by Fabric" (`docs/vision.md`), "Fabric — the kernel
behind PassionCode.ai" (`package.json`), "a new Fabric organization project" (Switchboard), and
Inbox and Switchboard described as independent of Fabric rather than as its tools.

## Decision

| Entity | Name | Rule |
|---|---|---|
| The organization | **PassionCode.ai** (short form PassionCode, ADR-0086) | the company: domain, GitHub organization, npm scope `@passioncode-ai`, bundle-id root `ai.passioncode.*`, licences, the design system, the launcher. Its positioning stays "A toolkit for AI-native teams." and "The agent-agnostic operating system for AI-native teams." (ADR-0086). Never the name of an app. |
| The product and CEO agent | **Fabric** | the desktop app and its engine; "Fabric kernel" appears only in technical documents. The app's bundle id stays `ai.passioncode.desktop` (ADR-0070 froze identifiers). |
| Fabric's tools | **Fabric X** — Fabric Inbox, Fabric Dashboards, Fabric Switchboard, Fabric VR | the first paragraph of each README says what the tool adds to Fabric and that it also works on its own. The short form (Inbox, Dashboards, …) only after the full name has appeared. |
| The compatibility layer | **Fabric Agent Contract**, **Fabric Agent Adapter** | "makes any agent Fabric-compatible". Protocol ids stay lowercase: `fabric-service/0.1`, `fabric-interop/0.1`. |
| The knowledge base | **Fabric Workspace** | the wiki of how every tool works (MCP, protocols, agents); documents stay beside their code and are published there (brief Q7). |
| Organization products that are not Fabric's tools | their own name, "by PassionCode.ai" | Project Observatory keeps its name, described as Fabric-compatible and Fabric's observe layer that also works without it (brief Q8). |

## Consequences

- Fabric's narrative gate (`scripts/check-narrative.sh`) refuses the retired framing — PassionCode.ai
  as "the product", "powered by Fabric", "the kernel behind PassionCode.ai", "Fabric organization" —
  on every surface it reads, and the glossary (`CONTEXT.md`) states the table above.
- Every family repository's README first paragraph and `AGENTS.md` follow the table (module AR-0 of
  the [agent-registry plan](../evidence/plans/2026-09-29-agent-registry-plan.md)).
- The leftover `/Applications/PassionCode.app` (0.1.0, the same bundle id) is removed from the
  operator's Mac so LaunchServices sees one app.
- Dated records and earlier ADRs keep the wording of their day. Reversal requires a new ADR and the
  same coordinated update.
