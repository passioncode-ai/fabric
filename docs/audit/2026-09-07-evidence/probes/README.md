# Контролируемые пробы аудита

Срез: `153b4f029e626230d465d5d21d02fb8c9de5fadf`, 2026-09-07. Эти пробы воспроизводят дефекты существующего кода; они не исправляют его. Fixtures и API заменены синтетическими данными. Настоящие продуктовые записи и внешние эффекты не используются. HTTP probe поднимает локальную MCP поверхность с fake journal.

- `runtime-probes.mjs`: семь проверок chain, grants, estate scope, quota и redaction. Ожидаемое и фактическое поведение выводятся агрегатами, значение synthetic credential не выводится.
- `shell.test.tsx`: успешный metadata response воспроизводит нарушение порядка Hooks в actual App.
- `editor.test.tsx`: response Save пересоздаёт editor со старым текстом после нового ввода.
- `project.test.tsx`: пустая Board, подпись Codex и вложенные кнопки в actual ProjectHome.

Успешный exit этих audit tests означает, что **репродукция дефекта сработала**. После исправления её нужно преобразовать в регрессионную проверку желаемого поведения. Они не входят в штатный набор тестов приложения.

Оригинальные команды использовали временный каталог `/tmp/fabric-ux-probe` и `/tmp/fabric-runtime-probes.mjs`. Копии здесь сохраняют абсолютные imports текущего checkout; для другой машины сначала заменить корень, сохранив проверяемый SHA.

Из корня Fabric на этой машине:

```bash
node --experimental-strip-types docs/audit/2026-09-07-evidence/probes/runtime-probes.mjs
python3 docs/audit/2026-09-07-evidence/probes/run-ui-probes.py
```

Эти probes не заменяют native Electron E2E, проверку настоящего runner enforcement или измерение частоты пользовательских инцидентов. Штатный `pnpm -r test` отдельно использует прикреплённый Supabase и пишет test fixtures; его нельзя считать эквивалентом этих in-memory probes.

UI runner создаёт временную копию probes и связывает её с установленными `apps/desktop/node_modules`, затем удаляет временный каталог. Прямой запуск из `docs/` не разрешает React в pnpm workspace; эта проблема упаковки probes была обнаружена и исправлена при проверке сохраняемого комплекта. Продуктовый код и конфигурация тестов приложения не меняются.
