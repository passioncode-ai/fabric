// What the stand's screens read: one busy estate, with the long words, many rows and partial reads a real one has.
// Neutral names only (no person or client of the operator's).
import { boardEntries, cutBoard } from '../src/shared/board'
import { envelope } from '../src/shared/readEnvelope'
import { composeTaskBoard } from '../src/shared/taskBoard'
import type { Fixtures } from './fakeApi'
import { APP_SETTINGS_DEFAULTS } from '../src/shared/types'

const H = 3600_000
export const NOW = Date.parse('2026-11-16T12:00:00Z')
export const at = (hoursAgo: number): string => new Date(NOW - hoursAgo * H).toISOString()
const LONG = 'Перенести чтение доски в отдельный модуль и проверить, что ответы на запросы не теряются при перезапуске'
const PATH = 'apps/desktop/src/renderer/src/launch/VeryLongComponentNameThatDoesNotBreak.tsx'

export const project = { id: 'p1', name: 'atlas-desktop', displayName: 'Atlas', purpose: 'Командный доступ без потери контекста между агентами',
  repo_path: '/Users/example/DATA/atlas-desktop', status: 'active', created_at: at(900), estate_id: 'e1' }
export const projects = [project,
  { id: 'p2', name: 'media-house', displayName: 'Media house', purpose: 'Ролики и посты', repo_path: null, status: 'active', created_at: at(800), estate_id: 'e1' },
  { id: 'p3', name: 'store-listings', displayName: 'Store listings', purpose: null, repo_path: null, status: 'active', created_at: at(700), estate_id: 'e1' }]

export const agent = { sessionId: 's1', projectId: 'p1', projectName: 'Atlas', agent: 'claude-code', console: true, startedAt: at(5), lastSignAt: at(0.05), stale: false,
  doing: { text: LONG, note: 'тесты на чтение доски', step: 2, ofSteps: 4, at: at(0.2) },
  task: { id: 't1', projectId: 'p1', summary: 'Чтение доски отдельным модулем' }, branch: 'feat/board-read-module-with-a-long-branch-name', folder: '/Users/example/DATA/_worktrees/atlas-board-read' }

/** Two sessions of one project and one coding agent (the operator's screenshot of 2026-11-17 had two such tabs). The
 *  stand's `ended` flag ends the second. */
const consoleSession = (sessionId: string, startedAt: string, ended: boolean) => ({ sessionId, projectId: 'p1', cwd: '/Users/example/DATA/atlas-desktop/Atlas desktop app with a long folder name',
  program: 'claude', optionId: 'claude-code', permissionMode: 'fewer-prompts', excerpt: '', written: 4000, running: !ended, state: ended ? 'ended' : 'running', startedAt,
  lastActivityAt: at(0.05), lastOutputAt: at(0.05), tail: '', exitCode: ended ? 0 : null })
export const consoleEnded = new URLSearchParams(location.hash.slice(1)).get('screen') === 'console-ended'
export const consoleSessions = [consoleSession('c1', at(1.5), false), consoleSession('c2', at(1.47), consoleEnded)]

const task = (id: string, title: string, status: string, hours: number, over: Record<string, unknown> = {}) => ({
  id, project_id: 'p1', title, instruction: title, status, started_at: at(hours), finished_at: status === 'done' ? at(hours - 1) : null, moved_at: at(hours - 0.5),
  position: null, assigned_by: null, assigned_to: null, origin_kind: 'person', origin_ref: null, session_id: status === 'running' ? 's1' : null,
  brief_what: null, brief_why: null, brief_expected: null, brief_author: null, brief_draft: null, ...over })
export const tasks = [
  task('t1', 'Чтение доски отдельным модулем', 'running', 5, { brief_what: LONG, brief_why: 'Главный файл процесса вырос до 6 500 строк; чтение доски там не тестируется отдельно.', brief_expected: 'Модуль с тестом; поведение экрана не меняется.', brief_author: 'agent' }),
  task('t2', 'Ответы на запросы с доски доходят до адресата после перезапуска Fabric', 'review', 30),
  task('t3', `Длинный путь в заголовке: ${PATH}`, 'backlog', 50),
  task('t4', 'Проверка контраста в светлой теме', 'done', 70),
  task('t5', 'Удалить старый экран доски', 'cancelled', 90)
]

