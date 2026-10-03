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
| `first.persona.lede` | Fabric runs your projects with the coding agents you already use. Give it a name and a face. That changes how Fabric looks, never what it may do. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.name` | Name | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.nameHint` | Leave it empty to keep “Fabric”. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.tooLong` | At most {max} characters. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.notSaved` | The look was not saved: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.persona.continueAnyway` | Continue without saving | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.title` | Which coding agents can work here | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.lede` | Fabric does not write code itself: it hands work to a coding agent on this Mac and keeps the record. It looked for the ones it can run. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.checking` | Looking for coding agents… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.failed` | The check did not run: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.found` | Installed · version {version} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.unresponsive` | Installed, but `{program} --version` did not answer. Run `{program}` once in a terminal to finish its setup, then check again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.missing` | Not installed. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.state.found` | ready | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.state.unresponsive` | needs setup | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.state.missing` | not installed | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.copy` | Copy | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.copied` | Copied | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.note` | Found means the program is on this Mac. Whether your account signs in is checked the first time an agent starts. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.recheck` | Check again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.continueWithout` | Continue without an agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.start.title` | Where shall {name} start? | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.start.lede` | Pick one. The others stay one click away under + Project in the sidebar. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.start.later` | Not now, take me home | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.kicker` | Start | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.home` | Home | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.back` | Back | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.planned` | Planned | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.menu.title` | Where does the work come from? | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.menu.lede` | A Project is the durable unit: its sources, agents, decisions and evidence live together. Bring one, many, or start from nothing. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.add.mark` | + | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.add.title` | Add a project | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.add.body` | A folder you already work in becomes a Project. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.add.meta` | One folder | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.scan.mark` | ≡ | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.scan.title` | Scan a projects folder | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.scan.body` | Find every repository in a folder and tick the ones to bring in. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.scan.meta` | Many at once | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.scan.pending` | {count} not added yet | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.new.mark` | ◇ | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.new.title` | New project | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.new.body` | A new folder, or only an idea to shape first. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.new.meta` | From nothing | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.agent.mark` | ◎ | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.agent.title` | New agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.agent.body` | An agent with its own instructions, inside a project. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.agent.meta` | In a project | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.convert.mark` | ⇄ | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.convert.title` | Convert an agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.convert.body` | Make an agent you built elsewhere a Fabric agent. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.card.convert.meta` | Planned | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
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
| `start.add.title` | Add a project | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
| `start.add.lede` | Choose the folder. Fabric reads it, shows what it found, and creates the Project only when you confirm. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-127 | implemented; release pending (P-02) |
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
| `start.scan.title` | Scan a projects folder | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.lede` | Choose the folder that holds your projects. Fabric lists the repositories it finds; each one you tick becomes its own Project. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.choose` | Choose a folder to scan… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.choose.body` | For example the folder where you clone repositories. Dependency folders, build output and hidden folders are skipped. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.readOnly` | Scanning only reads. Nothing is created until you tick and confirm. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.scanning` | Scanning {folder}… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.stop` | Stop | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.failed` | The scan did not finish: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.summary` | Repositories: {count} · products: {products} · in {folder} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.when` | scanned {date} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.again` | Scan again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.truncated` | The scan stopped after {visited} folders. The list below is not the whole folder. Scan a narrower one. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.none` | No repositories were found in this folder. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.filter` | Filter by name or path | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.selectAll` | Tick all shown | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.clear` | Clear | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.group` | {name} · {count} folders | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.noCommits` | no commits yet | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.inProject` | In {name} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.added` | added | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.later` | Unticked repositories stay here; you can come back to them. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.import` | Add {count} as projects | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.importing` | Adding {done} of {count}… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.openFirst` | Open the first one | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `first.exec.state.foundUnconnected` | installed | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `first.exec.unconnected` | {name} runs in a project folder as itself. Fabric's tools are not connected to it yet, so it cannot report work back to Fabric. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-126 | implemented; release pending (P-02) |
| `start.scan.stopped` | The scan was stopped. Nothing was added. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.unreadable` | {count} folders could not be read (permissions or an unavailable disk), so repositories under them may be missing. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.importedAll` | Added: {ok}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.importedSome` | Added: {ok}. Not added: {failed}. Those stay ticked, so adding again retries them. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.nested` | inside another repository | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.partWarning` | This becomes a separate Project from the repository it belongs to. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.rowFailed` | Not added: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.scan.tickToAdd` | Tick repositories to add | apps/desktop/src/renderer/src/i18n/en.ts | SCN-128 | implemented; release pending (P-02) |
| `start.new.git` | Start it as a git repository | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `start.new.refused.exists` | A folder with this name is already there: {detail} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `start.new.refused.invalid-name` | This name cannot be a folder name: {detail}. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `start.new.refused.outside` | That location was not chosen in this window. Choose it again. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `start.new.refused.failed` | The folder could not be created: {detail} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-129 | implemented; release pending (P-02) |
| `start.agent.title` | New agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `start.agent.lede` | An agent belongs to a project: it works on that project's sources, with that project's authority. Choose the project, then describe the agent there. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `start.agent.loading` | Reading projects… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `start.agent.noProject` | An agent needs a project first. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `start.agent.pick` | Which project is it for? | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `start.convert.title` | Convert an agent | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.lede` | For an agent you built elsewhere: a script, a service, an MCP server. This path is designed and not built yet; here is how it will work. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step1` | Choose the agent's folder | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step1.body` | Fabric reads it and nothing else. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step2` | Review the plan | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step2.body` | A dry run lists the manifest, the MCP entry and every file that would change. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step3` | Your coding agent writes the adapter | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step3.body` | On its own branch, with the Fabric Agent Adapter skills. Your main branch is not touched. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step4` | The conformance probe decides | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.step4.body` | Only an agent that passes enters the registry. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.today` | Today: install the Fabric Agent Adapter skills and ask your coding agent to adapt the project. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `start.convert.command` | npx @passioncode-ai/passioncode@latest update | apps/desktop/src/renderer/src/i18n/en.ts | SCN-131 | implemented; release pending (P-02) |
| `agents.madeReading` | Reading the agents of this project… | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.readFailed` | The agents could not be read: {reason} | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.retry` | Try again | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.runner` | Runs in | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
| `agents.noRunner` | No program to run it in is available on this computer. | apps/desktop/src/renderer/src/i18n/en.ts | SCN-130 | implemented; release pending (P-02) |
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
