// #region ceo-agent-shared — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#decision
/**
 * The CEO agent's pure half (ADR-0197): which runners it may run on and in what order, the brief written into its
 * folder, the line a message becomes in its console, the keys a session can be sent, and the screen a console shows,
 * read as text. Bundled into the main process and the tests; nothing here reads the machine.
 *
 * THE CEO IS A SESSION (ADR-0123): a console Fabric keeps, in a folder of its own, whose runner the person can see in
 * the popup's head. A message from the home composer or the popup is typed into that console; an attachment is a file
 * in its inbox, named in the line. Claude Code is tried first; when it cannot start (not installed, signed out, a spawn
 * that failed) the next runner of the order runs it (Hermes on OpenRouter by default), so the CEO answers on any day.
 */

/** `stopped`: the person stopped it, and it stays stopped until the person starts it again (the owner, 2026-11-19). */
export type CeoState = 'idle' | 'starting' | 'running' | 'ended' | 'stopped' | 'failed'

/** Why the CEO did not start, as a code the window words (0.3.24 review, ER-7): every runner set aside, none of the
 *  order could start (`passedOver` says why for each), the CEO's project could not be read or made, or another failure
 *  (its raw detail stays in the operations log). */
export type CeoProblem = 'all-set-aside' | 'none-could-start' | 'project' | 'start-failed'

/** Why a message did not reach the CEO, as a code the window words (ER-7). */
export type CeoSendReason = 'empty-file' | 'too-big' | 'not-saved' | 'nothing-to-send' | 'not-running' | 'not-delivered'

/** What the popup's head and the home composer read of the CEO's console. */
export interface CeoStatus {
  state: CeoState
  sessionId: string | null
  /** The runner the console runs: the catalogue id the window words (`runnerLabel`). */
  runner: string | null
  /** The models it was started with, best first (Claude Code takes the first Anthropic one). */
  models: string[]
  /** Runners passed over on the way to this one, each with why (the walk's probe result). */
  passedOver: Array<{ runner: string; result: string }>
  /** Runners set aside after a limit or a failed start, until when (ms). */
  setAside: Array<{ runner: string; until: number; why: string }>
  folder: string
  /** Why it is `failed`; its raw detail is in the operations log only. */
  problem: CeoProblem | null
}

/** A file the person attached: its name and its bytes as base64 (the window reads them; main keeps them in the inbox). */
export interface CeoAttachment { name: string; data: string }

/** `name` is the file an `empty-file` or `too-big` refusal is about. */
export interface CeoSendResult { ok: boolean; reason?: CeoSendReason; name?: string; status: CeoStatus }

/** One voice call's setup, as main hands it to the CEO window: an ephemeral secret, never the key. */
export type CeoVoiceSession =
  | { ok: true; token: string; expiresAt: number; url: string; usdPerMinute: number; instructions: string; voice: string; tools: unknown[] }
  | { ok: false; reason: CeoVoiceProblem }

/** Why main could not set a call up, as a code the window words (ER-7): no xAI key in Observatory's vault, xAI refused
 *  the key, xAI did not answer, or answered without a secret. The raw detail stays in the operations log. */
export type CeoVoiceProblem = 'no-key' | 'refused' | 'unreachable' | 'no-secret'

/** The order the CEO's console walks (the operator, 2026-11-18: «не только на подписке Claude, обязательный fallback»). Kimi
 *  Code and Codex are not in it: their models are not held to the CEO's floor below. */
export const CEO_RUNNERS_DEFAULT: readonly string[] = ['claude-code', 'hermes']

/** The runners a CEO order may name: the ones whose model Fabric can hold to the floor (Claude Code by `--model`, Hermes
 *  by its ACP session's `session/set_model`). */
export const CEO_RUNNERS_KNOWN: readonly string[] = ['claude-code', 'hermes']