const sessionTask = (t: ReturnType<typeof task>, hours: number) => ({ taskId: t.id, projectId: 'p1', projectName: 'Atlas', summary: t.brief_what ?? t.title, title: t.title,
  releaseNote: t.status === 'review' ? 'Сдал на проверку: тесты зелёные, осталось проверить на установленной сборке.' : null,
  brief: { what: t.brief_what, why: t.brief_why, expected: t.brief_expected }, status: t.status, claimedAt: at(hours), releasedAt: t.status === 'running' ? null : at(hours - 1),
  releasedHow: t.status === 'review' ? 'done' : null, claims: 1, via: 'claim' })

const ev = (seq: number, type: string, hours: number, payload: Record<string, unknown> = {}) =>
  ({ estate_id: 'e1', seq, type, actor: { kind: 'agent', id: 's1' }, project_id: 'p1', occurred_at: at(hours), payload })
const history = [ev(9, 'work.claimed@1', 5, { taskId: 't1' }), ev(10, 'agent.stage.reported@1', 4, { stage: 'Читаю код доски', task: 't1', step: 1, of_steps: 4 }), ev(11, 'task.moved@1', 3, { taskId: 't2', to: 'review' }),
  ev(12, 'agent.stage.reported@1', 1, { stage: 'Пишу тест на чтение доски', task: 't1', step: 2, of_steps: 4, note: 'Тест падает на старом коде, как и должен' }), ev(13, 'work.claimed@1', 0.5, { taskId: 't1' })]

const question = (id: string, text: string, hours: number, options: unknown[] = []) => ({ id, projectId: 'p1', projectName: 'Atlas', text, kind: 'decision' as const,
  askedAt: at(hours), blocks: 1, servesActiveGoal: true, revision: 1, options })
const questions = [
  question('q1', 'Куда положить чтение доски: в main/boardRead.ts или в общий модуль чтений?', 2, [{ id: 'a', label: 'main/boardRead.ts', consequence: 'Один файл на один экран.', recommended: true }, { id: 'b', label: 'Общий модуль', consequence: 'Меньше файлов, но модуль растёт.' }]),
  question('q2', `Можно ли переименовать ${PATH}?`, 20),
  question('q3', 'Выпускать 0.3.22 сейчас или вместе с волной 5?', 40)
]
const review = (id: string, title: string, hours: number) => ({ kind: 'review', ref: { kind: 'task', id }, projectId: 'p1', projectName: 'Atlas', title, detail: 'Тесты зелёные; агент просит проверить на установленной сборке.', since: at(hours),
  handedIn: { taskId: id, by: 'claude-code', at: at(hours), note: 'Готово к проверке', checks: ['ci.sh fast'] } })
// «Нужны вы» decides every card in place (2026-11-16): an agent asking for access and a refused act it may be granted once.
const accessAsk = { requestId: 'r1', agent: { agentId: 'release-helper', name: 'Release helper', installedBy: 'Fabric', repository: 'example-org/release-helper' }, callee: 'fabric', product: 'Fabric', connected: true,
  ask: [{ kind: 'enroll', project: { id: 'p1', name: 'Atlas' } }], reason: 'Нужно собрать заметки к выпуску 0.3.22', incremental: false,
  enroll: { projectName: 'Atlas', folder: { root: '/Users/example/DATA/atlas-desktop', how: 'exact' } }, requestedAt: at(0.1), expiresAt: new Date(NOW + 8 * 60_000).toISOString() }
