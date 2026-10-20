# PassionCode.ai: коротко для тестирования

Для тех, кто начинает тестировать Fabric и соседние продукты. Одна страница: что есть, где лежит, кто за что отвечает,
что готово к проверке.

## Что это

**Fabric**: настольное приложение (macOS, также Windows и Linux): один экран для всех проектов на компьютере и всех
кодинг-агентов в них (Claude Code, Codex, Gemini CLI и другие). Слева рейл: «Создать», Главная, Агенты, История,
Настройки, ниже проекты. Консоль агента открывается вкладкой прямо в окне. Почти любое действие можно отменить в Истории.

Скачать: [github.com/passioncode-ai/fabric/releases](https://github.com/passioncode-ai/fabric/releases), последняя
версия (DMG для macOS, установщик для Windows, AppImage или .deb для Linux).

Нужно на компьютере: Docker и Supabase CLI. На macOS это Docker Desktop или OrbStack и
`brew install supabase/tap/supabase`; на Windows Docker Desktop (WSL2), на Linux Docker Engine, и Supabase CLI по
[инструкции Supabase](https://supabase.com/docs/guides/local-development/cli/getting-started). Fabric сам поднимает свою
локальную базу при первом запуске; это занимает несколько минут.

## Репозитории и кто за что отвечает

Всё в организации [github.com/passioncode-ai](https://github.com/passioncode-ai).

| Репозиторий | Что это | Состояние |
|---|---|---|
| `fabric` | Само приложение Fabric: код, решения (`docs/adr/`), сценарии (`docs/ux/scenarios.md`), история версий (`CHANGELOG.md`) | основной продукт, выпускается версиями |
| `fabric-switchboard` | Менеджер аккаунтов Claude Code и Codex: переключение, квоты, группы проектов | бета |
| `fabric-dashboards` | Одно окно для всех локальных агентных сервисов: состояние, события, старт и стоп | работает |
| `fabric-inbox` | Почтовый клиент Fabric с автоматизацией | превью |
| `project-observatory-dashboard` | Observatory: следит за всеми проектами на машине, хранит ключи по имени | работает |
| `fabric-agent-contract` | Контракт: что делает агента совместимым с Fabric (схемы, проверки) | спецификация |
| `fabric-agent-adapter` | Плагин и npm-пакет, чтобы подключить любого агента к Fabric | работает |
| `fabric-vr` | Fabric на Meta Quest и телефоне | ранняя стадия |
| `okolos` | Расширение браузера: находит скрытые для ИИ-агента инструкции на страницах | работает |
| `passioncode-ai.github.io` | Сайт passioncode.ai | работает |

## Что проверять в первую очередь

1. Установка и первый запуск на чистой машине: Fabric поднимает базу и открывает Главную.
2. Добавить папку с проектами через «Создать»: проекты появляются на рейле.
3. Открыть консоль агента в проекте: вкладка сверху, агент работает с вашими настройками и MCP-серверами.
4. Остановить агента, затем «Отменить» в строке внизу или в Истории.
5. Настройки: «Разрешения агентов», «Запускать Fabric при входе в систему», список агентов на компьютере.
6. Агенты: агент, подключившийся сам из терминала, и «Отключить».

## Как сообщать об ошибке

Issue в нужном репозитории (для приложения: [passioncode-ai/fabric/issues](https://github.com/passioncode-ai/fabric/issues)):
версия Fabric (на macOS первый пункт меню «Fabric», «О программе»; иначе имя скачанного файла), система, шаги, что
ожидали, что получили, скриншот. Журнал приложения лежит в папке `logs` внутри папки данных Fabric, при сбое запуска
там же `startup-failure.log`: на macOS `~/Library/Application Support/@fabric/desktop/`, на Windows
`%APPDATA%\@fabric\desktop\`, на Linux `~/.config/@fabric/desktop/`.
