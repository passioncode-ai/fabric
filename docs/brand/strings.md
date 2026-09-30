Contract: brand-contract v1

# Interface string registry

**The registry is code.** Since 2026-08-31 every user-visible string in the desktop
application lives in apps/desktop/src/renderer/src/i18n/en.ts, keyed and typed, and
`scripts/check-design.mjs` fails the build on a literal in a component or a key that
does not exist. That file is the registry; this page records the contract it is held to
and the rows worth reviewing as copy rather than as code.

- **Primary locale:** `en`. `ru` exists as a registry with the same keys and is filled
  when a Russian-speaking user is real (operator decision, 2026-08-31).
- **Voice:** [`voice.md`](voice.md) — peer-builder. Interface strings state current
  capability, planned capability and open decision as different things.
- **Endonyms** (`settings.localeEn`, `settings.localeRu`) are identical in every
  locale: a language picker names each language in that language.
- A string that makes a claim resolves to [`facts.md`](facts.md).

Rows below are the ones where the wording is a product decision rather than a label.

**Retired 2026-08-31:** the `kickoff.*` rows left with the block they belonged to. Their
meaning survives as task presets, which is why `tasks.presetContextText` carries the same
sentence.

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `estate.empty` | Nothing here yet. A project is a persistent workspace: its repositories, its memory, the agents working in it and the workflows they follow. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | shipped |
| `onboarding.lede` | A project holds repositories, memory and the agents that work in them. Nothing is written until you save. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | shipped |
| `onboarding.memoryUnavailable.hosted-estates-not-built` | Hosted estates are not built yet. This becomes available with them. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | shipped |
| `onboarding.memoryOnly` | Memory is stored in this machine’s database. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | shipped |
| `onboarding.memoryNone` | No memory backend is available on this machine, so a project cannot store anything it learns. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | shipped |
| `tasks.ledeNoRepo` | Write what should happen. No repository is attached yet, so the session starts in your home directory. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-032 | shipped |
| `tasks.presetContextText` | Survey this repository and write down what this project is: its purpose, its main modules, how it is built and run, and what state it is in. Cite files as you go. Change nothing yet. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-032 | shipped |
| `editor.conflict` | This file changed on disk while you were editing. Compare the two and choose. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-034 | shipped |
| `session.stop.confirm` | Stop this execution? The task and its history remain. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-096 | implemented; native acceptance pending |
| `session.stop.unknownHelp` | Termination is not yet verified. You can inspect the session or check again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-096 | implemented; provider proof pending |
| `workspace.resultsBody` | When an agent finishes a piece of work it returns a typed result: what became true, the proof, the scope and what it did not verify. Those results land here, and an agent that ships its own view renders it in this slot instead of the generic one. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-030 | shipped |

**The journal's sentences, added 2026-09-05.** The feed rendered the raw event type
— `task.note.promoted@1` — into the interface on three surfaces at once. The literal
check in `check-design.mjs` could not see it, because the text arrived as DATA rather
than as a source literal. Every registered event type now has one sentence under
`event.<type>`, and the same gate holds the two sets equal **in both directions**: a
type with no sentence fails, and a sentence for a type nobody registers fails too.

Most of the 38 are labels and are not listed here. The four below are product
decisions: each states something the product means rather than naming a row.

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `event.agent.stage.reported@1` | an agent reported its stage: its own claim | apps/desktop/src/renderer/src/i18n/en.ts | SCN-032 | shipped |
| `event.memory.retrieved@1` | memory was searched, including when it found nothing | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | shipped |
| `event.session.oriented@1` | a session read the rules it works under | apps/desktop/src/renderer/src/i18n/en.ts | SCN-032 | shipped |
| `event.grant.issued@1` | the operator granted an authority | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | shipped |

Why these four and not the other thirty-four. A stage report is a **claim** and the
word says so, because the whole product rests on a claim not being an observation. A
memory search that found nothing is still a search, and the sentence refuses the
"absent means zero" reading. Orientation is how we learn whether an agent ever read
its rules. And a grant names **the operator** as the one who granted it — an authority
with no named grantor is the thing the floor exists to prevent.

