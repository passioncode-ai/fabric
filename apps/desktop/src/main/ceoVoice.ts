// #region ceo-voice — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#the-voice-call
/**
 * The voice call's main-process half (ADR-0197, the voice call, board task e7ff5556): the xAI key never leaves this process. It is
 * the person's own key (`ceoVoiceKey.ts`) or else Project Observatory's vault for one call (`observatoryVault.ts`, slot
 * `fabric/prod/XAI_API_KEY`), spent
 * on an ephemeral client secret (`POST /v1/realtime/client_secrets`, five minutes); the CEO window opens the realtime
 * socket with that secret alone. The call's instructions and tools are composed here, so the window holds no prompt
 * of its own, and every tool the call asks for runs here through the CEO's operations (`ceoTools.ts`) with their gates.
 */
import { DEFAULT_APPROVAL_MODE, approvalRule, type ApprovalMode } from '../shared/approvalMode.ts'
import type { VaultPort } from './observatoryVault.ts'
import type { CeoVoiceProblem } from '../shared/ceoAgent.ts'

export const XAI_KEY_SLOT = { project: 'fabric', env: 'prod' as const, name: 'XAI_API_KEY' }
export const XAI_SECRETS_URL = 'https://api.x.ai/v1/realtime/client_secrets'
export const XAI_REALTIME_URL = 'wss://api.x.ai/v1/realtime?model=grok-voice-latest'
/** xAI's list price for a realtime minute, shown beside the call's length: USD 0.08 a minute, from
 *  `docs.x.ai/developers/models/voice-agent-api`, fetched 2026-11-19 (docs/architecture/external-contracts.md, xAI). */
export const XAI_USD_PER_MINUTE = 0.08
const TOKEN_SECONDS = 300

export interface VoiceToken { ok: true; value: string; expiresAt: number; url: string; usdPerMinute: number }
/** A refusal: its code for the window, its raw detail for the operations log only (ER-7). */
export type VoiceTokenAnswer = VoiceToken | { ok: false; reason: CeoVoiceProblem; detail: string }

/** The call's instructions: who speaks, in which language, which tools it has, and how it works with them (voice CEO
 *  retro 2026-11-20, findings 2, 3, 4, 6, 7, 8: the voice ran work in a bare shell, typed twelve commands into it,
 *  guessed project names seven times in seven seconds and typed into the CEO's own console). */
