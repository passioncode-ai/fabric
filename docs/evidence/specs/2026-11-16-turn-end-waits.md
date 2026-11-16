# Turn ends and waits: an agent says what it waits for, Fabric checks it and goes on

**Status:** accepted · 2026-11-16 · task `e46b39dc` · the operator, 2026-11-16, this repository's session `5273c136`
(verbatim in the task's origin): an agent that ends its turn saying «the next step waits» stands still until a person
comes back; track the end on the board, check whether it really has to wait; when it can go on, start it again; when it
waits for time or an event, set a timer and check again; when it waits for a person, ask through the project's PM agent,
show the question in Fabric too, bring the answer back and continue, on any computer, local or remote. Builds on
[the on-demand spec §3.11](2026-11-04-on-demand-sessions.md#311-left-work-is-continued-the-board-supervisor) (the board
supervisor) and [the people-ask bridge](2026-11-16-people-ask-bridge.md); [ADR-0195](../../adr/0195-the-board-runs-apart-from-the-app-and-its-supervisor-continues-left-work.md)
keeps the roles: Fabric decides, Switchboard runs sessions, the lifecycle broker keeps processes.

## 1. What exists (read 2026-11-16 at `a62b7aa4`)

| Piece | Where | What it already does |
|---|---|---|
| Turn and end facts | `fabric_session_observe` (`main/workTools.ts`), the adapter's session hooks | each turn's counts (`session.turn.observed@1`), the session's end with its reason (`session.ended@1`); the turn's answer carries the sweep's nudges |
| A declared wait | `fabric_heartbeat {phase: waiting, waitingOn: {kind: question \| grant \| continuation, id}}` (`main/agentSurface.ts`) | recorded in `session_heartbeats`; read by liveness, never acted on |
| Release with a note | `fabric_work_release` → `work.released@1` (`main/workTools.ts`, projector in migration 95) | `done` to review; `let-go` and `handed-over` with a note the next agent reads; the payload may carry more fields than the projector writes |
| The supervisor | §3.11, `shared/boardResume.ts`, `main/boardResumeRead.ts` | a task left open 10 minutes, held by nobody, moved by no person, without an open question to a person, gets a run that continues it |
| A person's question | `fabric_question_ask` → «Нужны вы» → the people-ask bridge → the organization's PM agent in Telegram | answered by button, text or voice; the answer is applied with the person's words |
| Runs on another machine | the dispatcher's `dispatchTargets` and the run's result file (§3.7 of the on-demand spec) | a run there answers `answered`, `failed` or `blocked`; Fabric posts an answer, nothing else |
| Sessions kept by Switchboard | `switchboard dispatch` (`--reason request \| inbox`, `resume` in SB-398), the duty officer, the session host, `monitor hold` (SB-399) | starts, watches, closes and restarts sessions |

What is missing: nothing turns «I am waiting» into a checked condition. The supervisor reads a release without knowing
what it waits for, so it either continues too early (the wait is real) or a task with an open question is never resumed
once it is answered elsewhere; an idle live session that holds a claim is never told it may go on; a run on another
machine cannot ask a person at all.

## 2. The rule

At the end of every turn an agent is in exactly one state, and says which:

| State | Means | How it is said | What Fabric does |
|---|---|---|---|
| **done** | the order is finished | `fabric_work_release {how: done}` | review; nothing waits |
| **going on** | more to do now, nothing blocks | no wait declared while a claim is held | the turn does not end: the session continues (§4.2), or the supervisor starts a run once the session is gone (§4.1) |
| **waiting** | one checkable thing blocks the next step | a `wait` (§3) on the release, or `fabric_heartbeat` waiting with `waitingOn` while the session stays | Fabric checks the condition and continues the work when it clears (§4) |

A wait names something Fabric can check. «Waiting» with nothing checkable is not a wait: the work goes on at once.

## 3. The wait

`fabric_work_release` takes `wait` beside `how: let-go | handed-over` (journalled in `work.released@1`'s payload and read
back by the supervisor; no new table):

```json
{ "kind": "time | question | grant | request | limit", "until": "<ISO, for time and limit>", "ref": "<id, for question, grant and request>", "why": "<one line for the next agent>" }
```

| Kind | Clears when | Checked from |
|---|---|---|
| `time` | `until` has passed (a CI run, a release, a scheduled check: the agent picks when to look again) | the clock |
| `question` | the question `ref` is answered or withdrawn | `questions` (a person answers in Fabric, or through the PM agent and the people-ask bridge) |
| `grant` | the access request `ref` is decided | the hub's access requests |
| `request` | the board request `ref` (sent to another project) is settled or answered | the board |
| `limit` | the usage limit resets at `until` | the clock (Switchboard's recovery resumes the same session itself) |

A wait whose `ref` cannot be read is checked again on the next pass; a task still waiting past the supervisor's week goes
to the operator like any left task. A `question` wait is also why the operator sees the question: it is in «Нужны вы»,
and the bridge sends it to the PM agent of the project's organization.

## 4. Continuing

### 4.1 After the session ended (any machine): the supervisor

A left task with a `wait` is a resume item only once its wait clears (`shared/boardResume.ts#waitCleared`); without a
wait it is one after the 10-minute grace, as in §3.11. An open question that the wait itself names does not hold the task
once answered. The run's packet names the wait and how it cleared, so the run starts from the answer. The run goes where
the project's runs go: this Mac, or the machine `dispatchTargets` names.

### 4.2 While the session is alive: the turn's verdict

`fabric_session_observe {event: turn}` answers a verdict beside its nudges: `continue` with a reason when the session
holds a live claim on an open task, declared no wait, and one of its last two turns changed something (files or lines), so
a loop that changes nothing stops; else `stop`. The adapter's Stop hook turns `continue` into Claude Code's
`{"decision": "block", "reason": …}`, so the agent goes on in the same session; it respects `stop_hook_active` and blocks
at most three times in a row. Codex and Kimi send no turns; for them §4.1 does the work.

### 4.3 A run on another machine

A run there has no board. Its result file may say `outcome=blocked` with a `wait=` header and, for a question, a JSON
block with the question and its options; Fabric files that question as the project's in «Нужны вы» (the bridge carries
it to the PM agent), records the task's wait as `question` with that id, and the supervisor starts the next run there
once it is answered.

### 4.4 A live session the duty officer must not close

A session holding a claim is marked `switchboard monitor hold --session <id> --until <claim's expiry> --reason
fabric_claim`, released with `--until 0` on release (SB-399, Fabric task `f53de384`).

## 5. Who does what

| Product | Its part | Board |
|---|---|---|
| Fabric | the `wait` on release, the supervisor's check, the turn verdict, questions from a remote run, the holds, «На проверке» rows | this repository |
| fabric-agent-adapter | the Stop hook acting on the verdict; `working-with-fabric`'s turn-end rule (one of the three states; a wait names a checkable thing) | request filed 2026-11-16 |
| fabric-switchboard | `--reason resume` (SB-398), `monitor hold` (SB-399), the result file's `wait=` header passed through | thread `179a88f6` |
| PM agents (Аня, Кира) and the personal communicator | `people.ask` in Telegram | thread `bf635f68`: Аня live (`c89f4ab`), Кира 2026-11-19, the communicator 2026-11-20 |

## 6. The plan, in waves (replanned 2026-11-16)

Each wave lands on `main` on its own, gates green; nothing that works is broken by it.

| Wave | What | Owner | Board |
|---|---|---|---|
| T0 | The wiki and data-room sync publishes again: the git step that times out every 2 hours named and bounded, its lock not left behind, the operator's notice under one event id per state | Fabric | finding `6f7d788c` |
| T1 | `wait` on release; the supervisor continues a left task only once its wait clears, at once when it names nothing checkable | Fabric | `e46b39dc` |
| T2 | The turn verdict in `fabric_session_observe` (`shared/turnVerdict.ts`, landed 2026-11-16) | Fabric | `8c5f66b5` |
| T3 | The Stop hook acts on the verdict; the skill's turn-end rule | fabric-agent-adapter | request filed with this spec |
| T4 | Holds for claim-holding sessions; `--reason resume` live | Fabric, Switchboard | `f53de384`, SB-398, SB-399 |
| T5 | A remote run's question reaches «Нужны вы» and its answer resumes the run there | Fabric, Switchboard | filed with this spec |
| T6 | «На проверке» shows a task the supervisor gave the operator (`task-to-operator`, landed 2026-11-16); a wait past its time is still open | Fabric | `a8993a15` |
| B1 to B4 | The board out of the window's process (ADR-0195 W1 to W4) | Fabric, Switchboard | `0647986c`, `8b86adf3`, `dbeb4fcd`, `4e0976c6` |
| P | The PM agents' and the communicator's `people.ask` | their projects | `bf635f68`, `e6154a6e` |
| Q | A question a person understands (§8), with this spec's first wave | Fabric | `e46b39dc` |
| U | The interface findings of wave 2 | Fabric | `6f61f88f`, `cc6ce338`, `b54734c6`, `96d4431c` |

Order: T1, Q and T0 with this spec, then T2, T6, T5, B1 to B4, U;
T3, T4 and P run in their projects in parallel. The main agent checks its status and the board every five minutes while
it works and takes the next wave when one lands.

## 7. Checks that prove it

T1: `src/shared/boardResume.test.ts` (each kind clears only on its condition; a wait without anything checkable is
none), `test/board-resume-read.test.mjs` (the wait read back from the release's event), `test/board-dispatch-run.test.mjs`
(a run's packet names the wait). T2: the verdict's unit tests (claim, wait, two empty turns). Every wave:
`bash scripts/ci.sh fast` exit 0 on the commit that lands.

## 8. A question a person understands

The operator, 2026-11-16, over a question in «Нужны вы» that named a slot generation, a capability, three commit hashes
and a ticket and ended «the answer is not required»: «вопросы должны быть понятны. Сейчас мне вообще не понятно, что вот
у меня тут спрашивают, что я должен отвечать». A question is for a person; what an agent needs to say besides goes to
`whyBlocked` and the options' consequences (`shared/questionClarity.ts`).

- **Asked.** `fabric_question_ask` refuses (`question-unclear`, with the issues and how to ask instead) a question whose
  text is longer than 240 characters, holds machine words (hashes and ids, ticket numbers, dotted or slashed names such
  as capabilities, tools and paths, code in backticks) or does not end with a question mark. The check runs after the
  idempotency read and the task checks, so a retry of a question already asked answers as before. The rule's last line:
  a question nothing needs a person for is not asked; the agent decides it by the project's decisions and goal.
- **Shown.** A question asked before the rule leads with its one readable question sentence; with none, the card says
  the agent's question is unclear and offers its whole text behind «Подробнее» (Главная and the Board's panel). The
  people-ask bridge sends the same line to Telegram, the agent's text in the detail.
- **Tests.** `src/shared/questionClarity.test.ts` (the operator's question word for word is refused for all three
  reasons and has no headline), `test/question-tools.test.mjs` (refused through the tool, nothing written; a plain
  question with the context in `whyBlocked` is asked).