**Retired 2026-09-05 (M65):** `workflows.body` said routines and chains "arrive with
the agent runtime; today agents are launched by hand above". That stopped being true
when the routine tick shipped, and a collapsed panel making a false claim is worse
than an empty one — it answers the question wrongly for anybody who opens it. The
panel is now the Automations surface: what is running, what is scheduled, and what
happened before, including the runs that did not happen.

## Launch prototype · 2026-09-15

| Key | Text (ru target) | Location | Scenario | Status |
|---|---|---|---|---|
| `launch.board.review` | Разобрать доску | scripts/product/launch.mjs | SCN-041 | proposed |
| `launch.board.defer` | На следующий раз | scripts/product/launch.mjs | SCN-041 | proposed |
| `launch.board.save` | Сохранить итог | scripts/product/launch.mjs | SCN-041 | proposed |
| `launch.context.historical` | Сохранённый пакет запуска | scripts/product/launch.mjs | SCN-091 | proposed |
| `launch.context.next` | Предварительный следующий | scripts/product/launch.mjs | SCN-091 | proposed |
| `launch.plan.expand` | Раскрыть | scripts/product/launch.mjs | SCN-053 | proposed |
| `launch.source.retry` | Перечитать | scripts/product/launch.mjs | SCN-090 | proposed |

Prototype fixture figures are explicitly synthetic, not product claims or customer metrics. UI copy uses the interface channel and peer-builder voice. Humanization: own pass; wording states a concrete action and observable state.

## Home layout · целевой макет 2026-09-15

Строки прототипа используют регистр docs/help; runtime i18n не изменён.

| Key | Text (ru prototype) | Location | Scenario | Status |
|---|---|---|---|---|
| `prototype.home.resume` | Где остановились | scripts/product/launch.mjs | SCN-094 | proposed |
| `prototype.home.live` | Действия агентов | scripts/product/launch.mjs | SCN-040 | proposed |
| `prototype.home.rhythm` | Ритм работы | scripts/product/launch.mjs | SCN-094 | proposed |

Humanization: on — own pass; короткие подписи проверены на конкретность и сохранение смысла. Формулировки статусов отличают сообщение агента, наблюдение и принятие результата.


## Unified creation · target prototype 2026-09-17

SCN-031 → FLW-18 → SCR-27. Existing advanced setup terms now live in
`scripts/product/guided.mjs`, previously `workbench.mjs`. This internal report
uses the docs/help register; production form/error channel and native i18n are
not promoted by this change. Humanization: own pass; concrete state and next action.

| Key | Text (ru prototype) | Location | Scenario | Status |
|---|---|---|---|---|
| `creation.review.changed` | Проверьте проект ещё раз. Черновик изменился после проверки. | scripts/product/new-project.mjs | SCN-031 | proposed |
| `creation.pending` | Создание подтверждается. Проверьте исход того же запроса. | scripts/product/new-project.mjs | SCN-031 | proposed |
| `creation.accepted.changed` | Проект уже создан с проверенными параметрами. Откройте его или создайте отдельный черновик. | scripts/product/new-project.mjs | SCN-031 | proposed |
| `creation.pending.help` | Используем тот же запрос. Правки черновика не изменят его исход. | scripts/product/guided.mjs | SCN-031 | proposed |
| `creation.review.future.on` | Включены в выбранный scope наблюдения | scripts/product/guided.mjs | SCN-031 | proposed |
| `creation.review.future.off` | Не включены | scripts/product/guided.mjs | SCN-031 | proposed |


### CEO-first target revision · 2026-09-25

These Russian prototype strings are proposed, not desktop i18n coverage. Source: `scripts/product/first-release.mjs` and `folder-picker.mjs`; SCN-095/096.

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `r0.source.choose` | Выбрать папку | scripts/product/folder-picker.mjs | SCN-095 | proposed |
| `r0.provider.check` | Проверить подключение | scripts/product/first-release.mjs | SCN-095 | proposed |
| `r0.stop.unknown` | Остановка не подтверждена | scripts/product/first-release.mjs | SCN-096 | proposed |
| `r0.continue.fresh` | Новая сессия Claude Code | scripts/product/first-release.mjs | SCN-096 | proposed |
| `r0.chat.scope` | Без контекста | scripts/product/chat-workspace.mjs | SCN-095 | proposed |

## R0 conversation/context · 2026-09-26

