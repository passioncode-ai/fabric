# P05.3 · Claude structured lifecycle packet

Status: **control transport and pure event normalizer implemented; owned native producer and native conformance remain open**. [Provider architecture](providers.md), [R0 entry](README.md). Read-only research 2026-09-27: installed CLI `2.1.283`; official Python SDK `0.2.160` at `36f95486ee9fc49d8ee1ed56811f07b5e8e23ac6`. A field in that SDK is not evidence of the installed CLI's behavior. No real sessions, accounts, private config or inference were used.

## Wire expectations and exact attribution

Claude uses JSONL with `control_request` / `control_response`, **not Codex JSON-RPC**. Share bounded framing and permission principles, not the Codex envelope parser. Commands contain an owned request ID and `request.subtype` (`interrupt`, or `stop_task` with `task_id`); the response carries the matching `request_id` and success/error subtype. Interrupt has no session/turn address, so ownership of the exact connection and host-request epoch must be checked at the write itself. See pinned [protocol types](https://github.com/anthropics/claude-agent-sdk-python/blob/36f95486ee9fc49d8ee1ed56811f07b5e8e23ac6/src/claude_agent_sdk/types.py#L2441) and [query implementation](https://github.com/anthropics/claude-agent-sdk-python/blob/36f95486ee9fc49d8ee1ed56811f07b5e8e23ac6/src/claude_agent_sdk/_internal/query.py#L706).

| Observation | Expected fields / Fabric interpretation |
|---|---|
| `system/init` | Compare observed `session_id` to expected conversation. Initialize control ACK does not replace session observation. |
| User input | `type:user`, message role/content, session ID, parent tool reference; allocate a host request UUID/epoch and serialize human requests. |
| `result` | Session ID, subtype, `is_error`, optional UUID/terminal reason/origin. Root turn completion only. |
| `system/task_started` | Task/session IDs, UUID and optional tool/type metadata; register ownership before accepting its later completion. |
| `task_notification` | Terminal statuses include completed/failed/stopped; correlate exact owned task. |
| `task_updated` | Patch status may be completed/failed/killed; a killed patch can be the only terminal notification. Session/UUID may be absent: only the owned task registry can attribute it. |
| `session_state_changed` | idle/running/requires_action are observations; idle is not an exhaustive writer proof. |

Sources: [client message formation](https://github.com/anthropics/claude-agent-sdk-python/blob/36f95486ee9fc49d8ee1ed56811f07b5e8e23ac6/src/claude_agent_sdk/client.py#L272), [parser](https://github.com/anthropics/claude-agent-sdk-python/blob/36f95486ee9fc49d8ee1ed56811f07b5e8e23ac6/src/claude_agent_sdk/_internal/message_parser.py#L226), [session guide](https://code.claude.com/docs/en/agent-sdk/sessions#capture-the-session-id).

No native turn identifier was confirmed in these result types. Retain the shared contract's **host-request epoch**, not session-as-turn. Distinguish interrupted terminal reasons (`aborted_streaming`, `aborted_tools`) from normal completion. Injected task-notification, peer/channel and background turns require origin attribution; malformed origin must remain invalid/unknown. The convenience Python parser drops some user-envelope fields and normalizes malformed origin to absent, which is insufficient for Fabric's strict attribution. Normalize raw JSON before such parsing. Pinned [origin types](https://github.com/anthropics/claude-agent-sdk-python/blob/36f95486ee9fc49d8ee1ed56811f07b5e8e23ac6/src/claude_agent_sdk/types.py#L1048). Full current TypeScript replay shape was not confirmed (official-page size limit/direct HTTP403); do not invent `isReplay` semantics from a third-party mirror.

## Stop and resume boundaries

The SDK completion ledger intentionally tracks only selected local task types. Shells, monitors, teammates and remote work are not an exhaustive census; `background_tasks_changed` can omit active work. Neither an empty ledger nor idle/EOF is global quiescence. Pinned [implementation and commentary](https://github.com/anthropics/claude-agent-sdk-python/blob/36f95486ee9fc49d8ee1ed56811f07b5e8e23ac6/src/claude_agent_sdk/_internal/query.py#L870). Preserve unknown writers until separate coverage evidence exists.

Use exact `resume=session_id`; latest/continue and implicit fork cannot substitute for an addressed continuation. The recorded system-prompt snapshot can be reused on resume even when launch text changes. No manifest/policy digest ACK was found in the inspected API; it remains a separate Fabric probe. Pinned [snapshot contract](https://github.com/anthropics/claude-agent-sdk-python/blob/36f95486ee9fc49d8ee1ed56811f07b5e8e23ac6/src/claude_agent_sdk/types.py#L58).

Installed `claude attach --help` states that leaving the terminal view leaves its background session running; `--bg --resume` can duplicate active work. These modes need separate ownership acceptance. Structured owned stdio is a candidate managed profile; native TUI attachment is not transparently interchangeable. The UI presentation decision remains open until terminal-flow probes. SIGTERM can leave an unfinished turn without result; typed interruption must precede destroying control transport. [Official headless lifecycle](https://code.claude.com/docs/en/headless#stop-a-run-with-sigterm).

## Ordered implementation packets

1. Claude JSONL transport: exact control envelopes, bounded framing, unique IDs, sanitized errors, current write fence, no automatic resend after lost response. Share lower-level helpers only after proving both protocols' differences.
2. Raw-event normalizer: exact session + connection + host-request UUID, origin validation, terminal reason and both task terminal forms. Bare patch cannot create ownership. Reconnect cannot erase known tasks.
3. Owned-task registry and controller: interrupt → stop known tasks → independent observation. Request success never becomes stopped. Partial census and missing load evidence remain unknown.
4. Fixtures: foreign session/task IDs, late prior-epoch result, injected turn, dropped ACK, missing session in patch, incomplete snapshot, conversation reset and background writer surviving root result. Preserve no raw body/path/token in evidence.
5. Exact installed-build isolated canary and real operator terminal flow. Update capability status only for observed scope; docs/fixture success never promotes native quiescence or policy load.

## Implemented control transport

[claudeControlTransport.ts](../../../apps/desktop/src/main/claudeControlTransport.ts), reviewed member [`498e6ef`](https://github.com/passioncode-ai/fabric/commit/498e6efa568cbf5572a2eba8c012ff3f143a460d), now implements the pinned SDK control envelopes over caller-owned byte streams. `interrupt` and `stop_task` require a synchronous literal-true authority check at write, within a monotonic deadline. Nested request IDs correlate replies; unsupported permission/control requests are denied. Framing, UTF-8, depth, bytes, fragments, pending requests and backpressure are bounded. Raw provider error prose is discarded; a success response produces only ACK.

[Fixtures](../../../apps/desktop/test/claude-control-transport.test.mjs) exercise malformed/foreign/late responses, async or revoked authority, timer starvation, slow writes, stream faults and explicit permission refusal. Independent rerun passed. No Claude process or model was invoked. This transport neither interprets event origin nor supplies task ownership, native quiescence or manifest loading. The pure event normalizer is described below; the owned supervisor remains a subsequent packet.

## Implemented event normalization

Reviewed source [71a0cc5](https://github.com/passioncode-ai/fabric/commit/71a0cc56e8ca63a3eaf49da1b8d2b15f6f53e2f0): [claudeProviderEvents.ts](../../../apps/desktop/src/main/claudeProviderEvents.ts), with [direct fixtures](../../../apps/desktop/test/claude-provider-events.test.mjs). The normalizer requires the observed session, exact connection and host-request epoch. Root results and task starts require separately attributed receipts; assigning every incoming result to the current request is forbidden. A missing session on a patch is accepted only for a previously owned task. Minimal validated lifecycle facts are fingerprinted before projection; raw descriptions, summaries, error prose and paths are not retained as evidence.

`task_progress` is a valid observation for an active owned task, with no invented terminal fact. Replay of the same progress after completion stays idempotent; a new progress observation after termination refuses. This distinction was found and corrected during independent review. Sequence gaps, conflicting duplicates and unsupported events refuse closed. The supervisor must route non-lifecycle messages explicitly rather than send an entire chat stream blindly to this normalizer.

The module cannot establish exhaustive writer coverage, native origin attribution or manifest loading. `result`, idle, task completion and control ACK remain different facts. Reconnect must preserve or resynchronize ownership; creating empty state is not proof that prior tasks disappeared. Next integration joins the controller and normalizer to an owned producer, then measures the exact installed build.

## Per-Stop control coordinator

`apps/desktop/src/main/claudeProviderControl.ts#createClaudeProviderControl` is constructed for each canonical Stop from the latest owned task roster, then frozen. Revalidate exact provider/connection/request epoch and current roster at every write. Interrupt the root and stop only explicitly owned active tasks; newly appeared/rebound/reopened tasks or partial inventory prevent quiescence. ACK is not termination evidence. Seventeen pure and owned-pipe scenarios are in `apps/desktop/test/claude-provider-control.test.mjs`; [integration checks](checks.md#capture-recovery-and-provider-topology). Native producer/supervisor is still required.
