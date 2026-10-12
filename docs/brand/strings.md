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
| `estate.empty` | Nothing here yet. A project holds its repositories, its memory, the agents working in it and the workflows they follow. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | shipped |
| `onboarding.lede` | A project holds repositories, memory and the agents that work in them. The project itself is made only when you create it; a new folder you make for it is created at once. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | shipped |
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
| r0.source.selected | Добавить выбранные проекты | scripts/product/first-release.mjs:248 | SCN-128 | proposed |
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
| `chat.saved` | Saved on this computer | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.pending` | Saved, no reply yet | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.unknown` | The send result is unknown. Fabric will not send it again; check this same send. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.checkAgain` | Check again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.recovery.body` | This is not an empty conversation: messages on this computer are not deleted, but they cannot be opened right now. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.unsupported` | This version works with no project or one project. “All projects” is not applied. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.unknownNotDiscardable` | A send with an unknown result cannot be removed until it is checked. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |
| `chat.conflict` | The draft changed in another window. The newer text is kept. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-042 | shipped behind a closed gate |

**Added 2026-10-03 — the first run and the start paths ([ADR-0100](../adr/0100-first-run-and-start-paths.md)).** Every string the run added, agreed as copy in one place; the state words (`found`, `installed`, `not responding`, `missing`), the scan's honest totals and the planned conversion are the product decisions among them.

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `onboarding.newFolder` | Create a new folder for it… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `onboarding.newFolder.badName` | The project name cannot be a folder name: {problem}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `launch.help.go.welcome` | Walk through the first run again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.progress` | First run | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.step1` | Your Fabric | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.step2` | Coding agents | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.step3` | Where to start | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.next` | Continue | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.back` | Back | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.skip` | Skip | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.hello` | Hello. I'm {name}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.lede` | I run your projects with the coding agents you already use. Give me a name and a face: that changes how I look, never what I may do. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.name` | Name | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.nameHint` | Leave it empty to keep “Fabric”. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.tooLong` | At most {max} characters. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.notSaved` | The look was not saved: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.continueAnyway` | Continue without saving | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.title` | Which coding agents can work here | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.lede` | Fabric does not write code itself: it hands work to a coding agent on this computer and keeps the record. It looked for the ones it can run. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.checking` | Looking for coding agents… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.failed` | The check did not run: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.found` | Version {version} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.unresponsive` | {program} is on this computer, but “{program} --version” did not answer. Run {program} once in a terminal to finish its setup, then check again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.missing` | Not installed. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.state.found` | Ready | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.state.unresponsive` | Needs setup | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.state.missing` | Not installed | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.copy` | Copy | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.copied` | Copied | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.recheck` | Check again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.continueWithout` | Continue without an agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.start.title` | Where shall {name} start? | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.start.lede` | Pick one. The others stay one click away under + Project in the sidebar. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.start.later` | Not now, take me home | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.kicker` | Start | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.home` | Home | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.back` | Back | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.menu.title` | Where do we start? | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.menu.lede` | Fabric is your way into PassionCode.ai: projects, and the agents that work in them. The work itself happens in the console of the coding agent you already use. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.new.mark` | ◇ | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.new.body` | A new folder, or only an idea to shape first. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.agent.mark` | ◎ | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.agent.body` | A new agent in its own repository, built to the Fabric protocol by your coding agent from the first question. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.convert.mark` | ⇄ | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.convert.body` | An agent you built elsewhere (a script, a service, an MCP server) is adapted to the Fabric protocol on a branch of its own, then checked. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.facts.path` | Folder | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.facts.git` | Git | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.facts.remote` | Remote | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.facts.lastCommit` | Last commit | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.facts.stack` | Stack | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.kind.repository` | repository | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.kind.worktree` | worktree | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.kind.folder` | not a repository | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.name.label` | Project name | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.name.empty` | A project needs a name. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.add.title` | Open a project: one folder | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.lede` | Choose the folder. Fabric reads it, shows what it found, and creates the project only when you confirm. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.choose` | Choose a folder… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.choose.body` | Usually a git repository you work in. A plain folder works too. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.reading` | Reading {folder}… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.already` | This folder is already in: {names}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.openExisting` | Open that project | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.notGit` | This folder is not a git repository. Fabric can still hold it, but it will not see commits or branches until it is one. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.create` | Add project | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.creating` | Adding… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.other` | Choose another folder | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.failed` | The project was not added: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.nothingWritten` | Nothing in the folder is changed. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.scan.title` | Open a project: a folder of projects | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.lede` | Choose the folder that holds your projects. Fabric lists the repositories it finds; each one you tick becomes its own project. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.choose` | Choose a folder to scan… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.choose.body` | For example the folder where you clone repositories. The scan goes four folders deep (two inside a repository) and skips dependency folders, build output and hidden folders. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.readOnly` | Scanning only reads. Nothing is created until you tick and confirm. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.scanning` | Scanning {folder}… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.stop` | Stop | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.failed` | The scan did not finish: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.summary` | Repositories: {count} · in {folder} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.when` | scanned {date} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.again` | Scan again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.truncated` | The scan stopped after {visited} folders. The list below is not the whole folder. Scan a narrower one. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.none` | No repositories were found in this folder. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.filter` | Filter by name or path | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.selectAll` | Tick all shown | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.clear` | Untick all | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.group` | {name} · {count} folders | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.noCommits` | no commits yet | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.inProject` | In {name} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.added` | added | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.later` | Unticked repositories stay here; you can come back to them. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.import` | Add {count} as projects | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.importing` | Adding {done} of {count}… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.openFirst` | Open {name} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `first.exec.state.foundUnconnected` | Installed | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.unconnected` | {name} runs in a project folder as itself. Fabric's tools are not connected to it yet, so it cannot report work back to Fabric. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.choose` | Which one does your work | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | proposed |
| `first.exec.chooseHint` | Fabric opens it when you create or adapt an agent. You can pick another one at each launch, and change the order under “Settings”, in the fallback order. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | proposed |
| `first.exec.cannotPick.missing` | You can pick it once it is installed: run the command below, then press “Check again”. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | proposed |
| `first.exec.cannotPick.missingNoCommand` | You can pick it once it is installed: install it as its maker describes, then press “Check again”. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | proposed |
| `first.exec.cannotPick.unresponsive` | You can pick it once it answers: finish its setup, then press “Check again”. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | proposed |
| `first.exec.notSaved` | Your choice was not saved: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | proposed |
| `start.builder.fixMissing` | {name} is not installed. To pick it, install it with this command, then press “Check agents again”: | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.builder.fixMissingNoCommand` | {name} is not installed. To pick it, install it as its maker describes, then press “Check agents again”. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.builder.recheck` | Check agents again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `onboarding.unavailableHint` | A greyed-out coding agent is not installed on this computer. Install it, then open this again: “Fabric help” → “Walk through the first run again” shows each install command. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | proposed |
| `start.scan.stopped` | The scan was stopped. Nothing was added. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.unreadable` | Folders that could not be read (permissions or an unavailable disk): {count}. Repositories under them may be missing. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.importedAll` | Added: {ok}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.importedSome` | Added: {ok}. Not added: {failed}. Those stay ticked, so adding again retries them. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.nested` | inside another repository | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.partWarning` | This becomes a separate project from the repository it belongs to. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.rowFailed` | Not added: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.tickToAdd` | Tick repositories to add | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.new.git` | Start it as a git repository | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `start.new.refused.exists` | A folder with this name is already there: {detail} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `start.new.refused.invalid-name` | This name cannot be a folder name: {detail}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `start.new.refused.outside` | That location was not chosen in this window. Choose it again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `start.new.refused.failed` | The folder could not be created: {detail} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `start.convert.title` | Adapt an existing agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step1` | Choose the agent's folder | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step1.body` | Fabric reads it and nothing else. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step2` | The coding agent shows its plan | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step2.body` | It inspects without running anything and shows which profile fits (MCP, A2A or a terminal agent that Fabric drives) and every file that would change. You decide. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step3` | It adapts the agent on its own branch | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step3.body` | With the Fabric Agent Adapter skills, on a new branch; the branch it was on is not touched. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step4` | The conformance check shows what came of it | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step4.body` | It shows you the report: what passed, and what still stands before the agent is admitted. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `agents.madeReading` | Reading the agents of this project… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.readFailed` | The agents could not be read: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.retry` | Try again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.runner` | Coding agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.noRunner` | No coding agent to run it in is available on this computer. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.nameTooLong` | At most {max} characters. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.nameTaken` | This project already has an agent called {name}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.instructionsShort` | At least {min} characters, {count} so far. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.creating` | Creating… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.createFailed` | The agent was not created: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.createdNotice` | Created {name}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `start.scan.hiddenTicked` | Ticked but hidden by the search: {count}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `onboarding.newFolder.problem.not-a-name` | it is not text | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `onboarding.newFolder.problem.empty` | it is empty | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `onboarding.newFolder.problem.too-long` | it is longer than 80 characters | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `onboarding.newFolder.problem.leading-dot` | it starts with a dot | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `onboarding.newFolder.problem.separator` | it contains a slash, a colon or a control character | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `onboarding.newFolder.problem.text-direction` | it contains a character that reverses the reading direction | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `onboarding.newFolder.making` | Creating the folder… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `onboarding.newFolder.made` | new folder | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `onboarding.newFolder.leftOnDisk` | The folder {path} stays on disk; Fabric does not delete folders. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `onboarding.defaultAgent` | Default coding agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `estate.quotaUnreachableUnread` | The service could not be reached, and no reading has come back yet. This says nothing about whether Claude Code is signed in. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-030 | implemented; release pending (P-02) |
| `estate.quotaRejectedUnread` | The service refused the request, and no reading has come back yet. This says nothing about whether Claude Code is signed in. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-030 | implemented; release pending (P-02) |
| `estate.quotaEmptyUnread` | The service answered with nothing, so there are no numbers to show yet. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-030 | implemented; release pending (P-02) |
| `estate.quotaThrottledUnread` | Rate-limited before the first reading came back, so there are no numbers yet. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-030 | implemented; release pending (P-02) |
| `estate.quotaNone` | No reading came back, so there is nothing to show. This says nothing about the account itself. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-030 | implemented; release pending (P-02) |
| `agents.runnersReading` | Reading the coding agents on this computer… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.unknownRunner` | no coding agent recorded | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.createdAgent` | Created agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.nameEmpty` | Give it a name you will pick it by. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.instructionsMin` | At least {min} characters: this text is all it will be told. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.missing` | Still needed: {items}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.missing.name` | a name | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.missing.brief` | what it is for | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.missing.runner` | a coding agent to run in | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `search.method.substring` | matched as text anywhere: this store has no word index; newest first | apps/desktop/src/renderer/src/i18n/en.ts | SCN-037 | implemented; release pending (P-02) |
| `first.persona.character` | Character | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.variant` | Variant | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.copyFailed` | Not copied: select the text | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.scan.keptFailed` | The last scan could not be read: {reason}. Scan a folder to see its repositories. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.deep` | Folders deeper than the scan goes, not entered: {count}. Most are folders inside repositories; if a repository is among them, scan the folder that holds it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.symlinks` | Folders that are links to elsewhere, not followed: {count}. Scan the folder a link points to if its repositories belong here. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.repoRefused.not-a-path` | {path} is not a folder path. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.repoRefused.missing` | The folder {path} does not exist. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.repoRefused.not-a-folder` | {path} is a file, not a folder. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.repoRefused.not-chosen` | The folder {path} was not chosen in this window. Choose it with the folder picker or scan the folder that holds it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.scan.summaryParts` | Repositories: {count}, of them parts of another (worktrees, nested): {parts} · in {folder} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.noMatch` | Nothing matches the search. Clear it to see every repository. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.repoRefused.too-broad` | {path} is too broad to be a repository folder: choose the repository itself. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.repoRefused.held-by-other` | {path} already belongs to another project; one repository has one project. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.folderRefused.missing` | The folder {path} does not exist. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.folderRefused.not-a-folder` | {path} is a file, not a folder. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.folderRefused.unreadable` | The folder {path} could not be read (permissions or an unavailable disk). | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.folderRefused.timeout` | Reading the folder {path} took too long; the disk may be unavailable. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.folderRefused.outside` | The folder {path} was not chosen in this window. Choose it with the folder picker. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.projectNameRefused.not-a-name` | The project name is not text. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.projectNameRefused.empty` | A project needs a name. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.projectNameRefused.text-direction` | The project name contains a character that reverses the reading direction. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.projectNameRefused.control` | The project name contains a control character. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.scan.notKept` | This list was not saved, so it will not be here next time. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |

## Agent access (the hub) · 2026-10-04 (ADR-0115)

The consent prompt, the attention-queue row and Settings → Agent access, phrased from facts in
the operator's language (verification of 0.3.1, iteration 1, UX-2).

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `event.access.requested@1` | an agent asked for access to a product through Fabric | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `event.access.decided@1` | an access request was answered | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `event.access.credential.claimed@1` | an agent collected its binding credential | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `event.access.grant.revoked@1` | an agent’s access was revoked | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `event.access.binding.revoked@1` | all of an agent’s access was revoked | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `event.access.denial.cleared@1` | a denied access request was cleared | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `event.product.connected@1` | a product was connected to Fabric | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `event.product.connect.refused@1` | a product declined or failed to connect to Fabric | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `event.product.disconnected@1` | a product was disconnected from Fabric | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `needsYou.kind.access` | Access request | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `settings.agentAccess` | Agent access | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.title` | Agent access | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.close` | Close | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.what` | Agents registered on this computer can ask to use a connected product through Fabric. You decide once per request; Fabric checks every call against what you allowed and keeps the product’s key in the vault of Project Observatory. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.loading` | Reading agent access… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.unreadable` | Agent access could not be read. This is not a list with nothing in it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.retry` | Try again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.notDone` | Not done: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.hub.on` | Agents reach Fabric at {origin}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.products.connect` | Connect | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.disconnect` | Disconnect | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.reconnect` | Reconnect | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.connectedTo` | connected to | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.since` | since {since} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.notConnected` | not connected | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.waiting` | Waiting for your answer in {name}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.denied` | You declined the connection in {name}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.failed` | The last attempt failed: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.pending.title` | Waiting for your answer | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.pending.none` | No agent is waiting for an answer. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.pending.reason` | Its reason, in its own words: “{reason}” | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.agents.title` | Agents with access | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.agents.none` | No agent has access through Fabric. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.agents.until` | until {date} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.agents.revokeAll` | Revoke all | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.revoke` | Revoke | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.allow` | Allow | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.deny` | Deny | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.allowedHere` | Allowed | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.deniedHere` | Denied | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.denials.title` | Denied requests | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.denials.clear` | Clear the denial | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.hub.off` | Agents cannot reach Fabric right now. Sessions Fabric starts are not affected. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.hub.offDetail` | What Fabric saw: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.products.title` | Products | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.keyStays` | Fabric no longer uses its key for {name}. The key stays valid in {name} → Agent access until you revoke it there. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.tryAgain` | Try again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.agents.noGrants` | Nothing is allowed any more; its binding credential still identifies the agent. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.denials.none` | No request is denied. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.pending.expires` | expires in {minutes} min | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.pending.expiresSoon` | expires in under a minute | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.allowConnect` | Allow and connect {product} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.allowFor` | Allow {name} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.denyFor` | Deny {name} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.revokeFor` | Revoke for {name}: {line} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.revokeAllFor` | Revoke all for {name} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.clearFor` | Clear the denial for {name} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.allowedConnect` | Allowed. To connect it, open Agent access in settings. It did not connect: {problem} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.lasts` | Access lasts a year unless you revoke it under Agent access in settings. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.denyStands` | Deny keeps refusing this same request until you clear the denial in the list of denied requests under Agent access in settings. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | implemented; native acceptance pending |
| `access.denials.note` | Fabric refuses a denied request by itself each time the same agent asks for the same access again. Clearing the denial lets that agent ask you again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | implemented; native acceptance pending |
| `access.floor` | Fabric checked that an agent with this id is installed on this computer. Fabric cannot prove which program sent the request: any program running as you could use that id. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.incremental` | This agent already has access through Fabric; this adds to it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.origin.plain` | An agent registered as {id} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.origin.by` | An agent registered as {id} (installed by {by}) | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.origin.repo` | An agent registered as {id} (source {repo}) | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.origin.both` | An agent registered as {id} (installed by {by}; source {repo}) | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.queue.title` | {name} asks to use {product} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.list.and` | {items} and {last} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.ask.inside` | {verbs} in {resource} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.ask.setup` | set up the workspace: {verb} {resource} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.ask.setupExtra` | set up the workspace: when creating {resource}, also {verb} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.res.gmail` | the Gmail account {id} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.unknown` | use “{name}” (a tool Fabric does not know and cannot describe) | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.list_accounts` | see which mailboxes exist | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.list_messages` | list and search mail | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.search_mailbox` | search mail | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.list_mailbox_messages` | list a folder | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.read_message` | read mail | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.read_thread` | read conversations | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.get_attachment` | open attachments | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.list_folders` | see folders | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.get_send_status` | check what was sent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.save_draft` | save drafts | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.send_email` | send mail | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.reply` | reply to mail, which sends it | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.forward` | forward mail, which sends it | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.update_messages` | mark mail read or starred | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.move_messages` | move mail | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.mark_spam` | report mail as spam or not spam | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.delete_message` | delete mail for good | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.sync_account` | sync a Gmail account | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.manage_folder` | create, rename or remove folders | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.approve_rule_run` | approve what a rule is about to do, which can send mail | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.dismiss_rule_run` | dismiss what a rule was about to do | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.create_address` | create the address | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.send_test_message` | send a test message | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.create_address.forward_to` | forward a copy of its mail to an address the agent chooses | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.cap.create_address.reply_agent` | choose the reply agent that answers its mail; a reply agent can send mail | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.title` | Allow {name} to use {product}? | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.message` | {name} asks to use {product} through Fabric | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.asks` | {origin} asks to: | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.reasonLead` | Its reason, in its own words: | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.credential` | If you allow, the agent gets its own binding credential for Fabric. It reaches {product} only for what you allow and never sees {product}’s key. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.notConnected` | {product} is not connected to Fabric yet. “{allow}” also opens {product}, which asks you to connect it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.notify` | Open Fabric to allow or deny. It also waits in your queue. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.notRecordedTitle` | Not recorded | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.notRecorded` | Your answer was not recorded | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.connectTitle` | Allowed, not connected | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.prompt.ok` | OK | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.refused.not-found` | Fabric has nothing with that id any more; the list has been read again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.refused.already-decided` | That request was already answered. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.refused.expired` | That request expired before it was answered; the agent must ask again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.refused.asking-binding-revoked` | The access that asked for more has been revoked; the agent must ask again from the start. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.refused.not-live` | That access is not live any more; it was already revoked. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.refused.unavailable` | Fabric could not read or write agent access just now. Try again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.hub-off` | Fabric’s hub is not listening, so {name} would have nowhere to deliver its key. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.already-connected` | {name} is already connected; reconnect it to replace its key. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.busy` | A connection to {name} is already waiting for your answer there. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.live-unreadable` | Fabric could not read whether {name} is already connected. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.not-installed` | {name} could not be opened. Is its app installed? | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.no-flow` | Fabric has no way to connect {name} yet. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.late` | {name} answered after the 10-minute window. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.no-answer` | No answer came from {name} within 10 minutes. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.no_server` | {name} has no server set up yet. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.sign_in_required` | {name} needs you to sign in again; it has opened its sign-in. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.mint_failed` | {name} could not make the key. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.unknown` | {name} reported a failure Fabric does not recognise. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.invalid-delivery` | {name} delivered a key Fabric cannot use. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.record-failed` | Fabric could not record the connection, so {name} revokes the key. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.vault` | The vault of Project Observatory did not keep the key, so {name} revokes it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.deadline` | Fabric could not keep the key within the 10 seconds {name} waits, so {name} revokes it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.withdrawn` | Fabric recorded the key after {name} had stopped waiting, so it was withdrawn and {name} revokes it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.not-connected` | {name} is not connected. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.connect.previousLost` | The previous connection was already replaced, so {name} is not connected now; connect it again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |

| `event.hub.call.forwarded@1` | an agent’s call was passed to a product | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `event.hub.call.refusals.summarized@1` | an agent’s repeated calls that never reached a product were counted | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |
| `access.saw` | What Fabric saw: {detail} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.allowConnectFor` | Allow and connect {product} for {name} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.allowedConnectHere` | Allowed. Connect it in the products section above. {problem} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.queue.allowed` | You allowed {name} to use {product}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.queue.allowedNotConnected` | You allowed {name} to use {product}. To connect it, open Agent access in settings. It did not connect: {problem} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | implemented; native acceptance pending |
| `access.queue.denied` | You denied {name} access to {product}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.queue.enrolled` | You let {name} work in {project}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | implemented (CO-207) |
| `access.queue.enrollDenied` | You did not let {name} work in {project}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | implemented (CO-207) |
| `access.queue.enrollTitle` | {name} asks to work in {project} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | implemented (CO-207) |
| `access.products.waitingReconnect` | Waiting for your answer in {name}. Until a new key arrives, Fabric keeps using the current one. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.reconnected` | Fabric now uses the new key. The previous key stays valid in {name} → Agent access until you revoke it there. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.products.keptCurrent` | Fabric keeps using the current connection. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.denials.asked` | asked to {asks} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.prompt.quoted` | “{reason}” | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.connect.withdraw-failed` | Fabric recorded the key after {name} had stopped waiting and could not withdraw the record. {name} revokes that key, so this connection will not work: disconnect it, then connect again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.connect.vault-unavailable` | {name} cannot be connected on Windows yet: the vault of Project Observatory, which keeps its key, does not run here. Nothing was opened in {name}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | proposed |
| `access.hub.off.port-setting` | Correct or remove the hub port setting FABRIC_HUB_PORT (a port from 1024 to 65535), then quit and reopen Fabric. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.hub.off.port-claimed` | A registered agent claims the hub’s port. Move that agent to another port, or choose a free one for Fabric with FABRIC_HUB_PORT, then quit and reopen Fabric. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.hub.off.port-taken` | Another program holds the hub’s port. Close it, or choose a free port with FABRIC_HUB_PORT, then quit and reopen Fabric. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.hub.off.not-started` | The hub could not start. Quit and reopen Fabric to try again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | shipped |
| `access.notDoneGeneric` | Not done. Try again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 | shipped |

| `startup.schema-behind-recovery` | Stop all writers and make a verified backup first. Follow https://github.com/passioncode-ai/Fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database before running supabase migration up --local in {stackPath}, then retry. Fabric has not started its workspace services. | apps/desktop/src/main/schemaReadiness.ts | SCN-095 | proposed |

| `access.connect.connection-changed` | The connection to {name} changed while you were answering. Check its current state, then connect again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-133 | implemented; native acceptance pending |

## Target prototype scan checklist — CO-180

Surface: interface/prototype; ADR-0100 §3 and SCN-128 own the claim.
Humanization: on — own pass; concise labels and literal state messages, no rhetorical markers;
semantic check retains one repository per Project and explicit operator selection.

| Key | Text (Russian target) | Location | Scenario | Status |
|---|---|---|---|---|
| `prototype.scan.selection` | Выберите проекты, которые хотите добавить. | scripts/product/first-release.mjs:248 | SCN-128 | proposed |
| `prototype.scan.separate` | Каждая выбранная папка станет отдельным проектом. | scripts/product/first-release.mjs:248 | SCN-128 | proposed |
| `prototype.scan.add` | Добавить выбранные проекты | scripts/product/first-release.mjs:248 | SCN-128 | proposed |

These strings belong to the target prototype. These scan labels do not change native counterparts; the prototype does not claim provider/native acceptance. Native CO-176 sign-in labels are registered separately below.

## First-run sign-in observation — CO-176

Surface: first-run interface; SCN-126. Source facts: the supported vendor CLI result is a boolean status, not account identity or permission. Unknown/unsupported remain visible and Continue stays available while checking; it reads “Continue without an agent” only once the agents are read and none can be picked (0.3.5 review UX-15). On Windows and Linux the line names the system, not the agent's version (`unsupportedOs`, 0.3.5 review UX-7). Humanization: on, own concise factual pass. EN/RU registries own the exact localized strings.

| Key | Location | Scenario | Status |
|---|---|---|---|
| `start.executor.auth.authenticated` | apps/desktop/src/renderer/src/i18n/en.ts; ru.ts | SCN-126 | implemented locally; packaged acceptance pending |
| `start.executor.auth.notAuthenticated` | apps/desktop/src/renderer/src/i18n/en.ts; ru.ts | SCN-126 | implemented locally; packaged acceptance pending |
| `start.executor.auth.unsupported` | apps/desktop/src/renderer/src/i18n/en.ts; ru.ts | SCN-126 | implemented locally; packaged acceptance pending |
| `start.executor.auth.unsupportedOs` | apps/desktop/src/renderer/src/i18n/en.ts; ru.ts | SCN-126 | proposed |
| `start.executor.auth.unknown` | apps/desktop/src/renderer/src/i18n/en.ts; ru.ts | SCN-126 | implemented locally; packaged acceptance pending |
| `start.executor.auth.note` | apps/desktop/src/renderer/src/i18n/en.ts; ru.ts | SCN-126 | implemented locally; packaged acceptance pending |

## 0.3.3 UI pass — the launch chrome, the exposure warning and the main process in Russian (2026-10-08)

Written through `copywriting` against `voice.md` (peer-builder) and `locales/ru.md` («вы», neutral form).
Titles carry no full stop; a dialog's message is a heading. Commands are set as code with a copy button,
never as prose with markup. The screen rules are in [`screens.md` → launch chrome](../ux/screens.md#launch-chrome).
Also new, and reviewed as labels rather than copy: `harness.agent.*` and `harness.tool.*` (what a session is
given, from the registry instead of the shared contract’s English), the ten causes’ `startup.<cause>.title` and
`.remedy`, the seven `dialog.*` picker messages, and `menu.*` — the application menu, where the English keeps
the macOS title-case convention for menu items, the one recorded exception to sentence case. `diagnostics.exposure.dockerBefore` names a pane in
Docker Desktop’s own interface (“Settings → Docker Engine”) and is a path, not our wording, so it has no row:
`terminology.md` has no entry for OrbStack, Docker Desktop or Docker Engine, and the sentence-case check reads
their capitals as title case. Adding those names is `brand-voice`’s decision (reported 2026-10-08).

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `diagnostics.exposure.title` | The local database can be reached from your network | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `diagnostics.exposure.body` | Ports {ports} answer on {ifaces} with the stack’s default password, so anyone on this network can read and change your projects. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `diagnostics.exposure.orbstackAfter` | Then restart the engine and Fabric. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `diagnostics.exposure.dockerAfter` | Then restart the engine. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `diagnostics.exposure.why` | Why Fabric does not close this itself | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `diagnostics.exposure.whyBody` | Which addresses a container port listens on is set by the container engine, for every container on it at once. Fabric cannot change that for its own containers alone. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `launch.profile` | Profile | apps/desktop/src/renderer/src/i18n/en.ts | SCN-094 | proposed |
| `launch.strip.reading` | Reading the journal… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-094 | proposed |
| `launch.strip.estate` | Last event · {time} · all projects | apps/desktop/src/renderer/src/i18n/en.ts | SCN-094 | proposed |
| `launch.strip.estateNone` | Nothing recorded yet · all projects | apps/desktop/src/renderer/src/i18n/en.ts | SCN-094 | proposed |
| `launch.agent.subtitle` | {agent} · filed {date} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-094 | proposed |
| `harness.unavailable` | not installed | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | proposed |
| `harness.modeBlocked` | {mode} (unavailable) | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | proposed |
| `agent.modeShort.plan` | plan only | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | proposed |
| `agent.modeShort.ask` | ask first | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | proposed |
| `agent.modeShort.bypass` | no prompts | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | proposed |
| `startup.windowTitle` | Fabric could not start | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `startup.notRetryable` | Fabric had already opened its agent surface when this happened, so retrying in place is not safe; reopen the app instead. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `startup.retry` | Retry | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `startup.copy` | Copy the details | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `startup.quit` | Quit | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `dialog.scanChoose` | Choose the folder that holds your projects | apps/desktop/src/renderer/src/i18n/en.ts | SCN-031 | proposed |
| `start.facts.summary` | What its repository says | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | proposed |
| `tasks.presetSetup` | Set up this project with the agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-032 | proposed |
| `start.scan.setUpFirst` | Set up {name} with the agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | proposed |

## 0.3.3 onboarding — four actions (2026-10-08)

The start menu and the two agent paths ([brief](../evidence/plans/2026-10-08-onboarding-four-actions.md)). The build and adapt instructions
(`start.createAgent.instruction`, `start.convertAgent.instruction`) are read by a coding agent, not by the person, and carry the skill names verbatim.

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `start.pair.agentBody` | Your coding agent builds and adapts agents in its own console; Fabric prepares the folder and the project and opens that console. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | proposed |
| `start.card.agent.title` | Create an agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.card.convert.title` | Adapt an existing agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | proposed |
| `start.card.open.title` | Open a project | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | proposed |
| `start.card.new.title` | Create a project | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | proposed |
| `start.createAgent.lede` | Fabric makes its folder and project, then opens your coding agent's console; the agent asks the rest there, one question at a time. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.create` | Create and open the console | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.what` | Fabric creates the folder as a git repository and a project for it, and writes no file inside: the coding agent writes them after you answer its questions. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.convert.lede` | An agent built outside Fabric is adapted to the Fabric protocol. Your coding agent does the work in its own console, on a branch of its own. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | proposed |
| `start.convert.start` | Start the adaptation | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | proposed |
| `start.convert.nothingWritten` | Fabric itself writes nothing in this folder; everything is done by the coding agent, on its own branch, after you agree to its plan. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | proposed |
| `start.builder.label` | Which coding agent does the work | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.skills.missing` | {agent} does not have the Fabric Agent Adapter skills yet. Install them with one command, then check again: | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.nameEmpty` | Give the agent a name; its folder gets the same one. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.nameInvalid` | This name cannot be a folder name: {detail}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.whereEmpty` | Choose where its folder goes. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.made` | Created: | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.madeKept` | The folder {path} is already made, and the next try continues with it and its project. To choose another name, sentence or place, start over; what this try made stays, the folder on disk and its project among your projects. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.retry` | Try again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.startOver` | Start over | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.failed` | The agent was not created: {reason}. Try again: what this attempt already made is reused, never made twice. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.builder.noneReady` | No coding agent on this computer can start right now: | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.skills.notCovered` | The command does not install them for {agent}: put the skills where {agent} reads them, or choose another coding agent. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.convert.notGit` | This folder is not a git repository yet: the coding agent makes it one and commits it as it is before changing anything, keeping anything that looks like a secret out of the commit, so the original can be restored. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | proposed |
| `start.builder.fromOrder` | Chosen: the first one in your fallback order. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.builder.fromFound` | Chosen: the first coding agent found that connects to the tools of Fabric, or the first found. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.builder.orderUnread` | Your fallback order could not be read, so the first coding agent found that connects to the tools of Fabric, or the first found, is chosen. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.builder.another` | Use another coding agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.builder.anotherNote` | The task given to the first one is cancelled on the project's board, unless its session is already running. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.blocked.agent` | Choose a coding agent that can start. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.blocked.skills` | Install the Fabric Agent Adapter skills first, then check again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.blocked.checking` | Wait for the skills check to finish. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.pickFailed` | The folder picker did not open: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.consoleNotOpened` | The coding agent's session is running, but its console did not open: {reason}. “{retry}” opens it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.createAgent.madeKeptFolder` | The folder {path} is already made, and the next try continues in it. To choose another name, sentence or place, start over; the folder stays on disk. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.skills.unreadable` | These files are there but could not be read; check their permissions: | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.taskRefused.not-an-id` | The task's id was refused. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.taskRefused.other-project` | This task belongs to another project. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.taskRefused.read-failed` | The task could not be read before starting it: {detail} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.purposeFromRepo` | From {file}: {text} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | proposed |
| `tasks.presetNeedsSurface` | {agent} has no connection to the tools of Fabric, so it could record nothing of this setup. Choose an agent that has one. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-032 | proposed |
| `analytics.notice.sentBefore` | An earlier version may already have sent these counts from this computer, from its first start. Nothing more is sent until you answer. Your choice is the one switch every PassionCode.ai app on this computer reads, and you can change it later in the settings. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-134 | proposed |
| `settings.fallback.upFor` | Move {agent} up | apps/desktop/src/renderer/src/i18n/en.ts | SCN-135 | proposed |
| `settings.fallback.downFor` | Move {agent} down | apps/desktop/src/renderer/src/i18n/en.ts | SCN-135 | proposed |
| `settings.fallback.removeFor` | Remove {agent} from the order | apps/desktop/src/renderer/src/i18n/en.ts | SCN-135 | proposed |
| `start.taskRefused.setup-needs-surface` | This setup records through the tools of Fabric, and the chosen coding agent has no connection to them. Choose an agent that has one. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-032 | proposed |
| `start.abandoned.startOver` | Left when the person started over with another name or place. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `start.abandoned.anotherAgent` | Replaced by a task for another coding agent. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `first.exec.copyWhat` | Copy for {what} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-073 | proposed |
| `start.taskRefused.setup-surface-down` | This setup records through the tools of Fabric, and the agent surface that gives them is not running. Start it in the settings, then try again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-032 | proposed |
| `start.abandoned.notCancelled` | The earlier task could not be cancelled on the board: {reason}. Close it there by hand. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-136 | proposed |
| `analytics.notice.nothingYet` | Nothing has been sent yet. Your choice is the one switch every PassionCode.ai app on this computer reads, and you can change it later in the settings. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-134 | proposed |

