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

import { ceoAddressRule, isCeoAddress } from './ceoAddress.ts'
import { heardDistance, heardClose, heardKeys, nameKeys, soundKey } from './heardName.ts'
import { isScratchFolder } from './scratchFolder.ts'

/** `stopped`: the person stopped it, and it stays stopped until the person starts it again (the owner, 2026-11-19). */
export type CeoState = 'idle' | 'starting' | 'running' | 'ended' | 'stopped' | 'failed'

/** Why the CEO did not start, as a code the window words (0.3.24 review, ER-7): every runner set aside, none of the
 *  order could start (`passedOver` says why for each), the CEO's project could not be read or made, or another failure
 *  (its raw detail stays in the operations log). */
export type CeoProblem = 'all-set-aside' | 'none-could-start' | 'project' | 'start-failed'

/** Why a message did not reach the CEO, as a code the window words (ER-7). */
export type CeoSendReason = 'empty-file' | 'too-big' | 'not-saved' | 'nothing-to-send' | 'not-running' | 'not-delivered' | 'queue-full' | 'delivery-unknown'
/** 2026-11-20 (the owner: «не отправляется сообщение из поп-апа … пишется, что сообщение не дошло»): a message the console
 *  did not take at once is kept, on disk, and typed when it can be; the window says it waits, never that it was lost. */
export const CEO_QUEUE_RETRY_MS = 10_000
/** At most this many messages wait for the CEO, in memory and on disk; a send past it is refused and said (0.3.27 review,
 *  run four, DA-32, ER-42). */
export const CEO_QUEUE_MAX = 50
/** A message waiting for the CEO: the line as typed, when it was sent, and whether it names files (UX-43). */
export interface QueuedLine { line: string; at: number; files?: boolean; retype?: boolean }

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
  /** Messages from the person kept for the console, not typed yet (CEO_QUEUE_RETRY_MS); absent or 0 when none wait. */
  queued?: number
}

/** A file the person attached: its name and its bytes as base64 (the window reads them; main keeps them in the inbox). */
export interface CeoAttachment { name: string; data: string }

/** `name` is the file an `empty-file` or `too-big` refusal is about. */
export interface CeoSendResult { ok: boolean; reason?: CeoSendReason; name?: string; status: CeoStatus; queued?: boolean }

/** One voice call's setup, as main hands it to the CEO window: an ephemeral secret, never the key. */
export type CeoVoiceSession =
  /** `callId`: the call's journal (`main/ceoVoiceJournal.ts`, voice CEO retro finding 1); the window writes its lines to it. */
  | { ok: true; token: string; expiresAt: number; url: string; usdPerMinute: number; instructions: string; voice: string; tools: unknown[]; callId?: string }
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

// #region dictation-tail — docs: docs/evidence/plans/2026-11-20-ceo-board-ux/owner-words.md#часть-5-2026-11-20-вечер-то-же-окно-ceo
/**
 * The owner, 2026-11-20 (relayed from the CEO window): «фраза «Продолжение следует» в конце его сообщений это хвост
 * диктовки, не обещание продолжения; CEO её игнорирует и выполняет сказанное как полное поручение». It was written by hand
 * into the CEO folder's CLAUDE.md, which Fabric writes again from `ceoBrief`; here it survives that, and the voice says the
 * same (`main/ceoVoice.ts#voiceInstructions`).
 */