const access = { kind: 'access', ref: { kind: 'access-request', id: 'r1' }, projectId: 'p1', projectName: 'Atlas', title: 'Release helper просит работать в проекте Atlas', detail: null, since: at(0.1), access: accessAsk }
const refused = { kind: 'refused', ref: { kind: 'refusal', id: '41' }, projectId: 'p1', projectName: 'Atlas', title: 'Публикация пакета в npm остановлена', detail: 'Агент выпуска хотел опубликовать @example/atlas 0.3.22.', since: at(1),
  grantable: { floorClass: 'publication', target: 'npm:@example/atlas', askedBecause: 'Выпуск 0.3.22 готов, тесты зелёные.' } }
const entries = boardEntries({ questions: questions as never, attention: [access, refused, review('t2', tasks[1].title, 30), review('t6', 'Ссылки в ленте не раздвигают страницу', 80)] as never, projectWeightOf: () => 1, now: new Date(NOW) })
const boardRead = (q?: { limit?: number; personOnly?: boolean }) => envelope({ data: cutBoard(q?.personOnly ? entries.filter((e) => ['question', 'access', 'refused'].includes((e as { kind: string }).kind)) : entries, q?.limit ?? 20), sources: [{ name: 'questions', status: 'ok' as const, asOf: at(0) }], asOf: at(0), freshness: 'fresh' as const })

const homeView = { live: [agent], inWork: [{ taskId: 't1', projectId: 'p1', projectName: 'Atlas', summary: tasks[0].title, agent: 'claude-code', sessionId: 's1', console: true, since: at(5), doing: agent.doing }],
  review: [], done: [], projects: [{ projectId: 'p1', now: { text: LONG, agent: 'claude-code', at: at(0.2) }, live: 1, inWork: 1, review: 1, lastActivityAt: at(0.1) }], readAt: at(0) }

const day = (n: number) => { const d = new Date(NOW - n * 24 * H); return d.toISOString().slice(0, 10) }
export const feed = [...history, ev(6, 'task.created@1', 26, { taskId: 't3' }), ev(3, 'task.closed@1', 69, { taskId: 't4', outcome: 'done' }), ev(16, 'question.asked@1', 0.1, { questionId: 'q1' })]
const act = (seq: number, hours: number, kind: string, params: Record<string, string>, undo: unknown = { state: 'available' }) => ({ seq, occurredAt: at(hours), actor: { kind: 'person', id: 'operator' }, projectId: 'p1',
  record: { v: 1, kind, category: 'tasks', subject: { type: 'task', id: 't2', label: tasks[1].title }, said: { key: `act.${kind}`, params }, inverse: { kind, args: {} }, why_not: null, undoes: null, ref_seq: seq - 1 }, undo })

export const homeReading = { view: homeView, problem: null, readAt: at(0) }

const LOGIN_ITEM = { supported: true, platform: 'darwin', system: 'on' }

