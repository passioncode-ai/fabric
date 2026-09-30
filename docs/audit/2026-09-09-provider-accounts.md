<sub>ssheleg skills — evidence-docs · agent-sync · task-pipeline · maintaining-fabric-workspace</sub>

# Provider accounts: Fabric, Orca и claude-swap

Дата проверки: 2026-09-09. **Вывод: эквивалент Orca/cswap в проверенном Fabric не реализован.**
Есть запуск CLI с окружением оператора, сохранение терминальных транскриптов и чтение
квоты системного Claude. Это не менеджер аккаунтов и не подтверждение продолжения
того же provider conversation после смены логина.

## Объём и источники

Задача: найти исходники приведённого экрана Orca, проверить подключение аккаунтов,
переключение и сохранность сессий, сопоставить с Fabric. Эта итерация — исследование,
воспроизводимая проба и передача результатов; продуктовая авторизация не менялась.
Изучены committed Fabric sources; параллельная незавершённая работа по membership
исключена из изменений и выводов. Установленный бинарник Fabric не проверялся.

| Источник | Проверенная ревизия / вход |
|---|---|
| Fabric | [`451d6839e5ef0b5ecdd0447e3d2fe20596085983`](https://github.com/passioncode-ai/fabric/tree/451d6839e5ef0b5ecdd0447e3d2fe20596085983) |
| Orca | [`ed9d76178de14c7f220cf83f06af0d23c2717cfc`](https://github.com/stablyai/orca/tree/ed9d76178de14c7f220cf83f06af0d23c2717cfc), clone default HEAD, fetched 2026-09-09 |
| claude-swap, Python | [`7187ce83b444c6af7b61ec8ee092623566a2d8fa`](https://github.com/realiti4/claude-swap/tree/7187ce83b444c6af7b61ec8ee092623566a2d8fa), fetched 2026-09-09; это пакет, предоставляющий команду `cswap` |
| Предыдущее исследование | [Orca browser/computer use](../evidence/specs/2026-09-02-orca-browser-and-computer-use-study.md); его старая ревизия не использовалась для текущих гарантий аккаунтов |
| Контекст Fabric | [термины](../../CONTEXT.md), [очередь](../evidence/backlog.md#build-order-by-layer), [сценарии](../ux/scenarios.md), [карта документов](../DOCMAP.md) |

Contradictions: текст Orca «without moving chat sessions» нельзя читать как обещание
мгновенного переключения живого процесса: обработчик того же экрана просит restart.
Fabric quota и запускаемая сессия могут обращаться к разным Claude identities.

## Что реализовано в Orca

**Claude.** Add Account создаёт временный config directory, запускает официальный
`claude auth login --claudeai`, затем `auth status --json`, сохраняет захваченный auth
в managed account и убирает временный контекст. На macOS предусмотрено восстановление
предыдущего legacy Keychain entry. Источник: [claude-login-session.ts:35](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/main/claude-accounts/claude-login-session.ts#L35).

Выбор аккаунта ограничен runtime (host/WSL distro), при ошибке возвращает прежнюю
selection и восстанавливает auth. Host-путь переносит credentials в общий runtime
Claude, сохраняет обновлённые токены уходящего аккаунта после проверки identity и
умеет восстановить system default. На macOS пишет также Keychain. WSL имеет отдельный
путь через свой config directory. Источники:
[selection:80](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/main/claude-accounts/claude-account-selection.ts#L80),
[runtime auth sync:17](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/main/claude-accounts/runtime-auth/runtime-auth-sync.ts#L17).

Orca отслеживает живые Claude PTY и structured children, чтобы координировать
refresh/switch. Это внутренняя координация Orca; она сама по себе не доказывает
межпроцессную совместимость со всеми внешними CLI. После смены аккаунта UI явно
просит перезапустить живые Claude terminals. Источники:
[live-pty-gate.ts:1](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/main/claude-accounts/live-pty-gate.ts#L1),
[accounts-pane-account-actions.ts:165](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/renderer/src/components/settings/accounts-pane-account-actions.ts#L165).

**Codex.** Вход проходит через `codex login` с `CODEX_HOME`, направленным в managed
home. Новый выбор помечает живые panes как требующие restart; код исполнения
перезапуска создаёт заменяющий PTY и перепривязывает pane. Отдельный session bridge
делает rollout-файлы доступными в другом account home. Сохранность rollout и
продолжение операции в памяти процесса — разные свойства. Источники:
[login:238](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/main/codex-accounts/codex-login-session.ts#L238),
[restart notice:75](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/renderer/src/components/settings/accounts-pane-account-actions.ts#L75),
[pane restart:160](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/renderer/src/components/terminal-pane/codex-detached-pane-restart.ts#L160),
[session bridge:53](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/main/codex/codex-account-session-bridge.ts#L53).

**Остальные секции предоставленного экрана** показывают также источники usage,
а не один универсальный механизм смены аккаунта: Gemini читает локальные OAuth
источники, OpenCode Go использует browser cookie, MiniMax имеет cookie/API-key пути,
Grok читает CLI auth. Наличие такого подключения не доказывает swap/resume.
Источники: [Gemini](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/main/rate-limits/gemini-oauth-sources.ts#L8),
[OpenCode](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/main/rate-limits/opencode-go-request-session.ts#L1),
[MiniMax](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/main/rate-limits/minimax/minimax-fetcher.test.ts#L527),
[Grok](https://github.com/stablyai/orca/blob/ed9d76178de14c7f220cf83f06af0d23c2717cfc/src/main/rate-limits/grok-auth.ts#L5).

## Что именно делает cswap

Общий switch сохраняет исходный credential, активирует целевой и заменяет
`oauthAccount` в текущем config, сохраняя остальные настройки. Есть rollback.
Переключение берёт собственную блокировку и credential/config locks Claude Code;
совместимость протокола привязана к исследованной upstream-версии CLI.
Источники: [switcher:6684](https://github.com/realiti4/claude-swap/blob/7187ce83b444c6af7b61ec8ee092623566a2d8fa/src/claude_swap/switcher.py#L6684),
[credential locks:1](https://github.com/realiti4/claude-swap/blob/7187ce83b444c6af7b61ec8ee092623566a2d8fa/src/claude_swap/claude_locks.py#L1).

Второй режим, `cswap run`, создаёт отдельный persistent `CLAUDE_CONFIG_DIR` на
аккаунт. История по умолчанию раздельная. `--share-history` объединяет имеющуюся
историю и связывает `projects/` и `history.jsonl`; на Windows этот режим отклоняется.
Источники: [session.py:1](https://github.com/realiti4/claude-swap/blob/7187ce83b444c6af7b61ec8ee092623566a2d8fa/src/claude_swap/session.py#L1),
[history sharing:1054](https://github.com/realiti4/claude-swap/blob/7187ce83b444c6af7b61ec8ee092623566a2d8fa/src/claude_swap/session.py#L1054).

README заявляет подхват общего switch на следующем сообщении Linux/Windows и после
истечения примерно 30-секундного Keychain cache на macOS. Это upstream-заявление,
а не измерение на аккаунтах оператора; поведение конкретной версии CLI надо проверять.
[README:211](https://github.com/realiti4/claude-swap/blob/7187ce83b444c6af7b61ec8ee092623566a2d8fa/README.md#L211).

## Сопоставление с Fabric

| Проверяемое свойство | Fabric на проверенной ревизии |
|---|---|
| Использование существующего CLI login | Да: `pty.ts:273–327` запускает descriptor с `sessionEnvironment(process.env)`; специальных account overrides нет |
| Add/list/remove/select provider accounts | В просмотренной цепочке settings → IPC → PTY/bundle и tracked исходниках нет account registry, lifecycle API или выбора account ID |
| Pin аккаунта на конкретную сессию | Нет параметра account ID/profile у `PtyManager.open`; inherited config dir общий для запусков этого приложения |
| Swap с lock, readback, rollback и проверкой целевой identity | Не найден; сохранение терминального текста не является таким механизмом |
| Продолжение provider conversation после restart | Нет provider-session mapping/resume аргумента в просмотренной цепочке запуска; Fabric session ID создаётся заново |
| Usage | Только reader Claude; профиль сессии и reader могут расходиться; кэш не ключуется аккаунтом |

Проверяемые входы:
[PTY](https://github.com/passioncode-ai/fabric/blob/451d6839e5ef0b5ecdd0447e3d2fe20596085983/apps/desktop/src/main/pty.ts#L273),
[environment](https://github.com/passioncode-ai/fabric/blob/451d6839e5ef0b5ecdd0447e3d2fe20596085983/apps/desktop/src/main/sessionEnv.ts#L45),
[bundle](https://github.com/passioncode-ai/fabric/blob/451d6839e5ef0b5ecdd0447e3d2fe20596085983/apps/desktop/src/main/sessionBundle.ts#L55),
[quota credential lookup](https://github.com/passioncode-ai/fabric/blob/451d6839e5ef0b5ecdd0447e3d2fe20596085983/apps/desktop/src/main/quota.ts#L79),
[quota cache](https://github.com/passioncode-ai/fabric/blob/451d6839e5ef0b5ecdd0447e3d2fe20596085983/apps/desktop/src/main/quota.ts#L133).
Поиск: `rg -n -i 'account|swap|resume|CLAUDE_CONFIG_DIR|CODEX_HOME' apps/desktop/src`
с ручной классификацией совпадений (слово account встречается также в значении отчёта агента).

## Выполненные проверки и границы

- `node docs/audit/2026-09-09-provider-accounts.probe.mjs` — exit 0, воспроизведены:
  сохранение profile env при запуске; игнорирование profile в quota lookup на
  синтетических Linux/macOS зависимостях; выдача квоты A после смены на B до TTL.
  [Проба](2026-09-09-provider-accounts.probe.mjs) исполняет реальную функцию lookup
  с подменёнными I/O; это не эмуляция OS Keychain и не live account-switch test.
- `node apps/desktop/test/repo-quota.test.mjs` и
  `node apps/desktop/test/session-env.test.mjs` — exit 0.
- В отдельном clone claude-swap на указанной ревизии:
  `uv run --group dev pytest -n 0 tests/test_session.py tests/test_claude_locks.py tests/test_switcher.py -q`
  — **704 passed in 35.59s**, exit 0. Fixtures изолируют home/credential store и
  Keychain; реальные логины и разговоры не использовались.
- Orca изучена по исходникам и тестовым случаям; её suite и GUI не запускались.
- `bash scripts/ci.sh fast` — exit 0, `fast tier green` в изолированном worktree.
  Stack-backed probes не запускались. Первые проходы выявили разрыв Markdown-таблицы,
  зависимые exposure counters и stale receipt SRC-02; они исправлены. Новый checkout
  также потребовал локальный generated resources directory; продуктовый код не менялся.
- `node scripts/check-registers.mjs` — exit 0: 112 carry-over, 196 milestones,
  831 verification rows; открытых carry-over 80. `node scripts/check-design-map.mjs`
  — exit 0. Проверено разрешение 23 закреплённых file/line ссылок в source checkouts.

## Handoff — точный следующий шаг

Owning repository: `git@github.com:passioncode-ai/fabric.git`; working branch:
`codex/provider-accounts-review-20260909`. Вход нового агента — этот файл.
После checkout этой ветки запустить приложенную пробу; dependencies устанавливаются
по lockfile проекта. Публикационная квитанция имеет один дом —
[`docs/workspace-receipt.json`](../workspace-receipt.json); её соответствие source
и child проверяется `node scripts/workspace.mjs check --require-child`.
Git handoff не является merge ветки в основную продуктовую разработку.

Открытая работа зарегистрирована как **CO-112** в [carry-over ledger](../evidence/specs/2026-08-16-software-fabric-carryover.md).
Новый product contract/ADR этой проверкой не принимался. Предлагаемый следующий
пакет: спроектировать Claude+Codex account binding и acceptance suite, начиная с
устранения расхождения profile/identity/usage. Сначала проверить vision alignment
и добавить сценарии; M169 provider failover и S12 restore — соседние контракты,
не доказательство и не готовая реализация этого пакета.

Пакеты для следующего исполнителя (предложения, не утверждённая очередь):

1. **Account lifecycle:** system default, add/list/remove/select, локальный secret
   store, проверяемая identity, account/runtime scope, cancel/duplicate/expired login.
2. **Session continuity:** связь Fabric session ↔ provider conversation ↔ account;
   сохранение transcript/tool state/cwd, только допустимая граница переключения,
   проверка target identity, rollback; явный restart-required когда hot swap не доказан.
3. **Quota identity:** reader/cache/backoff по account+runtime+auth generation,
   инвалидирование при switch; неизвестные данные не маскировать старой квотой.
4. **Acceptance:** A→B→A в том же разговоре, известный факт из предыдущего turn,
   совпадение conversation ID и новая подтверждённая identity, другой параллельный
   разговор не меняется; refresh race, cancel, failed restart, crash recovery,
   удаление используемого аккаунта. Отдельные результаты на каждой ОС/версии CLI.

Общий контекст пакетов: источники выше, [S12](../reports/map.html#work-s12),
[M169](../reports/map.html#work-m169), [сценарии](../ux/scenarios.md).
Для live acceptance понадобятся два тестовых provider login и отдельный разговор;
секреты вводятся локально через login flow, не в документы или Git.

Local-only: сторонние clone/venv, реальные учётки, токены, private machine config и
чужие membership edits не входят в эту поставку. Чтение или переключение реальных
аккаунтов не выполнялось. Первый шаг нового агента — воспроизвести приложенную пробу
и согласовать semantics `same conversation`/`restart required` по CO-112, затем
проектировать изменение; не считать зелёный characterization probe исправлением.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — проверка гарантий по исходникам.
- [`agent-sync`](https://github.com/ssheleg/agent-sync) — lease и резервирование CO.
- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — рамка передачи исследования в Git; продуктовые стадии не выполнялись.
- `maintaining-fabric-workspace` — проверка состояния публикации и обновление карты; private repository skill.
