# On-demand sessions: a board request nobody answers starts a session that does it, reports and ends

Status: specification, 2026-11-04. Rows CO-409 (the wake), CO-494 (a responder without asking), CO-496 (usage counts by
default, rewritten below). Implementation runs in waves across the PassionCode products (section 9); the coordinator,
fabric-workspace, keeps the plan and the version matrix.

The operator asked for it on 2026-11-04 in this repository's session `5d9bed98` (verbatim, speech-to-text kept):
«Если есть агент, который подключен к проекту и ловит задачу, типа он ее обрабатывает, а если такого агента нет и никто
задачу не поднял, значит должна бы инициироваться новая сессия, у которого у нас настроена дефолтная агентка со всеми
permission'ами, типа включенными по дефолту, вот в этой версии. на вход ей туда вся информация типа в сессию. Она все это
делает, заканчивает, отчитывается о завершении и выключается. Таким образом, нам не нужно держать открытые сессии во всех
агентах, и по необходимости они открываются и закрываются. … и Windows, и Mac корректно … логи добавляем … аналитику
для корректной оценки, отслеживания … И аналитику делаем по дефолту.» Relayed to every PassionCode project the same hour
(board thread `b2e5df1f`, announcement `42a41db8`; direct messages to the coordinator and seven product sessions).