## 0.3.4 — the identity refusal at startup (2026-10-10)

The startup dialog's eleventh cause ([ADR-0131](../adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md),
0.3.4 verification, iteration 1, UX-1). Until 0.3.4 an identity refusal fell to `startup.unknown` ("could not work
out why") for a cause the app had already named. It says what is true and what Fabric did not do; the repair's reason
is in the details, which keep the English a report is read in. Written through `copywriting` against `voice.md`
(error register: no humour, one next step) and `locales/ru.md` («вы»); «пространство» is the Russian Estate.

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `startup.identity-refused.title` | Fabric does not have access to the Estate it was opening | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.identity-refused.remedy` | Fabric runs as the owner of your Estate, and this database does not name that owner. Fabric never makes itself the owner of an Estate, except an untouched one it set up itself; the details below say what it read. If they say something could not be read, retry first; otherwise copy them and report them at https://github.com/passioncode-ai/Fabric/issues. Fabric has changed nothing in the Estate. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |

## A coding agent enrolls into a project · 2026-10-11 (ADR-0134)

The consent a coding agent opened outside Fabric asks to work in one project: the native prompt, the attention-queue
row, the request card, the grant and the denial in Settings → Agent access (SCR-76), and the feed. Fixed after the
0.4.0 wave 1 blind reviews: no surface shows `session.enroll`, `project:<uuid>`, "registered as" or "connect" — an
enrollment's Allow is only Allow, because Fabric itself has no connect flow; the agent is "a coding agent", never a
registry id; the folder is Fabric's own line, apart from the agent's quoted reason; the same-user floor is said of the
name the agent asked under, without the registry-install claim of `access.floor`, which no enrollment ever checks; and
how long the grant lasts is said. Facts phrased by `shared/accessWords.ts#sayRequest`, the same for the card and the
queue; the prompt by `accessWords.ts#consentPrompt`. Russian: «агент для кода», «вы», the project's name in «».
Humanization: on — own pass (copywriting, consent register: no humour, one action one name, no decorative full stop on
labels); each line states one fact or one consequence. The scenario id is provisional until the enrollment scenario
lands beside SCN-132.

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `access.enroll.title` | Let {name} work in {project}? | apps/desktop/src/renderer/src/i18n/en.ts:1005 | SCN-132 (enrollment) | proposed |
| `access.enroll.message` | {name}, opened outside Fabric, asks to work in {project} | apps/desktop/src/renderer/src/i18n/en.ts:1006 | SCN-132 (enrollment) | proposed |
| `access.enroll.what` | It gets what a session Fabric starts gets, in {project} only: the project’s context, its tasks, board and memory, and a record of its work. | apps/desktop/src/renderer/src/i18n/en.ts:1007 | SCN-132 (enrollment) | proposed |
| `access.enroll.revoke` | Every later session of {name} in {project} joins without asking, for a year, unless you revoke it under Agent access in settings. | apps/desktop/src/renderer/src/i18n/en.ts:1008 | SCN-132 (enrollment) | proposed |
| `access.enroll.thisProject` | this project | apps/desktop/src/renderer/src/i18n/en.ts:1009 | SCN-132 (enrollment) | proposed |
| `access.enroll.projectNamed` | {name} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-132 (enrollment) | proposed |
| `access.enroll.floor` | Fabric cannot prove this is {name}: any program running as you can ask under that name. | apps/desktop/src/renderer/src/i18n/en.ts:1010 | SCN-132 (enrollment) | proposed |
| `access.enroll.folder` | In the folder {root} | apps/desktop/src/renderer/src/i18n/en.ts:1011 | SCN-132 (enrollment) | proposed |
| `access.enroll.folderInside` | In a folder inside {root} | apps/desktop/src/renderer/src/i18n/en.ts:1012 | SCN-132 (enrollment) | proposed |
| `access.enroll.folderWorktree` | In a worktree of the repository {root} | apps/desktop/src/renderer/src/i18n/en.ts:1013 | SCN-132 (enrollment) | proposed |
| `access.origin.coding` | A coding agent: {name} | apps/desktop/src/renderer/src/i18n/en.ts:1014 | SCN-132 (enrollment) | proposed |
| `access.ask.enroll` | work in {project} | apps/desktop/src/renderer/src/i18n/en.ts:1015 | SCN-132 (enrollment) | proposed |
| `access.ask.enrollThis` | work in this project | apps/desktop/src/renderer/src/i18n/en.ts:1016 | SCN-132 (enrollment) | proposed |
| `access.grant.enroll` | works in {project} | apps/desktop/src/renderer/src/i18n/en.ts:1017 | SCN-132 (enrollment) | proposed |
| `access.grant.enrollGone` | works in a project that is no longer in your list | apps/desktop/src/renderer/src/i18n/en.ts:1018 | SCN-132 (enrollment) | proposed |
| `access.grant.enrollUnread` | works in a project whose name could not be read | apps/desktop/src/renderer/src/i18n/en.ts:1019 | SCN-132 (enrollment) | proposed |
| `access.queue.enrollTitle` | {name} asks to work in {project} | apps/desktop/src/renderer/src/i18n/en.ts:1128 | SCN-132 (enrollment) | proposed |
| `access.queue.enrolled` | You let {name} work in {project}. | apps/desktop/src/renderer/src/i18n/en.ts:1126 | SCN-132 (enrollment) | proposed |
| `access.queue.enrollDenied` | You did not let {name} work in {project}. | apps/desktop/src/renderer/src/i18n/en.ts:1127 | SCN-132 (enrollment) | proposed |
| `event.session.enrolled@1` | a coding agent opened outside Fabric joined the project | apps/desktop/src/renderer/src/i18n/en.ts:1204 | SCN-132 (enrollment) | proposed |

The existing `access.allow`, `access.allowFor`, `access.deny`, `access.denyFor`, `access.denials.asked`,
`access.agents.until`, `access.revokeFor`, `access.prompt.reasonLead`, `access.prompt.quoted`, `access.pending.reason`
and `access.denyStands` rows above carry an enrollment unchanged. Changed in Russian only: the slot `{project}` of the
Russian enrollment sentences carries its own preposition — `access.enroll.projectNamed` is «в проекте «{name}»» and
`access.enroll.thisProject` is «в этом проекте» — so a project whose name is not known reads as "this project" in both
languages, never «без названия», which claimed the project had no name (0.3.5 review UX-12); and
`event.session.enrolled@1` says «присоединился», not «подключился».

**Claims and «Where work is», added 2026-10-11 (0.4.0 wave 2: REQ-38, REQ-08, CO-256; SCN-140, SCN-141).** The project
page's «Who is working on what» (SCR-31: one row per claim, «related» on both rows of a pair, «Release…» behind the
row's … menu with its confirmation, agent-sync's leases read-only beneath) and the manager's «Where work is» (SCR-78:
per project its sessions, claims, review queue and last sign of life; the idle projects counted; the last row,
«Sessions with no project», always shown). Voice: peer-builder, a state said as a fact — a claim is never "working" past
its expiry («no sign since <time>») or after its session ended («lapsed: the session ended»); an unread list says it
could not read, never "nobody". The release confirmation names the agent and the task and what follows (the agent is
told on its next call); Cancel is focused. Russian: «заявка» for a claim (the CONTEXT.md term «Claim»), «снять» for
release, «агент для кода», «вы»-neutral forms. The three feed sentences describe the new event types. Humanization: own
pass (copywriting, interface register: one action one name, no decorative full stop on labels).

