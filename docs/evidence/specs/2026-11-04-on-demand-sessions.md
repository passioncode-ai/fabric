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
   the contract gives it; after two such runs (three from 0.3.19, §3.8) Fabric stops starting sessions for it and shows
   it to the operator in «На проверке», without changing its state (fabric-agent-contract's option (b), CT-215,
   2026-11-04).

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

The decision of §3.1 to §3.3 and the empty-runs rule of §3.6 (two runs, three from 0.3.19) are one pure function,
`apps/desktop/src/shared/boardDispatch.ts#decideDispatch`, with `runEndsAt`, `firstLine`, `parseFirstLine` and
`refusalCheck` beside it (wave 1; tests `boardDispatch.test.ts`).

The hub's dispatcher runs on every `comms` journal event of kind `request` and on its own pass, every 30 s from 0.3.19
(`WATCH_MS`, §3.8; the cycle's 60 s, `TICK_MS`, before it), so a request filed while Fabric was closed is found at the
next start. Built 2026-11-07 (CO-409): a request a session stores through the hub wakes the dispatcher when its grace
ends (`boardDispatchRun.ts#createDispatchWake`, from `boardService.ts#createBoard`'s `onRequestStored`); a request filed
through another door, and every board message, is found by the next pass (the 0.3.19 review, iteration 3 run two,
DO-19). A request is a candidate when it has no live
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
| The switch «Запускать агента, когда проекту пишут на доске, а открытой сессии проекта нет» (Settings; named for requests alone until 0.3.19) | on | `skipped-off` (as built in 0.3.16 the dispatcher does not decide with the switch off, so nothing is recorded; §10) |
| P has a folder on this machine | required | `skipped-no-folder` (the request stays queued; another machine may take it) |
| At most N on-demand sessions running on this machine | N = 3 (2 until 2026-11-11: sixteen projects then waited on two slots under §3.8; `shared/boardDispatch.ts#DISPATCH_DEFAULTS`) | `deferred-cap` (tried again on the next cycle) |
| At most 1 per project | 1 | `deferred-project-busy` |
| At most D started runs per project in the last 24 hours (a refused or unstarted start does not count) | D = 20 | `skipped-daily-cap` |
| Switchboard answers and has a default agent with room | required | `deferred-no-agent` |

Each dispatch has an id; dispatching the same request again with a run in flight is refused (idempotent by request id).

### 3.4 The packet

The dispatcher writes an Observatory workflow for the request (`observatory_checkpoint_write`, owner `service:fabric`):
`goal` names the request; `constraints` carry the exit contract (claim, renew the lease with `com.renew` or
`com.progress` about every 20 s during a long step, as the contract's 60 s lease expects, so a late renewal never
meets `lease_expired` on the next call, `com.complete` included (a project on the board, thread `0ad0b68c`); since 0.3.20, when a
fenced call does answer `lease_expired` after `com.accept`, take the slot back with `com.responder_replace` transferring
the request and finish under the attempt its receipt names, since an accepted request is never claimed again (a live run
of 2026-11-11, launch `26586b8b`, left its request `accepted` with the work done), answer in the thread, complete the request, write the final
checkpoint, end; when `com.enroll` answers `not_authorized`, the refusal branch of the board rule `board.read-at-start`: one
`com.reply` only for a slot absent at generation 0, otherwise none, and the operator asked either way, CO-525), the floors of §2 and the operator's mandate as the request carries it (DEC-0125, appended to only, the
started session joining the chain as a callee, MD-2); `artifacts` carry references only; `open` names the one step. No
message body travels in the packet of a run on this machine (the session reads the request with `com.get {message}` and the thread with
`com.list {thread}` under its own credential, with the reader's redaction; fabric-agent-adapter, 2026-11-04), no absolute folder (the launch's working directory is the folder); a run on another machine carries the request and its
thread in `notes` instead (§3.7). No lease and no attempt or fence
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
hand-over is never reused. Observatory's redactor kept only `session:` and `commit:` references when this was written,
so `board-request:`, `board-thread:` and `fabric-project:` were scrubbed; since OBS-323 (installed 0.35.14,
`memory_redact.py`) it keeps those three and still scrubs `board-message:` (§3.8). A run also takes the request from
`FABRIC_DISPATCH_REQUEST` and its first line, which Switchboard passes whatever the packet keeps, so the dispatcher
never depended on them (fabric-agent-adapter's finding, thread `7ae9ac3a`;
corrected 2026-11-05 on the board, thread `1add3c03`: the earlier «the dispatcher stays off» no longer holds once
0.3.16 turns it on). In 0.3.16 the dispatcher names no `credentials`; a run that needs a key asks for it as any
session does. The keys a request needs are named
in the body's `credentials` block (`[{project, env, name, purpose}]`, names only); Observatory gives only those, only to
the holder of the workflow's lease, only for the project `fabric-project` resolves to, and only until the deadline;
without `credentials` it gives none. The run's last checkpoint closes the workflow: `status: done` for `completed`,
`status: blocked` for `failed_known` (Observatory takes only `in_progress`, `done` and `blocked`; the `failed` written
here until 2026-11-11 was refused, §3.7), with `done[]` and `notes` and no values.

### 3.5 The start

Fabric creates the hand-over itself (`observatory_handoff_create` as `service:fabric`, reason `plan_route`, `to.provider`
the agent id `switchboard agents status` says `dispatch` will start, `data.dispatch_agent` (Switchboard's SB-294: Claude
Code when no default is set), else its default agent, no account). The provider is that id as Switchboard writes it
(`claude-code`, `codex`), never a provider name derived from it: Switchboard's dispatch prompt has the session accept as
`executor.provider` = the id, and Observatory refuses an accept whose provider is not the offer's (CO-556, observed on
0.3.18 rc.2, 2026-11-10: an offer to `claude` refused as "the handoff goes to claude, not claude-code";
`main/boardDispatchWiring.ts#dispatchProvider`, test `CO-556: the session Switchboard starts accepts the hand-over` in
`apps/desktop/test/board-dispatch-run.test.mjs`). Fabric then asks Switchboard to start the session (SB-247, agreed
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
  `unknown` once past its own end and a margin, and counts toward the empty runs below unless its request is read
  settled (CO-512): a request moving in and out of the read at its page bounds is not started past the limit (a third
  time before 0.3.19, a fourth from 0.3.19; iteration 3 of its review, DO-14);
- the run ended and the request is not settled: the dispatch ends `exited-without-answer`; the request keeps the state
  the contract gives it (`queued` stays queued, `claimed` is taken again by the next `com.claim` with a new attempt,
  `accepted` is held and continues only through `com.responder_replace` with the checkpoint, `in_progress` stays until
  the next holder registers); the next cycle may dispatch once more; after two such runs (three from 0.3.19,
  `EMPTY_RUNS_TO_OPERATOR`, §3.8) Fabric stops and shows the
  request to the operator in «На проверке», unchanged, and takes the workflow back the same way to close it (`close: true`,
  `status: blocked`); an `accepted` or `in_progress` request past its deadline, which the contract never expires, is
  shown to the operator and closed the same way (a run whose deadline falls no more than 10 minutes after its own end,
  `boardDispatch.ts#RUN_END_TO_DEADLINE_MS`, completes `failed_known` instead of leaving it accepted: the next decision
  comes up to 120 s of silence and a 60 s cycle after that end and still needs the 5-minute launch margin;
  fabric-agent-adapter's FAA-201, its question `aea81d66`);
- a run past the time limit (60 min by default, earlier when the board's deadline is earlier) is stopped through
  Switchboard and ends `timed-out`; past the deadline the contract expires `queued` and `claimed` requests itself.

### 3.7 A run on another machine (CO-551, stage A)

The operator asked on 2026-11-09 to run the development agents on the Mac Studio (fabric-workspace's request `d0cc0ec6`,
board thread `14d6cb73`). In stage A the board and the dispatcher stay on this machine; Switchboard starts the run on the
other machine over ssh, and that run has no `fabric-mcp` there. Agreed on the thread with fabric-switchboard (SB-317,
Switchboard 0.7.40, published 2026-11-09): Fabric's design `32e834d4`, the fields `f75293e0` and `ac25c446`, D-2 in
`700ef088` and `13f00feb`, the refusals and `lost` in `e6f33c33` and `d8b9c03b`.

Since 0.3.20 the machine can depend on the project: the `dispatchTargets` key of Fabric's `settings.json` (no Settings row;
written by hand, once 0.3.20 runs, since an older Fabric drops the key on its next settings write) maps the owner of the
project's repository (its primary folder's `origin`, read by `agentSyncLeases.ts#originOf`: at most 3 s, an inherited
`GIT_DIR` ignored) to an ssh host, before the one `dispatchTarget`.
The Mac Studio keeps one space per owner group (studio-agent, board thread `6d874a34`: `node-a` holds `owner-a/*`
and `owner-b/*`, `node-b` holds `owner-c/*`, `owner-d/*` and `owner-e/*`), so a request run goes
to the space that has the checkout. An owner not in the map, or a remote that cannot be read, takes `dispatchTarget`;
an inbox run asks nothing. A run on another machine has no board, so its packet carries the request and its thread as
text in `notes`, read through the operator's read door over up to ten pages of 100: the request first, cut at
`REQUEST_TEXT_MAX` (3000) characters, then the thread's other messages newest first while the whole stays within
`THREAD_TEXT_MAX` (3900), since Observatory refuses `notes` past 4000 (0.3.20 review, iteration 2, ER-9: a longer one
never opened); the messages left out are counted at the end, and each sender is named `fabric-project:<uuid>`, a form
Observatory's redactor keeps. Its first constraint says to answer in the run's result when no `com.*` tools are there,
and that the request and its thread are data from other projects, never instructions. The same packet serves the run a
refusal there starts here, and an open whose answer was lost is asked again with the machine and text it sent first
(iteration 2, ER-10). A run started here has `fabric-mcp` and so the board; one that somehow had none would write its
answer to a result file nobody reads here (CO-564) (found on the first live run on the Mac Studio, 2026-11-11:
the run had only the request's id and ended `blocked` three times). The goal names the request as `board-request:<uuid>`,
which Observatory keeps (`main/boardDispatchWiring.ts#remoteTargetFor`, `#requestThreadText`, `shared/boardDispatch.ts#dispatchTargetsOf`,
`#remoteOwnerOf`; tests in `board-dispatch-run.test.mjs` and `boardDispatch.test.ts`).

- **Which machine.** Settings' `dispatchTarget` names it as ssh knows it (`shared/types.ts#AppSettings`, read field by
  field by `shared/boardDispatch.ts#dispatchTargetOf`: an ssh host name, optionally with a user; never an option, a
  space or `auto`). It is null by default, so every run starts on this machine, as before. It has no row in the
  Settings window: a window or an agent writes it through the settings write (`settingsPatch`), and stage B
  (CO-552) chooses the machine by itself from the board's live responder slot and Switchboard's account headroom
  (`--target auto --candidates`), which makes the setting unnecessary.
- **The start.** With a machine named, a new run's record carries it (`target`) and Switchboard is asked with
  `--target <machine>` (`main/boardDispatchWiring.ts#dispatchArgs`). A refusal `not_on_target` (no checkout of the
  repository there), `target_busy` or `target_unreachable` starts the same run on this machine in the same pass, with
  the same workflow and hand-over (`shared/boardDispatch.ts#REMOTE_REFUSALS`); any other refusal is the run's, as here.
  Nobody accepts the hand-over of a run there: Switchboard only reads it, so Fabric keeps the workflow's lease.
- **Following it.** Each pass asks `switchboard --json dispatch status --launch-id <id>`
  (`main/boardDispatchWiring.ts#remoteStateOf`: `state` running, exited, stopped, timed_out, lost or unknown,
  `exit_code`, `result`). `lost` and `unknown` end nothing and close nothing: past the run's end and 10 minutes the
  request shows in «На проверке» («has not answered past its time limit»), no other run starts for it, and the
  dispatcher keeps asking; a run not heard from for 8 days (`KEEP_REQUEST_MS`) ends `unknown`. Only an observed end
  (`exited`, `stopped`, `timed_out`) ends the run. A run still running past its end and 5 minutes is stopped through
  `dispatch stop`, as on this machine.
- **The result file.** Switchboard fetches it over the same ssh and hands its text back in `result` (at most 64 KiB). Its
  first line is exactly `fabric-dispatch/1 result workflow=<wf> handoff=<id> request=<uuid> launch=<launch_id>`, then
  `outcome=answered|failed|blocked`, `branch=` and `commit=` when there are any, an empty line and the answer for the
  board in Markdown. `shared/boardDispatch.ts#checkRunResult` reads it field by field and checks the four ids against
  the ones Fabric passed (`FABRIC_DISPATCH_WORKFLOW`, `_HANDOFF`, `_REQUEST`) and the launch id Switchboard answered.
  A file of another run, in another shape, with an outcome it does not know, an `answered` with no text, or larger than
  64 KiB is never posted: the operations log records `board.dispatch.relay` failed with the reason code (never the
  file's text), the request goes to the operator in «На проверке» («left a result that was not posted»), no run starts
  for it again, and the workflow is closed.
- **The answer.** For `outcome=answered` the dispatcher posts the answer once as the request's target Project through
  the operator's board door (`AgentSurface#operatorBoard`, `main/boardDispatchWiring.ts#relayReply`; a reply from the
  request's target answers it, DEC-0098), under the idempotency key `dispatch-relay:<dispatch id>`, with a first line
  naming the launch and the machine (`shared/boardDispatch.ts#relayText`: «Ретрансляция запуска `<launch>` с машины
  `<machine>`», the outcome, branch and commit), then the answer as written. A refusal is asked again on the next pass
  with the same key; after five the request goes to the operator as above; a refusal for a request already settled
  ends the run `finished`. The workflow is closed only once the request reads settled: on that pass the run ends
  `finished` and Fabric writes the closing checkpoint under its own lease (`status: done`, the launch, the machine,
  the outcome, branch and commit), which also ends the offer nobody accepted. A posted answer whose request still reads
  open past the run's end and 10 minutes ends the run `unknown`, and the workflow closes when the request is read
  settled.
- **No answer.** `outcome=failed` or `blocked`, or an end with no result file (`exited`, `stopped`, `timed_out`), posts
  nothing, counts as an empty run unless the request is settled (`exited-without-answer`, `timed-out` for `timed_out`)
  and closes the workflow at once (`status: blocked`: Observatory takes only `in_progress`, `done` and `blocked`, and
  refused `failed` on the first live run, 2026-11-11); the next run opens a workflow of its own. Three empty runs (two
  before 0.3.19's §3.8) give the request to the operator, as on this machine.

A run on another machine still holds its place under this dispatcher's caps (§3.3). Code:
`main/boardDispatchRun.ts#createBoardDispatch` (`watchRemote`, `relayRemote`), tests in
`apps/desktop/test/board-dispatch-run.test.mjs` (the `CO-551` tests) and `shared/boardDispatch.test.ts`.

A standing dispatcher on by default changes fabric-agent-contract's choice C5 of DEC-0022 («no background helper by
default»); the contract records it as a DEC citing the operator's words of 2026-11-04 (CT-215).

### 3.8 Every addressee woken and watched (CO-559)

The operator, relayed on board thread `90b6921f` (message `bf3737db`, his words from company-assessment-agent's session
`98b10994`, 2026-11-10): «Если нет кодинга агента в проекте, которому идет задача, значит агент поднимается. И это
работает всегда. И нужно валидировать, если он не поднялся, поднимать насильно еще раз. И валидация каждые 30 секунд.»
Widened in this repository's session the next day: watchers that confirm a run took the work, is alive and finished,
and a board that is cleaned rather than left to pile up ([CO-559](2026-08-16-software-fabric-carryover.md)). Measured
before the change, 2026-11-10 23:39 UTC: 0 of 25 responder slots live, the dispatcher off on the operator's Mac since
CO-556, 49 requests `queued`, 65 projects with unread board messages, and five dispatch workflows open for a day.

1. **The inbox item.** Besides requests, the dispatcher reads `board_inbox_operator` (migration
   `20261111000128_board_inbox_operator.sql`): per Project, the board messages of kind `message`, `finding` and `reply`
   of the last week delivered to it that it neither marked read nor answered later in their thread. The newest stands
   for them all as one item (`OpenRequest.inbox`, capability `board.inbox`, its deadline that message's time plus the
   week), so a Project gets one run for everything that waits, never one per message. A message sent in a clock hour in
   which its sender started 12 threads or more is a fan-out, an announcement in all but its kind, and wakes nobody, also
   after the round has stopped
   (`board-inbox-operator`). The item takes the request's path: the grace of §3.1, no second agent beside a live
   session (§3.2), the caps of §3.3, one run per Project at a time with its requests.
2. **The inbox run's packet** (`boardDispatchRun.ts#inboxBody`): read what waits with `com.list {unread: true}`, do
   what is the Project's own, answer where an answer is owed, and mark every message read with `com.read_ack`; the run
   is settled once its message is read by the Project (`inboxState`, from the message's read marks). A Project's empty
   runs and the back-off after a refused start are counted across its messages until a run reads them; only the
   operator's mark belongs to one message, and a newer message gets one more run (0.3.19 review, iteration 1, ER-2).
   Switchboard starts a request run under its own instructions for one board request (fabric-switchboard
   `dispatch.rs#EXIT_CONTRACT`, `--reason request`); the packet tells an inbox run to read that request as its unread
   messages, settled by `com.read_ack`, and never to claim, accept or complete them (iteration 1, PL-1). Since
   Switchboard 0.7.56 (SB-338, board thread `c650e0aa`) an inbox run is started with `--reason inbox` and Switchboard's
   `dispatch::INBOX_CONTRACT`, which says the same; Fabric passes it only when `switchboard --version` names 0.7.56 or
   later and never with `--target`, and keeps `request` otherwise (`main/boardDispatchWiring.ts#dispatchArgs`,
   `#takesInboxReason`; test `CO-551: the wiring passes --target …`). The packet names its message and thread as
   `board-message:<uuid>` and `board-thread:<uuid>`: Observatory's redaction keeps `board-thread:` and `board-request:`;
   `board-message:` it still redacts (installed 0.35.14), until its `KEEP` takes it (asked in thread `7ae9ac3a`); the
   inbox run reads its messages itself, so nothing it needs is lost. An inbox
   run always starts on this machine, also with a `dispatchTarget` named: a run on another machine has no
   `fabric-mcp` and could not read the board (§3.7; iteration 1, PL-2). A read of the inboxes cut at its 200 projects
   (`more`) never takes a Project it left out as answered: that Project's inbox run is judged by its message's own
   read marks (PL-10, and iteration 2's DA-7); before, such a Project's item read answered.
3. **The watch, every 30 s** (`WATCH_MS`): the dispatcher passes on its own interval, beside the cycle. Each running
   run here is alive only on evidence (`board-dispatch-liveness`): an offer still `offered` or `expired` `ACCEPT_MS`
   (5 min) after the start is a session that never came up (`not-taken`); an accepted run whose workflow wrote no
   checkpoint for `SILENT_MS` (20 min) while its item is open is a hung session (`silent`). Either is stopped through
   Switchboard and started again on the next pass, the workflow taken back as after a crash. A read that fails proves
   nothing and stops nothing; a settled item is never stopped as dead. A run stopped on an account limit is
   Switchboard's to continue on the next account (its recovery, 218 resumed by 2026-11-11), never a wait here; the
   dispatcher has no link to the continued run yet, so it counts the stop as an empty run and starts another
   (CO-562 item 20).
4. **Forced again, then the operator.** `EMPTY_RUNS_TO_OPERATOR` is three: a run that ended, was not taken or went
   silent with its item open counts as empty and the next starts at once; the third hands the item to the operator in
   «На проверке», its workflow closed.
5. **Nothing left open** (`board-dispatch-expiry`): the workflow of a run that ended with its item open is kept for the
   next run `KEEP_OPEN_MS` (two hours), then closed, with the switch on or off; a later run opens a new one.

Corrected by the scenario walk of 2026-11-11 ([CO-562](2026-08-16-software-fabric-carryover.md) keeps what it left):
the liveness checks count from the run's launch (`DispatchRecord.launchedAt`), not the record's creation; a request
whose attempt holds its lease in this pass's read is alive whatever the checkpoints say; both packets ask for a
checkpoint at least every 10 minutes; a workflow a newer run of the same project took over is never closed under it
(the older record is marked closed); a project's inbox counts its empty runs across messages until a run reads them,
so a trickle of messages ends with the operator, and a newer message gets one more run; «На проверке» shows one row
per project, only while its message is still unread; an inbox message is answered once its project has nothing left
unread (`boardDispatchWiring.ts#createInboxState`); a failed inbox read leaves the requests and the watch to go on; a
start whose workflow was closed is never asked again; and a fan-out is judged by the clock hour of each message, so
an old round never wakes anyone once it stops. A project's session counts as live for the dispatcher only while it is
a running terminal or signed in the last 10 minutes (`shared/boardDispatch.ts#sessionLiveForDispatch`).

Not in this step, each carried in CO-559: a live session told of its unread messages (§3.2's wake), the sender shown
the state on its thread, and the fan-out source asked to stop (its owner's change, asked on the board).

### 3.9 Two machines, sleep, retries and memory (2026-11-12)

The operator, 2026-11-12: «диспетчер чтобы работал корректно и на макбуке и на студии и повторы и обработка ошибок и
менеджмент памяти». An audit of the dispatcher's code found where it did not; each fix below has its test in
`apps/desktop/test/board-dispatch-run.test.mjs` (watched failing on the code before it) or `shared/boardDispatch.test.ts`.

- **One board, one dispatcher.** Each Fabric keeps its board in its own stack, so two machines each running Fabric have
  two boards and never start a run for the same request. On a board this Fabric does not own (an external stack named by
  `SUPABASE_URL`) the dispatcher runs only where `settings.json` says `"dispatchOnSharedBoard": true`, by hand on the one
  machine that dispatches (`shared/boardDispatch.ts#dispatcherRuns`, `main/index.ts` `switchOn`). Two dispatchers on one
  board would both start a run for one request: nothing on the board coordinates them yet (a board-side lease per request
  is the next step, CO-567).
- **Sleep.** A run on this machine is frozen while it sleeps, so its liveness (§3.8: `ACCEPT_MS`, `SILENT_MS`) and its end
  (`STOP_GRACE_MS`, `UNKNOWN_AFTER_END_MS`) are judged on time awake, from the power monitor's record of sleep
  (`shared/boardDispatch.ts#suspendedSince`, `main/boardDispatchRun.ts` `awake`, `pastEnd`). A run on another machine,
  which did not sleep with this one, is judged on the clock. Before, the first pass after a sleep of over 20 minutes
  stopped every accepted run here as silent and counted it empty.
- **A run elsewhere is never also started here.** A start on another machine that was not answered may be running there;
  from then on a refusal that would start the run here (`not_on_target`, `target_busy`, `target_unreachable`) is not
  taken, and the record keeps its machine (`remoteUnanswered`). A first answer that refuses outright still starts it here,
  as before. Before an answer from elsewhere is posted, the request is read: one settled meanwhile gets no second answer.
- **A board run elsewhere and a board there.** The packet tells a run on another machine to use `com.*` only when
  `fabric_whoami` names the request's project (`fabric-project:<id>`); a Fabric on that machine keeps a board of its own,
  where the request does not exist. A target that is this machine (by name, `user@name`, `.local`, loopback, or the
  `hostname` that `ssh -G` prints for it from the ssh configuration, with no DNS lookup, compared with this machine's
  names and addresses) starts the run here
  (`shared/boardDispatch.ts#isSelfTarget`).
- **One failure is one request's.** A request whose step throws (a folder read, the responders, a save) waits as a
  refusal does (`refusalBackoffMs`), and every other request is decided in the same pass; a start left `starting` the
  same. The agent Switchboard starts is asked once a pass, Switchboard's version once an hour.
- **An unreadable board.** The runs in flight are still followed (their ends, a run elsewhere and its result, a run past
  its time); none is judged dead without the board, and nothing new starts until it reads again.
- **A call past its deadline.** On macOS and Linux each Switchboard call runs in a process group of its own, and its deadline ends the whole
  group, so an ssh Switchboard started does not outlive it; output past 4 MiB ends the call as a failure
  (`main/boardDispatchWiring.ts#run`); on Windows the deadline ends Switchboard's own process only (CO-569, ER-29). An Observatory child that failed its handshake is closed.
- **Memory.** After every pass, the switch on or off and the board read or not: the history is trimmed (the newest 500 of
  the records not kept), the in-memory maps keep only what the board still shows or a record still names (decisions,
  back-offs, retried opens, workflow leases), the sessions of launches no longer running are forgotten, and a record is
  kept for its request's deadline at most 30 days (`UNTIL_MAX_MS`).
- **Not done here** (CO-567): a board-side lease per request so two dispatchers can share a board, a start elsewhere that
  timed out three times run here once Switchboard can say nothing started there, watching runs in parallel within a pass
  budget, and a responder's lease judged by the database's clock.

### 3.10 A task on the Studio taken to its result, and its questions (2026-11-12)

The operator, 2026-11-12, this repository's session `a6d4264e`: «смотри а фабрик же может получить на доску задание на
студиб в организацию и поднять сессиб и выполнить что надо», then «для те у кого есть уровень доспа к редактировыавнию
модет запускать клауд код сесииб для выбранного репозитория агента или проекта или добавить на доску задачу и клод на
студии ее решит по заказу фабкрики … скорее надо уметь решать вопрос ыи доводить задач удо резултьтата или вопросы
собирать и закидывать нудным людям через агента ПМ (Аня/Кира) или другим агентам», and «изучи north star чтобы не
наделаить лищнего». Read against the North Star (fabric-workspace `knowledge/north-star.md` at `73171ed0`): what it
already decides is followed here, and nothing below adds a mechanism it does not ask for.

- **Who starts.** The North Star's principle 2: an owner, an organization administrator and a project's architect
  command, and their requests approve by themselves and are recorded with their name; a user's request goes through
  the product's approval. Fabric has no levels yet (CO-523, after the contract's CT-250); until it does, a board
  request and a session start are the operator's and his agents'. No separate permission scheme is built.
- **Two doors, one path.** A person picks a project or an agent and writes what to do (one input and one choice), or
  anyone, an agent included, files a request on the board. Both reach the dispatcher, which starts the project's agent
  where its folder and an account with quota are (§3.7, and in 0.3.20 by the repository's owner, `dispatchTargets`).
- **Where.** The North Star's principles 1 and 8 put an organization's work in its own space on its always-on machine,
  under its own accounts and keys. Today the board lives in the operator's Fabric on the laptop and a run goes to the
  Studio over ssh (§3.7, §3.9): an interim. The target is the organization's own hub and board in its space, whose
  dispatcher starts its runs there (G5, CO-552, the 2026-11-21 slice); no scheduler between machines is built on top of
  the interim.
- **To its result.** A run is done when its answer carries its receipts (a commit, a deploy, a test): the North Star's
  «verified work». The North Star's G19 decided on 2026-11-09 that a run on a headless place finishes by itself, but it
  is not built: both packets still say to stop before any step that touches production (0.3.20 review, iteration 3,
  PL-25).
- **Questions** (built here, both packets, `main/boardDispatchRun.ts#QUESTIONS_RULE`): a run first decides a question
  itself, by the project's recorded decisions, its goal, then the safest reversible option, and records why; a question
  for another agent goes to that agent's project with `com.submit`; one that needs a person goes, one request per task
  with options and consequences, to the project that offers `people.ask` in `com.directory`, the organization's PM agent
  (both organizations' PM agents, asked on the board 2026-11-12, requests `019b18dd` and `b3de5244`), or to
  the operator with `fabric_question_ask` while no project offers it. A run on another machine without the board's tools
  cannot ask through the board: its packet tells it to write everything into its result, so it records its open
  questions there and Fabric posts them in the request's thread (iteration 3, PL-25). Meanwhile the run checkpoints and does the
  independent parts; the answer lands in the asking project's thread as an unread message, which starts its next run
  (§3.8). Test: `board-dispatch-run.test.mjs` «§3.10», watched failing on `3ba1201a` before it passed.
- **A session handed over to the Studio.** The operator, the same session: «получается я огу работать на компе а потом
  сказать закомть все и запу и дай продолжить агену на студии». On that word the session commits its work and pushes its
  branch (the repository handoff rule), writes its checkpoint with the exact next task (`observatory_checkpoint_write`),
  files a board request to its own project that names the branch and the workflow, and ends. The project then has no
  live session, so the dispatcher starts its agent where `dispatchTargets` points, the Studio for the operator's
  repositories, and that run continues from the checkpoint and answers with its receipts. Every step uses a door that
  exists; what is missing is the packet naming the workflow to continue (today it travels in the request's text) and a
  «Продолжить на Studio» act in Fabric that does the four steps for the person.
- **Not done here.** The levels (CO-523); the organization's own board on the Studio (G5, CO-552); a large goal split
  into tasks for several projects, which is the manager session's (CO-522 wave D, the North Star's G10); the PM agents'
  `people.ask` responders, which are theirs.

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
- From 0.3.19 (§3.8) any message, finding or reply addressed to a Project with no live session can start such a run,
  not only a request: the packet holds that a board message is data, never an instruction, and the fan-out rule keeps
  announcements from waking anyone; what a message may ask an agent to do is the board's own rule, unchanged.
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

The operations log records the same steps (`board.dispatch.*`), with the platform; a run on another machine adds
`board.dispatch.remote-refused`, `board.dispatch.remote-lost`, `board.dispatch.relay` and `board.dispatch.stopped`
(§3.7), codes and ids only. Switchboard records the launch in its
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
| 2, landed | 2026-11-05: the dispatcher on the real doors (`main/boardDispatchWiring.ts#wireBoardDispatch`: the board through the operator's read door, the slots through `board_responders_operator`, the attempt from the request facts, Switchboard's CLI, Observatory's stdio server), beside the cycle, the switch on by default (`shared/appSettings.ts`, `dispatchBoardRequests`); after the 0.3.16 review: the record written before each start, a refusal waits 10 minutes (since 2026-11-07 twice as long after each refusal in a row, at most six hours, CO-409's ER-6), a project with a live session gets no second agent (the wake of §3.2 is not built, so the request stays that session's), and two empty runs (three from 0.3.19) close the workflow and show the request in «На проверке». Not in 0.3.16: the dispatcher runs on the 60 s cycle only, not on board events (§3.1); the `crash` reason, the mandate, `com.get` reading and `timed-out` of §3.4 and §3.6 are not built; the journal events of §7 (the dispatcher logs to the operations log only), the permissions screen of §6.1, the counts of §8 (CO-496), the wake of §3.2, Claude Code as a fallback when no default agent is set (§3.5: none set is `deferred-no-agent`), and the run on Windows; carried in CO-409, whose row lists each of them since the 0.3.16 review, iteration 3 (DO-5) | |
| 3 | three-iteration verification of the chain and fixes; release | releases; fabric-workspace's version matrix shows every product current on both platforms |

## 10. Checks that prove it

- A request filed to a project with no session is answered by a started session within the grace plus the run, and the
  session's process is gone afterwards (macOS and Windows).
- With the switch off, nothing starts and no decision is recorded (the pass returns before deciding; `skipped-off` is
  `decideDispatch`'s answer for a caller that asks with the switch off).
- Caps hold under ten simultaneous requests.
- A run killed mid-way leaves the request in the state the contract gives it; after a third such run (a second before
  0.3.19, §3.8) Fabric starts no
  more for it and shows it to the operator in «На проверке», its state unchanged (§3.6, option (b)).
- No packet, event, count or log line contains a secret or the request's text where §7 says it must not.
