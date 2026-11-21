# Spec: the CEO answers what it can, the owner is asked only what needs him, publication on his order never waits

Date: 2026-11-21. Fabric session `8343a070`. Board task `a0afb015`. Decision record: [ADR-0207](../../adr/0207-the-ceo-triages-every-question-and-the-owner-is-signalled-only-in-his-own-channel.md).
Source state read: `origin/feat/voice-retro` at `33aec0f4` (the 0.3.27 candidate) and `origin/main` at `608f5416`.

## 1. The order

The owner, Telegram 2026-11-21 03:14, relayed on the board by the CEO (request `05c2f2bd`), verbatim:

> «Давай мы сделаем так, чтобы эти публикации вообще никогда не спрашивали и не тормозили на них. Очевидно, что там нет
> другого варианта, кроме как разрешить. Мы всегда должны спрашивать, нужно ли в конце, когда пришёл и он к вопросу.
> Давай добавим так, чтобы CEO фабрики анализировал все вопросы и принимал решение, нужно ли спрашивать или можно
> принять решение самому. И только по тем, которые нужно, мы их оставляем, и по ним уже они висят на доске и по ним
> сигнализируем. Только давай по ним будем сигнализировать в мой персональный коммуникатор. А PM-агентов оставим для
> работы с тасками из команды. Короче, чтобы мой фабричек не был связан с PM-ами.»

Restated as three requirements:

- **R1. Publication on the owner's order does not stop.** A `publication` act an agent asks for with
  `fabric_effect_request` goes ahead without the first refusal and without a person's click.
- **R2. Every question goes to the CEO first.** The CEO settles each question it can and leaves on the board only the
  ones that need the owner.
- **R3. The owner is signalled only in his own channel.** A question left for the owner is signalled through his
  personal communicator, never through an organization's PM agent. PM agents keep the team's tasks.
- **R4. A console waiting at a prompt is a question too.** The owner, 04:32, verbatim: «надо чтобы такие сессии вопросы
  либо мне присылали если не могут, либо сам агент фабрик отвечал». Case: session «SSHLG MacBook Agent» (`9e5e3edc`) sat on
  Claude Code's question menu (AskUserQuestion, «Enter to select», 3 of about 16) and the owner took it for hung. A console
  that waits for a choice or an answer goes to the CEO at once; the CEO answers it in the console, else the owner is
  asked in his communicator and the question hangs on the board; his answer goes back into the same console.

The order sits on two records that already exist:

- [ADR-0205](../../adr/0205-decisions-split-by-level-strategy-is-the-persons-tactics-the-agents.md) (on main) says who
  decides by level: strategy is the person's, tactics the agent's, a question goes only where the person knows better.
  R2 makes the CEO the one who applies that bar to every question.
