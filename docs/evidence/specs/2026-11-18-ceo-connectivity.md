# CEO connectivity: the CEO of each computer, reached from Telegram, from other computers and across organizations

**Status:** design, 2026-11-18 (task-pipeline stages 2 to 4: brainstorm, spec, plan). Nothing here is built. It is
stage 2 of the CEO agent; stage 1 is [ADR-0197](https://github.com/passioncode-ai/fabric/blob/feat/ceo-agent/docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md)
on branch `feat/ceo-agent` (worktree `_worktrees/fabric-ceo`, uncommitted on 2026-11-18 over base `cb1a453a`; its
acceptance walk `docs/evidence/plans/2026-11-18-ceo-agent/acceptance.md` is in progress). The waves are in
[the plan](../plans/2026-11-18-ceo-connectivity/plan.md).

**Source.** The operator, 2026-11-18, relayed by the coordinating session (verbatim): «сделай две-три итерации по
интерфейсу, по бизнес-логике, по MCP, по оркестрации, логированию, по устойчивости. Как коннектор, персонал коннектор
будет связываться с этим CEO, который тут стоит. Как можно связываться с удалёнными CEO. Может ли машина между машинами,
как связываться одна машина с другой. CEO между CEO. Какими каналами связи между организациями. Короче, все это мы
максимально еще раз детально прорабатываем, продумываем, проектируем лучшее решение, стабильное, надежное, и агентское,
и пишем спеку на него, и доделываем дальше task pipeline, волнами все выкатываем, идем волнами, пока не закончатся
вопросы незакрытые.»

**Vision.** Aligned with [§4 The user's role](../../ux/vision.md#4-the-users-role): the operator talks to one CEO from
wherever he is and stops carrying which window, computer or session holds which work. It serves the North Star's §6
(Fabric as the entry point for management) and its gaps G10 (the CEO is a coordinator session), G5 (boards between
machines) and G29 (work keeps moving without a person) (fabric-workspace `knowledge/north-star.md` at `4d18a38d`, lines
317-336, 646, 651, 670).

**How to read it.** §0 is the answer in one table. §1 is what exists, with receipts. §2 the invariants every part keeps.
§3 the one model all routes share. §4 to §10 answer the order's areas (a) to (g); §11 the agent surface; §12 (h)
logging; §13 security; §14 (i) resilience; §15 the design iterations that produced this; §16 the acceptance scenarios;
§17 the dependencies.

---

## 0. Decisions at a glance

| Area | Chosen design (one line) |
|---|---|
| (a) Telegram to this computer's CEO | The personal communicator files a board request `ceo.task` to the computer's «Fabric CEO» project with the operator's words; the CEO holds that responder slot; replies, questions (through the existing people-ask bridge) and results come back on the thread, which the communicator forwards. |
| (b) A CEO on another computer | The same `ceo.task` request, filed on that computer's own board: by that computer's communicator device when the operator names it, or by this computer's CEO through the peer link. |
| (c) Computer to computer | A **peer link**: ssh over the tailnet to a forced-command entry `fabric-peer-serve` (one key per peer computer, `restrict`), which calls the remote hub's board door with a peer binding. The PassionCode relay (`fabric-relay/0.1`) becomes the first transport once deployed; ssh stays the fallback. No shared database, no hub on the network. |
| (d) CEO to CEO | A child request on the other CEO's board with envelope `fabric-ceo-task/1` (trace, hops at most 2, path); the parent owns the person and polls; the child owns the work; cancel flows down, questions and results flow up; only the root CEO talks to the operator. |
| (e) Between organizations | One CEO per (computer, context); an organization's CEO reports to its own administrator through its PM agent's `people.ask`, never the operator's communicator; across organizations only a T2 intake `ceo.intake` on the other organization's board, paired by its administrator, payload projection only; data, keys, people and the personal context never cross. |
| (f) Interface | The CEO popup gets «Поручения» (every task with its source, state and computer), the computers' link states in its head, questions answered in place, and the acts open, answer, cancel, retry, stop, kill; every act is an operation of the CEO surface (parity). |
| (g) Business logic | Founder or PM agent, then `ceo.task`, then the CEO ranks and delegates by board request to projects (a live console is typed into only to answer it or on the operator's order), then receipts back; priority P0 to P4; run line USD 100 per task; model floor Sonnet 5.5. |
| MCP | The CEO's operations behind two doors, `ceo.search` and `ceo.execute` (compact-mcp, R33 O15); stage 1's tool names stay callable for one release. |
| (h) Logging | Journal: four new event types holding ids and states only; ops log: one record per inbound, peer call and delegation with a trace id that crosses computers; health checks per link and slot. No message text, no credential, no private path in either. |
| (i) Resilience | At-least-once transport with idempotency keys at every hop; exactly-once effects by the board's claim fence; pull-only status; states for asleep, unreachable and unknown; a test plan of eleven injected faults. |

---

## 1. What exists (read 2026-11-18)

### 1.1 Stage 1: the CEO of one computer

- One CEO console per computer in `<userData>/ceo`, admitted as the project «Fabric CEO», its brief written as
  `CLAUDE.md` and `AGENTS.md` at every start, attachments in `inbox/` (ADR-0197 decision 1, branch `feat/ceo-agent`,
  `docs/adr/0197-...md:31-38`).
- Its runner walks a CEO order, `claude-code` then `hermes` by default (`apps/desktop/src/shared/ceoAgent.ts:43` on that
  branch); a runner that prints a usage limit or ends within 20 s is set aside for an hour
  (`apps/desktop/src/main/ceoAgent.ts:50-54` there). Model floor Sonnet 5.5, preferred Opus 5.5 then GPT-6.2 Sol
  (`shared/ceoAgent.ts:55-70` there).
- Session control tools `fabric_ceo_sessions`, `_session_read`, `_session_input`, `_session_start`, `_session_stop`,
  `_session_resume`, `_session_open` and `fabric_ceo_projects`, each effect with a required `reason`, registered on the
  CEO console's own server only (`main/ceoTools.ts:21-83`, `main/agentSurface.ts:2010-2014` there).
- The PM chain: the brief tells the CEO to `com.enroll` for `ceo.task` on its own project and to read its unread board
  messages (`shared/ceoAgent.ts:138-141` there; ADR-0197 decision 6).
- Not in stage 1 (ADR-0197, Consequences): search and execute doors, a Settings row for the runner order, Hermes with the
  person's MCP servers.

### 1.2 The hub and the board

- The hub is loopback only: `127.0.0.1` and `[::1]`, port 47070 for the first OS user and an offset per further user
  (`apps/desktop/src/main/hub.ts:39-42,72-91`); binding wider "would put the estate on the network without anyone
  deciding to" (`main/agentSurface.ts:470-473`). `Host` must be loopback (421 otherwise), any `Origin` is refused, and a
  caller of another OS account is refused `peer-foreign-account` (`agentSurface.ts:756-779`).
- A door token can only ask; a binding credential is returned once and held as sha256 (ADR-0115 `0115:56-75`,
  `main/externalIngress.ts:175-188`). Tools by principal: the door has `fabric.access.request`, `fabric.access.status`,
  `fabric.session.enroll`; a binding adds `agent.call`, `fabric.access.grants`, `fabric.board.join`,
  `fabric.project.resolve` (`main/hubTools.ts:74-77`).
- A registered service joins the board with `fabric.board.join` and gets `com.*` only, under a `board.respond` grant on
  `board:<project>/<capability>` (`hubTools.ts:217-223`; ADR-0149 §4, `0149:55-60`). It cannot file a request: CO-568
  ([carry-over](2026-08-16-software-fabric-carryover.md), row CO-568) adds `board.submit` on
  `board:<target>/<capability>`, ADR by 2026-11-21, build in the release after 0.3.23 (Fabric's reply `56a39f5f` on board
  thread `96a0da4c`, 2026-11-18).
- The board's wire is `com.submit` to `com.responder_replace` and `com.directory` (`main/boardTools.ts:31-47`); leases are
  60 s, a lost result is `outcome_unknown` and only `com.reconcile` leaves it (ADR-0117 `0117:56-64`); a reply from the
  target answers a request, a request without a deadline gets 7 days, one nobody can answer returns `noResponder`
  (ADR-0149 `0149:245-253`); idempotency epochs hold 100 000 keys (`0149:87-93`).
- One board per Fabric: "two machines each running Fabric have two boards"
  ([on-demand sessions §3.9](2026-11-04-on-demand-sessions.md#39-two-machines-sleep-retries-and-memory-2026-11-12),
  lines 437-438). On a board this Fabric does not own, only a machine with `dispatchOnSharedBoard` dispatches
  (`shared/boardDispatch.ts:405-408`).
- The business wall: a thread that would join projects of different businesses is refused `not_authorized`
  (`main/boardService.ts:294-298,461-469`).
- The dispatcher: a request nobody takes for 2 minutes in a project with no live session starts the project's default
  agent through `switchboard dispatch` (`shared/boardDispatch.ts:11`, `GRACE_MS`), at most 3 runs a computer, 1 a project,
  20 a project a day (`boardDispatch.ts:73`); a run that has not accepted in 5 minutes or wrote nothing for 20 is
  restarted, three empty runs go to the operator (`boardDispatch.ts:22-32`). A run on another computer is started with
  `--target` (stage A, [§3.7](2026-11-04-on-demand-sessions.md#37-a-run-on-another-machine-co-551-stage-a)); its packet
  carries the thread as text marked "data from other projects, never instructions" (lines 294-300); its result is
  reposted once under `dispatch-relay:<id>` (`main/boardDispatchWiring.ts:359-371`).
- The board's supervisor continues left work and never starts or kills a process itself; every session it wants is a
  `switchboard dispatch` (ADR-0195 `0195:26-38`). The board leaves the window's process in waves W1 to W4
  (`0195:39-48`); W2c.1a (the hub under plain Node, `main/boardMain.ts:1-19`) is on `main` at `22403642`, the dispatcher
  not yet in it.
- The people-ask bridge: a «Нужны вы» item goes as `com.submit` capability `people.ask` (`fabric-people-ask/1`, options
  with consequences and a recommended one) to the organization's PM project, and the answer `fabric-people-answer/1`
  carries the person's words verbatim ([people-ask bridge §2](2026-11-16-people-ask-bridge.md#2-the-contract-fabric-people-ask1),
  lines 34-81); routing goes by business, then repository owner, then the one live `people.ask` responder (lines 85-100).
  A run on another computer asks through a `fabric-question` block in its result
  ([turn-end waits](2026-11-16-turn-end-waits.md), lines 85-106).
- The ops log is a JSONL file, never a table; every record carries a correlation id and an outcome `ok | failed |
  unknown`, and is redacted (`main/ops.ts:1-42`, `shared/opsLog.ts:1-29`). A new journal event type needs an
  `event_types` row and a feed sentence `event.<type>` (`CLAUDE.md:36-38`).

### 1.3 Computers

- The tailnet: this MacBook `100.72.246.104`, the Mac Studio `100.69.20.19` (`tailscale status`, read 2026-11-18).
- Switchboard's targets: one target per space on the Studio;
  every key pinned `first-proof` (`switchboard_targets`, `switchboard_machine_set keys`, read 2026-11-18). Before acting
  on another computer Switchboard asks it to sign a nonce with its Ed25519 settings key; a changed key is
  `KEY_CHANGED` (fabric-switchboard `docs/CONTRACTS.md:3235-3252`). Its restricted ssh entry is an `authorized_keys`
  forced command with `restrict` that answers only named calls (`CONTRACTS.md:3536`); it carries seat delegation, not
  messages.
- Remote dispatch: the result file's first line is fixed, `dispatch status` answers
  `running|exited|timed_out|stopped|unknown`, and ssh unreachable is `unknown`, never `exited` (fabric-switchboard
  `docs/design/remote-dispatch.md:49-59`).
- The Studio keeps one OS account per space; an organization's space has its repositories and services but no Fabric yet
  (north-star.md:146-149, CO-513).
- The PassionCode relay (`passioncode-ai/relay`, `fabric-relay/0.1`, contract DEC-0047): device-key admission inside the
  WebSocket, store-and-forward, HPKE envelopes sealed to the target computer; hosted deploy RLY-05 due 2026-11-20
  (relay `docs/backlog.md:13`); Fabric's relay client is CO-453, open. Trust tiers: T0 loopback under the owner's account,
  T1 an enrolled computer of the same owner, T2 everything else; a tunnel or reverse proxy onto loopback is T2 unless
  proven (fabric-agent-contract `docs/specification/delegation.md`, DL-25 and DL-26); the operator's relayed decision
  (DEC-0121) is accepted only from T0 and T1 (`DECISIONS.md:7257-7320`).

### 1.4 The operator's channels

- The personal communicator (in the operator's personal-OS repository): the Mac polls the relay on the
  the communicator's bot service (hosted) every 4 to 5 s; "the Mac pulls, Heroku does not see the Mac"
  (`docs/design/2026-11-14-operator-fabric-link.md:21-55`). **One device only**: the bot holds a single `deviceId` and
  every store query is keyed on it (the bot's `communicator/protocol.js:84`, `store.js:44-162`).
- Its operations: `communicator.notify` (eventId, kind, at most 3500 characters; a question with `questionId`,
  `revision`, `expiresAt`), `answer`, `sessions`, `session_start`, `session_continue`, `status` (its `search`, read
  2026-11-18). Inbound kinds: `status`, `lifecycle.*`, `dashboard.open`, `agent.message`, `agent.respond`, `inbox.read`,
  `fabric.ask`, `sessions.list`, `session.start`, `session.continue`, `board.task`, `board.reply`
  (`communicator/core.py:13-32`).
- There is **no route from a Telegram message to a running CEO**: `fabric.ask` and `board.task` run a short bridge
  session that files on the board and waits up to 20 minutes (the communicator's module doc, lines 39 and 109,
  `sessions.py:658,838`). Its board-first design routes "передай агенту X" to the board and an unclear addressee to the
  project `fabric` (`docs/design/2026-11-18-board-first-routing.md:37-48`, BL-1506 to BL-1510).
- It holds the board desks `operator.ask` and `people.ask` (`communicator_status`, 2026-11-18). Measured the same hour:
  of its last 20 commands 14 `failed`, 3 `partial`, 3 `succeeded`, and its status snapshot is stale since 2026-11-04. A
  reliability fact this design depends on, filed in the plan.
- The Telegram gateway (`telegram-gateway.default`) is the operator's own user account over MTProto; sends wait for
  approval except in exempted chats; a DM allowlist; idempotency per key; an optional tailnet listener for grant tokens
  only (`telegram-gateway-agent/README.md:3-171`). By R33 O9 it is the channel to anyone but the operator
  (fabric-agents-database `templates/delivery-gateway/TEMPLATE.md:157-172`, D-50).

### 1.5 Organizations

- A context is an estate; one Fabric will serve the personal context and every organization context at once; a
  session reads only its project's estate; the board is per estate and a request across contexts is refused
  `cross-context`; personal events never leave the computer; `kid` and enrolment are per (computer, estate) (CO-422,
  [contexts beside personal](2026-11-17-contexts-beside-personal.md), lines 16-19, 50-54).
- Organization agents call and accept calls only from agents of the same organization; a personal agent serves an
  organization only as a separate instance in it (north-star.md §11).
- An organization's agent reports to its own administrator through `people.ask`, never the operator's channel
  (delivery-gateway `TEMPLATE.md:157-172`); copies in different organizations exchange only mechanics through the
  architect, never an organization's data (agents database `AGENTS.md:52`, R33 O10); the scope gate labels data
  `org/project`, unknown is closed, and `cross-org` is "only a migration" (`patterns/scope-gate/PATTERN.md:24-48`).
- Federation doctrine: across estates a task is an A2A-style task, `INPUT_REQUIRED` is a question, a terminal state never
  restarts, and continuation is a new task under the same context (`docs/architecture/federation.md:59-73`); between
  estates memory crosses only as an artifact through a declared point (`federation.md:108-120`).

### 1.6 What does not exist

A route from Telegram to a running CEO; a second communicator device; any way into another computer's board except a
dispatched run's reposted result; a delegation-token issuer (`Fabric-Delegation` does not occur in `apps/desktop/src`);
search and execute doors in the hub; the relay's hosted instance and Fabric's client; a Fabric in an organization's
space on the Studio.

---

## 2. Invariants

| # | Invariant | Why |
|---|---|---|
| I-1 | **One mailbox.** Everything that reaches a CEO, from any channel, is a board request with capability `ceo.task` (or `ceo.intake` across organizations) on the board of the computer that CEO runs on. No channel types into the CEO's console. | One record, one dedupe point, one history; a keystroke has no id, no provenance and no receipt (§15.2). |
| I-2 | **Each board stays its computer's.** Computers exchange requests through a peer link into the other board's door, never through a shared database. | Logical federation (`federation.md:13-17`); one board, one dispatcher (§3.9 of the on-demand spec). |
| I-3 | **Pull, never push into a computer.** A computer that sleeps or has no public address is reached only by what it pulls or by a call it can refuse. | The hub is loopback only (§1.2); cloud-showcase: no relay that forwards a request in (`patterns/cloud-showcase/PATTERN.md:12-16`). |
| I-4 | **At-least-once transport, exactly-once effect.** Every hop carries an idempotency key derived from the hop before; an effect is fenced by the board's claim and `effect_begin`; a lost outcome is `outcome_unknown` and is settled by observation, never by running it again. | ADR-0117 `0117:56-64`; approval-outbox (`PATTERN.md:47-72`). |
| I-5 | **The operator's words travel with their four fields** (words verbatim, when, where, scope; DEC-0121, DEC-0126) and are believed only from T0 or T1. | One approval binds all his agents; a T2 origin's decision is dropped (§1.3). |
| I-6 | **No secret in a message.** Credentials move only through Observatory's vault and stdin; files move as links or local paths of the same OS account. | The global rule; the journal is permanent. |
| I-7 | **Channels by audience** (R33 O9): to the operator, the communicator; to anyone else, the Telegram gateway; an organization's CEO to its own administrator through its PM agent. | delivery-gateway `TEMPLATE.md:157-172`. |
| I-8 | **The root talks to the person.** Only the CEO that received a person's request answers or asks that person; a child CEO asks its parent. | Two computers asking the operator the same thing is noise and a race of answers (§15.4). |
| I-9 | **Bounded delegation.** At most two hops (person, CEO, CEO), no computer twice on a path. | Loops between CEOs burn quota silently. |
| I-10 | **Two doors.** Every new MCP surface is `search` plus `execute`; every UI act is one of its operations. | compact-mcp R33 O15 (`patterns/compact-mcp/PATTERN.md:11-34`); agent-surface R33 O8. |
| I-11 | **Text for people has no em dash** and goes through the copywriting skill, then the copy checker's `check`. | The operator's copy rules. |
| I-12 | **Nothing here makes the hub listen on a network.** | `agentSurface.ts:470-473`. |

---

## 3. The model shared by every route

### 3.1 The CEO's address

A CEO is addressed by **(computer, context)**. The computer is its Switchboard target name (the Studio's operator space) with a
person's label («Студия»); the context is `personal` or `org:<id>` (CO-422). On each computer and context the CEO's board
identity is the project «Fabric CEO» (stage 1), capability `ceo.task`. A computer whose Fabric serves several contexts
has one CEO per context that enabled one (§8).

Fabric keeps a **CEO directory** `userData/ceo-peers.json` (0600): for each paired computer its target name, label,
context, the remote CEO project's id, the transport order, the link's last state and the vault slot of its peer
credential (a name, never a value). It is the only place a CEO learns where other CEOs are.

### 3.2 The envelope `fabric-ceo-task/1`

Every `ceo.task` request body is Russian text for its reader, then one fenced `json` block, the last such block read
(the people-ask convention):

```json
{"schema":"fabric-ceo-task/1",
 "task":"<uuid: this request's key>",
 "trace":"<uuid: the root task's key>",
 "hops":0,
 "path":["macbook-pro"],
 "origin":{"channel":"telegram|home|popup|voice|pm|peer|left-work","actor":"operator|agent:<name>|ceo:<computer>",
           "source":"<message or thread id>","at":"<ISO>"},
 "operator":{"by":"operator","via":"relayed-instruction","instruction":"<his words verbatim, at most 500>","at":"<ISO>",
             "source":{"channel":"telegram","message":"<id>"},"scope":"<what the words approve>"},
 "want":"<the task in one paragraph>",
 "project":"<a project name or null: the CEO routes>",
 "pin":"<computer or null>",
 "attachments":[{"name":"plan.png","path":"<absolute path on the receiving computer or null>","link":"<https or null>","sha256":"<hex>","bytes":12345}],
 "priority":"P0|P1|P2|P3|P4",
 "budget_usd":100,
 "deadline":"<ISO>",
 "reply":{"computer":"macbook-pro","thread":"<uuid>","request":"<uuid>"}}
```

`operator` is present only when the operator's words are carried (DEC-0121's shape plus `scope`, DEC-0126). `reply`
names the parent of a child request (§7). The body is at most 64 KB (the board's limit) and its text at most 3500
characters, so the communicator can forward it whole. Parser and validator: `shared/ceoTask.ts` (pure); refusals are
typed `invalid-envelope`, `ceo-loop`, `hops-exceeded`, `cross-context`.

Replies use four more blocks, each the last of its kind in its message:

| Block | Sent with | By | Meaning |
|---|---|---|---|
| `fabric-ceo-progress/1` `{task, state, note, tell, children:[{task, computer, state}]}` | `com.progress` | the CEO holding the request | a state change worth telling, not every step |
| `fabric-ceo-question/1` `{task, qid, text, options:[{id,label,consequence}], recommended, freeText, deadline}` | `com.progress` | a child CEO | a decision it cannot take; it goes up to its parent (I-8) |
| `fabric-ceo-answer/1` `{task, qid, option, text, words, decider, at}` | `com.submit` kind `message` on the child's thread, no `replyTo` | the parent | the answer; the operator's words inside carry the four fields of I-5 (a reply naming the request would answer and close it) |
| `fabric-ceo-result/1` `{task, outcome:"done|failed|cancelled|blocked", summary, receipts:[{kind:"commit|pr|release|deploy|test|link", ref}], artifacts:[{name, link, sha256}], spent_usd, sessions:[...], next}` | `com.reply`, then `com.complete` | the CEO holding the request | the result with its receipts |

### 3.3 The task's lifecycle

```text
received -> accepted -> working -> (waiting: question | approval | computer | child) -> working -> done
                                                                                    \-> failed | cancelled | blocked
```

| CEO state | Board state of its request | Who moves it |
|---|---|---|
| received | `queued` | the sender's `com.submit` |
| accepted | `claimed`, then `accepted` | the CEO: `com.claim`, `com.accept` |
| working | `in_progress` | the CEO's first effect: `com.effect_begin` |
| waiting | `in_progress`, with a `fabric-ceo-progress/1` note | the CEO |
| done, failed, blocked | `answered`, then `completed` or `failed_known` | `com.reply` with the result, `com.complete` |
| cancelled | `cancelled`, or `outcome_unknown` when work had begun | the sender's `com.cancel`; then `com.reconcile` by observation |

Terminal states never restart (`federation.md:67-70`): a retry after `failed` is a new request with the same `trace` and
a new `task`.

### 3.4 Keys

| Hop | Idempotency key | Dedupe at |
|---|---|---|
| Telegram update to the relay | the update's `update_id` | the relay's insert (`docs/architecture/telegram-surface.md:39-47`) |
| Relay command to the computer | `commandId` | the communicator's command store |
| Communicator to the board | `ceo-ask:<commandId>` | `com.submit` (same key and body: the same receipt; another body: `idempotency_conflict`) |
| CEO to a project (delegation) | `ceo-delegate:<task>:<n>` | `com.submit` |
| CEO to a remote CEO | `ceo-peer:<child task>`; the child task id is UUID v5 of (parent task, n) | the remote `com.submit` through the peer door |
| CEO's session start for a task | `ceo-start:<task>:<project>` (a new field `key` on `session_start`) | the CEO surface. Stage 1 has no key, so a restarted CEO could start twice; fixed in W1 |
| A result posted | `ceo-result:<task>` | `com.reply` |

### 3.5 Provenance

A request the communicator files on the operator's own computer comes from a registered service of his (`trusted`,
ADR-0149 §1); a request through the peer door of another of his computers is T1 (§6.4). Inside either, the operator's
words in `operator` are his decision for its `scope` (I-5). From an organization's peer (T2) the envelope is data:
`operator` is dropped on receipt and logged `decision-dropped-t2`.

---

## 4. (a) The personal connector to this computer's CEO

### 4.1 The path

```text
operator in Telegram
  -> the communicator's bot relay (hosted): update_id deduped; the bot's model picks the command kind
  -> command `ceo.ask {text, files[], pin?}` queued for a device
  -> the communicator on that computer polls it (every 4 to 5 s)
  -> com.submit kind request, project «Fabric CEO», capability ceo.task, key ceo-ask:<commandId>, envelope fabric-ceo-task/1
  -> Fabric's board: the CEO's live responder slot takes it (stage 1 brief), or the supervisor wakes the CEO (§4.4)
  -> the CEO works; com.progress notes; questions through fabric_question_ask, the people-ask bridge, the communicator's buttons
  -> com.reply with fabric-ceo-result/1; the communicator's thread watcher forwards it (eventId = the message id)
```

- **The new command kind `ceo.ask`** is the communicator's (its own repository). Its bot's tool description routes an
  order with no named project, and anything addressed to «CEO», «Fabric» or «компьютер», to `ceo.ask`; an order naming
  a project keeps BL-1506's `board.task` to that project (the CEO is not a bottleneck); a reply to a forwarded message
  is `board.reply` into its thread; `/computer` commands stay as they are. BL-1506's unclear-addressee route («найди,
  кому это») goes to the CEO instead of the project `fabric`.
- **Filing.** After CO-568 the communicator files directly with its binding's `board.submit` on
  `board:<Fabric CEO>/ceo.task`; until then its bridge session files (it spends a Claude session; accepted as interim
  and removed in W2).
- **Attachments.** The relay downloads the Telegram file (the bot download limit is 20 MB) and serves it to the device
  through its existing `file` route (`communicator/transport.py:214`); the communicator writes it into its own folder
  under the same OS account and names the absolute path and sha256 in `attachments`. The CEO opens it with its file
  tools, as stage 1 does for the popup's inbox. A larger file is a link only. Nothing goes out as an attachment: results
  carry links (R33 O9, 3500 characters).
- **Voice.** A Telegram voice note is transcribed on the communicator's side; the envelope's `origin.channel` is `voice`
  and the text is the transcription; Fabric keeps no audio.
- **Questions with choices.** The CEO asks the operator with `fabric_question_ask` (options, a recommended one, their
  consequences). The item reaches «Нужны вы» and, through the people-ask bridge, the communicator's `people.ask` desk,
  which already sends buttons and returns `fabric-people-answer/1` with his words verbatim (§1.2). No second question
  channel is built. The task's thread also gets a `fabric-ceo-progress/1` note «жду ответа».
- **Approvals.** An approval said in Telegram arrives as an answer to a question (above) or as a reply on the thread;
  both carry his words verbatim with the Telegram message id and time, so the CEO records them as the operator's
  decision (DEC-0126) within the task's scope.
- **What reaches Telegram.** Not every progress note: the communicator forwards `fabric-ceo-result/1`, questions, and
  progress notes whose state is `waiting` or that carry `tell: true` (at most one an hour per task). The rest stays on
  the thread and in the popup.

### 4.2 Which computer's CEO answers

- The relay serves one device today (§1.4). The design needs **one communicator device per computer** that has a CEO
  (`deviceId` per computer, commands addressed to a device): the communicator's work, asked on the board in W2.
- **Routing rule** (decided, plan Q-1): an order the operator pins («на студии», «на ноутбуке») goes to that device. An
  unpinned order goes to the default device (`ceo.defaultDevice` in the communicator, initially this MacBook). If the
  default device has not polled for 2 minutes (asleep, closed, off the tailnet), the relay moves the unpinned command to
  the next device in `ceo.devices` (the Studio's operator space), withdraws it from the first device so a late wake
  cannot take it twice, and tells the operator once: «Ноутбук спит, передал CEO на Студии». A pinned order waits up to 6
  hours (BL-1508's horizon) and says «ждёт ноутбук».
- Until the communicator has several devices, the MacBook's CEO reaches the Studio's CEO through the peer link (§6) when
  the operator names it, and while the MacBook sleeps nothing reaches the Studio from Telegram. Said, not hidden.

### 4.3 When Fabric is closed or the computer sleeps

| State | What happens | What the operator sees |
|---|---|---|
| Fabric's windows closed, «Служба доски» on | The main process keeps the board, the hub and the consoles (ADR-0192 `0192:18-27`); the CEO console lives. | Nothing different. |
| Fabric quit or crashed, the board's service up (ADR-0195 W2 to W4) | The request lands on the board; no CEO console holds the slot, so the supervisor wakes one (§4.4). | The answer a little later. |
| The whole computer asleep | The relay keeps the command; §4.2 routes or waits. | «Ноутбук спит, ...» once. |
| The communicator down | Commands are not polled; the same as asleep; `communicator_status` names it. | The same, after 2 minutes. |
| The board's stack lost (`stack-unavailable`) | `com.submit` is refused 503; the communicator retries with the same key (I-4). | «Fabric на ноутбуке не отвечает, повторю» once. |

### 4.4 Waking the CEO

A `ceo.task` request with no live responder on the CEO's slot:

1. If the window's process lives (stage 1's `PtyManager`), the supervisor calls a new hub port `ceo.ensure` (one more
   `HubPorts` member, in ADR-0195 W1's shape, `main/hubPorts.ts:47-54`): the CEO console starts at once and enrolls;
   there is no 2-minute grace.
2. Otherwise the dispatcher's ordinary path: after `GRACE_MS` it starts the default agent in the CEO project's folder
   (`<userData>/ceo`), which reads the CEO brief and takes the request. The brief is written at admission and at every
   board-service start, not only at a console start, so a CEO-on-demand run has it (W1).
3. After ADR-0195 W3 the CEO console itself runs in Switchboard's session host, so a restart of Fabric never ends it.

---

## 5. (b) A CEO on another computer

- **From Telegram:** the operator pins the computer (§4.2); that computer's communicator device files on its own board.
  The path is §4.
- **From an agent or the operator in Fabric:** the local CEO uses `remote.submit` (§11), which files a child request on
  the remote board through the peer link (§6) with `reply` naming the local thread. «Поручения» shows the child under
  its parent with the remote computer's name and state.
- **From a PM agent:** a PM agent files on the board of the computer it lives with and, for another computer, asks its
  local CEO to delegate, rather than holding links to every computer.
- **Where the remote CEO runs.** On the Studio's operator space the CEO needs a Fabric (at least the headless board of
  ADR-0195 W2 and W4) and the CEO project. Until a console can run there headless (ADR-0195 W3), the Studio's CEO is
  on-demand: the dispatcher's run in its CEO folder (§4.4 step 2). That is enough for a task to be taken, worked and
  answered while the MacBook sleeps.

---

## 6. (c) Computer to computer: the peer link

### 6.1 Options weighed

| Option | Verdict | Why |
|---|---|---|
| **A shared board** (both Fabrics on one Supabase stack through `SUPABASE_URL`) | rejected | It puts every estate's journal in one database and the service-role key on every computer; two dispatchers on one board start two runs (§3.9, CO-567 open); it breaks logical federation (`federation.md:13-17`) and CO-422's D-5 and D-6. |
| **The hub on the tailnet** (bind the hub to `100.x`) | rejected | The hub is loopback by decision (`agentSurface.ts:470-473`, I-12); a door token reachable on a network is the estate; the tailnet's ACL would be the only guard (the gateway's own warning, `telegram-gateway-agent/README.md:171`). |
| **ssh local forward to the remote hub port** (`ssh -L`) | rejected | The port differs per OS user (`hub.ts:72-91`); a forward opens a local port any local process can use; a tunnel onto loopback looks like T0 to the remote hub though it is T2 unless proven (§1.3): a privilege confusion. |
| **Telegram or mail as a bus** | rejected | Rate limits (`telegram-surface.md:152-170`), no computer identity, text a model must parse; mail has no door in Fabric. |
| **Switchboard dispatch only** (stage A) | kept as the fallback for project work | It starts a headless run with a packet and reposts the result (§1.2); it has no conversation, no cancel into the run's reasoning and no question channel beyond `blocked`. Right for a project's task on that computer, wrong as a channel between CEOs. |
| **ssh forced command into a peer door** | **chosen now** | Works today over the tailnet; the ssh key names the calling computer (the remote side proves T1, not the caller's claim); `restrict` forbids shells and forwards; no listening port anywhere; Switchboard's `ssh-serve` is the proven precedent (`CONTRACTS.md:3536`), as is the agents database's bridge that reaches a door "over an ssh local forward with a `board` caller token of its own" (`playbooks/agent-processes.md:83-87`), whose forward this design replaces with a forced command for the reasons in the row above. |
| **The PassionCode relay** (`fabric-relay/0.1`) | **chosen as the first transport once deployed** | Outward-only connections from both computers, store-and-forward (it survives sleep on either side), device-key admission (T1 by construction), envelopes sealed to the target (DEC-0047). Not deployed (RLY-05 due 2026-11-20) and Fabric's client is CO-453. |
| Tailscale itself | the network, not a transport | Both chosen transports may run over it; nothing here depends on Tailscale beyond reachability. |

### 6.2 The peer door

`<Fabric>/bin/fabric-peer-serve` is a thin CLI in the bundle (CO-568's thin-CLI shape). It is installed on a computer as
an `authorized_keys` line of the OS account that runs Fabric:

```text
command="<Fabric>/bin/fabric-peer-serve --peer macbook-pro",restrict ssh-ed25519 AAAA... fabric-peer:macbook-pro
```

- `--peer` is written by the pairing (§6.3), so the remote side knows which computer calls from the key it accepted,
  never from the request. `restrict` disables the pty, forwards and the agent.
- It reads JSON lines on stdin, at most 64 KB each and 20 per connection: `{op, args, key, credential}`. The credential
  is the peer binding this computer's Fabric issued (§6.3); it travels on stdin only, never in argv or the environment
  (I-6).
- It reads `hub.json` locally (never sent anywhere), checks that the hub's pid is alive (`hub.ts:18-21`), and calls the
  hub's board door as the peer binding over loopback. The hub records the principal as `peer:<computer>` with tier T1
  (the operator's own computers) or T2 (an organization's pairing), from the binding's record, never from the
  connection.
- **Operations** (anything else is `NOT_ALLOWED`):

| op | Does | Board call |
|---|---|---|
| `hello` | the protocol version, the CEO's state, the contexts this computer's CEO serves | read |
| `ceo.submit` | files a `ceo.task` (T1) or `ceo.intake` (T2) request on the CEO project, in a new thread | `com.submit` under `board.submit` on `board:<CEO>/<capability>` |
| `ceo.events` | the thread's messages after a cursor, at most 50 | `com.list {thread, cursor}` |
| `ceo.get` | the request's state | `com.get` |
| `ceo.answer` | a parent's `fabric-ceo-answer/1` on the thread | `com.submit` kind `message` |
| `ceo.cancel` | cancels the request with a reason | `com.cancel` |

- Each answer is one JSON line `{ok, result | error:{code, message}}`; codes `NOT_ALLOWED`, `unauthenticated`, `hub-down`
  (no `hub.json`, or a dead pid), `stack-unavailable`, `cross-context`, `ceo-loop`, `hops-exceeded`, `rate-limited`,
  `idempotency-conflict`. It exits 0 always (the answer carries the outcome), except on a malformed stream (exit 2).
- Rate limits per peer binding: 30 submits an hour and 300 calls an hour (CO-568's per-binding limit, in its shape).

### 6.3 Pairing

«Связать компьютер» in Settings, or the operation `peer.pair {target}`, done by the agent on the operator's word:

1. Read the target from Switchboard's targets and check it is not this computer (`ssh -G`, as `isSelfTarget` does,
   `boardDispatchWiring.ts:490-495`).
2. Generate a dedicated key `~/.ssh/fabric_peer_<target>` (ed25519, no passphrase, 0600) on this computer.
3. Over the operator's existing ssh login to the target (BatchMode, a 15 s connect timeout, a 120 s deadline: the
   account-service bounds, agents database `templates/account-service/playbook.md:296-313`), run
   `<Fabric>/bin/fabric-peer-serve --pair` there with this computer's name and the new public key on stdin. On the
   target, `--pair` asks its Fabric's Agent access for a peer binding: on the operator's own computer it is allowed at
   once and recorded (ADR-0115 as amended for the operator's computer, `0115:473-479`); on an organization's computer
   that organization's administrator decides (Agent access, or relayed words, ADR-0190), and the pairing waits (§8).
4. On allow, the target appends the forced-command line to its own `authorized_keys` (only that line, under a lock,
   idempotent by the key's comment) and returns the binding credential once on stdout.
5. This computer stores it with `vault.py` under `fabric/prod/PEER_<TARGET>` (the value on stdin, never shown) and writes
   the directory entry (§3.1). Each direction is its own pairing and binding.
6. Unpairing removes the line, revokes the binding on the target (`fabric_access_revoke`) and removes the vault slot.

### 6.4 Trust

- **T1 by two factors:** the ssh key the forced command accepted names the computer; the binding names the same computer
  and was issued by the target's Fabric on a recorded decision. A stolen credential without the key, or the key without
  the credential, is refused.
- When CO-422 C5 gives each (computer, estate) its own signing key (`kid`), the peer door also verifies a signature over
  the time, a nonce and the body digest (300 s skew, a replay table; `patterns/fail-closed-door/PATTERN.md:41-47`,
  `patterns/cloud-showcase/PATTERN.md:39-43`). Recorded as the next hardening, not a prerequisite.
- The relay transport's T1 is the relay's device-key admission (DEC-0047; DEC-0106 machine profiles, where a `view`
  profile refuses every effect).

### 6.5 The client and the transport order

The client is deterministic code in the board's process (`main/ceoPeerLink.ts`), never the CEO model:

1. **The relay**, when paired over it and connected: a sealed envelope per op, store-and-forward.
2. **ssh** to the forced command: `ssh -i ~/.ssh/fabric_peer_<target> -o BatchMode=yes -o ConnectTimeout=15
   -o ServerAliveInterval=15 <target>`, a 60 s deadline per batch, the process group ended at the deadline (the
   dispatcher's rule, on-demand §3.9 lines 467-469); one batch at a time per target.
3. Neither answers: the link is `unreachable` (or `asleep` when the relay reports the device offline); the op stays in
   `userData/ceo-peer-outbox.json` (0600) with its key and is retried with backoff from 30 s doubling to 10 minutes; the
   task shows `waiting: computer`.

For a *project's* task whose repository lives on that computer while its CEO is unreachable, the local CEO may instead
file on its own board to that project and let `dispatchTargets` run it there (stage A); it says so on the task.

---

## 7. (d) CEO to CEO

- **Delegating.** The parent CEO decides a part of its task belongs to another computer (the project's repository is
  only there, the operator pinned it, or this computer lacks quota). It calls `remote.submit {computer, want, project?,
  budget_usd, deadline}`; Fabric's code, not the model, builds the child envelope (`task` = UUID v5 of (parent task, n),
  the same `trace`, `hops` plus 1, `path` plus this computer, `reply` = the parent's thread; the parent's `operator`
  block is copied only when its scope covers the part delegated) and files it through the peer link. The child appears
  on the parent's thread in a `fabric-ceo-progress/1` with `children`.
- **Loop prevention.** The receiving side refuses `ceo-loop` when its computer is already on `path`, and
  `hops-exceeded` above 2; a child CEO delegates to its own projects but not to another CEO. Refusals are said on the
  parent's thread, and the parent does the part locally or reports `blocked`.
- **Ownership.** The parent owns the task towards the person; the child owns its request to completion. The child never
  messages the operator (I-8): its questions go up as `fabric-ceo-question/1`, the parent asks the operator (§4.1) and
  sends his answer down as `fabric-ceo-answer/1` with his words and their four fields.
- **Status.** The parent's peer client polls `ceo.events` every 60 s while a child is open, every 10 minutes after 2 hours
  without change, at once on wake and on the operator's «что там»; it mirrors each new child message into the parent's
  thread as a progress note and wakes the parent CEO's model only for a question, a result or a refusal (cost, §15.6).
  The child never pushes to the parent (I-3).
- **Cancellation.** The operator's «отмени» cancels the root (`com.cancel` by its sender); the parent's peer client
  cancels every open child (`ceo.cancel`, reason «поручение отменено»); a child CEO stops the sessions it started for
  that task (stage 1's `session_stop` with that reason) and answers `fabric-ceo-result/1` with outcome `cancelled` and
  what was already done. A child whose work had begun stays `outcome_unknown` until reconciled by observation (I-4).
- **Results.** The child's result carries receipts (commits, PRs, deploys, tests) and links; the parent folds them into
  its own result. A receipt is a reference that resolves elsewhere (a commit on a remote, a URL), never a local path of
  the other computer.
- **One approval.** An approval the operator gave anywhere binds both CEOs when relayed with its four fields (I-5); each
  CEO still checks its own limits (the run line, the floors) and asks again only about what the words did not see.
- **Deadlines.** A child inherits the parent's deadline minus 10 minutes; past it the child ends `failed_known` with what
  it has, and the parent reports.

---

## 8. (e) Between organizations

- **Where an organization's CEO lives.** In its organization's space: its OS account on its always-on computer, its own
  Fabric and board (CO-513, CO-552), its own Switchboard group and keys (north-star §2 and §11). On a computer whose
  Fabric serves several contexts (CO-422), one CEO per context that enabled one; the personal CEO never reads an
  organization's board (CO-422 D-4, D-5), and an organization's CEO never reads the personal one.
- **Who it reports to.** Its own administrator, through its organization's PM agent's `people.ask` (each organization has its own), routed by business and owner as the people-ask bridge does (§1.2); never the
  operator's communicator (R33 O9). The operator, as an organization's owner, hears it through that organization's PM
  channel.
- **Channels between organizations, in order:**

| Channel | Use | Rule |
|---|---|---|
| **The intake `ceo.intake`** on the other organization's CEO, through a peer link that organization's administrator paired | asking another organization to do a piece of work | T2: the payload projection only (the `want`, public links, a deadline), never the sender's records, memory or names; `operator` dropped on receipt; the receiving CEO treats it as a request from outside and decides by its own organization's rules; its result is an artifact (`federation.md:108-120`). Both sides' scope gates check the payload, at the sender and at the door (`scope-gate/PATTERN.md:45-48`). |
| **The Telegram gateway** of the organization whose people are messaged | messages to people | only on an explicit send instruction for that act (the global rule); the organization's own gateway copy for its people. |
| **The organization relay** (DEC-0134) | later: the same intake carried by the relay, members T2 to each other | after RLY-09 and CO-453. |
| Mail | not a channel here | no mail door in Fabric; a deal desk owns mail. |
| The board across businesses | refused | the wall (`boardService.ts:461-469`) and CO-422 D-5 stay. |

- **What never crosses:** an organization's data (records, transcripts, memory, people, clients), keys and credentials,
  private paths, anything of the personal context, and between the two sides the operator keeps apart (his separation
  rule) nothing at all in either direction, enforced by the scope gate's denylist in the private routes file and never
  named in this repository.
- **The personal CEO and an organization.** The operator may ask his personal CEO to have an organization do something;
  the personal CEO then uses that organization's intake like any outsider (T2). Acting inside the organization as its
  administrator is the organization's own CEO's job, reached through the organization's channel.

---

## 9. (f) The interface

All copy is Russian, written with the copywriting skill and checked with the copy checker's `check` (roles `title`, `label`,
`button`, `body`) before it ships; no em dash. Terms: «Поручение» (a CEO task), «компьютер» (never «машина» for
people), «на связи», «спит», «нет связи».

### 9.1 The CEO popup (stage 1's window)

- **Head:** the runner and state (stage 1), then this computer's label, then a row of paired computers each with a
  state dot: «Студия: на связи», «Ноутбук: спит с 14:02», «eSIM Studio: нет связи 2 ч». A click opens that computer's
  tasks.
- **Tabs:** «Разговор» (the console, stage 1), «Поручения», «Сессии».
- **«Поручения»:** one row per task, newest first, grouped by state («Ждут вас», «В работе», «Готово за сегодня»). A
  row shows the source (Telegram, голос, главная, PM-агент, другой CEO), the first line of `want`, the computer, the
  state in words («ждёт ответа», «у CEO Студии», «готово: 2 коммита»), and its children indented. Acts on a row:
  «Открыть» (the thread and its sessions), «Ответить» (a question in place: its options as buttons, a text field,
  «Отдать агенту»), «Отменить», «Повторить» (a new task with the same trace), «Открыть сессию».
- **«Сессии»:** stage 1's list, each session's question shown in place when it waits (the «Нужны вы» items of that
  session), and the acts choose, approve, open, close, reopen, start, stop and kill. Kill asks once, naming the session
  and what is lost; every other act acts at once.
- **Empty and failed states:** «Поручений нет», «Нет связи со Студией: поручение ждёт, повторю через 5 мин», «CEO
  перезапускается: Claude Code упёрся в лимит, работает Hermes».

### 9.2 Settings, section «CEO»

The runner order (stage 1's missing row), «Принимать поручения из Telegram» (on), the default computer for Telegram
(written to the communicator through its door), the paired computers with «Связать компьютер» and «Отвязать», and each
computer's transport and last contact.

### 9.3 Parity

Every act above is one operation of §11; the window calls the same operation through IPC as an agent does through
`ceo.execute` (agent-surface R33 O8; AS-5: parity never widens access).

---

## 10. (g) Business logic and orchestration

### 10.1 The chain

```text
founder (the operator, or an organization's owner)
  -> PM agent (Kira, Ania; for the operator the communicator acts as his PM) collects and shapes the task
  -> ceo.task to the CEO of the right computer and context
  -> CEO: rank, decompose, delegate
       -> a project's part: a board request to that project (capability change.request or the project's own);
          the dispatcher wakes or starts its agent; the result returns on the thread
       -> another computer's part: remote.submit (§7)
       -> an interactive order («открой сессию в X», «ответь ей»): stage 1's session tools directly
  -> CEO answers each question from recorded decisions (ceo_trust `cited`, board-and-ceo.md §11), else asks up
  -> fabric-ceo-result/1 with receipts -> PM agent -> founder
```

Delegating by board request is the default (decided, plan Q-3): it is tracked, survives restarts, wakes absent agents
and returns receipts on a thread. Typing into a live console stays for answering that session or the operator's explicit
order.

### 10.2 Priority

| Level | Source | Rule |
|---|---|---|
| P0 | the operator now (popup, voice, Telegram marked «срочно») | taken before anything; may pause P3 and P4 work the CEO started |
| P1 | the operator's other orders | in arrival order |
| P2 | a PM agent's order | ranked by the project's tier (board-and-ceo.md §10) |
| P3 | another CEO's child request | after P2 at an equal tier |
| P4 | left work and the CEO's own follow-ups | when nothing above waits |

At most 5 tasks in `working` at once per CEO; the rest wait in `accepted` with a progress note giving their place. The
dispatcher's limits still bound the sessions the delegations start (3 a computer, 1 a project, 20 a project a day).

### 10.3 Limits

- **Run line USD 100 per task** (the operator's rule of 2026-11-17 for runs being tested): the CEO sums what its task
  spends on money-billed routes (an OpenRouter fallback, paid APIs; a subscription session and the media agent, which runs
  without limits since 2026-11-18, count as no money here) and asks «так и задумано или ошибка?» before passing 100;
  `budget_usd` in the envelope may lower the line, never raise it above 100 without the operator's words. Once a kind of
  task has delivered, its line becomes twice its successful price.
- **Emergency stops still bind:** the estate total of USD 1000 a month, each key's own ceiling, and the CEO's own model
  key at USD 100 a month by default.
- **Floors the CEO never settles** (board-and-ceo.md §11.3): money above a limit, a deletion that cannot be recovered,
  publication, a production deploy to real users, sending to people outside the estate, a reversal of the operator's
  decision. They go to the operator as questions.
- **Model floor:** the CEO on Sonnet 5.5 or better (stage 1); delegated sessions use their project's own models.

---

## 11. The agent surface

Following compact-mcp (R33 O15): the CEO's operations are served behind two doors on the CEO console's server,
`ceo.search` and `ceo.execute`, plus `fabric.job.get` and `fabric.job.cancel` for long operations. `search` lists the
operations with purpose, input schema, gate and an example, filtered by words; `execute` runs one by name with the same
gate, idempotency (`key`) and audit (`reason`, required for every effect). Stage 1's `fabric_ceo_*` names stay callable
for one release and leave the listing (`patterns/compact-mcp/PATTERN.md:82-90`).

| Operation | Effect | Gate |
|---|---|---|
| `sessions.list`, `session.read`, `session.input`, `session.start` (with `key`), `session.stop`, `session.resume`, `session.open`, `projects.list` | stage 1's | stage 1's |
| `tasks.list {state?, computer?}`, `task.get {task}` | read | none |
| `task.delegate {task, project, want}` | files a board request to a project | none |
| `task.question {task, text, options, recommended}` | `fabric_question_ask` for the operator, or `fabric-ceo-question/1` up for a child | none |
| `task.result {task, outcome, summary, receipts}` | `com.reply` and `com.complete` | none |
| `remote.submit`, `remote.get`, `remote.events`, `remote.answer`, `remote.cancel` | the peer link (§6) | a T2 target drops `operator` |
| `computers.list` | the directory with link states | none |
| `peer.pair {target}`, `peer.unpair {target}` | §6.3 | `relayed`: the operator's words in `_meta.decision` |
| `intake.submit {organization, want}` | the T2 intake (§8) | `relayed` |

The popup's acts call these operations (§9.3). The CEO brief is rewritten to name the two doors and the rules of §7 and
§10.

---

## 12. (h) Logging and observability

### 12.1 The journal: what happened to the estate

| Event type | Payload (ids and states only) |
|---|---|
| `ceo.task.received@1` | task, trace, channel, origin computer, hops, priority |
| `ceo.task.delegated@1` | task, child task, to (`project:<id>` or `computer:<name>`), transport |
| `ceo.task.settled@1` | task, outcome, receipts count, spent_usd |
| `peer.link.changed@1` | computer, state (`connected`, `asleep`, `unreachable`, `unpaired`), transport |

Each gets its `event_types` row and an `event.<type>` sentence in `i18n/en.ts` and `ru.ts` (the CLAUDE.md rule). A task's
text lives on its board thread; the CEO's private conversation keeps ADR-0075's opaque receipts.

### 12.2 The ops log: what the program did

One record per inbound request (`ceo.inbound`), peer call (`peer.call`: computer, op, transport, ms, outcome, code),
pairing (`peer.pair`), delegation (`ceo.delegate`), refusal (`ceo.loop-refused`, `decision-dropped-t2`) and wake
(`ceo.ensure`). Every record carries `trace` as its correlation id, so one task reads across computers by searching each
computer's log for one id. No message text, no credential, no path of another organization; `opsLog.ts`'s redaction
applies. The hourly and daily digests (ADR-0188) count them by operation and outcome with no extra code.

### 12.3 Health

`agent-health/1` checks: `ceo.console` (running or on-demand), `ceo.slot` (the `ceo.task` responder active or a wake in
progress), `ceo.inbound.stale` (a `ceo.task` request queued over 10 minutes), `peer.<computer>` (a successful call within
10 minutes while a child is open), `peer.outbox` (an op waiting over an hour). A failing check sends one Telegram message
per episode through the communicator (episode key `<cause>@<UTC day>`, the alert-episodes pattern).

---

## 13. Security: threats and answers

| Threat | Answer |
|---|---|
| Someone else writes to the bot | the relay checks the owner and device (`relay.js:65`); unbound users get a refusal that leaks nothing (`telegram-surface.md:77-97`) |
| A Telegram message replayed | `update_id` and `commandId` dedupe; `ceo-ask:<commandId>` on the board |
| A stolen peer credential | useless without that computer's forced-command ssh key (§6.4); revocable in Agent access |
| A stolen peer ssh key | `restrict`, six operations, rate limits; useless without the credential |
| A tunnel posing as loopback | the peer door names its principal from the binding's record, T1 or T2, never T0 |
| A CEO loop or fan-out | hops at most 2, the path, 30 submits an hour per binding, the dispatcher's fan-out rule (12 threads in a clock hour wakes nobody, on-demand §3.8) |
| An organization's request carrying «the operator said» | T2: `operator` dropped and logged |
| Prompt injection in a request | the brief and the packet mark every request as data; only `operator` from T0 or T1 is a decision; the floors (§10.3) hold whatever the text says |
| A secret pasted into Telegram | the CEO brief forbids repeating it; the board's and the ops log's redaction apply; the CEO asks for a rotation through Observatory |
| Personal data reaching an organization | CO-422 D-4 to D-6; the scope gate at the sender and at the door |

---

## 14. (i) Resilience

### 14.1 Failure and degraded modes

| Mode | Behaviour |
|---|---|
| Fabric killed while a delegation is in flight | The child lives on its computer. The parent's outbox and directory are files; on restart the peer client resumes polling from its cursor; a parent request claimed by the dead CEO lapses its lease (60 s) and is claimed again under a new attempt; an effect begun is `outcome_unknown` until the CEO observes and reconciles. |
| The parent computer sleeps | The child works and posts on its own thread; the parent reads it on wake (pull). |
| The child computer sleeps | Over ssh: `unreachable`, the outbox, backoff; over the relay: stored and forwarded. The task says «ждёт Студию». |
| The network drops mid-call | The op's key makes the retry safe; a submit that may have landed is sent again with the same key and gets the first receipt. |
| Switchboard down | The peer link does not need it (plain ssh); CEO-on-demand and project dispatch do: their refusal is said once on the task, and the console path (§4.4 step 1) still works. |
| A model 429 or usage limit | Stage 1's set-aside and fallback runner; the CEO's open requests keep their claims, renewed by Fabric's code rather than the model, so a runner switch loses nothing. |
| The relay or the communicator down | Fabric's own paths (popup, voice, PM board requests) work; Telegram is silent and `communicator_status` says so; the popup's head shows «Telegram: нет связи». |
| The board's stack lost | `stack-unavailable` 503 on every board call; senders retry with the same keys; the runtime watch heals the stack (the AGENTS.md lifecycle table). |
| A peer's key changes | ssh refuses (host key) or the binding fails `unauthenticated`: the link becomes `unpaired`, never silently paired again. |

### 14.2 The test plan

Each test runs on a disposable stack (`scripts/test-stack.mjs`) and two data folders (two Fabrics on one computer, the
second as the "remote" over `ssh localhost` with its own forced-command line), never the operator's installed Fabric.

| # | Inject | Expect | Check |
|---|---|---|---|
| R-1 | kill the parent Fabric's main process after `remote.submit`, restart it | one child request on the remote board; polling resumes from the cursor; the result reaches the parent thread once | child requests = 1; result messages on the parent thread = 1 |
| R-2 | kill the CEO console while it holds a `ceo.task` | the lease lapses; a new attempt claims it; no second effect | `com.claim` attempts = 2; `effect_begin` count = 1 |
| R-3 | block ssh for 5 minutes during `ceo.events` | link `unreachable`, the outbox, recovery without duplicates | `peer.link.changed@1` unreachable then connected; no duplicate messages |
| R-4 | answer a submit, then drop the connection before the answer reaches the caller | the retry with the same key gets the same receipt | one request on the remote board |
| R-5 | deliver the same Telegram command twice (two polls) | one board request | `ceo-ask:<commandId>` deduped |
| R-6 | stop Switchboard | the peer link still works; the CEO-on-demand refusal is said once | ops record `ceo.ensure` failed with its code; the popup line |
| R-7 | make the CEO's runner print a usage limit | stage 1's fallback to Hermes; the claimed request keeps its claim | request state unchanged; the head's runner = hermes |
| R-8 | a child delegates back to its parent | refused `ceo-loop` | the refusal on the parent's thread |
| R-9 | an organization peer sends `operator` | dropped and logged | `decision-dropped-t2` in the ops log; nothing acted on as a decision |
| R-10 | cancel the root while a child works | the child stops its sessions and reports `cancelled` | the child's result outcome `cancelled`; its sessions stopped with that reason |
| R-11 | freeze the remote side's process (SIGSTOP) for 15 minutes | `unreachable`, then recovery; no task failed before its deadline | task state `waiting: computer`, then `working` |

Each fault is watched failing on code that has the defect before the fix makes it pass (the repository's TDD rule: a
planted defect is watched being caught).

---

## 15. Iterations

### 15.1 v1, the draft

- Telegram, then the communicator, then typed straight into the CEO console, like the popup's composer.
- A remote CEO through `switchboard dispatch --target` with the message as its packet.
- CEO to CEO through one shared board on a cloud Supabase stack both computers point at.
- Organizations through the same shared board, separated by the business wall.

### 15.2 Review 1: security and data

- Typing into a console has no id, no provenance and no dedupe: a repeated poll types twice, and the operator's words
  cannot be told from text a web page put in the console. Fixed by I-1: everything is a board request.
- A shared cloud board puts every estate's journal and the service-role key on every computer, gives two dispatchers one
  board (CO-567 open) and breaks CO-422's D-5 and D-6. Rejected (§6.1).
- Dispatch carries a packet, not a conversation: no questions back except `blocked`, no cancel into the reasoning. Kept
  only for project work.
- Organizations on a shared board are one bug away from a leak. Fixed by I-2 and §8: separate boards and a T2 intake.

### 15.3 v2

- Every channel files `ceo.task` on the CEO's board.
- The peer link: `ssh -L` to the remote hub's port with a binding credential, calling `com.*` directly.
- Organizations use the same link behind the business wall.

### 15.4 Review 2: operations and resilience

- `ssh -L` needs the remote port (it differs per OS user), leaves a local port any process can use, and makes the call
  look like loopback T0 to the remote hub while DL-25 says it is T2 unless proven. Fixed by a forced-command door that
  names the peer from its key (§6.2), with the principal from the binding.
- The child posting into the parent's board fails while the parent sleeps. Fixed by pull only (I-3).
- The communicator has one device; with the MacBook asleep nothing reaches any CEO from Telegram. Fixed by a
  communicator device per computer and the 2-minute rule (§4.2); said until built.
- Two CEOs would both ask the operator, and nothing stops a CEO delegating back. Fixed by I-8 and I-9.
- The bridge session spends a Claude session per Telegram order. Fixed by CO-568's `board.submit` (a W2 dependency).
- A model-driven poller spends tokens every minute. Fixed: the peer client is code, and the model is woken only on a
  question, a result or a refusal.

### 15.5 v3, this document

v2 with the forced-command door, pull-only status, the relay as the first transport once deployed, hops and path,
root-only contact with the operator, a communicator device per computer, CO-568 for direct filing, and two doors for the
surface.

### 15.6 Review 3: UX and cost

- Telegram flooded by progress: only results, questions and `waiting` notes are forwarded, at most one progress note an
  hour per task (§4.1).
- The operator cannot see where a task is: «Поручения» shows the computer and the state in words (§9.1).
- Cost: polling is ssh plus a database read, no model; a CEO model turn per state change only; the voice call keeps its
  per-minute price in the head (stage 1).
- An organization's administrator cannot tell why a request came: the intake names the asking organization and what is
  wanted, never more (§8).
- Remaining: the communicator's devices are another product's work and the riskiest dependency (14 of its last 20
  commands failed on 2026-11-18); the plan files it first.

---

## 16. Acceptance scenarios

| # | Scenario | Concrete check |
|---|---|---|
| A-1 | The operator writes «CEO, проверь, почему упали тесты в fabric» in Telegram | one `ceo.task` request on the MacBook's board within 10 s of the poll, key `ceo-ask:<commandId>`; `ceo.task.received@1` with channel `telegram`; the answer in Telegram with at least one receipt link |
| A-2 | The same command polled twice | one request (R-5) |
| A-3 | The CEO needs a choice | a «Нужны вы» item with options; buttons in Telegram; the answer's words verbatim on the task's thread |
| A-4 | A photo sent with the order | `attachments[0].path` exists on the computer with the same sha256; the CEO's first read opens it |
| A-5 | Fabric quit, the board's service up | a CEO-on-demand run takes the request within `GRACE_MS` plus 1 minute and posts its result |
| A-6 | The MacBook asleep, an unpinned order | the Studio's device takes it after 2 minutes; the MacBook's copy withdrawn; one Telegram line saying so |
| A-7 | «на студии: ...» | the Studio's board receives it; the MacBook's board receives nothing |
| A-8 | The MacBook's CEO delegates to the Studio's CEO | one child request on the Studio's board with `hops: 1` and `path: [macbook-pro]`; progress mirrored on the parent's thread within 60 s; the result folded into the parent's |
| A-9 | Cancel the root | R-10 |
| A-10 | A delegation back to the parent | R-8 |
| A-11 | An organization intake carrying `operator` | R-9; the organization's CEO's report goes to its PM agent's `people.ask`, and the operator's communicator gets nothing |
| A-12 | A peer key or credential missing | `unauthenticated`; the link `unpaired`; nothing filed |
| A-13 | Every popup act | the same operation appears in `ceo.search` and does the same through `ceo.execute` (a parity test over the operation list) |
| A-14 | Logs | searching for one `trace` finds the task's records on both computers; no record holds the task's text or a credential (a test plants a marker string in the text and asserts it is absent from the ops log and the journal payloads) |
| A-15 | Copy | every new string passes the copy checker's `check`; `grep -n "$(printf '\342\200\224')"` over the changed files prints nothing |
| A-16 | The run line | a task whose money spend would pass USD 100 asks «так и задумано или ошибка?» before the call that passes it |

---

## 17. Dependencies

| Needed | Owner | State | Blocks |
|---|---|---|---|
| Stage 1 landed (ADR-0197) | Fabric, branch `feat/ceo-agent` | uncommitted on 2026-11-18 | everything |
| CO-568 `board.submit` for services | Fabric | ADR by 2026-11-21, build after 0.3.23 | direct filing by the communicator, and the peer door |
| `ceo.ask`, a device per computer, thread forwarding | the communicator's repository | not started; BL-1506 to BL-1510 related | §4 from Telegram |
| A Fabric (the board's service) in the Studio's operator space | the host agent, Fabric | not present | a CEO on the Studio |
| ADR-0195 W2 to W4 | Fabric | W2c.1a on `main` | a CEO surviving a Fabric restart |
| CO-422 contexts | Fabric | designed 2026-11-17, C0 and C1 due 2026-11-24 | §8's per-context CEO |
| CO-552 and CO-513, an organization's own board on the Studio | Fabric, the host agent | open | §8's organization CEOs |
| RLY-05 and CO-453, the relay and its client | relay, Fabric | due 2026-11-20 / open | the relay transport |
| Task `853dae71`, questions from remote runs | Fabric | in review, branch `feat/remote-question` | questions from a dispatched project run |

## 18. Not decided here

A phone call into the CEO from Telegram, a CEO directory published by the organization's hub instead of pairing
(CO-552's job), billing between organizations for intake work, and the PassionCode cloud hosting a CEO for a person
without an always-on computer.
