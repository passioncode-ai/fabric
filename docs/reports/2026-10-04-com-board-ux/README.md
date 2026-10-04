---
report:
  id: fabric/2026-10-04-com-board-ux
  title: "Fabric communication board: proposed operator paths and execution packets"
  kind: research
  project: fabric
  domains: [ai-agent, automation, mcp, observability]
  as_of: 2026-10-04
  status: draft
  valid_until: 2026-11-04
  summary: >-
    Proposed COM-06/07 UX keeps the Project address durable while responders change.
    Messages, operator questions, tasks and obligations retain separate lifecycles.
    Participant-scoped reads, explicit unknown outcomes and accessible causal history
    precede board implementation; Telegram remains an optional mirror.
  sources:
    - {name: "Fabric inspected source", url: "https://github.com/passioncode-ai/fabric/tree/7011ce429d2593951b9d99940f78ab5850f17309", read_at: 2026-10-04}
    - {name: "COM-01–03 source research", path: "docs/handoffs/2026-10-04-comms-core-research.md", read_at: 2026-10-04}
    - {name: "A2A context and task developer thread", url: "https://github.com/a2aproject/A2A/discussions/762", read_at: 2026-10-04}
    - {name: "A2A specification pinned snapshot", url: "https://github.com/a2aproject/A2A/blob/fe182ee3c053d2e6a3ad2576c959fa5f7d8b5d07/docs/specification.md", read_at: 2026-10-04}
    - {name: "OpenTelemetry span links", url: "https://github.com/open-telemetry/opentelemetry.io/blob/e644265b718017bdb4fcc8ffe756f90d0c7e7e16/content/en/docs/concepts/signals/traces.md", read_at: 2026-10-04}
    - {name: "W3C accessible feed pattern", url: "https://www.w3.org/WAI/ARIA/apg/patterns/feed/", read_at: 2026-10-04}
    - {name: "W3C status messages", url: "https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html", read_at: 2026-10-04}
    - {name: "W3C pause stop hide", url: "https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html", read_at: 2026-10-04}
    - {name: "Anthropic multi-agent engineering", url: "https://www.anthropic.com/engineering/multi-agent-research-system", read_at: 2026-10-04}
  produced_by: {agent: Codex, task: "COM-06/07 future UX research; root/com_board_scenarios"}
  supersedes: []
  consumers: [fabric, fabric-agent-adapter, fabric-dashboards, fabric-switchboard, project-observatory, fabric-workspace]
---

# Fabric communication board — proposed UX

## Main finding and scope

Fabric should own one Project-addressed communication history and its operator interface.
A responder is a currently authorised consumer instance; the Project is the address.
Claude ending and Codex starting changes the consumer generation, not the recipient or
past author. Telegram projects admitted board events outward and brings allowed replies
back through Fabric. The board remains usable with Telegram disabled.

This report is **decision input**, not a new contract, canonical scenario source, runtime
capability or task-status register. All proposed cases are draft, coverage none yet,
product unobserved. Task status remains in the [COM execution spine](../../evidence/plans/2026-10-04-project-communications.md).
Root is correcting optional Telegram dependency edges in its convergence branch; this
report neither copies those rows nor changes them. The [scenario proposals](proposed-paths.md)
and [bounded packets](execution-packets.md) are inputs to COM-06/07. Scenario, story, flow
and screen IDs must be allocated against the then-current canonical UX files, never
reserved by this research branch. No UI was rendered or screenshot produced in this run.

**Vision alignment:** preserves the Project as the durable operating unit and makes
provider replacement independent of purpose, authority and history, serving
[vision §§3–5,9](../../ux/vision.md). Existing P-01/P-02 operator/admin and P-03 participant
roles provide the design vocabulary, not proof role controls already exist. Existing
ST-002/007/030/034/045/048 and JTBD-02/03/07/08 cover replacement, boundaries, sourced work,
external participation and trace reading; Telegram adds an explicitly optional channel.