export function voiceInstructions(locale: string, approvalMode: ApprovalMode = DEFAULT_APPROVAL_MODE): string {
  // ADR-0203: the owner's approval mode at the call's start, with the gates that wait for the person in every mode.
  const approval = approvalRule(approvalMode, locale === 'en' ? 'en' : 'ru')
  return locale === 'en'
    ? [
      'You are the voice of Fabric\'s CEO agent on the owner\'s computer. Speak English, briefly.',
      'You see, read, start, stop, continue and open the coding sessions of this computer with your session tools.',
      'You do not do the work yourself. New work goes to the project\'s coding agent: session_start with the task in words (the project\'s own agent, never runner shell). Open a shell only when the owner asks for a terminal, and without a task.',
      'Type into a session (session_input) only to answer its question or pick an option: three times in three minutes for a terminal, six for an agent. Anything more goes to that session\'s agent or to the CEO; for the owner to type himself, open the console with session_open.',
      'The CEO\'s own console (is_ceo in session_sessions) is never typed into: hand the CEO a request with ask_ceo, then read its answer with ceo_reply and say it.',
      'A project name you heard: call session_projects once with the word you heard. If it answers understood_as, ask the owner whether that project is meant before you start anything. With exact, go on with that project. If several come back, read the owner two or three names and ask; if it answers worktree, ask whether the worktree or the project is meant. Never try spellings one by one. When the owner tells you what a name means, or says yes to an understood_as, keep the word you heard with session_alias for that project, then go on; never keep a name that answered worktree.',
      'When the owner names the agent or the account («на Codex», «на аккаунте Y»), pass runner or account to session_start; session_accounts lists the accounts with room. After session_start, check with session_task that the session took its task; to hear a session\'s answer, session_wait. Other tools: machine_status for the computer, board_search for the project board, recap for what changed since the previous call. A message or a reminder to anyone goes through ask_ceo.',
      'Before stopping a session, read it and say why. Never write an em dash in what you say.',
      approval
    ].join(' ')
    : [
      'Ты голос CEO-агента Fabric на компьютере владельца. Говори по-русски, коротко.',
      'Инструментами сессий ты видишь, читаешь, запускаешь, останавливаешь, продолжаешь и открываешь сессии разработки этого компьютера.',
      'Работу руками ты не делаешь. Новую работу отдаёшь агенту проекта: session_start с задачей словами (агент проекта по умолчанию, никогда не runner shell). Терминал открываешь, только когда владелец прямо просит терминал, и без задачи.',
      'В сессию (session_input) вводишь только ответ на её вопрос или выбор варианта: в терминал три раза за три минуты, агенту шесть. Всё большее отдаёшь агенту этой сессии или CEO; чтобы владелец печатал сам, открой ему консоль через session_open.',
      'Консоль самого CEO (is_ceo в session_sessions) не трогаешь: просьбу передаёшь CEO через ask_ceo, его ответ читаешь через ceo_reply и пересказываешь.',
      'Имя проекта на слух ищешь одним вызовом session_projects со словом, которое услышал. Если в ответе understood_as, спроси владельца, этот ли проект он имел в виду, прежде чем что-то запускать. С exact продолжай с этим проектом. Если вернулось несколько, назови владельцу два или три и спроси; если в ответе worktree, спроси, имеется в виду копия или сам проект. Не перебирай написания. Когда владелец говорит, как он называет проект, или отвечает «да» на understood_as, запомни услышанное слово через session_alias для этого проекта и продолжай; имя, на которое пришёл worktree, не запоминай.',
      'Когда владелец называет агента или аккаунт («на Codex», «на аккаунте Y»), передай runner или account в session_start; session_accounts покажет аккаунты, где есть место. После session_start проверь через session_task, что сессия приняла задачу; чтобы услышать ответ сессии, session_wait. Ещё: machine_status про компьютер, board_search по доске проектов, recap про то, что изменилось с прошлого звонка. Сообщение или напоминание кому-либо передаёшь через ask_ceo.',
      'Прежде чем остановить сессию, прочитай её и скажи почему. Никогда не ставь длинное тире.',
      approval
    ].join(' ')
}

/** The tool that hands a request to the CEO's console, beside the session tools; its answer is read with ceo_reply. */
export const ASK_CEO_TOOL = {
  type: 'function' as const,
  name: 'ask_ceo',
  description: 'Hand a request to the CEO agent\'s console in words: anything that needs planning, several steps, a message to someone, or other tools than yours. The CEO answers in its console; read the answer with ceo_reply.',
  parameters: { type: 'object', properties: { text: { type: 'string', description: 'The request, in the owner\'s words.' } }, required: ['text'], additionalProperties: false }
}

export interface VoiceDeps {
  /** The person's own key (`ceoVoiceKey.ts`), tried first; null when none is set. */
  ownKey?: () => string | null
  vault: Pick<VaultPort, 'read'>
  fetch: typeof fetch
  now?: () => number
}

