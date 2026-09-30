<sub>ssheleg skills — project-audit · ux-audit · agent-orchestrator · agent-harness · sheleg-design · brand-voice · copywriting</sub>

# Доказательства и указатели

Срез HEAD `153b4f029e626230d465d5d21d02fb8c9de5fadf`. Продуктовые credentials и тела событий не копировались. Временные test logs остались в `/tmp`; числа и исходы проверок вынесены в summaries.

| Файл | Содержимое |
|---|---|
| [runtime.md](runtime.md) / [JSON](runtime.json) | Runtime, schema, authority, 17 SCN, 10 записей |
| [ux.md](ux.md) / [JSON](ux.json) | UI/UX/visual, 14 SCN, 19 записей |
| [operating-plan.md](operating-plan.md) / [JSON](operating-plan.json) | Operating surfaces и план, 18 SCN, 14 записей |
| [scenarios.md](scenarios.md) | Все 49 SCN и оговорки |
| [milestones.md](milestones.md) / [JSON](milestones.json) | Все 196 M-строк |
| [proposed-rows.csv](proposed-rows.csv) | Каждая локальная находка сопоставлена W-блоку; общие registries не изменены |
| [inventory.json](inventory.json) | Состав HEAD, file/line counts |
| [checks.json](checks.json) | Команды/результаты, browser measurements, scanner adjudication |
| [production-summary.json](production-summary.json) | Remote refs/CI/releases и platform attachment |
| [installed-artifact.json](installed-artifact.json) | Извлечённые пути, версии, размеры и хеши app.asar |
| [datastore-aggregates.txt](datastore-aggregates.txt) | Только агрегаты по estate и freshest-write timestamps |
| [plan-challenge.md](plan-challenge.md) | Независимая критика промежуточного плана; исправления включены в финальный W-план |
| [contrast-recomputed.json](contrast-recomputed.json) | Свежий расчёт контраста указанных пар, без заявления о native conformance |
| [probes/README.md](probes/README.md) | Сохранённые synthetic probes и способ повторения |
| [Граф W-плана](../2026-09-07-work-plan.json) | Проверка разрешимости зависимостей и отсутствия циклов |
| [final-validation.json](final-validation.json) | Повтор сохранённых probes, визуальная проверка отчёта, отсутствие source diff |

## Применённые исходники маршрута

`AGENTS.md`; `docs/AGENT_SYNC.md`; `$HOME/.agents/skills/project-audit/SKILL.md`; `$HOME/.agents/skills/task-pipeline/references/audit.md`; ux-audit, agent-orchestrator, agent-harness, sheleg-design, brand-voice и copywriting SKILL.md в установленной семье. Точные пути остальных SKILL.md проверяются в skill-paths.json.

## Воспроизводимость

Штатные тесты: `bash scripts/ci.sh fast` и `pnpm -r test`. Последняя команда пишет disposable fixtures в приложенную локальную БД; повторять только после проверки её принадлежности и изоляции scheduler. Миграционный reset не выполнялся. Дополнительные synthetic probes: `/tmp/fabric-runtime-probes.mjs` и `/tmp/fabric-ux-probe/*.test.tsx`. Логи: `/tmp/fabric-audit-fast.log`, `/tmp/fabric-audit-full-tests.log`, `/tmp/fabric-audit-contract-check.log`, `/tmp/fabric-audit-adapter-check.log`.

Сценарии не складываются в success rate: запланированная foundry/team/federation отсутствует по принятому горизонту; root UV-01 блокирует нынешнюю интеграцию независимо от локального соответствия. Исторические screenshots в UX-приложении обозначены как исторические; свежий browser просмотр относится к публичному сайту.

## Углубление и слияние плана по последнему запросу

- [Объединённый M-план](../2026-09-07-merged-execution-plan.md), [HTML](../2026-09-07-merged-execution-plan.html), [JSON](../2026-09-07-merged-execution-plan.json).
- [Проверка покрытия и зависимостей](merged-plan-validation.json); воспроизведение: `python3 docs/audit/2026-09-07-evidence/validate-merged-plan.py`.
- [Графы/прогоны](../2026-09-07-merge-graphs.md), [данные/ретро](../2026-09-07-merge-data-retro.md), [manager/cycles](../2026-09-07-merge-manager-cycles.md).

Новый проход проверяет контракты и план; будущие acceptance cases не выдаются за выполненные. Исходный HEAD не изменён.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`project-audit`](https://github.com/ssheleg/task-pipeline) — проверка проекта и доказательств
- [`ux-audit`](https://github.com/ssheleg/super-ux) — сценарии и дефекты интерфейса
- [`agent-orchestrator`](https://github.com/ssheleg/agent-stack) — архитектура исполнения и полномочий
- [`agent-harness`](https://github.com/ssheleg/agent-stack) — переносимый агентный контур
- [`sheleg-design`](https://github.com/ssheleg/sheleg-design-skill) — визуальная система
- [`brand-voice`](https://github.com/ssheleg/super-ux) — иерархия бренда
- [`copywriting`](https://github.com/ssheleg/super-ux) — формулировки позиционирования

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
