# The people-ask bridge: «Нужны вы» decided from Telegram through the organization's PM agent

**Status:** built 2026-11-16 (Fabric's side). The PM agents' side (Kira K-34, Ania) is theirs to build against §2.

**Source:** the operator, 2026-11-16, Fabric session 5273c136: Fabric is to be joined with each organization's PM agent
(Kira for PassionCode.ai, another organization's own PM agent, the personal communicator for his own boards) so that whatever needs a
decision reaches the people who may decide it in Telegram, as buttons, a text reply or a voice reply, and is decided
without the computer, «если именно это мои доски. То есть вопросы должны решать люди, у которых есть доступ к решению
этих вопросов».

**Task:** Fabric `11ebbf83-877d-41e8-92e4-bd5c8075d7c5`. **Contract thread:** board thread `bf635f68`, the PM agents'
answers `2125020e` and `844acee1` (Kira), the contract as posted `ef9a5032`.

**Code:** `apps/desktop/src/shared/peopleAsk.ts` (the contract, routing, authority; pure),
`apps/desktop/src/main/peopleAskRun.ts` (the pass and the doors), wired in `apps/desktop/src/main/index.ts`
(region `people-ask-wiring`). Tests: `apps/desktop/src/shared/peopleAsk.test.ts` (vitest),
`apps/desktop/test/people-ask-run.test.mjs` (node:test, fakes of the board door and the window's doors).

## 1. What exists

- «Нужны вы» on Главная is the board's person-only reading (`board.query` with `personOnly`, `main/boardReads.ts`):
  questions with options, agent access requests, refused acts (one-time permissions on the money, deletion and
  publication floors), reviews past due, and proposals (a hand-off that reached its loop bound). Each card is decided
  in place (`renderer/src/launch/HomeParts.tsx#NeedsYouCard`).
- The card's buttons call five main-process doors: `questions.answer` (`IPC.questionAnswer`), `tasks.decide`
  (`IPC.tasksDecide`), `proposals.decide` (`IPC.proposalDecide`), `attention.grant` (`IPC.attentionGrant`) and
  `hub.decide` (`IPC.hubDecide`, which calls `AccessService.decide`). Main-process callers reach the same handlers by
  channel through `callDoor` (`main/index.ts#callDoor`), as the manager agent does (`main/managerPort.ts`).
- The operator's board door (`AgentSurface#operatorBoard`) submits, replies and, since this change, cancels as any
  Project; the operator's read door (`main/commsOperatorRead.ts`) reads threads and responder slots.
- The two organizations' PM agents each hold a `people.ask` responder slot with a live service; both already send inline buttons, take a
  reply to their own question, and turn voice into text (their answers on the thread).

## 2. The contract: fabric-people-ask/1

**The request (Fabric to the PM Project).** `com.submit`, kind `request`, capability `people.ask`, one request per
«Нужны вы» item and revision, idempotency key `people-ask:<item>:<revision>`. It is sent **as the item's own Project**
into a new thread with the PM Project, subject «Нужны вы: <text>». The body is Russian text for the person, then one
fenced `json` block:

```json
{"schema":"fabric-people-ask/1","item":"question:<uuid>","revision":1,"kind":"question","project":{"id":"<uuid>","name":"fabric"},
 "text":"<one line>","detail":"<context or null>","options":[{"id":"<id>","label":"<button>","consequence":"<or null>"}],
 "recommended":"<id or null>","freeText":true,"mayDecide":{"level":"architect","project":"fabric"},"deadline":"<ISO>"}
```

| Kind | Item | Options | Free text | May decide | Deadline |
|---|---|---|---|---|---|
| `question` | `question:<question id>`, revision = the question's | its own, the recommended first; «Отдать агенту» (`fabric-delegate`) on an agent's question | yes | architect | a week |
| `access` | `access:<request id>` | `allow` (only where Fabric may allow on relayed words), `deny` | no | administrator | the request's own expiry; not asked when under 2 minutes are left |
| `effect` | `effect:<refusal seq>` | `allow` (once, an hour) | no | administrator | a week |
| `review` | `review:<task id>` | `accept`, `return`, `cancel` | yes (a return with those words) | architect | a week |
| `proposal` | `proposal:<proposal id>` | `accept` (make it a task), `decline` (end the chain) | no | architect | a week |

The sweep's own findings (an overlap of two sessions) stay on the computer: they are not in the contract.

**The answer (PM to Fabric).** `com.reply` on that request: text, then a block

```json
{"schema":"fabric-people-answer/1","item":"question:<uuid>","revision":1,"option":"<id or null>","text":"<or null>",
 "words":"<the person's words verbatim>","voice":false,"decider":{"key":"<role key or null>","telegramUserId":123,"level":"administrator"},"at":"<ISO>"}
```

At least one of `option` and `text`; `words` always (a voice answer's transcription, `voice: true`); `decider` names the
person by a role key (Kira's choice), a Telegram user id (the other PM agent's), or both, with the level the PM agent checked. The last block of the
reply with this schema is read (`shared/peopleAsk.ts#parseAnswer`).

**Fabric's result.** A reply to the PM's answer, as the request's sender, idempotency key `people-ask-result:<answer
message id>`. Its first line is exactly `решено` or `не применено: <причина>`, then a block
`{"schema":"fabric-people-result/1","item","revision","applied","reason"}` (`resultText`).

**Withdrawal.** `com.cancel` by the sender Project, key `people-ask-cancel:<request id>`, reason «решено в другом месте»
(the item left «Нужны вы»), «пункт изменился, вопрос задан заново» (a new revision, which is asked as a new request), or
«присылать вопросы в Telegram выключено» (the switch). The PM agent removes its buttons.

## 3. Routing

A Project goes to its organization's PM Project by its recorded `business` (compared without case or surrounding
spaces); a Project with no business goes by the owner of its primary repository's `origin` (as the dispatcher reads it,
`shared/boardDispatch.ts#remoteOwnerOf`). A business no route names goes nowhere, whatever its owner: the person recorded
where it belongs. An access request, which belongs to no Project, goes by the Project it names (an enrollment's or a
responder ask's project name).

The routes are a file on the machine, `userData/people-ask-routes.json` (a list of
`{organization, target, businesses, owners}`, or `{routes: [...]}`; read each pass), because they name organizations
and repository owners that are private and never enter this public repository (ADR-0096, CO-520; the private-data gate
refused them). Without the file, the routes this repository may name apply (`DEFAULT_PEOPLE_ROUTES`: PassionCode.ai to
`passioncode-pm-agent`, `d6e9657c-6332-87fa-9585-6fe913352680`, by business `passioncode.ai` or owner `passioncode-ai`).

A Project no route names goes to **the one Project that holds a live `people.ask` responder** with the same recorded
business or, when neither records one, the same repository owner (`autoRouteOf`). None, or two, is no route: a question
never goes to a guess. So an organization's PM agent whose repository has the organization's owner is found without any
route, and the routes file is needed only where one organization spans several owners or records a business.

Measured 2026-11-16 on the operator's stack: 123 of 124 Projects record no business; of the primary repositories with an
`origin`, 23 are owned by passioncode-ai, 47 by the operator's own account and 20 by owners of other organizations
(`select business, count(*) from projects`; `git remote get-url origin` over the primary `project_repos`). So routing by
owner carries the estate today. The operator's private routes are written into his machine's routes file, not here.

A request is sent only while the PM Project holds `people.ask` with an active, unheld, unexpired responder (the board's
`board_responders_operator`, read once a pass). The personal communicator does not hold it yet (board request `25d7f0e8`
asks it to), so the operator's personal boards are not sent until it does; the skip is logged, not repeated every pass. An
item of the PM Project itself is not sent (a request to oneself).

## 4. The pass

Its own interval beside the dispatcher, every 45 s (`PEOPLE_ASK_WATCH_MS`), one pass at a time, ended at quit. A pass:

1. **Reads «Нужны вы»** as Главная does (`board.query`, person-only, up to 500). The reading is *complete* only when every
   source answered and nothing was cut. A failed or partial reading cancels nothing and applies nothing it cannot
   confirm open.
2. **Reads the answers** in the threads of open requests, and of requests closed in the last two hours (so a late answer
   is told it decides nothing), at most 100 threads, five pages each, through the operator's read door. An answer is a
   `reply` to the request from the PM Project; a reply from any other Project is ignored. Each answer is judged once
   (`judgeAnswer`): the item still open at the request's revision, the answer about this item and revision, its option
   one of the item's, free text only where the item takes it, the decider's level at least `mayDecide.level`
   (owner > administrator > architect > member). An accepted answer is applied (§5), then the result is posted. A
   result that could not be posted is posted on a later pass with the same key; the decision is never made again.
3. **Withdraws** an open request whose item left a complete reading, changed revision, or whose switch is off; a request
   the board already expired or cancelled is closed without a cancel.
4. **Asks** each item no request covers at its revision: routed (§3), the PM's responder live, then submitted. At most 10
   new requests a pass. A refused submit is kept and tried again after an hour. What was not asked is counted by reason
   and logged once each time the count changes (`people.ask.skipped`).

What was asked and decided is kept in `userData/people-asks.json` (0600, written whole and renamed, as
`board-dispatches.json`): each request with its item, revision, sender, target, the block sent, the act behind it, its
state (`unsent`, `open`, `applied`, `cancelled`, `closed`), the answers judged with the result said, and the decision
applied with the person's words. A closed record is kept a month, at most 2000 records. So a restart never asks twice and
never decides twice.

The switch: Settings, «Запуск агентов», «Присылать вопросы в Telegram через агента организации» (`peopleAsk`, on by
default). Off, nothing new is sent and what is open is withdrawn; answers already in flight are still read and told.
As the dispatcher, the bridge runs only on the machine that owns its board, or where `dispatchOnSharedBoard` is set, so two
machines on one board never both ask.

## 5. Authority and how a decision is applied

The decision goes through the **same door** the card's button calls (`createPeopleApply`, wired to `callDoor`), so it
lands in the journal exactly as the person's own press:

| Kind | Door | What carries the person's words |
|---|---|---|
| question | `IPC.questionAnswer` with a command id derived from the answer message (a retry is the same command) | the answer text is the words verbatim; the chosen option as `chosenOption`; «Отдать агенту» answers the window's delegate text |
| review | `IPC.tasksDecide` | the comment: the words (a return and a cancel need them; free text is a return) |
| proposal | `IPC.proposalDecide` | the board thread (the door takes no words) |
| effect | `IPC.attentionGrant`, an hour | the board thread (the door takes no words) |
| access | `AccessService.decide`, the button's own service, after `relayedAccess.ts#admitAccessAct` | the event's `relayed` decision (CO-506) |

Every decision is built in fabric-agent-contract DEC-0121's shape (`decisionOf`): `by: operator`, `via:
relayed-instruction`, `action` (`people.<kind>`, or `access.allow` / `access.deny`), `target` the item, `instruction` the
words (cut to the schema's 500 characters), `at` the answer's time, `source` the PM Project and the thread. It is kept in
the state file with the decider (role key or Telegram id, level, voice) and the full words.

Authority is the PM agent's to check against its own registry before it shows buttons (both agents said they will), and
Fabric's to check again: the level the PM sent against the item's `mayDecide`. Fabric does not know the people; it trusts
the level only from the Project it asked, in the thread it opened. What no relayed words may do stays refused here too:
allowing a product's access (its consent and key are the person's, in Fabric's window), allowing outside Fabric's own
lanes, and any access decision on a computer marked as an organization's (`admitAccessAct`). Such an access request is
offered only «Отказать».

## 6. Failure handling

Every failure goes to the operations log and ends nothing else: `people.ask.read`, `people.ask.thread`,
`people.ask.responders`, `people.ask.project`, `people.ask.submitted`, `people.ask.applied`, `people.ask.result`,
`people.ask.cancelled`, `people.ask.save`, `people.ask.records-unread`, `people.ask.pass`, with item ids, kinds,
organizations and levels; never a person's words or Telegram id. A door that refuses (the question revised, the task no
longer in review) leaves the item open and says why in the thread; a later answer may still decide it.

## 7. What each PM agent builds

- **Read the request** (`parseAsk` is the reference): a card with the text, the detail, the options as buttons by
  option id (the recommended one marked), a free answer by text or voice where `freeText` is true, the deadline.
- **Show it only to people of at least `mayDecide.level`** for that project (each PM agent's own authority table;
  Kira's `authority.py` with PM-D55's addressee).
- **Answer with one `com.reply`** on the request carrying the `fabric-people-answer/1` block: the words verbatim (a voice
  answer transcribed, `voice: true`), the decider by role key and/or Telegram id, and the level.
- **Read Fabric's result** (the first line of its reply to your answer) and tell the person; on a `com.cancel` of the
  request, remove the buttons.
- **The personal communicator** takes `people.ask` like the others; until its slot is live, Fabric
  sends it nothing.

## 8. Not verified live

The bridge was proven against fakes of the board door and the window's doors (see Code above). It was not run end to end
against the installed Fabric: that needs a restart of the operator's running app, which this change did not do. The
first live pass happens when the installed Fabric is next updated and started.
