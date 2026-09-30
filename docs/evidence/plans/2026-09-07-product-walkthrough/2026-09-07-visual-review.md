<sub>ssheleg skills — sheleg-design</sub>

# Fabric product report — CSS review, 07.09.2026

Изменён только `scripts/product/report.css`. Объект проверки — целевой интерактивный отчёт `docs/reports/product.html`, без подключения к Fabric runtime, native app, агентам или БД. Базовый Paperclip, цветовые роли и шрифты сохранены; движения не добавлены. Сборка HTML принадлежит root.

## Результат

Компактный controller walkthrough от root вместе с CSS сокращает служебную часть настолько, что на 1280×720 видны заголовок проекта, создание задачи и первые карточки работы/решения. На ширине375 все общие страницы и поверхности помещаются по ширине, граф прокручивается внутри собственного контейнера. На этой ширине маршрут с guide всё ещё требует вертикальной прокрутки до содержания проекта: ни названия, ни навигация, ни предупреждение о демонстрационных данных не спрятаны.

| Измерение | Baseline | После компактного controller + CSS |
|---|---:|---:|
| 1280×720, верх окна макета | y539.4 | y278.2 |
| 1280×720, верх заголовка проекта | y685.4 | y388.2 |
| 1280×720, первая рабочая карточка | y879.0 | y573.9 |
| 375×812, document.scrollWidth | 488 | 375 |
| 375×812, верх окна макета | y1185.0 | y570.8 |
| 375×812, верх заголовка проекта | y1491.2 | y864.1 |

Маршрут измерения: `http://127.0.0.1:8770/reports/product.html#view-project?journey=PJ-04&step=0`. Это сравнение общей новой версии с baseline; улучшение не приписывается одному CSS. Baseline снимки: `/tmp/fabric-report-before-desktop.png`, `/tmp/fabric-report-before-mobile.png`. После: `/tmp/fabric-product-css-desktop-dark.png`, `/tmp/fabric-product-css-mobile-dark.png`.

## Конкретные изменения

- Chrome отчёта: компактные header/nav/toolbar и поля в одну строку на desktop; guide использует читаемые заголовок и текущий шаг с раскрытием полной последовательности. CSS receipts: `scripts/product/report.css:31`, `:36`, `:61`, `:68`, `:74`. Свёрнутое состояние определяется controller, CSS не создаёт новый state.
- Рабочая поверхность: меньше отступы scope/title/window tabs; содержимое начинается раньше при сохранённых текстах. `scripts/product/report.css:84`, `:97`, `:100`.
- Граф: исходный SVG920 единиц больше не сжимается до480–736px. Минимум920 CSSpx, заголовки14.4px и captions/edge labels12px; шрифт из существующих app tokens. Горизонтальный скролл локален, список связей переносится. `scripts/product/report.css:3`, `:162`, `:167`, `:171`, `:173`. Поведение preview→full view и четыре семантики не менялись.
- Узкий экран: две колонки select, перенос action/source/chip/terminal text, один столбец содержимого, компактная сетка app navigation. Никакого общего `overflow-x:hidden`, который скрывал бы дефекты. `scripts/product/report.css:15`, `:63`, `:109`, `:203`, `:245`, `:260`.
- Funnel map: шаги читаемыми карточками, отдельные ссылки ветвей с пунктирной границей; горизонтальная последовательность переносится, на узком экране становится вертикальной. `scripts/product/report.css` symbols `.funnel-graph`, `.funnel-node`, `.funnel-branch`, `.funnel-arrow`. Скриншоты `/tmp/fabric-product-css-funnel-desktop.png`, `/tmp/fabric-product-css-funnel-mobile.png`.
- Клавиатура: видимый `:focus-visible` в обеих темах; inset outline для областей графа/таблицы, чтобы контур не обрезался. `scripts/product/report.css:13`, selector `.graph-frame:focus-visible`. Reduced motion сохранён, анимации не добавлены.
- Исправлен реальный дефект светлой темы отчёта: terminal text/caption/status chip использовали theme `--ink`, то есть rgb(10,10,10) на rgb(31,29,26). Теперь существующий Paperclip `--manila`, определённый как terminal ink (`apps/desktop/src/renderer/src/tokens.paperclip.css:64`). CSS `.terminal-window`, `.terminal-caption`, `.terminal-window .chip`, `.terminal-window pre`. Новых цветовых литералов не добавлено.

## Проверки

Независимый headless Chromium через Playwright из `$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`. Использован существующий HTTP server8770 с корнем docs, без изменения сервера. CSS подключался в собственный browser context через `addStyleTag` до root rebuild.

Команда из cwd `.`: `node /tmp/fabric-product-css-probe.cjs`.

Вывод: `{"count":236,"errors":[],"failures":[]}`. 53 адресуемых вида +6 разделов, две ширины1280/375, две темыdark/light. Критерии: `documentElement.scrollWidth<=innerWidth`, отсутствие выступающих DOM boxes вне graph/table/code regions, отсутствие pageerror. Raw data: `/tmp/fabric-product-css-probe.json`. Это проверка геометрии и исполняемости документа, не тесты продуктового runtime и не полный WCAG audit.

Вручную в headless browser проверены:

- Native details: Enter открывает, Space закрывает walkthrough. Вывод `guideEnter true`, `guideSpace false`.
- Graph viewport на375: clientWidth281, scrollWidth920. Focus и ArrowRight меняют scrollLeft0→35; видимый outline2px, activeElement=graph frame. Скриншот `/tmp/fabric-product-css-graph-mobile-light.png`.
- Desktop dark и light, mobile dark и light; funnel открытый. После terminal fix отдельно подтверждены pre/caption/chip rgb(255,255,255) на terminal rgb(31,29,26) в обеих темах: `/tmp/fabric-product-css-terminal.json`.

## Передано root, вне разрешённого CSS scope

1. `scripts/product/renderers.mjs`, `graph()`: часть edge labels в текущей геометрии перекрывалась последующими node rect. Пример project-history: «основание», «новая задача», «вопрос». Список связей под графом оставался читаемым. Скриншот до renderer fix: `/tmp/fabric-product-css-graph-light.png`. Root уведомлён; нужны осмысленные координаты и порядок слоёв рендерера, CSS не должен перерисовывать топологию. Статус на момент записи: ожидается root closure.
2. Graph viewport сейчас не имеет явных `role=region`, `tabindex=0`, `aria-label`; Chromium делает scroll region focusable автоматически. Предложено закрепить явный контракт для других браузеров в renderer. CSS уже поддерживает outline и прокрутку.
3. Финальную generated HTML проверку после root rebuild следует отделять от проверки source CSS injection. Финальный rebuild запрошен после terminal fix.

## Граница результата

Нет заявлений о Safari/Firefox, screen reader walkthrough, mobile native Fabric или runtime validation. Все данные Atlas/Orbit/Studio демонстрационные. При узком экране сохраняется вертикальный путь, а не обещание вместить полноценный command center и chrome отчёта в812px.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — CSS плотность и читаемость целевого отчёта с проверкой тем и узкого экрана

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>


## Delivery integration note

This is the retained independent review at its inspection point; line positions and temporary screenshots above are historical. The maintained final verification is `scripts/test/product-report.browser.cjs` and `browser-check.json` beside this file. Root corrected graph legend geometry and explicit keyboard region, provider admission reset, custom project isolation, preservation of all task-intent fields and added presentation mode. These changes are target-report code only; product findings remain open.
