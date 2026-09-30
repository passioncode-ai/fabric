# Память: исходное состояние и границы доказательств

Снимок кода: `b64b49070ccb40fd698e7fa486114ece0f938cd9`, 2026-09-26. Источники ниже — код, не результат проверки живой системы. Независимый read-only review `memory_arch_review` подтвердил эти границы.

| Уже есть в исходниках | Основание |
|---|---|
| Захват декодированного PTY, фильтрация перед spool, annotation/excerpt/body/digest | [transcripts.ts](../../../apps/desktop/src/main/transcripts.ts), строки 133, 239, 252 |
| Повторная доставка после неудачного journal append и startup recovery | [index.ts](../../../apps/desktop/src/main/index.ts), 744–798; [transcripts.ts](../../../apps/desktop/src/main/transcripts.ts), 294–334 |
| Поиск фактов и сессий агентом в Project, L1 и полное L2 | [agentSurface.ts](../../../apps/desktop/src/main/agentSurface.ts), 846–959 |
| Поиск оператора по пяти типам в Estate | [searchRead.ts](../../../apps/desktop/src/main/searchRead.ts), 97–190 |
| Компиляция контекста, причины пропуска, недоступные источники | [contextPack.ts](../../../apps/desktop/src/main/contextPack.ts), 138–293 |
| Запись точного пакета перед запуском, чтение прошлого без пересборки | [index.ts](../../../apps/desktop/src/main/index.ts), 441–485; [pastContext.ts](../../../apps/desktop/src/main/pastContext.ts), 53–123 |
| Dashboard памяти с независимой свежестью и partial | [memoryOverviewRead.ts](../../../apps/desktop/src/main/memoryOverviewRead.ts), 88; [MemoryOverviewSection.tsx](../../../apps/desktop/src/renderer/src/MemoryOverviewSection.tsx), 53–171 |

## Найденные ограничения → пакет

1. FTS индексирует первые 400000 символов с English config: [миграция](../../../supabase/migrations/20260831000008_transcripts.sql), строка 49. Нет доказательства полнотекстового поиска по всей длинной русской сессии. **P2**.
2. Захват ограничен 8000000 байт и сохраняет начало; recovery выставляет `truncated:false`, не имея сохранённых counters: [transcripts.ts](../../../apps/desktop/src/main/transcripts.ts), 103–116, 180–184, 361. **P1**.
3. L2 по ID возвращает всё тело без лимита/offset; L1 head+tail не привязан к совпадению: [agentSurface.ts](../../../apps/desktop/src/main/agentSurface.ts), 931–939; transcripts.ts 246–250. **P2**.
4. Захват PTY не доказывает структурную атрибуцию пользовательского голоса/сообщений/инструментов. Индексация после выхода не равна live memory: [pty.ts](../../../apps/desktop/src/main/pty.ts), 381–389; index.ts 744–798. **P1**, зависит от **CW-N1**.
5. Compiler имеет бюджет 12000 символов и 12 последних annotations, без Git/checkpoint/predecessor в input: contextPack.ts 70, 105–106, 149–159. Это не provider token budget и не portable continuation. **P4/P5**.
6. Project-scoped agent surface не получает Estate-wide права оператора: [scope.ts](../../../apps/desktop/src/shared/scope.ts), 68–90; agentSurface.ts 629. Связанный проект не означает доступ. **P0/P2/P4**.
7. Codex descriptor не имеет surface/result adapter, неподдержанный executor отклоняется: [agents.ts](../../../apps/desktop/src/shared/agents.ts), 152–162; [sessionBundle.ts](../../../apps/desktop/src/main/sessionBundle.ts), 65–78. Claude Code → Codex остаётся **FR-E/P5**, не работающей нативной возможностью.
8. Прошлые packs частично machine-local; удаление projection не удаляет journal и допускает восстановление: pastContext.ts 40–54, index.ts 761–774. **P7**.
9. Shape-based redaction не гарантирует удаление всех секретов; line-buffer + multiline PEM требует split-case tests: [redact.ts](../../../apps/desktop/src/shared/redact.ts), 15–21, 47; transcripts.ts 157–178. **P1**.
10. [memory-eval.test.mjs](../../../apps/desktop/test/memory-eval.test.mjs), 47–49, допускает skip без Supabase. Exit 0 такого запуска нельзя назвать memory-on/off оценкой. **P0/P7**.

Исторический вводный раздел ADR-0032 описывал отсутствие pack/transcript на 2026-08-31. Он не является текущим статусом реализации. Нормативные решения ADR сохраняются; новый дизайн расширяет их, а не переписывает прошлое.
