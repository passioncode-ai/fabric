# ADR-0172: The interface's language is the agents' working language

**Status:** accepted · 2026-10-22 · decides P-24 · amends the first run of
[ADR-0100](0100-first-run-and-start-paths.md) (step 1 asks the language) and the stage rule of
`shared/protocolObligations.ts` (`progress.report-stage`).

## Context

The operator, 2026-10-22, on the installed 0.3.10: «доска не на русском ... чтобы агенты репортили данные на том языке,
на котором стоит интерфейс ... при первой установке обязательно выбор языка и указываем, что на этом языке будет
происходить генерация документации».

Fabric's interface was in Russian, and the board's rows were English (for example «SB-114: recovery after account
limits» from fabric-switchboard). The agents were never told which language to use: the tools asked for a title or a
stage "in their language" (`apps/desktop/src/main/agentSurface.ts`, the stage, title and brief descriptions), and the
stage rule said "in the language they write to you in". An agent reached by another agent, or by a person who writes to
it in English, wrote English. The first run did not ask the language at all: SCN-126 step 1 promised a choice, and
`start/FirstRun.tsx` took the system's language silently.

## Decision

1. **One language.** The language of Fabric's interface (`settings.locale`, English or Russian) is the working language
   of every agent that reaches Fabric: what a person will read is written in it (task titles and briefs, stages, notes,
   questions, board messages, reports and the documentation an agent writes for the person). Code, identifiers,
   commands, paths and quotations stay as they are.
2. **Fabric names it.** `fabric_whoami` returns `protocol.language` (`code`, `name`, `native`) and, right after the date,
   the rule that says what to write in it (`shared/protocol.ts#buildProtocol`). The language is part of the protocol's
   hash, so a session can tell which language its rules named. The tools that ask for person-facing text point to
   that language instead of "their language". It is read at each `fabric_whoami`, so a change in Settings reaches an
   agent the next time it asks for its rules.
3. **The person chooses it first.** The first run's step 1 asks the language before anything else and says that the
   agents will write in it; the choice is written at once. Settings says the same under «Язык».
4. **A project's own rule wins for its documents.** Where a repository's instructions fix the language of its documents
   (Fabric's own documentation is in English), those documents keep it; the rule says so. Everything else a person
   reads follows the working language.
5. **Advice, honestly labelled.** The rule is `[ADVICE]`: Fabric cannot refuse a sentence for its language, and saying
   "enforced" would be false (M155). What Fabric can do is name the language every time.

## Consequences

- Other projects' agents learn the language from the same hub on this machine; rows already written stay as written.
- A third language needs only a locale in the interface: `workingLanguage` maps it, and the rule follows.
- Not done here: translating rows already on the board, and a per-project language. Both wait for a request.
