# ADR-0067 — Conversation context and typed chat widgets

Date: 2026-09-26. Status: accepted target design from operator request; native implementation remains open. Extends [ADR-0065](0065-conversation-led-work-and-context-bundles.md).

## Decision

A conversation has identity independent of the materials selected for its next message. Small context sets are directly toggleable; a large catalogue is searchable. “All” selects the currently available Projects, never future Projects or expanded permissions. Each Project contributes a bounded index of plans, decisions, main and related sources; a native context builder resolves relevant chunks under policy/budget.

A ticket retains one owning Project. Extra selected Projects are reference context. No command infers authority or multiple write destinations from a knowledge selection. A command widget binds its destination, revision, operation and relevant object identity (including Run ID for stop). Changing context cannot redirect an old command. Unknown/stale/duplicate results use the existing operation contract.

Sent messages preserve their context snapshot; accepted outcomes retain discussion evidence across refinements and pass references to Task/Run. “No context” removes selected project materials and pending attachments, not previously spoken content. A new conversation starts without that history; unfinished conversations remain reachable. Minimize never means discard.

Widgets are trusted, versioned renderers for typed data, not arbitrary model-generated executable HTML. The transcript carries the explanation, choices, preview, action receipt and recovery. Compact composer and context chips stay available. Native secret filtering happens before persistence and model dispatch; fixture filtering is not a security boundary.

## Evidence and boundaries

Implementation of the target interactions: `scripts/product/chat-workspace.mjs` (`chatWorkspaceState`, `chatWorkspaceSnapshot`, `renderChatWidget`) and `scripts/product/first-release.mjs` (`firstReleaseAction`, `r0Chat`). Negative verification: `scripts/test/chat-workspace.test.mjs`. Canonical intent: SCN-042; component contract and native packets: [conversation workspace](../launch/chat-workspace.md).

This updates the September 16 flow where changing scope returned a different conversation: in R0, selecting materials stays within the current conversation. Explicit history/new controls own conversation switching. Existing native Coverage stays unchanged. No task/provider schema or runtime implementation is declared by this ADR.
