# ADR-0123 — The conversation is the runtime's own console, and the CEO is a session

**Status:** accepted · 2026-10-06 · operator decision for Fabric's first version, relayed by the
fabric-dashboards session and confirmed by the operator in this session («Подтверждаю, CEO — сессия»)
· plan row P-13 · **supersedes the chat parts** of [ADR-0065](0065-conversation-led-work-and-context-bundles.md)
(§3 "an addressable CEO conversation", §5 "the floating CEO") and of
[ADR-0067](0067-conversation-context-and-typed-chat-widgets.md) (Fabric's own conversation, its context picker and
typed chat widgets); both records stay unchanged as history.

## Context

Fabric 0.3.x ships its own chat: `apps/desktop/src/renderer/src/CeoChat.tsx`, a CEO conversation host
(`apps/desktop/src/main/ceoConversationHost.ts`, `ceoConversationService.ts`, `ceoChatBinding.ts`) and its private
archive (`ceoPrivateArchive.ts`). ADR-0065 and ADR-0067 made that conversation the centre of work: Board questions
open CEO conversations, and typed widgets render commands inside it. Meanwhile ADR-0119 made every coding agent a
runtime Fabric launches in its own console (Claude Code, Codex, Hermes, Kilo, Cline), and the vision already says
"a chat is an execution surface, not the home of purpose or history" (`docs/ux/vision.md` §5.1).

The operator decided on 2026-10-06 that Fabric does not build its own chat. Fabric Dashboards follows the same
rule: its side panel becomes an embedded terminal running the runtime's CLI in the service's folder.

## Decision

1. **Talking to an agent is the agent's own interface.** Fabric opens the runtime's console — Claude Code, Codex
   or another installed runtime — and the conversation happens inside it, unchanged. Fabric renders no second chat
   surface and no chat widgets.
2. **The CEO is a session, not a chat window.** "Fabric, the CEO agent" (ADR-0057, ADR-0090) is a runtime session
   Fabric launches with its surface (the board, memory, decisions and the hub's tools) and its context bundle; the
   person talks to it in that runtime's console. Its name and role stand.
3. **Everything Fabric adds is the harness around sessions:** launching and stopping them, the account and
   permission binding, the context bundle, the board and its questions, control (grants, refusals, approvals),
   management (projects, routines, pipelines) and monitoring (runs, traces, quota, diagnostics).
4. **A Board question opens a session, not a conversation view.** Its proposed outcome still becomes a validated
   command with a receipt (ADR-0065 §3–§4 stand for the command, the receipt and what may not resolve a question);
   only the place the discussion happens changes.
5. **Other surfaces slot in as launchers.** Fabric Dashboards' terminal panel is a session Fabric's harness can
   launch and control once the harness and board are ready; it is not a chat either.

## Consequences

- `CeoChat` and the CEO conversation host are retired in the release after 0.3.2 (plan P-13); 0.3.2 ships them
  unchanged, because it is a fix release already under verification. The private archive of existing CEO
  conversations stays readable and exportable until P-13 decides its migration — nothing a person wrote is deleted.
- Scenarios, flows and screens that draw the CEO chat, its context picker or chat widgets (ADR-0065's and
  ADR-0067's propagation lists, SCR-27/40/41/44, `scripts/product/chat-workspace.mjs`) are re-drawn as session
  launch and monitoring in P-13, through the UX chain.
- No conflict with ADR-0119 (runners are consoles), the vision's principle 1 or its anti-vision ("a multi-chat
  cockpit"): the operating unit stays the Project, and sessions are its execution surface.

## Amendments

### Amendment 1 — 2026-10-08: the retirement moves after 0.3.3

The operator set 0.3.3's scope on 2026-10-08 (decision D4 of the
[onboarding brief](../evidence/plans/2026-10-08-onboarding-four-actions.md)): what is done since 0.3.2 plus the
four onboarding actions ([ADR-0129](0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md)).
Retiring `CeoChat` (P-13) was not in it, so "the release after 0.3.2" becomes **the release after 0.3.3**. 0.3.3
applies this decision to the new agent actions — they run in the coding agent's console — and still ships the CEO
chat, reached from «Discuss with Fabric ↗» on the launch screens as the prototype draws it. Found by the 0.3.3
verification, iteration 1 (PL-1): the plan still dated the retirement to 0.3.3.