| Key | Text (primary) | Location | Scenario | Status |
|---|---|---|---|---|
| `event.task.source.linked@1` | a task was linked to its backlog row | apps/desktop/src/renderer/src/i18n/en.ts:1200 | SCN-140 | proposed |
| `event.work.handover.requested@1` | an agent asked for a task another agent holds | apps/desktop/src/renderer/src/i18n/en.ts:1201 | SCN-140 | proposed |
| `event.session.turn.observed@1` | a coding agent finished a turn: its commit and change counts were recorded | apps/desktop/src/renderer/src/i18n/en.ts:1202 | SCN-140 (session hooks) | proposed |
| `launch.nav.where` | Where work is | apps/desktop/src/renderer/src/i18n/en.ts:2151 | SCN-141 | proposed |
| `glyph.more` | … | apps/desktop/src/renderer/src/i18n/en.ts:2152 | SCN-140 | proposed |
| `harness.tool.fabric_work_list` | Who is working on what in this project: claims, sessions, open tasks, agent-sync leases | apps/desktop/src/renderer/src/i18n/en.ts:2153 | SCN-140 | proposed |
| `harness.tool.fabric_work_claim` | Claim your task before you start, and hear about related work others hold | apps/desktop/src/renderer/src/i18n/en.ts:2154 | SCN-140 | proposed |
| `harness.tool.fabric_work_release` | End a claim (done, handed over or let go), or every claim of this session | apps/desktop/src/renderer/src/i18n/en.ts:2155 | SCN-140 | proposed |
| `harness.tool.fabric_session_observe` | A turn’s commit and change counts, or the session’s end, from the session hooks; never content | apps/desktop/src/renderer/src/i18n/en.ts:2156 | SCN-140 (session hooks) | proposed |
| `work.cameIn.launched` | launched by Fabric | apps/desktop/src/renderer/src/i18n/en.ts:2157 | SCN-140 | proposed |
| `work.cameIn.enrolled` | enrolled from a terminal | apps/desktop/src/renderer/src/i18n/en.ts:2158 | SCN-140 | proposed |
| `work.cameIn.handed-off` | handed off from another product | apps/desktop/src/renderer/src/i18n/en.ts:2159 | SCN-140 | proposed |
| `work.cameIn.hub` | through the hub | apps/desktop/src/renderer/src/i18n/en.ts:2160 | SCN-140 | proposed |
| `work.cameIn.unknown` | came in by an unknown way | apps/desktop/src/renderer/src/i18n/en.ts:2161 | SCN-140 | proposed |
| `work.why.sameRow` | the same backlog row, {row} | apps/desktop/src/renderer/src/i18n/en.ts:2162 | SCN-140 | proposed |
| `work.why.linked` | linked: {rel} | apps/desktop/src/renderer/src/i18n/en.ts:2221 | SCN-140 | proposed |
| `work.rel.blocks.from` | this task blocks it | apps/desktop/src/renderer/src/i18n/en.ts:2222 | SCN-140 | proposed |
| `work.rel.blocks.to` | it blocks this task | apps/desktop/src/renderer/src/i18n/en.ts:2223 | SCN-140 | proposed |
| `work.rel.follows.from` | this task follows it | apps/desktop/src/renderer/src/i18n/en.ts:2224 | SCN-140 | proposed |
| `work.rel.follows.to` | it follows this task | apps/desktop/src/renderer/src/i18n/en.ts:2225 | SCN-140 | proposed |
| `work.rel.spawned.from` | this task started it | apps/desktop/src/renderer/src/i18n/en.ts:2226 | SCN-140 | proposed |
| `work.rel.spawned.to` | it started this task | apps/desktop/src/renderer/src/i18n/en.ts:2227 | SCN-140 | proposed |
| `work.rel.other` | linked | apps/desktop/src/renderer/src/i18n/en.ts:2228 | SCN-140 | proposed |
| `work.task.untitled` | untitled task | apps/desktop/src/renderer/src/i18n/en.ts:2229 | SCN-140 | proposed |
| `work.why.overlap` | {mine} overlaps {theirs} | apps/desktop/src/renderer/src/i18n/en.ts:2164 | SCN-140 | proposed |
| `work.who.title` | Who is working on what | apps/desktop/src/renderer/src/i18n/en.ts:2165 | SCN-140 | proposed |
| `work.who.reading` | Reading who is working here… | apps/desktop/src/renderer/src/i18n/en.ts:2166 | SCN-140 | proposed |
| `work.who.unreadable` | Fabric could not read who is working here. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.who.none` | Nobody is working in this project right now. | apps/desktop/src/renderer/src/i18n/en.ts:2168 | SCN-140 | proposed |
| `work.who.lastSign` | last sign {ago} ago | apps/desktop/src/renderer/src/i18n/en.ts:2169 | SCN-140 | proposed |
| `work.who.silent` | no sign since {at} | apps/desktop/src/renderer/src/i18n/en.ts:2170 | SCN-140 | proposed |
| `work.who.lapsed` | lapsed: the session ended | apps/desktop/src/renderer/src/i18n/en.ts:2171 | SCN-140 | proposed |
| `work.who.open` | Open session | apps/desktop/src/renderer/src/i18n/en.ts:2172 | SCN-140 | proposed |
| `work.who.outside.enrolled` | runs in a terminal outside Fabric | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.who.outside.other` | runs outside Fabric; no console here | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.who.unclaimed` | no task claimed | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.who.more` | More actions for this claim | apps/desktop/src/renderer/src/i18n/en.ts:2173 | SCN-140 | proposed |
| `work.who.release` | Release… | apps/desktop/src/renderer/src/i18n/en.ts:2174 | SCN-140 | proposed |
| `work.who.by` | {agent}, {how} | apps/desktop/src/renderer/src/i18n/en.ts:2175 | SCN-140 | proposed |
| `work.who.since` | for {ago} | apps/desktop/src/renderer/src/i18n/en.ts:2176 | SCN-140 | proposed |
| `work.who.source` | backlog row {id} in {path} | apps/desktop/src/renderer/src/i18n/en.ts:2177 | SCN-140 | proposed |
| `work.who.touches` | touches {list} | apps/desktop/src/renderer/src/i18n/en.ts:2178 | SCN-140 | proposed |
| `work.who.related` | related | apps/desktop/src/renderer/src/i18n/en.ts:2179 | SCN-140 | proposed |
| `work.who.relatedTo` | related to {task}: {why} | apps/desktop/src/renderer/src/i18n/en.ts:2180 | SCN-140 | proposed |
| `work.who.heldChip` | held | apps/desktop/src/renderer/src/i18n/en.ts:2181 | SCN-140 | proposed |
| `work.who.held` | {task}: held by the session Fabric launched for it | apps/desktop/src/renderer/src/i18n/en.ts:2182 | SCN-140 | proposed |
| `work.release.title` | Release this claim? | apps/desktop/src/renderer/src/i18n/en.ts:2183 | SCN-140 | proposed |
| `work.release.body` | {agent} stops holding {task} now and is told on its next call. | apps/desktop/src/renderer/src/i18n/en.ts:2184 | SCN-140 | proposed |
| `work.release.confirm` | Release | apps/desktop/src/renderer/src/i18n/en.ts:2185 | SCN-140 | proposed |
| `work.release.failed.not-found` | That claim is no longer there. | apps/desktop/src/renderer/src/i18n/en.ts:2186 | SCN-140 | proposed |
| `work.release.failed.already-released` | That claim was already released. | apps/desktop/src/renderer/src/i18n/en.ts:2187 | SCN-140 | proposed |
| `work.release.failed.unconfirmed` | The release could not be confirmed. The list below is read again. | apps/desktop/src/renderer/src/i18n/en.ts:2188 | SCN-140 | proposed |
| `work.leases.title` | agent-sync leases on this repository, read-only | apps/desktop/src/renderer/src/i18n/en.ts:2189 | SCN-140 | proposed |
| `work.leases.unread` | agent-sync leases could not be read: {reason}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.leases.noOrigin` | This repository has no remote, so it carries no agent-sync leases. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.leases.why.not-listable` | the remote is not an https or ssh address, and Fabric reads no other kind | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.leases.why.remote-unreadable` | the repository's remote could not be found out | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.leases.why.timeout` | the remote did not answer within 8 s | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.leases.why.too-large` | the answer was larger than Fabric reads | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.leases.why.refused` | the remote refused or could not be reached | apps/desktop/src/renderer/src/i18n/en.ts | SCN-140 | proposed |
| `work.leases.none` | No agent-sync lease is held on this repository. | apps/desktop/src/renderer/src/i18n/en.ts:2191 | SCN-140 | proposed |
| `work.leases.more` | More leases are held than Fabric reads. | apps/desktop/src/renderer/src/i18n/en.ts:2192 | SCN-140 | proposed |
| `work.where.title` | Where work is | apps/desktop/src/renderer/src/i18n/en.ts:2193 | SCN-141 | proposed |
| `work.where.lede` | Every project with work in flight: its sessions, its claims, its review queue and its last sign of life. | apps/desktop/src/renderer/src/i18n/en.ts:2194 | SCN-141 | proposed |
| `work.where.reading` | Reading where work is… | apps/desktop/src/renderer/src/i18n/en.ts:2195 | SCN-141 | proposed |
| `work.where.unreadable` | Fabric could not read where work is. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-141 | proposed |
| `work.where.nothing` | No project has work in flight right now. | apps/desktop/src/renderer/src/i18n/en.ts:2197 | SCN-141 | proposed |
| `work.where.lastSign` | last sign {ago} ago | apps/desktop/src/renderer/src/i18n/en.ts:2198 | SCN-141 | proposed |
| `work.where.noSign` | no sign of life yet | apps/desktop/src/renderer/src/i18n/en.ts:2199 | SCN-141 | proposed |
| `work.where.sessions` | Sessions | apps/desktop/src/renderer/src/i18n/en.ts:2200 | SCN-141 | proposed |
| `work.where.claims` | Claims | apps/desktop/src/renderer/src/i18n/en.ts:2201 | SCN-141 | proposed |
| `work.where.noneCol` | none | apps/desktop/src/renderer/src/i18n/en.ts:2202 | SCN-141 | proposed |
| `work.where.active` | active | apps/desktop/src/renderer/src/i18n/en.ts:2203 | SCN-141 | proposed |
| `work.where.quiet` | quiet | apps/desktop/src/renderer/src/i18n/en.ts:2204 | SCN-141 | proposed |
| `work.where.stale` | no sign for {minutes} min | apps/desktop/src/renderer/src/i18n/en.ts:2205 | SCN-141 | proposed |
| `work.where.review` | In review | apps/desktop/src/renderer/src/i18n/en.ts:2207 | SCN-141 | proposed |
| `work.where.reviewUnread` | not read | apps/desktop/src/renderer/src/i18n/en.ts:2208 | SCN-141 | proposed |
| `work.where.reviewCount` | {count} in review | apps/desktop/src/renderer/src/i18n/en.ts:2209 | SCN-141 | proposed |
| `work.where.idle` | More projects with nothing in flight: {count} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-141 | proposed |
| `work.where.unowned` | Sessions with no project | apps/desktop/src/renderer/src/i18n/en.ts:2211 | SCN-141 | proposed |
| `work.where.unownedNone` | none | apps/desktop/src/renderer/src/i18n/en.ts:2212 | SCN-141 | proposed |
| `work.where.readAt` | Read at {at} | apps/desktop/src/renderer/src/i18n/en.ts:2213 | SCN-141 | proposed |