| Key | Text | Source | Scenario | Status |
|---|---|---|---|---|
| r0.ticket.open | Разобрать с Fabric | scripts/product/first-release.mjs:145 | SCN-041 | proposed |
| r0.outcome.apply | Добавить задачу | scripts/product/first-release.mjs:35 | SCN-041 | proposed |
| r0.source.primary | Сделать главным | scripts/product/first-release.mjs:30 | SCN-095 | proposed |
| r0.source.selected | Продолжить с выбранными | scripts/product/first-release.mjs:139 | SCN-095 | proposed |
| r0.profile.style | Стиль общения | scripts/product/first-release.mjs:152 | SCN-042 | proposed |

## R0 compact conversation · 2026-09-26

| Key | Text | Source | Scenario | Status |
|---|---|---|---|---|
| r0.chat.context.none | Без контекста | scripts/product/chat-workspace.mjs | SCN-042 | proposed |
| r0.chat.context.all | Все | scripts/product/chat-workspace.mjs | SCN-042 | proposed |
| r0.chat.context.add | Добавить материалы | scripts/product/chat-workspace.mjs | SCN-042 | proposed |
| r0.chat.composer | Спросите или поручите… | scripts/product/first-release.mjs | SCN-042 | proposed |
| r0.chat.target | Для какого проекта? | scripts/product/chat-workspace.mjs | SCN-042 | proposed |

| r0.outcome.decline | Не сейчас | scripts/product/first-release.mjs:35 | SCN-042 | proposed |
| r0.team.heading | Агенты и работа | scripts/product/team-workspace.mjs:18 | SCN-094 | proposed |
| r0.team.attention | Ждут меня | scripts/product/team-workspace.mjs:18 | SCN-094 | proposed |
| r0.team.empty | Нет активных запусков. | scripts/product/team-workspace.mjs:18 | SCN-094 | proposed |

| r0.memory.title | Продолжайте с того, что уже известно | scripts/product/memory-workspace.mjs | SCN-057 | proposed |
| r0.memory.attach | В разговор с Fabric | scripts/product/memory-workspace.mjs | SCN-057 | proposed |
| r0.memory.empty | Совпадений нет | scripts/product/memory-workspace.mjs | SCN-057 | proposed |


## R0 delivery receipts · 2026-09-27

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `event.delivery.failed_before_write@1` | the session did not receive the instruction; no bytes were written | apps/desktop/src/renderer/src/i18n/en.ts | SCN-050, SCN-067 | proposed |
| `event.delivery.retrying@1` | the instruction is queued again after a confirmed no-write result | apps/desktop/src/renderer/src/i18n/en.ts | SCN-050, SCN-067 | proposed |
| `event.delivery.unknown@1` | instruction delivery is uncertain; it will not be resent automatically | apps/desktop/src/renderer/src/i18n/en.ts | SCN-050, SCN-067 | proposed |

Humanization: own pass. Delivery wording distinguishes recorded answer, actual write and receiver acknowledgement. English and Russian event strings changed together; no model or agent-readiness claim is inferred from transport.

| `event.run.stop_requested@1` | agent stop requested; termination is not yet confirmed | apps/desktop/src/renderer/src/i18n/en.ts | SCN-050, SCN-096 | proposed |
| `event.run.stop_unknown@1` | agent termination is not confirmed; continuation stays blocked | apps/desktop/src/renderer/src/i18n/en.ts | SCN-050, SCN-096 | proposed |
| `event.run.stop_observed@1` | stop confirmed; see the recorded evidence | apps/desktop/src/renderer/src/i18n/en.ts | SCN-050, SCN-096 | proposed |
| `event.run.launching@1` | agent launch is preparing; execution is not confirmed | apps/desktop/src/renderer/src/i18n/en.ts | SCN-050, SCN-067 | proposed |
| `event.run.launch_failed@1` | launch setup failed; session termination must be checked | apps/desktop/src/renderer/src/i18n/en.ts | SCN-050, SCN-067 | proposed |

Stop copy review: EN/RU labels distinguish request, verified result, unknown and refusal. Humanization pass removed the old promise that clicking End proves termination. Existing typography and semantic tones are reused; no new palette or visual acceptance is claimed.

## First slice · target mockup 2026-09-28 (U3)