/** One ephemeral secret for one call; the key itself is held for this request only. */
export async function mintVoiceToken(deps: VoiceDeps): Promise<VoiceTokenAnswer> {
  const own = deps.ownKey?.() ?? null
  const key = own ? { ok: true as const, value: own } : await deps.vault.read(XAI_KEY_SLOT)
  if (!key.ok) return { ok: false, reason: 'no-key', detail: `no xAI key of the person's, and Observatory's could not be read: ${key.reason}` }
  let res: Response
  try {
    res = await deps.fetch(XAI_SECRETS_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key.value}`, 'content-type': 'application/json' },
      body: JSON.stringify({ expires_after: { seconds: TOKEN_SECONDS } }),
      signal: AbortSignal.timeout(15_000)
    })
  } catch (e) {
    return { ok: false, reason: 'unreachable', detail: `xAI did not answer: ${e instanceof Error ? e.name : String(e)}` }
  }
  if (!res.ok) return { ok: false, reason: 'refused', detail: `xAI refused the call: HTTP ${res.status}` }
  let body: { value?: unknown; expires_at?: unknown }
  try { body = (await res.json()) as typeof body } catch {
    // Not JSON: no secret to hand over.
    return { ok: false, reason: 'no-secret', detail: 'xAI answered without a secret' }
  }
  if (typeof body.value !== 'string' || !body.value) return { ok: false, reason: 'no-secret', detail: 'xAI answered without a secret' }
  const expiresAt = typeof body.expires_at === 'number' ? body.expires_at * 1000 : (deps.now ?? Date.now)() + TOKEN_SECONDS * 1000
  return { ok: true, value: body.value, expiresAt, url: XAI_REALTIME_URL, usdPerMinute: XAI_USD_PER_MINUTE }
}
/** xAI's text to speech: one short sample of a voice, so the person hears it before choosing (onboarding, Settings).
 *  USD 15 per million characters (docs.x.ai/developers/pricing, fetched 2026-11-19): a sample of about 90 characters is
 *  well under a cent, and each voice and language is fetched once, then kept on this computer. */
export const XAI_TTS_URL = 'https://api.x.ai/v1/tts'
export const XAI_BUILT_IN_VOICES = ['ara', 'eve', 'leo', 'rex', 'sal'] as const
/** The cache's version: a new sample text takes a new name, an old file is never played for the new words. */
const SAMPLE_VERSION = 1

export function sampleText(locale: string): string {
  return locale === 'en'
    ? 'Hello. I am the CEO of your Fabric. I watch your sessions and answer you by voice.'
    : 'Здравствуйте. Я CEO вашего Fabric. Слежу за сессиями и отвечаю вам голосом.'
}

export interface SampleDeps extends Omit<VoiceDeps, 'now'> {
  cache: { read(name: string): Buffer | null; write(name: string, bytes: Buffer): void }
}
export type VoiceSampleAnswer = { ok: true; data: string } | { ok: false; reason: CeoVoiceProblem | 'unknown-voice'; detail: string }

/** One sample of `voice` in `locale`, as base64 MP3: from the cache, else from xAI with the key held for this request. */
export async function voiceSample(deps: SampleDeps, voice: string, locale: string): Promise<VoiceSampleAnswer> {
  if (!(XAI_BUILT_IN_VOICES as readonly string[]).includes(voice)) return { ok: false, reason: 'unknown-voice', detail: 'not a built-in voice' }
  const lang = locale === 'en' ? 'en' : 'ru'
  const name = `${voice}-${lang}-v${SAMPLE_VERSION}.mp3`
  const kept = deps.cache.read(name)
  if (kept && kept.length > 0) return { ok: true, data: kept.toString('base64') }
  const own = deps.ownKey?.() ?? null
  const key = own ? { ok: true as const, value: own } : await deps.vault.read(XAI_KEY_SLOT)
  if (!key.ok) return { ok: false, reason: 'no-key', detail: `no xAI key: ${key.reason}` }
  let res: Response
  try {
    res = await deps.fetch(XAI_TTS_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key.value}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: sampleText(lang), voice_id: voice, language: lang }),
      signal: AbortSignal.timeout(20_000)
    })
  } catch (e) {
    return { ok: false, reason: 'unreachable', detail: `xAI did not answer: ${e instanceof Error ? e.name : String(e)}` }
  }
  if (!res.ok) return { ok: false, reason: 'refused', detail: `xAI refused the sample: HTTP ${res.status}` }
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length === 0) return { ok: false, reason: 'no-secret', detail: 'xAI answered without audio' }
  // A sample that cannot be kept is still played; it is fetched again next time.
  try { deps.cache.write(name, bytes) } catch { /* the cache is a saving, not a requirement */ }
  return { ok: true, data: bytes.toString('base64') }
}
// #endregion ceo-voice
