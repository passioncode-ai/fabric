---
report:
  id: fabric/2026-10-04-local-agent-lifecycle
  title: "Local Claude/Codex lifecycle and Project responder handover"
  kind: decision-input
  project: fabric
  domains: [ai-agent, mcp, architecture, reliability, auth]
  as_of: 2026-10-04
  status: draft
  valid_until: 2026-10-11
  summary: >-
    Future COM-04/07 owner packets distinguish installation, hook trust,
    enrollment, runtime readiness, request acceptance and observed effects.
    Local CLI help and offline schemas were observed; real sessions, Desktop
    hooks, board exchanges and replacement acceptance were not executed.
  sources:
    - name: "Fabric source and preceding COM packets"
      url: "https://github.com/passioncode-ai/fabric/tree/95e942212f6cc2bdc7f7f274fbc93449c27f0457"
      read_at: 2026-10-04
    - name: "Official client references and primary developer threads"
      url: "raw/sources.json"
      read_at: 2026-10-04
  produced_by:
    agent: "Codex hub_docs_plan"
    task: "Bounded future COM-04/07 lifecycle research; no runtime activation"
  supersedes: []
  consumers: [COM-01, COM-03, COM-04, COM-07, COM-11, COM-12, COM-14]
---

# Local Claude/Codex lifecycle and Project responder handover

<sub>ssheleg skills — task-pipeline · agent-interop · evidence-docs · project-reports</sub>