export const DICTATION_TAIL = {
  ru: 'Владелец часто заканчивает голосовое сообщение фразой «Продолжение следует» (или похожей). Это хвост его диктовки, а не обещание продолжения: не жди продолжения, не упоминай фразу и не передавай её сессиям, выполняй сказанное до неё как полное поручение.',
  en: 'The owner often ends a dictated message with «Продолжение следует» ("to be continued") or the like. It is the tail of his dictation, not a promise of more: do not wait for more, do not mention it or pass it on to sessions, and carry out what came before it as the whole order.'
} as const
// #endregion dictation-tail

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
    '- `fabric_ceo_projects`: проекты Fabric с папками; имя ищется и на слух (кириллица, латиница, «DC» вместо «Диззи»).',
    '- `fabric_ceo_session_task`: дошла ли до запущенной сессии ее первая задача, и последние строки экрана.',
    '- `fabric_ceo_session_wait`: дождаться, пока сессия ответит (напечатала и затихла), и прочитать ответ; вместо того чтобы читать экран раз за разом.',
    '- `fabric_ceo_accounts`: аккаунты и подписки Switchboard, на которых можно запустить сессию в проекте, с остатком квоты; `fabric_ceo_session_start` с `account` запускает на выбранном.',
    '- `fabric_ceo_journal`: журнал поведения агентов (ADR-0203): что сделали ты, твой голос и сессии и по чьему слову, новое сверху.',
    '- `fabric_ceo_project_alias`: запомнить, как владелец называет проект, чтобы находить его по этому имени.',
    'Кроме них у тебя все серверы MCP этого компьютера: Observatory (проекты, папки, ключи по именам), Switchboard (аккаунты и сессии), Fabric Dashboards и другие.',
    '',
    '## Как работать',
    '',
    '1. Найди проект: `fabric_ceo_projects`, при необходимости Observatory.',
    '2. Найди его сессии: `fabric_ceo_sessions`.',
    '3. Делегируй: напиши в живую сессию или запусти новую с задачей. Код в чужих проектах сам не пиши: работу делают сессии проектов.',
    '4. Следи за ней (`fabric_ceo_session_read`) и отвечай на ее вопросы, когда ответ следует из решений владельца; иначе спроси владельца.',
    '5. Прежде чем остановить или убить сессию, прочитай ее и назови причину в поле `reason`.',
    '6. Что владелец поручил, доводишь до конца сам и через сессии: никто не сидит в ожидании. Решение, которое не его, оформи на доске (`com.submit`) и продолжай. Какие действия ждут его одобрения, говорит режим одобрения: поле `approval` в `fabric_whoami`, читай его перед тратой, удалением или публикацией и передавай сессиям. Вход в аккаунт, одноразовый код, оплата, секрет и экран согласия ждут человека всегда.',
    '',
    'Вложения владельца лежат в папке `inbox/` рядом; путь приходит в сообщении. Картинку открой инструментом чтения файла.',
    'Каждый голосовой звонок записан в `calls/` рядом (файл JSONL на звонок: реплики, вызовы инструментов, длительность и цена, секреты вырезаны). Просьба из звонка приходит тебе через ask_ceo; голос читает твой ответ, так что отвечай коротко и первым предложением по сути.',
    '',
    '## Слова владельца, которые не поручение',
    '',
    DICTATION_TAIL.ru,
    // The owner dictates into the composer too (0.3.27 review UX-71): the address words mean the CEO here as in the call.
    ceoAddressRule('ru', 'ceo'),
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
    '- `fabric_ceo_projects`: Fabric\'s projects with their folders; a name is also found by sound (Cyrillic, Latin, «DC» for «Диззи»).',
    '- `fabric_ceo_session_task`: whether a started session took its first task, and the last lines of its screen.',
    '- `fabric_ceo_session_wait`: wait until a session answers (printed, then went quiet) and read its answer, instead of reading its screen again and again.',
    '- `fabric_ceo_accounts`: the Switchboard accounts and subscriptions a session can start on in a project, with quota left; `fabric_ceo_session_start` with `account` starts on the chosen one.',
    '- `fabric_ceo_journal`: the agents\' behaviour journal (ADR-0203): what you, your voice and the sessions did, on whose word, newest first.',
    '- `fabric_ceo_project_alias`: remember what the owner calls a project, so it is found by that name.',
    'You also have every MCP server of this computer: Observatory (projects, folders, keys by name), Switchboard, Fabric Dashboards and others.',
    '',
    '## How to work',
    '',
    '1. Find the project. 2. Find its sessions. 3. Delegate: write to a live session or start one with the task; do not write code in other projects yourself.',
    '4. Watch it and answer its questions when the owner\'s decisions answer them; otherwise ask the owner.',
    '5. Before you stop or kill a session, read it and give the reason in `reason`.',
    '6. What the owner ordered you carry to the end, yourself and through sessions: nobody sits waiting. Put a decision that is not his on the board (`com.submit`) and go on. Which acts wait for his yes is his approval mode: the `approval` field of `fabric_whoami`; read it before spending, deleting or publishing, and pass it to the sessions. A sign-in, a one-time code, a payment, a secret and a consent screen always wait for the person.',
    '',
    'The owner\'s attachments are in `inbox/` next to you; the message names the path. Open an image with your file reading tool.',
    'Every voice call is kept in `calls/` next to you (one JSONL file a call: lines, tool calls, length and price, secrets cut). A request from a call reaches you through ask_ceo; the voice reads your answer aloud, so answer briefly, the point in the first sentence.',
    '',
    '## Words of the owner that are no order',
    '',
    DICTATION_TAIL.en,
    ceoAddressRule('en', 'ceo'),
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