/**
 * The CEO's models, best first (the operator, 2026-11-18, ~22:10: «модель минимум сонет на разговор CEO но лучше OPUS или
 * GPT SOL ... под его оркестрацию»): Opus 5.5, then GPT-6.2 Sol, never below Sonnet 5.5. One list for every runner: Claude
 * Code takes its first Anthropic model as `--model`, Hermes tries them in order on its OpenRouter key. An OpenAI model
 * answers on an organization's OpenRouter key only through BYOK, for keys Observatory issued: a model Hermes's ACP
 * session refuses at `session/set_model` falls to the next; a 403 at the first turn is not caught yet (0.3.24 review, ER-9).
 */
export const CEO_MODELS_DEFAULT: readonly string[] = ['anthropic/claude-opus-5.5', 'openai/gpt-6.2-sol', 'anthropic/claude-sonnet-5.5']

const version = (v: string): number => {
  const [major = '0', minor = '0'] = v.split('.')
  return Number(major) + Number(minor) / 100
}

/** Whether a model is at or above the CEO's floor (Sonnet 5.5): Opus or Sonnet from 5.5, GPT Sol from 6. */
export function ceoModelAllowed(model: string): boolean {
  const m = String(model ?? '').trim().toLowerCase()
  const claude = /^anthropic\/claude-(opus|sonnet)-(\d+(?:\.\d+)?)$/.exec(m)
  if (claude) return version(claude[2]!) >= version('5.5')
  const sol = /^openai\/gpt-(\d+(?:\.\d+)?)-sol$/.exec(m)
  if (sol) return version(sol[1]!) >= version('6')
  return false
}

/** A settings value as the CEO's models: allowed ones only, each once; nothing allowed is the default list. */
export function ceoModelsOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...CEO_MODELS_DEFAULT]
  const out: string[] = []
  for (const m of raw) if (typeof m === 'string' && ceoModelAllowed(m) && !out.includes(m.trim())) out.push(m.trim())
  return out.length ? out.slice(0, 6) : [...CEO_MODELS_DEFAULT]
}

/** Claude Code's `--model` for the CEO: its alias for the first Anthropic model of the list, `opus` when there is none. */
export function claudeModelFlag(models: readonly string[]): string {
  const first = models.find((m) => m.startsWith('anthropic/'))
  return first && /claude-sonnet-/.test(first) ? 'sonnet' : 'opus'
}

/** What a runner is given so the CEO runs on its models: Claude Code an argument, Hermes the list for its ACP session. */
export function ceoLaunchExtras(runner: string, models: readonly string[]): { args: string[]; env: Record<string, string> } {
  if (runner === 'claude-code') return { args: ['--model', claudeModelFlag(models)], env: {} }
  if (runner === 'hermes') return { args: [], env: { FABRIC_ACP_MODELS: models.join(',') } }
  return { args: [], env: {} }
}

const MAX_RUNNERS = 8

/** A settings value as a CEO order: known runners, each once, at most eight; anything else is the default order. */
export function ceoRunnersOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...CEO_RUNNERS_DEFAULT]
  const out: string[] = []
  for (const r of raw) if (typeof r === 'string' && CEO_RUNNERS_KNOWN.includes(r) && !out.includes(r)) out.push(r)
  return out.length ? out.slice(0, MAX_RUNNERS) : [...CEO_RUNNERS_DEFAULT]
}

/** The name the CEO's project carries in the estate (a project is what a console runs in). */
export const CEO_PROJECT_NAME = 'Fabric CEO'