Copy review of the first-slice screens (SCR-64 CEO conversation, SCR-65 private history,
SCR-48 restore, SCR-25 session) against [`voice.md`](voice.md) and
[`terminology.md`](terminology.md). The rows are the sentences where the wording is the
product decision: each one says what is known, what is not, and what will not happen. The
English keys are the names the app strings take when these screens reach `en.ts`
(first-slice plan C3 and A1-6); the text is the Russian target of the mockup.

| Key | Text (ru prototype) | Location | Scenario | Status |
|---|---|---|---|---|
| `ceo.send.notActivated` | Отправка выключена: восстановление личной истории пока недоступно. | scripts/product/first-release.mjs | SCN-042 | proposed |
| `ceo.send.pending` | Сохранено, ответа пока нет | scripts/product/first-release.mjs | SCN-042 | proposed |
| `ceo.send.unknown` | Результат отправки неизвестен. Повторно не отправляем — проверим эту же отправку. | scripts/product/first-release.mjs | SCN-042 | proposed |
| `ceo.send.checkAgain` | Проверить ещё раз | scripts/product/first-release.mjs | SCN-042 | proposed |
| `ceo.history.unreadable` | Это не пустой разговор: сообщения на этом Mac не удалены, но сейчас их нельзя открыть. | scripts/product/first-release.mjs | SCN-042 | proposed |
| `ceo.scope.unsupported` | Эта версия работает без проекта или с одним проектом. Выбор «Все проекты» не применён. | scripts/product/first-release.mjs | SCN-042 | proposed |

The rows below live in `operations.mjs` and `renderers.mjs`. They are listed, not tabled,
on purpose: a table row there puts the whole file under B022's literal sweep, and on
2026-09-28 that added 766 warnings about code fragments to a gate already at 993. The
wording is held instead by `scripts/test/first-slice-states.test.mjs`, which renders it.

- `history.private.fileNote` — «Файл доступен только вашему пользователю на этом Mac. Он не зашифрован.» · scripts/product/renderers.mjs · SCN-097
- `history.private.denied` — «Это личная история другого человека. Импортировать можно только свою и только в Estate, где вы участник.» · scripts/product/renderers.mjs · SCN-097
- `restore.intro` — «История архива восстанавливается в новую Estate. Текущая Estate и её работа не меняются.» · scripts/product/operations.mjs · SCN-065
- `restore.unknown` — «Ответ не пришёл. Проверим эту же операцию — второго восстановления не будет.» · scripts/product/operations.mjs · SCN-065
- `restore.error` — «Всё отменено: новая Estate не создана, файл архива не тронут.» · scripts/product/operations.mjs · SCN-065
- `restore.open` — «Открыть эту Estate» · scripts/product/operations.mjs · SCN-065
- `session.view.detached` — «Окно закрыто — агент продолжает работать» · scripts/product/operations.mjs · SCN-096
- `session.reattach` — «Переподключиться» · scripts/product/operations.mjs · SCN-096
- `session.backendLost` — «Ввод выключен во всех окнах этого агента. Работа не объявлена остановленной: Fabric не видит, завершилась ли она.» · scripts/product/operations.mjs · SCN-096

Review findings fixed in the same change: the mockup title said «первый срез» and «CEO»
(insider shorthand; the product name is Fabric); one reattach action carried two names
(«Переподключить эту сессию», «Переподключиться») and appeared twice on the detached view;
«Проверить снова» and «Проверить ещё раз» named one check; the unsupported scope looked
selected while the text said it was not applied; «откатаны» became «отменены». Held by
`scripts/test/first-slice-states.test.mjs`.


## Conversation with Fabric in the app · 2026-09-28 (C4)

The app strings for SCR-64, primary English in `en.ts`, Russian in `ru.ts`. They carry the same
decisions as the first-slice mockup rows above: what is known, what is not, and what will not happen.

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `chat.notActivated.note` | Sending is off: private history recovery is not available yet. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.saved` | Saved on this Mac | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.pending` | Saved, no reply yet | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.unknown` | The send result is unknown. Fabric will not send it again; check this same send. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.checkAgain` | Check again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.recovery.body` | This is not an empty conversation: messages on this Mac are not deleted, but they cannot be opened right now. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.unsupported` | This version works with no project or one project. “All projects” is not applied. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.unknownNotDiscardable` | A send with an unknown result cannot be removed until it is checked. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.conflict` | The draft changed in another window. The newer text is kept. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
