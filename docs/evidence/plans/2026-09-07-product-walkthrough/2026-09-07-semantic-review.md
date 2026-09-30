# Fabric — семантика интерактивного fixture-прототипа

Дата: 2026-09-07. HEAD исходного проекта: `91337391aa8d24966bf0c57db381e6fe63b48bce`; renderer — новый файл текущего незакоммиченного отчёта, а не код этого HEAD. Это ревью и правка **только демонстрационного HTML renderer**, не реализация возможностей живого Fabric.

Изменён только `scripts/product/renderers.mjs`. Controller, builder, JSON fixtures/model, report-template, CSS, общие документы не редактировались. Read-only изучен controller, согласованы поля и команды с владельцем. Приложение, агенты, сеть и БД не запускались.

## Исправлено

| Область | Поведение | Receipt |
|---|---|---|
| Boolean route flags | `true`/`'true'` включают флаг; `'false'` не включает taskSaved, managerSwitched, admitted и прочие статусы | `scripts/product/renderers.mjs:24`, `renderProduct` |
| Read-only | Все кнопки команд и mutation forms disabled; навигация/повтор чтения/фильтры остаются доступны. Сам renderer не является security boundary — controller также обязан отклонять команды | `scripts/product/renderers.mjs:27` |
| Не подготовлен контекст | launch `phase=no-context`, а также сохранённая пользовательская taskDraft без preparation, не допускает start-run/unknown-path; нет TaskRun или чужого plan-v2 | `scripts/product/renderers.mjs:118`, launch |
| Проверенная приёмка | Один derived verified-fixture для task/run/proposal/project-plan: E-21/E-22 + CP-accept-02, 5/5 текущих шагов; AT-42/AT-47 завершены, AT-50 остаётся в плане, публикации нет | `scripts/product/renderers.mjs:46`, `:123`, `:266` |
| Exit и stop | Обычный exit не закрывает задачу. stopRequested не означает observed stop или done и не превращается в verified | `scripts/product/renderers.mjs:105`, `:123`, `:286` |
| Исторические шаги и пакеты | Run 1 остаётся failed с 3/5, причины failed/blocked названы. Exact CP-01/plan-v1/F-19 отличается от CP-02/plan-v2/F-21 | `scripts/product/renderers.mjs:54`, `:155` |
| Проектный scope | Orbit/Studio показывают собственную краткую работу/команду и честно обозначенный недостаток подробного набора. Переход к Atlas явный; его tasks/questions/packs не подставляются | `scripts/product/renderers.mjs:65` |
| Адресный объект | AT-38/47/50 и Q-13 открывают собственную summary. Стрелки SVG/list передают task/question/run. Узел AT-50 больше не открывает proposal AT-42. Aggregate rows сохраняют project ID | `scripts/product/renderers.mjs:49`, `:72`, `:78`, `:207` |
| Новая работа | taskSaved использует собственный title/result без старых run/pack. Созданный проект без repo пишет «Без репозитория», а не atlas-app | `scripts/product/renderers.mjs:94`, `:105` |
| Отказ в approval | Deny показан как отказ D-09; grant не выдан, reserve недоступен. При этом доставка отказа и её ack остаются отдельными фактами; ack отказа не создаёт authority | `scripts/product/renderers.mjs:129`, `:253` |
| Manager | selectedManager поддерживает fabric/claude-code/codex/custom. pending-validation не меняет b17; validated предлагает apply; applied только staged b18, не вызов агента. paused и отсутствие нового wake явно видны | `scripts/product/renderers.mjs:225` |
| Admission | admitted меняет обязательную строку observation/cancel на проверенный fixture receipt C-06. Session resume остаётся непроверенным и выключенным. Provider admission не равен wake или effect grant | `scripts/product/renderers.mjs:240` |
| Формы | Конкретные ошибки создания/ответа/настроек/доступа/manager. Conflict называет актуальный объект и guard, блокирует stale submit и больше не отправляет произвольную форму в editor | `scripts/product/renderers.mjs:186` |
| SVG | Полные подписи причинных связей перенесены ниже узлов в двухколоночную легенду со source→target; длинные node captions переносятся. Region доступен клавиатуре; список и SVG используют адресные ссылки | `scripts/product/renderers.mjs:207`, `:216` |

## Проверка

Команды:

```sh
node --check scripts/product/renderers.mjs
node /tmp/fabric-product-semantics-probe.mjs
```

18 групп assertions PASS; первая перебирает 53 сохранённых view ID × 8 состояний = 424 render calls. Дополнительные проверки проверяют перечисленные выше ветки, scope и неизменность исходных fixtures. Команды завершились exit 0.

Воспроизводимые файлы:

- `/tmp/fabric-product-semantics-probe.mjs` — pure Node import renderProduct/graph и assertions.
- `/tmp/fabric-product-semantics-probe.json` — машинный результат.
- `/tmp/fabric-product-semantics-probe.log` — вывод последнего запуска.

Это не browser runtime-проверка: assertions проверяют строки HTML и чистое преобразование fixtures. Не проверены focus restoration, browser history, layout overflow, клики controller и стили после сборки. Они принадлежат интеграционной проверке родителя.

## Согласованный controller contract / остаток владельцу интеграции

1. Поля: `selectedManager='fabric'|'claude-code'|'codex'|'custom'`, `managerSwitchStatus='pending-validation'|'validated'|'failed'`, `managerSwitched`, `managerPaused`, `stopRequested`, `admitted`, `answerChoice`, адресные `task`/`question`.
2. `validate-manager` подтверждает fixture capabilities; `apply-manager` требует validated и только stages новую привязку. `admit-provider` не вызывает manager. `pause-manager` вызывает rerender.
3. `accept-result` должен адресовать AT-42/run 2, снять taskSaved и выставить explicit `phase=verified`. Ни start/exit, ни stop не должны использовать эту фазу. Перейти из historical run 1 к verified требует явной смены run, не унаследованного номера.
4. Controller должен проверять read-only независимо от disabled HTML, сохранять phase при простой навигации, сбрасывать route/draft/object flags только при явной смене fixture/journey. Сохранённый пользовательский taskDraft должен переходить в no-context до отдельного шага preparation.
5. `admitted` относится к конкретному выбранному provider/profile: при смене provider старый fixture-флаг нельзя переносить автоматически. Аналогично selectedManager после уже применённой смены не должен переименовывать старую binding без новой staged transition.
6. Orbit/Studio и AT-47/Q-13 имеют честные summary без полного interaction scope; это явная граница набора, не завершённая продуктовая реализация этих экранов.

Renderer передан владельцу; дальнейших правок этим агентом не планируется. Сборку, CSS 12px/min-width 920 и browser screenshots ведёт родитель. Использована стадия реализации/review task-pipeline внутри делегированного scope; новый pipeline run не открывался.

SHA-256 renderer на момент передачи: `ac133cce659e06ead05e6f74208376053fe688c8a428d063b14289cb20848495`.


## Delivery integration note

This is the retained independent review at its inspection point; line positions and temporary screenshots above are historical. The maintained final verification is `scripts/test/product-report.browser.cjs` and `browser-check.json` beside this file. Root corrected graph legend geometry and explicit keyboard region, provider admission reset, custom project isolation, preservation of all task-intent fields and added presentation mode. These changes are target-report code only; product findings remain open.
