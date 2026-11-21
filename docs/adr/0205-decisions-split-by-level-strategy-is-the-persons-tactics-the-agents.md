# ADR-0205: Decisions split by level: strategy is the person's, tactics the agent's, and a question goes only where the person knows better

**Status:** accepted · 2026-11-21 · the operator's decision, relayed verbatim on the project board (request `a76373fa`,
thread `777f9514`, from the operator's Telegram through Personal Communicator, provenance trusted) · amends
[ADR-0176](0176-a-task-is-grilled-to-a-full-spec-and-crosses-machines-by-trust.md) Decision 1 (who fills a missing part
of a spec) · keeps [ADR-0004](0004-autonomy-is-a-goal-field-standing-on-a-floor-in-the-schema.md) (the floor) and
[ADR-0026](0026-fabric-exposes-a-project-scoped-policy-enforced-mcp-control-surface.md) (the control surface, whose
rules are either enforced or called advice, M155).

## Context

The operator, 2026-11-21:

> СПЕКА ОТ [владельца]: Философия принятия решений в системе (для дизайна агентов и спек).
>
> ПРИНЦИП: Оператор = человек. Разделение уровней:
>
> 1. СТРАТЕГИЯ (vision, концепция, видение) = решение за оператором (человеком). Всегда говорим с ним.
>
> 2. ТАКТИКА = умная модель решает сама (она умнее оператора). Спрашивает только при конкретных вопросах.
>
> 3. ДОМЕНЫ где мы знаем лучше или можем найти ответ сами = всегда автоматически, всегда.
>
> 4. ГРИЛИНГ ВОПРОСОВ: спрашивать только там, где не уверены или знаем хуже оператора. НЕ задавливать вопросами.
> Оценивать экспертизу оператора в домене.
>
> Это универсальный принцип для всех спек и дизайна агентов.

ADR-0176 Decision 1 told an agent to ask the person for each missing part of a spec, whatever the part was. Read
literally, an agent asks about things it can read in the code or decide better than the person, and the person is buried
in questions. The session rule `intake.spec-first` carried that wording to every agent at `fabric_whoami`
(`apps/desktop/src/shared/protocolObligations.ts#OBLIGATIONS`).

## Decision

1. **The operator is a person, and a decision is settled by its level.**
   - **Strategy** (the vision, the concept, what the product is for) is the person's. An agent always asks and never
     settles it itself. In this repository that is the alignment test of `docs/ux/vision.md`, which already stops a
     misaligned feature for the person's choice.
   - **Tactics** (how to reach what was asked) are the agent's. It decides, writes the choice and its reason where the
     work lives (the brief, the ADR, the carry-over row), and asks only a concrete question it cannot settle.
   - **A domain where the agent knows better, or can find the answer itself** (the code, the documents, the project's
     recorded decisions, a measurement, a search) is always the agent's. It finds the answer and never asks.
2. **A question has a bar.** An agent asks only where it is still unsure after looking, or where the person knows better
   than it does. It weighs the person's expertise in that domain before asking, and it does not bury the person in
   questions.
3. **A spec is gathered by those levels.** ADR-0176 Decision 1 stands in what it requires (a task starts with a whole
   spec, and nothing is built while a question on it is open) and changes in who fills a missing part: the agent writes
   what it can find or decide, and asks, one question at a time, only for what the person or the task's author alone can
   say. The brief still names what, why and expected, so the person sees what was assumed for them.
4. **It is the rule for every spec and every agent design.** Fabric tells it to every session as the rule
   `decisions.by-level`, and `intake.spec-first` points at it.
5. **It grants nothing.** Money, deletion and publication keep their floor (`fabric_effect_request`), and a sign-in, a
   consent, a typed secret and a payment stay the person's. The levels say who decides a question, not who may act.

## Consequences

- `decisions.by-level` is ADVICE by its label (M155): nothing can tell a strategic question from a tactical one,
  and nothing refuses a question. What Fabric holds is the text every agent reads before it asks. The served rules
  change, so the protocol hash moves and a session served the old rules is journalled again (`session.oriented@1`).
- SCN-176 says the agent fills what it can and asks only for the rest.
- Not built here, and open: measuring the bar (how many questions a task asked against how many a person had to answer
  that the agent could have settled), and a record of the person's expertise by domain that an agent could read instead
  of judging it each time. The cross-repository statement of the principle belongs to the knowledge base
  (`knowledge/principles.md` of fabric-workspace) and to the agents database for agent design; Fabric told both on the
  board.