### The 0.3.5 release review, iteration 1 · 2026-10-12 (UX-1, UX-10, UX-11, UX-12, UX-13, ER-10)

Humanization: on — own pass (copywriting, peer-builder; notice register: says what happened and what to do). A failure
is said in the operator's language and the machine's words go on a secondary line beneath it (or behind the status
cell, on hover), never inside the sentence (UX-10). A count is "label: {count}", never a plural Fabric cannot form
(UX-13). Comms names a reply's message by its sender and first words, never its id (UX-11); in Russian the estate is
«пространство» (UX-12).

| Key | English | Location | Scenario | Status |
|---|---|---|---|---|
| `launch.comms.unavailable` | The board did not answer. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-143 | proposed |
| `launch.comms.messageCount` | messages: {count} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-143 | proposed |
| `launch.comms.replyTo` | answers {sender}: “{words}” | apps/desktop/src/renderer/src/i18n/en.ts | SCN-143 | proposed |
| `launch.comms.replyToFrom` | answers a message from {sender} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-143 | proposed |
| `launch.comms.replyToEarlier` | answers an earlier message | apps/desktop/src/renderer/src/i18n/en.ts | SCN-143 | proposed |
| `estate.quotaUnavailable` | The quota could not be read. This says nothing about the account itself. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-070 | proposed |
| `status.quotaUnreadable` | quota could not be read | apps/desktop/src/renderer/src/i18n/en.ts | SCN-070 | proposed |
| `history.pending.unread` | Fabric could not read which restores are waiting for a result. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-065 | proposed |
| `history.restoredList.unread` | Fabric could not read which estates this computer restored for you. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-065 | proposed |