This is a proposed implementation packet set, not a second editable backlog or a shipped
capability. Canonical task authority remains the [COM plan](../../evidence/plans/2026-10-04-project-communications.md).
Read alongside [RPT fabric/2026-10-04-project-communication-architecture §Acceptance decisions](../2026-10-04-project-communication-architecture/README.md#acceptance-decisions)
and the [ten COM-02/03 packets](../../handoffs/2026-10-04-project-comms-implementation-packets.md).
The public example is `example-agent`; private owner plans and consumer names stay with their owners.

## Decision inputs

Four boundaries block automatic adoption:

1. Adapter [AGENTS.md at 907acb28](https://github.com/passioncode-ai/fabric-agent-adapter/blob/907acb286abe55c627bfeb4500906b76d0284e81/AGENTS.md#lifecycle)
   declares skills-only installation with no hooks, server or background job. Shipping a
   poll/renew helper changes LC-09 and needs an explicit owner lifecycle contract, stop control,
   idle budget and evals. Installing the plugin cannot silently enroll sessions.
2. The architecture's **proposed**, unapproved 60-second lease and roughly 20-second renewal
   cannot be guaranteed by Claude session scheduling. COM-01 must choose a renewal owner and
   freshness policy. Helper heartbeat proves helper transport presence, not model attention,
   request acceptance or external effect.
3. Hook trust and MCP readiness are separate. Startup with a not-ready API must return a
   bounded `deferred-catch-up` outcome and preserve pending intent. It must neither lose a
   message nor manufacture enrollment/request ACK. Claim only after a permitted board tool is
   ready; a background thought is not a tool receipt.
4. Neither current CLI help nor an app-server schema proves Codex.app hooks, a running
   Desktop session, authenticated identity, channel activation or a real Project exchange.
   Those require source-, version-, application-scope-bound receipts.

## Observed surface and proof levels

The frozen Fabric input is `95e942212f6cc2bdc7f7f274fbc93449c27f0457`. Member source inputs are
Adapter `907acb286abe55c627bfeb4500906b76d0284e81` and Switchboard
`5e275caf50436f6a95eabad9c8e16bedade1ffe5`; issue state was checked on 2026-10-04.
Local evidence and its commands are in [raw/local-probes.json](raw/local-probes.json),
source collection in [raw/sources.json](raw/sources.json). No model invocation, account probe,
session inventory, app launch, gateway reconfiguration or runtime board mutation was performed.

| Surface | Observed here | Remaining proof |
|---|---|---|
| Claude Code CLI | `2.1.289`; help advertises background agents/attach and headless modes | Exact interactive/headless/background hook and permitted board calls; no such runtime run here |
| Codex standalone CLI | `0.160.0`; help and experimental offline app-server schema generation | Current initialize/capability negotiation, hook execution, queue-to-agent ACK and effect fences |
| Codex owned app-server | Generated schema includes `hooks/list`, `thread/queue/*`, `turn/start`, thread-bound MCP tool calls | No server started; schema presence is not live enablement or authorization |
| Codex.app | Conventional `/Applications/Codex.app` plist absent | This does not prove absent installation elsewhere; exact bundle/embedded engine, local/cloud orchestration and Desktop receipt remain NOT_RUN |
| Claude Desktop | A distinct conventional app bundle was observed | Separate product and scheduler; CLI version does not attest its hooks or lifecycle |

Proof tiers: **D** official/source design; **S** static help/schema observation; **M** disposable
model or fake-transport test; **R** actual pinned CLI/server session; **A** actual Desktop/build
acceptance; **E** observed effect/reconciliation. This cut supplies D/S and packet validation,
not M/R/A/E. Fabric's [current capability matrix](https://github.com/passioncode-ai/fabric/blob/95e942212f6cc2bdc7f7f274fbc93449c27f0457/apps/desktop/src/shared/providerCapabilityMatrix.ts#L206)
also deliberately keeps upgraded builds unverified. Its historical receipts cannot be repinned
into current acceptance.

## Current lifecycle capabilities

Claude hooks provide startup/resume/clear/compact triggers. Stop means a response ended; it
does not cover interruption or API failure. SessionEnd is bounded, advisory normal-exit cleanup;
asynchronous work may be killed during headless teardown. Treat crash detection as supervisor/
lease observation, never as a guaranteed shutdown hook. Hook payload fields are assertions,
not authenticated Fabric principal claims. [Claude hook reference](https://code.claude.com/docs/en/hooks).

Claude `/loop` requires the machine and session to remain available; firing waits for idle,
and missed occurrences coalesce. The minimum interval is one minute. Current resume behavior
restores eligible unexpired CronCreate tasks; self-paced loops, passed one-shots and background
Bash/monitor tasks are exceptions. This supports optional catch-up hints, not continuous
availability or 20-second renewal. Schedule creation needs the actual permitted tool and an
observed receipt. [Scheduling reference](https://code.claude.com/docs/en/scheduled-tasks).

Claude background agent listing can span projects, and headless execution is another surface.
An Adapter consumer must select only its authorized Project/session rather than importing the
whole local inventory. Backgrounding an existing interactive session is a deliberate lifecycle
change. [Agent view](https://code.claude.com/docs/en/agent-view),
[headless reference](https://code.claude.com/docs/en/headless),
[CLI reference](https://code.claude.com/docs/en/cli-reference).

Codex now documents hooks. Non-managed definitions require reviewed hash-bound trust; editing
the definition invalidates that trust. Managed trust has a distinct policy source. Plugin
installation/enabling alone is insufficient. SessionStart can precede MCP readiness, while
SessionEnd cannot use MCP tool hooks. SessionEnd is advisory and does not run immediately on
unsubscribe or conversation switching; it may follow 30 minutes without a connected client.
Normal shutdown is not a crash guarantee. Current docs distinguish local from cloud orchestration,
so do not infer a Codex.app hook lane from standalone CLI help.
[Codex hooks](https://learn.chatgpt.com/docs/hooks).

For the app-server, preserve returned thread/session identity rather than deriving lineage.
`thread/read` is an observation and does not load a session. Poll/read history after reconnect
to reconcile missed notifications. MCP inventory/readiness, permitted tool calls and thread
lifecycle remain separate. Use the exact installed schema and negotiated experimental support;
do not transplant moving-main SDK fields into an older release.
[App-server reference](https://learn.chatgpt.com/docs/app-server),
[immutable 0.160.0 source](https://github.com/openai/codex/tree/a956835d020762cb2b570053af06f643a11c0ecc/codex-rs/app-server).

The offline 0.160.0 schema advertises host queue add/list/update/delete/reorder/start. Add requires
`threadId`, `clientUserMessageId`, `input`; start requires `threadId` and optionally
`queuedSubmissionId`. That is evidence of a host queue API, not a COM consumer. Queue admission,
turn start, model-visible input, explicit request acceptance and observed completion are different
receipts. Prefer structured, authorized transport carrying a bounded durable message reference;
never place private message bodies or bearer tokens in shell arguments. See raw schema hashes and
the [0.160.0 release](https://github.com/openai/codex/releases/tag/rust-v0.160.0).

Reproduce only the static observation, using an empty task-owned home and output directory:

```sh
task_capture_dir=$(mktemp -d)
mkdir "$task_capture_dir/home"
CODEX_HOME="$task_capture_dir/home" codex app-server generate-json-schema --experimental --out "$task_capture_dir/schema"
python3 docs/reports/2026-10-04-local-agent-lifecycle/raw/capture_static.py "$task_capture_dir/schema" > "$task_capture_dir/observed.json"
```

The capture refuses a different claimed CLI version. A future qualification uses a new dated
cut and source/schema pins, rather than overwriting this receipt. Actual consumer calls require
the selected host's permitted transport and COM-03 tools; this diagnostic never starts a server.

## Protocol and startup catch-up

Claude Channels are opt-in preview delivery for a running session, with startup flags and policy/
authentication constraints. Registering MCP or installing a plugin does not activate push.
Ordinary explicit enrollment/catch-up can be designed for existing sessions without a forced
restart; a new optional channel lane needs its own authorized activation and receipt.
[Channels reference](https://code.claude.com/docs/en/channels).

Current Claude docs distinguish SDK 1.x and SDK 2.0 runtimes chosen at startup. On v2, a channel
server negotiating MCP `2026-07-28` cannot register for channel messages; earlier negotiation
can. A global legacy override affects every server. Therefore neither the client version nor
Adapter's modern protocol advertisement proves channel support. Record actual runtime,
negotiation, server revision, enabled capabilities and permission. Keep short durable query/tool
fallback; do not migrate P-08 wire semantics or blindly downgrade all servers.
[Claude MCP runtime reference](https://code.claude.com/docs/en/mcp#client-runtimes).

Proposed bootstrap order: selected Project and explicit principal grant → trusted definition/
managed policy → actual API ready/capability check → explicit enrollment/probe ACK → durable
catch-up → current claim attempt → explicit request ACK → mediated begin → completion observation.
Retries preserve cursor/checkpoint and idempotent probe/message identity. An unavailable API,
permission refusal or disk failure reports uncertainty and schedules authorized catch-up;
never advance a durable cursor before persistence or mark a stored request accepted by a model.
`com.*` labels in preceding architecture and packet operations here are **proposals**, not
existing APIs; COM-01/Contract own normative names, schemas, version and limits.

## Claude crash to Codex Project-target handover

The request targets the Project responder slot, not a provider-named mailbox. For a managed
launch, Fabric's [session credential mint/revoke path](https://github.com/passioncode-ai/fabric/blob/95e942212f6cc2bdc7f7f274fbc93449c27f0457/apps/desktop/src/main/agentSurface.ts#L414)
supplies a server-verifiable session boundary. Switchboard can supply observed process birth,
launch mode, build and owned host evidence; it does not mint Project authority from a PID.
An externally enrolled session may be authorized yet carry only asserted provider provenance.
Tool names, transcript text and a payload saying “Codex” cannot upgrade it to verified provenance.
Provider account readback is another proof: [authContext.ts](https://github.com/passioncode-ai/fabric/blob/95e942212f6cc2bdc7f7f274fbc93449c27f0457/apps/desktop/src/main/authContext.ts#L52)
does not manufacture a verified identity when its reader is unavailable.

After Claude disappears, use DB time and current policy to replace the responder generation.
Only a positively unstarted, unaccepted queued request may transfer automatically. Accepted or
begun work remains held/unknown until an authorized checkpoint/observation reconciliation proves
the permitted next step. Codex gets a new fenced claim, then explicitly accepts the exact
request/digest. Stale Claude ACK/renew/reply/completion must fail both generation and attempt
checks. Cancellation/revocation also prevents a fresh begin. Independent external credentials
can bypass a mediator; do not claim exactly-once effects from a COM lease.

COM-07 projects participant-authorized source-stamped state: last successful check, deferred
catch-up, permission/read uncertainty, transport presence, explicit acceptance, effects and human
read are separate. Unauthorized Projects must not leak through body, counts, cursor, facets or
omission labels. COM read ACK never dismisses canonical task obligations. Board UX/scenarios
are future COM-06/07 owner work, not a screen change in this report.

## Primary developer discussions and bounded countercases

| Primary thread | What it adds to the packet; scope limit |
|---|---|
| [VS Code PR 336306](https://github.com/microsoft/vscode/pull/336306), merged 2026-09-16 at `8324aca6303ee583eb05e282c4d5a141912aa7ea` | Cold hook catalog can appear only after first thread loading. Recheck trust before first turn; bind cached grants to cwd and current trust snapshot. Distinguish discovery failure from an empty catalog. This is VS Code integration evidence, not Codex.app acceptance. |
| [Codex issue 46210](https://github.com/openai/codex/issues/46210), report on 0.153.4 | Headless hook trust needs a visible refusal/probe test. Do not use global trust bypass to make a test pass; not reproduced on 0.160.0 here. |
| [Codex issue 33416](https://github.com/openai/codex/issues/33416), July historical queue behavior | Sleeping/disconnected desktop is a test condition. Its old absence-of-host-queue claim cannot override the current 0.160.0 generated schema. |
| [Codex issue 18860](https://github.com/openai/codex/issues/18860), historical missed event report | Reconnect/history reconciliation test, not evidence of a current reproduced defect. |
| [Claude issue 41577](https://github.com/anthropics/claude-code/issues/41577) and [88071](https://github.com/anthropics/claude-code/issues/88071) | End-hook/background teardown motivates deadlines, checkpoint-first persistence and owned supervisor testing. Versions/platforms differ; current failures were not reproduced. |

## Packets, dependencies and next action

[packets.json](packets/packets.json) contains seven agent-readable future packets and
[negative-cases.json](packets/negative-cases.json) contains their watched refusal cases. They are
research inputs without runnable/ready/done status fields. Adapter uses the existing
[issue 31](https://github.com/passioncode-ai/fabric-agent-adapter/issues/31); Switchboard uses
[issue 36](https://github.com/passioncode-ai/fabric-switchboard/issues/36). No new issues or comments
were created. COM-01 normative contract, COM-03 authenticated/fenced durable APIs, Contract
fixtures and explicit LC-09 lifecycle adoption precede real consumer implementation. COM-07 also
depends on COM-05/06 participant projection and scenario decisions.

Next: root decides the named COM-01 boundaries after hub convergence, then Adapter issue 31
authors a fixture-first protocol helper under its own policy. The first real-provider receipt
must include current source, helper/contract bytes, exact CLI/app scope, runtime negotiation,
trusted definition hash/policy revision, principal/Project/enrollment revision, current claim
fences and exact permitted tool result. Only then run neutral Claude→Codex replacement tests.
Release approval, paid/external effects and Desktop takeover remain separate gates.

## Verification and integration limits

Run `python3 docs/reports/2026-10-04-local-agent-lifecycle/raw/check_packet.py` to validate packet
coverage and the captured static schema assertions. See [raw/verification.json](raw/verification.json)
for executed exits and NOT_RUN tiers. This validates research artifacts, not production COM
behavior. Root owns map/merge-log integration and the one wiki report index; neither was edited.
The parent will update canonical adoption notes from the delivered immutable cut. No statement
here claims all sessions informed, enrolled or acknowledged.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded research delivery
- [`agent-interop`](https://github.com/ssheleg/agent-stack) — client protocol boundaries
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — source receipts
- `project-reports` — dated report validation — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