- [ADR-0203](https://github.com/passioncode-ai/fabric/blob/feat/approval-modes/docs/adr/0203-the-owners-approval-mode-says-which-acts-wait-for-him.md)
  (branch `feat/approval-modes`, not on main yet) gives the floor the owner's approval mode and lets Fabric issue the
  one-shot grant itself. R1 is one more rule on that mechanism.

## 2. What is true today (evidence)

| Fact | Where |
|---|---|
| A floored act is refused the first time: no grant, no allow; the tool's text says so | `main/policy.ts#Policy.decide` (the «no grant was presented» branch), `main/effectTools.ts#registerEffectTools` |
| Before the grant check, containment refuses a runner whose permission mode leaves containment `none` | `shared/containment.ts#flooredEffectAllowed` |
| The person grants one act, one target, one hour, from «Нужны вы» («Разрешить один раз»); the agent is not woken and asks again | `renderer/src/ObligationActs.tsx#GrantAct`, `main/policy.ts#Policy.issueGrant` |
| The schema refuses a floored intent without a grant | ADR-0028; `effect_intents` check `floor_class IS NULL OR grant_id IS NOT NULL` |
| ADR-0203 lets the mode issue the grant as `approval-mode:<mode>`, ten minutes, the asker's project, act and target | `feat/approval-modes`: `main/effectTools.ts#MODE_GRANT_TTL_MS`, `shared/approvalMode.ts#approvalModeOf` |
| A question is `question.asked@1` into `questions`, retried by `commandId`, checked for clarity | `main/questionTools.ts#registerQuestionTools`, `main/questionClarity.ts#clarityIssues` |
| The database already takes an answer from a non-person with a cited basis | `answer_question(p_actor, p_basis)`, migration `20260906000035`, ADR-0036 |
| An answer reaches the waiting session by typing it in | `main/commandIngressAdapters.ts#commitPreparedAnswer`, `continuations.deliver` (`main/index.ts`, `deliverContinuation`) |
| A question raises no macOS notice; its only outward signal is the people-ask bridge | `main/index.ts` `decideNotification` reads `readAttentionWithSources` (access, refused, review, proposal, abandoned) |
| The people-ask bridge sends «Нужны вы» to the organization's PM agent, on by default | `main/peopleAskRun.ts#createPeopleAskBridge`, `shared/peopleAsk.ts#DEFAULT_PEOPLE_ROUTES`, `shared/types.ts` `peopleAsk` (default true), Settings «Присылать вопросы в Telegram через агента организации» |
| Every session is told a question «reaches the person in Fabric and through the organization's PM agent» | `shared/protocolObligations.ts` rule `turn-end-states` |
| A board run is told to send a person's question to the project offering `people.ask` (the PM agent) | `main/boardDispatchRun.ts#QUESTIONS_RULE` |
| The CEO has no tool to list or answer questions, and none to grant an act | `main/ceoTools.ts#CEO_TOOLS` |
| Fabric already types board requests into the CEO's console once a minute and wakes it | `main/index.ts` `ceoBoardTick`, `main/ceoBoardKeeper.ts` (ADR-0197 Amendment 5) |
| The app's main process never calls the personal communicator; only the workspace sync's script does, with a key limited to `failure` and `recovery` | `scripts/lib/communicator-notify.mjs#notifyCommunicator` (`KINDS`), vault slots `fabric/prod/COMMUNICATOR_NOTIFY_KEY`, `COMMUNICATOR_URL` |
| The main process can read a vault slot for one call | `main/observatoryVault.ts#createObservatoryVault`, used as `ceoVault.read(XAI_KEY_SLOT)` |

## 3. Design

### 3.1 R1: publication on the owner's order never waits

- **An owner rule beside the approval mode.** `settings.json` gets `ownerRules`, read like `approvalMode` (an unreadable value means no rule, never a looser one). Its first and default rule is `publication: "allow"`.
- **How the rule acts.** It uses ADR-0203's door. When a `publication` request has no grant and the rule is on, Fabric issues the one-shot grant itself, as the system actor `owner-rule:publication`, confined to the asking session's project, act and target, alive ten minutes. Then the policy decides as before.
- **What the rule keeps.** Containment still refuses a runner without containment: the rule gives a grant, not containment. The schema check stays.
- **The record.** The journal's `grant.issued@1` names the rule, and the behaviour journal of ADR-0203 records the act with «on whose word: the owner's rule of 2026-11-21».
- **Why always, not «only on his order».** Nothing in a request proves whose order it serves. The owner said «никогда не спрашивали … нет другого варианта, кроме как разрешить». So the rule allows every publication, and the journal makes each one visible afterwards.
- **What it does not cover.** Money and deletion still follow the approval mode. The human gates still wait in every case: a sign-in, a one-time code, a payment, a typed secret, a consent screen (ADR-0203 §4, `shared/approvalMode.ts#HUMAN_GATES`).
- **Dependency.** This needs ADR-0203's grant door on main. `feat/approval-modes` is in the 0.3.28 train (§5). Without it, R1 builds the same door itself.

### 3.2 R2: every question goes to the CEO first

- **Delivery to the CEO.**
  - A new question (`question.asked@1`) is held from the owner for a **triage window of 10 minutes**.
  - Within that window Fabric types it into the CEO's console once, on the same minute timer as `ceoBoardTick`, with a line built like `ceoBoardNudge`.
  - The line carries the question's id, the asking project, the text, the options and the asking task's goal.
  - A console that is not running is woken as for `ceo.task` (`ceoBoardKeeper.ts#wake`).
- **Two new CEO tools** on the `ceo-surface` region, registered only for the CEO's own session (`CEO_TOOLS`):
  - `fabric_ceo_question_settle {questionId, answer, basis}`.
    - It answers through `answer_question` with actor `{kind: 'agent', id: <CEO session>}` and `p_basis` set to the cited reason: a recorded decision (ADR, carry-over row, memory fact), the owner's relayed words with date and source, or «tactical, ADR-0205».
    - It then delivers the continuation like the person's answer (`commitPreparedAnswer`, `deliverContinuation`).
    - It refuses without a basis (ADR-0036: the CEO settles only what it can cite).
  - `fabric_ceo_question_escalate {questionId, why}`. It appends `question.escalated@1 {question_id, by, why}` (a new event type with its `event_types` row and feed sentence), which marks the question as needing the owner.
- **The CEO's bar** is ADR-0205, written into its brief (`shared/ceoAgent.ts#ceoBrief`):
  - strategy, money above a limit, access wider than the act needs, a decision recorded as the owner's: escalate;
  - tactics and anything the code, the documents or the owner's recorded decisions answer: settle, with the basis.
- **Fail-safe.** A question the CEO neither settled nor escalated within the window, or one asked while the CEO cannot run, counts as escalated by the system (`by: 'triage-timeout'`). Nothing is lost because the CEO is busy or down.
- **«Нужны вы».** It shows escalated questions only. A question still in triage shows nowhere for the person, and its asker sees «у CEO на разборе» in `fabric_question_check`. The CEO's settled answers are listed in History with their basis, so the owner can read what was decided for him and overturn it (`answer_withdrawn`, migration 112).

### 3.3 R3: the signal goes to the owner's personal communicator, not to a PM agent

- **The new notice.** An escalated question gets one notice through the personal communicator's `communicator.notify`:
  - `kind: question`, `questionId`, the question's expiry, a stable `eventId` `fabric-question-<id>`;
  - text only, at most 3,500 characters;
  - a link back to the question in Fabric.
- **Who sends it.** The main process sends it with its own key, read for one call from the vault (`observatoryVault.ts`, a new slot `fabric/prod/COMMUNICATOR_QUESTION_KEY`, a key allowed `question` only).
  - The workspace sync key stays limited to `failure` and `recovery`.
  - Issuing the key is Observatory's door, done by the build session (no human gate).
  - Without the key, the question still waits in «Нужны вы», and the ops log says once that the signal is off.
- **Answers from Telegram.** They come back as the owner's words to the CEO (its `ceo.ask` route), and the CEO settles the question with `fabric_ceo_question_settle`, basis «the owner's words, Telegram, <time>».
- **The PM path for the owner's own questions.**
  - The people-ask bridge is no longer the owner's channel: its Settings switch defaults to **off**.
  - The code stays, per R28 of the agents base (what shipped is kept beside the new): a switch someone turned on is kept, and an organization may still route its own team's questions through its PM agent.
  - `DEFAULT_PEOPLE_ROUTES` loses its built-in route.
- **Texts every agent reads.**
  - `turn-end-states` says «it reaches the CEO first, and the owner in Fabric and in his personal communicator».
  - `QUESTIONS_RULE` drops «the project offering people.ask (the organization's PM agent)» and sends a person's question to `fabric_question_ask`.
  - The CEO brief's «Tasks from PM agents» stays (PM agents give the CEO team tasks) but no longer carries the owner's questions.

### 3.4 R4: a console that waits at a prompt

- **Recognise it.** Fabric reads the screen of each running console it holds (`shared/ceoAgent.ts#screenText` over the
  scrollback, as `fabric_ceo_read` does) when its output has been quiet for 20 s, and classifies the last screen as
  waiting when it shows:
  - Claude Code's question menu (AskUserQuestion: a numbered list with «Enter to select» or «Esc to cancel»);
  - a permission or confirmation prompt (`y/n`, `[Y/n]`, «Do you want to proceed?», «Press Enter to continue»);
  - a question the agent typed and stopped on (the last line ends with «?» and the turn ended: no spinner, the
    prompt marker drawn, `shared/delivery.ts#claudePromptDrawn`).
  A pure function `shared/consolePrompt.ts#promptOnScreen(screen)` answers `{kind: 'menu' | 'confirm' | 'text', question,
  options: [{key, label}], selected}` or null; it is the one place that knows these shapes.
- **Hand it to the CEO at once.** A waiting console is typed into the CEO's console once per distinct prompt (keyed by
  session and a hash of the question and options), on the same minute timer as §3.2, with the session's name, project,
  task, the question, the options with their keys and Fabric's recommendation (the option the screen marks selected, or
  none). The CEO's own console is never handed to itself.