/** The folder's brief: CLAUDE.md for Claude Code, AGENTS.md for Hermes; the same words in both. */
export function ceoBrief(opts: { locale: string }): string {
  const ru = opts.locale !== 'en'
  const lines = ru ? [
    '# Ты CEO этого компьютера (Fabric)',
    '',
    'Ты управляешь всей разработкой на этом компьютере. Владелец говорит с тобой из окна Fabric: текстом, вложениями и голосом.',
    'Отвечай по-русски, коротко и по делу. Никогда не ставь длинное тире: вместо него точка, запятая, двоеточие или скобки.',
    '',
    '## Инструменты',
    '',
    'Сервер MCP Fabric этой сессии дает тебе управление сессиями компьютера (у Hermes его имя `fabric_` и восемь знаков). Другой сервер `fabric` из твоих собственных настроек принадлежит другому Fabric: не вызывай его.',
    '- `fabric_ceo_sessions`: все сессии компьютера, консоли Fabric и сессии Switchboard, с проектом, папкой и состоянием.',
    '- `fabric_ceo_session_read`: что сейчас на экране сессии или последние реплики ее агента.',
    '- `fabric_ceo_session_input`: ввести текст или нажать клавиши в консоли Fabric (ответ на вопрос, выбор пункта, Enter).',
    '- `fabric_ceo_session_start`: запустить сессию в проекте (по имени, id или папке) с первой задачей.',
    '- `fabric_ceo_session_stop`: остановить сессию; `force: true` убивает ее.',
    '- `fabric_ceo_session_resume`: продолжить законченную сессию.',
    '- `fabric_ceo_session_open`: открыть консоль сессии владельцу в окне Fabric.',
    '- `fabric_ceo_launches`: журнал запусков на диске: кто и откуда запустил сессию, цепочка, ветка, id для `claude --resume` и чем она закончилась (так находятся сессии, оборванные перезапуском).',
    '- `fabric_ceo_projects`: проекты Fabric с папками.',
    'Кроме них у тебя все серверы MCP этого компьютера: Observatory (проекты, папки, ключи по именам), Switchboard (аккаунты и сессии), Fabric Dashboards и другие.',
    '',
    '## Как работать',
    '',
    '1. Найди проект: `fabric_ceo_projects`, при необходимости Observatory.',
    '2. Найди его сессии: `fabric_ceo_sessions`.',
    '3. Делегируй: напиши в живую сессию или запусти новую с задачей. Код в чужих проектах сам не пиши: работу делают сессии проектов.',
    '4. Следи за ней (`fabric_ceo_session_read`) и отвечай на ее вопросы, когда ответ следует из решений владельца; иначе спроси владельца.',
    '5. Прежде чем остановить или убить сессию, прочитай ее и назови причину в поле `reason`.',
    '',
    'Вложения владельца лежат в папке `inbox/` рядом; путь приходит в сообщении. Картинку открой инструментом чтения файла.',
    '',
    '## Задачи от PM-агентов',
    '',
    'PM-агенты ставят тебе задачи через доску Fabric. В начале работы вызови `com.enroll` с capability `ceo.task`, затем `com.list` с `unread: true`.',
    'Запрос возьми `com.claim`, делегируй как выше, ответь `com.reply` и закрой `com.complete`. Когда Fabric пишет тебе о новом запросе, сделай то же.'
  ] : [
    '# You are the CEO of this computer (Fabric)',
    '',
    'You run all development on this computer. The owner talks to you from the Fabric window: text, attachments and voice.',
    'Answer briefly and to the point. Never write an em dash: use a full stop, comma, colon or parentheses.',
    '',
    '## Tools',
    '',
    'This session\'s Fabric MCP server gives you this computer\'s sessions (under Hermes it is named `fabric_` and eight characters). Another `fabric` server from your own configuration belongs to another Fabric: never call it.',
    '- `fabric_ceo_sessions`: every session here, Fabric consoles and Switchboard sessions, with project, folder and state.',
    '- `fabric_ceo_session_read`: what a session\'s screen shows now, or its agent\'s last turns.',
    '- `fabric_ceo_session_input`: type text or press keys in a Fabric console (answer a question, pick an option, Enter).',
    '- `fabric_ceo_session_start`: start a session in a project (by name, id or folder) with a first task.',
    '- `fabric_ceo_session_stop`: stop a session; `force: true` kills it.',
    '- `fabric_ceo_session_resume`: continue a session that ended.',
    '- `fabric_ceo_session_open`: open a session\'s console for the owner in a Fabric window.',
    '- `fabric_ceo_launches`: the launch journal on disk: who started a session and from where, the chain, branch, the id for `claude --resume` and how it ended (this is how sessions cut by a restart are found).',
    '- `fabric_ceo_projects`: Fabric\'s projects with their folders.',
    'You also have every MCP server of this computer: Observatory (projects, folders, keys by name), Switchboard, Fabric Dashboards and others.',
    '',
    '## How to work',
    '',
    '1. Find the project. 2. Find its sessions. 3. Delegate: write to a live session or start one with the task; do not write code in other projects yourself.',
    '4. Watch it and answer its questions when the owner\'s decisions answer them; otherwise ask the owner.',
    '5. Before you stop or kill a session, read it and give the reason in `reason`.',
    '',
    'The owner\'s attachments are in `inbox/` next to you; the message names the path. Open an image with your file reading tool.',
    '',
    '## Tasks from PM agents',
    '',
    'PM agents give you tasks on Fabric\'s board. At the start call `com.enroll` with capability `ceo.task`, then `com.list` with `unread: true`.',
    'Take a request with `com.claim`, delegate as above, answer with `com.reply` and close it with `com.complete`.'
  ]
  return `${lines.join('\n')}\n`
}