export const fixtures: Fixtures = {
  'work.session': { tasks: [sessionTask(tasks[0], 5), sessionTask(tasks[1], 30), sessionTask(tasks[3], 70)], capped: false,
    questions: [{ id: 'q1', projectId: 'p1', taskId: 't1', text: 'Куда положить чтение доски: в main/boardRead.ts или в общий модуль чтений?', why: 'От этого зависит, где будет тест.', kind: 'decision',
      options: [{ id: 'a', label: 'main/boardRead.ts', consequence: 'Один файл на один экран.', recommended: true }, { id: 'b', label: 'Общий модуль', consequence: 'Меньше файлов.' }], askedAt: at(2), revision: 1 }],
    runner: { id: 'claude-code', label: 'Claude Code', version: '2.4.1' } },
  'work.messages': [{ id: 'm1', text: 'Сначала сделай тест, потом перенос.', at: NOW - 2 * H, readAt: NOW - 1.9 * H }],
  'work.home': homeView,
  'work.sources': { rows: [], capped: false },
  'terminal.history': history,
  // The console screen (the operator, 2026-11-17): two sessions of one project and one coding agent, the second open. The
  // replay ends with a line the suite looks for at the bottom of the terminal, so a cut last line fails it.
  'terminal.resize': null,
  'terminal.write': null,
  'terminal.get': (id: string) => consoleSessions.find((s) => s.sessionId === id) ?? null,
  'terminal.scrollback': () => ({ text: Array.from({ length: 80 }, (_, i) => `строка ${i + 1}: агент читает репозиторий и пишет план`).join('\r\n') + '\r\nПОСЛЕДНЯЯ СТРОКА КОНСОЛИ', written: 4000 }),
  'tasks.detail': (id: string) => ({ task: tasks.find((t) => t.id === id) ?? tasks[0],
    notes: [{ id: 'n1', task_id: id, author_kind: 'agent', author_id: 's1', body_md: 'Попробовал вынести чтение целиком: ломается порядок подписки на журнал. Делаю **по одному чтению**.', promoted_fact_id: null, created_at: at(3) },
      { id: 'n2', task_id: id, author_kind: 'person', author_id: 'operator', body_md: `Ссылка на отчёт: https://example.com/${'very-long-segment-'.repeat(8)}`, promoted_fact_id: null, created_at: at(1) }],
    links: [{ task_id: id, rel: 'blocks', target_kind: 'task', target_id: 't3', target_title: tasks[2].title }], lease: { owner_session: 's1', expires_at: at(-0.5), write_scopes: ['apps/desktop/src/main'] },
    blockedBy: [{ id: 't4', title: tasks[3].title, status: 'done' }],
    events: history, siblings: { total: 4, shown: tasks.slice(1, 4).map((t) => ({ id: t.id, title: t.title, status: t.status })) } }),
  'board.query': boardRead,
  'board.deferred': envelope({ data: [], sources: [{ name: 'board', status: 'ok' as const, asOf: at(0) }], asOf: at(0), freshness: 'fresh' as const }),
  'board.resolved': envelope({ data: [], sources: [{ name: 'board', status: 'ok' as const, asOf: at(0) }], asOf: at(0), freshness: 'fresh' as const }),
  'goals.list': [{ id: 'g1', project_id: 'p1', title: 'Выпустить командный доступ к концу месяца', autonomy: 'safe', created_at: at(500) }],
  'agents.list': [],
  'comms.projectRequests': { requests: [], names: {}, capped: false, windowDays: 30 },
  'projects.analytics': { donePerWeek: [1, 3, 2, 5, 4, 6, 2, 7], leadHours: 26, reviewHours: 9, reopenedShare: 0.1, questionsWaiting: 3, oldestQuestionAt: at(40), weeks: 8 },
  'projects.relations': [],
  'projects.people': { people: [{ name: 'Разработчик проекта', email: null, commits: 214, lastAt: at(3) }, { name: 'Автор сборок', email: null, commits: 18, lastAt: at(120) }], unread: [], capped: false },
  'favourites.list': [],
  'attention.list': envelope({ data: [], sources: [{ name: 'attention', status: 'ok' as const, asOf: at(0) }], asOf: at(0), freshness: 'fresh' as const }),
  'comms.waiting': { ok: true, requests: 0, list: [], listComplete: true },
  'analytics.status': { availability: 'off' },
  'stack.exposure': null,
  'projects.graph': { nodes: [{ id: 'p1', name: 'Atlas', summary: 'Командный доступ без потери контекста', business: 'Example Co' }, { id: 'p2', name: 'Media house', summary: null, business: 'Example Co' },
    { id: 'p3', name: 'Store listings', summary: null, business: null }, { id: 'outside:x', name: 'Внешний сервис аналитики с длинным названием', summary: null, business: null, outside: true }],
    edges: [{ from: 'p1', to: 'p2', kind: 'depends-on' }, { from: 'p1', to: 'outside:x', kind: 'used-by' }, { from: 'p2', to: 'p3', kind: 'board', weight: 4 }], businesses: ['Example Co'] },
  'workspace.state': { path: '/Users/example/Fabric', git: 'yes' },
  'work.rhythm': { days: Array.from({ length: 28 }, (_, i) => ({ date: day(27 - i), events: i === 9 ? null : (i * 7) % 23 + 2, results: i === 9 ? null : i % 4, decisions: i === 9 ? null : i % 3, today: i === 27 })),
    totals: { results: 41, decisions: 26, events: 612 }, today: { results: 3, decisions: 2, events: 41 }, marksCapped: false, timeZone: 'Europe/Warsaw', readAt: at(0) },
  'releases.list': envelope({ data: [], sources: [{ name: 'releases', status: 'ok' as const, asOf: at(0) }], asOf: at(0), freshness: 'fresh' as const }),
  'routines.list': [],
  'acts.history': { rows: [act(30, 1, 'task.move', { task: tasks[1].title, from: 'running', to: 'review' }), act(28, 20, 'task.move', { task: tasks[2].title, from: 'backlog', to: 'running' }, { state: 'undone', by: 29 }),
    act(25, 50, 'task.move', { task: tasks[3].title, from: 'review', to: 'done' }, { state: 'cannot', why: 'задача уже закрыта' })], next: null },
  'tasks.list': { tasks, closed: { truncated: false, says: '' } },
  'work.board': composeTaskBoard({ home: { ...homeView, review: [{ taskId: 't2', projectId: 'p1', projectName: 'Atlas', summary: tasks[1].title, since: at(30) }], done: [{ taskId: 't4', projectId: 'p1', projectName: 'Atlas', summary: tasks[3].title, at: at(69) }] } as never,
    queued: tasks.filter((t) => t.status === 'backlog') as never, projects: [{ id: 'p1', name: 'Atlas' }], queuedLimit: 20 }),
  'comms.threadPage': { ok: true, more: false, threads: [
    { id: 'th1', subject: 'Перенос окна релиза на пятницу и что из этого следует для плана', participants: ['p1', 'p2'], createdBy: 'p2', createdSeq: 1, messageCount: 12, lastSeq: 40, lastAt: at(2), kinds: ['reply', 'request'], openRequests: 1 },
    { id: 'th2', subject: null, participants: ['p1', 'p3'], createdBy: 'p3', createdSeq: 4, messageCount: 2, lastSeq: 12, lastAt: at(30), kinds: ['message'], openRequests: 0 }] },
  'comms.list': { ok: true, lastSeq: 40, more: false, messages: [
    { id: 'm1', thread: 'th1', seq: 39, kind: 'request', at: at(3), sender: { project: 'p2', principal: { kind: 'agent', label: 'claude-code', provenance: 'trusted' } }, body: { text: 'Нужно сдвинуть окно релиза на **пятницу**.\n\n- проверить сборку\n- обновить план', format: 'text/markdown' },
      request: { id: 'r1', state: 'queued', effect: 'not_started', target: 'p1', capability: 'change.request' } },
    { id: 'm2', thread: 'th1', seq: 40, kind: 'reply', at: at(2), replyTo: 'm1', sender: { project: 'p1', principal: { kind: 'agent', label: 'codex', provenance: 'trusted' } }, body: { text: 'Принято, двигаю.' } }] },
  'comms.responders': { ok: true, responders: [] },
  'comms.pending': { ok: true, projects: [] },
  'comms.heads': { ok: true, heads: [] },
  'runs.status': envelope({ data: { taskId: 't1', taskTitle: tasks[0].title, runRef: 'r1', ordinal: 2, runState: 'active', runOutcome: null,
    claim: { phase: 'working', note: null, reportedAt: at(0.2), waitingOn: null }, observation: { liveness: 'working', reason: 'console printed 3 min ago', coverage: 'available', processRunning: true, lastOutputAt: at(0.05) },
    blockers: 0, steps: { done: 1, declared: 4, skipped: 0, failed: 0 } }, sources: [{ name: 'runs', status: 'ok' as const, asOf: at(0) }], asOf: at(0), freshness: 'fresh' as const }),
  'hub.overview': { hub: { listening: true, origin: 'http://127.0.0.1:47070' },
    products: [{ product: 'mail-reader', name: 'Mail reader', connection: { server: 'https://mail.example.invalid', level: 'read', connectedAt: at(50), keyExpiresAt: null }, lastAttempt: null }],
    pending: [
      { requestId: 'r1', agent: { agentId: 'release-helper', name: 'Release helper', installedBy: 'Fabric', repository: 'example-org/release-helper' }, callee: 'fabric', product: 'Fabric', connected: true,
        ask: [{ kind: 'enroll', project: { id: 'p1', name: 'Atlas' } }], reason: 'Нужно собрать заметки к выпуску 0.3.22 по задачам из apps/desktop/src/renderer/src/launch/VeryLongComponentNameThatDoesNotBreak.tsx',
        incremental: false, enroll: { projectName: 'Atlas', folder: { root: '/Users/example/DATA/atlas-desktop', how: 'exact' } }, requestedAt: at(0.1), expiresAt: new Date(NOW + 8 * 60_000).toISOString() },
      { requestId: 'r2', agent: { agentId: 'board-answerer', name: null, installedBy: null, repository: null }, callee: 'fabric', product: 'Fabric', connected: true,
        ask: [{ kind: 'respond', project: { id: 'p1', name: 'Atlas' }, capabilities: ['release.notes', 'review.summary'] }], reason: 'Отвечать на запросы проекта',
        incremental: true, respond: { projectName: 'Atlas', capabilities: ['release.notes', 'review.summary'] }, requestedAt: at(0.3), expiresAt: new Date(NOW + 2 * 60_000).toISOString() }
    ],
    agents: [{ bindingId: 'b1', agent: { agentId: 'claude-code', name: 'Claude Code', installedBy: 'Fabric', repository: null, codingAgent: true }, since: at(200),
      grants: [{ grantId: 'g1', callee: 'fabric', capability: 'session.enroll', resource: 'project:p1', line: { kind: 'enroll', project: { id: 'p1', name: 'Atlas' } }, expiresAt: new Date(NOW + 30 * 24 * 3_600_000).toISOString() },
        { grantId: 'g2', callee: 'fabric', capability: 'board.respond', resource: 'board:p1/release.notes', line: { kind: 'respond', project: { id: 'p1', name: 'Atlas' }, capabilities: ['release.notes'] }, expiresAt: new Date(NOW + 7 * 24 * 3_600_000).toISOString() }] }],
    denials: [{ requestId: 'r0', agent: { agentId: 'unknown-scraper', name: null, installedBy: null, repository: null }, callee: 'fabric', ask: [{ kind: 'resolve' }], deniedAt: at(30) }],
    keptOut: { readable: true, agents: [{ agentId: 'old-runner', name: 'Old runner', at: at(90) }] } },
  'start.executors': [{ id: 'claude-code', label: 'Claude Code', connected: true, state: 'found', version: '2.4.1', path: '/usr/local/bin/claude', install: null },
    { id: 'codex', label: 'Codex', connected: true, state: 'found', version: '0.160.0', path: '/usr/local/bin/codex', install: null }],
  'settings.agentCatalog': { source: 'absent', reason: 'not-installed', detail: null },
  'settings.loginItem': LOGIN_ITEM,
  'settings.folderTrustLocked': false,
  'settings.claudeInbound': { accepting: false, value: null },
  'settings.read': { ...APP_SETTINGS_DEFAULTS, locale: 'ru', runnerFallback: { order: [{ runner: 'claude-code', session: 'spawn' }, { runner: 'codex', session: 'spawn' }] } },
  'terminal.fallback': { configured: true, walk: { state: 'selected', index: 0, runner: 'claude-code', session: 'spawned', sessionId: null, permissionMode: null, passedOver: [] } },
  'terminal.options': [{ id: 'claude-code', label: 'Claude Code', program: 'claude', defaultMode: 'fewer-prompts', permissionModes: [{ id: 'fewer-prompts', args: ['--dangerously-skip-permissions'], env: {} }] },
    { id: 'codex', label: 'Codex', program: 'codex', defaultMode: 'fewer-prompts', permissionModes: [{ id: 'fewer-prompts', args: ['--full-auto'], env: {} }] }]
}