- **The CEO answers in the console.** With the existing `fabric_ceo_input` / `session_input` and `keyBytes` (a digit or
  the arrow keys and Enter for a menu, `y`/`n` for a confirm, text and Enter for a question). It records the decision in
  the behaviour journal with its basis. A prompt that changed or went away before the answer is left alone.
- **When the CEO cannot.** It calls `fabric_ceo_question_escalate` with the prompt: Fabric files it as a board question
  (`question.asked@1`, asker the waiting session, options from the screen) so it hangs in «Нужны вы», and signals the
  owner in his communicator (§3.3). The owner's answer (in Fabric or from Telegram through the CEO) is typed into the same
  console by the same keys; the question is answered when the keys are written and the prompt is gone.
- **Fail-safe.** A waiting console the CEO did not answer or escalate in ten minutes is escalated by the system, as in
  §3.2. A console in the person's own window stays the person's: Fabric hands it to the CEO only when it has been waiting
  for 2 minutes with no key typed by the person.

## 4. Scenarios, docs, tests

- **Scenarios (super-ux):**
  - new SCN «An agent's question is settled by the CEO or reaches the owner in his communicator»;
  - SCN-050 and SCN-164 amended (who answers first);
  - SCN-027 amended (publication under the owner's rule).
  - Product model and flows follow in the build change.
- **AGENTS.md:**
  - the people-ask bridge row: off by default, not the owner's channel;
  - a new row for the triage timer and the communicator notice.
- **Tests:**
  - triage timer (a question is held, typed once, falls back after 10 min);
  - `fabric_ceo_question_settle` refuses without a basis and answers with actor agent;
  - `fabric_ceo_question_escalate` writes the event once;
  - the owner rule issues a `publication` grant, and containment `none` still refuses;
  - the communicator notice is sent once per question with a stable `eventId`;
  - the people-ask default is off and a saved `true` is kept.
  - `promptOnScreen` reads an AskUserQuestion menu (question, options, selected), a `y/n` and a typed question, and
    answers null for a running spinner, a plain prompt and a finished turn with no question (screens captured from
    Claude Code and Codex);
  - a waiting console is handed to the CEO once per distinct prompt, never the CEO's own, and escalated after ten
    minutes; the owner's answer is typed into the same console by the right keys.
- **Release:** `ci.sh fast`, the release review iterations, CHANGELOG under the release that takes it.

## 5. Order of work

1. This spec and ADR-0207 (this change).
2. After 0.3.27 is tagged, ADR-0203's door reaches main with `feat/approval-modes` in the 0.3.28 train. Then R1 on it.
3. R2: the triage timer, the two CEO tools, the brief, the event type.
4. R3: the communicator notice with its key, the people-ask default, the agents' texts.
5. R4: `promptOnScreen`, the hand-off of waiting consoles, the answer by keys, the escalation into a board question.
6. Scenarios, AGENTS.md, CHANGELOG, map in the same changes.

## 6. Open, decided here by the recorded rules

- **Triage window: 10 minutes.** It is long enough for a running CEO to read and decide, and short enough that a question for the owner is not held long. Changing it is a constant.
- **Publication always allowed, not only «on the owner's order».** The owner's words leave no other variant, and no request proves whose order it serves. The behaviour journal shows every act.
- **The PM bridge is kept, off by default, not removed.** R28 (keep what shipped), and the owner keeps PM agents for team tasks.
