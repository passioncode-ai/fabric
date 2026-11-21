# ADR-0207: The CEO triages every question, the owner is signalled only in his own channel, and publication on his rule never waits

**Status:** accepted · 2026-11-21 · the owner's decision, Telegram 2026-11-21 03:14, relayed verbatim by the CEO on the
project board (request `05c2f2bd`, provenance trusted) · builds on
[ADR-0205](0205-decisions-split-by-level-strategy-is-the-persons-tactics-the-agents.md) (decisions by level),
[ADR-0036](0036-the-ceo-settles-what-it-can-cite-and-trust-is-autonomy-on-a-different-subject.md) (the CEO settles what it can cite) and
[ADR-0197](0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md) (the CEO console) · uses the
grant door of ADR-0203 (branch `feat/approval-modes`, the 0.3.28 train) · narrows the people-ask bridge
([spec](../evidence/specs/2026-11-16-people-ask-bridge.md)) to an organization's team · spec:
[2026-11-21-ceo-triages-questions](../evidence/specs/2026-11-21-ceo-triages-questions.md).

## Context

The owner, verbatim:

> «Давай мы сделаем так, чтобы эти публикации вообще никогда не спрашивали и не тормозили на них. Очевидно, что там нет
> другого варианта, кроме как разрешить. Мы всегда должны спрашивать, нужно ли в конце, когда пришёл и он к вопросу.
> Давай добавим так, чтобы CEO фабрики анализировал все вопросы и принимал решение, нужно ли спрашивать или можно
> принять решение самому. И только по тем, которые нужно, мы их оставляем, и по ним уже они висят на доске и по ним
> сигнализируем. Только давай по ним будем сигнализировать в мой персональный коммуникатор. А PM-агентов оставим для
> работы с тасками из команды. Короче, чтобы мой фабричек не был связан с PM-ами.»

Today a `publication` act is refused the first time and waits for the owner's «Разрешить один раз»
(`main/policy.ts#Policy.decide`). Every `fabric_question_ask` goes straight to «Нужны вы», and its only outward signal is
the people-ask bridge to the organization's PM agent (`main/peopleAskRun.ts`). Every session is told so
(`shared/protocolObligations.ts`, rule `turn-end-states`). The CEO has no tool to answer a question
(`main/ceoTools.ts#CEO_TOOLS`).

## Decision

1. **Publication waits for no one under the owner's rule.** `settings.json` `ownerRules.publication` is `allow` by
   default. While it is on, a `publication` request without a grant gets a one-shot grant Fabric issues itself as the
   system actor `owner-rule:publication`, by ADR-0203's door (the asker's project, act and target, ten minutes). The
   policy then decides as before: containment still refuses a runner without containment, and the schema still refuses
   an intent without a grant. Money and deletion keep the approval mode. The human gates (sign-in, one-time code,
   payment, typed secret, consent screen) wait in every case.
2. **Every question reaches the CEO first.** A new question is held from the owner for ten minutes and typed into the
   CEO's console once, which is woken if it is not running. The CEO, by ADR-0205's bar, either settles it with
   `fabric_ceo_question_settle` (an answer with a cited basis, recorded as the CEO's, delivered to the waiting session
   like a person's answer; refused without a basis, ADR-0036) or leaves it for the owner with
   `fabric_ceo_question_escalate` (`question.escalated@1`). A question neither settled nor escalated in the window is
   escalated by the system, so a busy or stopped CEO loses nothing.
3. **«Нужны вы» holds what needs the owner.** Only escalated questions show there; the CEO's settled answers are listed
   in History with their basis, and the owner can withdraw any of them.
4. **The signal is the owner's personal communicator.** Each escalated question is signalled once through
   `communicator.notify` (`kind: question`, a stable event id per question), sent by the main process with its own
   question-only key read from the vault for one call. Without the key the question still waits in «Нужны вы» and the
   operations log says once that the signal is off.
5. **PM agents keep the team's tasks.** The people-ask bridge stops being the owner's channel: its switch defaults to
   off, its built-in route is removed, and a switch someone turned on is kept. The texts every agent reads (`turn-end-states`,
   the board runs' `QUESTIONS_RULE`) send a person's question to `fabric_question_ask`, which reaches the CEO first.

6. **A console waiting at a prompt is a question too** (the owner, 2026-11-21 04:32: «надо чтобы такие сессии вопросы
   либо мне присылали если не могут, либо сам агент фабрик отвечал»). Fabric recognises a console it holds that waits
   for a choice or an answer (Claude Code's question menu, a confirm, a typed question) and hands it to the CEO at once
   with the question, the options and its recommendation. The CEO answers in that console by keys; if it cannot, the
   prompt becomes a board question signalled in the owner's communicator, and his answer is typed into the same console.
   A console in the person's own window is handed over only after two minutes with no key from the person.

## Consequences

- The owner is asked less, and only in his own channel; what the CEO decided for him is readable and reversible.
- A question waits up to ten minutes longer before it reaches the owner, when the CEO does not settle it.
- Every publication goes ahead, and the behaviour journal and `grant.issued@1` name the owner's rule as its issuer. A
  publication he would have stopped is seen afterwards, not before: his words leave no other variant.
- The people-ask bridge keeps working for an organization that turns it on for its team.
- New: one event type (`question.escalated@1`, with its `event_types` row and feed sentence), two CEO tools, one settings
  key, one vault slot. Scenarios SCN-027, SCN-050 and SCN-164 change, and one is added, in the build changes.