/** The capability the CEO answers on the board (the PM chain, task ff3fe9c3). */
export const CEO_BOARD_CAPABILITY = 'ceo.task'

/** A board request as the CEO's nudge reads it (`shared/workDirections.ts#ProjectRequest`, narrowed). */
export interface CeoBoardRequest { requestId: string; to: string; capability: string; subject: string | null; state: string | null; from: string | null }

/**
 * The requests a PM agent gave the CEO that wait and that the CEO was not told about yet (the PM chain): addressed to the
 * CEO's project, capability `ceo.task`, not taken (queued, or never moved). Its line, typed into the CEO's console, or
 * null when nothing new waits.
 */
export function ceoBoardNudge(requests: readonly CeoBoardRequest[], projectId: string, told: ReadonlySet<string>, names: Readonly<Record<string, string>> = {}):
  { line: string; ids: string[] } | null {
  const fresh = requests.filter((r) => r.to === projectId && r.capability === CEO_BOARD_CAPABILITY && (r.state === null || r.state === 'queued') && !told.has(r.requestId))
  if (!fresh.length) return null
  const list = fresh.slice(0, 5).map((r) => `«${(r.subject ?? r.capability).slice(0, 120)}»${r.from ? ` от ${names[r.from] ?? r.from}` : ''} (${r.requestId})`).join('; ')
  return {
    ids: fresh.map((r) => r.requestId),
    line: `На доске ждут задачи для CEO (${fresh.length}): ${list}. Возьми их: com.list с unread: true, com.claim, делегируй сессиям, ответь com.reply и закрой com.complete.`
  }
}

const MAX_TEXT = 8000

/**
 * The line a message becomes in the CEO's console: the person's words, then the attachments by path. Never empty when
 * either is given; null when both are (nothing to send).
 */
export function ceoLine(text: string, attachments: readonly string[], locale: string): string | null {
  const words = String(text ?? '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_TEXT)
  const paths = attachments.filter((p) => typeof p === 'string' && p.trim()).slice(0, 10)
  if (!words && paths.length === 0) return null
  const named = paths.length
    ? `${words ? '\n\n' : ''}${locale === 'en' ? 'Attached' : 'Вложения'}: ${paths.join(', ')}`
    : ''
  return `${words}${named}`
}

/** A file name the inbox keeps: letters, digits, dot, dash and underscore; the extension kept; never a path. */
export function inboxName(name: string, now: number, index: number): string {
  const base = String(name ?? '').split(/[\\/]/).pop() ?? ''
  const clean = base.normalize('NFKD').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').slice(-80)
  const stamp = new Date(now).toISOString().replace(/[:.]/g, '-')
  return `${stamp}-${index}-${clean || 'file'}`
}

/** The keys a session can be sent by name, and the bytes a terminal reads for each. */
export const SESSION_KEYS: Readonly<Record<string, string>> = {
  enter: '\r',
  escape: '\x1b',
  tab: '\t',
  backspace: '\x7f',
  space: ' ',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  'ctrl-c': '\x03',
  'ctrl-d': '\x04'
}

/** A key by name, a single digit or a single letter; null for anything else (never raw control bytes from a model). */
export function keyBytes(key: string): string | null {
  const k = String(key ?? '').trim().toLowerCase()
  if (k in SESSION_KEYS) return SESSION_KEYS[k]!
  if (/^[0-9a-z]$/.test(k)) return k
  return null
}

/** Text typed into a session: printable characters and line breaks only; control bytes are dropped. */
export function typedText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return String(text ?? '').replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').slice(0, MAX_TEXT)
}

