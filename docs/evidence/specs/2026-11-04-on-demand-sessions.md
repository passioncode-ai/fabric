# On-demand sessions: a board request nobody answers starts a session that does it, reports and ends

Status: specification, 2026-11-04. Rows CO-409 (the wake), CO-494 (a responder without asking), CO-496 (usage counts by
default, rewritten below). Implementation runs in waves across the PassionCode products (section 9); the coordinator,
fabric-workspace, keeps the plan and the version matrix.

The operator asked for it on 2026-11-04 in this repository's session `5d9bed98` (paraphrased, ADR-0096 §5): when an
agent of the project is connected it takes the request; when none is and nobody picked the request up, a new session of
the default agent starts with every permission on and all the request's facts, does the work, reports that it is done
and ends, so no project needs a session kept open; it works on Windows and on the Mac, it is logged, and it is counted
for analysis, with usage counts on by default. Relayed to every PassionCode project the same hour (board thread
`b2e5df1f`, announcement `42a41db8`; direct messages to the coordinator and seven product sessions).

Two more instructions of the same morning shape it, both relayed by fabric-workspace (paraphrased): grant `board.respond`
to every project on its capabilities and let Fabric give it with no consent stop on the way (another project's session
`1d031d27`, about 09:50 UTC); and make the permissions obvious and adjustable in one screen of Fabric, where the person
switches between asking and allowing everything and sees the journal of what is granted (fabric-workspace's session
`74a9440a`, about 10:00 UTC).