Two more words of the same morning shape it, both relayed by fabric-workspace: «дай гранты всеем и передай фабрику чтобы
давай и не лочил по дороге, всем апрув» (traffic-growth-agent's session `1d031d27`, about 09:50 UTC: `board.respond` for
every project on its capabilities, with no consent stop on the way), and «Ройка должна быть очевидна и настраиваема, чтобы
пользователи понимали, как ее настроить … в фабрике, в виде UI … без разрешения, разрешить все, или без журнала
разрешения, чтобы мы все видели, какие разрешения, данные активные» (fabric-workspace's session `74a9440a`, about 10:00
UTC: one screen in Fabric that shows and switches the agents' permissions and keeps their journal).

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
   project's folder, with the machine's default permissions, the whole request and its context as its first input. It does
   the work, reports in the request's thread, completes the request and ends.
4. One request starts at most one session at a time; a session that ends without completing hands the request back to
   the queue, and a second failure closes it as `failed_known` with the reason, shown to the operator.

Decisions taken here (the operator's latest word wins over earlier rows):

- On by default, with an off switch in Settings.
- **Responders without a consent stop** (CO-494, by «всем апрув»): every project of the operator gets `board.respond` on its
  declared capabilities, and a session of that project on the operator's own machine takes the slot when it enrolls; no
  agent waits for a click. The grant is recorded as the operator's act with his words as the reason, and it is revocable
  per project on the permissions screen (§6.1).
- The default agent is Switchboard's machine default, Claude Code when none is set.
- Permissions follow `agentPermissions`; in this version a started session runs with «all on», as the operator asked. The
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

The hub's dispatcher runs on every `comms` journal event of kind `request` and on the cycle (60 s, `TICK_MS`), so a
request filed while Fabric was closed is found at the next start. A request is a candidate when it is `queued`, has no
live responder, is not past its deadline and has no dispatch in flight. Grace G is 2 minutes from submission (a live
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
| The switch «Запускать агентов по запросам доски» (Settings) | on | `skipped-off` |
| P has a folder on this machine | required | `skipped-no-folder` (the request stays queued; another machine may take it) |
| At most N on-demand sessions running on this machine | N = 2 | `deferred-cap` (tried again on the next cycle) |
| At most 1 per project | 1 | `deferred-project-busy` |
| At most D dispatches per project per day | D = 20 | `skipped-daily-cap` |
| Switchboard answers and has a default agent with room | required | `deferred-no-agent` |

Each dispatch has an id; dispatching the same request again with a run in flight is refused (idempotent by request id).

### 3.4 The packet

The dispatcher writes an Observatory workflow for the request (`observatory_checkpoint_write`, owner `service:fabric`):
`goal` is the request's text; `constraints` carry the exit contract (answer in the thread, complete the request, write the
final checkpoint, end), the floors of §2 and the operator's mandate when the request carries one (CO-495); `artifacts`
carry the thread id, request id, capability, target project, deadline and the last messages of the thread (at most 20,
each at most 4 KB); `open` names the one step. The packet holds no secret: keys are reached by name through
`use_secret.py run` inside the session. The workflow id is the dispatch's handle across products.

Agreed with Project Observatory on 2026-11-04 (OBS-323), so it reads the packet without guessing and without a change to
memory/0.1: `artifacts` carry one each of `kind: "other"` with `ref` `board-request:<uuid>`, `board-thread:<uuid>`,
`capability:<name>`, `fabric-project:<uuid>` and `deadline:<ISO 8601 UTC>`, and the project's folder as `kind: "file"`
with `path`; a packet without the request, the project or the deadline gets no keys. The keys a request needs are named
in the body's `credentials` block (`[{project, env, name, purpose}]`, names only); Observatory gives only those, only to
the holder of the workflow's lease, only for the project `fabric-project` resolves to, and only until the deadline;
without `credentials` it gives none. The run's last checkpoint closes the workflow: `status: done` for `completed`,
`status: failed` for `failed_known`, with `done[]` and `notes` and no values.

### 3.5 The start

Fabric asks Switchboard to start the session: `switchboard dispatch --dir <P's folder> --workflow <wf> --reason request`
(new, wave 1; it reuses `continue`'s account choice, isolation, ceilings and console hand-over). The session runs
non-interactively (`claude -p` with the packet as its prompt and the exit contract as an appended system prompt;
`codex exec` for Codex), in the account's isolated home, in the group the folder belongs to. With «Open hand-overs in
Fabric» on, the run is visible in Fabric's console; otherwise it runs without a window and writes its log under
Switchboard's sessions history. A paid fallback agent obeys the machine's and the group's spending ceilings.
The run knows it was started on a request by the environment variable `FABRIC_DISPATCH_WORKFLOW=<wf>` and by the first
line of its prompt; `working-with-fabric` (FAA-201) then skips its usual preamble, follows the exit contract, and on an
error it cannot get past completes the request `failed_known` with the reason.

### 3.6 Watching and ending

The dispatcher follows the request (`com.get`) and the run (Switchboard `sessions --launch-id`):

- request `completed` or `failed_known`: the dispatch ends `finished`;
- the run ended and the request is still `queued`, `claimed` or `accepted`: the dispatch ends `exited-without-answer`,
  the request returns to the queue, and the next cycle may dispatch once more; after two such runs the hub answers the
  thread with the reason and closes the request `failed_known`, and the operator sees it in «На проверке»;
- `in_progress` when the run ended: `outcome_unknown` stays as the contract defines it, only a reconcile settles it;
- a run past the time limit (60 min by default, the request's deadline when earlier) is stopped through Switchboard and
  ends `timed-out`.

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
- The run has the machine's default permissions; money, deletion and publication still go through
  `fabric_effect_request`, sign-ins, typed secrets and payments stay with the person.
- No secret in the packet, the journal, the counts or the logs; keys by name.
- The operator's switch stops new dispatches at once; runs in flight finish or reach their time limit.

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
ADR-0127; a new ADR records it in the change that builds it, with the notice text through Copylot.

## 9. Waves

| Wave | Fabric | The other products |
|---|---|---|
| 1 | grants without a stop (CO-494); the dispatcher behind the switch (off until wave 2's verification), the packet, journal events; tests with a fake Switchboard | `switchboard dispatch`; the contract's packet and lifecycle; the adapter's skill section; Observatory's `service:fabric` workflow owner |
| 2 | the switch on by default; usage counts by default (CO-496); the permissions screen (§6.1); the chain run on macOS and on Windows | the same switch and counts in every product; releases on both platforms |
| 3 | three-iteration verification of the chain and fixes; release | releases; fabric-workspace's version matrix shows every product current on both platforms |

## 10. Checks that prove it

- A request filed to a project with no session is answered by a started session within the grace plus the run, and the
  session's process is gone afterwards (macOS and Windows).
- With the switch off, nothing starts and `skipped-off` is recorded.
- Caps hold under ten simultaneous requests.
- A run killed mid-way returns the request to the queue; a second one closes it `failed_known` with a thread answer.
- No packet, event, count or log line contains a secret or the request's text where §7 says it must not.