export interface NamedProject { id: string; name: string; repo_path: string | null; aliases?: readonly string[] }

/** A folder a session works in and the project that holds it (a running console's, a launch's): an agent's worktree
 *  copy, which is no project of its own, is found through the project it belongs to (voice retro 2026-11-20, finding 4). */
export interface WorkFolder { path: string; projectId: string }

/** What `findProject` answers. `heard`: found by how the name sounds, not by its spelling, so the voice says which
 *  project it understood. `near`: the closest names to offer when nothing matched (finding 8). */
export type ProjectLookup<P> =
  | { found: P; heard?: true; worktree?: string }
  | { ambiguous: string[] }
  | { missing: true; near: string[]; why?: 'too-broad' | 'ceo-itself' }

/**
 * A project by what the CEO called it: its id, its folder (or a folder inside it), its exact name, a name that holds
 * the words, then, for a name heard by voice, by sound (`heardName.ts`: Cyrillic or Latin, «DC» for «Диззи», an alias
 * the owner gave). One match is found; several answer `ambiguous` with the closest first, so the CEO asks rather than
 * guesses; none answers `missing` with the nearest names.
 */
export function findProject<P extends NamedProject>(projects: readonly P[], query: string, folders: readonly WorkFolder[] = []): ProjectLookup<P> {
  let q = String(query ?? '').trim()
  if (!q) return { missing: true, near: [] }
  // The owner's words for the CEO itself («шеф», «SEO» …) are never a project (the owner, 2026-11-21).
  if (isCeoAddress(q)) return { missing: true, near: [], why: 'ceo-itself' }
  const byId = projects.find((p) => p.id === q)
  if (byId) return { found: byId }
  const label = (p: P): string => p.repo_path ? `${p.name} (${p.repo_path})` : p.name
  // A choice read back as offered, «name (folder)» (0.3.27 review, UX-3): the folder in it decides.
  const offered = /^(.+?)\s+\((\/[^()]+)\)$/.exec(q)
  if (offered) {
    const folder = offered[2]!.replace(/\/+$/, '')
    const one = projects.find((p) => p.repo_path && p.repo_path.replace(/\/+$/, '') === folder)
    if (one) return { found: one }
    q = offered[1]!.trim()
  }
  if (q.startsWith('/') || q.startsWith('~')) {
    // A folder: the project that holds it, the deepest first (a subfolder or a worktree under the project's own folder).
    // Never a match by words: every project's folder starts with the home folder (2026-11-20: «/Users/…» named 30).
    const folder = q.replace(/\/+$/, '')
    const holds = (root: string): boolean => folder === root || folder.startsWith(root + '/')
    // A project whose folder is the home folder or a root holds no folder for the CEO (0.3.27 review, DO-1, DO-29): it would
    // take every new folder under home.
    // A project's own folder is that project, whatever is below it (0.3.26's rule; 0.3.27 review, PL-9).
    // The home folder or a root is never a project's folder, even for a project kept from before (ER-28).
    const homeOrRoot = (root: string): boolean => root === '' || root === '/' || /^\/(Users|home)\/[^/]+$/.test(root)
    const exactFolder = homeOrRoot(folder) ? undefined : projects.find((p) => p.repo_path && p.repo_path.replace(/\/+$/, '') === folder)
    if (exactFolder) return { found: exactFolder }
    // Only the home folder or a root is no holder; otherwise the deepest registered project holding the folder is its project,
    // whatever else it holds (0.3.27 review, ER-24, ER-30): a folder inside a project is that project's.
    const broad = (root: string): boolean => homeOrRoot(root)
    const byFolder = projects.filter((p) => p.repo_path && !broad(p.repo_path.replace(/\/+$/, '')) && holds(p.repo_path.replace(/\/+$/, '')))
      .sort((a, b) => b.repo_path!.length - a.repo_path!.length)
    if (byFolder.length) return { found: byFolder[0]! }
    const worked = folders.filter((f) => holds(f.path.replace(/\/+$/, ''))).sort((a, b) => b.path.length - a.path.length)
    const owner = worked.length ? projects.find((p) => p.id === worked[0]!.projectId) : undefined
    if (owner) return { found: owner, worktree: worked[0]!.path }
    // Too broad: the home folder or a root, or a folder holding two projects or more (0.3.27 review, ER-9: one registered
    // worktree under a folder does not make that folder too broad).
    const below = projects.filter((p) => p.repo_path && !isCopyFolder(p.repo_path) && p.repo_path.startsWith(folder + '/')).length
    const tooBroad = /^\/(Users|home)\/[^/]+$/.test(folder) || folder === '' || below >= 2 ? 'too-broad' as const : undefined
    return { missing: true, near: [], ...(tooBroad ? { why: tooBroad } : {}) }
  }
  // 2026-11-20: a name heard by voice is «sound engine» for «sound-engine»; spaces, hyphens and underscores read alike.
  const low = nameKey(q)
  // Of several with the same name, the one outside an agent's worktree and outside a cache or temporary folder is the
  // project the person means (the estate holds such copies under the same name until they are cleaned away).
  const settle = (list: P[]): P[] => {
    if (list.length < 2) return list
    const main = list.filter((p) => !p.repo_path || (!WORKTREE_FOLDER.test(p.repo_path) && !isScratchFolder(p.repo_path)))
    return main.length >= 1 ? main : list
  }
  const exact = settle(projects.filter((p) => nameKey(p.name) === low || (p.aliases ?? []).some((a) => nameKey(a) === low)))
  if (exact.length === 1) return { found: exact[0]! }
  const folderName = settle(projects.filter((p) => p.repo_path && nameKey(p.repo_path.replace(/\/+$/, '').split('/').pop() ?? '') === low))
  if (exact.length === 0 && folderName.length === 1) return { found: folderName[0]! }
  // A worktree named in full by its folder (0.3.27 review, ER-29): before the words, which a project's path could match.
  if (exact.length === 0 && folderName.length === 0) {
    const tail = nameKey(q.replace(/\/+$/, '').split('/').pop() ?? '')
    const tailOf = (f: WorkFolder): string => nameKey(f.path.replace(/\/+$/, '').split('/').pop() ?? '')
    const owners = new Set(folders.filter((f) => tailOf(f) === tail).map((f) => f.projectId))
    if (owners.size === 1) {
      const owner = projects.find((p) => p.id === [...owners][0])
      const wt = folders.find((f) => f.projectId === owner?.id && tailOf(f) === tail)
      if (owner) return { found: owner, ...(wt && wt.path.replace(/\/+$/, '') !== owner.repo_path?.replace(/\/+$/, '') ? { worktree: wt.path } : {}) }
    }
  }
  const words = q.toLowerCase().split(/[\s_-]+/).filter(Boolean)
  const partial = settle(projects.filter((p) => {
    const hay = `${p.name} ${p.repo_path ?? ''}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  }))
  if (exact.length === 0 && partial.length === 1) return { found: partial[0]! }
  if (partial.length > 1 || exact.length > 1) return { ambiguous: (exact.length > 1 ? exact : rankBySound(q, partial)).slice(0, 10).map(label) }
  // An agent's worktree folder named by its last part («sound-engine-task-runner»): the project that works there.
  // After the words (0.3.27 review, UX-28): a project the words find wins over a worktree's last words.
  if (exact.length === 0 && folderName.length === 0 && partial.length === 0) {
    const tail = nameKey(q.replace(/\/+$/, '').split('/').pop() ?? '')
    const tailOf = (f: WorkFolder): string => nameKey(f.path.replace(/\/+$/, '').split('/').pop() ?? '')
    let owners = new Set(folders.filter((f) => tailOf(f) === tail).map((f) => f.projectId))
    // «task-runner» for the worktree folder «sound-engine-task-runner» (0.3.27 review, UX-5): its last words.
    if (owners.size === 0 && tail.length >= 4) owners = new Set(folders.filter((f) => tailOf(f).endsWith(`-${tail}`)).map((f) => f.projectId))
    // Found through an agent's worktree: said, so a start refuses rather than opening the main folder (0.3.27 review, UX-15).
    if (owners.size === 1) {
      const owner = projects.find((p) => p.id === [...owners][0])
      const wt = folders.find((f) => f.projectId === owner?.id && (tailOf(f) === tail || tailOf(f).endsWith(`-${tail}`)))
      // A copy registered as its own project is its own folder, no worktree of itself (UX-29).
      if (owner) return { found: owner, ...(wt && wt.path.replace(/\/+$/, '') !== owner.repo_path?.replace(/\/+$/, '') ? { worktree: wt.path } : {}) }
    }
  }
  // By sound: the name as transcription wrote it. The best tier wins: a whole name or alias before a run of its words.
  const ranked = soundCandidates(q, projects)
  const close = ranked.filter((r) => r.close)
  if (close.length) {
    const best = close[0]!
    const tier = settle(close.filter((r) => r.tier === best.tier && r.distance <= best.distance + 0.05).map((r) => r.project))
    if (tier.length === 1) return { found: tier[0]!, heard: true }
    return { ambiguous: tier.slice(0, 10).map(label) }
  }
  // Only names near enough to be what was meant, each once (0.3.27 review, UX-5): a far name invites a guess.
  const near = [...new Set(ranked.filter((r) => r.distance <= NEAR_DISTANCE).map((r) => r.project.name))].slice(0, 3)
  return { missing: true, near }
}

/** How far a name may sound from the query and still be offered as near. */
const NEAR_DISTANCE = 0.5

/** A copy of a project (an agent's worktree, a cache or temporary folder): another project of the same name wins. */
export function isCopyFolder(folder: string | null): boolean {
  return !!folder && (WORKTREE_FOLDER.test(folder) || isScratchFolder(folder))
}

/** Projects ranked by how close each sounds to the query: tier 0 its whole name, folder or alias, tier 1 a run of its words. */
function soundCandidates<P extends NamedProject>(query: string, projects: readonly P[]): Array<{ project: P; distance: number; tier: number; close: boolean }> {
  const heard = heardKeys(query)
  const out: Array<{ project: P; distance: number; tier: number; close: boolean }> = []
  for (const p of projects) {
    const whole = nameKeys(p.name, p.repo_path, p.aliases)
    const full = new Set([soundKey(p.name), soundKey(p.repo_path?.replace(/\/+$/, '').split('/').pop() ?? ''), ...(p.aliases ?? []).map(soundKey)])
    let best = { distance: 1, tier: 2, close: false }
    for (const h of heard) {
      for (const k of whole) {
        const tier = full.has(k) ? 0 : 1
        const distance = heardDistance(h, k)
        const close = heardClose(h, k)
        if (close && (!best.close || tier < best.tier || (tier === best.tier && distance < best.distance))) best = { distance, tier, close }
        else if (!best.close && distance < best.distance) best = { distance, tier, close }
      }
    }
    out.push({ project: p, ...best })
  }
  return out.sort((a, b) => Number(b.close) - Number(a.close) || a.tier - b.tier || a.distance - b.distance)
}

/** Several matches by words, the closest by sound first. */
function rankBySound<P extends NamedProject>(query: string, list: readonly P[]): P[] {
  return soundCandidates(query, list).map((r) => r.project)
}

/** A project's name as the CEO compares it: lower case, runs of spaces, hyphens and underscores as one hyphen. */
function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, '-')
}
/** An agent's working copy: a `_worktrees/<task>` folder beside the projects, or a Claude Code or Git worktree. */
const WORKTREE_FOLDER = /\/(_worktrees|\.claude\/worktrees|\.worktrees)\//
// #endregion ceo-agent-shared
