# ADR-0174: A repository's documents keep their language, and the working language can be switched off

**Status:** accepted · 2026-10-23 · amends [ADR-0172](0172-the-interface-language-is-the-agents-working-language.md)
(decisions 1 and 4) · decides OF-37 (in part) and OF-38 of
[the operator's walk](../evidence/plans/2026-10-15-fabric-simple/2026-10-23-operator-walk.md).

## Context

The operator, 2026-10-23, on ADR-0172: agents localize what Fabric shows, «но опять же это не должно никак влиять на сами
документации, которые есть в проектах ... Чисто превьюить данные, которые попадают в фабрик для интерфейса»; and «давай еще
сделаем опцию в настройках, включаем и отключаем. По дефолту она с языком переключается, она включена, но ее можем
выключить, то есть оставить дефолтный язык, с которым агенты говорят».

ADR-0172 decision 1 listed "the documentation an agent writes for the person" among what the working language governs,
and decision 4 let a project's own rule win only where the project fixed one.

## Decision

1. **A repository's documents keep their language.** The working language governs what reaches Fabric's interface: task
   titles and briefs, stages, notes, questions, board messages and reports. Documents in a project's repository keep the
   language that project uses, whether or not its instructions say so. The rule `fabric_whoami` serves says this
   (`apps/desktop/src/shared/protocol.ts#buildProtocol`).
2. **The person can switch it off.** Settings, under «Язык»: «Агенты пишут на языке интерфейса», on by default
   (`settings.agentLanguage`). Off, the hub names no working language: `protocol.language` is null and the rule is not
   served, so agents keep the language they speak by themselves (`apps/desktop/src/main/index.ts`, the surface's
   `language` reader).
3. **Not decided here: a display pass.** Text that still arrives in another language could be localized for display with
   a model call and its context (OF-37's second half). That needs a model, a spend and a cache, and waits for its own
   decision (0.3.12).

## Consequences

- An agent that reads its rules again after the switch changes follows the new state; one that does not keeps the rules
  it read.
- The protocol's hash differs between on, off and each language, so a session's recorded rules say which it had.