### A `fabric://` link opened from a product's Fabric button · 2026-10-12 (SCN-142, contract DEC-0040)

Humanization: on — own pass (copywriting, notice register: plain, no humour, says what happened and the next step).

| Key | English | Location | Scenario | Status |
|---|---|---|---|---|
| `links.notice.conversation-soon` | Opened from a product's Fabric button. The conversation with Fabric about this product is not built yet; until then, start a session here. | apps/desktop/src/renderer/src/i18n/en.ts:2201 | SCN-142 | proposed |
| `links.notice.start-session` | Opened from a product's Fabric button to start a session in this project. Choose a coding agent and start it here. | apps/desktop/src/renderer/src/i18n/en.ts:2202 | SCN-142 | proposed |
| `links.notice.link-refused` | A Fabric link was not opened: it was not one Fabric reads, or it carried something a link never carries. | apps/desktop/src/renderer/src/i18n/en.ts:2203 | SCN-142 | proposed |
| `links.notice.project-unknown` | A Fabric link named a project that is not in your list. Open or add it, then follow the link again. | apps/desktop/src/renderer/src/i18n/en.ts:2204 | SCN-142 | proposed |
| `links.notice.service-unknown` | A Fabric link came from a product that is not registered on this computer, so Fabric could not find its project. | apps/desktop/src/renderer/src/i18n/en.ts:2205 | SCN-142 | proposed |
| `links.notice.service-in-no-project` | A Fabric link came from a product whose repository is in none of your projects. Add its repository to a project, then follow the link again. | apps/desktop/src/renderer/src/i18n/en.ts:2206 | SCN-142 | proposed |
| `links.notice.service-in-many-projects` | A Fabric link came from a product whose repository is in more than one project, so Fabric did not guess. Open the project you meant from the list. | apps/desktop/src/renderer/src/i18n/en.ts:2207 | SCN-142 | proposed |
| `links.notice.link-unreadable` | Fabric could not read your projects to open this link. Try again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-142 | proposed |
| `startup.schema-not-ready.unverified.timeout` | Fabric asked the database for its schema version and got no answer in time. Check that Docker and the local stack are running, then retry. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.schema-not-ready.unverified.transport` | Fabric could not reach the database to read its schema version. Check that Docker and the local stack are running, then retry. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.schema-not-ready.unverified.backend-error` | The database is running but answered the schema check with an error, so it may be older than this build. Make a verified backup, then follow “Upgrading an existing database” in the release guide, and retry. Fabric has not started its workspace services. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.schema-not-ready.unverified.not-an-integer` | The database answered the schema check with something that is not a schema version, so it may not be the database Fabric set up. If SUPABASE_URL is set in this environment, check where it points, then retry. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.supabase-cli-missing.remedy.win32` | Install it with scoop: scoop bucket add supabase https://github.com/supabase/scoop-bucket.git, then scoop install supabase. Then open Fabric again. If it is already installed, it lives somewhere this app does not look: start Fabric from a terminal to confirm. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.supabase-cli-missing.remedy.linux` | Install it from the Supabase CLI releases: a .deb, .rpm or .apk package at https://github.com/supabase/cli/releases. Then open Fabric again. If it is already installed, it lives somewhere this app does not look: start Fabric from a terminal to confirm. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.stack-start-timed-out.remedy.win32` | This is almost always Docker: check that Docker Desktop is running with its WSL 2 engine and has finished starting, then retry. A first-ever start also has images to download, and that can genuinely take longer. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.stack-start-timed-out.remedy.linux` | This is almost always Docker: check that Docker Engine is running (systemctl status docker) and that your user may use it, then retry. A first-ever start also has images to download, and that can genuinely take longer. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.stack-would-not-start.remedy.win32` | The stack’s own words are below and they are usually specific. If they mention Docker, start Docker Desktop and retry; if a port is taken, supabase stop releases it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.stack-would-not-start.remedy.linux` | The stack’s own words are below and they are usually specific. If they mention Docker, start Docker Engine (sudo systemctl start docker) and retry; if a port is taken, supabase stop releases it. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.repository-not-found.remedy.win32` | Set FABRIC_REPO to a checkout of the Fabric repository, then open Fabric again. Fabric installed with its Windows installer carries its own stack and needs no checkout. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `startup.repository-not-found.remedy.linux` | Set FABRIC_REPO to a checkout of the Fabric repository, then open Fabric again. Fabric installed from its AppImage or .deb package carries its own stack and needs no checkout. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-095 | proposed |
| `links.offer.body` | A product's Fabric button was pressed while the first run was open. It waited for you. | apps/desktop/src/renderer/src/i18n/en.ts:2208 | SCN-142 | proposed |
| `links.offer.open` | Open it | apps/desktop/src/renderer/src/i18n/en.ts:2209 | SCN-142 | proposed |