Vision: it serves [§4 The user's role](../../ux/vision.md#4-the-users-role): the operator stops carrying which session
must be open for which project. A request finds its agent, or an agent is started for it, without the operator.

## 1. What exists (read 2026-11-04)

Why nothing was delivered is measured in [the board delivery report](../../reports/2026-11-03-board-delivery-and-delegation/README.md)
(§1): no project has a capability, because a capability exists only while a `board.respond` grant lives
(`supabase/migrations/20261012000104_project_board_responders.sql`, `board_listed_capabilities`); a grant is made only by
the operator's decision on an agent's request, and that decision is reachable only from Fabric's window
(`apps/desktop/src/main/index.ts`, the `IPC.hubDecide` handler; `apps/desktop/src/main/consentPresenter.ts`); `com.submit`
stores a request with `noResponder`; the sweep finds a request nobody moved (`apps/desktop/src/shared/abandonedSweep.ts`,
kind `request-unmoved`) and only keeps a nudge for that project's next turn (`apps/desktop/src/main/abandonedSweepRun.ts`).

What the other products already have, read the same day:

| Piece | Where | What it gives this design |
|---|---|---|
| Switchboard starts a coding agent for work it did not start | `switchboard continue --help` (Fabric Switchboard, 2026-11-04) | the machine's default agent (`switchboard agents default`) on whichever of its accounts has room, in a folder, isolated or managed, in Terminal, in place, or left for Fabric's console (`--to-console`, `switchboard handovers`); spending ceilings for paid agents (`switchboard ceiling`) |
| A packet a fresh session can accept | Observatory workflows (`observatory_checkpoint_write`, `observatory_handoff_create`, `observatory_handoff_accept`) | goal, constraints, plan, open steps and artifacts as typed blocks, a lease the next executor takes, and the fallback chain that continues a run out of quota |
| A non-interactive run that ends by itself | `claude --help` (`-p`/`--print`, `--output-format stream-json`, `--append-system-prompt`), `codex exec --help` | the session answers once and its process ends; no terminal to keep open |
| Fewer prompts as the machine default | [ADR-0168](../../adr/0168-every-catalogue-agent-starts-as-a-console-and-fewer-prompts-is-the-machine-default.md), `settings.json` `agentPermissions` | the permission mode a started session gets |
| An incoming message to a live Claude Code session | `apps/desktop/src/main/claudeInbound.ts` (`crossSessionInbound`, CO-407) | a live session can be woken by a message instead of keystrokes |
| A session joins a project by itself | [ADR-0134](../../adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md), `fabric-mcp` | immediate on the operator's own machine |

## 2. The rule

1. A request goes to the project's live responder when there is one (DEC-0098, unchanged).
2. With no responder but a live session of the target project, Fabric delivers the request to that session as an incoming
   message and, when the session takes the responder slot, it answers as today. Fabric never types into a terminal
   (0.3.13, ER-2: an Enter can answer a prompt the session waits on).
3. With neither, after a short grace period Fabric starts an **on-demand session**: the machine's default agent in the
   project's folder, with every permission (`--permissions all`), the whole request and its context as its first input. It does
   the work, reports in the request's thread, completes the request and ends.
4. One request starts at most one session at a time. A run that ends without completing leaves the request in the state
   the contract gives it; after two such runs Fabric stops starting sessions for it and shows it to the operator in
   «На проверке», without changing its state (fabric-agent-contract's option (b), CT-215, 2026-11-04).

Decisions taken here (the operator's latest word wins over earlier rows):

- On by default, with an off switch in Settings.
- **Responders without a consent stop** (CO-494, by (every step approved, paraphrased)): every project of the operator gets `board.respond` on its
  declared capabilities, and a session of that project on the operator's own machine takes the slot when it enrolls; no
  agent waits for a click. Since CO-506 ([ADR-0190](../../adr/0190-an-agent-decides-agent-access-on-the-operators-relayed-words-and-answering-is-granted-for-the-sessions-own-project.md)) the grant is given at a session's `com.enroll` for its
  own project only, and another project's waits for the operator. As built in 0.3.16 (ADR-0186 decision 1, `accessService.ts`) the grant was recorded as the
  asking agent's own revocable act, for one project and up to eight capabilities it names; narrowing it to the agent's
  own project is CO-506, and the permissions screen (§6.1) is not built yet.
- The default agent is Switchboard's machine default, Claude Code when none is set.
- A started session runs with every permission (`--permissions all`), as the operator asked; `agentPermissions` applies
  to the sessions the person starts, and Settings says so (the 0.3.16 review, iteration 3, UX-1). The
  three floors stay with a person: money, deletion and publication go through `fabric_effect_request`, and sign-ins, typed
  secrets and payments remain human steps.

## 3. The flow

```
asker ── com.submit(request, target P, capability C) ──▶ Fabric hub
          │
          ├─ live responder for (P, C)?  ── yes ─▶ it claims; nothing else happens
          ├─ live session enrolled in P? ── yes ─▶ incoming message to that session (§3.2); it takes the slot
          └─ neither, after grace G       ───────▶ dispatch (§3.3)
                                                  │ packet = Observatory workflow (§3.4)
                                                  ▼
                                    Switchboard: start default agent in P's folder (§3.5)
                                                  │ session enrolls in P, takes the slot (CO-494)
                                                  ▼
                       com.claim → com.accept → com.effect_begin → work → com.reply + com.complete → exit
                                                  │
                                    Fabric watches the request and the run (§3.6)
```

### 3.1 Detection

The decision of §3.1 to §3.3 and the two-empty-runs rule of §3.6 are one pure function,
`apps/desktop/src/shared/boardDispatch.ts#decideDispatch`, with `runEndsAt`, `firstLine`, `parseFirstLine` and
`refusalCheck` beside it (wave 1; tests `boardDispatch.test.ts`).

The hub's dispatcher runs on every `comms` journal event of kind `request` and on the cycle (60 s, `TICK_MS`), so a
request filed while Fabric was closed is found at the next start. Built 2026-11-07 (CO-409): a request a session stores
through the hub wakes the dispatcher when its grace ends (`boardDispatchRun.ts#createDispatchWake`, from
`boardService.ts#createBoard`'s `onRequestStored`); a request filed through another door is found by the cycle. A request is a candidate when it has no live
responder, is at least 5 minutes before the board's own deadline (`request.deadline`, explicit or seven days;
`boardDispatch.ts#LAUNCH_MARGIN_MS`: 120 s of silence, a cycle and the launch) and has no dispatch in
flight, and it is `queued`, or `claimed` with an attempt whose lease lapsed, or `accepted` with no live holder (the
next run takes it through `com.responder_replace` with the checkpoint, as §3.6 says; fabric-agent-adapter's question,
thread `b3e60686`, 2026-11-04), or `in_progress` with no live holder (the
started session then enrolls, the contract records `lost_result`, and the session settles it from the workflow's
checkpoints as an observation, or leaves `outcome_unknown` to the owner; contract review of 2026-11-04, CT-215). Grace G is 2 minutes from submission (a live
session usually answers inside it); a request marked urgent by the asker skips the grace.

### 3.2 A live session

A session is live when its `fabric-mcp` signed within the last 2 minutes and it is enrolled in P. Fabric posts the
request to that session as an incoming message through Claude Code's cross-session inbox when the person turned
«Сообщения между сессиями агентов» on (CO-407), and always as a nudge on its next Fabric call (today's path). A live
session that does not take the slot within G is treated as absent and the request is dispatched; the live session sees
the dispatch on its next turn and leaves the request alone.

### 3.3 Dispatch

Before starting anything the dispatcher checks, in order, and records which check stopped it:

| Check | Default | Answer when it stops |
|---|---|---|
| The switch «Запускать агента на запрос доски, который некому взять» (Settings) | on | `skipped-off` (as built in 0.3.16 the dispatcher does not decide with the switch off, so nothing is recorded; §10) |
| P has a folder on this machine | required | `skipped-no-folder` (the request stays queued; another machine may take it) |
| At most N on-demand sessions running on this machine | N = 2 | `deferred-cap` (tried again on the next cycle) |
| At most 1 per project | 1 | `deferred-project-busy` |
| At most D started runs per project in the last 24 hours (a refused or unstarted start does not count) | D = 20 | `skipped-daily-cap` |
| Switchboard answers and has a default agent with room | required | `deferred-no-agent` |

Each dispatch has an id; dispatching the same request again with a run in flight is refused (idempotent by request id).

### 3.4 The packet

The dispatcher writes an Observatory workflow for the request (`observatory_checkpoint_write`, owner `service:fabric`):
`goal` names the request; `constraints` carry the exit contract (claim, renew the lease with `com.renew` or
`com.progress` about every 20 s during a long step, as the contract's 60 s lease expects, so a late renewal never
meets `lease_expired` on the next call, `com.complete` included (a project on the board, thread `0ad0b68c`), answer in the thread, complete the request, write the final
checkpoint, end; when `com.enroll` answers `not_authorized`, the refusal branch of the board rule `board.read-at-start`: one
`com.reply` only for a slot absent at generation 0, otherwise none, and the operator asked either way, CO-525), the floors of §2 and the operator's mandate as the request carries it (DEC-0125, appended to only, the
started session joining the chain as a callee, MD-2); `artifacts` carry references only; `open` names the one step. No
message body travels in the packet (the session reads the request with `com.get {message}` and the thread with
`com.list {thread}` under its own credential, with the reader's redaction; fabric-agent-adapter, 2026-11-04), no absolute folder (the launch's working directory is the folder), no lease and no attempt or fence
(the session takes its own `com.claim`). The packet holds no secret: keys are reached by name through
`use_secret.py run` inside the session. The workflow id is the dispatch's handle across products.

The mandate's carrier, confirmed by fabric-agent-contract on 2026-11-07 (board thread `8948b481`): a `mandate/1` JSON code
block in the request's body (`project-comms.md`, DEC-0125 MD-3), read only when the board verified the sender. Built the
same day (`boardMandate.ts#mandateOfRequest`): Fabric carries it into the packet's `constraints` unchanged, and the run
appends itself to its chain on each call it makes under it (MD-2).

Agreed with Project Observatory on 2026-11-04 (OBS-323), so it reads the packet without guessing and without a change to
memory/0.1: `artifacts` carry one each of `kind: "other"` with `ref` `board-request:<uuid>`, `board-thread:<uuid>`,
`capability:<name>`, `fabric-project:<uuid>` and `deadline:<ISO 8601 UTC>` (the board's own deadline, cut to the opening write plus seven days less a minute, because Observatory refuses a packet deadline more than seven days after its write; the packet freezes at that write, so only it names the deadline and a later write leaves it out: `boardDispatch.ts#packetDeadline`, CO-554, changed 2026-11-09; before that it was the board's deadline as it is); a packet without
the request, the project or the deadline gets no keys.
Each dispatch also writes its own checkpoint with `ref` `run-ends-at:<ISO 8601 UTC>`: the earlier of its launch plus
the time limit and the deadline, the same moment passed to Switchboard as `--timeout-minutes`; a second dispatch writes
its own from its own start (asked on the board on 2026-11-04, thread `0ad0b68c`; a run may wind down 15 minutes
before it). That checkpoint carries the packet's whole body unchanged (goal, constraints, artifacts, credentials) plus
`run-ends-at`, because Observatory replaces a checkpoint's body whole; every later checkpoint of the run does the same
with `checkpoint.body` from `observatory_handoff_accept`. One workflow serves a request across all its runs. A run
that ends with the request unsettled keeps the workflow's lease and does not close it, so before a second dispatch
Fabric takes the workflow back: once the dispatch has ended and the workflow's newest checkpoint is at least 120 s
old, it creates a hand-over with no lease token, reason `restart` (`crash` when Switchboard reports the run failed),
to `service:fabric`, accepts it for a lease of its own, writes the new `run-ends-at` checkpoint under that lease, and
hands the workflow on with `plan_route` (fabric-agent-adapter's question, thread `b3e60686`, message `b51ec2a3`,
answered 2026-11-04: Observatory refuses a checkpoint or a `plan_route` hand-over without the current lease). Each dispatch makes a new hand-over and a new dispatch id (a
UUID v4, within Switchboard's `[A-Za-z0-9._-]{1,64}`, given to the run as `FABRIC_DISPATCH_ID`); an unaccepted older
hand-over is never reused. Observatory's redactor keeps only `session:` and `commit:` references today, so
`board-request:`, `board-thread:` and `fabric-project:` are scrubbed when the packet is written: until Observatory keeps
them (OBS-323) a run takes the request from `FABRIC_DISPATCH_REQUEST` and its first line, which Switchboard passes
whatever the packet keeps, so the dispatcher runs without them (fabric-agent-adapter's finding, thread `7ae9ac3a`;
corrected 2026-11-05 on the board, thread `1add3c03`: the earlier «the dispatcher stays off» no longer holds once
0.3.16 turns it on). In 0.3.16 the dispatcher names no `credentials`; a run that needs a key asks for it as any
session does. The keys a request needs are named
in the body's `credentials` block (`[{project, env, name, purpose}]`, names only); Observatory gives only those, only to
the holder of the workflow's lease, only for the project `fabric-project` resolves to, and only until the deadline;
without `credentials` it gives none. The run's last checkpoint closes the workflow: `status: done` for `completed`,
`status: failed` for `failed_known`, with `done[]` and `notes` and no values.

### 3.5 The start

Fabric creates the hand-over itself (`observatory_handoff_create` as `service:fabric`, reason `plan_route`, `to.provider`
from the agent `switchboard agents status` says `dispatch` will start, `data.dispatch_agent` (Switchboard's SB-294: Claude
Code when no default is set), else its default agent, no account) and asks Switchboard to start the session (SB-247, agreed
2026-11-04, design in fabric-switchboard `docs/research/dispatch-2026-11-04.md`):
`switchboard dispatch --dir <P's folder> --workflow <wf> --handoff <id> --request <uuid> --dispatch-id <id> --reason
request --permissions ask|all --timeout-minutes <n> [--json]` (`--request` and `--dispatch-id` agreed with Switchboard
on 2026-11-04 so its launch record carries `launched_by.dispatch {id, request, thread, project, workflow}` for Fabric
Dashboards, FD-137; the dispatch id is the one in `board.dispatch.*`), answering `{launch_id, agent, account_id, state: started|running|refused, reason?}`;
`switchboard dispatch stop --launch-id <id>` stops it. The started session accepts the hand-over, narrowing it to the
account Switchboard chose; the workflow's lease never passes through Switchboard. A second `dispatch` for the same
workflow while one runs answers the same `launch_id`. Refusal codes map to §3.3: `no_agent` to `deferred-no-agent`,
`not_in_group` to `skipped-no-folder`, `ceiling_reached` and `spend_unknown` to `deferred-cap` with the reason,
`agent_not_installed` to `failed-to-start`. `--permissions all` runs Claude Code with `--dangerously-skip-permissions`
and Codex with `--dangerously-bypass-approvals-and-sandbox`; an agent that asks less than the chosen mode allows is not
taken (Switchboard's D-6). A refusal is an answer, not an error (`{ok: true, data: {launch_id: null, state: "refused",
reason}}`, exit 0); bad input and no running Switchboard are errors (exit 1). With `--permissions ask` a `claude -p` run
may lack the board and Observatory tools the person's settings do not allow, and `codex exec` needs a Git repository or a
trusted folder; the dispatcher records such a run's outcome and does not retry it unchanged. On Windows wave 1 answers
`handoff_refused` until Switchboard finds Observatory's engine there. The session runs
non-interactively (`claude -p` with the packet as its prompt and the exit contract as an appended system prompt;
`codex exec` for Codex), in the account's isolated home, in the group the folder belongs to. With «Open hand-overs in
Fabric» on, the run is visible in Fabric's console; otherwise it runs without a window and writes its log under
Switchboard's sessions history. A paid fallback agent obeys the machine's and the group's spending ceilings.
The run knows it was started on a request by its environment, `FABRIC_DISPATCH_WORKFLOW`, `FABRIC_DISPATCH_HANDOFF` and
`FABRIC_DISPATCH_REQUEST`, and by the first line of its prompt, exactly
`fabric-dispatch/1 workflow=wf_<16 hex> handoff=<handoff id> request=<request uuid>` (fields one space apart, in this
order, then an empty line and the text). A session is the dispatched run only when both hold: its own first prompt
line is that line and it names the same three ids as the environment. The environment alone never makes a session
the run, because a child process inherits it: a reader or helper a run starts (Claude Code's Agent tool, a sub-shell)
carries `FABRIC_DISPATCH_*` but its prompt does not begin with the line, so it is not the run. It takes no claim,
writes no checkpoint, completes nothing on the board and reports only to the run that started it. Where the line and
the environment disagree, the session is not the run either, in one of two ways (the adapter's 0.63.0, `bbcdc8c8`,
agreed on the board, thread `1add3c03`, 2026-11-05): a `fabric-dispatch/1` line with no `FABRIC_DISPATCH_WORKFLOW` in
the environment is a quotation, so the session is not a run and writes nothing on the thread; with
`FABRIC_DISPATCH_WORKFLOW` set but the other two missing, or any of the three naming other ids than the line, the
session says so on the request's thread and stops (asked on the board, thread `1add3c03`, relayed by fabric-workspace
on 2026-11-05; this replaces the earlier «the environment wins»).
The dispatcher never passes a lease: the run reads the packet with `observatory_checkpoint_latest` and takes the lease
with `observatory_handoff_accept`; only the lease holder writes the closing checkpoint, and Fabric writes nothing to the
workflow after the hand-over (its `run-ends-at` checkpoint is written before it). Agreed with
fabric-agent-adapter for FAA-201 on 2026-11-04; `working-with-fabric` (FAA-201) then skips its usual preamble, follows the exit contract, and on an
error it cannot get past completes the request `failed_known` with the reason.

### 3.6 Watching and ending

The dispatcher follows the request (`com.get`) and the run (`switchboard --json sessions show <launch_id>`: `ended` is
`exited` with its exit code, `stopped` or `timed_out`):

The dispatch's outcome is the hub's journal entry, never a state of the request:

- request `completed` or `failed_known`: the dispatch ends `finished`;
- a run nobody can account for (Switchboard cannot say how it ended, or its request is outside the pass's read) ends
  `unknown` once past its own end and a margin, and counts toward the two below unless its request is read settled
  (CO-512): a request moving in and out of the read at its page bounds is not started a third time;
- the run ended and the request is not settled: the dispatch ends `exited-without-answer`; the request keeps the state
  the contract gives it (`queued` stays queued, `claimed` is taken again by the next `com.claim` with a new attempt,
  `accepted` is held and continues only through `com.responder_replace` with the checkpoint, `in_progress` stays until
  the next holder registers); the next cycle may dispatch once more; after two such runs Fabric stops and shows the
  request to the operator in «На проверке», unchanged, and takes the workflow back the same way to close it (`close: true`,
  `status: blocked`); an `accepted` or `in_progress` request past its deadline, which the contract never expires, is
  shown to the operator and closed the same way (a run whose deadline falls no more than 10 minutes after its own end,
  `boardDispatch.ts#RUN_END_TO_DEADLINE_MS`, completes `failed_known` instead of leaving it accepted: the next decision
  comes up to 120 s of silence and a 60 s cycle after that end and still needs the 5-minute launch margin;
  fabric-agent-adapter's FAA-201, its question `aea81d66`);
- a run past the time limit (60 min by default, earlier when the board's deadline is earlier) is stopped through
  Switchboard and ends `timed-out`; past the deadline the contract expires `queued` and `claimed` requests itself.

A standing dispatcher on by default changes fabric-agent-contract's choice C5 of DEC-0022 («no background helper by
default»); the contract records it as a DEC citing the operator's words of 2026-11-04 (CT-215).

## 4. Who does what

| Product | Its part |
|---|---|
| Fabric | the dispatcher (§3.1–3.3, 3.6), the packet (§3.4), the switch and limits in Settings, the incoming message to a live session, the grants without a stop (CO-494), the permissions screen (§6.1), journal events and counts (§7–8) |
| Fabric Switchboard | `switchboard dispatch` (§3.5): default agent and account, isolated home, non-interactive run, console hand-over, ceilings, stop on time limit, launch history with `launched_by: fabric`, on macOS and Windows |
| fabric-agent-contract | the packet's shape and the on-demand session's lifecycle (who starts it, what «finished» means, what happens to a request when the run dies); CT-175 (a requester learns its accepted request lost its responder) and CT-205 (mandates longer than seven days) |
| fabric-agent-adapter | `working-with-fabric`: a session started on a request reads the packet, does the work, reports, completes and exits; it never waits for a person inside the run |
| Project Observatory | the workflow store the packet lives in, keys by name inside the run, the record of each run's checkpoints |
| PassionCode launcher | the permission rules `setup` installs (`permissions.allow`, `~/.passioncode/rules.d`) are read and shown by Fabric's permissions screen (§6.1) |
| Fabric Dashboards | each dispatch on the agent's page: request, run, outcome, duration |
| fabric-workspace | the knowledge page for this chain, the waves, the version matrix for macOS and Windows |

## 5. macOS and Windows

| | macOS | Windows |
|---|---|---|
| Hub file | `~/Library/Application Support/ai.passioncode.fabric/hub.json` | `%LOCALAPPDATA%\passioncode-fabric\hub.json` (DEC-0032, DEC-0033 ACL) |
| Starting the run | Switchboard's process, no Terminal needed for a non-interactive run | the same; PowerShell is never involved in a non-interactive run |
| Incoming message to a live session | Claude Code's cross-session inbox when on | the nudge path only, until the inbox is measured on Windows (wave 2 measures it) |
| Stopping a run | Switchboard stops the process group | `taskkill /T` through Switchboard, as Fabric's own sessions |

Wave 2 runs the whole chain on a Windows machine before the release that turns the switch on there.

## 6. Safety

- Never more sessions than the caps; never a second run for the same request in flight.
- Nothing is typed into a terminal; a live session is reached by message or nudge only.
- The run has every permission (`--permissions all`); money, deletion and publication still go through
  `fabric_effect_request`, sign-ins, typed secrets and payments stay with the person.
- No secret in the packet, the journal, the counts or the logs; keys by name.
- The operator's switch stops new dispatches at once and ends a start still waiting for Switchboard's answer; runs in
  flight finish or reach their time limit, and the board is read only to follow them.

### 6.1 The permissions screen

One screen in Fabric (Settings → «Разрешения агентов»), the main place to see and change what agents may do. Its
scenarios go through super-ux first (`docs/ux/scenarios.md`), then the screen.

- **The mode**, one switch for the machine: «Спрашивать» or «Разрешить всё» (today's `agentPermissions`, ADR-0168), with
  one sentence saying what each mode lets a started session do and the three floors that never change.
- **What is active now**: the board grants per project and capability (who granted, when, why, revoke), the access
  bindings and their grants, the rules the PassionCode launcher installed (`permissions.allow`, `~/.passioncode/rules.d`,
  read only, with the command that changes them), and the on-demand switch with its limits.
- **The journal**: every grant, revoke, mode change and dispatch decision with its actor (the operator, an agent acting
  on his recorded words, the system) and time, read from the journal's `access.*` and `board.dispatch.*` events.

## 7. Logging

Fabric journal events (each with `event_types` rows and a feed sentence `event.<type>` in `i18n/en.ts`):

| Event | Payload (no text of the request) |
|---|---|
| `board.dispatch.decided@1` | request id, project, path (`responder`, `live-session`, `launch`), the check that stopped it (§3.3) |
| `board.dispatch.started@1` | dispatch id, request id, workflow id, agent kind, Switchboard launch id |
| `board.dispatch.ended@1` | dispatch id, outcome (`finished`, `exited-without-answer`, `timed-out`, `failed-to-start`), duration |

The operations log records the same steps (`board.dispatch.*`), with the platform. Switchboard records the launch in its
history; Observatory keeps the workflow's checkpoints.

## 8. Analytics

Counts only, through the existing usage pipeline ([usage analytics](../../ANALYTICS.md)):
`board_dispatch` {path, outcome, agent_kind, platform} and `board_request_answered` {path, latency bucket}. They answer
how many requests are answered by a live responder, a woken session or a started one, and how long it takes.

**Usage counts by default (CO-496, rewritten by the operator's word of 2026-11-04).** Anonymous usage and error data are
on by default, for new and existing installations: on first start Fabric shows a notice that it collects anonymous usage
and error data only to improve the product, with the switch already on; the switch in Settings turns it off for Fabric
alone. This supersedes the decision of 2026-11-03 (thread `b2e5df1f`: a baseline without consent, consent extends) and
ADR-0127; a new ADR records it in the change that builds it, with the notice text through the text checker.

**Errors our customers meet reach us** (the operator's word of 2026-11-04, relayed by fabric-workspace: make sure errors are
logged and that we can see correctly when our customers run into problems). Today
Fabric keeps errors only on the machine (the operations log and `startup-failure.log`); none reaches us. CO-496 adds an
`app_error` count under the same switch: a fixed code and the place it happened (`area`, `op`), the platform and the
version, never the message text, a path, a project name or anything the person typed, as Fabric Inbox's `app_error`
(v0.87.0).

## 9. Waves

| Wave | Fabric | The other products |
|---|---|---|
| 1 | grants without a stop (CO-494); the dispatcher behind the switch (off until wave 2's verification), the packet, journal events; tests with a fake Switchboard | `switchboard dispatch`; the contract's packet and lifecycle; the adapter's skill section; Observatory's `service:fabric` workflow owner |
| 2 | the switch on by default; usage counts by default (CO-496); the permissions screen (§6.1); the chain run on macOS and on Windows | the same switch and counts in every product; releases on both platforms |
| 2, landed | 2026-11-05: the dispatcher on the real doors (`main/boardDispatchWiring.ts#wireBoardDispatch`: the board through the operator's read door, the slots through `board_responders_operator`, the attempt from the request facts, Switchboard's CLI, Observatory's stdio server), beside the cycle, the switch on by default (`shared/appSettings.ts`, `dispatchBoardRequests`); after the 0.3.16 review: the record written before each start, a refusal waits 10 minutes (since 2026-11-07 twice as long after each refusal in a row, at most six hours, CO-409's ER-6), a project with a live session gets no second agent (the wake of §3.2 is not built, so the request stays that session's), and two empty runs close the workflow and show the request in «На проверке». Not in 0.3.16: the dispatcher runs on the 60 s cycle only, not on board events (§3.1); the `crash` reason, the mandate, `com.get` reading and `timed-out` of §3.4 and §3.6 are not built; the journal events of §7 (the dispatcher logs to the operations log only), the permissions screen of §6.1, the counts of §8 (CO-496), the wake of §3.2, Claude Code as a fallback when no default agent is set (§3.5: none set is `deferred-no-agent`), and the run on Windows; carried in CO-409, whose row lists each of them since the 0.3.16 review, iteration 3 (DO-5) | |
| 3 | three-iteration verification of the chain and fixes; release | releases; fabric-workspace's version matrix shows every product current on both platforms |

## 10. Checks that prove it

- A request filed to a project with no session is answered by a started session within the grace plus the run, and the
  session's process is gone afterwards (macOS and Windows).
- With the switch off, nothing starts and no decision is recorded (the pass returns before deciding; `skipped-off` is
  `decideDispatch`'s answer for a caller that asks with the switch off).
- Caps hold under ten simultaneous requests.
- A run killed mid-way leaves the request in the state the contract gives it; after a second such run Fabric starts no
  more for it and shows it to the operator in «На проверке», its state unchanged (§3.6, option (b)).
- No packet, event, count or log line contains a secret or the request's text where §7 says it must not.