## Source-bound baseline

Source inspected: **7011ce429d2593951b9d99940f78ab5850f17309**. Links below are immutable;
line/byte inventory is [raw/baseline.json](raw/baseline.json). Working-tree fixes visible in
root's separate branch were not treated as committed functionality.

| Seam at inspected commit | Existing behaviour / limit | COM extension, proposed |
|---|---|---|
| [shared/board.ts](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/shared/board.ts#L1), [SCR-41](../../ux/screens.md#scr-41-ranked-board-and-question-detail) | Ranked union of authored questions and derived obligations; no generic `seen` or dismiss | Keep those lifecycles. Communication threads use their own typed identity/query; actionable exceptions enter attention as derived obligations |
| [BoardScreen.tsx](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/renderer/src/launch/BoardScreen.tsx#L1), [components/Board.tsx](../../../apps/desktop/src/renderer/src/components/Board.tsx) | Ranked Board and task Kanban are already separate; existing question topic commands are not arbitrary messages | One Fabric navigation surface can offer Communications without reusing `addTopic`, answer or task move as message submit/read/complete |
| [types.ts FabricApi.board](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/shared/types.ts#L1080), [preload board/hub](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/preload/index.ts#L95) | Renderer bridge exposes board commands and product-hub operations | Add narrow participant-authorised communication read/command channels; retain current APIs for old clients |
| [main/index.ts feedReplay](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/main/index.ts#L3849), [App.tsx](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/renderer/src/App.tsx#L329) | Estate replay drives renderer refresh; UI retains latest 500 events, not complete history | Do not expose this replay to project consumers or call the local 500 rows full history. Dedicated scoped cursor/query supplies history and recovery |
| [shared/readEnvelope.ts](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/shared/readEnvelope.ts#L45) | Availability/freshness/source receipts distinguish unknown from zero | Reuse for list, responder and history reads; missing source means unavailable/partial, never zero messages or no responder |
| [entityRef.ts](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/shared/entityRef.ts#L35) | Exhaustive typed refs; no communication/thread kind | Add approved COM entity kinds and exact resolver destinations; unknown/refused target must not fall back to another project |
| [AgentAccessPanel.tsx](https://github.com/passioncode-ai/fabric/blob/7011ce429d2593951b9d99940f78ab5850f17309/apps/desktop/src/renderer/src/AgentAccessPanel.tsx#L146), [hubTools.ts](../../../apps/desktop/src/main/hubTools.ts) | Hub grants address cloud-product calls, not Project participation | Separate consumer enrollment and current responder grants; product access or registry discovery must not imply mailbox permission |
| [continuationDelivery.ts](../../../apps/desktop/src/main/continuationDelivery.ts), [deliveryQueue.ts](../../../apps/desktop/src/main/deliveryQueue.ts) | Task/decision-bound delivery and transient PTY queue | Reuse uncertainty discipline, not entity IDs or process memory as durable mailbox |
| [canonical UX chain](../../ux/scenarios.md), [model](../../ux/product-model.json) | SCN-041 task board, SCN-050 answers/delivery, SCN-061 replacement, SCN-067 admission, SCN-115/116 traces, SCN-132/133 consent/connect | Extend exact relevant scenarios plus new message-only cases after COM-01 decisions; regenerate model/product/coverage in the same implementation iteration |

The absent paths `shared/ipc.ts` and `main/boardService.ts` were checked and not found;
IPC constants live in `shared/types.ts`. No implementer should be sent to fictional seams.
For storage/admission, read the [COM-01–03 source map](../../handoffs/2026-10-04-comms-core-research.md)
with its explicitly older baseline, then reconcile it with the candidate.

## Primary research and inference

All sources were read 2026-10-04. [raw/sources.json](raw/sources.json) preserves exact URLs,
fetch dates, publisher/thread dates, pinned Git revisions and bounded excerpts. Dates
refer to source publication/update, not implementation acceptance. Forum posts are
individual developer observations, not normative specifications.

- [A2A discussion #762, 2025-06-17 through 2025-08-03](https://github.com/a2aproject/A2A/discussions/762)
  distinguishes conversation context from task identity and exposes privacy concerns
  around lookup. The later reply points to server-generated identifiers. The
  [pinned specification](https://github.com/a2aproject/A2A/blob/fe182ee3c053d2e6a3ad2576c959fa5f7d8b5d07/docs/specification.md)
  permits multiple tasks within context and treats terminal tasks as terminal.
  **Our inference:** a thread, request and consumer session need separate identities;
  knowing an ID is not authority. Do not reactivate a completed request when a new
  responder appears, or present A2A context as an Estate selector. This is MCP-first
  Fabric design; no claim that A2A interoperability has shipped.
- [OpenTelemetry trace concepts at e644265](https://github.com/open-telemetry/opentelemetry.io/blob/e644265b718017bdb4fcc8ffe756f90d0c7e7e16/content/en/docs/concepts/signals/traces.md)
  uses links to connect asynchronous operations across traces. **Our inference:**
  show message/reply/request/attempt/replacement edges explicitly. Time adjacency,
  same provider label or matching text does not establish causation. The graph is a
  projection; the accessible event list is an equivalent way to inspect it.
- [Anthropic engineering, 2025-06-13](https://www.anthropic.com/engineering/multi-agent-research-system)
  describes tracing decision/interaction patterns while preserving conversation
  privacy and coordinating deployments around stateful agents. **Our inference:**
  metadata inspection should work without dumping every transcript; source baseline
  and permissions remain visible during upgrade/replacement. This is a useful design
  precedent, not proof Fabric has the same behaviour or measured benefit.
- [W3C APG feed pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)
  requires coordination between focus and dynamic article loading. **Our inference:**
  first implement stable paginated lists with explicit load-more. Adopt feed semantics
  only when actual focus/reading-cursor behaviour is tested; cosmetic `role=feed` is
  insufficient. Pinning the focused row must survive incoming events.
- [WCAG 2.2 status message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  covers programmatically exposed status without changing focus and warns about noisy
  live regions. **Our inference:** announce command result and important unread
  exception once; aggregate routine traffic in a polite summary, never read every token.
- [WCAG pause/stop/hide guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
  addresses auto-updating content. **Our inference:** separate Pause display (local
  rendering freeze; ingestion continues) from Stop discussion (authorised durable
  policy command) and Cancel request (its own current-state command). Reduced motion
  disables animation, not data freshness.

## Upstream requirements before COM UI can be safe

These are proposals requiring COM-01 decisions, not a second normative schema:

1. **Address and provenance:** estate/project/capability address, server-owned principal,
   consumer instance and generation; provider name plus evidence class (`asserted` vs
   runtime-observed); source and received time separate. PID/heartbeat prove an
   observation at a time, not continuing authority. Replacement event retains prior
   author and states eligibility of each outstanding request.
2. **Separate state axes:** message admitted/read; request lifecycle; delivery claim/ACK;
   effect result; mirror transport. A successful database append cannot paint Accepted,
   Executed or Telegram delivered. A receipt can be committed while a refresh is stale.
3. **Participant-scoped reads:** sender and recipient history policies; privacy-safe
   filter facets, counts, search snippets, cursor/reset and deep links. An opaque signed
   global sequence can still leak other projects' traffic. Unauthorised/missing objects
   need indistinguishable error shape; no neighbour names or hidden totals in omission.
4. **Allowed actions:** server returns current action eligibility and reason plus
   revision/fence; every write rechecks it. UI permission is guidance, not enforcement.
   Reader cannot inherit owner rights; external product binding is not enrollment.
5. **Unknown effect:** result/attempt identity, before-effect boundary, reconciliation
   evidence and ruling authority. Old accepted/unknown work is not automatically
   reassigned or safely retried. New generation may inspect only admitted scope.
6. **Durable causal references:** reply parent, related canonical owner task, request,
   delivery/attempt, originating transport, correction/supersession and explicit causal
   edges. Trace IDs are correlation only. History may retain a redacted/tombstoned body
   without erasing the fact of an admitted event.
7. **Freshness and restore:** server watermark, reader/filter epoch, omission reason,
   heartbeat observed age and authorised catch-up. Restored history does not mint live
   authority or reactivate an outbox. UI says Historical until fresh enrollment succeeds.
8. **Telegram disclosure:** enrolment revision, numeric chat/topic/actor scope, rendered
   disclosure preview, canonical-to-external message map, origin/echo tags and separate
   mirror state. Chat deletion/revocation stops future disclosure without claiming old
   posts vanished. Optional transport remains absent from core readiness checks.

Sent immediately to root and the graph/compiler researcher: Board lifecycle seam and
privacy-safe cursor/count requirements. Root acknowledged separate projection/entity
and no implicit seen/dismiss. Compiler researcher acknowledged owner-qualified task
references create no messaging permissions. [raw/coordination.json](raw/coordination.json)
records these self-reported messages; it is not an authenticated all-session ACK receipt.

## Proposed structure and open choices

Entry: existing Project → Board navigation → Communications, retaining operator
Needs you and task Kanban as distinct views. Estate view aggregates only authorised
Project messages and pending findings. Project address stays in header/composer;
current responder is a secondary sourced indicator, never a destination selector by
provider name. List → exact thread/detail → receipts/chain → linked task/run/artifact.
Back restores filter, selected row, scroll and draft to the original Project.

Core has these paths: first enrollment; request and reply; work/dependency awareness;
replacement; unknown-effect intervention; history/chain; privacy refusal; degraded
catch-up. Optional Telegram adds enrollment/disclosure and stopping a discussion.
[Proposed paths](proposed-paths.md) enumerate each action and recovery, with no fabricated
canonical IDs. [Packets](execution-packets.md) spell out artifacts, prerequisites,
write boundaries, negative tests and resume steps.

Open product choices: default Project-vs-Estate entry; notification grouping; locally
persisted draft sensitivity/retention; heartbeat stale threshold; initial page/window
budgets; mirror redaction rules; who may rule an unknown effect; archived Project read
policy. Missing decisions block only dependent controls. The storage research's 64KiB,
8 artifacts, page100, 60s lease/20s renew/30s poll are **proposed Fabric bounds**, not
published third-party limits. This report does not settle them.

Prototype implementation follows scenarios and uses a prominent demo label. Accepted
mock data never raises Coverage/Product. Canonical strings require `copywriting` with
`docs/brand/{voice,terminology,facts}.md`; appearance/motion requires `sheleg-design`
and measured design-tool inventory. Neither lane was run here: this research makes no
new palette, spacing, motion styling or shipped interface text decision.

## Verification and exact next task

Executed: baseline-file/hash/anchor inventory, primary-source retrieval, report-header
validation, report-relative-link validation and task-owned whitespace/privacy checks.
Receipts are [raw/checks.json](raw/checks.json). No new runtime tests were invented for
this report-only change. Root owns the shared map, full fast gate, final common plan,
canonical UX edits and one wiki report-index publication at convergence.

NOT_RUN here: renderer/prototype execution, native Electron, VoiceOver, live
Claude/Codex board participation, Telegram enrollment/transport, migrations, builds,
installed-byte acceptance, hosted CI and public website. A pushed proposal branch is
only a handoff. No COM task closes from it.

**Exact next task:** root contract owner reviews requirements1–8 against COM-01–03,
records decisions/blocked controls, then the UX implementer executes packet06.A to
reserve current canonical identifiers and trace each accepted path before UI work.
Root merges this report with a same-iteration map entry and complete source gate;
then COM07.A begins a scoped read-only list using real COM02 fixtures.