/**
 * A console's screen as text: the decoded output's last `lines` lines that are not blank, a repeated line once. The
 * decoder is the one the transcript and the agents screen use (`pty-decode.ts`), passed in so this stays pure.
 */
export function screenText(decoded: string, lines = 60): string {
  const out: string[] = []
  for (const raw of decoded.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) continue
    if (out[out.length - 1] === line) continue
    out.push(line)
  }
  return out.slice(-Math.max(1, Math.min(400, lines))).join('\n')
}

export interface NamedProject { id: string; name: string; repo_path: string | null }

/**
 * A project by what the CEO called it: its id, its folder, its exact name, then a name that contains the words (one
 * match only). Two matches answer `ambiguous` with their names, so the CEO asks rather than guesses.
 */
export function findProject<P extends NamedProject>(projects: readonly P[], query: string):
  | { found: P }
  | { ambiguous: string[] }
  | { missing: true } {
  const q = String(query ?? '').trim()
  if (!q) return { missing: true }
  const byId = projects.find((p) => p.id === q)
  if (byId) return { found: byId }
  const folder = q.replace(/\/+$/, '')
  const byFolder = projects.find((p) => p.repo_path && p.repo_path.replace(/\/+$/, '') === folder)
  if (byFolder) return { found: byFolder }
  // 2026-11-20: a name heard by voice is «sound engine» for «sound-engine»; spaces, hyphens and underscores read alike.
  const low = nameKey(q)
  // Of several with the same name, the one outside an agent's worktree is the project the person means (the
  // estate holds worktree copies under the same name until they are merged away).
  const settle = (list: P[]): P[] => {
    if (list.length < 2) return list
    const main = list.filter((p) => !p.repo_path || !WORKTREE_FOLDER.test(p.repo_path))
    return main.length >= 1 ? main : list
  }
  const exact = settle(projects.filter((p) => nameKey(p.name) === low))
  if (exact.length === 1) return { found: exact[0]! }
  const folderName = settle(projects.filter((p) => p.repo_path && nameKey(p.repo_path.replace(/\/+$/, '').split('/').pop() ?? '') === low))
  if (exact.length === 0 && folderName.length === 1) return { found: folderName[0]! }
  const words = q.toLowerCase().split(/[\s_-]+/).filter(Boolean)
  const partial = projects.filter((p) => {
    const hay = `${p.name} ${p.repo_path ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  if (partial.length === 1) return { found: partial[0]! }
  if (partial.length > 1 || exact.length > 1) return { ambiguous: (exact.length > 1 ? exact : partial).slice(0, 10).map((p) => p.repo_path ? `${p.name} (${p.repo_path})` : p.name) }
  return { missing: true }
}

/** A project's name as the CEO compares it: lower case, runs of spaces, hyphens and underscores as one hyphen. */
function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, '-')
}
/** An agent's working copy: `~/DATA/_worktrees/<task>` (the operator's rule) or a Claude Code worktree. */
const WORKTREE_FOLDER = /\/(_worktrees|\.claude\/worktrees|\.worktrees)\//
// #endregion ceo-agent-shared
