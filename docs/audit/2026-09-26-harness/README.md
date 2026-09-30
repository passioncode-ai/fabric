<sub>ssheleg skills — task-pipeline · agent-harness · agent-orchestrator · agent-interop · evidence-docs · agent-sync · maintaining-fabric-workspace</sub>

# Harness Fabric · аудит, схема и план R0

**Итог:** фундамент управления есть, но цельный managed harness ещё не готов к заявленному первому релизу. Claude Code получает scoped MCP, инструкции и контекст; полноценный Codex adapter, подтверждённый Stop, skills/hooks bundle и перенос работы требуют реализации. Найдены две воспроизводимые ошибки доставки решения в текущую сессию и отдельные ошибки launch lifecycle. Это аудит и план, не выпуск исправленного runtime.

- [Схема, модули и как агент получает harness](../../architecture/harness-runtime.md).
- [Все findings, исходники и реально выполненные проверки](evidence.md).
- [H00…H09: зависимости, файлы, приёмка, recovery и rollback](plan.md).
- [Обзор на живой карте](../../reports/map.html#harness-runtime).
- [Память и checkpoint](../../launch/memory/README.md), [первый релиз](../../launch/first-release-strategy.md).

## Объектив и требования

HAR-REQ-01: разделить authoring adapter, runtime adapter, agent profile и session bundle.
HAR-REQ-02: показать весь путь agent management/skills/hooks и реальную готовность каждого модуля.
HAR-REQ-03: проверить current code, воспроизвести ошибки и отделить deterministic checks от live conformance.
HAR-REQ-04: дать целевую схему и bounded correction packets с контекстом для следующего агента.
HAR-REQ-05: сохранить результат в owning Git repository, обновить wiki и единый вход; не выдать проектирование за native delivery.

Vision alignment: Project удерживает цель, правила и память при замене исполнителя. Меняем способ проверки/документирования готовности, не создаём второй task store или менеджер с отдельными полномочиями. Сценарии и product mockups в этой итерации не менялись; требования будущих экранов привязаны к H08 и должны пройти полную UX-цепочку при реализации.

## Самые важные выводы

1. **Adapter имеет два разных смысла.** Skills в fabric-agent-adapter создают кандидата-провайдера; подключение CLI делает native Fabric SessionBundle/runtime adapter.
2. **Installed, loaded и enforced — разные доказательства.** MCP strict config ограничивает MCP, но не все встроенные инструменты, правила и skills внешнего CLI. Orientation receipt фиксирует запрос, а не соблюдение правил.
3. **Stop требует завершённой операции.** Сейчас kill не возвращает proof остановки дерева процессов. При неизвестном старом writer нельзя безопасно запускать следующего в том же scope.
4. **Доставка требует исправления.** Диагностика показывает writes=2 при concurrent retry и writes=0 + alreadyDelivered=true после queued-before-write crash. Наличие зелёного последовательного теста этого не обнаруживало.
5. **Portable handoff и native resume — разные функции.** Codex пока plain terminal; чистая switch state machine не подключена к production driver. В UI готовность должна опираться на конкретную capability receipt.

## Что изменено в этой итерации

Архитектурная декомпозиция и audit receipts, H00…H09, карта, wiki entry и ссылки из исторических design docs. Единственная исполняемая правка — исправление устаревшего test assertion для exact pinned builds: history сохраняется, каждый текущий provider проверяется отдельно. Runtime production файлы не изменены. В репозитории сохранён synthetic diagnostic script; он демонстрирует дефект, а не выдаётся за passing correctness test.

Ревью выполнено отдельными read-only аудиторами lifecycle и skills. Они не меняли runtime, не устанавливали dependencies и не запускали реальные агенты. Итоговый независимый review дополнительно выявил compile-after-mint cleanup gap (E16); описание гарантий сужено, negative cases добавлены в H01/H04. Также исправлен исторический комментарий switch-test: pin не является live observation установленного host.

## Передача

- Владелец: Fabric, ветка `codex/context-audit-2026-09-14`, remote `git@github.com:passioncode-ai/fabric.git`.
- Baseline: `019a23eaad9169e1e8b0751da8230f939ea76839`; immutable references sibling repos — в E03. Их рабочие ветки этой итерацией не менялись; **pending member branches: none created**. Изменения installer будут отдельной задачей H04.
- Открытая работа: H00…H09 и прежний CO-168/MEM/FR backlog. Дефекты runtime не исправлены этим аудитом. Никакая capability не повышена до verified.
- Решения: уточнение существующих contracts, без изменения wire/новой ADR. Новые manifest fields — proposal до schema review.
- Следующий агент: открыть [H00](plan.md#h00--фиксированный-baseline-и-compatibility-inventory), подтвердить baseline на изолированных fixtures; затем H02 delivery и H01 compensation. Общие seams — architecture/harness-runtime.md, system-contract.md, MEM-P4/P5 и E01…E16.
- Предпосылки native приёмки: isolated DB/PTY workspace, точные provider builds, безопасная canary задача, доступный выбранный account без экспорта credentials. Их отсутствие остаётся NOT_RUN.
- Координация: lease HARNESS26, run r-410f09da3. Reconcile до работы: 28 post-baseline ADR и 112 CO без as-built плюс 10/50 pre-baseline. Исторические target records не объявлены реализованными ради зелёного reconcile; этот backlog сохранён явно. Изменения shared docs делаются под lease.
- Доставка: source commit → workspace publish/verify → parent receipt/pin. Финальные SHA/release связывает [publication receipt](../../workspace-receipt.json); это ветка для handoff, не merge в main и не релиз Fabric runtime.

## Проверки и остаточные ограничения

`VITEST_MAX_WORKERS=2 bash scripts/ci.sh fast` завершился **exit 0 / fast tier green** (2026-09-26): 121 desktop test files / 1362 tests, плюс documentation, register, design-map и audit-regression gates. После проверки добавлены review-уточнение E16, historical test comment и эта квитанция; publisher повторяет gate на точном source commit. Никакой полный hosted suite не dispatchился.

Focused checks и baseline failure перечислены в [evidence](evidence.md). Диагностика continuation подтверждает незакрытый дефект. Live CLI/DB/Electron/behavioral gates — NOT_RUN. Публикация документации не подтверждает native production readiness.

Публикация сначала остановилась на guard: `workspace origin/main` уже продвинут до `6574a1c` со source `796b31c3434b772ce837d74ee570ff49fc8c85b4` (Inbox). Этот source включён в рабочую ветку после review diff; сохранены обе истории карты, брендинг и Inbox docs. Никакие member production releases не выполнялись. Fast повторяется на объединённом source; старый снимок поверх нового не публикуется.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — audit scope and delivery
- [`agent-harness`](https://github.com/ssheleg/agent-stack) — module and receipt boundaries
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — lifecycle and continuation
- [`agent-interop`](https://github.com/ssheleg/agent-stack) — provider and host ownership
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — source and test receipts
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — shared documentation lease
- `maintaining-fabric-workspace` — wiki publication — not a skill this family ships
