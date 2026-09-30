# G28 — время и точный контекст решения в макете

Commit: `0919fc3` · worktree `/tmp/fabric-mockup-graphs` · только graphs.mjs и два новых dedicated tests. G56/root source copies в commit не включены.

В curated Atlas и generic project decision projection `created_at` теперь передаётся в `time` без нормализации/выдуманного fixture clock. `context_pack` имеет приоритет над legacy `pack`; canonical null не заменяется старым значением. Строки past/next не принимаются за ID пакета. Отсутствующие поля явно неизвестны.

Inspector показывает ID пакета и ссылку на точный прошлый контекст, только когда `fixtures.projectRuns` содержит однозначный явный match `{id,project,task,pack}`. Маршрут: `#view-context-pack?project=<project>&agent=<optional>&task=<exact task>&pack=past&run=<exact TaskRun ID>`. Другой project/task, последний run, timestamp и числовая iteration не используются для связи. Без однозначного match ID остаётся видимым и сообщается причина отсутствия ссылки. При source denied/missing ссылка не отображается. Записанное основание, явные цитаты и retrieval по-прежнему разделены.

Проверка: `node --test scripts/test/product-graph-provenance.test.mjs scripts/test/product-graph-scopes.test.mjs scripts/test/product-graph-plan.test.mjs` — 28 pass, 0 failures (8 новых). `product-graph-provenance.browser.mjs` — 6 browser cases pass, zero page errors, включая viewport 390px без overflow. Проверены exact time/scope/run/back, foreign/wrong-task/ambiguous/missing mapping, legacy precedence, absence, source denied, escaping, input immutability. `git diff --check` exit0.

Ограничение проверки: standalone browser упражняет graph → exact route callback и возврат. Root проверяет встроенный context-pack renderer и полный продуктовый макет. Сам renderer сейчас принимает past+run, поэтому известный package ref без прочитанного run не превращается в ложную ссылку на последний пакет. Тесты не запускали продукт, БД, provider или сеть.
